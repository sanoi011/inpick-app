"use client";

import Link from "next/link";
import { Building2, ChevronDown } from "lucide-react";
import { BUSINESS_MENU_ITEMS } from "@/lib/business-center";

export default function BusinessDropdown({ dark = false }: { dark?: boolean }) {
  return (
    <div className="group relative">
      <Link
        href="/business"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold tracking-tight transition-colors ${
          dark ? "text-offwhite/85 hover:bg-offwhite/10 hover:text-offwhite" : "text-black/75 hover:bg-black/5 hover:text-black"
        }`}
      >
        비즈니스 <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-full z-[120] w-[360px] -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white p-2 shadow-[0_22px_70px_rgba(0,0,0,0.14)]">
          <Link href="/business" className="mb-1 flex items-center gap-3 rounded-2xl bg-black px-4 py-3.5 text-white transition hover:bg-black/80">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/12"><Building2 className="h-4 w-4" /></span>
            <span><span className="block text-sm font-bold">비즈니스 문의</span><span className="mt-0.5 block text-[11px] text-white/55">제품 납품·제조·시공 협력 신청</span></span>
          </Link>
          <div className="grid grid-cols-2 gap-1">
            {BUSINESS_MENU_ITEMS.slice(1).map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl px-3 py-3 transition hover:bg-[#f5f5f3]">
                <span className="block text-[12px] font-bold text-black">{item.label}</span>
                <span className="mt-1 block text-[10px] leading-4 text-black/42">{item.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
