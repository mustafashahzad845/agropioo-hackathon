"use client";

import { MapPinIcon, TrendingUpIcon, TrendingDownIcon, InfoIcon } from "@/components/icons";
import DataSourceBadge from "./data-source-badge";
import type { PricesBundle } from "@/app/(farmer)/(dashboard)/prices/prices-bundle";
import type { EnrichedPrice } from "@/lib/prices/api-types";

export type MandiPrice = EnrichedPrice;

function formatNumber(n: number): string {
  return n.toLocaleString("en-PK");
}

function changeTone(change_pct: number): "up" | "down" | "flat" {
  if (change_pct > 0.05) return "up";
  if (change_pct < -0.05) return "down";
  return "flat";
}

export default function MandiPriceCard({
  price,
  bundle,
}: {
  price: MandiPrice;
  bundle: PricesBundle;
}) {
  const tone = changeTone(price.change_pct);
  const toneClass =
    tone === "up"
      ? "bg-agro-mint text-agro-canopy"
      : tone === "down"
        ? "bg-agro-mint/60 text-agro-canopy"
        : "bg-agro-stone text-agro-slate";

  const updatedText =
    price.updated_days_ago <= 0
      ? bundle.updatedToday
      : bundle.updatedDaysAgo.replace("{days}", String(price.updated_days_ago));

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-3xl border border-agro-sprout bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      aria-label={`${price.mandi_name} — ${price.crop_name}`}
    >
      <div className="relative h-1.5 w-full bg-gradient-to-r from-agro-canopy via-agro-leaf to-agro-canopy" />

      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agro-mint transition-colors duration-200 group-hover:bg-agro-canopy">
            <MapPinIcon size={20} className="text-agro-canopy transition-colors duration-200 group-hover:text-white" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold leading-tight text-agro-forest">
              {price.mandi_name}
            </h3>
            <p className="mt-0.5 text-xs capitalize text-agro-slate">{price.district}</p>
            <p className="mt-1 text-xs font-semibold text-agro-canopy">{price.crop_name}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <DataSourceBadge sourceCode={price.source_code} bundle={bundle} />
          {price.is_best_price ? (
            <span className="inline-flex items-center rounded-full bg-agro-wheat px-2.5 py-1 text-xs font-semibold text-agro-forest">
              {bundle.bestPrice}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold leading-none text-agro-forest">
            {formatNumber(price.modal_price)}
          </span>
          <span className="text-xs font-medium text-agro-slate">{bundle.perMaund}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}
        >
          {tone === "up" ? (
            <TrendingUpIcon size={13} />
          ) : tone === "down" ? (
            <TrendingDownIcon size={13} />
          ) : (
            <InfoIcon size={13} />
          )}
          {price.change_pct > 0 ? "+" : ""}
          {price.change_pct}%
          <span className="opacity-75">
            ({price.change_pkr > 0 ? "+" : ""}
            {formatNumber(price.change_pkr)} PKR)
          </span>
        </span>

        {price.distance_km !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-agro-stone px-2.5 py-1 text-xs font-medium text-agro-slate">
            <MapPinIcon size={13} />
            {bundle.distanceKm.replace("{km}", String(Math.round(price.distance_km)))}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-agro-sprout/70 bg-agro-paper/50 px-5 py-3 text-xs text-agro-slate">
        <span>
          {formatNumber(price.min_price)}–{formatNumber(price.max_price)} PKR
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
            price.updated_days_ago > 0 || price.is_holiday
              ? "bg-agro-mint/60 text-agro-canopy"
              : "bg-agro-mint text-agro-canopy"
          }`}
        >
          {price.is_holiday ? bundle.marketHoliday : updatedText}
        </span>
      </div>
    </article>
  );
}
