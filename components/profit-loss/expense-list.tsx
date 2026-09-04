"use client";

import type { Expense } from "@/lib/validation/profit-loss";

const categoryColors: Record<string, string> = {
  seed: "bg-agro-mint text-agro-canopy",
  fertilizer: "bg-agro-sprout text-agro-forest",
  labor: "bg-agro-mint text-agro-canopy",
  irrigation: "bg-agro-sprout/60 text-agro-ink",
  transport: "bg-agro-leaf/20 text-agro-forest",
  other: "bg-agro-mint text-agro-canopy",
};

export default function ExpenseList({ expenses }: { expenses: (Expense & { variance?: number; variance_percentage?: number | null })[] }) {
  if (expenses.length === 0) {
    return <p className="text-sm text-agro-slate">No expenses logged yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {expenses.map((expense) => (
        <li key={expense.id} className="flex items-center justify-between rounded-xl border border-agro-sprout bg-white p-3">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-wide ${categoryColors[expense.category] ?? categoryColors.other}`}>
              {expense.category}
            </span>
            <div>
              <p className="text-sm font-medium text-agro-ink">PKR {Number(expense.amount).toLocaleString("en-PK")}</p>
              <p className="text-xs text-agro-slate">{expense.date}{expense.note ? ` — ${expense.note}` : ""}</p>
            </div>
          </div>
          {expense.variance_percentage !== undefined && expense.variance_percentage !== null && (
            <span className={`text-xs font-medium ${expense.variance_percentage > 0 ? "text-agro-error" : expense.variance_percentage < 0 ? "text-agro-canopy" : "text-agro-slate"}`}>
              {expense.variance_percentage > 0 ? "+" : ""}{expense.variance_percentage}% vs plan
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
