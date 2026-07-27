"use client";

import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { ExpoProvisionalFootprint } from "@/lib/expo/footprint";
import {
  componentFootprintSize,
  expoDecalPlacement,
  findCatalogItem,
  type ExpoBoothScene,
} from "@/lib/expo/scene";

/**
 * Provisional booth shell — 면적 기반 임시 footprint의 3D 확인용 셸.
 * 가정(provisional)임을 화면에 상시 표기한다. 이 셸은 컨셉 확인용이며
 * 치수 확정 전 BOM/제안서의 근거가 되지 않는다.
 */
export type ExpoCameraPreset = "hero" | "front" | "top" | "visitor";

export const EXPO_CAMERA_PRESETS: Array<{ id: ExpoCameraPreset; label: string }> = [
  { id: "hero", label: "기본" },
  { id: "front", label: "정면" },
  { id: "top", label: "탑뷰" },
  { id: "visitor", label: "관람객" },
];

export interface BoothSceneViewProps {
  cameraPreset?: ExpoCameraPreset;
  onCameraPresetChange?: (preset: ExpoCameraPreset) => void;
  /** 확정된 브랜드 컬러 — 벽 요소(그래픽 월/라이트박스)에 결정적으로 적용 */
  brandColorHex?: string | null;
  /** 재호스팅된 로고 URL — 그래픽 월 정면에 결정적 데칼로 렌더 */
  brandLogoUrl?: string | null;
  /** 컨셉 이미지 URL — 그래픽 월 전면 텍스처(컨셉 전용 표기 하에) */
  wallTextureUrl?: string | null;
  scene?: ExpoBoothScene | null;
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string | null) => void;
}

