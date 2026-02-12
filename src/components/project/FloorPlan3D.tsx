"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Environment } from "@react-three/drei";
import { EffectComposer, SSAO, Bloom } from "@react-three/postprocessing";
import type { ParsedFloorPlan, RoomData, WallData, FixtureData } from "@/types/floorplan";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import { getFloorMaterial, WALL_DARK, WALL_DARK_INTERIOR, GLASS, CEILING, CERAMIC, STAINLESS, WOOD_FLOOR, TILE } from "@/lib/floor-plan/materials";
import type { PBRMaterialDef } from "@/lib/floor-plan/materials";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const WALL_HEIGHT = 2.7;
const WALL_THICKNESS = 0.15;
const DOOR_HEIGHT = 2.1;
const WINDOW_HEIGHT = 1.2;
const WINDOW_SILL = 0.9;
const WINDOW_WIDTH = 1.8;

export type CameraMode = "free" | "top" | "iso";

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

// 벽체 세그먼트 (다크 재질)
function WallSegment({
  start, end, height, thickness, offsetX, offsetY, isExterior,
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
    <mesh position={[cx, height / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, height, thickness]} />
      <PBRMat mat={isExterior ? WALL_DARK : WALL_DARK_INTERIOR} />
    </mesh>
  );
}

// 문틀 프레임
function DoorFrame3D({
  cx, cz, width, angle, wallThickness,
}: {
  cx: number; cz: number; width: number; angle: number; wallThickness: number;
}) {
  const frameProfile = 0.05;
  const frameDepth = wallThickness + 0.02;

  return (
    <group position={[cx, 0, cz]} rotation={[0, -angle, 0]}>
      <mesh position={[-width / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[frameProfile, DOOR_HEIGHT, frameDepth]} />
        <meshStandardMaterial color="#4A4A5A" roughness={0.7} />
      </mesh>
      <mesh position={[width / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[frameProfile, DOOR_HEIGHT, frameDepth]} />
        <meshStandardMaterial color="#4A4A5A" roughness={0.7} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT, 0]}>
        <boxGeometry args={[width + frameProfile * 2, frameProfile, frameDepth]} />
        <meshStandardMaterial color="#4A4A5A" roughness={0.7} />
      </mesh>
    </group>
  );
}

// 창틀 프레임
function WindowFrame3D({
  cx, cz, width, height, angle, wallThickness,
}: {
  cx: number; cz: number; width: number; height: number; angle: number; wallThickness: number;
}) {
  const frameProfile = 0.04;
  const sillDepth = wallThickness + 0.04;
  const midY = WINDOW_SILL + height / 2;

  return (
    <group position={[cx, midY, cz]} rotation={[0, -angle, 0]}>
      {/* 창턱 (sill) */}
      <mesh position={[0, -height / 2 - frameProfile / 2, 0]}>
        <boxGeometry args={[width + 0.06, frameProfile, sillDepth]} />
        <PBRMat mat={TILE} />
      </mesh>
      {/* 좌 프레임 */}
      <mesh position={[-width / 2, 0, 0]}>
        <boxGeometry args={[frameProfile, height, frameProfile]} />
        <meshStandardMaterial color="#E8E8E8" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* 우 프레임 */}
      <mesh position={[width / 2, 0, 0]}>
        <boxGeometry args={[frameProfile, height, frameProfile]} />
        <meshStandardMaterial color="#E8E8E8" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* 상 프레임 */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width + frameProfile * 2, frameProfile, frameProfile]} />
        <meshStandardMaterial color="#E8E8E8" roughness={0.3} metalness={0.1} />
      </mesh>
    </group>
  );
}

// 설비 3D 프리미티브
function Fixture3D({ fixture, offsetX, offsetY }: {
  fixture: FixtureData; offsetX: number; offsetY: number;
}) {
  const x = fixture.position.x - offsetX + fixture.position.width / 2;
  const z = fixture.position.y - offsetY + fixture.position.height / 2;
  const w = fixture.position.width;
  const d = fixture.position.height;

  switch (fixture.type) {
    case "toilet":
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.35, -d * 0.35]} castShadow>
            <boxGeometry args={[w * 0.8, 0.7, d * 0.25]} />
            <PBRMat mat={CERAMIC} />
          </mesh>
          <mesh position={[0, 0.22, d * 0.1]} castShadow>
            <cylinderGeometry args={[w * 0.35, w * 0.3, 0.44, 16]} />
            <PBRMat mat={CERAMIC} />
          </mesh>
        </group>
      );
    case "sink":
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[w, 0.03, d]} />
            <PBRMat mat={CERAMIC} />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[w - 0.02, 0.82, d - 0.02]} />
            <PBRMat mat={WOOD_FLOOR} />
          </mesh>
        </group>
      );
    case "kitchen_sink":
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[w, 0.03, d]} />
            <PBRMat mat={STAINLESS} />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[w - 0.02, 0.82, d - 0.02]} />
            <PBRMat mat={WOOD_FLOOR} />
          </mesh>
        </group>
      );
    case "bathtub":
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[w, 0.6, d]} />
            <PBRMat mat={CERAMIC} />
          </mesh>
        </group>
      );
    case "stove":
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[w, 0.9, d]} />
            <PBRMat mat={STAINLESS} />
          </mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([bx, bz], i) => (
            <mesh key={i} position={[bx * w * 0.2, 0.91, bz * d * 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.06, 0.09, 16]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      );
    default:
      return (
        <mesh position={[x, 0.25, z]} castShadow>
          <boxGeometry args={[w, 0.5, d]} />
          <PBRMat mat={CERAMIC} />
        </mesh>
      );
  }
}

