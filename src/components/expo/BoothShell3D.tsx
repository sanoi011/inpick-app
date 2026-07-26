"use client";

import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ExpoProvisionalFootprint } from "@/lib/expo/footprint";

/**
 * Provisional booth shell — 면적 기반 임시 footprint의 3D 확인용 셸.
 * 가정(provisional)임을 화면에 상시 표기한다. 이 셸은 컨셉 확인용이며
 * 치수 확정 전 BOM/제안서의 근거가 되지 않는다.
 */
export default function BoothShell3D({
  footprint,
  confirmed = false,
}: {
  footprint: ExpoProvisionalFootprint;
  confirmed?: boolean;
}) {
  const [webglReady, setWebglReady] = useState<boolean | null>(null);
  const [glCrashed, setGlCrashed] = useState(false);

  useEffect(() => {
    // THREE가 실제 요청하는 것과 같은 속성으로 프로브해야 headless 등
    // 반쪽 지원 환경을 걸러낼 수 있다.
    try {
      const probe = document.createElement("canvas");
      const attrs: WebGLContextAttributes = {
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      };
      const gl =
        probe.getContext("webgl2", attrs) || probe.getContext("webgl", attrs);
      setWebglReady(Boolean(gl));
      if (gl) {
        const lose = (gl as WebGLRenderingContext).getExtension(
          "WEBGL_lose_context",
        );
        lose?.loseContext();
      }
    } catch {
      setWebglReady(false);
    }
  }, []);

  useEffect(() => {
    // R3F의 renderer 생성 오류는 비동기로 던져져 error boundary 밖으로
    // 샐 수 있다 — 전역 가드로 poster 전환한다.
    const onError = (event: ErrorEvent) => {
      if (/WebGL/i.test(String(event.message))) {
        setGlCrashed(true);
        event.preventDefault();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (/WebGL/i.test(String(event.reason))) {
        setGlCrashed(true);
        event.preventDefault();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (webglReady === null) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-black/10 bg-slate-50 text-sm text-black/50 sm:h-[400px]">
        3D 캔버스 준비 중…
      </div>
    );
  }
  if (!webglReady || glCrashed) {
    return (
      <BoothShellPoster
        footprint={footprint}
        reason={glCrashed ? "render_error" : "webgl_unavailable"}
        confirmed={confirmed}
      />
    );
  }
  return (
    <ShellErrorBoundary fallback={<BoothShellPoster footprint={footprint} reason="render_error" confirmed={confirmed} />}>
      <BoothShellCanvas footprint={footprint} confirmed={confirmed} />
    </ShellErrorBoundary>
  );
}

/** WebGL 불가/렌더 실패 시 2D 평면 미리보기 poster (마스터 지시문 fallback 요건). */
function BoothShellPoster({
  footprint,
  reason,
  confirmed = false,
}: {
  footprint: ExpoProvisionalFootprint;
  reason: "webgl_unavailable" | "render_error";
  confirmed?: boolean;
}) {
  const { widthM: w, depthM: d } = footprint.selected;
  const pad = 1;
  const viewW = w + pad * 2;
  const viewH = d + pad * 2;
  return (
    <div className="relative flex h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-slate-50 to-white sm:h-[400px]">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-[70%] w-auto max-w-[85%]"
        role="img"
        aria-label={`부스 평면 미리보기 ${footprint.selected.label}`}
      >
        <rect x={pad} y={pad} width={w} height={d} fill="#dbe7f5" stroke="#94a3b8" strokeWidth={0.05} />
        {/* 뒷벽 + 측벽 (인라인 기준) */}
        <rect x={pad} y={pad} width={w} height={0.15} fill="#334155" />
        <rect x={pad} y={pad} width={0.15} height={d} fill="#64748b" />
        <rect x={pad + w - 0.15} y={pad} width={0.15} height={d} fill="#64748b" />
      </svg>
      <p className="mt-2 text-sm font-bold text-blue-800">
        {footprint.selected.label} · 높이 {footprint.wallHeightM}m
      </p>
      <p className="mt-0.5 text-xs font-medium text-black/50">
        {reason === "webgl_unavailable"
          ? "이 기기에서 3D를 사용할 수 없어 평면 미리보기를 표시합니다."
          : "3D 표시에 문제가 있어 평면 미리보기로 전환했습니다."}
      </p>
      <div className="pointer-events-none absolute left-3 top-3">
        <span
          className={
            confirmed
              ? "rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold text-green-800 shadow-sm"
              : "rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-sm"
          }
        >
          {confirmed ? "치수 확정됨" : "가정 기반 임시 배치 — 치수 확정 전"}
        </span>
      </div>
    </div>
  );
}

class ShellErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[expo] booth shell render failed:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function BoothShellCanvas({
  footprint,
  confirmed = false,
}: {
  footprint: ExpoProvisionalFootprint;
  confirmed?: boolean;
}) {
  const { widthM: width, depthM: depth } = footprint.selected;
  const wallHeight = footprint.wallHeightM;
  const wallThickness = 0.08;

  const camera = useMemo(() => {
    const radius = Math.max(width, depth);
    return {
      position: [radius * 0.9, radius * 0.75, radius * 1.25] as [
        number,
        number,
        number,
      ],
      fov: 45,
    };
  }, [width, depth]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-b from-slate-50 to-white sm:h-[400px]">
      <Canvas camera={camera} shadows dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[6, 10, 4]}
          intensity={0.9}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* 바닥 (부스 카펫 영역) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          receiveShadow
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#dbe7f5" />
        </mesh>

        {/* 주변 홀 바닥 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
          <planeGeometry args={[width + 8, depth + 8]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <gridHelper
          args={[Math.max(width, depth) + 8, Math.max(width, depth) + 8, "#cbd5e1", "#e2e8f0"]}
          position={[0, 0.0005, 0]}
        />

        {/* 뒷벽 — 아일랜드(오픈 4면)는 벽 없음 */}
        {footprint.openSides <= 3 && (
          <mesh
            position={[0, wallHeight / 2, -depth / 2 + wallThickness / 2]}
            castShadow
          >
            <boxGeometry args={[width, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        )}

        {/* 측벽 — inline(오픈 1면) 기준. 부스 타입별 확장은 다음 슬라이스 */}
        {footprint.openSides <= 2 && (
          <mesh
            position={[-width / 2 + wallThickness / 2, wallHeight / 2, 0]}
            castShadow
          >
            <boxGeometry args={[wallThickness, wallHeight, depth]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
        )}
        {footprint.openSides <= 1 && (
          <mesh
            position={[width / 2 - wallThickness / 2, wallHeight / 2, 0]}
            castShadow
          >
            <boxGeometry args={[wallThickness, wallHeight, depth]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
        )}

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={Math.max(width, depth) * 0.6}
          maxDistance={Math.max(width, depth) * 3}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, wallHeight / 3, 0]}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow">
          {footprint.selected.label} · 높이 {footprint.wallHeightM}m
        </span>
        <span
          className={
            confirmed
              ? "rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold text-green-800 shadow-sm"
              : "rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-sm"
          }
        >
          {confirmed ? "치수 확정됨" : "가정 기반 임시 배치 — 치수 확정 전"}
        </span>
      </div>
    </div>
  );
}
