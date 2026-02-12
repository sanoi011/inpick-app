import { MetadataRoute } from "next";

const BASE_URL = "https://inpick-app.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = [
    "",
    "/auth",
    "/projects",
    "/contracts",
    "/consult",
    "/viewer",
  ];

  const contractorPages = [
    "/contractor/login",
    "/contractor/register",
    "/contractor",
    "/contractor/bids",
    "/contractor/projects",
    "/contractor/ai",
    "/contractor/matching",
    "/contractor/schedule",
    "/contractor/finance",
    "/contractor/profile",
  ];

  return [
    ...staticPages.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1.0 : 0.8,
    })),
    ...contractorPages.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
