import { Compass, HandHeart, MapPinLine, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const items = [
  {
    icon: MapPinLine,
    label: "Ottawa production",
    detail: "Made and finished locally, with pickup on site.",
  },
  {
    icon: ShieldCheck,
    label: "Proof before print",
    detail: "Nothing goes to production until you approve it.",
  },
  {
    icon: Compass,
    label: "Two clear paths",
    detail: "Instant customization or a guided project quote.",
  },
  {
    icon: HandHeart,
    label: "Real people, real answers",
    detail: "Ottawa staff you can call, not a ticket queue.",
  },
];

export function TrustStrip() {
  return (
    <section className="border-b border-sand bg-white">
      <Container>
        <Reveal>
          <div className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-sand lg:py-14">
            {items.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-start gap-3 lg:px-6 lg:first:pl-0">
                <Icon className="mt-0.5 size-6 shrink-0 text-crimson" weight="duotone" />
                <div>
                  <p className="font-display text-base font-semibold text-ink-900">{label}</p>
                  <p className="mt-1 text-sm leading-snug text-muted">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