export default function BoothShell3D({
  footprint,
  confirmed = false,
  scene = null,
  selectedComponentId = null,
  onSelectComponent,
  cameraPreset = "hero",
  onCameraPresetChange,
  brandColorHex = null,
  brandLogoUrl = null,
  wallTextureUrl = null,
}: {
  footprint: ExpoProvisionalFootprint;
  confirmed?: boolean;
} & BoothSceneViewProps) {
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
      <BoothShellCanvas
        footprint={footprint}
        confirmed={confirmed}
        scene={scene}
        selectedComponentId={selectedComponentId}
        onSelectComponent={onSelectComponent}
        cameraPreset={cameraPreset}
        onCameraPresetChange={onCameraPresetChange}
        brandColorHex={brandColorHex}
        brandLogoUrl={brandLogoUrl}
        wallTextureUrl={wallTextureUrl}
      />
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

function BrandLogoDecal({
  url,
  placement,
  fit = "logo",
}: {
  url: string;
  placement: ReturnType<typeof expoDecalPlacement>;
  /** logo=면의 55% 로고 배치, cover=면 전체 텍스처 */
  fit?: "logo" | "cover";
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    let loaded: THREE.Texture | null = null;
    // useLoader는 실패 시 throw → 에러 바운더리가 캔버스 전체를 죽이므로
    // 수동 로드: 실패하면 데칼만 조용히 생략한다.
    new THREE.TextureLoader().load(
      url,
      (result) => {
        if (disposed) {
          result.dispose();
          return;
        }
        result.colorSpace = THREE.SRGBColorSpace;
        loaded = result;
        setTexture(result);
      },
      undefined,
      () => {},
    );
    return () => {
      disposed = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [url]);

  if (!texture) return null;
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect =
    image?.width && image?.height ? image.width / image.height : 1;
  let width: number;
  let height: number;
  if (fit === "cover") {
    width = placement.faceWidth * 0.98;
    height = placement.faceHeight * 0.94;
  } else {
    width = placement.faceWidth * 0.55;
    height = width / aspect;
    const maxHeight = placement.faceHeight * 0.5;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
  }
  return (
    <mesh
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotationY, 0]}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CameraRig({
  preset,
  width,
  depth,
  wallHeight,
}: {
  preset: ExpoCameraPreset;
  width: number;
  depth: number;
  wallHeight: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as {
    target?: { set: (x: number, y: number, z: number) => void };
    update?: () => void;
  } | null;

  useEffect(() => {
    const r = Math.max(width, depth);
    const views: Record<
      ExpoCameraPreset,
      { position: [number, number, number]; target: [number, number, number] }
    > = {
      hero: {
        position: [r * 0.9, r * 0.75, r * 1.25],
        target: [0, wallHeight / 3, 0],
      },
      front: {
        position: [0, wallHeight * 0.55, r * 1.7],
        target: [0, wallHeight / 2.5, 0],
      },
      top: { position: [0, r * 2.4, 0.02], target: [0, 0, 0] },
      visitor: {
        position: [0, 1.6, depth / 2 + 1.8],
        target: [0, 1.3, -depth / 4],
      },
    };
    const view = views[preset];
    camera.position.set(...view.position);
    controls?.target?.set(...view.target);
    controls?.update?.();
  }, [preset, width, depth, wallHeight, camera, controls]);

  return null;
}

function BoothShellCanvas({
  footprint,
  confirmed = false,
  scene = null,
  selectedComponentId = null,
  onSelectComponent,
  cameraPreset = "hero",
  onCameraPresetChange,
  brandColorHex = null,
  brandLogoUrl = null,
  wallTextureUrl = null,
}: {
  footprint: ExpoProvisionalFootprint;
  confirmed?: boolean;
} & BoothSceneViewProps) {
  const { widthM: width, depthM: depth } = footprint.selected;
  const wallHeight = footprint.wallHeightM;
  const wallThickness = 0.08;
  // 실제 3D 궤도 자동 회전 (가짜 360 금지 원칙 — 진짜 씬 회전만 제공)
  const [autoRotate, setAutoRotate] = useState(false);

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
      <Canvas
        camera={camera}
        shadows
        dpr={[1, 2]}
        onPointerMissed={() => onSelectComponent?.(null)}
      >
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

        {/* 카탈로그 컴포넌트 배치 */}
        {(scene?.components ?? []).map((component) => {
          const item = findCatalogItem(component.catalogId);
          if (!item) return null;
          const size = componentFootprintSize(component);
          const isSelected = component.id === selectedComponentId;
          return (
            <group key={component.id}>
              <mesh
                position={[component.x, item.heightM / 2, component.z]}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectComponent?.(component.id);
                }}
                castShadow
              >
                <boxGeometry args={[size.w, item.heightM, size.d]} />
                <meshStandardMaterial
                  color={
                    item.wallMounted && brandColorHex ? brandColorHex : item.color
                  }
                  emissive={isSelected ? "#1d4ed8" : "#000000"}
                  emissiveIntensity={isSelected ? 0.45 : 0}
                />
              </mesh>
              {component.catalogId === "graphic_wall" && wallTextureUrl && (
                <BrandLogoDecal
                  url={wallTextureUrl}
                  fit="cover"
                  placement={{
                    ...expoDecalPlacement(component, item),
                  }}
                />
              )}
              {component.catalogId === "graphic_wall" && brandLogoUrl && (
                <BrandLogoDecal
                  url={brandLogoUrl}
                  placement={(() => {
                    const base = expoDecalPlacement(component, item);
                    // 텍스처가 있으면 로고를 살짝 앞으로
                    return wallTextureUrl
                      ? { ...base, z: base.z + (base.rotationY === 0 ? 0.01 : 0), x: base.x + (Math.abs(base.rotationY) === Math.PI / 2 ? (base.rotationY > 0 ? 0.01 : -0.01) : 0) }
                      : base;
                  })()}
                />
              )}
            </group>
          );
        })}

        <CameraRig
          preset={cameraPreset}
          width={width}
          depth={depth}
          wallHeight={wallHeight}
        />
        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={1.6}
          enablePan={false}
          minDistance={Math.max(width, depth) * 0.6}
          maxDistance={Math.max(width, depth) * 3}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, wallHeight / 3, 0]}
        />
      </Canvas>

      <div
        role="group"
        aria-label="카메라 시점"
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white/90 p-1 shadow backdrop-blur"
      >
        <button
          type="button"
          aria-pressed={autoRotate}
          aria-label="360도 자동 회전"
          onClick={() => setAutoRotate((rotating) => !rotating)}
          className={
            autoRotate
              ? "whitespace-nowrap rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white"
              : "whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold text-black/55 hover:text-indigo-700"
          }
        >
          360°
        </button>
        {EXPO_CAMERA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={cameraPreset === preset.id}
            onClick={() => onCameraPresetChange?.(preset.id)}
            className={
              cameraPreset === preset.id
                ? "whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white"
                : "whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold text-black/55 hover:text-blue-700"
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

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
