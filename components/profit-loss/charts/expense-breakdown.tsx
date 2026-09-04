"use client";

type ExpenseRow = { category: string; amount: number };

export default function ExpenseBreakdown({ expenses }: { expenses: ExpenseRow[] }) {
  if (expenses.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-agro-sprout bg-agro-paper p-6 text-center">
        <p className="text-sm font-medium text-agro-slate">No expenses recorded yet</p>
        <p className="text-xs text-agro-cloud">Log your first expense to see the breakdown</p>
      </div>
    );
  }

  const categories = Array.from(new Set(expenses.map((e) => e.category)));
  const totals: Record<string, number> = {};
  expenses.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  const width = 320;
  const height = 220;
  const radius = 80;
  const cx = width / 2;
  const cy = height / 2;

  let startAngle = -Math.PI / 2;
  const slices = categories.map((cat) => {
    const value = totals[cat] || 0;
    const angle = total > 0 ? (value / total) * 2 * Math.PI : 0;
    const slice = { category: cat, value, startAngle, endAngle: startAngle + angle };
    startAngle += angle;
    return slice;
  });

  const paletteClasses = ["fill-agro-forest", "fill-agro-canopy", "fill-agro-leaf", "fill-agro-sprout", "fill-agro-mint", "fill-agro-forest/80"];
  const legendBgClasses = ["bg-agro-forest", "bg-agro-canopy", "bg-agro-leaf", "bg-agro-sprout", "bg-agro-mint", "bg-agro-forest/80"];

  const polarToCartesian = (angle: number, r: number) => {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const pathForSlice = (slice: { startAngle: number; endAngle: number }) => {
    const innerStart = polarToCartesian(slice.startAngle, radius * 0.5);
    const outerStart = polarToCartesian(slice.startAngle, radius);
    const outerEnd = polarToCartesian(slice.endAngle, radius);
    const innerEnd = polarToCartesian(slice.endAngle, radius * 0.5);
    const largeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;
    return [
      `M ${innerStart.x} ${innerStart.y}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${radius * 0.5} ${radius * 0.5} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-sm">
        {slices.map((slice, i) => (
          <path key={slice.category} d={pathForSlice(slice)} className={`stroke-white ${paletteClasses[i % paletteClasses.length]}`} strokeWidth="2" />
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat, i) => (
          <div key={cat} className="flex items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-sm ${legendBgClasses[i % legendBgClasses.length]}`} />
            <span className="text-xs text-agro-ink">{cat}: PKR {(totals[cat] || 0).toLocaleString("en-PK")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
