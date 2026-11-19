import type { MetadataRoute } from "next";
import { PRIVATE_DISALLOW, siteBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_DISALLOW }], sitemap: `${siteBase()}/sitemap.xml` };
}
