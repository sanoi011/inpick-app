import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Columns3,
  SearchCheck,
  Send,
} from "lucide-react";
import { getConnectionJourney } from "@/lib/contractor-experience";

const ICONS = [ClipboardList, SearchCheck, Send, Columns3] as const;

export function ContractorConnectionJourney() {
  const steps = getConnectionJourney();

  return (
    <section className="overflow-hidden rounded-[30px] border border-black/[0.07] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.05)]">
      <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative overflow-hidden border-b border-black/[0.06] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <span className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#ffe4dc]" />
          <span className="absolute right-14 top-14 h-10 w-10 rotate-12 rounded-xl bg-[#e9e4ff]" />
          <div className="relative">
            <p className="text-[10px] font-black tracking-[0.16em] text-[#f15b4a]">ONE BRIEF, FAIR COMPARE</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-black sm:text-3xl">
              업체를 고르기 전에<br />조건부터 같은 언어로
            </h2>
            <p className="mt-3 max-w-md break-keep text-sm leading-6 text-black/50">
              Step 1~3에서 정리한 공간·디자인·실제 SKU·견적을 같은 조건으로 전달하면 총액만이 아닌 범위와 자재를 비교할 수 있어요.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/workflow" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black/80">
                프로젝트 먼저 정리 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/workflow/bidding" className="inline-flex items-center gap-2 rounded-full border border-black/[0.1] bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:border-black/30">
                동일 조건 입찰 보기
              </Link>
            </div>
          </div>
        </div>

        <ol className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {steps.map((step, index) => {
            const Icon = ICONS[index] || ClipboardList;
            const tones = ["bg-[#fff1ec]", "bg-[#f0edff]", "bg-[#eaf8f1]", "bg-[#fff8db]"];
            return (
              <li key={step.id} className="group rounded-[22px] border border-black/[0.06] p-4 transition hover:-translate-y-0.5 hover:border-black/15">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones[index]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.12em] text-black/30">0{index + 1}</p>
                    <h3 className="mt-1 text-sm font-black">{step.title}</h3>
                    <p className="mt-1 break-keep text-xs leading-5 text-black/48">{step.description}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
