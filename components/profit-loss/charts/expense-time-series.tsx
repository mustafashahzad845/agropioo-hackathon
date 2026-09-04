"use client";

type ExpenseRow = { date: string; amount: number; projected_total?: number };

export default function ExpenseTimeSeries({ expenses, projectedCosts }: { expenses: ExpenseRow[]; projectedCosts: ExpenseRow[] }) {
  const width = 720;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 40, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allValues = [...expenses, ...projectedCosts].map((e) => e.amount);
  const maxValue = Math.max(...allValues, 1);
  const range = maxValue;

  const xFor = (index: number, total: number) => {
    const spacing = chartWidth / total;
    return padding.left + spacing * index + spacing / 2;
  };
  const yFor = (value: number) => padding.top + chartHeight - (value / range) * chartHeight;
  const baselineY = yFor(0);

  const months = Array.from(new Set([...expenses, ...projectedCosts].map((e) => e.date.slice(0, 7))));
  const sortedMonths = months.sort();

  const projectedByMonth: Record<string, number> = {};
  projectedCosts.forEach((e) => {
    const m = e.date.slice(0, 7);
    projectedByMonth[m] = (projectedByMonth[m] || 0) + e.amount;
  });
  const actualByMonth: Record<string, number> = {};
  expenses.forEach((e) => {
    const m = e.date.slice(0, 7);
    actualByMonth[m] = (actualByMonth[m] || 0) + e.amount;
  });

  const projectedCum: { month: string; value: number }[] = [];
  const actualCum: { month: string; value: number }[] = [];
  let pAcc = 0;
  let aAcc = 0;
  sortedMonths.forEach((m) => {
    pAcc += projectedByMonth[m] || 0;
    aAcc += actualByMonth[m] || 0;
    projectedCum.push({ month: m, value: pAcc });
    actualCum.push({ month: m, value: aAcc });
  });

  if (sortedMonths.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-agro-sprout bg-agro-paper p-6 text-center">
        <p className="text-sm font-medium text-agro-slate">No expense data available yet</p>
        <p className="text-xs text-agro-cloud">Start logging expenses to see monthly trends</p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-w-3xl"
        aria-hidden="true"
        role="img"
      >
        <line x1={padding.left} y1={baselineY} x2={width - padding.right} y2={baselineY} className="stroke-agro-sprout" strokeDasharray="4 4" />
        {sortedMonths.map((m, i) => {
          const x = xFor(i, sortedMonths.length);
          const pVal = projectedCum[i]?.value ?? 0;
          const aVal = actualCum[i]?.value ?? 0;
          return (
            <g key={m}>
              <text x={x} y={height - 8} textAnchor="middle" className="fill-agro-slate font-mono text-xs">
                {m}
              </text>
              {pVal > 0 && (
                <circle cx={x} cy={yFor(pVal)} r={4} className="fill-agro-canopy" />
              )}
              {aVal > 0 && (
                <circle cx={x} cy={yFor(aVal)} r={4} className="fill-agro-leaf" />
              )}
            </g>
          );
        })}
        {projectedCum.length > 1 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-agro-canopy"
            points={projectedCum.map((p, i) => `${xFor(i, projectedCum.length)},${yFor(p.value)}`).join(" ")}
          />
        )}
        {actualCum.length > 1 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-agro-leaf"
            points={actualCum.map((p, i) => `${xFor(i, actualCum.length)},${yFor(p.value)}`).join(" ")}
          />
        )}
      </svg>
      <div className="mt-2 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-agro-slate">
          <span className="h-2 w-2 rounded-full bg-agro-canopy" /> Projected
        </span>
        <span className="flex items-center gap-1.5 text-xs text-agro-slate">
          <span className="h-2 w-2 rounded-full bg-agro-leaf" /> Actual
        </span>
      </div>
    </div>
  );
}
