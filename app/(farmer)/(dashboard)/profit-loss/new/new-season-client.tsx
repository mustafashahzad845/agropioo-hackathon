"use client";

import { useForm } from "react-hook-form";
import { createSeasonSchema, type CreateSeasonInput } from "@/lib/validation/profit-loss";
import { SEASONS, YEAR_OPTIONS } from "@/lib/farms/constants";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/shell/page-header";
import { ChevronDownIcon, CheckIcon } from "@/components/icons";

type Props = {
  farms: Array<{ id: string; name: string }>;
  crops: Array<{ id: string; name_en: string }>;
  farmCrops: Record<string, string[]>;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-agro-ink">
        {placeholder}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setQuery("");
          }}
          className={`focus-ring-none mt-2 flex h-12 w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-sm text-agro-ink transition-colors duration-200 focus:outline-none focus:ring-2 ${
            error
              ? "border-agro-forest focus:border-agro-forest focus:ring-agro-forest/20"
              : "border-agro-sprout focus:border-agro-canopy focus:ring-agro-canopy/20"
          }`}
        >
          <span className={selected ? "" : "text-agro-cloud"}>
            {selected ? selected.label : (placeholder || "Select...")}
          </span>
          <ChevronDownIcon
            size={16}
            className={`shrink-0 text-agro-slate transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[9999] mt-1 max-h-72 overflow-hidden rounded-xl border border-agro-sprout bg-white shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${placeholder}...`}
              className="focus-ring-none h-9 w-full rounded-lg border border-agro-sprout bg-agro-mint/30 px-3 text-sm text-agro-ink placeholder:text-agro-slate focus:outline-none focus:ring-2 focus:ring-agro-canopy/20"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length > 0 ? (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`flex w-full items-center px-4 py-2.5 text-start text-sm transition-colors ${
                    o.value === value
                      ? "bg-agro-canopy/10 font-semibold text-agro-canopy"
                      : "text-agro-ink hover:bg-agro-mint"
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {o.value === value && (
                    <CheckIcon size={14} className="me-2 shrink-0 text-agro-canopy" />
                  )}
                  {o.label}
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-agro-cloud">No options found</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-sm font-medium text-agro-forest">{error}</p>
      )}
    </div>
  );
}

const inputClass = (err?: string) =>
  `focus-ring-none mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-agro-ink transition-colors duration-200 placeholder:text-agro-cloud focus:outline-none focus:ring-2 ${
    err
      ? "border-agro-forest focus:border-agro-forest focus:ring-agro-forest/20"
      : "border-agro-sprout focus:border-agro-canopy focus:ring-agro-canopy/20"
  }`;

function getMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

export default function NewSeasonClient({ farms, crops, farmCrops }: Props) {
  const router = useRouter();
  const [cropId, setCropId] = useState<string>("");
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<CreateSeasonInput>({
    resolver: async (data) => {
      const result = createSeasonSchema.safeParse(data);
      if (result.success) return { values: result.data, errors: {} };
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { values: {}, errors: fieldErrors };
    },
  });

  const selectedFarmId = watch("farm_id") || "";
  const farmCropNames = farmCrops[selectedFarmId] || [];
  const availableCrops = farmCropNames.length > 0
    ? crops.filter((c) => farmCropNames.includes(c.name_en.toLowerCase()))
    : crops;

  useEffect(() => {
    setValue("crop_id", cropId as CreateSeasonInput["crop_id"]);
  }, [cropId, setValue]);

  const onSubmit = async (data: CreateSeasonInput) => {
    const res = await fetch("/api/profit-loss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const season = await res.json();
      router.push(`/profit-loss/${season.id}`);
    } else {
      const err = await res.json();
      alert(err.error?.message ?? "Failed to create season");
    }
  };

  return (
    <div className="pt-1">
      <PageHeader
        eyebrow="Financial cockpit"
        title="New season"
        description="Set up a new farming season to track costs and profits."
      />
      <div className="mt-8 max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-agro-ink">Farm</label>
            <select {...register("farm_id")} className={inputClass(errors.farm_id?.message)}>
              <option value="">Select a farm</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
            {errors.farm_id && <p className="mt-1.5 text-sm font-medium text-agro-forest">{String(getMessage(errors.farm_id))}</p>}
          </div>
          <div>
            <SearchableSelect
              value={cropId}
              onChange={setCropId}
              options={availableCrops.map((crop) => ({ value: crop.id, label: crop.name_en }))}
              placeholder={selectedFarmId ? "Select a crop for this farm" : "Select a farm first"}
              error={getMessage(errors.crop_id)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-agro-ink">Season</label>
            <select {...register("season")} className={inputClass(errors.season?.message)}>
              {SEASONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.season && <p className="mt-1.5 text-sm font-medium text-agro-forest">{String(getMessage(errors.season))}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-agro-ink">Year</label>
            <select {...register("year")} className={inputClass(errors.year?.message)}>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {errors.year && <p className="mt-1.5 text-sm font-medium text-agro-forest">{String(getMessage(errors.year))}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-agro-ink">Acres</label>
            <input type="number" step="0.01" {...register("acres")} className={inputClass(errors.acres?.message)} />
            {errors.acres && <p className="mt-1.5 text-sm font-medium text-agro-forest">{String(getMessage(errors.acres))}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isSubmitting} className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-agro-canopy px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-agro-forest hover:shadow-md disabled:opacity-50">
              Create season
            </button>
            <Link href="/profit-loss" className="inline-flex h-11 items-center justify-center rounded-lg border border-agro-sprout px-4 text-sm font-semibold text-agro-ink transition-colors hover:bg-agro-mint">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
