import type { PLSummary } from "@/lib/calculations/profit-loss";

const gridItem = "rounded-xl border border-agro-sprout bg-white p-4";
const gridItemAccent = "rounded-xl border border-agro-sprout bg-agro-paper p-4";

export default function PLSummary({ data }: { data: {
  totalProjectedCost: number;
  totalActualCost: number;
  projectedRevenue: number;
  actualRevenue: number;
  netProfitLoss: number;
  roi: number | null;
  variance: { absolute: number; percentage: number | null };
} }) {
  const fmt = (n: number) => `PKR ${n.toLocaleString("en-PK")}`;
  const varianceColor = data.variance.absolute > 0 ? "text-agro-error" : data.variance.absolute < 0 ? "text-agro-canopy" : "text-agro-slate";
  const plColor = data.netProfitLoss >= 0 ? "text-agro-canopy" : "text-agro-error";

  const actualRevenueDisplay = data.actualRevenue >= 0 ? fmt(data.actualRevenue) : "—";
  const projectedRevenueDisplay = data.projectedRevenue >= 0 ? fmt(data.projectedRevenue) : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className={gridItem}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Expected cost</p>
        <p className="mt-1 font-mono text-sm font-semibold text-agro-ink">{fmt(data.totalProjectedCost)}</p>
      </div>
      <div className={gridItem}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Spent so far</p>
        <p className="mt-1 font-mono text-sm font-semibold text-agro-ink">{fmt(data.totalActualCost)}</p>
      </div>
      <div className={gridItemAccent}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Cost difference</p>
        <p className={`mt-1 font-mono text-sm font-semibold ${varianceColor}`}>
          {data.variance.percentage !== null ? `${data.variance.percentage > 0 ? "+" : ""}${data.variance.percentage}%` : "N/A"}
        </p>
        <p className={`font-mono text-xs ${varianceColor}`}>{fmt(Math.abs(data.variance.absolute))}</p>
      </div>
      <div className={gridItem}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Expected income</p>
        <p className="mt-1 font-mono text-sm font-semibold text-agro-ink">{projectedRevenueDisplay}</p>
      </div>
      <div className={gridItem}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Actual income</p>
        <p className="mt-1 font-mono text-sm font-semibold text-agro-ink">{actualRevenueDisplay}</p>
      </div>
      <div className={gridItemAccent}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Total result</p>
        <p className={`mt-1 font-mono text-sm font-semibold ${plColor}`}>{fmt(data.netProfitLoss)}</p>
      </div>
      <div className={gridItemAccent}>
        <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Profit %</p>
        <p className={`mt-1 font-mono text-sm font-semibold ${data.roi === null ? "text-agro-slate" : data.roi >= 0 ? "text-agro-canopy" : "text-agro-error"}`}>
          {data.roi !== null ? `${data.roi}%` : "N/A"}
        </p>
      </div>
    </div>
  );
}
