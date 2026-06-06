"use client";

/**
 * CommunityShell — 3단 레이아웃 (좌: 게시판 / 중: 메인 / 우: 패널)
 * ChatGPT 풍 neutral 톤: bg #F7F7F5, card #FFF, border #E5E2DD, text #202123
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, PenSquare, ChevronLeft, ChevronRight } from "lucide-react";
import type { CommunityBoardV2 } from "@/types/community-v2";

interface Props {
  children: React.ReactNode;
}

export default function CommunityShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [boards, setBoards] = useState<CommunityBoardV2[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/community/boards")
      .then((r) => r.json())
      .then((d) => setBoards(d.boards ?? []))
      .catch(() => {});
  }, []);

  const activeSlug = pathname?.startsWith("/community/boards/")
    ? pathname.split("/")[3]
    : null;

  // 게시판을 소비자/사업자 2그룹으로 구분 (공지는 공통, 상단)
  const BUSINESS_SLUGS = new Set(["pro-lounge", "pro-knowhow", "pro-materials", "pro-jobs"]);
  const NOTICE_SLUGS = new Set(["notice"]);
  const noticeBoards = boards.filter((b) => NOTICE_SLUGS.has(b.slug));
  const businessBoards = boards.filter((b) => BUSINESS_SLUGS.has(b.slug));
  const consumerBoards = boards.filter(
    (b) => !BUSINESS_SLUGS.has(b.slug) && !NOTICE_SLUGS.has(b.slug)
  );

  const linkCls = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm transition ${
      active
        ? "bg-[#F0EFEC] text-[#202123] font-semibold"
        : "text-[#3F3F46] hover:bg-[#F0EFEC]"
    }`;
  const groupLabelCls =
    "mt-3 px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-[#9A9A9A]";

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:py-8">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr_280px]">
        {/* 좌측: 게시판 사이드바 */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-[#E5E2DD] bg-white p-3">
              <div className="mb-2 px-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                게시판
              </div>
              <nav className="space-y-0.5">
                <Link href="/community" className={linkCls(pathname === "/community")}>
                  전체
                </Link>
                {noticeBoards.map((b) => (
                  <Link key={b.id} href={`/community/boards/${b.slug}`} className={linkCls(activeSlug === b.slug)}>
                    {b.name}
                  </Link>
                ))}

                {consumerBoards.length > 0 && (
                  <>
                    <div className={groupLabelCls}>소비자 게시판</div>
                    {consumerBoards.map((b) => (
                      <Link key={b.id} href={`/community/boards/${b.slug}`} className={linkCls(activeSlug === b.slug)}>
                        {b.name}
                      </Link>
                    ))}
                  </>
                )}

                {businessBoards.length > 0 && (
                  <>
                    <div className={groupLabelCls}>사업자 게시판</div>
                    {businessBoards.map((b) => (
                      <Link key={b.id} href={`/community/boards/${b.slug}`} className={linkCls(activeSlug === b.slug)}>
                        {b.name}
                      </Link>
                    ))}
                  </>
                )}
              </nav>
            </div>

            <Link
              href="/community/write"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#202123] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3F3F46]"
            >
              <PenSquare className="h-4 w-4" />
              글쓰기
            </Link>
          </div>
        </aside>

        {/* 중앙: 메인 */}
        <div className="min-w-0">
          {/* 좌측 상단 뒤로/앞으로 네비게이션 */}
          <div className="mb-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="뒤로 가기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E2DD] bg-white text-[#3F3F46] transition hover:bg-[#F0EFEC]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => window.history.forward()}
              aria-label="앞으로 가기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E2DD] bg-white text-[#3F3F46] transition hover:bg-[#F0EFEC]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* 검색 + 모바일 글쓰기 */}
          <div className="mb-5 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-[#E5E2DD] bg-white px-4 py-2.5">
              <Search className="h-4 w-4 text-[#6B6B6B]" />
              <input
                type="search"
                placeholder="제목, 내용, 태그 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    window.location.href = `/community?q=${encodeURIComponent(search.trim())}`;
                  }
                }}
                className="w-full bg-transparent text-sm text-[#202123] placeholder:text-[#9A9A9A] focus:outline-none"
              />
            </div>
            <Link
              href="/community/write"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#202123] px-4 py-2.5 text-sm font-semibold text-white lg:hidden"
            >
              <PenSquare className="h-4 w-4" />
              글쓰기
            </Link>
          </div>

          {/* 모바일 게시판 chip — 소비자/사업자 그룹 라벨 포함 */}
          <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {(() => {
              const chipCls = (active: boolean) =>
                `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                  active
                    ? "border-[#202123] bg-[#202123] text-white"
                    : "border-[#E5E2DD] bg-white text-[#3F3F46]"
                }`;
              const grpCls =
                "whitespace-nowrap pl-2 pr-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#9A9A9A]";
              return (
                <>
                  <Link href="/community" className={chipCls(pathname === "/community")}>
                    전체
                  </Link>
                  {noticeBoards.map((b) => (
                    <Link key={b.id} href={`/community/boards/${b.slug}`} className={chipCls(activeSlug === b.slug)}>
                      {b.name}
                    </Link>
                  ))}
                  {consumerBoards.length > 0 && <span className={grpCls}>소비자</span>}
                  {consumerBoards.map((b) => (
                    <Link key={b.id} href={`/community/boards/${b.slug}`} className={chipCls(activeSlug === b.slug)}>
                      {b.name}
                    </Link>
                  ))}
                  {businessBoards.length > 0 && <span className={grpCls}>사업자</span>}
                  {businessBoards.map((b) => (
                    <Link key={b.id} href={`/community/boards/${b.slug}`} className={chipCls(activeSlug === b.slug)}>
                      {b.name}
                    </Link>
                  ))}
                </>
              );
            })()}
          </div>

          {children}
        </div>

        {/* 우측: 패널 */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-[#E5E2DD] bg-white p-4 text-[0.75rem] text-[#3F3F46]">
              <p className="mb-2 font-semibold text-[#202123]">개인정보 보호 안내</p>
              <ul className="space-y-1 text-[0.7rem] leading-relaxed text-[#6B6B6B]">
                <li>· 견적 공유 시 정확한 주소·동/호수·연락처는 자동으로 가려집니다.</li>
                <li>· 도면 원본 URL과 결제·계약 정보는 절대 공개되지 않습니다.</li>
                <li>· 본문에 입력된 전화번호·이메일은 자동 마스킹됩니다.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E5E2DD] bg-white p-4 text-[0.75rem] text-[#3F3F46]">
              <p className="mb-2 font-semibold text-[#202123]">검증 사업자 안내</p>
              <p className="text-[0.7rem] leading-relaxed text-[#6B6B6B]">
                INPICK 검증 사업자는 공개 견적 의견·범위 제안을 남길 수 있습니다. 정식 시공
                계약은 RFQ 전환 후 진행됩니다.
              </p>
            </div>

            <Link
              href="/find-contractors"
              className="block rounded-2xl border border-[#E5E2DD] bg-white p-4 text-[0.75rem] text-[#3F3F46] transition hover:bg-[#F0EFEC]"
            >
              <p className="font-semibold text-[#202123]">업체 디렉토리 →</p>
              <p className="mt-1 text-[0.7rem] text-[#6B6B6B]">
                검증된 인테리어 업체를 직접 찾아보세요
              </p>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
