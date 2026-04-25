/**
 * Smoke test for Supabase connectivity + seed data.
 *
 *   npm run db:check
 *
 * Expected output on a freshly-migrated database:
 *   brand: 3
 *   branch: 12
 *   assignee: 2
 */

import { ERRORS } from '../src/constants/errors';
import { TABLES } from '../src/constants/tables';
import { db } from '../src/lib/supabase';
import { logger } from '../src/utils/logger';

const EXPECTED = Object.freeze({
  [TABLES.BRAND]: 3,
  [TABLES.BRANCH]: 12,
  [TABLES.ASSIGNEE]: 2,
});

const TARGETS = [TABLES.BRAND, TABLES.BRANCH, TABLES.ASSIGNEE] as const;

type Target = (typeof TARGETS)[number];

async function countRows(table: Target): Promise<number> {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(`${ERRORS.DB_ERROR.code} on ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function main(): Promise<void> {
  let mismatches = 0;

  for (const table of TARGETS) {
    let actual: number;
    try {
      actual = await countRows(table);
    } catch (err) {
      logger.error({ err, table }, ERRORS.DB_CONNECTION_FAILED.message);
      process.exitCode = 1;
      return;
    }

    const expected = EXPECTED[table];
    const ok = actual === expected;
    if (!ok) mismatches += 1;

    // eslint-disable-next-line no-console
    console.log(`${table}: ${actual}${ok ? '' : `  (expected ${expected})`}`);
  }

  if (mismatches > 0) {
    process.exitCode = 1;
  }
}

void main();
