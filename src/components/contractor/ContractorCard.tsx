"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Images,
  MapPin,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { PublicContractor } from "@/types/contractor-directory";
import {
  CONTRACTOR_TYPE_COLORS,
  CONTRACTOR_TYPE_LABELS,
} from "@/types/contractor-directory";
import {
  buildContractorEvidence,
  formatContractorRegion,
  getPlacementDisclosure,
} from "@/lib/contractor-experience";

const EVIDENCE_ICONS = {
  verified: ShieldCheck,
  review: MessageCircleMore,
  project: BriefcaseBusiness,
  portfolio: Images,
} as const;

export function ContractorCard({ contractor }: { contractor: PublicContractor }) {
  const placement = getPlacementDisclosure(contractor);
  const evidence = buildContractorEvidence(contractor);

  return (
    <Link
      href={`/find-contractors/${contractor.id}`}
      className="group relative block overflow-hidden rounded-[26px] border border-black/[0.07] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.07)]"
    >
      <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#fff2ed] opacity-0 transition group-hover:opacity-100" />

      <div className="relative flex items-start gap-3">
        {contractor.logoUrl ? (
          <Image
            src={contractor.logoUrl}
            alt={contractor.companyName}
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 rounded-2xl border border-black/[0.06] object-cover"
          />
        ) : (
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-lg font-black text-black/60">
            {contractor.companyName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-black text-black">{contractor.companyName}</h3>
            {contractor.isVerified && (
              <span title="사업자 정보 확인">
                <ShieldCheck className="h-4 w-4 text-[#197455]" />
              </span>
            )}
            {placement && (
              <span
                title={placement.description}
                className="inline-flex items-center gap-1 rounded-full bg-[#fff1ec] px-2 py-1 text-[9px] font-black text-[#b83e2f]"
              >
                <Sparkles className="h-3 w-3" /> {placement.label}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-black/45">
            {contractor.totalReviews > 0 ? (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-[#f6b73c] text-[#f6b73c]" />
                <strong className="text-black/75">{contractor.rating.toFixed(1)}</strong>
                <span>리뷰 {contractor.totalReviews}</span>
              </span>
            ) : (
              <span>리뷰 미등록</span>
            )}
            <span className="h-2.5 w-px bg-black/10" />
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {formatContractorRegion(contractor.region)}
            </span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-black/25 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-black" />
      </div>

      <div className="relative mt-4 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${CONTRACTOR_TYPE_COLORS[contractor.contractorType]}`}>
          {CONTRACTOR_TYPE_LABELS[contractor.contractorType]}
        </span>
        {contractor.trades.slice(0, 3).map((trade) => (
          <span key={trade.code} className="rounded-full bg-[#f5f5f3] px-2.5 py-1 text-[10px] font-bold text-black/55">
            {trade.name}
          </span>
        ))}
        {contractor.trades.length > 3 && (
          <span className="rounded-full bg-[#f5f5f3] px-2.5 py-1 text-[10px] font-bold text-black/35">
            +{contractor.trades.length - 3}
          </span>
        )}
      </div>

      {contractor.introduction && (
        <p className="relative mt-3 line-clamp-2 text-xs leading-5 text-black/48">
          {contractor.introduction}
        </p>
      )}

      {contractor.portfolioThumbnails.length > 0 && (
        <div className="relative mt-4 grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
          {contractor.portfolioThumbnails.slice(0, 3).map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-[4/3] overflow-hidden bg-[#f3f3f1]">
              <Image src={url} alt={`${contractor.companyName} 시공 사례 ${index + 1}`} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" sizes="140px" />
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-4 border-t border-black/[0.06] pt-3">
        {evidence.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {evidence.map((item) => {
              const Icon = EVIDENCE_ICONS[item.kind];
              return (
                <span key={item.kind} className="inline-flex items-center gap-1 text-[10px] font-bold text-black/48">
                  <Icon className="h-3 w-3" /> {item.label}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] leading-4 text-black/35">확인 가능한 리뷰·실적·포트폴리오가 아직 등록되지 않았어요.</p>
        )}
      </div>
    </Link>
  );
}
