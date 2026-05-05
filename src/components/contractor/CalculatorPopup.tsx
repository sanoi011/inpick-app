"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, X, Move } from "lucide-react";

/**
 * 사업자 입찰 견적 시 빠르게 사용할 수 있는 플로팅 계산기 팝업.
 * - 헤더의 계산기 아이콘 클릭 → 우측 상단에 popup
 * - 드래그로 이동 가능, 다시 X 클릭하면 닫힘
 * - 기본 사칙연산 + 백분율 + 메모리(M+/M-/MR/MC)
 */
export default function CalculatorPopup() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [memory, setMemory] = useState(0);

  // 드래그
  const [pos, setPos] = useState({ x: 24, y: 88 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, e.clientX - dragging.current.x),
        y: Math.max(0, e.clientY - dragging.current.y),
      });
    };
    const onUp = () => {
      dragging.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const inputDigit = (d: string) => {
    if (waitingForOperand) {
      setDisplay(d);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const calc = (a: number, b: number, op: string): number => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const handleOp = (op: string) => {
    const v = parseFloat(display);
    if (accumulator == null) {
      setAccumulator(v);
    } else if (pendingOp) {
      const next = calc(accumulator, v, pendingOp);
      setAccumulator(next);
      setDisplay(formatNum(next));
    }
    setPendingOp(op);
    setWaitingForOperand(true);
  };

  const handleEquals = () => {
    const v = parseFloat(display);
    if (pendingOp != null && accumulator != null) {
      const next = calc(accumulator, v, pendingOp);
      setDisplay(formatNum(next));
      setAccumulator(null);
      setPendingOp(null);
      setWaitingForOperand(true);
    }
  };

  const clearAll = () => {
    setDisplay("0");
    setAccumulator(null);
    setPendingOp(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => setDisplay("0");

  const sign = () => setDisplay(formatNum(-parseFloat(display)));
  const percent = () => setDisplay(formatNum(parseFloat(display) / 100));

  const memAdd = () => setMemory(memory + parseFloat(display));
  const memSub = () => setMemory(memory - parseFloat(display));
  const memRecall = () => setDisplay(formatNum(memory));
  const memClear = () => setMemory(0);

  function formatNum(n: number): string {
    if (!isFinite(n)) return "Error";
    return parseFloat(n.toFixed(10)).toString();
  }

  function displayWithCommas(s: string): string {
    if (s === "Error") return s;
    const [intPart, decPart] = s.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart != null ? `${withCommas}.${decPart}` : withCommas;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="계산기 (입찰 견적 보조)"
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <Calculator className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(false)}
        title="계산기 닫기"
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#1B3556] bg-[#1B3556] text-white hover:bg-[#2a4870]"
      >
        <Calculator className="w-4 h-4" />
      </button>

      {/* 플로팅 계산기 */}
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-[200] w-72 rounded-xl border border-zinc-300 bg-white shadow-2xl select-none"
      >
        {/* 드래그 핸들 + 닫기 */}
        <div
          onMouseDown={(e) => {
            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            dragging.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          }}
          className="flex items-center justify-between px-3 py-2 bg-[#1B3556] text-white rounded-t-xl cursor-move"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold">
            <Calculator className="w-3.5 h-3.5" />
            계산기
            <Move className="w-3 h-3 opacity-50" />
          </span>
          <button
            onClick={() => setOpen(false)}
            className="hover:bg-white/10 rounded p-0.5"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 디스플레이 */}
        <div className="bg-zinc-900 text-white px-4 py-4">
          <div className="text-[0.65rem] tabular text-zinc-400 h-3 text-right">
            {accumulator != null && pendingOp ? `${formatNum(accumulator)} ${pendingOp}` : ""}
            {memory !== 0 && <span className="ml-2 text-amber-400">M</span>}
          </div>
          <div className="text-right text-2xl font-bold tabular tracking-tight">
            {displayWithCommas(display)}
          </div>
        </div>

        {/* 키패드 */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-zinc-50">
          {/* 메모리 */}
          <Btn onClick={memClear} variant="ghost">MC</Btn>
          <Btn onClick={memRecall} variant="ghost">MR</Btn>
          <Btn onClick={memAdd} variant="ghost">M+</Btn>
          <Btn onClick={memSub} variant="ghost">M−</Btn>
          {/* 행 1 */}
          <Btn onClick={clearAll} variant="danger">C</Btn>
          <Btn onClick={clearEntry} variant="ghost">CE</Btn>
          <Btn onClick={percent} variant="ghost">%</Btn>
          <Btn onClick={() => handleOp("÷")} variant="op">÷</Btn>
          {/* 행 2 */}
          <Btn onClick={() => inputDigit("7")}>7</Btn>
          <Btn onClick={() => inputDigit("8")}>8</Btn>
          <Btn onClick={() => inputDigit("9")}>9</Btn>
          <Btn onClick={() => handleOp("×")} variant="op">×</Btn>
          {/* 행 3 */}
          <Btn onClick={() => inputDigit("4")}>4</Btn>
          <Btn onClick={() => inputDigit("5")}>5</Btn>
          <Btn onClick={() => inputDigit("6")}>6</Btn>
          <Btn onClick={() => handleOp("-")} variant="op">−</Btn>
          {/* 행 4 */}
          <Btn onClick={() => inputDigit("1")}>1</Btn>
          <Btn onClick={() => inputDigit("2")}>2</Btn>
          <Btn onClick={() => inputDigit("3")}>3</Btn>
          <Btn onClick={() => handleOp("+")} variant="op">+</Btn>
          {/* 행 5 */}
          <Btn onClick={sign} variant="ghost">±</Btn>
          <Btn onClick={() => inputDigit("0")}>0</Btn>
          <Btn onClick={inputDot}>.</Btn>
          <Btn onClick={handleEquals} variant="primary">=</Btn>
        </div>
      </div>
    </>
  );
}

function Btn({
  onClick,
  variant = "default",
  children,
}: {
  onClick: () => void;
  variant?: "default" | "op" | "primary" | "ghost" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "bg-[#1B3556] text-white hover:bg-[#2a4870]"
      : variant === "op"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : variant === "ghost"
          ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          : variant === "danger"
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50";
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded text-sm font-bold tabular transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
