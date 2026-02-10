"use client";

import Link from "next/link";

const menuItems = [
  { label: "내 프로필", href: "/mypage/profile", icon: "👤" },
  { label: "좋아요한 포트폴리오", href: "/mypage/likes", icon: "❤️" },
  { label: "내 게시글", href: "/mypage/posts", icon: "📝" },
  { label: "상담 내역", href: "/mypage/consultations", icon: "💬" },
  { label: "설정", href: "/mypage/settings", icon: "⚙️" },
];

export default function MyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Section */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-neutral-200 rounded-full flex items-center justify-center">
            <span className="text-neutral-400 text-sm">프로필</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              로그인이 필요합니다
            </h1>
            <p className="text-neutral-500 mt-1">
              로그인하여 INPICK의 모든 기능을 이용하세요
            </p>
            <Link
              href="/auth"
              className="inline-block mt-3 text-primary-600 font-medium hover:text-primary-700"
            >
              로그인하기 &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium text-neutral-700">{item.label}</span>
            <span className="ml-auto text-neutral-400">&rsaquo;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
