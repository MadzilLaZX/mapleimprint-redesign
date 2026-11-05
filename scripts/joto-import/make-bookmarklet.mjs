// Turns capture-tiers.js into a one-line bookmark (javascript: URL) in bookmarklet.txt.
//   node scripts/joto-import/make-bookmarklet.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "capture-tiers.js"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
writeFileSync(join(here, "bookmarklet.txt"), "javascript:" + encodeURIComponent(src.replace(/\s*\n\s*/g, "\n").trim()) + "\n");
console.log("wrote bookmarklet.txt");
