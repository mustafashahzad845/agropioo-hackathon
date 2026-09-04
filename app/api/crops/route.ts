import { NextResponse } from "next/server";
import { jsonResponse, errorResponse, errorBody, readJsonBody, clientIp } from "@/lib/http";
import { requireSessionApi } from "@/lib/auth/guards";
import {
  hitLimiter,
  RATE_RULES,
} from "@/lib/auth/rate-limit";
import {
  createCropRecommendationSchema,
  listCropRecommendationsQuerySchema,
} from "@/lib/validation/crops";
import { recommendCrops, WeatherUnavailableError, RecommendationExistsError, NoCandidatesError, OutsidePakistanError, FarmNotFoundError, FarmForbiddenError, DataUnavailableError } from "@/lib/crops/engine";
import { query, queryOne } from "@/lib/db";
import type { CropRecommendationRequest, RecommendCropsInput } from "@/lib/crops/api-types";

export async function POST(request: Request) {
  const session = await requireSessionApi();
  if (!session) return errorResponse("unauthorized", "Unauthorized", 401);

  const ip = clientIp(request);
  if (
    !hitLimiter("cropsIp", ip, RATE_RULES.cropsIp.limit, RATE_RULES.cropsIp.windowMs)
  ) {
    return errorResponse("rate_limited", "Too many requests", 429);
  }

  const body = await readJsonBody(request);
  const parsed = createCropRecommendationSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }));
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid input", issues } },
      { status: 422 },
    );
  }

  try {
    const input: RecommendCropsInput = {
      farmId: parsed.data.farm_id,
      targetSeason: parsed.data.target_season,
      targetYear: parsed.data.target_year,
      soilType: parsed.data.soil_type,
      irrigationType: parsed.data.irrigation_type,
      budgetBracket: parsed.data.budget_bracket,
      regenerate: parsed.data.regenerate,
    };
    const result = await recommendCrops(input, session.accountId);
    return jsonResponse(
      { request: result.request, recommendations: result.recommendations },
      201,
    );
  } catch (err) {
    if (err instanceof WeatherUnavailableError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err instanceof RecommendationExistsError) {
      console.log("crops recommendation_exists", err.existing);
      return jsonResponse(
        { error: errorBody(err.code, err.message), existing: err.existing },
        err.status,
      );
    }
    if (err instanceof NoCandidatesError) {
      return Response.json(
        { error: { code: err.code, message: err.message }, lowestViableBracket: err.lowestViableBracket },
        { status: err.status },
      );
    }
    if (err instanceof OutsidePakistanError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err instanceof FarmNotFoundError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err instanceof FarmForbiddenError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err instanceof DataUnavailableError) {
      return errorResponse(err.code, err.message, err.status);
    }
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      const existing = await queryOne<CropRecommendationRequest>(
        `SELECT * FROM crop_recommendation_requests WHERE account_id = $1 AND farm_id = $2 AND target_season = $3 AND target_year = $4`,
        [session.accountId, parsed.data.farm_id, parsed.data.target_season, parsed.data.target_year],
      );
      console.log("crops 23505 existing", existing);
      return jsonResponse(
        { error: errorBody("recommendation_exists", "You already have a recommendation for this farm, season, and year."), existing },
        409,
      );
    }
    console.error("crops recommendation failed:", err);
    return errorResponse("server_error", "Something went wrong. Please try again.", 500);
  }
}

export async function GET(request: Request) {
  const session = await requireSessionApi();
  if (!session) return errorResponse("unauthorized", "Unauthorized", 401);

  const url = new URL(request.url);
  const parsed = listCropRecommendationsQuerySchema.safeParse({
    farm_id: url.searchParams.get("farm_id") ?? undefined,
    target_season: url.searchParams.get("target_season") ?? undefined,
    target_year: url.searchParams.get("target_year") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid query", issues } },
      { status: 422 },
    );
  }

  const { farm_id, target_season, target_year, limit, cursor } = parsed.data;

  const clauses: string[] = ["account_id = $1"];
  const values: unknown[] = [session.accountId];
  let idx = 2;

  if (farm_id) {
    const owner = await queryOne<{ account_id: string }>(
      `SELECT account_id FROM farms WHERE id = $1`,
      [farm_id],
    );
    if (!owner || owner.account_id !== session.accountId) {
      return errorResponse("forbidden", "Forbidden", 403);
    }
    clauses.push(`farm_id = $${idx++}`);
    values.push(farm_id);
  }
  if (target_season) {
    clauses.push(`target_season = $${idx++}`);
    values.push(target_season);
  }
  if (target_year) {
    clauses.push(`target_year = $${idx++}`);
    values.push(target_year);
  }
  if (cursor) {
    clauses.push(`created_at < (SELECT created_at FROM crop_recommendation_requests WHERE id = $${idx++})`);
    values.push(cursor);
  }

  const fetchLimit = limit + 1;
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM crop_recommendation_requests
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${idx++}`,
    [...values, fetchLimit],
  );

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  const requests = await Promise.all(
    (data ?? []).map(async (r) => {
      const countRow = await queryOne<{ count: string }>(
        `SELECT count(*)::text AS count FROM crop_recommendations WHERE request_id = $1`,
        [r.id],
      );
      return { ...r, recommendation_count: Number(countRow?.count ?? 0) };
    }),
  );

  return jsonResponse({ requests, next_cursor: nextCursor });
}
