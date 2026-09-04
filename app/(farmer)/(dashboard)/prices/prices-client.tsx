"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import MandiPriceCard, { type MandiPrice } from "@/components/prices/mandi-price-card";
import MarketComparisonTable from "@/components/prices/market-comparison-table";
import PredictionChart from "@/components/prices/prediction-chart";
import RecommendationBadge from "@/components/prices/recommendation-badge";
import PriceAlertModal, { type AlertFormData, type SavedAlert } from "@/components/prices/price-alert-modal";
import PriceHistoryChart, { type HistoryPoint } from "@/components/prices/price-history-chart";
import { SearchIcon, ChevronDownIcon } from "@/components/icons";
import type { PricesBundle } from "./prices-bundle";
import type { ForecastPoint } from "@/lib/prices/forecast";

type CropOption = { id: string; name_en: string };
type MandiOption = { id: string; name_en: string };
type FarmOption = { id: string; name: string; district?: string; crops?: string };

type PricesResponse = {
  district: string | null;
  is_fallback_hub: boolean;
  prices: MandiPrice[];
};

type PredictionResponse = {
  can_forecast: boolean;
  reason?: string;
  row_count?: number;
  last_date?: string | null;
  predictions: ForecastPoint[];
  recommendation: "SELL" | "HOLD";
  recommendation_reason: string;
  volatility_warning: boolean;
  model_confidence: number;
};

type HistoryResponse = {
  history: HistoryPoint[];
  range: "1M" | "3M" | "6M" | "12M";
};

interface PricesClientProps {
  bundle: PricesBundle;
  crops: CropOption[];
  mandis: MandiOption[];
  farms: FarmOption[];
  initial: PricesResponse;
}

