"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Environment } from "@react-three/drei";
import { EffectComposer, SSAO, Bloom } from "@react-three/postprocessing";
import type { ParsedFloorPlan, RoomData, WallData } from "@/types/floorplan";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import { getFloorMaterial, WALL_PAINT, GLASS, CEILING } from "@/lib/floor-plan/materials";
import type { PBRMaterialDef } from "@/lib/floor-plan/materials";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const WALL_HEIGHT = 2.7;
const WALL_THICKNESS = 0.15;
const DOOR_HEIGHT = 2.1;
const WINDOW_HEIGHT = 1.2;
const WINDOW_SILL = 0.9;
const WINDOW_WIDTH = 1.8;

type CameraMode = "free" | "top" | "iso";

// PBR meshStandardMaterial props
function PBRMat({ mat, side }: { mat: PBRMaterialDef; side?: THREE.Side }) {
  return (
    <meshStandardMaterial
      color={mat.color}
      roughness={mat.roughness}
      metalness={mat.metalness}
      envMapIntensity={mat.envMapIntensity ?? 0.5}
      transparent={mat.transparent ?? false}
      opacity={mat.opacity ?? 1}
      side={side ?? THREE.FrontSide}
    />
  );
}

// 방 바닥 (PBR 재질 적용)
function RoomFloor({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  const floorMat = getFloorMaterial(room.type);
  const hasPolygon = room.polygon && room.polygon.length >= 3;

  const shape = useMemo(() => {
    if (!hasPolygon) return null;
    const s = new THREE.Shape();
    s.moveTo(room.polygon![0].x - offsetX, room.polygon![0].y - offsetY);
    for (let i = 1; i < room.polygon!.length; i++) {
      s.lineTo(room.polygon![i].x - offsetX, room.polygon![i].y - offsetY);
    }
    s.closePath();
    return s;
  }, [hasPolygon, room.polygon, offsetX, offsetY]);

  if (shape) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <PBRMat mat={floorMat} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  const { x, y, width, height } = room.position;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[x - offsetX + width / 2, 0.01, y - offsetY + height / 2]}
      receiveShadow
    >
      <planeGeometry args={[width, height]} />
      <PBRMat mat={floorMat} side={THREE.DoubleSide} />
    </mesh>
  );
}

// 방 천장
function RoomCeiling({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  const hasPolygon = room.polygon && room.polygon.length >= 3;

  const shape = useMemo(() => {
    if (!hasPolygon) return null;
    const s = new THREE.Shape();
    s.moveTo(room.polygon![0].x - offsetX, room.polygon![0].y - offsetY);
    for (let i = 1; i < room.polygon!.length; i++) {
      s.lineTo(room.polygon![i].x - offsetX, room.polygon![i].y - offsetY);
    }
    s.closePath();
    return s;
  }, [hasPolygon, room.polygon, offsetX, offsetY]);

  if (shape) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT - 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <PBRMat mat={CEILING} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  const { x, y, width, height } = room.position;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[x - offsetX + width / 2, WALL_HEIGHT - 0.01, y - offsetY + height / 2]}
    >
      <planeGeometry args={[width, height]} />
      <PBRMat mat={CEILING} side={THREE.DoubleSide} />
    </mesh>
  );
}

// 벽체 세그먼트 (PBR 벽면 재질)
function WallSegment({
  start,
  end,
  height,
  thickness,
  offsetX,
  offsetY,
  isExterior,
}: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  height: number;
  thickness: number;
  offsetX: number;
  offsetY: number;
  isExterior: boolean;
}) {
  const sx = start.x - offsetX;
  const sz = start.y - offsetY;
  const ex = end.x - offsetX;
  const ez = end.y - offsetY;

  const dx = ex - sx;
  const dz = ez - sz;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  const cx = (sx + ex) / 2;
  const cz = (sz + ez) / 2;

  return (
    <mesh
      position={[cx, height / 2, cz]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, height, thickness]} />
      <PBRMat mat={isExterior ? { ...WALL_PAINT, color: "#e8e3de" } : WALL_PAINT} />
    </mesh>
  );
}

