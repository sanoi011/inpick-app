import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AD_BANNER_PLACEMENTS } from "@/lib/business-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get("placement") || "";
  if (!AD_BANNER_PLACEMENTS.some((item) => item.value === placement)) {
    return NextResponse.json({ banners: [] });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ banners: [] });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db
    .from("advertising_banners")
    .select("id, title, subtitle, image_url, mobile_image_url, target_url, alt_text, placement, priority, is_featured, starts_at, ends_at, advertising_partners(company_name, status)")
    .eq("placement", placement)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (!/does not exist|schema cache/i.test(error.message)) console.warn("[promotions]", error.message);
    return NextResponse.json({ banners: [] });
  }
  const now = Date.now();
  const banners = (data ?? [])
    .filter((row) => {
      const start = row.starts_at ? new Date(row.starts_at).getTime() : null;
      const end = row.ends_at ? new Date(row.ends_at).getTime() : null;
      return (start == null || start <= now) && (end == null || end > now);
    })
    .filter((row) => {
      const partner = Array.isArray(row.advertising_partners) ? row.advertising_partners[0] : row.advertising_partners;
      return !partner || partner.status === "active";
    })
    .slice(0, 3)
    .map((row) => {
      const partner = Array.isArray(row.advertising_partners) ? row.advertising_partners[0] : row.advertising_partners;
      return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        imageUrl: row.image_url,
        mobileImageUrl: row.mobile_image_url,
        targetUrl: row.target_url,
        altText: row.alt_text,
        isFeatured: row.is_featured,
        partnerName: partner?.company_name ?? null,
      };
    });
  return NextResponse.json({ banners });
}
