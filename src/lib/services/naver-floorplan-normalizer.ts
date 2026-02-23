/**
 * 네이버 부동산 도면 이미지 → 표준 면적 정규화 서비스
 *
 * 네이버 도면 이미지는 렌더링용이라 실제 치수와 정확도가 낮음.
 * AI로 방 배치 패턴(타입/개수/상대 위치)만 인식하고,
 * 한국 아파트 표준 면적 비율로 정규화하여 학습 데이터 생성.
 *
 * 플로우:
 *   Naver 도면 이미지 → Gemini Vision (레이아웃 패턴 인식)
 *     → 방 타입/개수/상대 위치 추출
 *     → 전용면적 기반 표준 면적 비율 적용
 *     → 정규화된 ParsedFloorPlan 생성
 */

import type {
  ParsedFloorPlan,
  RoomData,
  WallData,
  DoorData,
  WindowData,
  FixtureData,
  RoomType,
} from "@/types/floorplan";

// ─── 한국 아파트 표준 면적 비율 테이블 ───

interface RoomProportion {
  type: RoomType;
  name: string;
  ratio: number; // 전용면적 대비 비율 (합계 = 1.0)
  aspectRatio: number; // 가로/세로 비율 (1.0 = 정사각형)
  material: "wood" | "tile";
}

/** 타입별 표준 비율 (방 수 기반) */
const STANDARD_PROPORTIONS: Record<string, RoomProportion[]> = {
  // 3BR/2BA (59~65m² 소형)
  "3BR_2BA": [
    { type: "LIVING" as RoomType, name: "거실", ratio: 0.28, aspectRatio: 1.4, material: "wood" },
    { type: "KITCHEN" as RoomType, name: "주방", ratio: 0.08, aspectRatio: 1.6, material: "tile" },
    { type: "MASTER_BED" as RoomType, name: "안방", ratio: 0.16, aspectRatio: 1.1, material: "wood" },
    { type: "BED" as RoomType, name: "침실2", ratio: 0.12, aspectRatio: 1.1, material: "wood" },
    { type: "BED" as RoomType, name: "침실3", ratio: 0.10, aspectRatio: 1.0, material: "wood" },
    { type: "BATHROOM" as RoomType, name: "욕실1", ratio: 0.05, aspectRatio: 0.8, material: "tile" },
    { type: "BATHROOM" as RoomType, name: "욕실2", ratio: 0.04, aspectRatio: 0.8, material: "tile" },
    { type: "ENTRANCE" as RoomType, name: "현관", ratio: 0.04, aspectRatio: 0.7, material: "tile" },
    { type: "DRESSROOM" as RoomType, name: "드레스룸", ratio: 0.03, aspectRatio: 0.7, material: "wood" },
    { type: "UTILITY" as RoomType, name: "다용도실", ratio: 0.02, aspectRatio: 0.6, material: "tile" },
    { type: "CORRIDOR" as RoomType, name: "복도", ratio: 0.08, aspectRatio: 3.0, material: "wood" },
  ],
  // 4BR/2BA (84~85m² 중형 A타입)
  "4BR_2BA": [
    { type: "LIVING" as RoomType, name: "거실", ratio: 0.26, aspectRatio: 1.3, material: "wood" },
    { type: "KITCHEN" as RoomType, name: "주방", ratio: 0.08, aspectRatio: 1.5, material: "tile" },
    { type: "MASTER_BED" as RoomType, name: "안방", ratio: 0.15, aspectRatio: 1.05, material: "wood" },
    { type: "BED" as RoomType, name: "침실2", ratio: 0.11, aspectRatio: 1.1, material: "wood" },
    { type: "BED" as RoomType, name: "침실3", ratio: 0.10, aspectRatio: 1.0, material: "wood" },
    { type: "BED" as RoomType, name: "침실4", ratio: 0.09, aspectRatio: 1.0, material: "wood" },
    { type: "BATHROOM" as RoomType, name: "욕실1", ratio: 0.045, aspectRatio: 0.85, material: "tile" },
    { type: "BATHROOM" as RoomType, name: "욕실2", ratio: 0.035, aspectRatio: 0.75, material: "tile" },
    { type: "ENTRANCE" as RoomType, name: "현관", ratio: 0.04, aspectRatio: 0.7, material: "tile" },
    { type: "DRESSROOM" as RoomType, name: "드레스룸", ratio: 0.03, aspectRatio: 0.7, material: "wood" },
    { type: "UTILITY" as RoomType, name: "다용도실", ratio: 0.02, aspectRatio: 0.6, material: "tile" },
    { type: "CORRIDOR" as RoomType, name: "복도", ratio: 0.04, aspectRatio: 3.5, material: "wood" },
  ],
  // 3BR/2BA (84m² 중형 B타입, 넓은 거실)
  "3BR_2BA_WIDE": [
    { type: "LIVING" as RoomType, name: "거실", ratio: 0.32, aspectRatio: 1.5, material: "wood" },
    { type: "KITCHEN" as RoomType, name: "주방", ratio: 0.09, aspectRatio: 1.6, material: "tile" },
    { type: "MASTER_BED" as RoomType, name: "안방", ratio: 0.17, aspectRatio: 1.05, material: "wood" },
    { type: "BED" as RoomType, name: "침실2", ratio: 0.12, aspectRatio: 1.1, material: "wood" },
    { type: "BED" as RoomType, name: "침실3", ratio: 0.10, aspectRatio: 1.0, material: "wood" },
    { type: "BATHROOM" as RoomType, name: "욕실1", ratio: 0.05, aspectRatio: 0.85, material: "tile" },
    { type: "BATHROOM" as RoomType, name: "욕실2", ratio: 0.04, aspectRatio: 0.75, material: "tile" },
    { type: "ENTRANCE" as RoomType, name: "현관", ratio: 0.035, aspectRatio: 0.7, material: "tile" },
    { type: "DRESSROOM" as RoomType, name: "드레스룸", ratio: 0.03, aspectRatio: 0.7, material: "wood" },
    { type: "UTILITY" as RoomType, name: "다용도실", ratio: 0.015, aspectRatio: 0.6, material: "tile" },
  ],
};

