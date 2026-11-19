import type { MetadataRoute } from "next";
import { publicPaths, siteBase } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase();
  return publicPaths().map((p) => ({ url: `${base}${p === "/" ? "" : p}` }));
}
