// Builds Maple Imprint product listings from Joto product links.
//   node scripts/joto-import/build.mjs            -> regenerate from manifest.json
//   node scripts/joto-import/build.mjs --dry      -> report only, write nothing
//
// Inputs:
//   manifest.json          the Joto products to list (handle or full URL, plus optional overrides)
//   .cache/feed.json       Joto's public catalogue (node scripts/joto-import/feed.mjs)
//   tiers/*.json           "Buy more, save more" captures from the bookmarklet (optional per product)
// Outputs (generated — edit manifest.json, never these):
//   src/lib/houseProducts/jotoImportedCatalog.ts       customer-facing listings, RETAIL prices
//   src/lib/houseProducts/jotoImportedInternalOnly.ts  exact Joto costs + SKUs (never imported by UI)
//   public/images/products/joto/<slug>-<n>.webp         Joto's original photos
//
// Pricing = the same rules as every other Joto product (pricing/margin.ts markupRateFor): bracket
// chosen by PER-PIECE cost; the first tier of a sale item is marked up from Joto's REGULAR price.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sharp = require("sharp");
const DRY = process.argv.includes("--dry");

// ---------- helpers ----------------------------------------------------------------------------
function loadTs(path) {
  const js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: 1, target: 7 } }).outputText;
  const m = { exports: {} };
  new Function("module", "exports", "require", js)(m, m.exports, () => ({}));
  return m.exports;
}
const { markupRateFor } = loadTs(join(ROOT, "src/lib/houseProducts/pricing/margin.ts"));
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (s) => Number(String(s).replace(/[$,]/g, ""));
const q = (s) => JSON.stringify(s);
const handleOf = (s) => (s.includes("/products/") ? s.split("/products/")[1].split(/[/?#]/)[0] : s).trim();
const cleanOpt = (s) => s.replace(/''/g, '"').replace(/\s+X\s+/g, " x ").trim();

// ---------- inputs -----------------------------------------------------------------------------
const feedPath = join(here, ".cache", "feed.json");
if (!existsSync(feedPath)) throw new Error("No Joto feed cache — run: node scripts/joto-import/feed.mjs");
const feed = JSON.parse(readFileSync(feedPath, "utf8"));
const byHandle = new Map(feed.products.map((p) => [p.handle, p]));
const mArg = process.argv.indexOf("--manifest");
const manifest = JSON.parse(readFileSync(mArg > 0 ? process.argv[mArg + 1] : join(here, "manifest.json"), "utf8"));
const tArg = process.argv.indexOf("--tiers");
const tiersDir = tArg > 0 ? process.argv[tArg + 1] : join(here, "tiers");
const tierFiles = existsSync(tiersDir)
  ? Object.fromEntries(readdirSync(tiersDir).filter((f) => f.endsWith(".json")).map((f) => {
      const t = JSON.parse(readFileSync(join(tiersDir, f), "utf8"));
      return [t.handle, t];
    }))
  : {};

// Everything already on the site: SKUs (for duplicate detection) and slugs (for collisions).
const H = join(ROOT, "src/lib/houseProducts");
const GENERATED = ["jotoImportedCatalog.ts", "jotoImportedInternalOnly.ts"];
const existingText = readdirSync(H).filter((f) => f.endsWith(".ts") && !GENERATED.includes(f)).map((f) => readFileSync(join(H, f), "utf8")).join("\n");
const existingSkus = new Set((existingText.match(/\b(?:BE?|CE)-[A-Z0-9][A-Z0-9-]*[A-Z0-9]\b/g) || []).map((s) => s.toUpperCase()));
const existingSlugs = new Set([
  ...[...existingText.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]),
  ...JSON.parse(readFileSync(join(ROOT, "src/lib/generated/products.json"), "utf8")).map((p) => p.slug),
]);

// ---------- category rules (first match wins; override per product in manifest) ----------------
const RULES = [
  [/engrav/i, /mug|tumbler|flask|bottle|cup/i, "drinkware/engraved-personalized"],
  [null, /mouse ?pad/i, "gifts-promo/tech-accessories"],
  [null, /coaster|trivet/i, "gifts-promo/coasters"],
  [null, /tote|drawstring|shopping bag|gift bag|cosmetic bag|pencil case|pouch|backpack/i, "gifts-promo/bags"],
  [null, /apron/i, "hats-accessories/aprons"],
  [null, /\bcap\b|\bhat\b|trucker|beanie/i, "hats-accessories/caps"],
  [null, /keychain|key ?ring/i, "gifts-promo/keychains"],
  [null, /magnet/i, "gifts-promo/magnets"],
  [null, /ornament/i, "personalized-engraving/ornaments"],
  [null, /cutting board|pot holder|oven mitt|kitchen towel|placemat/i, "personalized-engraving/kitchen-gifts"],
  [null, /plaque|photo panel|photo frame|\bframe\b|canvas|slate/i, "gifts-promo/photo-panels"],
  [null, /notebook|journal|bookmark|pen\b/i, "gifts-promo/stationery"],
  [null, /glass|stemless|beer can|shot/i, "drinkware/glassware"],
  [null, /bottle|flask/i, "drinkware/bottles"],
  [null, /tumbler|travel mug|can cooler|koozie/i, "drinkware/tumblers"],
  [null, /mug|cup/i, "drinkware/mugs"],
];
function categoryFor(p) {
  for (const [typeRe, titleRe, cat] of RULES) if ((!typeRe || typeRe.test(p.product_type + " " + p.title)) && titleRe.test(p.title)) return cat;
  return null;
}

// ---------- parsing ----------------------------------------------------------------------------
function packFromTitle(title) {
  const m =
    title.match(/\b(case|pack|box|set)s?\s+(?:size\s+)?of\s+(\d+)/i) ||
    title.match(/\b(pack)\s+size\s+(\d+)/i) ||
    title.match(/(\d+)[\s-]*(pack|pcs|piece)\b/i) ||
    title.match(/\((\d+)\s+\w+\s+in total\)/i);
  if (!m) return null;
  const n = Number(m.find((x, i) => i > 0 && /^\d+$/.test(x)));
  const word = (m.find((x, i) => i > 0 && /^[a-z]+$/i.test(x)) || "pack").toLowerCase();
  return { size: n, unit: word === "case" ? "case" : "pack" };
}
// One Hulk tier card, e.g. "3 packs SAVE 8% 15 pcs · $7.02 each $105.30".
function parseCard(text) {
  const bundle = text.match(/(\d[\d,]*)\s+(packs?|cases?|boxes?|sets?|units?)\b/i);
  const items = text.match(/(\d[\d,]*)\s+[a-z]+\s*[·•]\s*\$([\d,]+\.\d{2})\s*each/i);
  const totals = [...text.matchAll(/\$([\d,]+\.\d{2})(?!\s*each)/gi)].map((m) => money(m[1]));
  if (!bundle || !totals.length) return null;
  return {
    bundleCount: money(bundle[1]),
    unitWord: bundle[2].toLowerCase().replace(/s$/, ""),
    totalItems: items ? money(items[1]) : null,
    perItemCad: items ? money(items[2]) : null,
    totalCad: totals.at(-1),
  };
}
function textFromHtml(html) {
  return (html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function shortDescription(p, packText) {
  // Split only where a sentence really ends (so "25.4oz" stays whole); skip a leading line that just
  // repeats the product title (Joto often starts the description with it).
  const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9]+/g) || []);
  const tw = words(p.title);
  // Headings/paragraphs/list items become their own lines first, so a heading never fuses with the
  // sentence after it.
  const blocks = (p.body_html || "").replace(/<\/(h\d|p|li|div)>|<br\s*\/?>/gi, "\n");
  const sentences = blocks
    .split("\n")
    .map((b) => textFromHtml(b))
    .flatMap((b) => b.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((x) => x.trim())
    .filter((x) => {
      if (x.length < 25) return false;
      const sw = [...words(x)];
      return !(sw.filter((w) => tw.has(w)).length / sw.length > 0.6); // just repeats the title
    })
    .map((x) => x.replace(/(the|our)?\s*pearl coating(™)?\s*/gi, (_m, a) => (a ? a + " " : "")).replace(/\s+([.,!?])/g, "$1").replace(/\s{2,}/g, " ").trim().replace(/^./, (c) => c.toUpperCase()))
    .map((x) => (/[.!?]$/.test(x) ? x : x + "."));
  let out = "";
  for (const s of sentences) {
    if (/joto|warranty|shipping|click here|contact us/i.test(s)) continue;
    if (out.length > 160 || (out + s).length > 340) break;
    out += s.trim() + " ";
  }
  out = out.trim() || p.title + ".";
  return /sold (by|in|as)/i.test(out) ? out : `${out} ${packText}`;
}
function cleanName(title, pack) {
  let n = title.replace(/^pearl coating(™)?\s*/i, "").replace(/''/g, '"').replace(/\s+/g, " ").trim();
  // Drop Joto's own pack wording (it's occasionally wrong) and append the verified pack size.
  n = n.replace(/\s*[-–(]?\s*(pack|case)s?\s+(size\s+)?(of\s+)?\d+\s*\)?\s*$/i, "").replace(/\s*[-–]\s*$/, "").trim();
  if (pack) n += ` — ${pack.unit === "case" ? "Case" : "Pack"} of ${pack.size}`;
  return n;
}
function slugFor(handle) {
  let s = handle.replace(/^pearl-coating-?/, "").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (existingSlugs.has(s)) s += "-joto";
  return s;
}

// Pack size per variant from the product page's own "HulkTierData" block (server-rendered, so a
// plain page load has it). Cached in .cache/pages so each page is fetched once.
async function pagePacks(handle) {
  const file = join(here, ".cache", "pages", handle + ".html");
  let html = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (!html) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://jotoimagingsupplies.ca/products/${handle}`, { headers: { "User-Agent": "Mozilla/5.0 (Maple Imprint catalogue sync)" } });
    if (!res.ok) return {};
    html = await res.text();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
  const m = html.match(/id="HulkTierData[^"]*">\s*([\s\S]*?)\s*<\/script>/);
  if (!m) return {};
  try {
    const data = JSON.parse(m[1]);
    return Object.fromEntries(Object.entries(data.variants || {}).filter(([, v]) => v.pack > 0).map(([id, v]) => [id, v.pack]));
  } catch {
    return {};
  }
}

// ---------- pricing (identical rules to the 61 hand-imported products) -------------------------
function retail(entry) {
  const tiers = entry.tiers.map((t, i) => {
    const useRegular = i === 0 && entry.regularPriceCad !== undefined;
    const costTotal = useRegular ? entry.regularPriceCad : t.totalCad;
    const costPer = useRegular ? entry.regularPriceCad / t.totalItems : t.perItemCad ?? t.totalCad / t.totalItems;
    const rate = markupRateFor(costPer);
    if (t.perItemCad !== null && !useRegular) {
      const per = round2(t.perItemCad * (1 + rate));
      return { ...t, perItemCad: per, totalCad: round2(per * t.totalItems) };
    }
    return { ...t, perItemCad: null, totalCad: round2(costTotal * (1 + rate)) };
  });
  const out = { ...entry, tiers };
  delete out.regularPriceCad;
  return out;
}
const fmtTier = (t) => `{ bundleCount: ${t.bundleCount}, totalItems: ${t.totalItems}, perItemCad: ${t.perItemCad === null ? "null" : t.perItemCad}, totalCad: ${t.totalCad} }`;
function fmtEntries(entries, ind) {
  const p = " ".repeat(ind);
  return entries.map((e) => [
    `${p}{`, `${p}  sellUnit: "${e.sellUnit}",`, `${p}  itemsPerBundle: ${e.itemsPerBundle},`,
    ...(e.appliesTo ? [`${p}  appliesTo: ${q(e.appliesTo)},`] : []),
    ...(e.regularPriceCad !== undefined ? [`${p}  regularPriceCad: ${e.regularPriceCad},`] : []),
    `${p}  tiers: [`, ...e.tiers.map((t) => `${p}    ${fmtTier(t)},`), `${p}  ],`, `${p}},`,
  ].join("\n")).join("\n");
}

// ---------- build ------------------------------------------------------------------------------
const IMG_DIR = join(ROOT, "public/images/products/joto");
mkdirSync(IMG_DIR, { recursive: true });
const catalogue = [], internal = [], report = [];
let problems = 0;

for (const item of manifest.products) {
  const handle = handleOf(item.handle || item.url);
  const p = byHandle.get(handle);
  const flags = [];
  if (!p) { report.push(`✗ ${handle}: not in Joto's catalogue (check the link, or re-run feed.mjs)`); problems++; continue; }
  const dupes = p.variants.map((v) => (v.sku || "").trim().toUpperCase()).filter((s) => s && existingSkus.has(s));
  if (dupes.length && !item.allowDuplicate) { report.push(`✗ ${p.title}: already on the site (SKU ${dupes.join(", ")}) — skipped`); continue; }

  const category = item.category || categoryFor(p);
  if (!category) { report.push(`✗ ${p.title}: no category rule matched — add "category" in manifest.json`); problems++; continue; }
  const [categorySlug, subcategorySlug] = category.split("/");

  // Variants (optionally limited) and the one option group the picker shows.
  const variants = p.variants.filter((v) => !item.excludeVariants?.includes(v.title));
  const hasOptions = !(variants.length === 1 && /default title/i.test(variants[0].title));
  // Only options that actually vary across the listed variants (Joto often has e.g. a one-value "Size").
  const varying = p.options.map((_o, i) => i).filter((i) => new Set(variants.map((v) => v[`option${i + 1}`])).size > 1);
  const shown = varying.length ? varying : [0];
  const optName = hasOptions ? shown.map((i) => p.options[i].name).join(" / ") : null;
  const labelOf = (v) => cleanOpt(shown.map((i) => v[`option${i + 1}`]).join(" / "));

  // Tier captures (bookmarklet), matched to variants by id, then by option label.
  const cap = tierFiles[handle];
  const tiersFor = (v) => {
    if (!cap) return null;
    const hit = cap.variants.find((c) => String(c.variantId) === String(v.id)) || cap.variants.find((c) => c.label && cleanOpt(c.label) === labelOf(v)) || (cap.variants.length === 1 ? cap.variants[0] : null);
    const cards = (hit?.cards || []).map(parseCard).filter(Boolean);
    return cards.length ? cards : null;
  };

  const titlePack = packFromTitle(p.title);
  const pagePack = await pagePacks(handle);
  const entries = [];
  for (const v of variants) {
    const price = money(v.price), compare = v.compare_at_price ? money(v.compare_at_price) : null;
    const cards = tiersFor(v);
    const packSize = item.packSize ?? (cards?.[0]?.totalItems ? cards[0].totalItems / cards[0].bundleCount : null) ?? pagePack[v.id] ?? titlePack?.size ?? null;
    if (pagePack[v.id] && titlePack?.size && pagePack[v.id] !== titlePack.size) flags.push(`Joto's title says ${titlePack.size} but its page data says ${pagePack[v.id]} per ${titlePack.unit} — used ${packSize}`);
    const sellUnit = item.sellUnit ?? (packSize && packSize > 1 ? (cards?.[0]?.unitWord === "case" || titlePack?.unit === "case" ? "case" : "pack") : "unit");
    const n = packSize ?? 1;
    if (!packSize && !item.sellUnit) flags.push("pack size not stated by Joto — listed as a single unit, please confirm");
    const tiers = cards
      ? cards.map((c) => ({ bundleCount: c.bundleCount, totalItems: c.totalItems ?? c.bundleCount * n, perItemCad: c.perItemCad, totalCad: c.totalCad }))
      : [{ bundleCount: 1, totalItems: n, perItemCad: null, totalCad: price }];
    if (cards && Math.abs(cards[0].totalCad - price) > 0.011 && !(compare && compare > price)) flags.push(`tier 1 ($${cards[0].totalCad}) ≠ catalogue price ($${price}) for ${labelOf(v)} — check`);
    for (const t of tiers) if (t.perItemCad !== null && Math.abs(round2(t.perItemCad * t.totalItems) - t.totalCad) > 0.011) flags.push(`Joto rounding: ${t.totalItems} × $${t.perItemCad} ≠ $${t.totalCad} (kept Joto's total)`);
    entries.push({
      sellUnit, itemsPerBundle: n,
      ...(hasOptions ? { appliesTo: labelOf(v) } : {}),
      ...(compare && compare > price ? { regularPriceCad: compare } : {}),
      tiers, _sku: v.sku, _available: v.available,
    });
  }
  if (!cap) flags.push("no tier capture — only the single-pack price is listed (run the bookmarklet on this page to add quantity discounts)");
  const unavailable = variants.filter((v) => !v.available).map(labelOf);
  if (unavailable.length) flags.push(`sold out at Joto (kept): ${unavailable.join(", ")}`);

  // Collapse identical pricing across options into one shared entry.
  const sig = (e) => JSON.stringify([e.sellUnit, e.itemsPerBundle, e.regularPriceCad, e.tiers]);
  const shared = entries.every((e) => sig(e) === sig(entries[0]));
  const costEntries = (shared ? [entries[0]] : entries).map(({ _sku, _available, ...e }) => (shared ? (({ appliesTo, ...rest }) => rest)(e) : e));
  const retailEntries = costEntries.map(retail);

  // Images: Joto originals, variant-linked photos tagged with that option.
  const slug = item.slug || slugFor(handle);
  const imgs = [];
  for (const [i, im] of p.images.slice(0, item.maxImages ?? 8).entries()) {
    const file = `${slug}-${i + 1}`;
    const linked = hasOptions && im.variant_ids?.length ? variants.find((v) => im.variant_ids.includes(v.id)) : null;
    imgs.push([file, linked ? labelOf(linked) : null]);
    const out = join(IMG_DIR, file + ".webp");
    if (!DRY && !existsSync(out)) {
      const res = await fetch(im.src);
      if (!res.ok) { flags.push(`image ${i + 1} failed (HTTP ${res.status})`); imgs.pop(); continue; }
      await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fff" }).webp({ quality: 90 }).toFile(out);
    }
  }

  const first = retailEntries[0];
  const packText = first.sellUnit === "unit" ? "Sold individually." : `Sold by the ${first.sellUnit} of ${first.itemsPerBundle}.`;
  const name = item.name || cleanName(p.title, first.sellUnit === "unit" ? null : { size: first.itemsPerBundle, unit: first.sellUnit });
  const options = hasOptions ? { name: optName, values: variants.map(labelOf) } : null;
  const startingPrice = Math.min(...retailEntries.map((e) => e.tiers[0].totalCad));

  catalogue.push([
    "  {", `    slug: ${q(slug)},`, `    name: ${q(name)},`, `    brandName: "Maple Imprint",`,
    `    categorySlug: ${q(categorySlug)},`, `    subcategorySlug: ${q(subcategorySlug)},`,
    `    description:\n      ${q(item.description || shortDescription(p, packText))},`,
    `    images: [\n${imgs.map(([f, c]) => `      J(${q(f)}${c ? ", " + q(c) : ""}),`).join("\n")}\n    ],`,
    "    colours: [],", "    sizes: [],", "    variants: [],", "    priceTiers: null,",
    `    startingPrice: ${startingPrice},`, "    printRuleVersion: RULE,",
    ...(options ? [`    productOptions: [{ name: ${q(options.name)}, values: ${q(options.values).replace(/","/g, '", "')} }],`] : []),
    `    bundlePricing: [\n${fmtEntries(retailEntries, 6)}\n    ],`, "  },",
  ].join("\n"));
  internal.push(`  {\n    slug: ${q(slug)},\n    jotoHandle: ${q(handle)},\n    jotoTitle: ${q(p.title)},\n    jotoSkus: ${q(variants.map((v) => v.sku))},\n    costPricing: [\n${fmtEntries(costEntries, 6)}\n    ],\n  },`);

  report.push(
    `✓ ${name}\n    ${category} · ${variants.map((v) => v.sku).join(", ")}${options ? " · " + options.name + ": " + options.values.join(", ") : ""} · ${imgs.length} photos\n` +
    costEntries.map((e, i) => `    ${e.appliesTo ? e.appliesTo + ": " : ""}` + e.tiers.map((t, j) => `${t.bundleCount}× $${j === 0 && e.regularPriceCad ? e.regularPriceCad + " (reg; sale $" + t.totalCad + ")" : t.totalCad} → $${retailEntries[i].tiers[j].totalCad}`).join(" | ")).join("\n") +
    (flags.length ? "\n" + [...new Set(flags)].map((f) => "    ⚠ " + f).join("\n") : ""),
  );
}

const header = (what) =>
  `// AUTO-GENERATED by scripts/joto-import/build.mjs from scripts/joto-import/manifest.json — do not edit\n// by hand; change the manifest and re-run. ${what}\n`;
if (!DRY) {
  writeFileSync(join(H, "jotoImportedCatalog.ts"),
    header("Joto products listed on the site at RETAIL prices (Joto cost + margin.ts markup:\n// per-piece bracket, sale items from the regular price). Exact costs: jotoImportedInternalOnly.ts.") +
    `import type { CatalogueProduct } from "@/lib/products";\n\nconst RULE = "house-v1-joto-auto-${feed.fetchedAt.slice(0, 10)}";\nconst J = (file: string, colourName: string | null = null) => ({\n  url: \`/images/products/joto/\${file}.webp\`,\n  colourName,\n  imageType: "front",\n});\n\nexport const JOTO_IMPORTED_CATALOGUE: CatalogueProduct[] = [\n${catalogue.join("\n")}\n];\n`);
  writeFileSync(join(H, "jotoImportedInternalOnly.ts"),
    header(`INTERNAL-ONLY: Joto's exact dealer costs (CAD) from its catalogue as of ${feed.fetchedAt.slice(0, 10)}.\n// DO NOT import from any customer-facing module.`) +
    `import type { SupplierBundlePricing } from "@/lib/products";\n\nexport const JOTO_IMPORTED_COSTS_INTERNAL: { slug: string; jotoHandle: string; jotoTitle: string; jotoSkus: string[]; costPricing: SupplierBundlePricing[] }[] = [\n${internal.join("\n")}\n];\n`);
}
console.log(report.join("\n\n"));
console.log(`\n${catalogue.length} product(s) built${DRY ? " (dry run — nothing written)" : ""}${problems ? `, ${problems} need attention` : ""}.`);