// ─── AI 레이아웃 인식 결과 타입 ───

export interface RecognizedLayout {
  /** 인식된 방 목록 (타입, 이름, 상대적 위치) */
  rooms: {
    type: string;
    name: string;
    relativePosition: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";
    relativeSize: "small" | "medium" | "large";
  }[];
  /** 인식된 방 수 */
  bedroomCount: number;
  bathroomCount: number;
  /** 레이아웃 패턴 (4bay, 3bay, tower 등) */
  layoutPattern: string;
  /** 발코니 위치 */
  balconyPositions: string[];
  /** 현관 위치 (north, south, east, west) */
  entranceDirection: string;
}

export interface NormalizationResult {
  floorPlan: ParsedFloorPlan;
  layout: RecognizedLayout;
  templateKey: string; // e.g., "4BR_2BA"
  confidence: number;
  sourceImageUrl?: string;
  complexNo?: string;
  pyeongName?: string;
}

// ─── 레이아웃 인식 (Gemini Vision) ───

/**
 * Gemini Vision으로 네이버 도면 이미지의 레이아웃 패턴 인식
 * 치수는 추출하지 않고, 방 타입/개수/상대 위치만 파악
 */
export async function recognizeLayout(
  imageBase64: string,
  mimeType: string,
  knownArea: number,
  apiKey: string
): Promise<RecognizedLayout | null> {
  const prompt = `이 아파트 평면도 이미지에서 방 배치 패턴만 파악하세요.
치수나 좌표는 추출하지 마세요. 다음 정보만 파악하세요:

1. 각 방의 타입 (거실, 주방, 안방, 침실, 욕실, 현관, 발코니, 드레스룸, 다용도실)
2. 각 방의 상대적 위치 (9방향: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)
3. 각 방의 상대적 크기 (small/medium/large)
4. 침실 수와 욕실 수
5. 레이아웃 패턴 (4bay, 3bay, tower 등)
6. 발코니 위치들
7. 현관/복도 방향 (north, south, east, west)

전용면적: ${knownArea}m²`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-pro:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            rooms: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING" },
                  name: { type: "STRING" },
                  relativePosition: { type: "STRING" },
                  relativeSize: { type: "STRING" },
                },
                required: ["type", "name", "relativePosition", "relativeSize"],
              },
            },
            bedroomCount: { type: "INTEGER" },
            bathroomCount: { type: "INTEGER" },
            layoutPattern: { type: "STRING" },
            balconyPositions: { type: "ARRAY", items: { type: "STRING" } },
            entranceDirection: { type: "STRING" },
          },
          required: ["rooms", "bedroomCount", "bathroomCount", "layoutPattern", "balconyPositions", "entranceDirection"],
        },
        temperature: 0.1,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return JSON.parse(text) as RecognizedLayout;
  } catch {
    return null;
  }
}

