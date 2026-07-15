"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Megaphone } from "lucide-react";
import type { AdBannerPlacement } from "@/lib/business-center";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  targetUrl: string;
  altText: string | null;
  isFeatured: boolean;
  partnerName: string | null;
};

export default function PromotionalBannerSlot({
  placement,
  className = "",
}: {
  placement: AdBannerPlacement;
  className?: string;
}) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/promotions?placement=${encodeURIComponent(placement)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { banners: [] }))
      .then((data) => setBanner(data.banners?.[0] ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [placement]);

  if (!banner) return null;

  return (
    <aside className={className} aria-label="인픽 파트너 소식">
      <a
        href={banner.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group mx-auto grid max-w-7xl overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] transition hover:border-black/25 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]"
      >
        <div className="flex min-h-[170px] flex-col justify-between p-5 sm:min-h-[190px] sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black/38">
              <Megaphone className="h-3.5 w-3.5" /> Partner
              {banner.isFeatured ? " · Featured" : ""}
            </span>
            <ArrowUpRight className="h-4 w-4 text-black/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black" />
          </div>
          <div className="mt-8">
            <h2 className="text-[22px] font-semibold tracking-[-0.045em] sm:text-[28px]">{banner.title}</h2>
            {banner.subtitle && <p className="mt-2 max-w-2xl text-[12px] leading-5 text-black/48 sm:text-[13px]">{banner.subtitle}</p>}
            {banner.partnerName && <p className="mt-4 text-[10px] font-semibold text-black/35">{banner.partnerName}</p>}
          </div>
        </div>
        {(banner.imageUrl || banner.mobileImageUrl) && (
          <picture className="block min-h-[180px] overflow-hidden bg-[#f3f3f1] sm:min-h-full">
            {banner.mobileImageUrl && <source media="(max-width: 639px)" srcSet={banner.mobileImageUrl} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl || banner.mobileImageUrl || ""} alt={banner.altText || banner.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
          </picture>
        )}
      </a>
    </aside>
  );
}
