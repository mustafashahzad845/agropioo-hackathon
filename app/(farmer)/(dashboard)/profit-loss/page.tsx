import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/shell/page-header";
import { PlusIcon } from "@/components/icons";
import { requireSessionPage } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import SeasonCard from "@/components/profit-loss/season-card";

export const metadata: Metadata = {
  title: "Profit / Loss — Agropioo",
};

type SeasonRow = {
  id: string;
  crop_name: string;
  farm_name: string;
  season: string;
  year: string;
  acres: number;
  status: string;
  pl: { netProfitLoss: number; roi: number | null };
};

export default async function ProfitLossPage() {
  const session = await requireSessionPage();
  let seasons: SeasonRow[] = [];
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT s.id, c.name_en as crop_name, f.name as farm_name, s.season, s.year, s.acres, s.status,
              COALESCE(SUM(e.amount), 0) as total_actual_cost,
              COALESCE(SUM(pc.total_projected_pkr), 0) as total_projected_cost,
              COALESCE(s.actual_yield, 0) as actual_yield,
              COALESCE(s.actual_price, 0) as actual_price
         FROM seasons s
         JOIN farms f ON f.id = s.farm_id
         JOIN crops c ON c.id = s.crop_id
         LEFT JOIN expenses e ON e.season_id = s.id
         LEFT JOIN projected_costs pc ON pc.season_id = s.id
        WHERE s.account_id = $1 AND s.archived_at IS NULL
        GROUP BY s.id, c.name_en, f.name, s.season, s.year, s.acres, s.status, s.actual_yield, s.actual_price
        ORDER BY s.created_at DESC`,
      [session.accountId]
    );
    seasons = (rows ?? []).map((r) => {
      const totalActual = Number(r.total_actual_cost ?? 0);
      const actualRevenue = Number(r.actual_price ?? 0);
      const netProfitLoss = actualRevenue - totalActual;
      const roi = totalActual > 0 ? Math.round(((actualRevenue - totalActual) / totalActual) * 1000) / 10 : null;
      return {
        id: String(r.id),
        crop_name: String(r.crop_name ?? r.crop_id ?? ""),
        farm_name: String(r.farm_name ?? ""),
        season: String(r.season ?? ""),
        year: String(r.year ?? ""),
        acres: Number(r.acres ?? 0),
        status: String(r.status ?? "active"),
        pl: { netProfitLoss, roi },
      };
    });
  } catch (err) {
    console.error("Error fetching seasons:", err);
  }

  return (
    <div className="pt-1">
      <PageHeader
        eyebrow="Financial cockpit"
        title="Profit / Loss"
        description="Track your season-level costs, revenue, and profitability."
        action={
          <Link
            href="/profit-loss/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-agro-canopy px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-agro-forest hover:shadow-md"
          >
            <PlusIcon className="h-4 w-4" />
            New season
          </Link>
        }
      />

      {seasons.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-agro-sprout bg-white p-8 text-center">
          <p className="text-sm text-agro-slate">No seasons yet. Start your first season to track costs and profits.</p>
          <Link href="/profit-loss/new" className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-agro-canopy px-5 text-sm font-semibold text-white">
            Start a new season
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:gap-4 lg:grid-cols-2">
          {seasons.map((season) => (
            <li key={season.id}>
              <SeasonCard season={season} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
