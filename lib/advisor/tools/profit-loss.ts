import { tool } from "@openai/agents";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";

type SeasonRow = {
  id: string;
  farm_id: string;
  crop_id: string;
  season: string;
  year: string;
  start_date: string;
  acres: string;
  status: string;
  expected_yield: string | null;
  expected_price: string | null;
  actual_yield: string | null;
  actual_price: string | null;
  farm_name: string;
  crop_name: string;
};

type ExpenseRow = {
  id: string;
  category: string;
  amount: string;
  date: string;
  note: string | null;
  projected_pkr: string | null;
};

export function createProfitLossTools(accountId: string) {
  const getMySeasons = tool({
    name: "get_my_seasons",
    description:
      "Get the farmer's farming seasons with crop, farm, acres, status, yield, and price data. Use this when the farmer asks about their seasons, crops grown, harvests, or profit/loss overview.",
    parameters: z.object({
      status: z.enum(["active", "harvested", "completed"]).optional().describe("Filter by season status"),
      farmId: z.string().optional().describe("Specific farm ID to filter by"),
    }),
    async execute({ status, farmId }) {
      const conditions: string[] = ["s.account_id = $1", "f.account_id = $1"];
      const params: (string | number)[] = [accountId];
      let paramIdx = 2;

      if (status) {
        conditions.push(`s.status = $${paramIdx++}`);
        params.push(status);
      }
      if (farmId) {
        conditions.push(`s.farm_id = $${paramIdx++}`);
        params.push(farmId);
      }

      const seasons = await query<SeasonRow>(
        `SELECT s.id, s.farm_id, s.crop_id, s.season, s.year, s.start_date, s.acres, s.status,
                s.expected_yield, s.expected_price, s.actual_yield, s.actual_price,
                f.name AS farm_name, c.name_en AS crop_name
         FROM seasons s
         JOIN farms f ON f.id = s.farm_id
         JOIN crops c ON c.id = s.crop_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY s.created_at DESC
         LIMIT 20`,
        params
      );

      if (seasons.length === 0) {
        return status === "harvested" || status === "completed"
          ? `No ${status} seasons found. The farmer may not have completed any seasons yet.`
          : "No seasons found. The farmer hasn't started any farming seasons yet. They can create one from the Profit/Loss section.";
      }

      return seasons.map(s => {
        const yieldInfo = s.actual_yield
          ? `harvest: ${s.actual_yield} units @ Rs ${s.actual_price}/unit`
          : s.expected_yield
            ? `expected: ${s.expected_yield} units @ Rs ${s.expected_price}/unit`
            : "no yield data yet";
        const statusLabel = s.status === "active" ? "Active" : s.status === "harvested" ? "Harvested" : "Completed";
        return `• ${s.crop_name} on ${s.farm_name} (${s.season} ${s.year}): ${s.acres} acres, ${statusLabel}, ${yieldInfo}`;
      }).join("\n");
    },
  });

  const getSeasonExpenses = tool({
    name: "get_season_expenses",
    description:
      "Get expenses and projected costs for a specific farming season. Use this when the farmer asks about their expenses, costs, spending, or budget for a particular season.",
    parameters: z.object({
      seasonId: z.string().describe("The season ID to get expenses for"),
    }),
    async execute({ seasonId }) {
      const seasonOwner = await queryOne<{ account_id: string; farm_id: string; crop_id: string; season: string; year: string; acres: string; status: string; farm_name: string; crop_name: string }>(
        `SELECT s.account_id, s.farm_id, s.crop_id, s.season, s.year, s.acres, s.status,
                f.name AS farm_name, c.name_en AS crop_name
         FROM seasons s
         JOIN farms f ON f.id = s.farm_id
         JOIN crops c ON c.id = s.crop_id
         WHERE s.id = $1`,
        [seasonId]
      );

      if (!seasonOwner || seasonOwner.account_id !== accountId) {
        return "Season not found or does not belong to you.";
      }

      const expenses = await query<ExpenseRow>(
        `SELECT e.category, e.amount, e.date, e.note,
                pc.total_projected_pkr
         FROM expenses e
         LEFT JOIN projected_costs pc ON pc.season_id = e.season_id AND pc.category = e.category
         WHERE e.season_id = $1
         ORDER BY e.date DESC, e.created_at DESC`,
        [seasonId]
      );

      const projectedCosts = await query<{ category: string; per_acre_cost_pkr: string; total_projected_pkr: string }>(
        `SELECT category, per_acre_cost_pkr, total_projected_pkr
         FROM projected_costs
         WHERE season_id = $1`,
        [seasonId]
      );

      const totalActual = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalProjected = projectedCosts.reduce((sum, p) => sum + Number(p.total_projected_pkr), 0);
      const variance = totalActual - totalProjected;
      const variancePct = totalProjected > 0 ? ((variance / totalProjected) * 100).toFixed(1) : "0.0";

      let output = `${seasonOwner.crop_name} on ${seasonOwner.farm_name} (${seasonOwner.season} ${seasonOwner.year}, ${seasonOwner.acres} acres)\n`;
      output += `Status: ${seasonOwner.status}\n\n`;

      if (projectedCosts.length > 0) {
        output += `Projected costs (CACP baseline):\n`;
        projectedCosts.forEach(p => {
          output += `• ${p.category}: Rs ${Number(p.per_acre_cost_pkr).toLocaleString("en-PK")}/acre × ${seasonOwner.acres} acres = Rs ${Number(p.total_projected_pkr).toLocaleString("en-PK")}\n`;
        });
        output += `Total projected: Rs ${totalProjected.toLocaleString("en-PK")}\n\n`;
      } else {
        output += `No projected costs set for this season.\n\n`;
      }

      output += `Actual expenses:\n`;
      if (expenses.length === 0) {
        output += `No expenses logged yet.\n`;
      } else {
        expenses.forEach(e => {
          const varianceStr = e.projected_pkr
            ? ` (vs projected Rs ${Number(e.projected_pkr).toLocaleString("en-PK")}, ${Number(e.amount) > Number(e.projected_pkr) ? "over" : "under"} budget)`
            : "";
          output += `• ${e.category} — Rs ${Number(e.amount).toLocaleString("en-PK")} on ${e.date}${varianceStr}${e.note ? ` (${e.note})` : ""}\n`;
        });
        output += `Total actual: Rs ${totalActual.toLocaleString("en-PK")}\n`;
        output += `Variance: Rs ${Math.abs(variance).toLocaleString("en-PK")} (${variance > 0 ? "over" : "under"} budget, ${variancePct}%)\n`;
      }

      return output;
    },
  });

  const getProfitLossSummary = tool({
    name: "get_profit_loss_summary",
    description:
      "Get a complete profit/loss summary for a specific season, including investment, revenue, net profit/loss, and ROI. Use this when the farmer asks 'how much profit?', 'how much loss?', 'kitna kamaya?', 'kitna loss?', or wants a full financial summary of a season.",
    parameters: z.object({
      seasonId: z.string().describe("The season ID to get P&L summary for"),
    }),
    async execute({ seasonId }) {
      const seasonOwner = await queryOne<{ account_id: string; farm_id: string; crop_id: string; season: string; year: string; acres: string; status: string; expected_yield: string | null; expected_price: string | null; actual_yield: string | null; actual_price: string | null; farm_name: string; crop_name: string }>(
        `SELECT s.account_id, s.farm_id, s.crop_id, s.season, s.year, s.acres, s.status,
                s.expected_yield, s.expected_price, s.actual_yield, s.actual_price,
                f.name AS farm_name, c.name_en AS crop_name
         FROM seasons s
         JOIN farms f ON f.id = s.farm_id
         JOIN crops c ON c.id = s.crop_id
         WHERE s.id = $1`,
        [seasonId]
      );

      if (!seasonOwner || seasonOwner.account_id !== accountId) {
        return "Season not found or does not belong to you.";
      }

      const totalActual = await queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), '0') AS total FROM expenses WHERE season_id = $1`,
        [seasonId]
      );

      const projectedCosts = await query<{ total_projected_pkr: string }>(
        `SELECT COALESCE(SUM(total_projected_pkr), '0') AS total_projected_pkr FROM projected_costs WHERE season_id = $1`,
        [seasonId]
      );

      const investment = Number(totalActual?.total ?? "0");
      const projectedInvestment = Number(projectedCosts[0]?.total_projected_pkr ?? "0");

      const expectedYield = seasonOwner.expected_yield ? Number(seasonOwner.expected_yield) : null;
      const expectedPrice = seasonOwner.expected_price ? Number(seasonOwner.expected_price) : null;
      const actualYield = seasonOwner.actual_yield ? Number(seasonOwner.actual_yield) : null;
      const actualPrice = seasonOwner.actual_price ? Number(seasonOwner.actual_price) : null;

      const projectedRevenue = expectedYield && expectedPrice ? expectedYield * expectedPrice : null;
      const actualRevenue = actualYield && actualPrice ? actualYield * actualPrice : null;

      const netProfitLoss = actualRevenue !== null ? actualRevenue - investment : null;
      const roi = investment > 0 && netProfitLoss !== null ? ((netProfitLoss / investment) * 100).toFixed(1) : null;

      const breakEvenYield = actualPrice && actualPrice > 0 ? investment / actualPrice : null;
      const breakEvenPrice = expectedYield && expectedYield > 0 ? investment / expectedYield : null;

      let output = `${seasonOwner.crop_name} — ${seasonOwner.farm_name} (${seasonOwner.season} ${seasonOwner.year})\n`;
      output += `Area: ${seasonOwner.acres} acres | Status: ${seasonOwner.status}\n\n`;

      output += `Investment:\n`;
      output += `• Total actual cost: Rs ${investment.toLocaleString("en-PK")}\n`;
      if (projectedInvestment > 0) {
        output += `• Total projected cost: Rs ${projectedInvestment.toLocaleString("en-PK")}\n`;
        const investmentVariance = investment - projectedInvestment;
        output += `• Variance: Rs ${Math.abs(investmentVariance).toLocaleString("en-PK")} (${investmentVariance > 0 ? "over" : "under"} budget)\n`;
      }

      output += `\nRevenue:\n`;
      if (actualRevenue !== null) {
        output += `• Actual revenue: Rs ${actualRevenue.toLocaleString("en-PK")} (${actualYield} units × Rs ${actualPrice}/unit)\n`;
      }
      if (projectedRevenue !== null) {
        output += `• Projected revenue: Rs ${projectedRevenue.toLocaleString("en-PK")} (${expectedYield} units × Rs ${expectedPrice}/unit)\n`;
      }
      if (actualRevenue === null && projectedRevenue === null) {
        output += `• No yield/price data recorded yet. Log harvest data to see revenue.\n`;
      }

      output += `\nProfit/Loss:\n`;
      if (netProfitLoss !== null) {
        const label = netProfitLoss >= 0 ? "Net Profit" : "Net Loss";
        output += `• ${label}: Rs ${Math.abs(netProfitLoss).toLocaleString("en-PK")}\n`;
      } else if (projectedRevenue !== null) {
        const projectedProfit = projectedRevenue - investment;
        const label = projectedProfit >= 0 ? "Projected Profit" : "Projected Loss";
        output += `• ${label}: Rs ${Math.abs(projectedProfit).toLocaleString("en-PK")}\n`;
      } else {
        output += `• Add yield and price data to calculate profit/loss.\n`;
      }

      if (roi !== null) {
        output += `• ROI: ${Number(roi) >= 0 ? "+" : ""}${roi}%\n`;
      }

      if (breakEvenYield !== null) {
        output += `\nBreak-even:\n`;
        output += `• Need to produce: ${breakEvenYield.toFixed(1)} units total to recover costs\n`;
      }
      if (breakEvenPrice !== null) {
        output += `• Minimum price needed: Rs ${breakEvenPrice.toFixed(0)}/unit to break even\n`;
      }

      return output;
    },
  });

  return { getMySeasons, getSeasonExpenses, getProfitLossSummary };
}