// 벽체 렌더링 (WallData 기반)
function Walls({
  walls,
  doors,
  windows,
  offsetX,
  offsetY,
}: {
  walls: WallData[];
  doors: ParsedFloorPlan["doors"];
  windows: ParsedFloorPlan["windows"];
  offsetX: number;
  offsetY: number;
}) {
  return (
    <group>
      {walls.map((wall) => {
        // 이 벽에 속한 문/창문 찾기
        const wallDoors = (doors || []).filter((d) => {
          const mx = (wall.start.x + wall.end.x) / 2;
          const my = (wall.start.y + wall.end.y) / 2;
          const dist = Math.sqrt((d.position.x - mx) ** 2 + (d.position.y - my) ** 2);
          return dist < 1.5;
        });

        const wallWindows = (windows || []).filter((w) => {
          if (w.wallId === wall.id) return true;
          const mx = (wall.start.x + wall.end.x) / 2;
          const my = (wall.start.y + wall.end.y) / 2;
          const dist = Math.sqrt((w.position.x - mx) ** 2 + (w.position.y - my) ** 2);
          return dist < 1.5;
        });

        const hasOpenings = wallDoors.length > 0 || wallWindows.length > 0;

        if (!hasOpenings) {
          return (
            <WallSegment
              key={wall.id}
              start={wall.start}
              end={wall.end}
              height={WALL_HEIGHT}
              thickness={wall.thickness || WALL_THICKNESS}
              offsetX={offsetX}
              offsetY={offsetY}
              isExterior={wall.isExterior}
            />
          );
        }

        // 벽체에 개구부가 있는 경우: 상부(개구부 위)만 렌더링 + 개구부 표현
        const sx = wall.start.x - offsetX;
        const sz = wall.start.y - offsetY;
        const ex = wall.end.x - offsetX;
        const ez = wall.end.y - offsetY;
        const dx = ex - sx;
        const dz = ez - sz;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const cx = (sx + ex) / 2;
        const cz = (sz + ez) / 2;
        const wt = wall.thickness || WALL_THICKNESS;

        return (
          <group key={wall.id}>
            {/* 문 위 벽 (문 높이 2.1m ~ 천장 2.7m) */}
            {wallDoors.length > 0 && (
              <mesh
                position={[cx, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, cz]}
                rotation={[0, -angle, 0]}
                castShadow
              >
                <boxGeometry args={[length, WALL_HEIGHT - DOOR_HEIGHT, wt]} />
                <PBRMat mat={WALL_PAINT} />
              </mesh>
            )}

            {/* 창문이 있는 벽: 하부(0~창턱) + 상부(창상단~천장) */}
            {wallWindows.length > 0 && wallDoors.length === 0 && (
              <>
                {/* 하부 벽 */}
                <mesh
                  position={[cx, WINDOW_SILL / 2, cz]}
                  rotation={[0, -angle, 0]}
                  castShadow
                >
                  <boxGeometry args={[length, WINDOW_SILL, wt]} />
                  <PBRMat mat={WALL_PAINT} />
                </mesh>
                {/* 상부 벽 */}
                <mesh
                  position={[cx, (WINDOW_SILL + WINDOW_HEIGHT) + (WALL_HEIGHT - WINDOW_SILL - WINDOW_HEIGHT) / 2, cz]}
                  rotation={[0, -angle, 0]}
                  castShadow
                >
                  <boxGeometry args={[length, WALL_HEIGHT - WINDOW_SILL - WINDOW_HEIGHT, wt]} />
                  <PBRMat mat={WALL_PAINT} />
                </mesh>
                {/* 유리 */}
                <mesh
                  position={[cx, WINDOW_SILL + WINDOW_HEIGHT / 2, cz]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[WINDOW_WIDTH, WINDOW_HEIGHT, 0.02]} />
                  <PBRMat mat={GLASS} />
                </mesh>
              </>
            )}

            {/* 문 자체: 없는 것으로 표현 (개구부) */}
          </group>
        );
      })}
    </group>
  );
}

