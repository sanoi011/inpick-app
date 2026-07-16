"use client";

import { ArrowLeft, ArrowRight, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./LivingLobby.module.css";

type ApartmentType = {
  id: string;
  area: number;
  variant?: string;
};

const APARTMENT_TYPES: ApartmentType[] = [
  { id: "39", area: 39 },
  { id: "49", area: 49 },
  { id: "59a", area: 59, variant: "A" },
  { id: "59b", area: 59, variant: "B" },
  { id: "74a", area: 74, variant: "A" },
  { id: "84a", area: 84, variant: "A" },
  { id: "84b", area: 84, variant: "B" },
  { id: "102", area: 102 },
  { id: "114", area: 114 },
  { id: "134", area: 134 },
];

const ENTER_DURATION_MS = 950;
const PROGRAMMATIC_SCROLL_START_MS = 400;
const PROGRAMMATIC_SCROLL_SETTLE_MS = 150;

function getTypeName(type: ApartmentType) {
  return `${type.area}${type.variant ?? ""}`;
}

export default function LivingLobby() {
  const [selectedIndex, setSelectedIndex] = useState(5);
  const [phase, setPhase] = useState<"lobby" | "entering" | "interior">("lobby");
  const [reducedMotion, setReducedMotion] = useState(false);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const selectedIndexRef = useRef(selectedIndex);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimer = useRef<number | null>(null);
  const returnFocusToEntryRef = useRef(false);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);
  const interiorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const selectedType = APARTMENT_TYPES[selectedIndex];
  const isLobbyActive = phase === "lobby";

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const armProgrammaticScrollGuard = (duration: number) => {
    programmaticScrollRef.current = true;
    if (programmaticScrollTimer.current !== null) {
      window.clearTimeout(programmaticScrollTimer.current);
    }
    programmaticScrollTimer.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticScrollTimer.current = null;
    }, duration);
  };

  const selectType = (index: number) => {
    if (phase !== "lobby") return;
    const nextIndex = Math.max(0, Math.min(APARTMENT_TYPES.length - 1, index));
    setSelectedIndex(nextIndex);
    armProgrammaticScrollGuard(reducedMotion ? PROGRAMMATIC_SCROLL_SETTLE_MS : PROGRAMMATIC_SCROLL_START_MS);
    cardRefs.current[nextIndex]?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const updateSelectionFromScroll = () => {
    if (phase !== "lobby") return;
    if (programmaticScrollRef.current) {
      // Keep the guard alive until the programmatic scroll settles so that
      // intermediate scroll events cannot revert the chosen selection.
      armProgrammaticScrollGuard(PROGRAMMATIC_SCROLL_SETTLE_MS);
      return;
    }
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const viewport = scrollRef.current;
      if (!viewport) return;

      const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      let closestIndex = selectedIndexRef.current;
      let closestDistance = Number.POSITIVE_INFINITY;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setSelectedIndex(closestIndex);
    });
  };

  const enterInterior = () => {
    if (phase !== "lobby") return;
    setPhase("entering");
  };

  useEffect(() => {
    if (phase !== "entering") return;
    if (reducedMotion) {
      setPhase("interior");
      return;
    }
    const timer = window.setTimeout(() => setPhase("interior"), ENTER_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  // Center the selected card whenever the lobby view mounts (initial load and
  // when returning from the interior). Restore focus to the entry button only
  // when coming back from the interior — never on first page load.
  useEffect(() => {
    if (phase !== "lobby") return;
    const viewport = scrollRef.current;
    const card = cardRefs.current[selectedIndexRef.current];
    if (viewport && card) {
      const viewportRect = viewport.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      viewport.scrollLeft += cardRect.left - viewportRect.left - (viewport.clientWidth - cardRect.width) / 2;
    }
    if (returnFocusToEntryRef.current) {
      returnFocusToEntryRef.current = false;
      entryButtonRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "interior") return;
    interiorHeadingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    return () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      if (programmaticScrollTimer.current !== null) window.clearTimeout(programmaticScrollTimer.current);
    };
  }, []);

  if (phase === "interior") {
    return (
      <main className="relative flex min-h-[100dvh] overflow-hidden bg-[#11110f] text-[#f3f0e8]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(247,59,32,0.12),transparent_32%),linear-gradient(180deg,#181815_0%,#0c0c0b_100%)]" />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-white/60">INPICK LIVING</p>
          <button
            type="button"
            onClick={() => {
              returnFocusToEntryRef.current = true;
              setPhase("lobby");
            }}
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold text-white/70 transition hover:border-white/35 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            대기실
          </button>
        </header>

        <section className="relative z-[1] flex w-full flex-col items-center justify-center px-5 text-center">
          <p className="mb-3 text-xs font-medium tracking-[0.24em] text-[#f76b56]">FIRST-PERSON SPACE</p>
          <h1
            ref={interiorHeadingRef}
            tabIndex={-1}
            className="text-5xl font-semibold tracking-[-0.055em] outline-none sm:text-7xl"
          >
            {getTypeName(selectedType)}<span className="ml-1 text-2xl font-normal text-white/45 sm:text-3xl">㎡</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/45">
            선택한 세대 내부입니다. 다음 단계에서 실제 도면 메시, 1인칭 이동과 자재 편집 기능이 연결됩니다.
          </p>
        </section>

        <nav className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 mx-auto flex w-[calc(100%-2.5rem)] max-w-xl items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-[11px] font-medium text-white/45 backdrop-blur-xl">
          <span>자재 편집</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>AI 자동완성</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>실시간 견적</span>
        </nav>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#ece9e1] text-[#171714]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.92),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.25),transparent_60%)]" />

      <header className="relative z-10 flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-10">
        <p className="text-[11px] font-bold tracking-[0.28em]">INPICK LIVING</p>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-black/40">TYPE LOBBY · 01</p>
      </header>

      <section className="relative z-[1] flex flex-1 flex-col justify-center py-8">
        <div className="px-5 text-center md:px-10">
          <p className="mb-3 text-[11px] font-bold tracking-[0.22em] text-[#e8452f]">SELECT YOUR HOME</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">입장할 평형을 선택하세요</h1>
          <p className="mt-3 text-sm text-black/45">좌우로 움직여 우리 집과 가장 가까운 타입을 고르세요.</p>
        </div>

        <div className="relative mt-9 sm:mt-12">
          <div
            ref={scrollRef}
            role="radiogroup"
            aria-label="평형 선택"
            onScroll={updateSelectionFromScroll}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[calc(50%-7rem)] py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 sm:px-[calc(50%-9rem)]"
          >
            {APARTMENT_TYPES.map((type, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={type.id}
                  ref={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-label={`${getTypeName(type)} 제곱미터 타입 선택`}
                  aria-checked={isSelected}
                  disabled={!isLobbyActive}
                  onClick={() => selectType(index)}
                  className={`group relative flex h-56 w-56 shrink-0 snap-center flex-col items-center justify-center overflow-hidden rounded-[2rem] border text-center transition-all duration-500 sm:h-72 sm:w-72 ${
                    isSelected
                      ? "scale-100 border-[#171714] bg-[#171714] text-white shadow-[0_26px_70px_rgba(23,23,20,0.22)]"
                      : "scale-[0.9] border-black/10 bg-white/35 text-black/35 hover:border-black/25 hover:text-black/60"
                  }`}
                >
                  <span className="absolute left-6 top-6 text-[10px] font-bold tracking-[0.2em] opacity-50">
                    TYPE {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-end">
                    <span className="text-6xl font-semibold tracking-[-0.075em] sm:text-7xl">{type.area}</span>
                    <span className="mb-2 ml-1 text-lg font-medium opacity-45">㎡</span>
                  </span>
                  <span className={`mt-3 text-xs font-bold tracking-[0.24em] ${type.variant ? "opacity-70" : "opacity-0"}`}>
                    {type.variant ?? "STANDARD"} TYPE
                  </span>
                  {isSelected && <span className="absolute bottom-6 h-1.5 w-1.5 rounded-full bg-[#f73b20]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="이전 평형"
              disabled={!isLobbyActive || selectedIndex === 0}
              onClick={() => selectType(selectedIndex - 1)}
              className="grid h-11 w-11 place-items-center rounded-full border border-black/15 transition hover:bg-white disabled:opacity-25"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p
              aria-live="polite"
              aria-atomic="true"
              className="w-24 text-center text-xs font-semibold tabular-nums text-black/45"
            >
              {String(selectedIndex + 1).padStart(2, "0")} / {APARTMENT_TYPES.length}
              <span className="sr-only"> · {getTypeName(selectedType)}㎡ 선택됨</span>
            </p>
            <button
              type="button"
              aria-label="다음 평형"
              disabled={!isLobbyActive || selectedIndex === APARTMENT_TYPES.length - 1}
              onClick={() => selectType(selectedIndex + 1)}
              className="grid h-11 w-11 place-items-center rounded-full border border-black/15 transition hover:bg-white disabled:opacity-25"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 flex items-center justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button
          ref={entryButtonRef}
          type="button"
          disabled={phase === "entering"}
          onClick={enterInterior}
          className="group flex min-h-14 w-full max-w-sm items-center justify-between rounded-full bg-[#f73b20] px-6 text-sm font-bold text-white shadow-[0_14px_35px_rgba(247,59,32,0.28)] transition hover:bg-[#e8341e] disabled:cursor-wait"
        >
          <span>{phase === "entering" ? `${getTypeName(selectedType)}㎡ 세대 불러오는 중` : `${getTypeName(selectedType)}㎡ 세대로 입장`}</span>
          <ChevronRight className={`h-5 w-5 transition-transform ${phase === "entering" ? "animate-pulse" : "group-hover:translate-x-1"}`} />
        </button>
      </footer>

      {phase === "entering" && (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-50 bg-[#11110f] ${styles.enterOverlay}`} />
      )}
    </main>
  );
}
