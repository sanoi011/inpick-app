"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Text } from "@react-three/drei";
import * as THREE from "three";

interface RoomConfig {
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  label?: string;
}

const DEFAULT_ROOM: RoomConfig = {
  width: 5,
  depth: 4,
  height: 2.7,
  wallColor: "#F5F0EB",
  floorColor: "#C4A882",
  ceilingColor: "#FFFFFF",
  label: "거실",
};

function Floor({ width, depth, color }: { width: number; depth: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Ceiling({ width, depth, height, color }: { width: number; depth: number; height: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function Wall({ position, rotation, width, height, color }: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomLabel({ text, position }: { text: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.lookAt(camera.position);
    }
  });

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={0.2}
      color="#666666"
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  );
}

function RoomMesh({ config }: { config: RoomConfig }) {
  const { width, depth, height, wallColor, floorColor, ceilingColor, label } = config;
  const halfW = width / 2;
  const halfD = depth / 2;
  const halfH = height / 2;

  return (
    <group>
      <Floor width={width} depth={depth} color={floorColor} />
      <Ceiling width={width} depth={depth} height={height} color={ceilingColor} />

      {/* Back wall */}
      <Wall position={[0, halfH, -halfD]} rotation={[0, 0, 0]} width={width} height={height} color={wallColor} />
      {/* Left wall */}
      <Wall position={[-halfW, halfH, 0]} rotation={[0, Math.PI / 2, 0]} width={depth} height={height} color={wallColor} />
      {/* Right wall */}
      <Wall position={[halfW, halfH, 0]} rotation={[0, -Math.PI / 2, 0]} width={depth} height={height} color={wallColor} />

      {label && <RoomLabel text={label} position={[0, 0.05, 0]} />}

      {/* Baseboard */}
      <mesh position={[0, 0.05, -halfD + 0.01]}>
        <boxGeometry args={[width, 0.1, 0.02]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>
      <mesh position={[-halfW + 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, depth]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>
      <mesh position={[halfW - 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, depth]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>
    </group>
  );
}

// FloorPlan 기반 3D 렌더링
function FloorPlanRoom({ room, wallColor, floorColor, height = 2.7 }: {
  room: { type: string; name: string; position: { x: number; y: number; width: number; height: number } };
  wallColor: string; floorColor: string; height?: number;
}) {
  const { x, y, width: w, height: d } = room.position;
  const centerX = x + w / 2;
  const centerZ = y + d / 2;

  const config: RoomConfig = {
    width: w,
    depth: d,
    height,
    wallColor,
    floorColor,
    ceilingColor: "#FFFFFF",
    label: room.name,
  };

  return (
    <group position={[centerX, 0, centerZ]}>
      <RoomMesh config={config} />
    </group>
  );
}

interface Room3DProps {
  rooms?: RoomConfig[];
  floorPlanRooms?: { type: string; name: string; position: { x: number; y: number; width: number; height: number } }[];
  wallColor?: string;
  floorColor?: string;
  className?: string;
}

export default function Room3D({ rooms, floorPlanRooms, wallColor = "#F5F0EB", floorColor = "#C4A882", className = "" }: Room3DProps) {
  const roomConfigs = rooms && rooms.length > 0 ? rooms : [DEFAULT_ROOM];
  const useFloorPlan = floorPlanRooms && floorPlanRooms.length > 0;

  // 도면 기반일 때 카메라 위치 계산
  let camPos: [number, number, number] = [6, 5, 6];
  let camTarget: [number, number, number] = [0, 1, 0];

  if (useFloorPlan) {
    const maxX = Math.max(...floorPlanRooms.map((r) => r.position.x + r.position.width));
    const maxZ = Math.max(...floorPlanRooms.map((r) => r.position.y + r.position.height));
    camPos = [maxX * 0.8, Math.max(maxX, maxZ) * 0.7, maxZ * 0.8];
    camTarget = [maxX / 2, 0, maxZ / 2];
  }

  return (
    <div className={`w-full h-full bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={camPos} fov={50} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={3}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.1}
          target={camTarget}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[0, 2.5, 0]} intensity={0.3} />

        <Environment preset="apartment" background={false} />

        {useFloorPlan
          ? floorPlanRooms.map((room, i) => (
              <FloorPlanRoom key={i} room={room} wallColor={wallColor} floorColor={floorColor} />
            ))
          : roomConfigs.map((room, i) => (
              <group key={i} position={[i * (room.width + 1), 0, 0]}>
                <RoomMesh config={room} />
              </group>
            ))
        }

        <gridHelper args={[30, 30, "#CCCCCC", "#EEEEEE"]} position={[0, -0.01, 0]} />
      </Canvas>
    </div>
  );
}
