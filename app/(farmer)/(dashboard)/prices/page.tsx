import type { Metadata } from "next";
import { requireSessionPage } from "@/lib/auth/guards";
import { getPricesBundle } from "@/lib/i18n/server";
import { query } from "@/lib/db";
import { GET as getPricesApi } from "@/app/api/prices/route";
import { cookies } from "next/headers";
import PricesClient from "./prices-client";

export const metadata: Metadata = {
  title: "Mandi Prices — Agropioo",
};

type CropOption = { id: string; name_en: string };
type MandiOption = { id: string; name_en: string };

type FarmOption = { id: string; name: string; district?: string; crops?: string };

export default async function PricesPage() {
  const session = await requireSessionPage();
  const cookieStore = await cookies();
  const selectedFarmId = cookieStore.get("selectedFarmId")?.value ?? "";

  const [bundle, crops, mandis, farms, initialRes] = await Promise.all([
    getPricesBundle(),
    query<CropOption>(`select id, name_en from crops order by name_en`),
    query<MandiOption>(`select id, name_en from mandis order by name_en`),
    query<FarmOption>(`select id, name, district, crops from farms where account_id = $1 and archived_at is null order by created_at desc`, [session.accountId]),
    getPricesApi(new Request(`http://localhost/api/prices${selectedFarmId ? `?farm_id=${encodeURIComponent(selectedFarmId)}` : ""}`)),
  ]);

  const initial = await initialRes.json();

  return (
    <div className="pt-1">
      <div className="mt-6">
        <PricesClient bundle={bundle} crops={crops ?? []} mandis={mandis ?? []} farms={farms ?? []} initial={initial} />
      </div>
    </div>
  );
}
