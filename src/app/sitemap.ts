import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { PRODUCT_CATEGORIES, SOLUTIONS } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/products",
    "/solutions",
    "/how-it-works",
    "/our-work",
    "/print-methods",
    "/resources",
    "/resources/artwork-guidelines",
    "/resources/sizing-guide",
    "/resources/turnaround-delivery",
    "/about",
    "/contact",
  ];

  const categoryRoutes = PRODUCT_CATEGORIES.map((c) => `/products/${c.slug}`);
  const solutionRoutes = SOLUTIONS.map((s) => `/solutions/${s.slug}`);

  const now = new Date();

  return [...staticRoutes, ...categoryRoutes, ...solutionRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.split("/").length <= 2 ? 0.8 : 0.6,
  }));
}
