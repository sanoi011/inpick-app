import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";

export default function WritingBridgePage() {
  const writingAppUrl =
    process.env.NEXT_PUBLIC_WRITING_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:3020"
      : "https://inpick-hankwon.vercel.app");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafaf8] px-5 text-[#111217]">
      <section className="w-full max-w-[760px] rounded-[28px] border border-black/[0.08] bg-white px-7 py-12 text-center shadow-[0_24px_80px_rgba(30,45,75,0.08)] sm:px-14 sm:py-16">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#79a5ff,#2d6cff)] text-white">
          <BookOpen className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2d6cff]">InPick Creative</p>
        <h1 className="mt-4 text-[34px] font-medium tracking-[-0.055em] sm:text-[48px]">AI 글쓰기 서비스 한권</h1>
        <p className="mx-auto mt-5 max-w-xl text-[14px] leading-7 text-black/52">
          한권은 인픽에서 시작하는 독립 서비스입니다. 기억과 상상을 대화로 풀어 한 권의 원고로 완성합니다.
        </p>
        <Link href={writingAppUrl} className="mt-9 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3.5 text-[13px] font-semibold text-white hover:bg-[#2d6cff]">
          한권 열기 <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link href="/" className="mx-auto mt-7 flex w-fit items-center gap-1.5 text-[12px] font-medium text-black/45 hover:text-black">
          <ArrowLeft className="h-4 w-4" /> 인픽 홈으로
        </Link>
      </section>
    </main>
  );
}
