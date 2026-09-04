/**
 * District proximity helpers for the Mandi Price Tracker.
 * Resolves a farmer's district into the target district plus bordering
 * districts, and computes rough straight-line distances in kilometres.
 */

import { query } from "@/lib/db";

const EARTH_RADIUS_KM = 6371;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance between two lat/lng points in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

export interface MandiLocation {
  id: string;
  name_en: string;
  district: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  is_hub: boolean;
  bordering_districts: string[];
}

export interface ResolvedDistrict {
  district: string;
  isFallbackHub: boolean;
  searchDistricts: string[];
  farmLat: number | null;
  farmLng: number | null;
}

/**
 * Resolve the districts to search for a farmer. If no district is provided,
 * returns the nearest major provincial hub and flags the fallback.
 */
export async function resolveDistrictContext(
  districtSlug: string | undefined
): Promise<ResolvedDistrict> {
  if (!districtSlug) {
    const hub = await queryOneMandi(`
      select * from mandis
      where is_hub = true and province = 'punjab'
      order by case when district = 'lahore' then 0 else 1 end
      limit 1
    `);
    return {
      district: hub?.district ?? "lahore",
      isFallbackHub: true,
      searchDistricts: [hub?.district ?? "lahore"],
      farmLat: hub?.latitude ?? null,
      farmLng: hub?.longitude ?? null,
    };
  }

  const mandi = await queryOneMandi(
    `select * from mandis where lower(district) = lower($1) limit 1`,
    [districtSlug]
  );

  if (!mandi) {
    const hub = await queryOneMandi(`
      select * from mandis
      where is_hub = true and province = 'punjab'
      order by case when district = 'lahore' then 0 else 1 end
      limit 1
    `);
    return {
      district: hub?.district ?? "lahore",
      isFallbackHub: true,
      searchDistricts: [hub?.district ?? "lahore"],
      farmLat: hub?.latitude ?? null,
      farmLng: hub?.longitude ?? null,
    };
  }

  const search = Array.from(
    new Set([mandi.district, ...mandi.bordering_districts])
  );

  return {
    district: mandi.district,
    isFallbackHub: false,
    searchDistricts: search,
    farmLat: mandi.latitude,
    farmLng: mandi.longitude,
  };
}

async function queryOneMandi(
  sql: string,
  values?: unknown[]
): Promise<MandiLocation | null> {
  const rows = await query<MandiLocation>(sql, values);
  return rows[0] ?? null;
}

/** Find the closest hub for a province when a farmer has no registered farm. */
export async function nearestHubForProvince(
  province: string
): Promise<MandiLocation | null> {
  const rows = await query<MandiLocation>(
    `select * from mandis where province = $1 and is_hub = true limit 1`,
    [province]
  );
  return rows[0] ?? null;
}