// ─── 표준 면적 정규화 ───

/**
 * AI가 인식한 레이아웃 + 전용면적 → 표준 비율로 정규화된 ParsedFloorPlan 생성
 */
export function normalizeFloorPlan(
  layout: RecognizedLayout,
  knownArea: number,
): ParsedFloorPlan {
  // 1. 적합한 비율 테이블 선택
  const templateKey = selectTemplateKey(layout, knownArea);
  const proportions = STANDARD_PROPORTIONS[templateKey];

  // 2. 각 방의 면적 계산
  const roomSpecs = proportions.map((prop) => {
    const area = knownArea * prop.ratio;
    const height = Math.sqrt(area / prop.aspectRatio);
    const width = area / height;
    return { ...prop, area: parseFloat(area.toFixed(1)), width, height };
  });

  // 3. 레이아웃 배치 (grid-based packing)
  const { rooms, overallWidth, overallHeight } = packRooms(roomSpecs, layout, knownArea);

  // 4. 벽 생성
  const walls = generateWalls(rooms, overallWidth, overallHeight);

  // 5. 문/창문/설비 생성
  const doors = generateDoors(rooms);
  const windows = generateWindows(rooms, overallWidth, overallHeight);
  const fixtures = generateFixtures(rooms);

  // 6. 발코니 추가
  const balconyRooms = generateBalconies(layout, overallWidth, overallHeight);
  rooms.push(...balconyRooms);

  return {
    totalArea: parseFloat(rooms.filter((r) => r.type !== "BALCONY").reduce((s, r) => s + r.area, 0).toFixed(1)),
    rooms,
    walls,
    doors,
    windows,
    fixtures,
    dimensions: [],
  };
}

function selectTemplateKey(layout: RecognizedLayout, area: number): string {
  const br = layout.bedroomCount;
  if (br >= 4) return "4BR_2BA";
  if (area >= 75) return "3BR_2BA_WIDE";
  return "3BR_2BA";
}

// ─── Room Packing Algorithm ───

interface RoomSpec {
  type: RoomType;
  name: string;
  area: number;
  width: number;
  height: number;
  material: "wood" | "tile";
}

function packRooms(
  specs: RoomSpec[],
  layout: RecognizedLayout,
  totalArea: number,
): { rooms: RoomData[]; overallWidth: number; overallHeight: number } {
  // 전체 크기 결정 (4bay 기준 가로:세로 ≈ 11:9)
  const aspectRatio = layout.layoutPattern.includes("tower") ? 0.8 : 1.2;
  const overallHeight = Math.sqrt(totalArea * 1.3 / aspectRatio); // 1.3 = 벽체+복도 마진
  const overallWidth = overallHeight * aspectRatio;

  // 간단한 그리드 배치: 상단행(주방/침실/욕실), 중단(거실), 하단(침실/안방)
  const rooms: RoomData[] = [];
  let currentX = 0;
  let currentY = 0;
  const WALL = 0.12; // 벽 두께 마진

  // 상단 행: 현관 → 욕실2 → 침실3/4 → 주방
  const topRow = specs.filter((s) =>
    ["ENTRANCE", "UTILITY"].includes(s.type as string) ||
    (s.type === "BATHROOM" && s.name.includes("2")) ||
    (s.type === "BED" && !["침실2"].includes(s.name)) ||
    s.type === "KITCHEN"
  );

  currentX = 0;
  currentY = 0;
  const topHeight = topRow.length > 0 ? Math.max(...topRow.map((r) => r.height)) : 3.0;

  for (const spec of topRow) {
    rooms.push(createRoom(spec, currentX, currentY, rooms.length));
    currentX += spec.width + WALL;
  }

  // 중단: 거실 (전체 폭)
  const living = specs.find((s) => s.type === "LIVING");
  if (living) {
    currentY = topHeight + WALL;
    rooms.push(createRoom(
      { ...living, width: overallWidth * 0.55, height: living.area / (overallWidth * 0.55) },
      (overallWidth - overallWidth * 0.55) / 2,
      currentY,
      rooms.length,
    ));
  }

  // 하단 행: 안방 → 드레스룸 → 욕실1 → 침실2
  const bottomRow = specs.filter((s) =>
    s.type === "MASTER_BED" ||
    s.type === "DRESSROOM" ||
    (s.type === "BATHROOM" && s.name.includes("1")) ||
    (s.type === "BED" && s.name === "침실2") ||
    s.type === "CORRIDOR"
  );

  const livingBottom = living ? (topHeight + WALL + (living.area / (overallWidth * 0.55))) : topHeight;
  currentX = 0;
  currentY = livingBottom + WALL;

  for (const spec of bottomRow) {
    rooms.push(createRoom(spec, currentX, currentY, rooms.length));
    currentX += spec.width + WALL;
  }

  return { rooms, overallWidth, overallHeight: currentY + (bottomRow[0]?.height || 3.5) };
}

