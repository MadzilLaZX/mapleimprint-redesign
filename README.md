# Maple Imprint — Website Rebuild

A premium, from-scratch redesign of [mapleimprint.ca](https://mapleimprint.ca), an Ottawa
custom-printing business. Built with Next.js, TypeScript, Tailwind CSS v4 and Framer Motion.

See [`PROJECT_NOTES.md`](./PROJECT_NOTES.md) for what's real, what's placeholder, the
accessibility/contrast decisions made, and what's needed before this can launch.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint

## Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Styling:** Tailwind CSS v4, design tokens in `src/app/globals.css`
- **Motion:** Framer Motion, respecting `prefers-reduced-motion`
- **Icons:** Phosphor Icons
- **Fonts:** Bricolage Grotesque (display) + Manrope (body), via `next/font`

## Structure

```
src/
  app/                  Routes (App Router)
  components/
    ui/                 Shared primitives (Button, Section, Field, Accordion, Reveal…)
    layout/             Header, Footer
    home/               Homepage sections
    contact/            Quote wizard + contact form
    policy/             Policy page shell
  lib/                  Static content: categories, solutions, FAQ, print methods
scripts/                Dev-only tooling (logo processing, OG image generation) — not shipped
brand-assets/source/    Original client-provided logo rasters, kept for provenance
```

## Brand

- Served logos live in `public/logo/` (`logo-lockup.png`, `logo-leaf.png`, and generated
  favicon sizes). These are cleaned, transparent PNGs derived from the client-provided rasters
  in `brand-assets/source/`, via `scripts/make-transparent-logo.js` and
  `scripts/process-logo-variants.js`.
- Color tokens, the signature maple gradient, and motion rules live in
  `src/app/globals.css` under `@theme`.
