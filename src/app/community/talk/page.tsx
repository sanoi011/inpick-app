"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  MessageSquare,
  Image as ImageIcon,
  MapPin,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Clock,
  TrendingUp,
  PenSquare,
  User,
} from "lucide-react";
import {
  BOARD_LIST,
  MOCK_THREADS,
  DiscussionThread,
} from "@/types/community";

const TABS = [
  { label: "탐색", href: "/community", icon: Compass },
  { label: "토론", href: "/community/talk", icon: MessageSquare },
  { label: "갤러리", href: "/community/gallery", icon: ImageIcon },
  { label: "지도", href: "/community/map", icon: MapPin },
  { label: "라이브러리", href: "/community/library", icon: BookOpen },
];

type SortMode = "latest" | "popular";

export default function CommunityTalkPage() {
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const threads = useMemo(() => {
    let result: DiscussionThread[] = MOCK_THREADS;
    if (selectedBoard !== "all") {
      result = result.filter((t) => t.boardSlug === selectedBoard);
    }
    if (sortMode === "popular") {
      result = [...result].sort(
        (a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes)
      );
    }
    return result;
  }, [selectedBoard, sortMode]);

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
              const active = tab.href === "/community/talk";
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
        <div className="flex gap-6">
          {/* Board List (left sidebar) */}
          <aside className="hidden w-56 flex-shrink-0 md:block">
            <div className="sticky top-16 rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                게시판
              </h3>
              <button
                onClick={() => setSelectedBoard("all")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedBoard === "all"
                    ? "bg-violet-50 font-medium text-violet-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                전체 게시판
              </button>
              {BOARD_LIST.map((board) => (
                <button
                  key={board.slug}
                  onClick={() => setSelectedBoard(board.slug)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedBoard === board.slug
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{board.name}</span>
                  <span className="ml-1 text-xs text-gray-400">
                    ({board.threadCount.toLocaleString()})
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* Thread List */}
          <div className="flex-1">
            {/* Mobile board selector */}
            <div className="mb-4 md:hidden">
              <select
                value={selectedBoard}
                onChange={(e) => setSelectedBoard(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">전체 게시판</option>
                {BOARD_LIST.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name} ({b.threadCount.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Header: sort + write */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                <button
                  onClick={() => setSortMode("latest")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "latest"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  최신순
                </button>
                <button
                  onClick={() => setSortMode("popular")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "popular"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                  인기순
                </button>
              </div>
              <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
                <PenSquare className="h-4 w-4" />
                글쓰기
              </button>
            </div>

            {/* Threads */}
            <div className="space-y-2">
              {threads.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <MessageSquare className="mx-auto h-10 w-10 mb-3" />
                  <p className="text-sm">게시글이 없습니다</p>
                </div>
              ) : (
                threads.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: DiscussionThread }) {
  const boardName =
    BOARD_LIST.find((b) => b.slug === thread.boardSlug)?.name ?? thread.boardSlug;
  const net = thread.upvotes - thread.downvotes;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Vote */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <ThumbsUp className="h-4 w-4 text-gray-400 hover:text-violet-500 cursor-pointer" />
          <span
            className={`text-xs font-bold ${net > 0 ? "text-violet-600" : "text-gray-400"}`}
          >
            {net}
          </span>
          <ThumbsDown className="h-4 w-4 text-gray-400 hover:text-red-400 cursor-pointer" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              {boardName}
            </span>
            {thread.isAnonymous && (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-600">
                익명
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
            {thread.title}
          </h4>
          <p className="mt-1 text-xs text-gray-400 line-clamp-1">
            {thread.content}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-0.5">
              <User className="h-3 w-3" />
              {thread.isAnonymous ? "익명" : thread.authorName}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {thread.commentCount}
            </span>
            <span>{thread.createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
