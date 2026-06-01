"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

const FOOTER_COLS = [
  { title: "시작하기", links: ["무료 견적", "샘플 견적", "AR 체험", "토큰 안내"] },
  { title: "둘러보기", links: ["AI 디자인 갤러리", "표준 단가표", "표준 계약서", "고객 사례"] },
  { title: "회사", links: ["About", "Careers", "Press Kit", "Contact"] },
  { title: "법적", links: ["이용약관", "개인정보처리방침", "표준 단가 출처", "라이선스"] },
];

export default function FinalCtaV4() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const glowScale = useTransform(scrollYProgress, [0, 1], [0.6, 1.1]);

  return (
    <section
      id="final"
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-burgundy text-offwhite"
    >
      <motion.div
        style={{ scale: glowScale, x: "-50%" }}
        className="pointer-events-none absolute left-1/2 top-[10%] h-[1100px] w-[1100px] rounded-full"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(247,59,32,0.55) 0%, rgba(247,59,32,0.15) 30%, transparent 60%)",
            filter: "blur(20px)",
          }}
        />
      </motion.div>

      <div className="relative z-[2] px-10 pt-[120px] text-center">
        <div className="font-mono mb-[22px] text-[12px] tracking-[0.18em] text-apricot-300">
          ◇ START NOW · 무료
        </div>
        <h2
          className="m-0 font-extrabold leading-[0.96] tracking-[-0.045em]"
          style={{ fontSize: "clamp(56px, 9vw, 124px)" }}
        >
          이번 인테리어,
        </h2>
        <h2
          className="m-0 font-extrabold leading-[0.96] tracking-[-0.045em] text-primary-500"
          style={{ fontSize: "clamp(56px, 9vw, 124px)" }}
        >
          <span className="font-en font-black italic">inpick</span>으로 끝.
        </h2>
        <p className="mt-7 text-[18px] leading-[1.55] text-apricot-300/75">
          가입과 동시에{" "}
          <span className="font-semibold text-apricot-300">⬢ 5 토큰</span>이 들어옵니다.
          <br />첫 견적은 무료, 신용카드 등록도 필요 없습니다.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <a
            href="/workflow"
            className="font-kr inline-flex items-center gap-2 rounded-full bg-primary-500 px-[26px] py-4 text-[15px] font-semibold text-white"
          >
            무료 견적 시작 →
          </a>
          <a
            href="#demo"
            className="font-kr inline-flex items-center gap-2 rounded-full border-[1.5px] border-offwhite/40 px-[26px] py-4 text-[15px] font-semibold text-offwhite"
          >
            견적 어떻게 나오는지 보기
          </a>
        </div>
        <div className="font-mono mt-6 text-[12px] text-apricot-300/60">
          평균 12분 · 신용카드 등록 불필요 · 견적 1회당 ⬢ 1
        </div>
      </div>

      <footer className="relative mt-[100px] border-t border-apricot-300/[0.12] bg-black/[0.18] px-10 py-[60px] text-left">
        <div className="mx-auto grid max-w-[1280px] gap-9 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="hex-mask h-[22px] w-[22px] text-primary-500" />
              <span className="font-en text-[18px] font-extrabold tracking-tightest">inpick</span>
            </div>
            <div className="mt-3.5 text-[12px] leading-[1.6] text-apricot-300/55">
              주식회사 아이오드 · 대표 김선본
              <br />
              INPICK은 주식회사 아이오드의 서비스입니다
              <br />
              사업자등록번호 384-81-04107
              <br />
              대전광역시 유성구 대덕512번길20, 대전정보문화산업진흥원 B동 2층 1인창조기업지원센터
              <br />
              lookingseon@aiod.kr
            </div>
            {/* 운영자 진입점 */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <a
                href="/admin/login"
                className="inline-flex items-center gap-1 rounded-full border border-apricot-300/20 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-apricot-300/70 hover:border-primary-500/60 hover:text-primary-400 transition-colors"
              >
                ◇ 관리자
              </a>
              <a
                href="/contractor/login"
                className="inline-flex items-center gap-1 rounded-full border border-apricot-300/20 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-apricot-300/70 hover:border-primary-500/60 hover:text-primary-400 transition-colors"
              >
                ◇ 사업자
              </a>
              <a
                href="/mypage"
                className="inline-flex items-center gap-1 rounded-full border border-apricot-300/20 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-apricot-300/70 hover:border-primary-500/60 hover:text-primary-400 transition-colors"
              >
                ◇ 마이페이지
              </a>
            </div>
          </div>
          {FOOTER_COLS.map((c) => (
            <div key={c.title}>
              <div className="font-mono mb-3 text-[11px] tracking-[0.14em] text-primary-500">
                {c.title}
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-apricot-300/70">
                {c.links.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="font-mono mx-auto mt-8 flex max-w-[1280px] justify-between border-t border-apricot-300/10 pt-[18px] text-[11px] tracking-[0.08em] text-apricot-300/40">
          <span>© 2026 INPICK INC. ALL RIGHTS RESERVED.</span>
          <span>v 2.4.1 · UPDATED 2026.05</span>
        </div>
      </footer>
    </section>
  );
}
