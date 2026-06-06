"use client";

/**
 * 자재 3D 매핑 뷰어 (P3) — 선택 자재 텍스처를 룸 코너(바닥/벽/천정)에 매핑하고
 * 마우스/터치로 360° 회전. @react-three/fiber + drei.
 *
 * 텍스처는 CORS 안전한 우리 Storage 이미지를 권장(없으면 swatch 컬러).
 * 외부(네이버) 이미지는 crossOrigin 제한으로 텍스처 실패할 수 있어 컬러 폴백.
 */
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

type Surface = "floor" | "wall" | "ceiling";

function useTexture(url?: string | null) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (t) => {
        if (!active) return;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 2);
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      () => {
        if (active) setTex(null); // 로드 실패 → 컬러 폴백
      }
    );
    return () => {
      active = false;
    };
  }, [url]);
  return tex;
}

function RoomScene({ surface, textureUrl, color }: { surface: Surface; textureUrl?: string | null; color: string }) {
  const tex = useTexture(textureUrl);
  const neutral = "#ECEAE5";

  const matFor = (s: Surface) => {
    const active = s === surface;
    if (active && tex) return <meshStandardMaterial map={tex} roughness={0.85} />;
    if (active) return <meshStandardMaterial color={color} roughness={0.8} />;
    return <meshStandardMaterial color={neutral} roughness={0.95} />;
  };

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        {matFor("floor")}
      </mesh>
      {/* 뒷벽 */}
      <mesh position={[0, 0, -3]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        {matFor("wall")}
      </mesh>
      {/* 좌측벽 */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        {matFor("wall")}
      </mesh>
      {/* 천정 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.5, 0]}>
        <planeGeometry args={[6, 6]} />
        {matFor("ceiling")}
      </mesh>
    </group>
  );
}

export default function Material3DViewer({
  surface,
  textureUrl,
  color = "#B58A5A",
}: {
  surface: Surface;
  textureUrl?: string | null;
  color?: string;
}) {
  return (
    <Canvas camera={{ position: [4.2, 1.6, 4.2], fov: 42 }} dpr={[1, 2]} shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 4]} intensity={0.8} castShadow />
      <Environment preset="apartment" />
      <RoomScene surface={surface} textureUrl={textureUrl} color={color} />
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.05}
        autoRotate
        autoRotateSpeed={0.8}
      />
    </Canvas>
  );
}
