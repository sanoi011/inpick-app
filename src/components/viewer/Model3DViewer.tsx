"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Text } from "@react-three/drei";
import * as THREE from "three";
import type { ParsedFloorPlan, RoomData, MaterialSelection } from "@/types/floorplan";

// --- Sub-components ---

function RoomLabel({ text, position }: { text: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.lookAt(camera.position);
  });
  return (
    <Text ref={ref} position={position} fontSize={0.22} color="#374151" anchorX="center" anchorY="middle" fontWeight="bold">
      {text}
    </Text>
  );
}

function AreaLabel({ text, position }: { text: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.lookAt(camera.position);
  });
  return (
    <Text ref={ref} position={position} fontSize={0.14} color="#9CA3AF" anchorX="center" anchorY="middle">
      {text}
    </Text>
  );
}

// --- Interactive Room ---

interface InteractiveRoomProps {
  room: RoomData;
  height: number;
  isSelected: boolean;
  isHovered: boolean;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  onPointerDown: (roomId: string) => void;
  onPointerEnter: (roomId: string) => void;
  onPointerLeave: () => void;
}

function InteractiveRoom({
  room, height, isSelected, isHovered,
  wallColor, floorColor, ceilingColor,
  onPointerDown, onPointerEnter, onPointerLeave,
}: InteractiveRoomProps) {
  const { x, y, width: w, height: d } = room.position;
  const centerX = x + w / 2;
  const centerZ = y + d / 2;
  const halfW = w / 2;
  const halfD = d / 2;
  const halfH = height / 2;

  // Highlight colors
  const selectionEmissive = isSelected ? 0x2563eb : isHovered ? 0x60a5fa : 0x000000;
  const emissiveIntensity = isSelected ? 0.15 : isHovered ? 0.08 : 0;

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPointerDown(room.id);
  }, [onPointerDown, room.id]);

  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPointerEnter(room.id);
  }, [onPointerEnter, room.id]);

  return (
    <group position={[centerX, 0, centerZ]}>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={floorColor}
          roughness={0.75}
          emissive={selectionEmissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={ceilingColor} roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, halfH, -halfD]} rotation={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, height]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.7}
          side={THREE.DoubleSide}
          emissive={selectionEmissive}
          emissiveIntensity={emissiveIntensity * 0.6}
        />
      </mesh>

      {/* Left wall */}
      <mesh position={[-halfW, halfH, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, height]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.7}
          side={THREE.DoubleSide}
          emissive={selectionEmissive}
          emissiveIntensity={emissiveIntensity * 0.6}
        />
      </mesh>

      {/* Right wall */}
      <mesh position={[halfW, halfH, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, height]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.7}
          side={THREE.DoubleSide}
          emissive={selectionEmissive}
          emissiveIntensity={emissiveIntensity * 0.6}
        />
      </mesh>

      {/* Baseboard */}
      <mesh position={[0, 0.05, -halfD + 0.01]}>
        <boxGeometry args={[w, 0.1, 0.02]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>
      <mesh position={[-halfW + 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, d]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>
      <mesh position={[halfW - 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, d]} />
        <meshStandardMaterial color="#E8E0D8" />
      </mesh>

      {/* Selection outline on floor */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[w + 0.06, d + 0.06]} />
          <meshBasicMaterial color="#2563EB" transparent opacity={0.25} />
        </mesh>
      )}

      {/* Labels */}
      <RoomLabel text={room.name} position={[0, 0.08, 0]} />
      <AreaLabel text={`${room.area}m²`} position={[0, 0.08, 0.35]} />
    </group>
  );
}

// --- Scene ---

interface SceneProps {
  floorPlan: ParsedFloorPlan;
  selectedArea?: string;
  hoveredArea: string | null;
  materials: Record<string, MaterialSelection>;
  defaultWallColor: string;
  defaultFloorColor: string;
  onAreaClick: (areaId: string) => void;
  onAreaHover: (areaId: string | null) => void;
}

