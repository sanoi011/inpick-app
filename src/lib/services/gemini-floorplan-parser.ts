// src/lib/services/gemini-floorplan-parser.ts
// Gemini Vision 2.0 Flash 기반 건축 도면 인식 엔진

import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";
import type {
  ParsedFloorPlan,
  RoomData,
  WallData,
  WallType,
  DoorData,
  WindowData,
  FixtureData,
  DimensionData,
  RoomType,
} from "@/types/floorplan";

// ─── Gemini 원시 응답 타입 ───

interface GeminiRoom {
  type: string;
  name: string;
  polygon: { x: number; y: number }[];
  area?: number;
}

interface GeminiWall {
  start: { x: number; y: number };
  end: { x: number; y: number };
  isExterior: boolean;
  thicknessMm?: number;
  wallType?: string; // exterior | structural | partition | insulation
  isLoadBearing?: boolean;
}

interface GeminiDoor {
  position: { x: number; y: number };
  widthMm: number;
  type: string;
  connectedRooms: string[];
  rotation?: number;
}

interface GeminiWindow {
  position: { x: number; y: number };
  widthMm: number;
  heightMm?: number;
  rotation?: number;
}

interface GeminiFixture {
  type: string;
  position: { x: number; y: number };
  widthMm?: number;
  heightMm?: number;
}

interface GeminiDimension {
  valueMm: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface GeminiRawResult {
  rooms: GeminiRoom[];
  walls: GeminiWall[];
  doors: GeminiDoor[];
  windows: GeminiWindow[];
  fixtures: GeminiFixture[];
  dimensions: GeminiDimension[];
  imageWidthPx?: number;
  imageHeightPx?: number;
}

// ─── 시스템 프롬프트 ───

const SYSTEM_PROMPT = `당신은 한국 아파트 건축 도면 전문 분석가입니다.
주어진 평면도 이미지를 분석하여 정확한 공간/벽체/문/창/설비 정보를 JSON으로 추출하세요.

## 중요 원칙
- **단위세대(세대 내부)만 분석**: 공용 복도, 계단실, EV홀, 대피공간, 실외기실 등 세대 외부 공간은 제외
- **각 공간의 실제 경계를 정확히 추적**: 벽체 안쪽 선을 따라 폴리곤 좌표를 지정
- **공간별 크기 차이를 반영**: 거실(가장 큼) > 침실 > 주방 > 욕실/현관(가장 작음)
- **인접한 공간은 벽을 사이에 두고 폴리곤이 맞닿아야 함**

## 공간(rooms) 인식 규칙
- 폴리곤 꼭짓점 좌표로 공간 경계를 정의합니다 (좌상단=원점, 우→x증가, 아래→y증가)
- 좌표 단위: 이미지 픽셀
- 각 공간의 벽체 내부선을 따라 4~8개의 꼭짓점으로 폴리곤을 정의
- 타입 매핑:
  - 거실/LV/Living → LIVING
  - 주방/Kitchen/KIT → KITCHEN (주방/식당이 거실과 연결된 경우에도 별도 공간)
  - 안방/주침실/M.Bed → MASTER_BED (가장 큰 침실)
  - 침실/Bed → BED
  - 욕실/화장실/UB/Bath → BATHROOM
  - 현관/Entrance → ENTRANCE
  - 발코니/Balcony/BAL → BALCONY
  - 다용도/Utility → UTILITY
  - 복도/Hall/Corridor → CORRIDOR
  - 드레스룸/D.R/W.I.C → DRESSROOM

## 벽체(walls) 인식 규칙 - 건축도면 색상/두께 분류 기준
- 모든 벽은 start/end 좌표(픽셀)로 표현
- 벽체는 반드시 wallType과 isLoadBearing을 함께 분류하세요

### 벽체 4분류 (색상/두께/해칭 기준)
1. **exterior** (외벽 내력벽): 건물 외곽 벽. 가장 두꺼운 실선 또는 해칭/채움 패턴.
   - 두께: 200~300mm, isExterior=true, isLoadBearing=true
   - 세대간 경계벽, 코어 주변 구조벽 포함
2. **structural** (내부 내력벽): 건물 내부의 구조 벽. 두꺼운 실선 + 해칭.
   - 두께: 200~250mm, isExterior=false, isLoadBearing=true
   - 철거 불가 (구조 안전)
3. **partition** (비내력 칸막이벽): 방과 방 사이 칸막이. 얇은 실선, 채움 없음.
   - 두께: 100~150mm, isExterior=false, isLoadBearing=false
   - 철거 가능 (인테리어 리모델링 대상)
   - 욕실/주방/드레스룸/다용도실 구획벽 대부분
4. **insulation** (외부 단열재선): 외벽 바깥쪽의 얇은 점선 또는 실선.
   - 두께: 50~100mm, isExterior=true, isLoadBearing=false

### 벽체 분류 우선순위
- 두꺼운 실선 + 건물 외곽 = exterior
- 두꺼운 실선 + 건물 내부 = structural
- 얇은 실선 + 건물 내부 = partition
- 외벽 바깥쪽 얇은 선 = insulation

## 문(doors) 인식 규칙
- 1/4 원호 = 여닫이(swing), 평행선/화살표 = 미닫이(sliding)
- 현관 위치의 방화문 = entrance 타입 (900~1000mm)
- 너비는 mm 단위 (일반 방문: 800-900mm, 현관문: 900-1000mm, 욕실문: 700-800mm, 발코니 미닫이: 1800-2400mm)
- 연결된 두 공간의 name을 connectedRooms에 기입
- type 값: "swing" | "sliding" | "folding" | "entrance"

## 창(windows) 인식 규칙
- 외벽의 이중선/삼중선 = 창문
- 위치, 너비(mm), 높이(mm) 추출
- 거실 창: 2000-3000mm, 침실 창: 1200-2000mm

## 설비(fixtures) 인식 규칙
- 변기(toilet): 타원형+사각형 심볼, 너비 ~400mm, 깊이 ~600mm
- 세면대(sink): 반원형+사각형 심볼, 너비 ~500mm
- 주방 싱크(kitchen_sink): 이중 볼 사각형, 너비 ~800mm
- 욕조(bathtub): 큰 타원형/둥근 사각형, 너비 ~700mm, 길이 ~1500mm
- 가스레인지(stove): 4개 원 격자, 너비 ~600mm

## 치수선(dimensions)
- 도면 치수 텍스트(예: "3,600" = 3600mm)를 감지하고
- 해당 치수의 시작점과 끝점 좌표를 기록
- 이 정보는 좌표 보정에 사용됩니다

반드시 아래 JSON 스키마에 맞춰 출력하세요. 감지되지 않은 항목은 빈 배열로 두세요.`;

const JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    rooms: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const },
          name: { type: "string" as const },
          polygon: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                x: { type: "number" as const },
                y: { type: "number" as const },
              },
              required: ["x", "y"],
            },
          },
          area: { type: "number" as const },
        },
        required: ["type", "name", "polygon"],
      },
    },
    walls: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          start: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          end: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          isExterior: { type: "boolean" as const },
          thicknessMm: { type: "number" as const },
          wallType: { type: "string" as const },
          isLoadBearing: { type: "boolean" as const },
        },
        required: ["start", "end", "isExterior"],
      },
    },
    doors: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          position: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          widthMm: { type: "number" as const },
          type: { type: "string" as const },
          connectedRooms: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          rotation: { type: "number" as const },
        },
        required: ["position", "widthMm", "type"],
      },
    },
    windows: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          position: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          widthMm: { type: "number" as const },
          heightMm: { type: "number" as const },
          rotation: { type: "number" as const },
        },
        required: ["position", "widthMm"],
      },
    },
    fixtures: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const },
          position: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          widthMm: { type: "number" as const },
          heightMm: { type: "number" as const },
        },
        required: ["type", "position"],
      },
    },
    dimensions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          valueMm: { type: "number" as const },
          start: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
          end: {
            type: "object" as const,
            properties: {
              x: { type: "number" as const },
              y: { type: "number" as const },
            },
            required: ["x", "y"],
          },
        },
        required: ["valueMm", "start", "end"],
      },
    },
    imageWidthPx: { type: "number" as const },
    imageHeightPx: { type: "number" as const },
  },
  required: ["rooms", "walls", "doors", "windows", "fixtures", "dimensions"],
};

