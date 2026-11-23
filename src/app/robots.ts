import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

/**
 * Mirrors resolveTaxProvider/resolveShippingProvider's own VERCEL_ENV gate: a plain, testable
 * function that never reads process.env itself. Without this, every Vercel Preview deployment
 * (and any ad-hoc branch deploy) served an "allow everything" robots.txt -- a crawler that found
 * a preview/*.vercel.app URL (e.g. via a shared link or Vercel's own deployment listing) had no
 * signal to stay away, risking that URL getting indexed as duplicate/competing content against
 * the real mapleimprint.ca pages. Only the real Production domain should ever invite crawling.
 */
export function resolveRobotsRules(vercelEnv: string | undefined): MetadataRoute.Robots["rules"] {
  if (vercelEnv !== "production") {
    return { userAgent: "*", disallow: "/" };
  }
  return {
    userAgent: "*",
    allow: "/",
    disallow: ["/cart", "/account", "/account/*", "/api/*"],
  };
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: resolveRobotsRules(process.env.VERCEL_ENV),
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
