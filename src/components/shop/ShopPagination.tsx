import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { buildShopUrl, type ShopSearchParams } from "@/lib/shopQuery";

function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("ellipsis");
    out.push(sorted[i]);
  }
  return out;
}

export function ShopPagination({
  current,
  totalPages,
  params,
}: {
  current: number;
  totalPages: number;
  params: ShopSearchParams;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Shop pagination" className="mt-10 flex items-center justify-center gap-1.5">
      <Link
        href={buildShopUrl(params, { page: String(Math.max(1, current - 1)) })}
        aria-label="Previous page"
        aria-disabled={current === 1}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-sand transition-colors",
          current === 1 ? "pointer-events-none opacity-30" : "hover:border-ink-950/25",
        )}
      >
        <CaretLeft className="size-4" weight="bold" />
      </Link>

      {pageNumbers(current, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-sm text-muted">
            &hellip;
          </span>
        ) : (
          <Link
            key={p}
            href={buildShopUrl(params, { page: String(p) })}
            aria-current={p === current ? "page" : undefined}
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
              p === current ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas",
            )}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        href={buildShopUrl(params, { page: String(Math.min(totalPages, current + 1)) })}
        aria-label="Next page"
        aria-disabled={current === totalPages}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-sand transition-colors",
          current === totalPages ? "pointer-events-none opacity-30" : "hover:border-ink-950/25",
        )}
      >
        <CaretRight className="size-4" weight="bold" />
      </Link>
    </nav>
  );
}
