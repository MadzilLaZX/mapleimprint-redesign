// Loads catalogue-engine/.env into process.env before tests run, so integration tests can see
// DATABASE_URL. No dependency on `dotenv` — the .env file here is deliberately simple
// (KEY="value" lines only), so a minimal parser is enough.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');

if (existsSync(envPath)) {
  const contents = readFileSync(envPath, 'utf-8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// FAIL-CLOSED SAFETY CHECK (2026-11-19): every *.integration.test.ts file in this folder gates
// only on `DATABASE_URL` being set (`const hasDb = !!process.env.DATABASE_URL`) -- none of them
// individually check WHICH database that is. .env.example's only documented value, and the only
// one any prior session is known to have actually used (see README.md's "DATABASE_URL is now
// configured in a local .env... pointed at the Session pooler"), is the real
// maple-imprint-catalogue production project (ovqkwedpwmuusnijbxro) -- there is no separate
// test/staging project. That means simply having a working DATABASE_URL in .env (entirely
// plausible for unrelated local tooling) is, today, sufficient for `npm test` here to run real
// INSERT/UPDATE/DELETE writes against production with zero additional confirmation.
//
// This is the one shared setupFile every integration test file already loads (vitest.config.ts),
// so it's the single place to close that gap for all of them at once, instead of repeating a
// check in each file. Unset DATABASE_URL (today's actual default state) is completely unaffected
// -- this only engages once DATABASE_URL is both set AND identifiable as the production project.
const PRODUCTION_DB_HOST_FRAGMENT = 'ovqkwedpwmuusnijbxro';
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl?.includes(PRODUCTION_DB_HOST_FRAGMENT) && process.env.ALLOW_PRODUCTION_DB_WRITES !== 'i-understand-this-writes-to-production') {
  throw new Error(
    'DATABASE_URL points at the production maple-imprint-catalogue project. Integration tests in ' +
      'this folder perform real writes (INSERT/UPDATE/DELETE), and there is no separate test ' +
      'database to point at instead. Refusing to run. If you have deliberately decided to run ' +
      'these against production (not recommended -- prefer a local Postgres instance via ' +
      '`supabase start`, see ../docs/local-test-environment-setup.md in the main app), set ' +
      'ALLOW_PRODUCTION_DB_WRITES=i-understand-this-writes-to-production explicitly.',
  );
}
