export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
