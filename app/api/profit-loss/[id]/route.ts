import { query, queryOne } from '@/lib/db';
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { requireSessionApi } from '@/lib/auth/guards';
import { updateSeasonSchema } from '@/lib/validation/profit-loss';
import { computePL, computeBreakEven, getCropUnit } from '@/lib/calculations/profit-loss';

async function getOwnedSeason(seasonId: string, accountId: string) {
  try {
    const season = await queryOne<Record<string, unknown>>(
      `SELECT * FROM seasons WHERE id = $1 AND account_id = $2`,
      [seasonId, accountId]
    );
    return { season, error: null };
  } catch (error) {
    return { season: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionApi();
  if (!session) return errorResponse('unauthorized', 'Unauthorized', 401);

  try {
    const { id } = await params;
    const { season, error } = await getOwnedSeason(id, session.accountId);
    if (error) return errorResponse('server_error', error.message, 500);
    if (!season) return errorResponse('not_found', 'Season not found', 404);

    const farm = await queryOne<Record<string, unknown>>(
      `SELECT * FROM farms WHERE id = $1`, [season.farm_id]
    );
    const crop = await queryOne<Record<string, unknown>>(
      `SELECT * FROM crops WHERE id = $1`, [season.crop_id]
    );
    const expenses = await query<Record<string, unknown>>(
      `SELECT * FROM expenses WHERE season_id = $1 ORDER BY date DESC, created_at DESC`,
      [id]
    );
    const projectedCosts = await query<Record<string, unknown>>(
      `SELECT * FROM projected_costs WHERE season_id = $1 ORDER BY category`,
      [id]
    );

    const totalProjectedCost = (projectedCosts ?? []).reduce((sum, p) => sum + Number(p.total_projected_pkr), 0);
    const totalActualCost = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    const projectedRevenue = (season.expected_yield != null && season.expected_price != null)
      ? Number(season.expected_yield) * Number(season.expected_price)
      : 0;
    const actualRevenue = (season.actual_price != null) ? Number(season.actual_price) : 0;

    const pl = computePL({ totalProjectedCost, totalActualCost, projectedRevenue, actualRevenue, totalInvestment: totalProjectedCost });
    const breakEven = computeBreakEven(totalProjectedCost, Number(season.expected_price) || null, Number(season.expected_yield) || null, Number(season.acres));
    const cropUnit = getCropUnit(String(season.crop_id));

    return jsonResponse({
      ...season,
      farm,
      crop,
      expenses: expenses ?? [],
      projected_costs: projectedCosts ?? [],
      pl,
      break_even: breakEven,
      crop_unit: cropUnit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse('server_error', message, 500);
  }
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionApi();
  if (!session) return errorResponse('unauthorized', 'Unauthorized', 401);

  try {
    const { id } = await params;
    const { season, error } = await getOwnedSeason(id, session.accountId);
    if (error) return errorResponse('server_error', error.message, 500);
    if (!season) return errorResponse('not_found', 'Season not found', 404);

    const body = await readJsonBody(_request);
    const parsed = updateSeasonSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
      return Response.json({ error: { code: 'validation_error', message: 'Invalid input', issues } }, { status: 422 });
    }

    const input = parsed.data;

    const expenseCount = await queryOne<{ count: string }>(
      `SELECT count(*)::text as count FROM expenses WHERE season_id = $1`,
      [id]
    );
    const hasExpenses = Number(expenseCount?.count ?? 0) > 0;

    const immutableFields = ['crop_id', 'acres', 'season', 'year'];
    for (const field of immutableFields) {
      if (field in input && hasExpenses) {
        return errorResponse('conflict', 'Cannot update field after expenses have been logged', 409);
      }
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    if (setClauses.length === 0) {
      return jsonResponse(season);
    }
    setClauses.push(`updated_at = now()`);
    values.push(id, session.accountId);

    const data = await queryOne(
      `UPDATE seasons SET ${setClauses.join(', ')} WHERE id = $${idx} AND account_id = $${idx + 1} RETURNING *`,
      values
    );

    if (!data) return errorResponse('server_error', 'Failed to update season', 500);
    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse('server_error', message, 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionApi();
  if (!session) return errorResponse('unauthorized', 'Unauthorized', 401);

  try {
    const { id } = await params;
    const { season, error } = await getOwnedSeason(id, session.accountId);
    if (error) return errorResponse('server_error', error.message, 500);
    if (!season) return errorResponse('not_found', 'Season not found', 404);

    const expenseCount = await queryOne<{ count: string }>(
      `SELECT count(*)::text as count FROM expenses WHERE season_id = $1`,
      [id]
    );

    const hasYield = season.actual_yield !== null && season.actual_price !== null;

    if (Number(expenseCount?.count ?? 0) > 0 || hasYield) {
      return errorResponse('conflict', 'Delete all expenses and harvest data first.', 409);
    }

    await query(`DELETE FROM projected_costs WHERE season_id = $1`, [id]);
    await query(`DELETE FROM seasons WHERE id = $1`, [id]);
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse('server_error', message, 500);
  }
}