// ─── 좌표 보정 ───

/** PyMuPDF 벡터 추출 치수 힌트 */
interface VectorDimensionHint {
  text: string;
  value_mm: number;
  x: number;
  y: number;
}

interface CalibrationOptions {
  knownAreaM2?: number; // 전용면적 (건물정보에서 전달)
  sourceType?: "pdf" | "photo" | "scan" | "hand_drawing";
  /** PyMuPDF에서 추출한 치수 텍스트 (mm 값) */
  dimensionHints?: VectorDimensionHint[];
  /** PyMuPDF 스케일 (m/pt) */
  vectorScale?: number;
}

const HAND_DRAWING_PROMPT_ADDITION = `
## 추가 지침 (손도면)
이것은 손으로 그린 평면도 스케치입니다. 다음 사항을 고려하세요:
- 직선으로 보이는 선은 벽으로 인식하세요
- 손으로 그린 기호(원, 사각형 등)를 문/설비로 인식하세요
- 손글씨 텍스트에서 공간 이름을 읽어주세요
- 비율이 정확하지 않을 수 있으므로 텍스트 치수를 우선합니다
- 연필/펜 선이 불규칙해도 벽체로 해석하세요`;

function calibrateCoordinates(
  raw: GeminiRawResult,
  options: CalibrationOptions
): { pixelsPerMeter: number; offsetX: number; offsetY: number } {
  let pixelsPerMeter = 0;

  // 방법 1: 치수선 앵커
  if (raw.dimensions && raw.dimensions.length > 0) {
    const validDims = raw.dimensions.filter((d) => d.valueMm > 100 && d.valueMm < 20000);
    if (validDims.length > 0) {
      let totalRatio = 0;
      for (const dim of validDims) {
        const pxDist = Math.sqrt(
          (dim.end.x - dim.start.x) ** 2 + (dim.end.y - dim.start.y) ** 2
        );
        const meterDist = dim.valueMm / 1000;
        if (pxDist > 10 && meterDist > 0.1) {
          totalRatio += pxDist / meterDist;
        }
      }
      if (totalRatio > 0) {
        pixelsPerMeter = totalRatio / validDims.length;
      }
    }
  }

  // 방법 2: 전용면적 역산
  if (pixelsPerMeter === 0 && options.knownAreaM2 && raw.rooms.length > 0) {
    let totalPixelArea = 0;
    for (const room of raw.rooms) {
      totalPixelArea += calcPolygonArea(room.polygon);
    }
    if (totalPixelArea > 100) {
      pixelsPerMeter = Math.sqrt(totalPixelArea / options.knownAreaM2);
    }
  }

  // 방법 3: 표준 문 폭 (900mm) 기준
  if (pixelsPerMeter === 0 && raw.doors.length > 0) {
    const avgDoorWidthPx =
      raw.doors.reduce((s, d) => s + (d.widthMm > 0 ? d.widthMm : 50), 0) / raw.doors.length;
    // Gemini가 widthMm 단위로 줬다면 그대로 사용, 아니면 픽셀로 간주
    if (avgDoorWidthPx > 500) {
      // Gemini가 mm 단위로 반환 → 픽셀과 무관
      pixelsPerMeter = 200; // 폴백
    } else {
      pixelsPerMeter = avgDoorWidthPx / 0.9; // 평균 문 폭 ≈ 0.9m
    }
  }

  // 최종 폴백
  if (pixelsPerMeter === 0) {
    pixelsPerMeter = 200; // 기본 가정
  }

  // 바운딩박스 오프셋 계산 (모든 방의 최소 좌표를 원점으로)
  let minX = Infinity;
  let minY = Infinity;
  for (const room of raw.rooms) {
    for (const pt of room.polygon) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
    }
  }
  // 벽 좌표도 포함
  for (const wall of raw.walls) {
    if (wall.start.x < minX) minX = wall.start.x;
    if (wall.start.y < minY) minY = wall.start.y;
    if (wall.end.x < minX) minX = wall.end.x;
    if (wall.end.y < minY) minY = wall.end.y;
  }

  return {
    pixelsPerMeter,
    offsetX: isFinite(minX) ? minX : 0,
    offsetY: isFinite(minY) ? minY : 0,
  };
}

