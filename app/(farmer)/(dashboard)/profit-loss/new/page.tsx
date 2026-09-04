import type { Metadata } from "next";
import { requireSessionPage } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import NewSeasonClient from "./new-season-client";

export const metadata: Metadata = {
  title: "New season — Agropioo",
};

export default async function NewSeasonPage() {
  const session = await requireSessionPage();
  const [farms, allCrops] = await Promise.all([
    query<{ id: string; name: string; crops: string[] }>(
      `SELECT id, name, crops FROM farms WHERE account_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
      [session.accountId]
    ),
    query<{ id: string; name_en: string }>(
      `SELECT id, name_en FROM crops ORDER BY name_en`
    ),
  ]);

  const farmCrops = Object.fromEntries(farms.map((f) => [f.id, f.crops]));

  return (
    <NewSeasonClient
      farms={farms.map(({ crops: _crops, ...rest }) => rest)}
      crops={allCrops}
      farmCrops={farmCrops}
    />
  );
}