export default function PricesClient({ bundle, crops, mandis, farms, initial }: PricesClientProps) {
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedFarmId") ?? "";
    }
    return "";
  });
  const [prices, setPrices] = useState<PricesResponse>(initial);
  const [isPending, startTransition] = useTransition();
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [predictionPending, setPredictionPending] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyRange, setHistoryRange] = useState<"1M" | "3M" | "6M" | "12M">("3M");
  const [historyPending, setHistoryPending] = useState(false);
  const [alerts, setAlerts] = useState<SavedAlert[]>([]);
  const [alertsPending, setAlertsPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SavedAlert | null>(null);
  const [alertActionPending, setAlertActionPending] = useState(false);

  const loadPrices = useCallback(async (params: { crop_id?: string; query?: string; farm_id?: string }) => {
    startTransition(async () => {
      const url = new URL("/api/prices", window.location.origin);
      const farmId = params.farm_id;
      if (farmId) url.searchParams.set("farm_id", farmId);
      if (params.crop_id) url.searchParams.set("crop_id", params.crop_id);
      if (params.query) url.searchParams.set("query", params.query);
      const res = await fetch(url.toString(), { credentials: "same-origin" });
      if (!res.ok) {
        setPrices({ district: null, is_fallback_hub: false, prices: [] });
        return;
      }
      const data = (await res.json()) as PricesResponse;
      setPrices(data);
    });
  }, []);

  useEffect(() => {
    if (selectedFarmId) {
      loadPrices({ farm_id: selectedFarmId });
    }
  }, [selectedFarmId, loadPrices]);

  function handleCropChange(cropId: string) {
    setSelectedCrop(cropId);
    setSearchQuery("");
    loadPrices({ crop_id: cropId || undefined });
  }

  function handleFarmChange(farmId: string) {
    setSelectedFarmId(farmId);
    localStorage.setItem("selectedFarmId", farmId);
    document.cookie = `selectedFarmId=${encodeURIComponent(farmId)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setSelectedCrop("");
    setSearchQuery("");
    loadPrices({ farm_id: farmId });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSelectedCrop("");
    loadPrices({ query: searchQuery });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedCrop || prices.prices.length === 0) {
        if (!cancelled) setPrediction(null);
        return;
      }

      const best = prices.prices.reduce((max, p) =>
        p.modal_price > max.modal_price ? p : max, prices.prices[0]);
      if (!best) {
        if (!cancelled) setPrediction(null);
        return;
      }

      if (!cancelled) setPredictionPending(true);
      const url = new URL("/api/prices/predictions", window.location.origin);
      url.searchParams.set("crop_id", best.crop_id);
      url.searchParams.set("mandi_id", best.mandi_id);
      const res = await fetch(url.toString(), { credentials: "same-origin" });
      if (!cancelled) {
        setPredictionPending(false);
        if (res.ok) {
          const data = (await res.json()) as PredictionResponse;
          setPrediction(data);
        } else {
          setPrediction(null);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedCrop, prices.prices]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedCrop || prices.prices.length === 0) {
        if (!cancelled) setHistory(null);
        return;
      }

      const best = prices.prices.reduce((max, p) =>
        p.modal_price > max.modal_price ? p : max, prices.prices[0]);
      if (!best) {
        if (!cancelled) setHistory(null);
        return;
      }

      if (!cancelled) setHistoryPending(true);
      const url = new URL("/api/prices/history", window.location.origin);
      url.searchParams.set("crop_id", best.crop_id);
      url.searchParams.set("mandi_id", best.mandi_id);
      url.searchParams.set("range", historyRange);
      const res = await fetch(url.toString(), { credentials: "same-origin" });
      if (!cancelled) {
        setHistoryPending(false);
        if (res.ok) {
          const data = (await res.json()) as HistoryResponse;
          setHistory(data);
        } else {
          setHistory(null);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedCrop, prices.prices, historyRange]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) setAlertsPending(true);
      const res = await fetch("/api/prices/alerts", { credentials: "same-origin" });
      if (!cancelled) {
        setAlertsPending(false);
        if (res.ok) {
          const data = (await res.json()) as { alerts: SavedAlert[] };
          setAlerts(data.alerts ?? []);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveAlert(data: AlertFormData) {
    setAlertActionPending(true);
    const url = new URL("/api/prices/alerts", window.location.origin);
    const method = data.id ? "PUT" : "POST";
    if (data.id) url.searchParams.set("id", data.id);
    const body = {
      crop_id: data.crop_id,
      mandi_id: data.mandi_id || undefined,
      target_price_pkr: data.target_price_pkr,
      status: data.status,
    };
    const res = await fetch(url.toString(), {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAlertActionPending(false);
    if (res.ok) {
      setModalOpen(false);
      setEditingAlert(null);
      const refreshed = await fetch("/api/prices/alerts", { credentials: "same-origin" });
      if (refreshed.ok) {
        const data = (await refreshed.json()) as { alerts: SavedAlert[] };
        setAlerts(data.alerts ?? []);
      }
    }
  }

  async function handleDeleteAlert(id: string) {
    setAlertActionPending(true);
    const url = new URL("/api/prices/alerts", window.location.origin);
    url.searchParams.set("id", id);
    const res = await fetch(url.toString(), {
      method: "DELETE",
      credentials: "same-origin",
    });
    setAlertActionPending(false);
    if (res.ok) {
      setModalOpen(false);
      setEditingAlert(null);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }
  }

  function openNewAlert() {
    setEditingAlert(null);
    setModalOpen(true);
  }

  function openEditAlert(alert: SavedAlert) {
    setEditingAlert(alert);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow text-agro-canopy">{bundle.eyebrow}</p>
        <h1 className="display-heading mt-1 font-display text-3xl font-bold text-agro-forest">
          {bundle.title}
        </h1>
        <p className="mt-2 text-agro-slate">{bundle.description}</p>
      </header>

      {prices.is_fallback_hub ? (
        <div className="rounded-2xl bg-agro-mint p-4 text-sm font-semibold text-agro-ink">
          {bundle.fallbackBanner}
        </div>
      ) : null}

      {farms.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-56">
            <label htmlFor="farm-select" className="sr-only">
              {bundle.selectFarm}
            </label>
            <div className="relative">
              <select
                id="farm-select"
                value={selectedFarmId}
                onChange={(e) => handleFarmChange(e.target.value)}
                className="h-11 w-full truncate appearance-none rounded-xl border border-agro-canopy bg-white pl-4 pr-10 text-sm font-sans text-agro-ink outline-none transition-colors focus:ring-2 focus:ring-agro-canopy/20"
              >
                <option value="">{bundle.selectFarm}</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id} className="truncate">
                    {farm.name} {farm.district ? `— ${farm.district}` : ""}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-agro-slate">
                <ChevronDownIcon size={16} />
              </span>
            </div>
          </div>

          <div className="sm:w-56">
            <label htmlFor="crop-select" className="sr-only">
              {bundle.selectCrop}
            </label>
            <select
              id="crop-select"
              value={selectedCrop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full rounded-xl border border-agro-canopy bg-white px-3 py-2.5 text-sm text-agro-ink outline-none focus:ring-2 focus:ring-agro-canopy/20"
            >
              <option value="">{bundle.selectCrop}</option>
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name_en}
                </option>
              ))}
            </select>
          </div>


          <form onSubmit={handleSearchSubmit} className="flex-1">
            <label htmlFor="price-search" className="sr-only">
              {bundle.searchPlaceholder}
            </label>
            <div className="relative">
              <SearchIcon
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-agro-cloud"
              />
               <input
                 id="price-search"
                 type="search"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder={bundle.searchPlaceholder}
                 className="w-full rounded-xl border border-agro-canopy bg-white py-2.5 pl-10 pr-4 text-sm text-agro-ink outline-none focus:ring-2 focus:ring-agro-canopy/20"
               />
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-56">
            <label htmlFor="crop-select" className="sr-only">
              {bundle.selectCrop}
            </label>
            <select
              id="crop-select"
              value={selectedCrop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full rounded-xl border border-agro-canopy bg-white px-3 py-2.5 text-sm text-agro-ink outline-none focus:ring-2 focus:ring-agro-canopy/20"
            >
              <option value="">{bundle.selectCrop}</option>
              {crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name_en}
                </option>
              ))}
            </select>
          </div>


          <form onSubmit={handleSearchSubmit} className="flex-1">
            <label htmlFor="price-search" className="sr-only">
              {bundle.searchPlaceholder}
            </label>
            <div className="relative">
              <SearchIcon
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-agro-cloud"
              />
               <input
                 id="price-search"
                 type="search"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder={bundle.searchPlaceholder}
                 className="w-full rounded-xl border border-agro-canopy bg-white py-2.5 pl-10 pr-4 text-sm text-agro-ink outline-none focus:ring-2 focus:ring-agro-canopy/20"
               />
            </div>
          </form>
        </div>
      )}

      {prices.district && !prices.is_fallback_hub ? (
        <p className="text-sm text-agro-slate">
          Showing prices near <span className="font-semibold capitalize text-agro-forest">{prices.district}</span>
        </p>
      ) : null}

      {isPending ? (
        <div className="flex items-center gap-3 rounded-2xl border border-agro-sprout bg-white p-6 text-agro-slate">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-agro-sprout border-t-agro-canopy" />
          {bundle.loading}
        </div>
      ) : prices.prices.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prices.prices.map((price) => (
              <MandiPriceCard key={`${price.mandi_id}:${price.crop_id}`} price={price} bundle={bundle} />
            ))}
          </div>
          {selectedCrop ? (
            <MarketComparisonTable prices={prices.prices} bundle={bundle} />
          ) : null}
          {selectedCrop && prediction ? (
            <div className="space-y-4">
              <RecommendationBadge
                recommendation={prediction.recommendation}
                reason={prediction.recommendation_reason}
                volatilityWarning={prediction.volatility_warning}
                modelConfidence={prediction.model_confidence}
                bundle={bundle}
              />
              <PredictionChart
                predictions={prediction.predictions}
                canForecast={prediction.can_forecast}
                bundle={bundle}
              />
            </div>
          ) : null}
          {selectedCrop && predictionPending ? (
            <div className="flex items-center gap-3 rounded-2xl border border-agro-sprout bg-white p-6 text-agro-slate">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-agro-sprout border-t-agro-canopy" />
              {bundle.loading}
            </div>
          ) : null}
          {selectedCrop && history ? (
            <PriceHistoryChart
              history={history.history}
              range={history.range}
              onRangeChange={setHistoryRange}
              bundle={bundle}
            />
          ) : null}
          {selectedCrop && historyPending ? (
            <div className="flex items-center gap-3 rounded-2xl border border-agro-sprout bg-white p-6 text-agro-slate">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-agro-sprout border-t-agro-canopy" />
              {bundle.loading}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-agro-sprout bg-white p-8 text-center">
          <p className="text-agro-slate">{bundle.noPricesForCrop}</p>
        </div>
      )}

      <section className="rounded-3xl border border-agro-sprout bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-agro-forest">{bundle.setAlert}</h2>
          <button
            type="button"
            onClick={openNewAlert}
            className="inline-flex items-center rounded-xl bg-agro-canopy px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-agro-forest"
          >
            {bundle.setAlert}
          </button>
        </div>

        {alertsPending ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-agro-slate">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-agro-sprout border-t-agro-canopy" />
            {bundle.loading}
          </div>
        ) : alerts.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-center justify-between rounded-xl border border-agro-sprout p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-agro-forest">
                    {alert.crop_name_en}
                    {alert.mandi_name_en ? ` · ${alert.mandi_name_en}` : null}
                  </p>
                  <p className="text-xs text-agro-slate">
                    {bundle.targetPrice}: <span className="font-mono">{Number(alert.target_price_pkr).toLocaleString("en-PK")}</span>
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      alert.status === "active"
                        ? "bg-agro-mint text-agro-canopy"
                        : "bg-agro-mint/50 text-agro-slate"
                    }`}
                  >
                    {alert.status === "active" ? bundle.alertActive : bundle.alertPaused}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openEditAlert(alert)}
                  className="text-sm font-semibold text-agro-canopy hover:text-agro-forest"
                >
                  {bundle.editAlert}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="pt-4">
        <Link
          href="/prices/admin"
          className="inline-flex items-center rounded-xl bg-agro-canopy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-agro-forest"
        >
          {bundle.adminTitle}
        </Link>
      </div>

      <PriceAlertModal
        key={`${editingAlert?.id ?? "new"}-${String(modalOpen)}`}
        bundle={bundle}
        crops={crops}
        mandis={mandis}
        initial={editingAlert}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAlert(null);
        }}
        onSave={handleSaveAlert}
        onDelete={editingAlert ? handleDeleteAlert : undefined}
        isPending={alertActionPending}
      />
    </div>
  );
}
