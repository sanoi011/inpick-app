"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Shield, MapPin, Crown } from "lucide-react";
import type { PublicContractor } from "@/types/contractor-directory";
import { CONTRACTOR_TYPE_LABELS, CONTRACTOR_TYPE_COLORS } from "@/types/contractor-directory";

export function ContractorCard({ contractor }: { contractor: PublicContractor }) {
  const isPremium = contractor.isFeatured || contractor.subscriptionTier === "premium" || contractor.subscriptionTier === "enterprise";

  return (
    <Link
      href={`/find-contractors/${contractor.id}`}
      className={`block bg-white border rounded-xl p-5 transition-all hover:shadow-md ${
        isPremium ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-200 hover:border-blue-300"
      }`}
    >
      {/* 상단: 로고 + 기본 정보 */}
      <div className="flex items-start gap-3 mb-3">
        {contractor.logoUrl ? (
          <Image
            src={contractor.logoUrl}
            alt={contractor.companyName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg flex-shrink-0">
            {contractor.companyName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-900 truncate">{contractor.companyName}</h3>
            {contractor.isVerified && (
              <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            )}
            {isPremium && (
              <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-0.5 text-xs">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-900">{contractor.rating.toFixed(1)}</span>
              <span className="text-gray-400">({contractor.totalReviews})</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-0.5 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {contractor.region || "전국"}
            </span>
          </div>
        </div>
      </div>

      {/* 업체 유형 + 공종 */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
          CONTRACTOR_TYPE_COLORS[contractor.contractorType]
        }`}>
          {CONTRACTOR_TYPE_LABELS[contractor.contractorType]}
        </span>
        {contractor.trades.slice(0, 3).map((t) => (
          <span
            key={t.code}
            className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
          >
            {t.name}
          </span>
        ))}
        {contractor.trades.length > 3 && (
          <span className="px-1.5 py-0.5 rounded text-xs text-gray-400">
            +{contractor.trades.length - 3}
          </span>
        )}
      </div>

      {/* 소개 */}
      {contractor.introduction && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {contractor.introduction}
        </p>
      )}

      {/* 포트폴리오 썸네일 */}
      {contractor.portfolioThumbnails.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {contractor.portfolioThumbnails.slice(0, 3).map((url, i) => (
            <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
              <Image src={url} alt="" fill className="object-cover" sizes="64px" />
            </div>
          ))}
        </div>
      )}

      {/* 하단 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          시공 {contractor.completedProjects}건
        </span>
        <span className="text-xs font-medium text-blue-600">
          상세보기 &rarr;
        </span>
      </div>
    </Link>
  );
}
