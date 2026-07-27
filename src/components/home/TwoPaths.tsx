import { Package, Truck } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/lib/constants";

const paths = [
  {
    icon: Package,
    title: "Customize & buy",
    description:
      "For standard products with predictable decoration. Pick, personalize and check out in one visit.",
    steps: [
      "Select product, colour and size",
      "Customize or upload your artwork",
      "See total price and delivery estimate",
      "Checkout as a guest, no account needed",
    ],
    cta: PRIMARY_CTA,
    dark: false,
  },
  {
    icon: Truck,
    title: "Plan a bulk order",
    description:
      "For embroidery, mixed garments, rush jobs and corporate packages that need a scoped quote.",
    steps: [
      "Describe the project and quantities",
      "Upload files or request design help",
      "Approve a scoped quote and digital proof",
      "Pay and track production to delivery",
    ],
    cta: SECONDARY_CTA,
    dark: true,
  },
];

export function TwoPaths() {
  return (
    <section className="bg-white py-20 md:py-28 lg:py-32">
      <Container>
        <Reveal className="max-w-xl">
          <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
            Two paths, chosen for the job
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Not every order is the same size. We keep the simple ones simple, and give the complex ones a real project workflow.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {paths.map(({ icon: Icon, title, description, steps, cta, dark }) => (
            <Reveal key={title}>
              <div
                className={`flex h-full flex-col rounded-[28px] p-8 lg:p-10 ${
                  dark ? "bg-ink-950 text-white" : "bg-canvas text-ink-900"
                }`}
              >
                <span
                  className={`inline-flex size-12 items-center justify-center rounded-2xl ${
                    dark ? "bg-white/10" : "bg-white"
                  }`}
                >
                  <Icon className={`size-6 ${dark ? "text-orange" : "text-crimson"}`} weight="duotone" />
                </span>
                <h3 className="mt-6 font-display text-2xl font-semibold">{title}</h3>
                <p className={`mt-3 max-w-md text-sm leading-relaxed ${dark ? "text-white/65" : "text-muted"}`}>
                  {description}
                </p>
                <ol className="mt-7 flex-1 space-y-3">
                  {steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                          dark ? "bg-white/10 text-white" : "bg-white text-ink-900"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={dark ? "text-white/80" : "text-ink-900/80"}>{step}</span>
                    </li>
                  ))}
                </ol>
                <Button href={cta.href} tone={dark ? "dark" : "light"} className="mt-8 self-start" showArrow>
                  {cta.label}
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