// 벽체 렌더링 (WallData 기반)
function Walls({
  walls, doors, windows, offsetX, offsetY,
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
        const wallDoors = (doors || []).filter((d) => {
          const mx = (wall.start.x + wall.end.x) / 2;
          const my = (wall.start.y + wall.end.y) / 2;
          return Math.sqrt((d.position.x - mx) ** 2 + (d.position.y - my) ** 2) < 1.5;
        });

        const wallWindows = (windows || []).filter((w) => {
          if (w.wallId === wall.id) return true;
          const mx = (wall.start.x + wall.end.x) / 2;
          const my = (wall.start.y + wall.end.y) / 2;
          return Math.sqrt((w.position.x - mx) ** 2 + (w.position.y - my) ** 2) < 1.5;
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
            {wallDoors.length > 0 && (
              <>
                <mesh
                  position={[cx, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, cz]}
                  rotation={[0, -angle, 0]}
                  castShadow
                >
                  <boxGeometry args={[length, WALL_HEIGHT - DOOR_HEIGHT, wt]} />
                  <PBRMat mat={WALL_DARK} />
                </mesh>
                <DoorFrame3D cx={cx} cz={cz} width={0.9} angle={angle} wallThickness={wt} />
              </>
            )}

            {wallWindows.length > 0 && wallDoors.length === 0 && (
              <>
                <mesh position={[cx, WINDOW_SILL / 2, cz]} rotation={[0, -angle, 0]} castShadow>
                  <boxGeometry args={[length, WINDOW_SILL, wt]} />
                  <PBRMat mat={WALL_DARK} />
                </mesh>
                <mesh
                  position={[cx, (WINDOW_SILL + WINDOW_HEIGHT) + (WALL_HEIGHT - WINDOW_SILL - WINDOW_HEIGHT) / 2, cz]}
                  rotation={[0, -angle, 0]}
                  castShadow
                >
                  <boxGeometry args={[length, WALL_HEIGHT - WINDOW_SILL - WINDOW_HEIGHT, wt]} />
                  <PBRMat mat={WALL_DARK} />
                </mesh>
                <mesh position={[cx, WINDOW_SILL + WINDOW_HEIGHT / 2, cz]} rotation={[0, -angle, 0]}>
                  <boxGeometry args={[WINDOW_WIDTH, WINDOW_HEIGHT, 0.02]} />
                  <PBRMat mat={GLASS} />
                </mesh>
                <WindowFrame3D cx={cx} cz={cz} width={WINDOW_WIDTH} height={WINDOW_HEIGHT} angle={angle} wallThickness={wt} />
              </>
            )}
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
        <PBRMat mat={WALL_DARK} />
      </mesh>
      <mesh position={[cx, wh / 2, cz + h / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wh, wt]} />
        <PBRMat mat={WALL_DARK} />
      </mesh>
      <mesh position={[cx - w / 2, wh / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[wt, wh, h]} />
        <PBRMat mat={WALL_DARK_INTERIOR} />
      </mesh>
      <mesh position={[cx + w / 2, wh / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[wt, wh, h]} />
        <PBRMat mat={WALL_DARK_INTERIOR} />
      </mesh>
    </group>
  );
}

// 방 라벨
function RoomLabel({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  let cx: number, cz: number;
  if (room.polygon && room.polygon.length >= 3) {
    let sx = 0, sy = 0;
    for (const p of room.polygon) { sx += p.x; sy += p.y; }
    cx = sx / room.polygon.length - offsetX;
    cz = sy / room.polygon.length - offsetY;
  } else {
    const { x, y, width, height } = room.position;
    cx = x - offsetX + width / 2;
    cz = y - offsetY + height / 2;
  }
  const label = ROOM_TYPE_LABELS[room.type] || room.name;

  return (
    <group>
      <Text position={[cx, 0.05, cz - 0.15]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35} color="#2D2D3D" anchorX="center" anchorY="middle" fontWeight="bold">
        {label}
      </Text>
      <Text position={[cx, 0.05, cz + 0.2]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22} color="#6B7280" anchorX="center" anchorY="middle">
        {`${room.area}m²`}
      </Text>
    </group>
  );
}

// 씬 컨텐츠
function Scene({
  floorPlan, cameraMode, showCeiling, showLabels,
}: {
  floorPlan: ParsedFloorPlan;
  cameraMode: CameraMode;
  showCeiling: boolean;
  showLabels: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const { offsetX, offsetY, totalWidth, totalDepth } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const room of floorPlan.rooms) {
      if (room.polygon) {
        for (const p of room.polygon) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
      } else {
        const { x, y, width, height } = room.position;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width); maxY = Math.max(maxY, y + height);
      }
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { offsetX: cx, offsetY: cy, totalWidth: maxX - minX, totalDepth: maxY - minY };
  }, [floorPlan]);

  const camDist = Math.max(totalWidth, totalDepth) * 1.2;
  const hasWalls = floorPlan.walls && floorPlan.walls.length > 0;

  const camPos = useMemo((): [number, number, number] => {
    switch (cameraMode) {
      case "top": return [0, camDist * 1.5, 0.01];
      case "iso": return [camDist * 0.7, camDist * 0.7, camDist * 0.7];
      default: return [camDist * 0.6, camDist * 0.8, camDist * 0.6];
    }
  }, [cameraMode, camDist]);

  return (
    <>
      <PerspectiveCamera makeDefault position={camPos} fov={50} />
      <OrbitControls
        ref={controlsRef}
        enablePan enableZoom
        enableRotate={cameraMode !== "top"}
        maxPolarAngle={cameraMode === "top" ? 0 : Math.PI / 2.1}
        minDistance={2}
        maxDistance={camDist * 3}
      />

      <Environment preset="apartment" />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={0.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-8, 10, -6]} intensity={0.2} color="#e8f0ff" />

      <EffectComposer>
        <SSAO
          radius={0.4} intensity={15} luminanceInfluence={0.6}
          worldDistanceThreshold={1.0} worldDistanceFalloff={0.1}
          worldProximityThreshold={0.5} worldProximityFalloff={0.1}
        />
        <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.9} intensity={0.1} />
      </EffectComposer>

      <gridHelper args={[50, 50, "#e5e7eb", "#f3f4f6"]} position={[0, 0, 0]} />

      {hasWalls ? (
        <Walls walls={floorPlan.walls} doors={floorPlan.doors} windows={floorPlan.windows} offsetX={offsetX} offsetY={offsetY} />
      ) : (
        floorPlan.rooms.map((room) => (
          <SimpleRoomWalls key={`wall-${room.id}`} room={room} offsetX={offsetX} offsetY={offsetY} />
        ))
      )}

      {floorPlan.rooms.map((room) => (
        <group key={room.id}>
          <RoomFloor room={room} offsetX={offsetX} offsetY={offsetY} />
          {showCeiling && <RoomCeiling room={room} offsetX={offsetX} offsetY={offsetY} />}
          {showLabels && <RoomLabel room={room} offsetX={offsetX} offsetY={offsetY} />}
        </group>
      ))}

      {floorPlan.fixtures?.map((fixture) => (
        <Fixture3D key={fixture.id} fixture={fixture} offsetX={offsetX} offsetY={offsetY} />
      ))}
    </>
  );
}

interface FloorPlan3DProps {
  floorPlan: ParsedFloorPlan;
  className?: string;
  cameraMode?: CameraMode;
  showCeiling?: boolean;
  showLabels?: boolean;
}

export default function FloorPlan3D({
  floorPlan,
  className = "",
  cameraMode: cameraModeExt,
  showCeiling: showCeilingExt,
  showLabels = true,
}: FloorPlan3DProps) {
  const [cameraModeInt, setCameraModeInt] = useState<CameraMode>("free");
  const [showCeilingInt, setShowCeilingInt] = useState(false);

  const cameraMode = cameraModeExt ?? cameraModeInt;
  const showCeiling = showCeilingExt ?? showCeilingInt;
  const hasExternalControl = cameraModeExt !== undefined;

  return (
    <div className={`relative bg-gray-100 ${className}`}>
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <Scene floorPlan={floorPlan} cameraMode={cameraMode} showCeiling={showCeiling} showLabels={showLabels} />
      </Canvas>

      {/* 외부 제어가 없을 때만 내장 UI 표시 */}
      {!hasExternalControl && (
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {(["free", "iso", "top"] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setCameraModeInt(mode)}
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
            onClick={() => setShowCeilingInt(!showCeiling)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shadow-sm transition-colors ${
              showCeiling
                ? "bg-blue-600 text-white"
                : "bg-white/90 text-gray-600 hover:bg-white"
            }`}
          >
            {showCeiling ? "천장 끔" : "천장 켬"}
          </button>
        </div>
      )}

      {!hasExternalControl && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm">
          마우스 드래그: 회전 | 스크롤: 확대/축소 | 우클릭 드래그: 이동
        </div>
      )}
    </div>
  );
}
