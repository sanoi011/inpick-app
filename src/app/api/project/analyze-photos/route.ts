// src/app/api/project/analyze-photos/route.ts
// POST /api/project/analyze-photos - 다중 사진 → GPT-4o Vision → 추정 평면도

import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isOpenAIConfigured } from "@/lib/openai-client";
import type { ParsedFloorPlan, RoomType } from "@/types/floorplan";

export const maxDuration = 60;

const PHOTO_ANALYSIS_PROMPT = `당신은 한국 아파트 실내 사진 분석 전문가입니다.
여러 장의 실내 사진을 분석하여 추정 평면도를 생성하세요.

## 분석 원칙
- 각 사진에서 벽, 문, 창문, 가구, 설비를 식별합니다
- 공간 간의 관계(인접, 연결, 통행)를 파악합니다
- 사진 수가 적으면 정확도가 낮을 수 있음을 감안합니다
- 한국 아파트 표준 구조를 참고하여 추정합니다

## 공간 타입
- LIVING: 거실 (가장 넓은 공용 공간)
- KITCHEN: 주방/식당
- MASTER_BED: 안방 (가장 큰 침실)
- BED: 침실
- BATHROOM: 욕실/화장실
- ENTRANCE: 현관
- BALCONY: 발코니
- UTILITY: 다용도실
- DRESSROOM: 드레스룸

## 출력 규칙
- 모든 좌표는 미터 단위 (좌상단 원점)
- 각 공간은 사각형 바운딩박스로 근사
- 면적은 m² 단위
- 벽, 문, 창문은 추정 가능한 경우에만 포함

반드시 아래 JSON 스키마에 맞춰 출력하세요. 마크다운 코드 블록 없이 순수 JSON만 출력하세요.`;

const PHOTO_SCHEMA = {
  type: "object" as const,
  properties: {
    rooms: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const },
          name: { type: "string" as const },
          area: { type: "number" as const },
          x: { type: "number" as const },
          y: { type: "number" as const },
          width: { type: "number" as const },
          height: { type: "number" as const },
        },
        required: ["type", "name", "area", "x", "y", "width", "height"],
      },
    },
    doors: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          x: { type: "number" as const },
          y: { type: "number" as const },
          widthM: { type: "number" as const },
          type: { type: "string" as const },
          connectedRooms: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["x", "y", "widthM", "type"],
      },
    },
    windows: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          x: { type: "number" as const },
          y: { type: "number" as const },
          widthM: { type: "number" as const },
        },
        required: ["x", "y", "widthM"],
      },
    },
    detectedRooms: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          features: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["name"],
      },
    },
  },
  required: ["rooms"],
};

