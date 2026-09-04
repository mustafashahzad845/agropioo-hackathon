import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSessionPage } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import SeasonDetailClient from "./season-detail-client";

export const metadata: Metadata = {
  title: "Season details — Agropioo",
};

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSessionPage();
  const { id } = await params;
  const season = await query<Record<string, unknown>>(
    `SELECT * FROM seasons WHERE id = $1 AND account_id = $2`,
    [id, session.accountId]
  );
  const data = season[0] ?? null;
  if (!data) notFound();

  const farm = await query<Record<string, unknown>>(`SELECT * FROM farms WHERE id = $1`, [data.farm_id]);
  const crop = await query<Record<string, unknown>>(`SELECT * FROM crops WHERE id = $1`, [data.crop_id]);
  const expenses = await query<Record<string, unknown>>(
    `SELECT e.*, pc.per_acre_cost_pkr, pc.total_projected_pkr FROM expenses e LEFT JOIN projected_costs pc ON pc.season_id = e.season_id AND pc.category = e.category WHERE e.season_id = $1 ORDER BY e.date DESC, e.created_at DESC`,
    [id]
  );
  const projectedCosts = await query<Record<string, unknown>>(
    `SELECT * FROM projected_costs WHERE season_id = $1 ORDER BY category`,
    [id]
  );

  const totalProjectedCost = (projectedCosts ?? []).reduce((sum, p) => sum + Number(p.total_projected_pkr), 0);
  const totalActualCost = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const actualRevenue = (data.actual_price != null) ? Number(data.actual_price) : 0;

  const pl: { netProfitLoss: number; roi: number | null; variance: { absolute: number; percentage: number | null }; status: 'profit' | 'loss' | 'break_even' } = {
    netProfitLoss: actualRevenue - totalActualCost,
    roi: actualRevenue > 0 || totalActualCost > 0 ? Math.round(((actualRevenue - totalActualCost) / totalActualCost) * 1000) / 10 : null,
    variance: { absolute: totalActualCost - totalProjectedCost, percentage: totalProjectedCost > 0 ? Math.round(((totalActualCost - totalProjectedCost) / totalProjectedCost) * 1000) / 10 : null },
    status: (actualRevenue - totalActualCost) > 0 ? "profit" : (actualRevenue - totalActualCost) < 0 ? "loss" : "break_even",
  };

  const breakEven = (data.expected_price && data.expected_yield && Number(data.expected_price) > 0 && Number(data.expected_yield) > 0)
    ? { yield: `${Math.round((totalProjectedCost / Number(data.expected_price)) * 100) / 100} units`, price: `PKR ${Math.round((totalProjectedCost / (Number(data.expected_yield) * Number(data.acres))) * 100) / 100} per unit` }
    : null;

  const enrichedExpenses = (expenses ?? []).map((e) => {
    const projected = e.total_projected_pkr ? Number(e.total_projected_pkr) : 0;
    const actual = Number(e.amount);
    const variance = actual - projected;
    const variancePct = projected > 0 ? Math.round((variance / projected) * 1000) / 10 : null;
    return { ...e, variance, variance_percentage: variancePct };
  });

  const seasonDetail = {
    id: String(data.id),
    farm_id: String(data.farm_id),
    crop_id: String(data.crop_id),
    season: String(data.season),
    year: String(data.year),
    start_date: String(data.start_date),
    acres: Number(data.acres),
    status: String(data.status),
    expected_yield: data.expected_yield != null ? Number(data.expected_yield) : null,
    expected_price: data.expected_price != null ? Number(data.expected_price) : null,
    actual_yield: data.actual_yield != null ? Number(data.actual_yield) : null,
    actual_price: data.actual_price != null ? Number(data.actual_price) : null,
    archived_at: data.archived_at as string | null,
    farm_name: farm[0]?.name as string | undefined,
    crop_name: crop[0]?.name_en as string | undefined,
    expenses: enrichedExpenses,
    projected_costs: projectedCosts ?? [],
    pl,
    break_even: breakEven,
    crop_unit: "Maund",
    actual_revenue: actualRevenue,
  };

  return <SeasonDetailClient season={seasonDetail} />;
}