function Scene({ floorPlan, selectedArea, hoveredArea, materials, defaultWallColor, defaultFloorColor, onAreaClick, onAreaHover }: SceneProps) {
  const height = 2.7;

  const getRoomColors = useCallback((roomId: string) => {
    const wallMat = Object.values(materials).find((m) => m.roomId === roomId && m.areaType === "wall");
    const floorMat = Object.values(materials).find((m) => m.roomId === roomId && m.areaType === "floor");
    const ceilingMat = Object.values(materials).find((m) => m.roomId === roomId && m.areaType === "ceiling");

    return {
      wallColor: wallMat?.color || defaultWallColor,
      floorColor: floorMat?.color || defaultFloorColor,
      ceilingColor: ceilingMat?.color || "#FFFFFF",
    };
  }, [materials, defaultWallColor, defaultFloorColor]);

  const handlePointerMiss = useCallback(() => {
    onAreaHover(null);
  }, [onAreaHover]);

  return (
    <>
      {floorPlan.rooms.map((room) => {
        const colors = getRoomColors(room.id);
        return (
          <InteractiveRoom
            key={room.id}
            room={room}
            height={height}
            isSelected={room.id === selectedArea}
            isHovered={room.id === hoveredArea}
            wallColor={colors.wallColor}
            floorColor={colors.floorColor}
            ceilingColor={colors.ceilingColor}
            onPointerDown={onAreaClick}
            onPointerEnter={onAreaHover}
            onPointerLeave={handlePointerMiss}
          />
        );
      })}

      <gridHelper args={[30, 30, "#CCCCCC", "#EEEEEE"]} position={[0, -0.01, 0]} />
    </>
  );
}

// --- Main Component ---

interface Model3DViewerProps {
  floorPlan: ParsedFloorPlan;
  selectedArea?: string;
  onAreaClick?: (areaId: string) => void;
  onAreaHover?: (areaId: string | null) => void;
  materials?: Record<string, MaterialSelection>;
  className?: string;
}

export default function Model3DViewer({
  floorPlan,
  selectedArea,
  onAreaClick,
  onAreaHover,
  materials = {},
  className = "",
}: Model3DViewerProps) {
  const [internalHovered, setInternalHovered] = useState<string | null>(null);

  // Camera position from floor plan bounds
  const maxX = Math.max(...floorPlan.rooms.map((r) => r.position.x + r.position.width));
  const maxZ = Math.max(...floorPlan.rooms.map((r) => r.position.y + r.position.height));
  const camPos: [number, number, number] = [maxX * 0.8, Math.max(maxX, maxZ) * 0.7, maxZ * 0.8];
  const camTarget: [number, number, number] = [maxX / 2, 0, maxZ / 2];

  // Resolve default colors from global materials
  const globalWall = Object.values(materials).find((m) => m.roomId === "__global" && m.areaType === "wall");
  const globalFloor = Object.values(materials).find((m) => m.roomId === "__global" && m.areaType === "floor");
  const defaultWallColor = globalWall?.color || "#F5F0EB";
  const defaultFloorColor = globalFloor?.color || "#C4A882";

  const handleAreaClick = useCallback((areaId: string) => {
    onAreaClick?.(areaId);
  }, [onAreaClick]);

  const handleAreaHover = useCallback((areaId: string | null) => {
    setInternalHovered(areaId);
    onAreaHover?.(areaId);
  }, [onAreaHover]);

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
        <pointLight position={[maxX / 2, 2.5, maxZ / 2]} intensity={0.3} />

        <Environment preset="apartment" background={false} />

        <Scene
          floorPlan={floorPlan}
          selectedArea={selectedArea}
          hoveredArea={internalHovered}
          materials={materials}
          defaultWallColor={defaultWallColor}
          defaultFloorColor={defaultFloorColor}
          onAreaClick={handleAreaClick}
          onAreaHover={handleAreaHover}
        />
      </Canvas>
    </div>
  );
}
