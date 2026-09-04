"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreVerticalIcon } from "@/components/icons";

const statusChip = {
  active: "bg-agro-mint text-agro-canopy",
  harvested: "bg-agro-mint text-agro-canopy",
  completed: "bg-agro-sprout text-agro-ink",
};

const roiChip = {
  profit: "bg-agro-mint text-agro-canopy",
  loss: "bg-agro-sprout/60 text-agro-forest",
  break_even: "bg-agro-sprout/50 text-agro-ink",
};

function ActionDropdown({ seasonId, onArchive, onDelete }: { seasonId: string; onArchive?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-agro-sprout text-agro-slate transition-colors hover:border-agro-canopy hover:text-agro-canopy"
      >
        <MoreVerticalIcon size={16} />
      </button>
      {open && (
        <div className="absolute end-0 z-[9999] mt-1 w-40 overflow-hidden rounded-xl border border-agro-sprout bg-white shadow-xl">
          <div className="py-1">
            <Link href={`/profit-loss/${seasonId}`} className="flex items-center px-4 py-2 text-sm text-agro-ink transition-colors hover:bg-agro-mint" onClick={() => setOpen(false)}>
              View details
            </Link>
            {onArchive && (
              <button type="button" className="flex w-full items-center px-4 py-2 text-start text-sm text-agro-ink transition-colors hover:bg-agro-mint" onClick={() => { setOpen(false); onArchive(); }}>
                Archive
              </button>
            )}
            {onDelete && (
              <button type="button" className="flex w-full items-center px-4 py-2 text-start text-sm text-agro-forest transition-colors hover:bg-agro-mint" onClick={() => { setOpen(false); onDelete(); }}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeasonCard({ season }: { season: { id: string; crop_name?: string; farm_name?: string; season: string; year: string; acres: number; status: string; pl: { netProfitLoss: number; roi: number | null } } }) {
  const pl = season.pl ?? { netProfitLoss: 0, roi: null };
  const roiStatus = pl.roi === null ? "break_even" : pl.roi > 0 ? "profit" : pl.roi < 0 ? "loss" : "break_even";

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-agro-sprout bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-agro-canopy/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-agro-mint text-agro-canopy transition-colors duration-200 group-hover:bg-agro-canopy group-hover:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21v-8" />
            <path d="M12 13c-2.4 0-4.2-1.7-4.6-4.3C9.9 9 11.6 10.5 12 13Z" />
            <path d="M12 13c2.4 0 4.2-1.7 4.6-4.3C14.1 9 12.4 10.5 12 13Z" />
            <path d="M12 9c-2.4 0-4.2-1.7-4.6-4.3C9.9 5 11.6 6.5 12 9Z" />
            <path d="M12 9c2.4 0 4.2-1.7 4.6-4.3C14.1 5 12.4 6.5 12 9Z" />
          </svg>
        </span>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${statusChip[season.status as keyof typeof statusChip] ?? statusChip.active}`}>
            {season.status}
          </span>
          <ActionDropdown seasonId={season.id} />
        </div>
      </div>

      <h2 className="mt-3 line-clamp-2 font-display text-lg font-bold leading-snug text-agro-ink">
        {season.crop_name}
      </h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-agro-slate">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-agro-canopy" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {season.farm_name}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-agro-mint px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-wide text-agro-canopy">
          {season.season} {season.year}
        </span>
        <span className="rounded-full border border-agro-sprout bg-white px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-wide text-agro-slate">
          {season.acres} acres
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${pl.netProfitLoss >= 0 ? "bg-agro-mint text-agro-canopy" : "bg-agro-sprout/60 text-agro-forest"}`}>
          {pl.netProfitLoss >= 0 ? "Profit" : "Loss"}: PKR {Math.abs(pl.netProfitLoss).toLocaleString("en-PK")}
        </span>
        {pl.roi !== null && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${roiChip[roiStatus]}`}>
            Profit %: {pl.roi}%
          </span>
        )}
      </div>

      <Link href={`/profit-loss/${season.id}`} className="mt-4 inline-flex min-h-11 items-center gap-1 pt-1 text-sm font-semibold text-agro-canopy underline-offset-4 transition-colors hover:underline">
        View details
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </div>
  );
}
