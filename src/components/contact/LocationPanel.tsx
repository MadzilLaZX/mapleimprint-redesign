"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Clock,
  EnvelopeSimple,
  MapPinLine,
  MapTrifold,
  NavigationArrow,
  Phone,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from "@/lib/constants";

const query = encodeURIComponent(BUSINESS_ADDRESS_ONE_LINE);

const mapLinks = [
  {
    label: "Google Maps",
    href: `https://www.google.com/maps/search/?api=1&query=${query}`,
  },
  {
    label: "Waze",
    href: `https://waze.com/ul?q=${query}&navigate=yes`,
  },
  {
    label: "Apple Maps",
    href: `https://maps.apple.com/?q=${query}`,
  },
];

export function LocationPanel() {
  const [showMap, setShowMap] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="rounded-[28px] bg-white p-6 lg:p-10">
      <h2 className="font-display text-xl font-semibold text-ink-900">Visit us in Ottawa</h2>
      <p className="mt-1.5 text-sm text-muted">Come by the shop, or get directions from wherever you are.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <MapPinLine className="mt-0.5 size-5 shrink-0 text-crimson" />
          <div className="text-sm">
            <p className="font-semibold text-ink-900">Address</p>
            <p className="mt-1 text-muted">
              {BUSINESS.addressLine1}, {BUSINESS.addressLine2}
              <br />
              {BUSINESS.city}, {BUSINESS.region} {BUSINESS.postalCode}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-crimson" />
          <div className="text-sm">
            <p className="font-semibold text-ink-900">Hours</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {BUSINESS.hours.map((h) => (
                <li key={h.days}>
                  {h.days}: {h.time}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 size-5 shrink-0 text-crimson" />
          <div className="text-sm">
            <p className="font-semibold text-ink-900">Phone</p>
            <a href={BUSINESS.phoneHref} className="mt-1 block text-muted hover:text-ink-900">
              {BUSINESS.phoneDisplay}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <EnvelopeSimple className="mt-0.5 size-5 shrink-0 text-crimson" />
          <div className="text-sm">
            <p className="font-semibold text-ink-900">Email</p>
            <a href={`mailto:${BUSINESS.email}`} className="mt-1 block text-muted hover:text-ink-900">
              {BUSINESS.email}
            </a>
          </div>
        </div>
      </div>

      {!showMap ? (
        <Button onClick={() => setShowMap(true)} className="mt-8" showArrow>
          View map &amp; directions
        </Button>
      ) : (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <div className="overflow-hidden rounded-2xl border border-sand">
            <iframe
              title="Map to Maple Imprint Ltd."
              src={`https://www.google.com/maps?q=${query}&output=embed`}
              width="100%"
              height="320"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block"
            />
          </div>

          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <NavigationArrow className="size-4 text-crimson" weight="fill" />
              Get directions with
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {mapLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-ink-950/15 px-4 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-950/5"
                >
                  <MapTrifold className="size-4 text-crimson" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
