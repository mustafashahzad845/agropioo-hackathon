"use client";

import { useForm } from "react-hook-form";
import { type UpdateSeasonInput } from "@/lib/validation/profit-loss";
import { useState } from "react";
import type { PLSummary } from "@/lib/calculations/profit-loss";
import PLSummaryComponent from "@/components/profit-loss/pl-summary";
import BreakEvenDisplay from "@/components/profit-loss/break-even-display";
import ExpenseList from "@/components/profit-loss/expense-list";
import ExpenseForm from "@/components/profit-loss/expense-form";
import ExpenseTimeSeries from "@/components/profit-loss/charts/expense-time-series";
import ExpenseBreakdown from "@/components/profit-loss/charts/expense-breakdown";
import BreakEvenBar from "@/components/profit-loss/charts/break-even-bar";
import { ArrowLeftIcon, TrashIcon, ArchiveIcon, RestoreIcon } from "@/components/icons";
import ConfirmModal from "@/components/profit-loss/confirm-modal";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SeasonDetail = {
  id: string;
  crop_id: string;
  crop_name?: string;
  season: string;
  year: string;
  acres: number;
  status: string;
  expected_yield: number | null;
  expected_price: number | null;
  actual_yield: number | null;
  actual_price: number | null;
  archived_at: string | null;
  farm_name?: string;
  expenses: Array<Record<string, unknown>>;
  projected_costs: Array<Record<string, unknown>>;
  pl: PLSummary;
  break_even: { yield: string; price: string } | null;
  crop_unit: string;
  actual_revenue: number;
};