interface PhotoRoom {
  type: string;
  name: string;
  area: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PhotoDoor {
  x: number;
  y: number;
  widthM: number;
  type: string;
  connectedRooms?: string[];
}

interface PhotoWindow {
  x: number;
  y: number;
  widthM: number;
}

const ROOM_TYPE_MAP: Record<string, RoomType> = {
  LIVING: "LIVING",
  KITCHEN: "KITCHEN",
  MASTER_BED: "MASTER_BED",
  BED: "BED",
  BATHROOM: "BATHROOM",
  ENTRANCE: "ENTRANCE",
  BALCONY: "BALCONY",
  UTILITY: "UTILITY",
  DRESSROOM: "DRESSROOM",
  CORRIDOR: "CORRIDOR",
};

function mapRoomType(raw: string): RoomType {
  const upper = raw.toUpperCase().trim();
  return ROOM_TYPE_MAP[upper] || "UTILITY";
}

function getMockPhotoFloorPlan(area: number, roomCount: number): ParsedFloorPlan {
  const rooms = [];
  const baseW = Math.sqrt(area) * 1.2;
  let y = 0;

  const types: { type: RoomType; name: string; ratio: number }[] = [
    { type: "LIVING", name: "거실", ratio: 0.3 },
    { type: "KITCHEN", name: "주방", ratio: 0.12 },
    { type: "MASTER_BED", name: "안방", ratio: 0.2 },
    { type: "BED", name: "침실", ratio: 0.15 },
    { type: "BATHROOM", name: "욕실1", ratio: 0.08 },
    { type: "BATHROOM", name: "욕실2", ratio: 0.05 },
    { type: "ENTRANCE", name: "현관", ratio: 0.05 },
    { type: "BALCONY", name: "발코니", ratio: 0.05 },
  ];

  for (let i = 0; i < Math.min(roomCount || 8, types.length); i++) {
    const t = types[i];
    const rArea = area * t.ratio;
    const rW = Math.sqrt(rArea) * 1.3;
    const rH = rArea / rW;
    rooms.push({
      id: `room-${i}`,
      type: t.type,
      name: t.name,
      area: Math.round(rArea * 100) / 100,
      position: { x: i % 2 === 0 ? 0 : baseW / 2, y, width: rW, height: rH },
    });
    if (i % 2 === 1) y += rH;
  }

  return { totalArea: area, rooms, walls: [], doors: [], windows: [] };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photos = formData.getAll("photos") as File[];
    const approximateArea = parseFloat(formData.get("approximateArea") as string) || 84;
    const roomCount = parseInt(formData.get("roomCount") as string) || 8;

    if (photos.length < 3) {
      return NextResponse.json(
        { error: "최소 3장의 사진이 필요합니다. 각 방을 최소 1장씩 촬영해주세요." },
        { status: 400 }
      );
    }

    if (photos.length > 20) {
      return NextResponse.json(
        { error: "최대 20장까지 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    // OpenAI 미설정 시 Mock
    if (!isOpenAIConfigured()) {
      const floorPlan = getMockPhotoFloorPlan(approximateArea, roomCount);
      return NextResponse.json({
        floorPlan,
        confidence: 0.3,
        method: "mock",
        warnings: ["OpenAI API 키가 설정되지 않아 추정 데이터를 반환합니다"],
        detectedRooms: [],
      });
    }

    const client = getOpenAIClient();
    if (!client) {
      return NextResponse.json(
        { error: "AI 클라이언트 초기화 실패" },
        { status: 500 }
      );
    }

    // 사진 → base64 image_url 파트
    type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
    const imageContentParts: ContentPart[] = [];
    for (const photo of photos) {
      if (photo.size > 10 * 1024 * 1024) continue; // 10MB 초과 스킵
      const buffer = Buffer.from(await photo.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mime = photo.type || "image/jpeg";
      imageContentParts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
    }

    if (imageContentParts.length === 0) {
      return NextResponse.json(
        { error: "유효한 사진이 없습니다." },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: PHOTO_ANALYSIS_PROMPT + "\n\nJSON 스키마:\n" + JSON.stringify(PHOTO_SCHEMA, null, 2),
        },
        {
          role: "user",
          content: [
            ...imageContentParts,
            {
              type: "text",
              text: `위 ${imageContentParts.length}장의 실내 사진을 분석하여 추정 평면도를 JSON으로 생성하세요.
대략적 면적: ${approximateArea}㎡, 예상 방 수: ${roomCount}개
각 사진에서 보이는 공간, 벽, 문, 창문, 설비를 식별하고 공간 배치를 추정하세요.`,
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
    });

    const text = response.choices[0]?.message?.content || "";
    let parsed: { rooms?: PhotoRoom[]; doors?: PhotoDoor[]; windows?: PhotoWindow[]; detectedRooms?: { name: string; features?: string[] }[] };

    try {
      let jsonText = text;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({
        floorPlan: getMockPhotoFloorPlan(approximateArea, roomCount),
        confidence: 0.2,
        method: "mock",
        warnings: ["AI 응답 파싱 실패, 추정 데이터를 반환합니다"],
        detectedRooms: [],
      });
    }

    if (!parsed.rooms || parsed.rooms.length === 0) {
      return NextResponse.json({
        floorPlan: getMockPhotoFloorPlan(approximateArea, roomCount),
        confidence: 0.2,
        method: "mock",
        warnings: ["공간이 감지되지 않았습니다"],
        detectedRooms: [],
      });
    }

    // 변환: AI 응답 → ParsedFloorPlan
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const rooms = parsed.rooms.map((r: PhotoRoom, i: number) => ({
      id: `room-${i}`,
      type: mapRoomType(r.type),
      name: r.name,
      area: round(r.area),
      position: {
        x: round(r.x),
        y: round(r.y),
        width: round(r.width),
        height: round(r.height),
      },
    }));

    const doors = (parsed.doors || []).map((d: PhotoDoor, i: number) => ({
      id: `door-${i}`,
      position: { x: round(d.x), y: round(d.y) },
      width: d.widthM || 0.9,
      rotation: 0,
      type: (d.type === "sliding" ? "sliding" : "swing") as "swing" | "sliding",
      connectedRooms: [d.connectedRooms?.[0] || "", d.connectedRooms?.[1] || ""] as [string, string],
    }));

    const windows = (parsed.windows || []).map((w: PhotoWindow, i: number) => ({
      id: `window-${i}`,
      position: { x: round(w.x), y: round(w.y) },
      width: w.widthM || 1.2,
      height: 1.2,
      rotation: 0,
      wallId: "",
    }));

    const totalArea = round(rooms.reduce((s: number, r: { area: number }) => s + r.area, 0));

    const floorPlan: ParsedFloorPlan = {
      totalArea,
      rooms,
      walls: [],
      doors,
      windows,
    };

    const processingTimeMs = Date.now() - startTime;

    // 신뢰도 (사진 기반은 도면 대비 낮음)
    let confidence = 0.4;
    if (imageContentParts.length >= 5) confidence += 0.1;
    if (imageContentParts.length >= 10) confidence += 0.1;
    if (rooms.length >= 4) confidence += 0.05;
    if (doors.length > 0) confidence += 0.05;

    const warnings: string[] = [];
    warnings.push("사진 기반 추정 평면도입니다. 실제 치수와 차이가 있을 수 있습니다.");
    if (floorPlan.walls.length === 0) warnings.push("벽체 데이터는 사진에서 추출할 수 없어 생략되었습니다.");

    return NextResponse.json({
      floorPlan,
      confidence,
      method: "photo_analysis",
      warnings,
      processingTimeMs,
      detectedRooms: parsed.detectedRooms || [],
      roomCount: rooms.length,
      totalArea,
    });
  } catch (error) {
    console.error("[analyze-photos] Error:", error);
    return NextResponse.json(
      {
        error: "사진 분석 중 오류가 발생했습니다",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
