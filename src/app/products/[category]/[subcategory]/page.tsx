import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { getProductsBySubcategory, subcategorySlugify } from "@/lib/products";

function findSubcategory(categorySlug: string, subcategorySlug: string) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat) return null;
  const subLabel = cat.subcategories.find((s) => subcategorySlugify(s) === subcategorySlug);
  if (!subLabel) return null;
  return { cat, subLabel };
}

export function generateStaticParams() {
  return PRODUCT_CATEGORIES.flatMap((cat) =>
    cat.subcategories.map((sub) => ({ category: cat.slug, subcategory: subcategorySlugify(sub) })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const found = findSubcategory(category, subcategory);
  if (!found) return {};
  return {
    title: `${found.subLabel} — ${found.cat.name}`,
    description: `Browse ${found.subLabel.toLowerCase()} from Maple Imprint, priced per quantity tier with instant customization.`,
  };
}

export default async function SubcategoryPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  const found = findSubcategory(category, subcategory);
  if (!found) notFound();

  const { cat, subLabel } = found;
  const products = getProductsBySubcategory(category, subcategory);

  return (
    <>
      <PageHeader
        eyebrow={cat.name}
        title={subLabel}
        description={
          products.length > 0
            ? `${products.length} product${products.length === 1 ? "" : "s"} available, priced per quantity — no minimums to browse.`
            : "New products are being added to this subcategory."
        }
      />

      <Section tone="canvas">
        {products.length === 0 ? (
          <Reveal className="rounded-2xl bg-white p-10 text-center">
            <p className="text-sm text-muted">
              We&apos;re still adding {subLabel.toLowerCase()} to the site. In the meantime, get a
              quote and we&apos;ll help you find the right option.
            </p>
          </Reveal>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => {
              const cover = product.images[0];
              return (
                <Reveal key={product.slug} delay={i * 0.04}>
                  <Link
                    href={`/products/${category}/${subcategory}/${product.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-canvas">
                      {cover ? (
                        <Image
                          src={cover.url}
                          alt={product.name}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                          className="object-contain p-4 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">
                          No image yet
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {product.brandName}
                      </p>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <h3 className="font-display text-sm font-semibold leading-snug text-ink-900">
                          {product.name}
                        </h3>
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted transition-colors group-hover:text-orange" weight="bold" />
                      </div>
                      {product.startingPrice !== null && (
                        <p className="mt-2 text-sm font-semibold text-ink-900">
                          From ${product.startingPrice.toFixed(2)}
                          <span className="font-normal text-muted"> / unit</span>
                        </p>
                      )}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </Section>

      <FinalCTA />
    </>
  );
}