export default function SeasonDetailClient({ season }: { season: SeasonDetail }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveActualYield, setLiveActualYield] = useState<string>(season.actual_yield != null ? String(season.actual_yield) : "");
  const [liveActualPrice, setLiveActualPrice] = useState<string>(season.actual_price != null ? String(season.actual_price) : "");
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: "archive" | "delete" | "restore" | null }>({ open: false, action: null });

  const onRefresh = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  const handleArchive = async () => {
    setRefreshing(true);
    const res = await fetch(`/api/profit-loss/${season.id}/archive`, { method: "POST" });
    setRefreshing(false);
    setConfirmModal({ open: false, action: null });
    if (res.ok) onRefresh();
  };

  const handleRestore = async () => {
    setRefreshing(true);
    const res = await fetch(`/api/profit-loss/${season.id}/restore`, { method: "POST" });
    setRefreshing(false);
    setConfirmModal({ open: false, action: null });
    if (res.ok) onRefresh();
  };

  const handleDelete = async () => {
    setRefreshing(true);
    const res = await fetch(`/api/profit-loss/${season.id}`, { method: "DELETE" });
    setRefreshing(false);
    setConfirmModal({ open: false, action: null });
    if (res.ok) router.push("/profit-loss");
    else {
      const err = await res.json();
      setError(err.error?.message ?? "Failed to delete");
    }
  };

  const openConfirm = (action: "archive" | "delete" | "restore") => setConfirmModal({ open: true, action });
  const closeConfirm = () => setConfirmModal({ open: false, action: null });

  const confirmTitle =
    confirmModal.action === "delete" ? "Delete season?" : confirmModal.action === "archive" ? "Archive season?" : "Restore season?";
  const confirmDescription =
    confirmModal.action === "delete"
      ? "This will permanently delete this season and all its data. This cannot be undone."
      : confirmModal.action === "archive"
        ? "This season will be hidden from your list, but all data will be saved."
        : "This season will return to your active list.";
  const confirmLabel = confirmModal.action === "delete" ? "Delete" : confirmModal.action === "archive" ? "Archive" : "Restore";
  const confirmVariant = confirmModal.action === "delete" ? "danger" : "warning";

  const handleHarvest = async (data: UpdateSeasonInput) => {
    setRefreshing(true);
    const res = await fetch(`/api/profit-loss/${season.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, status: "completed" }),
    });
    setRefreshing(false);
    if (res.ok) onRefresh();
    else {
      const err = await res.json();
      setError(err.error?.message ?? "Failed to update");
    }
  };

  const handleExpenseCreated = () => {
    onRefresh();
  };

  const expenseRows = season.expenses.map((e) => ({
    date: new Date(e.date as string | Date).toISOString().slice(0, 7),
    amount: Number(e.amount),
  }));
  const projectedRows = season.projected_costs.map((p) => ({
    date: new Date().toISOString().slice(0, 7),
    amount: Number(p.total_projected_pkr),
  }));

  return (
    <div className="space-y-6 pt-1">
      <div className="flex items-center gap-3">
        <Link href="/profit-loss" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-agro-sprout text-agro-slate transition-colors hover:bg-agro-mint hover:text-agro-canopy">
          <ArrowLeftIcon size={18} />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-agro-forest">{season.crop_name ?? season.crop_id}</h1>
          <p className="text-sm text-agro-slate">{season.farm_name} · {season.season} {season.year} · {season.acres} acres</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {season.archived_at ? (
            <button onClick={() => openConfirm("restore")} disabled={refreshing} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-agro-sprout px-3 text-xs font-semibold text-agro-ink transition-colors hover:bg-agro-mint hover:text-agro-canopy disabled:opacity-50">
              <RestoreIcon size={14} /> Restore
            </button>
          ) : (
            <>
              <button onClick={() => openConfirm("archive")} disabled={refreshing} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-agro-sprout px-3 text-xs font-semibold text-agro-ink transition-colors hover:bg-agro-mint hover:text-agro-canopy disabled:opacity-50">
                <ArchiveIcon size={14} /> Archive
              </button>
              <button onClick={() => openConfirm("delete")} disabled={refreshing} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-agro-canopy/30 px-3 text-xs font-semibold text-agro-canopy transition-colors hover:bg-agro-mint disabled:opacity-50">
                <TrashIcon size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-agro-canopy/30 bg-agro-mint p-3 text-sm text-agro-forest">{error}</div>}

      <section className="grid gap-4">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-agro-canopy" />
          <h2 className="font-display text-lg font-semibold text-agro-forest">Profit summary</h2>
        </div>
        <div className="rounded-2xl border border-agro-sprout bg-white p-1">
          <PLSummaryComponent
            data={{
              totalProjectedCost,
              totalActualCost,
              projectedRevenue,
              actualRevenue,
              netProfitLoss: liveNetProfitLoss,
              roi: liveRoi,
              variance: liveVariance,
            }}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-agro-sprout bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-agro-canopy" />
            <h2 className="font-display text-lg font-semibold text-agro-forest">Break-even</h2>
          </div>
          <div className="mt-4">
            <BreakEvenDisplay data={season.break_even} />
          </div>
          <div className="mt-3">
            <BreakEvenBar currentYield={season.expected_yield ?? null} breakEvenYield={season.break_even?.yield ?? null} cropUnit={season.crop_unit} />
          </div>
        </div>
        <div className="rounded-2xl border border-agro-sprout bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-agro-canopy" />
            <h2 className="font-display text-lg font-semibold text-agro-forest">Expense breakdown</h2>
          </div>
          <ExpenseBreakdown expenses={season.expenses.map((e) => ({ category: e.category as string, amount: Number(e.amount) }))} />
        </div>
      </section>

      <section className="rounded-2xl border border-agro-sprout bg-white p-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-agro-canopy" />
          <h2 className="font-display text-lg font-semibold text-agro-forest">Monthly trend</h2>
        </div>
        <ExpenseTimeSeries expenses={expenseRows} projectedCosts={projectedRows} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-agro-sprout bg-agro-paper p-5">
          <h2 className="font-display text-lg font-semibold text-agro-forest">Log expense</h2>
          <div className="mt-4">
            <ExpenseForm seasonId={season.id} onCreated={handleExpenseCreated} />
          </div>
        </div>
        <div className="rounded-2xl border border-agro-sprout bg-agro-paper p-5">
          <h2 className="font-display text-lg font-semibold text-agro-forest">Yield & price</h2>
          <form onSubmit={yieldForm.handleSubmit((data) => handleHarvest(data))} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-agro-ink">Expected yield (per acre)</label>
              <input type="number" step="0.01" {...yieldForm.register("expected_yield")} className="focus-ring-none mt-2 h-12 w-full rounded-xl border border-agro-sprout bg-white px-4 text-sm text-agro-ink transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-agro-canopy focus:ring-agro-canopy/20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-agro-ink">Expected price (PKR per unit)</label>
              <input type="number" step="0.01" {...yieldForm.register("expected_price")} className="focus-ring-none mt-2 h-12 w-full rounded-xl border border-agro-sprout bg-white px-4 text-sm text-agro-ink transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-agro-canopy focus:ring-agro-canopy/20" />
            </div>
            <button type="submit" disabled={refreshing} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-agro-canopy px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-agro-forest hover:shadow-md disabled:opacity-50">
              Save yield / price
            </button>
          </form>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-agro-ink">Mark harvested</h3>
            <HarvestForm
              seasonId={season.id}
              actualYield={liveActualYield}
              actualPrice={liveActualPrice}
              onYieldChange={setLiveActualYield}
              onPriceChange={setLiveActualPrice}
              onDone={() => onRefresh()}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-agro-sprout bg-agro-paper p-5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 rounded-full bg-agro-canopy" />
          <h2 className="font-display text-lg font-semibold text-agro-forest">Expenses</h2>
        </div>
        <div className="mt-4">
          <ExpenseList expenses={season.expenses.map((e) => ({
            id: String(e.id),
            season_id: String(e.season_id),
            account_id: String(e.account_id),
            category: String(e.category),
            amount: Number(e.amount),
            date: String(e.date),
            note: e.note as string | null,
            created_at: String(e.created_at),
            variance: e.variance as number | undefined,
            variance_percentage: e.variance_percentage as number | null | undefined,
          }))} />
        </div>
      </section>
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel="Cancel"
        variant={confirmVariant}
        onConfirm={() => {
          if (confirmModal.action === "delete") handleDelete();
          else if (confirmModal.action === "archive") handleArchive();
          else if (confirmModal.action === "restore") handleRestore();
        }}
        onCancel={closeConfirm}
        isPending={refreshing}
      />
    </div>
  );
}

function HarvestForm({ seasonId, actualYield, actualPrice, onYieldChange, onPriceChange, onDone }: {
  seasonId: string;
  actualYield: string;
  actualPrice: string;
  onYieldChange: (val: string) => void;
  onPriceChange: (val: string) => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/profit-loss/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual_yield: Number(actualYield), actual_price: Number(actualPrice), status: "completed" }),
    });
    setSubmitting(false);
    if (res.ok) onDone();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-3 space-y-3">
      <div>
        <label className="block text-sm font-semibold text-agro-ink">Actual yield (total units)</label>
        <input type="number" step="0.01" value={actualYield} onChange={(e) => onYieldChange(e.target.value)} className="focus-ring-none mt-2 h-12 w-full rounded-xl border border-agro-sprout bg-white px-4 text-sm text-agro-ink transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-agro-canopy focus:ring-agro-canopy/20" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-agro-ink">Actual revenue (PKR)</label>
        <input type="number" step="0.01" value={actualPrice} onChange={(e) => onPriceChange(e.target.value)} className="focus-ring-none mt-2 h-12 w-full rounded-xl border border-agro-sprout bg-white px-4 text-sm text-agro-ink transition-colors duration-200 focus:outline-none focus:ring-2 focus:border-agro-canopy focus:ring-agro-canopy/20" />
      </div>
      {actualPrice !== "" && (
        <div className="rounded-lg border border-agro-canopy/30 bg-agro-mint/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-agro-slate">Actual revenue</p>
           <p className="mt-1 font-mono text-sm font-semibold text-agro-forest">PKR {Number(actualPrice).toLocaleString("en-PK")}</p>
        </div>
      )}
      <button type="submit" disabled={submitting} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-agro-canopy px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-agro-forest hover:shadow-md disabled:opacity-50">
        Mark harvested
      </button>
    </form>
  );
}
