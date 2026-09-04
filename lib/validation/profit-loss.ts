import { z } from 'zod';
import { SEASONS, YEAR_OPTIONS, CROPS } from '@/lib/farms/constants';

export const EXPENSE_CATEGORIES = ['seed', 'fertilizer', 'labor', 'irrigation', 'transport', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const PROJECTED_CATEGORIES = ['seed', 'fertilizer', 'labor', 'irrigation', 'transport'] as const;
export type ProjectedCategory = (typeof PROJECTED_CATEGORIES)[number];

export const seasonEnum = z.enum(SEASONS);
export const yearEnum = z.enum(YEAR_OPTIONS as unknown as [string, ...string[]]);
export const cropEnum = z.enum(CROPS, { message: 'Please select a valid crop from the list' });
export const expenseCategoryEnum = z.enum(EXPENSE_CATEGORIES);
export const projectedCategoryEnum = z.enum(PROJECTED_CATEGORIES);

export const createSeasonSchema = z.object({
  farm_id: z.string().uuid(),
  crop_id: cropEnum,
  season: seasonEnum,
  year: yearEnum,
  acres: z.coerce.number().positive('Acres must be greater than 0').max(99999),
});

export const updateSeasonSchema = z.object({
  crop_id: cropEnum.optional(),
  season: seasonEnum.optional(),
  year: yearEnum.optional(),
  acres: z.coerce.number().positive('Acres must be greater than 0').max(99999).optional(),
  expected_yield: z.coerce.number().gte(0).optional().nullable(),
  expected_price: z.coerce.number().gte(0).optional().nullable(),
  actual_yield: z.coerce.number().gte(0).optional().nullable(),
  actual_price: z.coerce.number().gte(0).optional().nullable(),
});

export const createExpenseSchema = z.object({
  season_id: z.string().uuid(),
  category: expenseCategoryEnum,
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  note: z.string().optional().nullable(),
});

export const updateExpenseSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0').optional(),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
  note: z.string().optional().nullable(),
});

export const createProjectedCostSchema = z.object({
  category: projectedCategoryEnum,
  per_acre_cost_pkr: z.coerce.number().positive('Cost must be greater than 0'),
});

export const listSeasonsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listExpensesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateProjectedCostInput = z.infer<typeof createProjectedCostSchema>;
export type ListSeasonsQuery = z.infer<typeof listSeasonsQuerySchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

export type Season = {
  id: string;
  account_id: string;
  farm_id: string;
  crop_id: string;
  season: string;
  year: string;
  start_date: string;
  acres: number;
  status: string;
  expected_yield: number | null;
  expected_price: number | null;
  actual_yield: number | null;
  actual_price: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  season_id: string;
  account_id: string;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
};

export type ProjectedCost = {
  id: string;
  season_id: string;
  category: string;
  per_acre_cost_pkr: number;
  total_projected_pkr: number;
  created_at: string;
};

export type PLSummary = {
  netProfitLoss: number;
  roi: number | null;
  variance: { absolute: number; percentage: number | null };
  status: 'profit' | 'loss' | 'break_even';
};

export type BreakEvenResult = {
  yield: string;
  price: string;
} | null;
