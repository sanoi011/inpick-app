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
  Copy,
  Sparkles,
  Bookmark,
  FolderPlus,
} from "lucide-react";
import {
  MOCK_PROMPTS,
  MOCK_COLLECTIONS,
  PromptTemplate,
  CollectionBoard,
} from "@/types/community";

const TABS = [
  { label: "탐색", href: "/community", icon: Compass },
  { label: "토론", href: "/community/talk", icon: MessageSquare },
  { label: "갤러리", href: "/community/gallery", icon: ImageIcon },
  { label: "지도", href: "/community/map", icon: MapPin },
  { label: "라이브러리", href: "/community/library", icon: BookOpen },
];

const CATEGORIES = ["전체", "거실", "주방", "욕실", "안방", "현관"];

export default function CommunityLibraryPage() {
  const [category, setCategory] = useState("전체");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredPrompts =
    category === "전체"
      ? MOCK_PROMPTS
      : MOCK_PROMPTS.filter((p) => p.category === category);

  const handleCopy = (p: PromptTemplate) => {
    navigator.clipboard.writeText(p.prompt);
    setCopiedId(p.id);
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
              const active = tab.href === "/community/library";
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
        {/* Section 1: Prompt Templates */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              프롬프트 템플릿
            </h2>
            <p className="text-xs text-gray-400">
              AI 디자인에 바로 활용할 수 있는 프롬프트
            </p>
          </div>

          {/* Category filter */}
          <div className="mb-4 flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredPrompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                copied={copiedId === p.id}
                onCopy={() => handleCopy(p)}
              />
            ))}
          </div>
        </section>

        {/* Section 2: Popular Collections */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">인기 컬렉션</h2>
            <p className="text-xs text-gray-400">
              다른 사용자들이 모은 인테리어 보드
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_COLLECTIONS.map((col) => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        </section>

        {/* Section 3: My Boards (empty state) */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-gray-900">내 보드</h2>
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
            <FolderPlus className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">
              아직 보드가 없습니다
            </p>
            <p className="mt-1 text-xs text-gray-400">
              로그인 후 마음에 드는 디자인을 보드에 저장해보세요
            </p>
            <Link
              href="/auth"
              className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            >
              로그인하고 첫 보드 만들기
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  copied,
  onCopy,
}: {
  prompt: PromptTemplate;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
          {prompt.category}
        </span>
        <div className="flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-medium text-gray-600">
            {prompt.rating}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-bold text-gray-900">{prompt.title}</h3>
      <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-3">
        {prompt.prompt}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {prompt.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          >
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-xs text-gray-400">
          {prompt.useCount.toLocaleString()}회 사용
        </span>
        <div className="flex gap-1">
          <button
            onClick={onCopy}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              copied
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Copy className="h-3 w-3" />
            {copied ? "복사됨!" : "복사"}
          </button>
          <Link
            href="/project/new"
            className="flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-100 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            사용
          </Link>
        </div>
      </div>
    </div>
  );
}

function CollectionCard({ collection }: { collection: CollectionBoard }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* 4-image thumbnail grid */}
      <div className="grid grid-cols-2 gap-0.5">
        {collection.gradients.map((g, i) => (
          <div key={i} className={`h-20 bg-gradient-to-br ${g}`} />
        ))}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-gray-900">{collection.name}</h3>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
          <span>{collection.authorName}</span>
          <span className="flex items-center gap-0.5">
            <Bookmark className="h-3 w-3" />
            {collection.saveCount}
          </span>
        </div>
      </div>
    </div>
  );
}