function calcPolygonArea(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── RoomType 매핑 ───

const ROOM_TYPE_MAP: Record<string, RoomType> = {
  LIVING: "LIVING",
  KITCHEN: "KITCHEN",
  MASTER_BED: "MASTER_BED",
  BED: "BED",
  BATHROOM: "BATHROOM",
  ENTRANCE: "ENTRANCE",
  BALCONY: "BALCONY",
  UTILITY: "UTILITY",
  CORRIDOR: "CORRIDOR",
  DRESSROOM: "DRESSROOM",
  // Korean aliases
  "거실": "LIVING",
  "주방": "KITCHEN",
  "안방": "MASTER_BED",
  "주침실": "MASTER_BED",
  "침실": "BED",
  "욕실": "BATHROOM",
  "화장실": "BATHROOM",
  "현관": "ENTRANCE",
  "발코니": "BALCONY",
  "다용도실": "UTILITY",
  "복도": "CORRIDOR",
  "드레스룸": "DRESSROOM",
};

function mapRoomType(raw: string): RoomType {
  const upper = raw.toUpperCase().trim();
  if (ROOM_TYPE_MAP[upper]) return ROOM_TYPE_MAP[upper];
  if (ROOM_TYPE_MAP[raw]) return ROOM_TYPE_MAP[raw];
  // fuzzy match
  if (upper.includes("LIVING") || upper.includes("거실")) return "LIVING";
  if (upper.includes("KITCHEN") || upper.includes("주방")) return "KITCHEN";
  if (upper.includes("MASTER") || upper.includes("안방") || upper.includes("주침")) return "MASTER_BED";
  if (upper.includes("BED") || upper.includes("침실")) return "BED";
  if (upper.includes("BATH") || upper.includes("욕실") || upper.includes("화장실")) return "BATHROOM";
  if (upper.includes("ENTRANCE") || upper.includes("현관")) return "ENTRANCE";
  if (upper.includes("BALCON") || upper.includes("발코니")) return "BALCONY";
  if (upper.includes("UTIL") || upper.includes("다용도")) return "UTILITY";
  if (upper.includes("CORR") || upper.includes("HALL") || upper.includes("복도")) return "CORRIDOR";
  if (upper.includes("DRESS") || upper.includes("W.I.C") || upper.includes("드레스")) return "DRESSROOM";
  return "UTILITY";
}

// ─── 후처리 ───

function postProcess(
  raw: GeminiRawResult,
  calib: { pixelsPerMeter: number; offsetX: number; offsetY: number }
): ParsedFloorPlan {
  const ppm = calib.pixelsPerMeter;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const toM = (px: number, offset: number) => round((px - offset) / ppm);

  // Rooms
  const rooms: RoomData[] = [];
  const bedrooms: number[] = [];
  const nameCount: Record<string, number> = {};

  for (let i = 0; i < raw.rooms.length; i++) {
    const r = raw.rooms[i];
    const type = mapRoomType(r.type);

    // 폴리곤 좌표 변환
    const polygon = r.polygon.map((p) => ({
      x: toM(p.x, calib.offsetX),
      y: toM(p.y, calib.offsetY),
    }));

    // 면적 계산 (미터 좌표)
    const area = round(calcPolygonArea(polygon));

    // 바운딩 박스
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    if (type === "BED" || type === "MASTER_BED") {
      bedrooms.push(i);
    }

    rooms.push({
      id: `room-${i}`,
      type,
      name: r.name || type,
      area,
      position: {
        x: round(minX),
        y: round(minY),
        width: round(maxX - minX),
        height: round(maxY - minY),
      },
      polygon,
    });
  }

  // MASTER_BED 식별 (가장 큰 침실)
  if (bedrooms.length > 0) {
    let maxArea = 0;
    let maxIdx = bedrooms[0];
    for (const idx of bedrooms) {
      if (rooms[idx].area > maxArea) {
        maxArea = rooms[idx].area;
        maxIdx = idx;
      }
    }
    rooms[maxIdx].type = "MASTER_BED";
    rooms[maxIdx].name = "안방";
    for (const idx of bedrooms) {
      if (idx !== maxIdx && rooms[idx].type === "MASTER_BED") {
        rooms[idx].type = "BED";
      }
    }
  }

  // 중복 실명 번호 부여
  for (const room of rooms) {
    nameCount[room.name] = (nameCount[room.name] || 0) + 1;
  }
  const nameIdx: Record<string, number> = {};
  for (const room of rooms) {
    if (nameCount[room.name] > 1) {
      nameIdx[room.name] = (nameIdx[room.name] || 0) + 1;
      room.name = `${room.name}${nameIdx[room.name]}`;
    }
  }

  // Walls - Gemini의 wallType 분류 결과를 직접 사용
  const walls: WallData[] = raw.walls.map((w, i) => {
    // Gemini가 wallType을 반환했으면 직접 사용, 아니면 기존 로직으로 추론
    let wallType: WallType;
    let isLoadBearing: boolean;
    if (w.wallType && ['exterior', 'structural', 'partition', 'insulation'].includes(w.wallType)) {
      wallType = w.wallType as WallType;
      isLoadBearing = w.isLoadBearing ?? (wallType === 'exterior' || wallType === 'structural');
    } else {
      // 폴백: 두께/isExterior 기반 추론
      const t = w.thicknessMm || (w.isExterior ? 200 : 120);
      if (w.isExterior && t >= 150) {
        wallType = 'exterior';
        isLoadBearing = true;
      } else if (!w.isExterior && t >= 180) {
        wallType = 'structural';
        isLoadBearing = true;
      } else {
        wallType = 'partition';
        isLoadBearing = false;
      }
    }

    return {
      id: `wall-${i}`,
      start: { x: toM(w.start.x, calib.offsetX), y: toM(w.start.y, calib.offsetY) },
      end: { x: toM(w.end.x, calib.offsetX), y: toM(w.end.y, calib.offsetY) },
      thickness: w.thicknessMm ? w.thicknessMm / 1000 : w.isExterior ? 0.2 : 0.12,
      isExterior: w.isExterior,
      wallType,
      isLoadBearing,
    };
  });

  // 벽 데이터가 없으면 room 폴리곤에서 합성
  if (walls.length === 0 && rooms.length > 0) {
    const syntheticWalls = generateWallsFromRooms(rooms);
    walls.push(...syntheticWalls);
  }

  // Doors
  const doors: DoorData[] = raw.doors.map((d, i) => ({
    id: `door-${i}`,
    position: { x: toM(d.position.x, calib.offsetX), y: toM(d.position.y, calib.offsetY) },
    width: d.widthMm > 100 ? d.widthMm / 1000 : d.widthMm / ppm, // mm or px
    rotation: d.rotation || 0,
    type: (d.type === "sliding" ? "sliding" : d.type === "folding" ? "folding" : d.type === "entrance" ? "entrance" : "swing") as DoorData["type"],
    connectedRooms: [
      d.connectedRooms?.[0] || "",
      d.connectedRooms?.[1] || "",
    ] as [string, string],
  }));

  // Windows
  const windows: WindowData[] = raw.windows.map((w, i) => {
    // 가장 가까운 벽 찾기
    let closestWallId = walls.length > 0 ? walls[0].id : "wall-0";
    let minDist = Infinity;
    const wx = toM(w.position.x, calib.offsetX);
    const wy = toM(w.position.y, calib.offsetY);
    for (const wall of walls) {
      const mx = (wall.start.x + wall.end.x) / 2;
      const my = (wall.start.y + wall.end.y) / 2;
      const dist = Math.sqrt((wx - mx) ** 2 + (wy - my) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestWallId = wall.id;
      }
    }

    return {
      id: `window-${i}`,
      position: { x: wx, y: wy },
      width: w.widthMm > 100 ? w.widthMm / 1000 : w.widthMm / ppm,
      height: w.heightMm ? (w.heightMm > 100 ? w.heightMm / 1000 : 1.2) : 1.2,
      rotation: w.rotation || 0,
      wallId: closestWallId,
    };
  });

  // Fixtures
  const fixtures: FixtureData[] = raw.fixtures.map((f, i) => {
    const fx = toM(f.position.x, calib.offsetX);
    const fy = toM(f.position.y, calib.offsetY);
    const fw = f.widthMm ? f.widthMm / 1000 : 0.5;
    const fh = f.heightMm ? f.heightMm / 1000 : 0.5;

    // 해당 fixture가 속한 room 찾기
    let roomId: string | undefined;
    for (const room of rooms) {
      if (room.polygon && pointInPolygon(fx, fy, room.polygon)) {
        roomId = room.id;
        break;
      }
    }

    const fixtureType = mapFixtureType(f.type);

    return {
      id: `fixture-${i}`,
      type: fixtureType,
      position: { x: round(fx - fw / 2), y: round(fy - fh / 2), width: fw, height: fh },
      roomId,
    };
  });

  // ─── 유효성 검증 ───

  // 0면적/극소 면적 방 필터링
  const validRooms = rooms.filter(r => {
    if (!isFinite(r.area) || r.area < 0.5) return false;
    if (!isFinite(r.position.x) || !isFinite(r.position.y)) return false;
    if (r.position.width <= 0 || r.position.height <= 0) return false;
    return true;
  });

  // 극소 벽 필터링
  const validWalls = walls.filter(w => {
    const len = Math.sqrt((w.end.x - w.start.x) ** 2 + (w.end.y - w.start.y) ** 2);
    return isFinite(len) && len >= 0.3;
  });

  // fixture roomId 존재 검증
  const roomIds = new Set(validRooms.map(r => r.id));
  for (const fix of fixtures) {
    if (fix.roomId && !roomIds.has(fix.roomId)) {
      fix.roomId = undefined;
    }
  }

  // ID 재부여 (필터링 후)
  validRooms.forEach((r, i) => { r.id = `room-${i}`; });
  validWalls.forEach((w, i) => { w.id = `wall-${i}`; });

  // 재질 자동 매핑 + center 계산
  const TILE_ROOMS = new Set<string>(['BATHROOM', 'ENTRANCE', 'BALCONY', 'UTILITY']);
  for (const room of validRooms) {
    // 바닥 재질
    room.material = TILE_ROOMS.has(room.type) ? 'tile' : 'wood';

    // 중심점 (폴리곤 centroid 또는 position 중심)
    if (room.polygon && room.polygon.length >= 3) {
      let cx = 0, cy = 0;
      for (const p of room.polygon) { cx += p.x; cy += p.y; }
      room.center = { x: round(cx / room.polygon.length), y: round(cy / room.polygon.length) };
    } else {
      room.center = {
        x: round(room.position.x + room.position.width / 2),
        y: round(room.position.y + room.position.height / 2),
      };
    }
  }

  // 벽 타입 매핑 (Gemini가 wallType을 주지 않은 벽만 보정)
  for (const wall of validWalls) {
    if (!wall.wallType) {
      wall.wallType = wall.isExterior ? 'exterior' : (wall.thickness <= 0.1 ? 'partition' : 'interior');
    }
  }

  // 치수선 데이터 보존 (Gemini 인식 결과)
  const dimensions: DimensionData[] = (raw.dimensions || []).map((d, i) => ({
    id: `dim-${i}`,
    startPoint: { x: toM(d.start.x, calib.offsetX), y: toM(d.start.y, calib.offsetY) },
    endPoint: { x: toM(d.end.x, calib.offsetX), y: toM(d.end.y, calib.offsetY) },
    valueMm: d.valueMm,
    label: `${d.valueMm}`,
  }));

  // totalArea
  const totalArea = round(validRooms.reduce((s, r) => s + r.area, 0));

  return {
    totalArea,
    rooms: validRooms,
    walls: validWalls,
    doors,
    windows,
    fixtures,
    ...(dimensions.length > 0 ? { dimensions } : {}),
  };
}

function mapFixtureType(raw: string): FixtureData["type"] {
  const lower = raw.toLowerCase();
  if (lower.includes("toilet") || lower.includes("변기")) return "toilet";
  if (lower.includes("kitchen") || lower.includes("싱크")) return "kitchen_sink";
  if (lower.includes("sink") || lower.includes("세면")) return "sink";
  if (lower.includes("bathtub") || lower.includes("bath") || lower.includes("욕조")) return "bathtub";
  if (lower.includes("stove") || lower.includes("레인지") || lower.includes("가스")) return "stove";
  return "sink";
}

// ─── 합성 벽 생성 (room 폴리곤 기반) ───

function generateWallsFromRooms(rooms: RoomData[]): WallData[] {
  const walls: WallData[] = [];
  const allEdges: { start: { x: number; y: number }; end: { x: number; y: number }; roomId: string }[] = [];

  for (const room of rooms) {
    if (!room.polygon || room.polygon.length < 3) continue;
    const pts = room.polygon;
    for (let i = 0; i < pts.length; i++) {
      const next = (i + 1) % pts.length;
      allEdges.push({
        start: pts[i],
        end: pts[next],
        roomId: room.id,
      });
    }
  }

  // 겹치는 엣지 = 내벽, 겹치지 않는 = 외벽
  const usedEdges = new Set<number>();
  const TOLERANCE = 0.15;

  for (let i = 0; i < allEdges.length; i++) {
    if (usedEdges.has(i)) continue;
    const e1 = allEdges[i];
    let isInterior = false;

    for (let j = i + 1; j < allEdges.length; j++) {
      if (usedEdges.has(j)) continue;
      const e2 = allEdges[j];
      if (e1.roomId === e2.roomId) continue;

      // 반대 방향이거나 같은 방향으로 겹치는지 확인
      const dist1 = Math.sqrt((e1.start.x - e2.end.x) ** 2 + (e1.start.y - e2.end.y) ** 2);
      const dist2 = Math.sqrt((e1.end.x - e2.start.x) ** 2 + (e1.end.y - e2.start.y) ** 2);
      const dist3 = Math.sqrt((e1.start.x - e2.start.x) ** 2 + (e1.start.y - e2.start.y) ** 2);
      const dist4 = Math.sqrt((e1.end.x - e2.end.x) ** 2 + (e1.end.y - e2.end.y) ** 2);

      if ((dist1 < TOLERANCE && dist2 < TOLERANCE) || (dist3 < TOLERANCE && dist4 < TOLERANCE)) {
        isInterior = true;
        usedEdges.add(j);
        break;
      }
    }

    const wallLen = Math.sqrt((e1.end.x - e1.start.x) ** 2 + (e1.end.y - e1.start.y) ** 2);
    if (wallLen < 0.3) continue;

    walls.push({
      id: `wall-${walls.length}`,
      start: e1.start,
      end: e1.end,
      thickness: isInterior ? 0.12 : 0.18,
      isExterior: !isInterior,
    });
    usedEdges.add(i);
  }

  return walls;
}

// ─── Mock 폴백 ───

function getMockFloorPlan(knownArea?: number): ParsedFloorPlan {
  const area = knownArea || 84;
  return {
    totalArea: area,
    rooms: [
      { id: "room-0", type: "LIVING", name: "거실", area: area * 0.33, position: { x: 0, y: 0, width: 7, height: 4 } },
      { id: "room-1", type: "KITCHEN", name: "주방", area: area * 0.12, position: { x: 7, y: 0, width: 4, height: 2.5 } },
      { id: "room-2", type: "MASTER_BED", name: "안방", area: area * 0.19, position: { x: 0, y: 4, width: 4, height: 4 } },
      { id: "room-3", type: "BED", name: "침실", area: area * 0.14, position: { x: 4, y: 4, width: 3, height: 4 } },
      { id: "room-4", type: "BATHROOM", name: "욕실1", area: area * 0.07, position: { x: 7, y: 2.5, width: 3, height: 2 } },
      { id: "room-5", type: "BATHROOM", name: "욕실2", area: area * 0.05, position: { x: 7, y: 4.5, width: 2, height: 2 } },
      { id: "room-6", type: "ENTRANCE", name: "현관", area: area * 0.05, position: { x: 9, y: 4.5, width: 2, height: 2 } },
      { id: "room-7", type: "BALCONY", name: "발코니", area: area * 0.05, position: { x: 0, y: -1.5, width: 7, height: 1.5 } },
    ],
    walls: [],
    doors: [],
    windows: [],
  };
}

// ─── 메인 함수 ───

function buildUserPrompt(options: CalibrationOptions): string {
  const isHandDrawing = options.sourceType === "hand_drawing";
  let prompt = `이 ${isHandDrawing ? "손으로 그린 평면도 스케치를" : "건축 도면을"} 분석하여 JSON으로 출력하세요.`;

  if (options.knownAreaM2) {
    prompt += ` 참고: 이 세대의 전용면적은 ${options.knownAreaM2}m²입니다.`;
  }

  // PyMuPDF 벡터 치수 힌트 주입
  if (options.dimensionHints && options.dimensionHints.length > 0) {
    const uniqueValues = Array.from(new Set(options.dimensionHints.map(d => d.value_mm))).sort((a, b) => b - a);
    const topValues = uniqueValues.slice(0, 20);
    prompt += `\n\n참고: PDF 벡터 데이터에서 추출된 치수값(mm): ${topValues.join(", ")}`;
    prompt += `\n이 치수값들을 참고하여 각 벽체/공간의 크기를 더 정확하게 산출하세요.`;
    // 가장 큰 치수는 전체 폭/깊이
    if (topValues[0] > 5000) {
      prompt += ` 전체 세대의 최대 치수는 약 ${topValues[0]}mm입니다.`;
    }
  }

  return prompt;
}

export interface FloorPlanParseResult {
  floorPlan: ParsedFloorPlan;
  confidence: number;
  warnings: string[];
  processingTimeMs: number;
  method: "gemini_vision" | "mock";
}

export async function extractFloorPlanFromImage(
  imageBase64: string,
  mimeType: string,
  options: CalibrationOptions = {}
): Promise<FloorPlanParseResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  if (!isGeminiConfigured()) {
    warnings.push("Gemini API 키가 설정되지 않아 Mock 데이터를 반환합니다");
    return {
      floorPlan: getMockFloorPlan(options.knownAreaM2),
      confidence: 0.3,
      warnings,
      processingTimeMs: Date.now() - startTime,
      method: "mock",
    };
  }

  const client = getGeminiClient();
  if (!client) {
    warnings.push("Gemini 클라이언트 초기화 실패");
    return {
      floorPlan: getMockFloorPlan(options.knownAreaM2),
      confidence: 0.3,
      warnings,
      processingTimeMs: Date.now() - startTime,
      method: "mock",
    };
  }

  // 모델 폴백 순서: 2.5-flash → 2.0-flash → 2.0-flash-lite → 2.5-flash-lite
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];

  try {
    let text = "";
    let lastError: unknown = null;

    for (const modelName of MODELS) {
      try {
        console.log(`[floorplan-parser] Trying model: ${modelName}`);
        const response = await client.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                { text: SYSTEM_PROMPT + (options.sourceType === "hand_drawing" ? HAND_DRAWING_PROMPT_ADDITION : "") },
                {
                  inlineData: {
                    mimeType: mimeType as "image/png" | "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  text: buildUserPrompt(options),
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: JSON_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 16384,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        text = response.text || "";
        console.log(`[floorplan-parser] Success with model: ${modelName}`);
        break; // 성공
      } catch (modelError) {
        lastError = modelError;
        const errMsg = modelError instanceof Error ? modelError.message : String(modelError);
        const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
        if (isRateLimit && modelName !== MODELS[MODELS.length - 1]) {
          console.warn(`[floorplan-parser] Rate limited on ${modelName}, trying next model...`);
          warnings.push(`${modelName} 할당량 초과, 다른 모델로 재시도`);
          continue;
        }
        throw modelError; // 마지막 모델이거나 rate limit이 아닌 에러
      }
    }

    if (!text && lastError) {
      throw lastError;
    }

    console.log(`[floorplan-parser] Response length: ${text.length}`);
    let rawResult: GeminiRawResult;

    try {
      // Gemini가 markdown 코드블록으로 감쌀 수 있음
      let jsonText = text;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      rawResult = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("[floorplan-parser] JSON parse error:", parseErr);
      console.error("[floorplan-parser] Raw text (first 1000):", text.substring(0, 1000));
      warnings.push("Gemini 응답 JSON 파싱 실패, Mock 폴백");
      return {
        floorPlan: getMockFloorPlan(options.knownAreaM2),
        confidence: 0.2,
        warnings,
        processingTimeMs: Date.now() - startTime,
        method: "mock",
      };
    }

    // 원시 결과 로깅
    console.log(`[floorplan-parser] Raw: ${rawResult.rooms?.length || 0} rooms, ${rawResult.walls?.length || 0} walls, ${rawResult.dimensions?.length || 0} dims`);
    if (rawResult.rooms?.[0]?.polygon?.[0]) {
      const p = rawResult.rooms[0].polygon[0];
      console.log(`[floorplan-parser] First room first point: (${p.x}, ${p.y}) - ${rawResult.rooms[0].name}`);
    }
    if (rawResult.dimensions?.[0]) {
      const d = rawResult.dimensions[0];
      console.log(`[floorplan-parser] First dim: ${d.valueMm}mm, (${d.start.x},${d.start.y})→(${d.end.x},${d.end.y})`);
    }

    // 결과 검증
    if (!rawResult.rooms || rawResult.rooms.length === 0) {
      warnings.push("공간이 감지되지 않았습니다");
      return {
        floorPlan: getMockFloorPlan(options.knownAreaM2),
        confidence: 0.2,
        warnings,
        processingTimeMs: Date.now() - startTime,
        method: "mock",
      };
    }

    // 좌표 보정
    const calibration = calibrateCoordinates(rawResult, options);

    // 후처리
    const floorPlan = postProcess(rawResult, calibration);

    // 면적 정규화: knownArea가 주어진 경우 전체 스케일 보정
    if (options.knownAreaM2 && floorPlan.totalArea > 0) {
      const areaRatio = floorPlan.totalArea / options.knownAreaM2;
      if (areaRatio > 1.1 || areaRatio < 0.9) {
        // 면적 비율이 10% 이상 차이나면 스케일 보정
        const linearScale = Math.sqrt(areaRatio); // √(detected/known)
        const round = (v: number) => Math.round(v * 1000) / 1000;
        console.log(`[floorplan-parser] Area normalization: ${floorPlan.totalArea}m² → ${options.knownAreaM2}m² (scale: ${linearScale.toFixed(3)})`);

        for (const room of floorPlan.rooms) {
          room.position.x = round(room.position.x / linearScale);
          room.position.y = round(room.position.y / linearScale);
          room.position.width = round(room.position.width / linearScale);
          room.position.height = round(room.position.height / linearScale);
          room.area = round(room.area / (linearScale * linearScale));
          if (room.polygon) {
            room.polygon = room.polygon.map(p => ({
              x: round(p.x / linearScale),
              y: round(p.y / linearScale),
            }));
          }
        }
        for (const wall of floorPlan.walls) {
          wall.start = { x: round(wall.start.x / linearScale), y: round(wall.start.y / linearScale) };
          wall.end = { x: round(wall.end.x / linearScale), y: round(wall.end.y / linearScale) };
        }
        for (const door of floorPlan.doors) {
          door.position = { x: round(door.position.x / linearScale), y: round(door.position.y / linearScale) };
        }
        for (const win of floorPlan.windows) {
          win.position = { x: round(win.position.x / linearScale), y: round(win.position.y / linearScale) };
        }
        if (floorPlan.fixtures) {
          for (const fix of floorPlan.fixtures) {
            fix.position.x = round(fix.position.x / linearScale);
            fix.position.y = round(fix.position.y / linearScale);
            fix.position.width = round(fix.position.width / linearScale);
            fix.position.height = round(fix.position.height / linearScale);
          }
        }
        floorPlan.totalArea = round(floorPlan.rooms.reduce((s, r) => s + r.area, 0));
      }
    }

    // 신뢰도 계산
    let confidence = 0.5;
    if (rawResult.dimensions && rawResult.dimensions.length > 0) confidence += 0.15;
    if (rawResult.walls.length > 0) confidence += 0.1;
    if (rawResult.doors.length > 0) confidence += 0.05;
    if (rawResult.windows.length > 0) confidence += 0.05;
    if (rawResult.fixtures.length > 0) confidence += 0.05;
    if (floorPlan.rooms.length >= 4) confidence += 0.05;
    // PyMuPDF 벡터 힌트 보너스: 치수 텍스트가 풍부하면 보정 정확도 향상
    if (options.dimensionHints && options.dimensionHints.length >= 10) confidence += 0.05;
    if (options.knownAreaM2) {
      const areaError = Math.abs(floorPlan.totalArea - options.knownAreaM2) / options.knownAreaM2;
      if (areaError < 0.1) confidence += 0.05;
      else if (areaError > 0.3) {
        confidence -= 0.1;
        warnings.push(`면적 오차 ${Math.round(areaError * 100)}% (감지: ${floorPlan.totalArea}m², 실제: ${options.knownAreaM2}m²)`);
      }
    }
    confidence = Math.min(1, Math.max(0, confidence));

    // 경고 생성
    if (floorPlan.walls.length === 0) warnings.push("벽체 데이터가 감지되지 않아 합성 벽을 생성했습니다");
    if (floorPlan.doors.length === 0) warnings.push("문이 감지되지 않았습니다");
    if (floorPlan.windows.length === 0) warnings.push("창문이 감지되지 않았습니다");

    const hasBathroom = floorPlan.rooms.some((r) => r.type === "BATHROOM");
    if (!hasBathroom) warnings.push("욕실이 감지되지 않았습니다");

    return {
      floorPlan,
      confidence,
      warnings,
      processingTimeMs: Date.now() - startTime,
      method: "gemini_vision",
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    warnings.push(`Gemini API 오류: ${errMsg}`);
    return {
      floorPlan: getMockFloorPlan(options.knownAreaM2),
      confidence: 0.1,
      warnings,
      processingTimeMs: Date.now() - startTime,
      method: "mock",
    };
  }
}