function createRoom(spec: RoomSpec, x: number, y: number, idx: number): RoomData {
  const w = parseFloat(spec.width.toFixed(3));
  const h = parseFloat(spec.height.toFixed(3));
  const px = parseFloat(x.toFixed(3));
  const py = parseFloat(y.toFixed(3));

  return {
    id: `room-${idx}`,
    type: spec.type as RoomType,
    name: spec.name,
    area: spec.area,
    position: { x: px, y: py, width: w, height: h },
    polygon: [
      { x: px, y: py },
      { x: parseFloat((px + w).toFixed(3)), y: py },
      { x: parseFloat((px + w).toFixed(3)), y: parseFloat((py + h).toFixed(3)) },
      { x: px, y: parseFloat((py + h).toFixed(3)) },
    ],
    material: spec.material,
  };
}

// ─── Wall/Door/Window/Fixture Generation ───

function generateWalls(rooms: RoomData[], width: number, height: number): WallData[] {
  const walls: WallData[] = [];

  // 외벽 (전체 바운딩)
  const extWalls: [number, number, number, number][] = [
    [0, 0, width, 0],
    [width, 0, width, height],
    [width, height, 0, height],
    [0, height, 0, 0],
  ];
  for (let i = 0; i < extWalls.length; i++) {
    const [x1, y1, x2, y2] = extWalls[i];
    walls.push({
      id: `ext-wall-${i + 1}`,
      start: { x: parseFloat(x1.toFixed(3)), y: parseFloat(y1.toFixed(3)) },
      end: { x: parseFloat(x2.toFixed(3)), y: parseFloat(y2.toFixed(3)) },
      thickness: 0.2,
      isExterior: true,
      wallType: "exterior",
      isLoadBearing: true,
    });
  }

  // 내벽 (각 방의 경계)
  for (const room of rooms) {
    const { x, y, width: w, height: h } = room.position;
    const pts: [number, number, number, number][] = [
      [x, y, x + w, y],
      [x + w, y, x + w, y + h],
      [x + w, y + h, x, y + h],
      [x, y + h, x, y],
    ];
    for (let j = 0; j < pts.length; j++) {
      const [x1, y1, x2, y2] = pts[j];
      walls.push({
        id: `int-wall-${room.id}-${j + 1}`,
        start: { x: parseFloat(x1.toFixed(3)), y: parseFloat(y1.toFixed(3)) },
        end: { x: parseFloat(x2.toFixed(3)), y: parseFloat(y2.toFixed(3)) },
        thickness: 0.12,
        isExterior: false,
        wallType: "interior",
        isLoadBearing: false,
      });
    }
  }

  return walls;
}

function generateDoors(rooms: RoomData[]): DoorData[] {
  const doors: DoorData[] = [];
  let doorIdx = 0;
  for (const room of rooms) {
    if (room.type === "BALCONY" || room.type === "CORRIDOR") continue;
    const { x, y, width: w } = room.position;

    doorIdx++;
    const isEntrance = room.type === "ENTRANCE";
    doors.push({
      id: `door-${doorIdx}`,
      position: {
        x: parseFloat((x + w * 0.5).toFixed(3)),
        y: parseFloat(y.toFixed(3)),
      },
      width: isEntrance ? 0.95 : 0.9,
      rotation: 0,
      type: isEntrance ? "entrance" : "swing",
      connectedRooms: ["", ""],
    });
  }
  return doors;
}

function generateWindows(rooms: RoomData[], totalWidth: number, totalHeight: number): WindowData[] {
  const windows: WindowData[] = [];
  let winIdx = 0;
  for (const room of rooms) {
    // 외벽에 인접한 방에만 창문
    const { x, y, width: w, height: h } = room.position;
    const isOnExterior = x < 0.1 || y < 0.1 || (x + w) > totalWidth - 0.1 || (y + h) > totalHeight - 0.1;

    if (isOnExterior && !["ENTRANCE", "CORRIDOR", "UTILITY"].includes(room.type as string)) {
      winIdx++;
      const isLiving = room.type === "LIVING";
      windows.push({
        id: `window-${winIdx}`,
        position: {
          x: parseFloat((x + w * 0.5).toFixed(3)),
          y: parseFloat((y + h).toFixed(3)),
        },
        width: isLiving ? 3.0 : 1.5,
        height: isLiving ? 2.1 : 1.2,
        rotation: 0,
        wallId: "",
      });
    }
  }
  return windows;
}

