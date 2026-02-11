"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import type { ParsedFloorPlan, RoomData } from "@/types/floorplan";
import { ROOM_TYPE_COLORS, ROOM_TYPE_LABELS } from "@/types/floorplan";
import * as THREE from "three";

const WALL_HEIGHT = 2.7; // 벽 높이 (미터)
const WALL_THICKNESS = 0.15;
const SCALE = 1; // 1:1 미터 스케일

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

// 방 바닥 메쉬
function RoomFloor({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  const color = ROOM_TYPE_COLORS[room.type] || "#F5F5F5";
  const [r, g, b] = hexToRgb(color);
  const hasPolygon = room.polygon && room.polygon.length >= 3;

  const shape = useMemo(() => {
    if (!hasPolygon) return null;
    const s = new THREE.Shape();
    s.moveTo((room.polygon![0].x - offsetX) * SCALE, (room.polygon![0].y - offsetY) * SCALE);
    for (let i = 1; i < room.polygon!.length; i++) {
      s.lineTo((room.polygon![i].x - offsetX) * SCALE, (room.polygon![i].y - offsetY) * SCALE);
    }
    s.closePath();
    return s;
  }, [hasPolygon, room.polygon, offsetX, offsetY]);

  if (shape) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={new THREE.Color(r, g, b)} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  const { x, y, width, height } = room.position;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[
        (x - offsetX + width / 2) * SCALE,
        0.01,
        (y - offsetY + height / 2) * SCALE,
      ]}
    >
      <planeGeometry args={[width * SCALE, height * SCALE]} />
      <meshStandardMaterial color={new THREE.Color(r, g, b)} side={THREE.DoubleSide} />
    </mesh>
  );
}

// 방 벽 (사각형 기준 간단 벽)
function RoomWalls({ room, offsetX, offsetY }: { room: RoomData; offsetX: number; offsetY: number }) {
  const { x, y, width, height } = room.position;
  const cx = (x - offsetX + width / 2) * SCALE;
  const cz = (y - offsetY + height / 2) * SCALE;
  const w = width * SCALE;
  const h = height * SCALE;
  const wh = WALL_HEIGHT;
  const wt = WALL_THICKNESS;

  return (
    <group>
      {/* 앞 벽 */}
      <mesh position={[cx, wh / 2, cz - h / 2]}>
        <boxGeometry args={[w, wh, wt]} />
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.6} />
      </mesh>
      {/* 뒷 벽 */}
      <mesh position={[cx, wh / 2, cz + h / 2]}>
        <boxGeometry args={[w, wh, wt]} />
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.6} />
      </mesh>
      {/* 왼쪽 벽 */}
      <mesh position={[cx - w / 2, wh / 2, cz]}>
        <boxGeometry args={[wt, wh, h]} />
        <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} />
      </mesh>
      {/* 오른쪽 벽 */}
      <mesh position={[cx + w / 2, wh / 2, cz]}>
        <boxGeometry args={[wt, wh, h]} />
        <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} />
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
    cx = (sx / room.polygon.length - offsetX) * SCALE;
    cz = (sy / room.polygon.length - offsetY) * SCALE;
  } else {
    const { x, y, width, height } = room.position;
    cx = (x - offsetX + width / 2) * SCALE;
    cz = (y - offsetY + height / 2) * SCALE;
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
function Scene({ floorPlan }: { floorPlan: ParsedFloorPlan }) {
  // 오프셋 계산 (중앙 정렬)
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

  const cameraDistance = Math.max(totalWidth, totalDepth) * 1.2;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance * 0.6, cameraDistance * 0.8, cameraDistance * 0.6]}
        fov={50}
      />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={cameraDistance * 3}
      />

      {/* 조명 */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      {/* 바닥 그리드 */}
      <gridHelper args={[50, 50, "#e5e7eb", "#f3f4f6"]} position={[0, 0, 0]} />

      {/* 방 렌더링 */}
      {floorPlan.rooms.map((room) => (
        <group key={room.id}>
          <RoomFloor room={room} offsetX={offsetX} offsetY={offsetY} />
          <RoomWalls room={room} offsetX={offsetX} offsetY={offsetY} />
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
  return (
    <div className={`relative bg-gray-100 ${className}`}>
      <Canvas shadows>
        <Scene floorPlan={floorPlan} />
      </Canvas>
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm">
        마우스 드래그: 회전 | 스크롤: 확대/축소 | 우클릭 드래그: 이동
      </div>
    </div>
  );
}
