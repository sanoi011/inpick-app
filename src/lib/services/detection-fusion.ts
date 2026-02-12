// src/lib/services/detection-fusion.ts
// Gemini Vision + YOLO 감지 결과 융합

import type { ParsedFloorPlan, FixtureData, DoorData, WindowData } from "@/types/floorplan";
import type { Detection } from "./yolo-floorplan-detector";

interface FusionResult {
  floorPlan: ParsedFloorPlan;
  addedByYolo: number;
  correctedByYolo: number;
}

/**
 * Gemini 결과와 YOLO 감지 결과를 융합
 * - 공간(rooms) 경계는 항상 Gemini 사용 (폴리곤 추출 능력 우수)
 * - 벽(walls)도 Gemini 사용
 * - 문/창/설비: YOLO confidence > 0.5인 결과로 Gemini 보강/수정
 */
export function fuseDetections(
  geminiResult: ParsedFloorPlan,
  yoloDetections: Detection[],
  imageWidth: number,
  imageHeight: number,
  pixelsPerMeter: number,
  offsetX: number,
  offsetY: number
): FusionResult {
  const toMeter = (px: number, off: number) => (px - off) / pixelsPerMeter;
  let addedByYolo = 0;
  let correctedByYolo = 0;

  // 복사본 생성
  const fused: ParsedFloorPlan = {
    totalArea: geminiResult.totalArea,
    rooms: [...geminiResult.rooms],
    walls: [...geminiResult.walls],
    doors: [...geminiResult.doors],
    windows: [...geminiResult.windows],
    fixtures: [...(geminiResult.fixtures || [])],
  };

  // YOLO 감지를 타입별로 분류
  const yoloDoors = yoloDetections.filter(d => d.class === "door_swing" || d.class === "door_sliding");
  const yoloWindows = yoloDetections.filter(d => d.class === "window");
  const yoloFixtures = yoloDetections.filter(d =>
    ["toilet", "sink", "kitchen_sink", "bathtub", "stove"].includes(d.class)
  );

  // 1. 문 융합: YOLO가 감지했지만 Gemini가 놓친 문 추가
  for (const yd of yoloDoors) {
    if (yd.confidence < 0.5) continue;

    const yPos = {
      x: (yd.bbox.x + yd.bbox.w / 2) * imageWidth,
      y: (yd.bbox.y + yd.bbox.h / 2) * imageHeight,
    };

    // 기존 Gemini 문과 겹치는지 확인
    const existingDoor = fused.doors.find(d => {
      const gx = d.position.x * pixelsPerMeter + offsetX;
      const gy = d.position.y * pixelsPerMeter + offsetY;
      const dist = Math.sqrt((gx - yPos.x) ** 2 + (gy - yPos.y) ** 2);
      return dist < 50; // 50px 이내면 동일 문
    });

    if (!existingDoor) {
      // 새 문 추가
      const newDoor: DoorData = {
        id: `door-yolo-${fused.doors.length}`,
        position: {
          x: toMeter(yPos.x, offsetX),
          y: toMeter(yPos.y, offsetY),
        },
        width: yd.class === "door_sliding" ? 1.2 : 0.9,
        rotation: 0,
        type: yd.class === "door_sliding" ? "sliding" : "swing",
        connectedRooms: ["", ""],
      };
      fused.doors.push(newDoor);
      addedByYolo++;
    }
  }

  // 2. 창 융합
  for (const yw of yoloWindows) {
    if (yw.confidence < 0.5) continue;

    const yPos = {
      x: (yw.bbox.x + yw.bbox.w / 2) * imageWidth,
      y: (yw.bbox.y + yw.bbox.h / 2) * imageHeight,
    };

    const existingWindow = fused.windows.find(w => {
      const gx = w.position.x * pixelsPerMeter + offsetX;
      const gy = w.position.y * pixelsPerMeter + offsetY;
      return Math.sqrt((gx - yPos.x) ** 2 + (gy - yPos.y) ** 2) < 50;
    });

    if (!existingWindow) {
      const newWindow: WindowData = {
        id: `window-yolo-${fused.windows.length}`,
        position: {
          x: toMeter(yPos.x, offsetX),
          y: toMeter(yPos.y, offsetY),
        },
        width: yw.bbox.w * imageWidth / pixelsPerMeter,
        height: 1.2,
        rotation: 0,
        wallId: findClosestWall(fused.walls, toMeter(yPos.x, offsetX), toMeter(yPos.y, offsetY)),
      };
      fused.windows.push(newWindow);
      addedByYolo++;
    }
  }

  // 3. 설비 융합
  for (const yf of yoloFixtures) {
    if (yf.confidence < 0.5) continue;

    const yPos = {
      x: (yf.bbox.x + yf.bbox.w / 2) * imageWidth,
      y: (yf.bbox.y + yf.bbox.h / 2) * imageHeight,
    };

    const fixtureType = yf.class as FixtureData["type"];
    const existingFixture = (fused.fixtures || []).find(f => {
      const gx = (f.position.x + f.position.width / 2) * pixelsPerMeter + offsetX;
      const gy = (f.position.y + f.position.height / 2) * pixelsPerMeter + offsetY;
      return Math.sqrt((gx - yPos.x) ** 2 + (gy - yPos.y) ** 2) < 40;
    });

    if (!existingFixture) {
      const fxM = toMeter(yPos.x, offsetX);
      const fyM = toMeter(yPos.y, offsetY);
      const fw = yf.bbox.w * imageWidth / pixelsPerMeter;
      const fh = yf.bbox.h * imageHeight / pixelsPerMeter;

      const newFixture: FixtureData = {
        id: `fixture-yolo-${(fused.fixtures || []).length}`,
        type: fixtureType,
        position: {
          x: fxM - fw / 2,
          y: fyM - fh / 2,
          width: Math.max(fw, 0.3),
          height: Math.max(fh, 0.3),
        },
      };

      // roomId 찾기
      for (const room of fused.rooms) {
        if (room.polygon && pointInPolygon(fxM, fyM, room.polygon)) {
          newFixture.roomId = room.id;
          break;
        }
      }

      if (!fused.fixtures) fused.fixtures = [];
      fused.fixtures.push(newFixture);
      addedByYolo++;
    } else if (yf.confidence > 0.8 && existingFixture.type !== fixtureType) {
      // YOLO가 높은 신뢰도로 다른 타입을 감지 → 보정
      existingFixture.type = fixtureType;
      correctedByYolo++;
    }
  }

  return { floorPlan: fused, addedByYolo, correctedByYolo };
}

function findClosestWall(walls: ParsedFloorPlan["walls"], x: number, y: number): string {
  let minDist = Infinity;
  let closestId = walls.length > 0 ? walls[0].id : "wall-0";

  for (const wall of walls) {
    const mx = (wall.start.x + wall.end.x) / 2;
    const my = (wall.start.y + wall.end.y) / 2;
    const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closestId = wall.id;
    }
  }

  return closestId;
}

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
