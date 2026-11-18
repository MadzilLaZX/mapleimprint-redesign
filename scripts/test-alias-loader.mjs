// Minimal node:test ESM loader -- resolves the "@/" path alias (-> src/) with an added .ts
// extension when missing, PLUS (below) a narrow fallback for extensionless relative specifiers
// that Node's default resolver can't find on its own. Deliberately narrow: an earlier, broader
// loader retried extensionless relative specifiers unconditionally and ended up walking into
// Next.js's `server-only` guard via a transitive import chain (that package throws
// unconditionally at import time outside a real Next.js build -- see node_modules/server-only --
// so merely importing a file that imports it crashes the whole test file). The fallback below
// only engages when Node's OWN resolution already failed (so anything Node can already resolve
// on its own -- bare packages, node: builtins, already-extensioned files -- is completely
// unaffected), and before relying on it for any new test file, grep that file's real transitive
// dependency tree for `"server-only"` first (see priceCartItem.test.ts's addition for the
// precedent -- its full src/lib/products.ts / houseProducts/ / studio/pricing.ts chain was
// checked clean before this was added).
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "src");
const EXTENSIONS = [".ts", ".tsx", ".js"];

export async function resolve(specifier, context, nextResolve) {
  // `server-only` (used by src/lib/server/supabaseAdmin.ts, among others) is a build-time guard:
  // its real package body throws UNCONDITIONALLY the moment it's imported, with no environment
  // check at all -- it relies entirely on Next.js/webpack's static analysis to only ever include
  // it in a server bundle, never a client one. Outside that build pipeline (i.e. here, under
  // plain `node --test`), importing it always crashes, regardless of whether the code path that
  // pulled it in would ever actually run. Confirmed this round: fulfillOrder.integration.test.ts
  // transitively imports it (fulfillOrder.ts -> exportDesign.ts -> supabaseAdmin.ts) and could not
  // load AT ALL under node --test before this, independent of credentials/env vars -- this stub
  // doesn't change what supabaseAdmin.ts's real guard does in the actual app/build; it only
  // affects whether test files can finish loading.
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export {}", shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const withoutAlias = specifier.slice(2);
    const hasExtension = path.extname(withoutAlias) !== "";
    const candidates = hasExtension
      ? [withoutAlias]
      : EXTENSIONS.map((ext) => `${withoutAlias}${ext}`);

    for (const candidate of candidates) {
      const absolutePath = path.join(SRC_DIR, candidate);
      try {
        return await nextResolve(pathToFileURL(absolutePath).href, context);
      } catch {
        // try the next extension candidate
      }
    }
    throw new Error(`[test-alias-loader] Could not resolve "${specifier}" under ${SRC_DIR}`);
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && path.extname(specifier) === "") {
    try {
      return await nextResolve(specifier, context);
    } catch {
      for (const ext of EXTENSIONS) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          // try the next extension candidate
        }
      }
      throw new Error(`[test-alias-loader] Could not resolve relative specifier "${specifier}" from ${context.parentURL}`);
    }
  }

  return nextResolve(specifier, context);
}

// Next.js/Turbopack import JSON with a plain `import x from "./y.json"` (no import attribute) --
// Node's own ESM loader requires `with { type: "json" }` for that since Node 22, which the real
// app source deliberately doesn't write (it's bundler-only syntax, meaningless to Next.js/
// Turbopack). Without this, any test file that transitively imports src/lib/products.ts (which
// imports generated/products.json this way) fails with ERR_IMPORT_ATTRIBUTE_MISSING before a
// single assertion runs -- added specifically for priceCartItem.test.ts, which needs real
// catalogue data. Scoped to .json only, so it can't change how anything else loads.
export async function load(url, context, nextLoad) {
  if (!url.endsWith(".json")) {
    return nextLoad(url, context);
  }
  const source = await readFile(fileURLToPath(url), "utf8");
  return { format: "json", source, shortCircuit: true };
}
