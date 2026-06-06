"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass,
  MessageSquare,
  Image as ImageIcon,
  MapPin,
  BookOpen,
  Star,
  ArrowLeft,
  Building2,
} from "lucide-react";
import {
  REGION_LIST,
  MOCK_REGION_CASES,
  RegionCase,
} from "@/types/community";

const TABS = [
  { label: "탐색", href: "/community", icon: Compass },
  { label: "토론", href: "/community/talk", icon: MessageSquare },
  { label: "갤러리", href: "/community/gallery", icon: ImageIcon },
  { label: "지도", href: "/community/map", icon: MapPin },
  { label: "라이브러리", href: "/community/library", icon: BookOpen },
];

export default function CommunityMapPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regionCases: RegionCase[] = selectedRegion
    ? MOCK_REGION_CASES[selectedRegion] ?? []
    : [];
  const regionName =
    REGION_LIST.find((r) => r.id === selectedRegion)?.name ?? "";

  return (
    <div>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold sm:text-3xl">INPICK 커뮤니티</h1>
          <p className="mt-2 text-sm text-violet-200">
            인테리어 영감을 찾고, 경험을 공유하세요
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-white sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => {
              const active = tab.href === "/community/map";
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-violet-600 text-violet-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!selectedRegion ? (
          <>
            <h2 className="mb-2 text-lg font-bold text-gray-900">
              지역별 시공사례
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              지역을 선택하면 해당 지역의 시공사례를 확인할 수 있습니다
            </p>

            {/* Region Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REGION_LIST.map((region) => {
                const hasCases =
                  (MOCK_REGION_CASES[region.id]?.length ?? 0) > 0;
                return (
                  <button
                    key={region.id}
                    onClick={() => setSelectedRegion(region.id)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
                      <MapPin className="h-6 w-6 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {region.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      시공사례 {region.caseCount}건
                    </p>
                    {!hasCases && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                        업데이트 예정
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Back + Region Title */}
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setSelectedRegion(null)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                전체 지역
              </button>
              <span className="text-gray-300">/</span>
              <h2 className="text-lg font-bold text-gray-900">
                {regionName} 시공사례
              </h2>
            </div>

            {regionCases.length === 0 ? (
              <div className="py-20 text-center">
                <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  이 지역의 시공사례가 곧 업데이트됩니다
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  시공사례를 등록하고 싶으시면 커뮤니티에 공유해주세요
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {regionCases.map((c) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div
                      className={`h-36 bg-gradient-to-br ${c.gradient}`}
                    />
                    <div className="p-4">
                      <h4 className="text-sm font-bold text-gray-900">
                        {c.apartmentName}
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {c.area}m²
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {c.style}
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {c.date}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-gray-700">
                          {c.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