// 간단 벽 (polygon/wall 데이터 없을 때 폴백)
function SimpleRoomWalls({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  const { x, y, width, height } = room.position;
  const cx = x - offsetX + width / 2;
  const cz = y - offsetY + height / 2;
  const w = width;
  const h = height;
  const wh = WALL_HEIGHT;
  const wt = WALL_THICKNESS;

  return (
    <group>
      <mesh position={[cx, wh / 2, cz - h / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wh, wt]} />
        <PBRMat mat={WALL_PAINT} />
      </mesh>
      <mesh position={[cx, wh / 2, cz + h / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wh, wt]} />
        <PBRMat mat={WALL_PAINT} />
      </mesh>
      <mesh position={[cx - w / 2, wh / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[wt, wh, h]} />
        <PBRMat mat={WALL_PAINT} />
      </mesh>
      <mesh position={[cx + w / 2, wh / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[wt, wh, h]} />
        <PBRMat mat={WALL_PAINT} />
      </mesh>
    </group>
  );
}

// 방 라벨
function RoomLabel({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  let cx: number, cz: number;

  if (room.polygon && room.polygon.length >= 3) {
    let sx = 0, sy = 0;
    for (const p of room.polygon) {
      sx += p.x;
      sy += p.y;
    }
    cx = sx / room.polygon.length - offsetX;
    cz = sy / room.polygon.length - offsetY;
  } else {
    const { x, y, width, height } = room.position;
    cx = x - offsetX + width / 2;
    cz = y - offsetY + height / 2;
  }

  const label = ROOM_TYPE_LABELS[room.type] || room.name;

  return (
    <Text
      position={[cx, 0.05, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.4}
      color="#374151"
      anchorX="center"
      anchorY="middle"
    >
      {`${label}\n${room.area}m²`}
    </Text>
  );
}

// 씬 컨텐츠
function Scene({
  floorPlan,
  cameraMode,
  showCeiling,
}: {
  floorPlan: ParsedFloorPlan;
  cameraMode: CameraMode;
  showCeiling: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const { offsetX, offsetY, totalWidth, totalDepth } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const room of floorPlan.rooms) {
      if (room.polygon) {
        for (const p of room.polygon) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      } else {
        const { x, y, width, height } = room.position;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      }
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { offsetX: cx, offsetY: cy, totalWidth: maxX - minX, totalDepth: maxY - minY };
  }, [floorPlan]);

  const camDist = Math.max(totalWidth, totalDepth) * 1.2;
  const hasWalls = floorPlan.walls && floorPlan.walls.length > 0;

  // 카메라 위치 계산
  const camPos = useMemo((): [number, number, number] => {
    switch (cameraMode) {
      case "top":
        return [0, camDist * 1.5, 0.01];
      case "iso":
        return [camDist * 0.7, camDist * 0.7, camDist * 0.7];
      default:
        return [camDist * 0.6, camDist * 0.8, camDist * 0.6];
    }
  }, [cameraMode, camDist]);

  return (
    <>
      <PerspectiveCamera makeDefault position={camPos} fov={50} />
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate={cameraMode !== "top"}
        maxPolarAngle={cameraMode === "top" ? 0 : Math.PI / 2.1}
        minDistance={2}
        maxDistance={camDist * 3}
      />

      {/* 환경맵 조명 (apartment 프리셋) */}
      <Environment preset="apartment" />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* 후처리 */}
      <EffectComposer>
        <SSAO
          radius={0.4}
          intensity={15}
          luminanceInfluence={0.6}
          worldDistanceThreshold={1.0}
          worldDistanceFalloff={0.1}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.1}
        />
        <Bloom
          luminanceThreshold={0.9}
          luminanceSmoothing={0.9}
          intensity={0.1}
        />
      </EffectComposer>

      {/* 바닥 그리드 */}
      <gridHelper args={[50, 50, "#e5e7eb", "#f3f4f6"]} position={[0, 0, 0]} />

      {/* 벽체 */}
      {hasWalls ? (
        <Walls
          walls={floorPlan.walls}
          doors={floorPlan.doors}
          windows={floorPlan.windows}
          offsetX={offsetX}
          offsetY={offsetY}
        />
      ) : (
        floorPlan.rooms.map((room) => (
          <SimpleRoomWalls key={`wall-${room.id}`} room={room} offsetX={offsetX} offsetY={offsetY} />
        ))
      )}

      {/* 방 렌더링 */}
      {floorPlan.rooms.map((room) => (
        <group key={room.id}>
          <RoomFloor room={room} offsetX={offsetX} offsetY={offsetY} />
          {showCeiling && <RoomCeiling room={room} offsetX={offsetX} offsetY={offsetY} />}
          <RoomLabel room={room} offsetX={offsetX} offsetY={offsetY} />
        </group>
      ))}
    </>
  );
}

interface FloorPlan3DProps {
  floorPlan: ParsedFloorPlan;
  className?: string;
}

export default function FloorPlan3D({ floorPlan, className = "" }: FloorPlan3DProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>("free");
  const [showCeiling, setShowCeiling] = useState(false);

  return (
    <div className={`relative bg-gray-100 ${className}`}>
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <Scene floorPlan={floorPlan} cameraMode={cameraMode} showCeiling={showCeiling} />
      </Canvas>

      {/* 카메라 모드 컨트롤 */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        {(["free", "iso", "top"] as CameraMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shadow-sm transition-colors ${
              cameraMode === mode
                ? "bg-blue-600 text-white"
                : "bg-white/90 text-gray-600 hover:bg-white"
            }`}
          >
            {mode === "free" ? "자유" : mode === "iso" ? "아이소" : "탑뷰"}
          </button>
        ))}
        <button
          onClick={() => setShowCeiling(!showCeiling)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shadow-sm transition-colors ${
            showCeiling
              ? "bg-blue-600 text-white"
              : "bg-white/90 text-gray-600 hover:bg-white"
          }`}
        >
          {showCeiling ? "천장 끔" : "천장 켬"}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm">
        마우스 드래그: 회전 | 스크롤: 확대/축소 | 우클릭 드래그: 이동
      </div>
    </div>
  );
}
