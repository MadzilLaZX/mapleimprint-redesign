// Downloads Joto Imaging Supplies Canada's public Shopify catalogue (products.json) into a local
// cache. Run occasionally (prices change); everything else in this folder reads the cache.
//   node scripts/joto-import/feed.mjs
// Polite on purpose: one page at a time with a pause between requests (~4 requests total).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".cache", "feed.json");
mkdirSync(dirname(out), { recursive: true });

const products = [];
for (let page = 1; page < 30; page++) {
  const res = await fetch(`https://jotoimagingsupplies.ca/products.json?limit=250&page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Maple Imprint catalogue sync)" },
  });
  if (!res.ok) throw new Error(`Joto feed page ${page}: HTTP ${res.status}`);
  const batch = (await res.json()).products;
  if (batch.length === 0) break;
  products.push(...batch);
  console.log(`page ${page}: ${batch.length}`);
  await new Promise((r) => setTimeout(r, 3000));
}
writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), products }));
console.log(`saved ${products.length} products -> ${out}`);
