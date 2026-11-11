// Minimal node:test ESM loader -- resolves ONLY the "@/" path alias (-> src/) with an added
// .ts extension when missing, then defers to Node's default resolution for everything else
// (relative imports, bare package specifiers, node: builtins). Deliberately narrow: an earlier,
// broader loader that also retried extensionless relative specifiers ended up walking into
// Next.js's `server-only` guard via a transitive import chain. This one only ever touches
// specifiers that start with "@/", so it can't accidentally pull in code outside what the test
// file itself intends to exercise.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "src");
const EXTENSIONS = [".ts", ".tsx", ".js"];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

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
