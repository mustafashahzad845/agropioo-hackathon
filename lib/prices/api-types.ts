import { z } from "zod";

export const getPricesQuerySchema = z.object({
  crop_id: z.string().optional(),
  district: z.string().optional(),
  farm_id: z.string().optional(),
  query: z.string().optional(),
  include_bordering: z.coerce.boolean().default(true),
});

export const createPriceSchema = z.object({
  crop_id: z.string().min(1, "crop_id is required"),
  mandi_id: z.string().min(1, "mandi_id is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  modal_price: z.coerce.number().positive("modal_price must be positive"),
  min_price: z.coerce.number().positive("min_price must be positive"),
  max_price: z.coerce.number().positive("max_price must be positive"),
  is_holiday: z.coerce.boolean().default(false),
});

export const predictionQuerySchema = z.object({
  crop_id: z.string().min(1, "crop_id is required"),
  mandi_id: z.string().min(1, "mandi_id is required"),
});

export const alertCreateSchema = z.object({
  crop_id: z.string().min(1, "crop_id is required"),
  mandi_id: z.string().optional(),
  target_price_pkr: z.coerce.number().positive("target_price_pkr must be positive"),
  status: z.enum(["active", "paused"]).default("active"),
});

export const alertUpdateSchema = z.object({
  target_price_pkr: z.coerce.number().positive("target_price_pkr must be positive").optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export const historyQuerySchema = z.object({
  crop_id: z.string().min(1, "crop_id is required"),
  mandi_id: z.string().min(1, "mandi_id is required"),
  range: z.enum(["1M", "3M", "6M", "12M"]).default("3M"),
});

export const favouriteCropSchema = z.object({
  crop_id: z.string().min(1, "crop_id is required"),
  display_order: z.coerce.number().int().nonnegative().optional(),
});

export type CurrentPriceRow = {
  mandi_id: string;
  mandi_name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  crop_id: string;
  crop_name: string;
  date: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  unit: string;
  is_holiday: boolean;
  updated_days_ago: number;
  prev_modal: number | null;
  source_code: string;
};

export type EnrichedPrice = CurrentPriceRow & {
  distance_km: number | null;
  change_pct: number;
  change_pkr: number;
  is_best_price: boolean;
  transport_cost_pkr: number | null;
};
