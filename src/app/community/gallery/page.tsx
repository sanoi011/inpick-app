"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  MessageSquare,
  Image as ImageIcon,
  MapPin,
  BookOpen,
  Heart,
  Repeat2,
  Copy,
  Clock,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  STYLE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  MOCK_GALLERY,
  GalleryItem,
} from "@/types/community";

const TABS = [
  { label: "탐색", href: "/community", icon: Compass },
  { label: "토론", href: "/community/talk", icon: MessageSquare },
  { label: "갤러리", href: "/community/gallery", icon: ImageIcon },
  { label: "지도", href: "/community/map", icon: MapPin },
  { label: "라이브러리", href: "/community/library", icon: BookOpen },
];

type SortMode = "latest" | "popular" | "remix";

export default function CommunityGalleryPage() {
  const [styleFilter, setStyleFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result: GalleryItem[] = MOCK_GALLERY;
    if (styleFilter !== "all")
      result = result.filter((g) => g.style === styleFilter);
    if (roomFilter !== "all")
      result = result.filter((g) => g.roomType === roomFilter);
    if (sortMode === "popular") {
      result = [...result].sort((a, b) => b.likes - a.likes);
    } else if (sortMode === "remix") {
      result = [...result].sort((a, b) => b.remixCount - a.remixCount);
    }
    return result;
  }, [styleFilter, roomFilter, sortMode]);

  const handleCopyPrompt = (item: GalleryItem) => {
    navigator.clipboard.writeText(item.prompt);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
              const active = tab.href === "/community/gallery";
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
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-500">스타일:</span>
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyleFilter(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  styleFilter === opt.value
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-500">공간:</span>
            {ROOM_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRoomFilter(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  roomFilter === opt.value
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {(
              [
                { key: "latest", label: "최신순", icon: Clock },
                { key: "popular", label: "인기순", icon: TrendingUp },
                { key: "remix", label: "리믹스순", icon: Repeat2 },
              ] as const
            ).map(({ key, label, icon: SortIcon }) => (
              <button
                key={key}
                onClick={() => setSortMode(key)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortMode === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                <SortIcon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
          <Link
            href="/project/new"
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            AI 디자인 생성
          </Link>
        </div>

        {/* Gallery Grid */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <ImageIcon className="mx-auto h-10 w-10 mb-3" />
            <p className="text-sm">해당하는 디자인이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div
                  className={`relative h-48 bg-gradient-to-br ${item.gradient}`}
                >
                  <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    {STYLE_OPTIONS.find((s) => s.value === item.style)?.label}{" "}
                    /{" "}
                    {ROOM_TYPE_OPTIONS.find((r) => r.value === item.roomType)
                      ?.label}
                  </div>
                </div>

                {/* Prompt */}
                <div className="p-3">
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {item.prompt}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3 w-3" />
                        {item.likes}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Repeat2 className="h-3 w-3" />
                        {item.remixCount}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyPrompt(item)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          copiedId === item.id
                            ? "bg-green-50 text-green-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Copy className="h-3 w-3" />
                        {copiedId === item.id ? "복사됨!" : "프롬프트 복사"}
                      </button>
                      <Link
                        href="/project/new"
                        className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-100 transition-colors"
                      >
                        <Repeat2 className="h-3 w-3" />
                        리믹스
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {item.authorName} &middot; {item.createdAt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
