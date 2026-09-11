// STEP 1 of 2 for a SanMar import — the ONLY thing that touches the once-per-calendar-day,
// rate-limited getBulkData call. Its single job: make that one call and write the response to
// disk. It does NOT import, promote, classify, or touch the database. Nothing here can "waste"
// the daily call on a downstream bug, because there is no downstream.
//
// After this succeeds, run scripts/import-sanmar-catalogue.mjs as many times as needed — it
// reads the disk cache this script writes (.cache/sanmar-bulkdata-<UTC-date>.json) and never
// makes a live call for a date it already has cached. Fix bugs, re-run, repeat, at zero API cost.
//
// Writes two files under catalogue-engine/.cache/ :
//   sanmar-raw-<UTC-date>.json        -- the full untouched SOAP result object (belt)
//   sanmar-bulkdata-<UTC-date>.json   -- just the Product[] array, the format SanMarConnector's
//                                        readDiskCache() expects (suspenders)
// If the second extraction ever looks wrong, the raw file lets us re-derive it offline.
//
// Run with: node scripts/capture-sanmar-bulkdata.mjs
// Requires SANMAR_CUSTOMER_ID and SANMAR_EDI_EMAIL in .env. Must run from an IP SanMar allows
// (the VPS), not a dev laptop.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createClientAsync } from 'soap';

// Mirrors SanMarConnector.ts's confirmed-live constants (not exported from it — kept in sync by hand).
const WSDL_URL = 'https://edi.atc-apparel.com/bulk-data/BulkDataService.php?wsdl';
const WS_VERSION = '1.0.0';
const SOAP_TIMEOUT_MS = 120_000;

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = resolve(here, '..');
const CACHE_DIR = join(engineRoot, '.cache');

// UTC calendar day — must match SanMarConnector.ts's todayKey().
const dateKey = new Date().toISOString().slice(0, 10);

const envPath = resolve(engineRoot, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const customerId = process.env.SANMAR_CUSTOMER_ID;
const ediEmail = process.env.SANMAR_EDI_EMAIL;
if (!customerId || !ediEmail) {
  console.error('Missing SANMAR_CUSTOMER_ID and/or SANMAR_EDI_EMAIL in .env — aborting before any call.');
  process.exit(1);
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  const bulkCachePath = join(CACHE_DIR, `sanmar-bulkdata-${dateKey}.json`);
  if (existsSync(bulkCachePath)) {
    console.log(`Already have ${bulkCachePath} for today (UTC ${dateKey}). Not calling the API.`);
    console.log('Delete that file first if you deliberately want to re-pull (costs the daily call).');
    process.exit(0);
  }

  console.log(`UTC date key: ${dateKey}`);
  console.log('Creating SOAP client (WSDL fetch — not rate-limited)...');
  const client = await createClientAsync(WSDL_URL, { wsdl_options: { timeout: SOAP_TIMEOUT_MS } });

  const method = client.getBulkDataAsync;
  if (typeof method !== 'function') {
    console.error("WSDL did not expose 'getBulkDataAsync' — the service may have changed. No call made.");
    process.exit(1);
  }

  console.log('Making the ONE rate-limited getBulkData call now...');
  const started = Date.now();
  const [result] = await method.call(
    client,
    { wsVersion: WS_VERSION, id: customerId, password: ediEmail },
    { timeout: SOAP_TIMEOUT_MS },
  );
  console.log(`Response received in ${((Date.now() - started) / 1000).toFixed(1)}s.`);

  // Write the raw result FIRST, before any interpretation — this is the whole point of the script.
  const rawPath = join(CACHE_DIR, `sanmar-raw-${dateKey}.json`);
  writeFileSync(rawPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Raw response written: ${rawPath}`);

  // Report any ServiceMessage, but do not throw before we've saved everything.
  const messages = asArray(result?.ServiceMessageArray?.ServiceMessage);
  for (const m of messages) {
    console.log(`ServiceMessage: code=${m?.code ?? '(none)'} desc=${JSON.stringify(m?.description ?? '')}`);
  }
  const realError = messages.find((m) => String(m?.code ?? '').trim() && String(m?.code ?? '').trim() !== '200');
  if (realError) {
    const code = String(realError.code).trim();
    console.error(`\nSanMar returned error code [${code}] — no product data to cache.`);
    if (code === '125') {
      console.error("This is the once-per-day limit: today's call was already used. Try again after 00:00 UTC.");
    }
    console.error(`Raw response saved at ${rawPath} for inspection.`);
    process.exit(2);
  }

  const rows = asArray(result?.ProductInventoryArray?.Product);
  console.log(`\nExtracted ${rows.length} product rows.`);
  if (rows.length <= 1) {
    console.error('Got 0 or 1 rows — this is NOT a normal full-catalogue response (expect thousands).');
    console.error(`Not writing the connector cache file. Inspect ${rawPath}.`);
    process.exit(3);
  }

  const sample = rows[0];
  console.log('Sample row keys:', Object.keys(sample).join(', '));
  console.log('Sample row:', JSON.stringify(sample, null, 2).slice(0, 800));

  writeFileSync(bulkCachePath, JSON.stringify(rows), 'utf-8');
  console.log(`\nConnector cache written: ${bulkCachePath}`);
  console.log('\nDONE. Now run:  node scripts/import-sanmar-catalogue.mjs');
  console.log('That will read this cache and make NO further live calls today.');
}

main().catch((err) => {
  console.error('\ncapture-sanmar-bulkdata failed:', err?.message ?? err);
  console.error('If a raw file was written above, the data may still be recoverable from it.');
  process.exit(1);
});
