import type { MetadataRoute } from "next";
import { q } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const [branches, units] = await Promise.all([
    q("SELECT slug FROM branches WHERE status <> 'Hidden'"),
    q("SELECT u.slug FROM units u JOIN branches b ON b.id = u.branch_id WHERE u.is_active AND b.status = 'Active'"),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.3 },
    ...branches.map((b) => ({ url: `${base}/b/${b.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...units.map((u) => ({ url: `${base}/u/${u.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
