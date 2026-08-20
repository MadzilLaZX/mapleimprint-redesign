import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/slugify";
import { cn } from "@/lib/cn";
import { buildShopUrl, SHOP_SORTS, type ShopSearchParams, type ShopSort } from "@/lib/shopQuery";

function Chip({
  href,
  active,
  small,
  children,
}: {
  href: string;
  active: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap rounded-full border font-medium transition-colors",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        active
          ? "border-transparent bg-ink-950 text-white"
          : "border-sand bg-white text-ink-900/70 hover:border-ink-950/25",
      )}
    >
      {children}
    </Link>
  );
}

export function ShopFilters({ params, sort }: { params: ShopSearchParams; sort: ShopSort }) {
  const activeCategory = PRODUCT_CATEGORIES.find((c) => c.slug === params.category) ?? null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip href={buildShopUrl(params, { category: undefined, subcategory: undefined })} active={!params.category}>
          All Products
        </Chip>
        {PRODUCT_CATEGORIES.map((c) => (
          <Chip
            key={c.slug}
            href={buildShopUrl(params, { category: c.slug, subcategory: undefined })}
            active={params.category === c.slug}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      {activeCategory && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip small href={buildShopUrl(params, { subcategory: undefined })} active={!params.subcategory}>
            All {activeCategory.name}
          </Chip>
          {activeCategory.subcategories.map((sub) => {
            const subSlug = slugify(sub);
            return (
              <Chip
                key={subSlug}
                small
                href={buildShopUrl(params, { subcategory: subSlug })}
                active={params.subcategory === subSlug}
              >
                {sub}
              </Chip>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Sort</span>
        {SHOP_SORTS.map((s) => (
          <Chip key={s.value} small href={buildShopUrl(params, { sort: s.value })} active={sort === s.value}>
            {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
