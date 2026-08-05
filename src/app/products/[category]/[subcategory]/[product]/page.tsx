import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PRODUCTS, getProduct } from "@/lib/products";
import { ProductCustomizer } from "@/components/products/ProductCustomizer";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({
    category: p.categorySlug,
    subcategory: p.subcategorySlug,
    product: p.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; subcategory: string; product: string }>;
}): Promise<Metadata> {
  const { category, subcategory, product } = await params;
  const p = getProduct(category, subcategory, product);
  if (!p) return {};
  return {
    title: `${p.name} — ${p.brandName}`,
    description: p.description ? p.description.slice(0, 155) : `${p.name} from Maple Imprint, custom decorated.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string; product: string }>;
}) {
  const { category, subcategory, product } = await params;
  const p = getProduct(category, subcategory, product);
  if (!p) notFound();

  const primaryImage = p.images[0];
  const galleryImages = p.images.slice(0, 6);
  const categoryName = PRODUCT_CATEGORIES.find((c) => c.slug === p.categorySlug)?.name ?? p.categorySlug;

  return (
    <>
      <PageHeader eyebrow={`${p.brandName} · ${p.subcategorySlug.replace(/-/g, " ")}`} title={p.name} />

      <Section tone="canvas">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-white">
              {primaryImage ? (
                <Image
                  src={primaryImage.url}
                  alt={p.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  priority
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">No image yet</div>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                {galleryImages.map((img, i) => (
                  <div key={`${img.url}-${i}`} className="relative aspect-square overflow-hidden rounded-lg bg-white">
                    <Image src={img.url} alt={img.colourName ?? p.name} fill sizes="120px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </Reveal>

          <Reveal delay={0.08}>
            {p.startingPrice !== null && (
              <p className="font-display text-3xl font-semibold text-ink-900">
                From ${p.startingPrice.toFixed(2)}
                <span className="text-base font-normal text-muted"> / unit, custom printed</span>
              </p>
            )}

            {p.description && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">{p.description}</p>
            )}

            <div className="mt-6">
              <ProductCustomizer product={p} categoryName={categoryName} />
            </div>
          </Reveal>
        </div>
      </Section>

      {p.priceTiers && (
        <Section tone="white">
          <Container className="max-w-2xl">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
                Pricing by quantity
              </h2>
              <p className="mt-2 text-sm text-muted">
                Price per unit, one print location. Buy more, pay less per piece.
              </p>
            </Reveal>
            <Reveal delay={0.06} className="mt-6 overflow-hidden rounded-2xl bg-canvas">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-950/10">
                    <th className="px-5 py-3 font-semibold text-ink-900">Quantity</th>
                    <th className="px-5 py-3 font-semibold text-ink-900">Price per unit</th>
                  </tr>
                </thead>
                <tbody>
                  {p.priceTiers.map((tier) => (
                    <tr key={tier.minQty} className="border-b border-ink-950/5 last:border-0">
                      <td className="px-5 py-3 text-ink-900">
                        {tier.maxQty ? `${tier.minQty}–${tier.maxQty}` : `${tier.minQty}+`}
                      </td>
                      <td className="px-5 py-3 font-semibold text-ink-900">${tier.pricePerUnit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </Container>
        </Section>
      )}

      <FinalCTA />
    </>
  );
}
