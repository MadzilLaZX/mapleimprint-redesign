"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/lib/constants";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-ink-950 pt-16 pb-20 text-white lg:pt-24 lg:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-[560px] w-[560px] rounded-full bg-maple-gradient opacity-20 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[size:28px_28px]"
      />

      <Container className="relative grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="max-w-xl text-5xl font-medium leading-[1.05] tracking-tight text-white md:text-6xl lg:text-[4.2rem]">
            Custom printing, <span className="text-gradient">made clear.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
            Ottawa apparel, workwear, business printing and promotional products. Proofed before we print, priced before you commit.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button href={PRIMARY_CTA.href} tone="dark" showArrow>
              {PRIMARY_CTA.label}
            </Button>
            <Button href={SECONDARY_CTA.href} variant="secondary" tone="dark">
              {SECONDARY_CTA.label}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center lg:max-w-none"
        >
          <div
            aria-hidden
            className="absolute inset-8 rounded-full bg-maple-gradient opacity-30 blur-[90px]"
          />
          <Image
            src="/logo/logo-leaf.png"
            alt=""
            width={436}
            height={432}
            priority
            className="relative z-10 h-auto w-2/3 drop-shadow-[0_30px_60px_rgba(255,106,0,0.35)]"
          />

          <div className="absolute bottom-2 left-0 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md sm:left-4">
            <CheckCircle className="size-6 shrink-0 text-orange" weight="fill" />
            <div className="text-sm leading-snug">
              <p className="font-semibold text-white">Proof approved</p>
              <p className="text-white/55">before production starts</p>
            </div>
          </div>

          <div className="absolute right-0 top-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md sm:right-2">
            <div className="text-sm leading-snug">
              <p className="font-semibold text-white">Ottawa made</p>
              <p className="text-white/55">local pickup available</p>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
