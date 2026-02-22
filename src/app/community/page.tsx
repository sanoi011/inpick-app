"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  MessageSquare,
  Image as ImageIcon,
  MapPin,
  BookOpen,
  Search,
  Heart,
  Bookmark,
  MessageCircle,
  TrendingUp,
  PenTool,
  Star,
  Layers,
  DollarSign,
  Building2,
  HelpCircle,
} from "lucide-react";
import {
  STYLE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  TRENDING_TAGS,
  MOCK_POSTS,
  BOARD_LIST,
  CommunityPost,
} from "@/types/community";

const TABS = [
  { label: "탐색", href: "/community", icon: Compass },
  { label: "토론", href: "/community/talk", icon: MessageSquare },
  { label: "갤러리", href: "/community/gallery", icon: ImageIcon },
  { label: "지도", href: "/community/map", icon: MapPin },
  { label: "라이브러리", href: "/community/library", icon: BookOpen },
];

const BOARD_ICONS: Record<string, { icon: typeof Compass; color: string; bg: string }> = {
  free: { icon: PenTool, color: "text-blue-600", bg: "bg-blue-50" },
  review: { icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
  material: { icon: Layers, color: "text-emerald-600", bg: "bg-emerald-50" },
  price: { icon: DollarSign, color: "text-rose-600", bg: "bg-rose-50" },
  contractor: { icon: Building2, color: "text-violet-600", bg: "bg-violet-50" },
  question: { icon: HelpCircle, color: "text-indigo-600", bg: "bg-indigo-50" },
};

const TOP_POSTS = MOCK_POSTS.slice()
  .sort((a, b) => b.likes - a.likes)
  .slice(0, 5);

export default function CommunityExplorePage() {
  const [styleFilter, setStyleFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result: CommunityPost[] = MOCK_POSTS;
    if (styleFilter !== "all")
      result = result.filter((p) => p.style === styleFilter);
    if (roomFilter !== "all")
      result = result.filter((p) => p.roomType === roomFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [styleFilter, roomFilter, searchQuery]);

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

      {/* Category Cards Grid */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {BOARD_LIST.map((board) => {
              const meta = BOARD_ICONS[board.slug] || { icon: MessageSquare, color: "text-gray-600", bg: "bg-gray-50" };
              const Icon = meta.icon;
              return (
                <Link
                  key={board.slug}
                  href={`/community/talk?board=${board.slug}`}
                  className={`flex flex-col items-center gap-1.5 rounded-xl ${meta.bg} p-3 sm:p-4 transition-all hover:scale-105 hover:shadow-md`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-900">{board.name}</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">{board.threadCount.toLocaleString()}개 글</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-white sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1.5 overflow-x-auto scrollbar-hide py-2">
            {TABS.map((tab) => {
              const active = tab.href === "/community";
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-white" : ""}`} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="인테리어 영감을 검색해보세요..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold text-gray-500 mr-1">스타일</span>
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyleFilter(opt.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  styleFilter === opt.value
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold text-gray-500 mr-1">공간</span>
            {ROOM_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRoomFilter(opt.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  roomFilter === opt.value
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trending Tags */}
        <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
          <TrendingUp className="h-4 w-4 flex-shrink-0 text-orange-500 mt-1" />
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="flex-shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Masonry Grid */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <Search className="mx-auto h-10 w-10 mb-3" />
                <p className="text-sm">검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
                {filtered.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar (desktop only) */}
          <aside className="hidden w-72 flex-shrink-0 lg:block">
            <div className="sticky top-16 space-y-6">
              {/* Top Posts */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-900">
                  인기 게시물 TOP 5
                </h3>
                <div className="space-y-3">
                  {TOP_POSTS.map((post, idx) => (
                    <div key={post.id} className="flex items-start gap-2">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {post.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          <Heart className="mr-1 inline h-3 w-3" />
                          {post.likes}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Challenge */}
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white">
                <p className="text-xs font-medium text-violet-200">
                  주간 챌린지
                </p>
                <p className="mt-1 text-sm font-bold">
                  #나의_욕실_변신 챌린지
                </p>
                <p className="mt-2 text-xs text-violet-200">
                  욕실 리모델링 전후 사진을 공유해주세요!
                </p>
                <Link
                  href="/project/new"
                  className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30 transition-colors"
                >
                  참여하기
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  // Vary card height based on post id for masonry effect
  const heights = ["h-48", "h-56", "h-64", "h-44", "h-52"];
  const idx = parseInt(post.id.replace("p", "")) - 1;
  const h = heights[idx % heights.length];

  return (
    <div className="mb-4 break-inside-avoid group">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Image placeholder */}
        <div
          className={`relative bg-gradient-to-br ${post.gradient} ${h} w-full`}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/40 transition-opacity group-hover:opacity-100">
            <button className="rounded-full bg-white p-2 shadow-lg">
              <Bookmark className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">
            {post.title}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>{post.authorName}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Heart className="h-3 w-3" />
                {post.likes}
              </span>
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                {post.comments}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