function generateFixtures(rooms: RoomData[]): FixtureData[] {
  const fixtures: FixtureData[] = [];
  let fixIdx = 0;
  for (const room of rooms) {
    const { x, y, width: w } = room.position;

    if (room.type === "BATHROOM") {
      fixIdx++;
      fixtures.push({
        id: `fixture-${fixIdx}`,
        type: "toilet",
        position: { x: parseFloat((x + 0.3).toFixed(3)), y: parseFloat((y + 0.3).toFixed(3)), width: 0.4, height: 0.65 },
        roomId: room.id,
      });
      fixIdx++;
      fixtures.push({
        id: `fixture-${fixIdx}`,
        type: "sink",
        position: { x: parseFloat((x + w - 0.6).toFixed(3)), y: parseFloat((y + 0.2).toFixed(3)), width: 0.5, height: 0.45 },
        roomId: room.id,
      });
    }
    if (room.type === "KITCHEN") {
      fixIdx++;
      fixtures.push({
        id: `fixture-${fixIdx}`,
        type: "kitchen_sink",
        position: { x: parseFloat((x + 0.3).toFixed(3)), y: parseFloat((y + 0.1).toFixed(3)), width: 0.6, height: 0.5 },
        roomId: room.id,
      });
      fixIdx++;
      fixtures.push({
        id: `fixture-${fixIdx}`,
        type: "stove",
        position: { x: parseFloat((x + 1.2).toFixed(3)), y: parseFloat((y + 0.1).toFixed(3)), width: 0.6, height: 0.5 },
        roomId: room.id,
      });
    }
  }
  return fixtures;
}

function generateBalconies(
  layout: RecognizedLayout,
  width: number,
  height: number,
): RoomData[] {
  const balconies: RoomData[] = [];
  const DEPTH = 1.2; // 발코니 깊이

  if (layout.balconyPositions.some((p) => p.includes("south") || p.includes("하") || p.includes("남"))) {
    balconies.push(createRoom(
      { type: "BALCONY" as RoomType, name: "발코니(남)", area: parseFloat((width * DEPTH).toFixed(1)), width, height: DEPTH, material: "tile" },
      0, height, balconies.length + 100,
    ));
  }
  if (layout.balconyPositions.some((p) => p.includes("north") || p.includes("상") || p.includes("북"))) {
    balconies.push(createRoom(
      { type: "BALCONY" as RoomType, name: "발코니(북)", area: parseFloat((width * DEPTH).toFixed(1)), width, height: DEPTH, material: "tile" },
      0, -DEPTH, balconies.length + 100,
    ));
  }

  return balconies;
}

// ─── 전체 파이프라인 ───

/**
 * 네이버 도면 이미지를 표준 면적으로 정규화
 */
export async function normalizeNaverFloorPlan(
  imageBase64: string,
  mimeType: string,
  knownArea: number,
  apiKey: string,
  meta?: { complexNo?: string; pyeongName?: string; sourceUrl?: string },
): Promise<NormalizationResult | null> {
  // 1. AI 레이아웃 인식
  const layout = await recognizeLayout(imageBase64, mimeType, knownArea, apiKey);
  if (!layout) return null;

  // 2. 표준 면적 정규화
  const templateKey = selectTemplateKey(layout, knownArea);
  const floorPlan = normalizeFloorPlan(layout, knownArea);

  return {
    floorPlan,
    layout,
    templateKey,
    confidence: 0.85, // 레이아웃 인식 기반이므로 고정 신뢰도
    sourceImageUrl: meta?.sourceUrl,
    complexNo: meta?.complexNo,
    pyeongName: meta?.pyeongName,
  };
}

/**
 * 사용 가능한 표준 비율 템플릿 목록
 */
export function getStandardTemplates(): string[] {
  return Object.keys(STANDARD_PROPORTIONS);
}

/**
 * 특정 템플릿의 면적 비율 조회
 */
export function getTemplateProportions(key: string): RoomProportion[] | null {
  return STANDARD_PROPORTIONS[key] || null;
}
