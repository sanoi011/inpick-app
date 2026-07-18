import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";

export interface AreaAverageInput {
  exclusiveAreaM2: number;
  roomCount?: number;
  expansion?: boolean;
  unitName?: string;
}

export interface AreaAverageResult {
  pyeong: string;
  rooms: RoomDim[];
  notes: string;
}

const INTERIOR_AREA_SHARE = 0.92;

function isBalcony(name: string): boolean {
  return /발코니|베란다/.test(name);
}

function roundTo10(value: number): number {
  return Math.max(900, Math.round(value / 10) * 10);
}

function sanitizeRooms(value: unknown): RoomDim[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rooms: RoomDim[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const room = item as Record<string, unknown>;
    const name = typeof room.name === "string" ? room.name.trim().slice(0, 30) : "";
    const widthMm = Number(room.widthMm);
    const depthMm = Number(room.depthMm);
    const heightMm = Number(room.heightMm || 2400);
    if (
      !name ||
      seen.has(name) ||
      !Number.isFinite(widthMm) ||
      !Number.isFinite(depthMm) ||
      widthMm < 900 ||
      widthMm > 12_000 ||
      depthMm < 900 ||
      depthMm > 12_000
    ) {
      continue;
    }
    seen.add(name);
    rooms.push({
      name,
      widthMm: roundTo10(widthMm),
      depthMm: roundTo10(depthMm),
      heightMm:
        Number.isFinite(heightMm) && heightMm >= 2100 && heightMm <= 4000
          ? roundTo10(heightMm)
          : 2400,
    });
  }
  return rooms;
}

/**
 * 실 치수 합계가 전용면적을 초과하지 않도록 평균 치수를 동일 비율로 보정한다.
 * 전용면적의 8%는 복도·벽체·수납 등 공용 동선 여유로 남긴다.
 */
export function fitAverageRoomsToExclusiveArea(
  rooms: RoomDim[],
  exclusiveAreaM2: number,
): RoomDim[] {
  const interior = rooms.filter((room) => !isBalcony(room.name));
  const currentAreaM2 = interior.reduce(
    (sum, room) => sum + (room.widthMm * room.depthMm) / 1_000_000,
    0,
  );
  if (!Number.isFinite(currentAreaM2) || currentAreaM2 <= 0) return rooms;

  const targetAreaM2 = Math.max(8, exclusiveAreaM2 * INTERIOR_AREA_SHARE);
  const linearScale = Math.sqrt(targetAreaM2 / currentAreaM2);
  return rooms.map((room) => ({
    ...room,
    widthMm: roundTo10(room.widthMm * linearScale),
    depthMm: roundTo10(room.depthMm * linearScale),
  }));
}

export function buildStandardAreaAverage(input: AreaAverageInput): AreaAverageResult {
  const pyeong = classifyPyeong(input.exclusiveAreaM2);
  const bedroomCount = input.roomCount
    ? Math.max(0, Math.min(6, Math.round(input.roomCount) - 1))
    : undefined;
  const standard = estimateRoomDimsFromPyeong(
    pyeong,
    bedroomCount ? { 침실: bedroomCount } : undefined,
  );
  const rooms = fitAverageRoomsToExclusiveArea(
    Object.values(standard),
    input.exclusiveAreaM2,
  );
  return {
    pyeong,
    rooms,
    notes:
      `전용 ${input.exclusiveAreaM2.toFixed(1)}㎡ 평형 통계 평균값` +
      " · 실제 실측 전까지 이미지 생성·가견적용",
  };
}

export function buildAreaAveragePrompt(input: AreaAverageInput): string {
  return `한국 공동주택의 통계적 평균 실 구성을 계산하세요.

입력:
- 전용면적: ${input.exclusiveAreaM2.toFixed(1)}㎡
- 침실 수 참고값: ${input.roomCount ?? "미확인"}
- 세대명: ${input.unitName || "미확인"}
- 발코니 형태: ${input.expansion ? "확장형" : "기본형"}

주소만으로 실제 평면을 안다고 가정하지 마세요. 한국 아파트 평균 비율을 적용한 이미지 생성·가견적용 추정치만 계산하세요.
반드시 valid JSON으로만 응답하세요:
{
  "rooms": [
    { "name": "거실", "widthMm": 4500, "depthMm": 4000, "heightMm": 2400 }
  ],
  "notes": "평형 평균값"
}

규칙:
- 거실, 안방, 주방, 욕실, 현관과 면적에 맞는 침실을 포함합니다.
- 기본형이면 발코니를 포함하고, 확장형도 확장부 산정을 위해 발코니 항목을 유지합니다.
- 실내 실들의 바닥면적 합은 전용면적의 85~95% 범위로 두고 나머지는 복도·벽체·수납 여유로 둡니다.
- 치수는 mm 정수이며 실제 도면에서 읽었다고 표현하지 않습니다.`;
}

export function parseAreaAverageResponse(
  content: string,
  input: AreaAverageInput,
): AreaAverageResult | null {
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as { rooms?: unknown; notes?: unknown };
    const rooms = sanitizeRooms(parsed.rooms);
    const hasCoreRooms = ["거실", "주방", "욕실"].every((keyword) =>
      rooms.some((room) => room.name.includes(keyword)),
    );
    if (rooms.length < 4 || !hasCoreRooms) return null;
    return {
      pyeong: classifyPyeong(input.exclusiveAreaM2),
      rooms: fitAverageRoomsToExclusiveArea(rooms, input.exclusiveAreaM2),
      notes:
        (typeof parsed.notes === "string" && parsed.notes.trim()) ||
        `전용 ${input.exclusiveAreaM2.toFixed(1)}㎡ 평형 통계 평균값`,
    };
  } catch {
    return null;
  }
}
