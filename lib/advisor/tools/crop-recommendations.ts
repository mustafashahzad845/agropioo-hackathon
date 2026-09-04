import { tool } from "@openai/agents";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";

type RecommendationRow = {
  id: string;
  request_id: string;
  rank: number;
  crop_id: string;
  name_en: string;
  category: string;
  typical_yield_per_acre_kg: string;
  growing_duration_days: string;
  season_windows: unknown;
  water_requirement_level: string;
  labour_cost_level: string;
  capital_requirement_per_acre_pkr: string;
  market_risk_baseline: string;
  expected_revenue_per_acre_pkr: string;
  revenue_confidence: string;
  reason_key: string;
  risk_factors: string[];
  suitability_score: string;
  weather_fit_score: string;
  profitability_score: string;
  risk_score: string;
  sustainability_score: string;
  final_score: string;
  data_sources_used: string[];
  target_season: string;
  target_year: string;
  soil_type: string;
  irrigation_type: string;
  budget_bracket: string;
  created_at: string;
};

type FarmPlanRow = {
  id: string;
  farm_id: string;
  farm_name: string;
  recommendation_id: string;
  target_season: string;
  target_year: string;
  created_at: string;
};

export function createCropRecommendationTools(accountId: string) {
  const getMyCropRecommendations = tool({
    name: "get_my_crop_recommendations",
    description:
      "Get the farmer's past crop recommendation results. Returns ranked crop suggestions with suitability scores, expected revenue, risk factors, and profitability analysis. Use this when the farmer asks 'what should I plant?', 'which crop is best?', or wants to see their previous recommendation results.",
    parameters: z.object({
      farmId: z.string().optional().describe("Specific farm ID to filter recommendations by"),
      targetSeason: z.string().optional().describe("Filter by season (summer, winter, rainy, dry)"),
      targetYear: z.string().optional().describe("Filter by year (e.g. 2024-25)"),
    }),
    async execute({ farmId, targetSeason, targetYear }) {
      const conditions: string[] = ["r.account_id = $1"];
      const params: (string | number)[] = [accountId];
      let paramIdx = 2;

      if (farmId) {
        conditions.push(`r.farm_id = $${paramIdx++}`);
        params.push(farmId);
      }
      if (targetSeason) {
        conditions.push(`r.target_season = $${paramIdx++}`);
        params.push(targetSeason);
      }
      if (targetYear) {
        conditions.push(`r.target_year = $${paramIdx++}`);
        params.push(targetYear);
      }

      const requests = await query<Record<string, unknown>>(
        `SELECT r.*, f.name AS farm_name
         FROM crop_recommendation_requests r
         JOIN farms f ON f.id = r.farm_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY r.created_at DESC
         LIMIT 10`,
        params
      );

      if (requests.length === 0) {
        return "No crop recommendations found. The farmer can get recommendations from the Crops section by providing their soil type, irrigation method, and budget.";
      }

      const recommendations: RecommendationRow[] = [];
      for (const req of requests) {
        const recs = await query<RecommendationRow>(
          `SELECT r.*, c.name_en, c.category, c.typical_yield_per_acre_kg, c.growing_duration_days,
                  c.season_windows, c.water_requirement_level, c.labour_cost_level,
                  c.capital_requirement_per_acre_pkr, c.market_risk_baseline,
                  req.target_season, req.target_year, req.soil_type, req.irrigation_type, req.budget_bracket
           FROM crop_recommendations r
           JOIN crops c ON c.id = r.crop_id
           JOIN crop_recommendation_requests req ON req.id = r.request_id
           WHERE r.request_id = $1
           ORDER BY r.rank ASC`,
          [req.id as string]
        );
        recommendations.push(...recs);
      }

      if (recommendations.length === 0) {
        return "Recommendation requests found but no crop suggestions available yet.";
      }

      const grouped = new Map<string, RecommendationRow[]>();
      for (const rec of recommendations) {
        const key = rec.request_id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(rec);
      }

      const output: string[] = [];
      for (const [requestId, recs] of grouped) {
        const req = requests.find(r => r.id === requestId);
        if (!req) continue;
        const topRec = recs[0];
        output.push(`${(req.farm_name as string)} — ${req.target_season} ${req.target_year}:`);
        output.push(`  Top recommendation: ${topRec.name_en} (Rank ${topRec.rank})`);
        output.push(`  Suitability: ${(Number(topRec.suitability_score) * 100).toFixed(0)}% | Profitability: ${(Number(topRec.profitability_score) * 100).toFixed(0)}% | Final score: ${(Number(topRec.final_score) * 100).toFixed(0)}%`);
        output.push(`  Expected revenue: Rs ${Number(topRec.expected_revenue_per_acre_pkr).toLocaleString("en-PK")}/acre`);
        output.push(`  Risk factors: ${topRec.risk_factors.length > 0 ? topRec.risk_factors.join(", ") : "none specified"}`);
        if (recs.length > 1) {
          output.push(`  Alternatives: ${recs.slice(1).map(r => `${r.name_en} (score ${(Number(r.final_score) * 100).toFixed(0)}%)`).join(", ")}`);
        }
        output.push("");
      }

      return output.join("\n");
    },
  });

  const getFarmPlan = tool({
    name: "get_farm_plan",
    description:
      "Get the farmer's saved farm plan entries with crop rotation suggestions. Use this when the farmer asks about their farm plan, crop rotation, or what they planned to plant.",
    parameters: z.object({
      farmId: z.string().optional().describe("Specific farm ID to filter by"),
    }),
    async execute({ farmId }) {
      const conditions: string[] = ["fpe.account_id = $1"];
      const params: (string | number)[] = [accountId];
      let paramIdx = 2;

      if (farmId) {
        conditions.push(`fpe.farm_id = $${paramIdx++}`);
        params.push(farmId);
      }

      const plans = await query<FarmPlanRow>(
        `SELECT fpe.id, fpe.farm_id, f.name AS farm_name, fpe.recommendation_id,
                fpe.target_season, fpe.target_year, fpe.created_at
         FROM farm_plan_entries fpe
         JOIN farms f ON f.id = fpe.farm_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY fpe.created_at DESC
         LIMIT 10`,
        params
      );

      if (plans.length === 0) {
        return "No farm plan entries found. The farmer hasn't saved any crop plans yet.";
      }

      const output: string[] = [];
      for (const plan of plans) {
        const rotations = await query<{ crop_name: string; reason_key: string; sequence_position: number }>(
          `SELECT c.name_en AS crop_name, cs.reason_key, cs.sequence_position
           FROM crop_rotation_suggestions cs
           JOIN crop_recommendations cr ON cr.id = cs.farm_plan_entry_id
           JOIN crops c ON c.id = cs.crop_id
           WHERE cs.farm_plan_entry_id = $1
           ORDER BY cs.sequence_position ASC`,
          [plan.recommendation_id]
        );

        output.push(`${plan.farm_name} — ${plan.target_season} ${plan.target_year}:`);
        if (rotations.length > 0) {
          rotations.forEach((r, i) => {
            output.push(`  ${i + 1}. ${r.crop_name} (rotation suggestion)`);
          });
        } else {
          output.push(`  Plan saved — no rotation details available`);
        }
        output.push("");
      }

      return output.join("\n");
    },
  });

  return { getMyCropRecommendations, getFarmPlan };
}
