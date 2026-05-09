/**
 * LIDAR 스캔 파일 (USDZ / OBJ / GLB / PLY) → top-down 평면도 PNG 변환.
 *
 * 흐름 (가이드 옵션 A: RoomPlan/PolyCam → 파일 업로드):
 *   1. 사용자가 iPhone Pro/iPad Pro의 RoomPlan/PolyCam/Scaniverse 같은 앱으로 방 스캔
 *   2. USDZ/OBJ/GLB/PLY 형식으로 export → 우리 사이트에 업로드
 *   3. 이 함수: Three.js로 mesh 로드 → 직교 top-down 카메라로 렌더 → PNG dataURL
 *   4. 그 PNG를 기존 /api/inpick/normalize-floorplan 에 보내 GPT-4o Vision이 치수 추출
 *
 * 모두 클라이언트 측 동작 — 사용자 PC에서 처리, 서버 부하 0.
 *
 * 가이드: 외부 SaaS 사용 금지 정책에 부합 (모든 처리 로컬).
 */
"use client";

import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader.js";

export type LidarFormat = "usdz" | "obj" | "glb" | "gltf" | "ply";

export function detectLidarFormat(filename: string): LidarFormat | null {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "usdz") return "usdz";
  if (ext === "obj") return "obj";
  if (ext === "glb") return "glb";
  if (ext === "gltf") return "gltf";
  if (ext === "ply") return "ply";
  return null;
}

/** 파일 → THREE.Object3D (mesh) */
async function loadMesh(file: File, format: LidarFormat): Promise<THREE.Object3D> {
  const buf = await file.arrayBuffer();

  if (format === "usdz") {
    const loader = new USDZLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      try {
        const obj = loader.parse(buf as ArrayBuffer);
        resolve(obj as unknown as THREE.Object3D);
      } catch (e) {
        reject(e);
      }
    });
  }

  if (format === "obj") {
    const loader = new OBJLoader();
    const text = new TextDecoder().decode(buf);
    return loader.parse(text);
  }

  if (format === "ply") {
    const loader = new PLYLoader();
    const geom = loader.parse(buf);
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
      vertexColors: !!geom.attributes.color,
    });
    return new THREE.Mesh(geom, mat);
  }

  if (format === "glb" || format === "gltf") {
    const loader = new GLTFLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.parse(
        buf as ArrayBuffer,
        "",
        (gltf) => resolve(gltf.scene),
        (err) => reject(err),
      );
    });
  }

  throw new Error(`지원하지 않는 형식: ${format}`);
}

export interface LidarToFloorplanOptions {
  /** 출력 PNG 해상도 — 기본 1024 (정사각형) */
  size?: number;
  /** 배경색 — 기본 흰색 */
  backgroundColor?: number;
  /** 진행 콜백 */
  onProgress?: (stage: "loading" | "rendering" | "done", percent: number) => void;
}

export interface LidarToFloorplanResult {
  /** PNG dataURL (data:image/png;base64,...) */
  dataUrl: string;
  /** mesh의 실 bounding box (m 단위 추정) */
  bboxMm: { width: number; depth: number; height: number };
  /** 처리 시간 ms */
  processingMs: number;
  /** 형식 */
  format: LidarFormat;
}

/**
 * LIDAR 파일 → top-down 평면도 PNG.
 * 메모리 누수 방지 위해 finally에서 dispose.
 */
export async function lidarFileToFloorplan(
  file: File,
  options: LidarToFloorplanOptions = {},
): Promise<LidarToFloorplanResult> {
  const start = Date.now();
  const size = options.size || 1024;
  const bgColor = options.backgroundColor ?? 0xffffff;
  const onProgress = options.onProgress;

  const format = detectLidarFormat(file.name);
  if (!format) {
    throw new Error(`지원하지 않는 파일 확장자 — USDZ/OBJ/GLB/GLTF/PLY 만 지원 (받은 파일: ${file.name})`);
  }

  onProgress?.("loading", 10);

  // 1) Mesh 로드
  const root = await loadMesh(file, format);
  onProgress?.("loading", 50);

  // 2) Bounding box 계산 (평면도 영역 + 실치수 추정)
  const box = new THREE.Box3().setFromObject(root);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // RoomPlan/PolyCam 출력은 보통 m 단위. 우리는 mm 단위로 정규화
  const bboxMm = {
    width: Math.round(sizeVec.x * 1000),
    depth: Math.round(sizeVec.z * 1000), // top-down에선 z가 깊이
    height: Math.round(sizeVec.y * 1000),
  };

  onProgress?.("rendering", 60);

  // 3) Renderer 셋업 (offscreen canvas)
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(bgColor, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.add(root);

  // 조명 — 평면도 가독성 위해 ambient + 위에서 directional
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(0, 10, 0); // 위에서 비추기
  scene.add(dir);

  // 4) 직교 top-down 카메라 (y축 위에서 아래로)
  // bbox xz 평면을 정확히 채우도록 frustum 설정
  const margin = 1.05; // 5% 마진
  const halfX = (sizeVec.x * margin) / 2;
  const halfZ = (sizeVec.z * margin) / 2;
  // 정사각형 캔버스 가장 큰 차원 기준으로 fit
  const half = Math.max(halfX, halfZ);
  const camera = new THREE.OrthographicCamera(
    -half,
    half,
    half,
    -half,
    0.1,
    Math.max(sizeVec.y * 4, 100),
  );
  camera.position.set(center.x, box.max.y + Math.max(sizeVec.y, 5), center.z);
  camera.up.set(0, 0, -1); // top-down에서 +z 방향이 화면 아래
  camera.lookAt(center.x, center.y, center.z);

  onProgress?.("rendering", 80);

  // 5) 렌더 + PNG dataURL
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL("image/png");

  // 6) Cleanup — Three.js 메모리 누수 방지
  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    }
  });
  renderer.dispose();

  onProgress?.("done", 100);

  return {
    dataUrl,
    bboxMm,
    processingMs: Date.now() - start,
    format,
  };
}

/** 사용자 친화적 형식 라벨 */
export const LIDAR_FORMAT_LABEL: Record<LidarFormat, string> = {
  usdz: "USDZ (iOS RoomPlan, PolyCam)",
  obj: "OBJ (PolyCam, Scaniverse)",
  glb: "GLB (PolyCam)",
  gltf: "GLTF",
  ply: "PLY (포인트 클라우드)",
};

/** input[type=file] accept 속성 */
export const LIDAR_FILE_ACCEPT =
  ".usdz,.obj,.glb,.gltf,.ply,model/vnd.usdz+zip,application/octet-stream";
