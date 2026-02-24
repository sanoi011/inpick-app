// src/app/api/project/generate-elevation/route.ts
// POST /api/project/generate-elevation
// 참고 이미지 + 도면 + 인테리어 4컷 → Gemini 3.0 Pro → 입면전개도 + 평면도 생성

import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, isGeminiConfigured } from "@/lib/gemini-client";
import * as fs from "fs";
import * as path from "path";

export const maxDuration = 120;

const ELEVATION_PROMPT = `당신은 한국 아파트 시공도면 전문가입니다.

첨부된 이미지를 분석하여 입면전개도(벽면 전개도)를 생성하세요.

## 입력 이미지 설명
- 참고 이미지: 실제 입면전개도 스타일 참고용 (다크 배경 + 흰색 라인 + mm 치수)
- 도면 이미지: 사용자의 아파트 평면도
- 인테리어 이미지: AI가 생성한 인테리어 디자인 4컷 (스타일/자재 참고)

## 출력 규칙
- 방별로 4면(북/남/동/서) 벽면을 전개도로 표현
- 각 벽면의 주요 요소: 문, 창문, 콘센트, 스위치, 가구, 마감재
- mm 단위 치수 표기
- 마감재 주석 (바닥재 종류, 벽지 종류, 도장 색상 등)
- 다크 배경(#0D1117) + 흰색 라인(#E5E7EB) 스타일

각 방에 대해 아래 JSON 형식으로 출력하세요.`;

const ELEVATION_SCHEMA = {
  type: "object" as const,
  properties: {
    rooms: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          type: { type: "string" as const },
          walls: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                direction: { type: "string" as const },
                widthMm: { type: "number" as const },
                heightMm: { type: "number" as const },
                elements: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      type: { type: "string" as const },
                      xMm: { type: "number" as const },
                      yMm: { type: "number" as const },
                      widthMm: { type: "number" as const },
                      heightMm: { type: "number" as const },
                      label: { type: "string" as const },
                    },
                    required: ["type", "xMm", "yMm", "widthMm", "heightMm"],
                  },
                },
                finishes: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      area: { type: "string" as const },
                      material: { type: "string" as const },
                    },
                    required: ["area", "material"],
                  },
                },
              },
              required: ["direction", "widthMm", "heightMm"],
            },
          },
        },
        required: ["name", "type", "walls"],
      },
    },
    floorPlanNotes: { type: "string" as const },
    designConcept: { type: "string" as const },
  },
  required: ["rooms"],
};

interface ElevationRoom {
  name: string;
  type: string;
  walls: {
    direction: string;
    widthMm: number;
    heightMm: number;
    elements?: { type: string; xMm: number; yMm: number; widthMm: number; heightMm: number; label?: string }[];
    finishes?: { area: string; material: string }[];
  }[];
}

/**
 * 입면전개도 SVG 생성 (서버사이드 렌더링)
 */
function generateElevationSVGFromAI(rooms: ElevationRoom[]): string {
  const BG = "#0D1117";
  const LINE = "#E5E7EB";
  const DIM = "#9CA3AF";
  const ACCENT = "#60A5FA";
  const TITLE_COLOR = "#F9FAFB";

  const WALL_MARGIN = 30;
  const ROOM_GAP = 60;
  const TITLE_HEIGHT = 40;
  const SCALE = 0.12; // mm → SVG px

  let totalHeight = 80; // top padding
  const roomSvgs: string[] = [];

  for (const room of rooms) {
    let roomY = totalHeight;
    // Room title
    roomSvgs.push(`<text x="60" y="${roomY + 20}" fill="${TITLE_COLOR}" font-size="16" font-weight="bold" font-family="'Nanum Gothic',sans-serif">${room.name} (${room.type})</text>`);
    roomY += TITLE_HEIGHT;

    let wallX = 60;
    const wallSvgsForRoom: string[] = [];

    for (const wall of room.walls) {
      const w = Math.max(wall.widthMm * SCALE, 80);
      const h = Math.max(wall.heightMm * SCALE, 100);

      // Wall outline
      wallSvgsForRoom.push(`<rect x="${wallX}" y="${roomY}" width="${w}" height="${h}" fill="none" stroke="${LINE}" stroke-width="1.5"/>`);

      // Direction label
      wallSvgsForRoom.push(`<text x="${wallX + w / 2}" y="${roomY - 8}" fill="${DIM}" font-size="10" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">${wall.direction}</text>`);

      // Width dimension
      wallSvgsForRoom.push(`<text x="${wallX + w / 2}" y="${roomY + h + 16}" fill="${DIM}" font-size="9" text-anchor="middle" font-family="monospace">${wall.widthMm}mm</text>`);

      // Height dimension (left)
      wallSvgsForRoom.push(`<text x="${wallX - 8}" y="${roomY + h / 2}" fill="${DIM}" font-size="9" text-anchor="end" transform="rotate(-90,${wallX - 8},${roomY + h / 2})" font-family="monospace">${wall.heightMm}mm</text>`);

      // Elements
      if (wall.elements) {
        for (const el of wall.elements) {
          const ex = wallX + el.xMm * SCALE;
          const ey = roomY + el.yMm * SCALE;
          const ew = el.widthMm * SCALE;
          const eh = el.heightMm * SCALE;

          let elColor = LINE;
          if (el.type === "door" || el.type === "문") elColor = "#F59E0B";
          else if (el.type === "window" || el.type === "창문") elColor = ACCENT;
          else if (el.type === "outlet" || el.type === "콘센트") elColor = "#10B981";
          else if (el.type === "switch" || el.type === "스위치") elColor = "#10B981";

          wallSvgsForRoom.push(`<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" fill="none" stroke="${elColor}" stroke-width="1" stroke-dasharray="${el.type.includes("콘센트") || el.type.includes("outlet") ? "2,2" : "none"}"/>`);

          if (el.label) {
            wallSvgsForRoom.push(`<text x="${ex + ew / 2}" y="${ey + eh + 10}" fill="${DIM}" font-size="7" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">${el.label}</text>`);
          }
        }
      }

      // Finishes
      if (wall.finishes) {
        let fy = roomY + h + 26;
        for (const fin of wall.finishes) {
          wallSvgsForRoom.push(`<text x="${wallX}" y="${fy}" fill="${ACCENT}" font-size="8" font-family="'Nanum Gothic',sans-serif">${fin.area}: ${fin.material}</text>`);
          fy += 12;
        }
      }

      wallX += w + WALL_MARGIN;
    }

    const maxWallH = Math.max(...room.walls.map(w => w.heightMm * SCALE + 60), 120);
    totalHeight = roomY + maxWallH + ROOM_GAP;
    roomSvgs.push(...wallSvgsForRoom);
  }

  const svgWidth = 1200;
  const svgHeight = Math.max(totalHeight + 40, 600);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${BG}"/>
  <text x="${svgWidth / 2}" y="40" fill="${TITLE_COLOR}" font-size="20" font-weight="bold" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">입면전개도 (Elevation Development)</text>
  <text x="${svgWidth / 2}" y="60" fill="${DIM}" font-size="11" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">Gemini 3.0 Pro AI 생성 | 단위: mm | 다크 엔지니어링 스타일</text>
  ${roomSvgs.join("\n  ")}
</svg>`;
}

/**
 * 간단한 평면도 SVG (AI 분석 결과 기반)
 */
function generateFloorPlanSVGFromAI(rooms: ElevationRoom[]): string {
  const BG = "#0D1117";
  const LINE = "#E5E7EB";
  const DIM = "#9CA3AF";
  const FILL_COLORS: Record<string, string> = {
    LIVING: "rgba(59,130,246,0.15)",
    KITCHEN: "rgba(234,179,8,0.15)",
    MASTER_BED: "rgba(168,85,247,0.15)",
    BED: "rgba(99,102,241,0.15)",
    BATHROOM: "rgba(6,182,212,0.15)",
    ENTRANCE: "rgba(107,114,128,0.15)",
    BALCONY: "rgba(34,197,94,0.15)",
    UTILITY: "rgba(156,163,175,0.15)",
    DRESSROOM: "rgba(236,72,153,0.15)",
  };

  const svgWidth = 800;
  const svgHeight = 600;
  const parts: string[] = [];

  // Simple grid layout of rooms
  const cols = Math.ceil(Math.sqrt(rooms.length));
  const cellW = (svgWidth - 120) / cols;
  const cellH = (svgHeight - 120) / Math.ceil(rooms.length / cols);

  rooms.forEach((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 60 + col * cellW;
    const y = 80 + row * cellH;
    const fill = FILL_COLORS[room.type.toUpperCase()] || "rgba(156,163,175,0.1)";

    parts.push(`<rect x="${x + 4}" y="${y + 4}" width="${cellW - 8}" height="${cellH - 8}" fill="${fill}" stroke="${LINE}" stroke-width="1.5" rx="2"/>`);
    parts.push(`<text x="${x + cellW / 2}" y="${y + cellH / 2 - 6}" fill="${LINE}" font-size="12" font-weight="bold" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">${room.name}</text>`);
    parts.push(`<text x="${x + cellW / 2}" y="${y + cellH / 2 + 10}" fill="${DIM}" font-size="9" text-anchor="middle" font-family="monospace">${room.walls.length}면</text>`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="${svgWidth}" height="${svgHeight}" fill="${BG}"/>
  <text x="${svgWidth / 2}" y="40" fill="#F9FAFB" font-size="18" font-weight="bold" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">마감 평면도 (Finish Floor Plan)</text>
  <text x="${svgWidth / 2}" y="58" fill="${DIM}" font-size="10" text-anchor="middle" font-family="'Nanum Gothic',sans-serif">Gemini 3.0 Pro AI 생성 | 방별 마감재 배치</text>
  ${parts.join("\n  ")}
</svg>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      floorPlanImageUrl,
      interiorImages,
      area,
      roomCount,
      style,
    } = body as {
      floorPlanImageUrl?: string;
      interiorImages?: string[];
      area?: number;
      roomCount?: number;
      style?: string;
    };

    // 참고 이미지 로드 (서버 파일시스템에서)
    const refImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const showcaseDir = path.join(process.cwd(), "public", "showcase");

    // 참고 이미지 3장만 사용 (토큰 절약)
    for (const idx of [1, 3, 5]) {
      const filePath = path.join(showcaseDir, `elevation-${String(idx).padStart(2, "0")}.jpg`);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        refImageParts.push({
          inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") },
        });
      }
    }

    // 도면 이미지
    const imageParts: typeof refImageParts = [];
    if (floorPlanImageUrl) {
      try {
        let fetchUrl = floorPlanImageUrl;
        if (fetchUrl.startsWith("/")) {
          const host = request.headers.get("host") || "localhost:3001";
          const protocol = request.headers.get("x-forwarded-proto") || "http";
          fetchUrl = `${protocol}://${host}${fetchUrl}`;
        }
        const imgRes = await fetch(fetchUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          imageParts.push({ inlineData: { mimeType: imgRes.headers.get("content-type") || "image/png", data: buffer.toString("base64") } });
        }
      } catch (err) {
        console.warn("[generate-elevation] Failed to fetch floor plan:", err);
      }
    }

    // 인테리어 4컷 이미지
    if (interiorImages && interiorImages.length > 0) {
      for (const imgUrl of interiorImages.slice(0, 4)) {
        try {
          let fetchUrl = imgUrl;
          if (fetchUrl.startsWith("/")) {
            const host = request.headers.get("host") || "localhost:3001";
            const protocol = request.headers.get("x-forwarded-proto") || "http";
            fetchUrl = `${protocol}://${host}${fetchUrl}`;
          }
          const imgRes = await fetch(fetchUrl);
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            imageParts.push({ inlineData: { mimeType: imgRes.headers.get("content-type") || "image/jpeg", data: buffer.toString("base64") } });
          }
        } catch (err) {
          console.warn("[generate-elevation] Failed to fetch interior image:", err);
        }
      }
    }

    // Gemini 미설정 시 Mock 응답
    if (!isGeminiConfigured()) {
      const mockRooms: ElevationRoom[] = [
        {
          name: "거실", type: "LIVING",
          walls: [
            { direction: "남측 (거실창)", widthMm: 6000, heightMm: 2400, elements: [{ type: "window", xMm: 500, yMm: 200, widthMm: 5000, heightMm: 1800, label: "시스템창호 5000×1800" }], finishes: [{ area: "바닥", material: "강마루 LG하우시스 1210×150×12mm" }, { area: "벽", material: "실크벽지 (아이보리)" }] },
            { direction: "북측", widthMm: 6000, heightMm: 2400, elements: [{ type: "door", xMm: 2200, yMm: 300, widthMm: 900, heightMm: 2100, label: "ABS 방문 900×2100" }], finishes: [{ area: "벽", material: "수성페인트 (화이트)" }] },
            { direction: "동측", widthMm: 4500, heightMm: 2400, elements: [], finishes: [{ area: "벽", material: "포인트 벽지 (그레이)" }] },
            { direction: "서측", widthMm: 4500, heightMm: 2400, elements: [{ type: "outlet", xMm: 200, yMm: 1700, widthMm: 100, heightMm: 100, label: "콘센트 2구" }], finishes: [{ area: "벽", material: "실크벽지 (아이보리)" }] },
          ],
        },
        {
          name: "안방", type: "MASTER_BED",
          walls: [
            { direction: "남측", widthMm: 3600, heightMm: 2400, elements: [{ type: "window", xMm: 400, yMm: 300, widthMm: 2800, heightMm: 1500, label: "창문 2800×1500" }], finishes: [{ area: "바닥", material: "강마루 원목무늬" }, { area: "벽", material: "실크벽지" }] },
            { direction: "북측", widthMm: 3600, heightMm: 2400, elements: [{ type: "door", xMm: 100, yMm: 300, widthMm: 900, heightMm: 2100, label: "방문" }], finishes: [{ area: "벽", material: "실크벽지" }] },
          ],
        },
        {
          name: "욕실1", type: "BATHROOM",
          walls: [
            { direction: "북측", widthMm: 2000, heightMm: 2400, elements: [{ type: "door", xMm: 100, yMm: 300, widthMm: 700, heightMm: 2100, label: "욕실문 700×2100" }], finishes: [{ area: "벽", material: "포세린 타일 300×600" }, { area: "바닥", material: "논슬립 타일 300×300" }] },
            { direction: "남측", widthMm: 2000, heightMm: 2400, elements: [], finishes: [{ area: "벽", material: "포세린 타일 300×600" }] },
          ],
        },
      ];

      const elevationSvg = generateElevationSVGFromAI(mockRooms);
      const floorPlanSvg = generateFloorPlanSVGFromAI(mockRooms);

      return NextResponse.json({
        elevationSvg,
        floorPlanSvg,
        rooms: mockRooms,
        designConcept: `${style || "모던"} 스타일 입면전개도`,
        method: "standard",
        warnings: [],
      });
    }

    const client = getGeminiClient();
    if (!client) {
      return NextResponse.json({ error: "AI 클라이언트 초기화 실패" }, { status: 500 });
    }

    const userPrompt = `## 프로젝트 정보
- 면적: ${area || 84}㎡ (${Math.round((area || 84) / 3.3058)}평)
- 방 수: ${roomCount || 3}개
- 스타일: ${style || "모던"}

## 참고 이미지
- 앞의 ${refImageParts.length}장: 입면전개도 스타일 참고 (이 스타일로 생성)
${imageParts.length > 0 ? `- 다음 1장: 사용자 평면도\n- 나머지: 인테리어 디자인 이미지 (자재/스타일 참고)` : "- 일반 한국 아파트 구조 기준"}

주요 공간(거실/안방/침실/주방/욕실)의 4면 벽 전개도를 생성하세요.
각 벽에 문/창문/콘센트/스위치 위치와 마감재 정보를 포함하세요.`;

    const startTime = Date.now();

    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{
        role: "user",
        parts: [
          ...refImageParts,
          ...imageParts,
          { text: ELEVATION_PROMPT + "\n\nJSON 스키마:\n" + JSON.stringify(ELEVATION_SCHEMA, null, 2) + "\n\n" + userPrompt },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: ELEVATION_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 16384,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed: { rooms?: ElevationRoom[]; floorPlanNotes?: string; designConcept?: string };

    try {
      let jsonText = text;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({
        error: "AI 응답 파싱 실패",
        method: "error",
      }, { status: 500 });
    }

    if (!parsed.rooms || parsed.rooms.length === 0) {
      return NextResponse.json({
        error: "입면전개도 데이터 없음",
        method: "error",
      }, { status: 500 });
    }

    const elevationSvg = generateElevationSVGFromAI(parsed.rooms);
    const floorPlanSvg = generateFloorPlanSVGFromAI(parsed.rooms);

    return NextResponse.json({
      elevationSvg,
      floorPlanSvg,
      rooms: parsed.rooms,
      designConcept: parsed.designConcept || `${style || "모던"} 스타일 입면전개도`,
      floorPlanNotes: parsed.floorPlanNotes || "",
      method: "ai_generated",
      processingTimeMs: Date.now() - startTime,
      imageCount: refImageParts.length + imageParts.length,
    });
  } catch (error) {
    console.error("[generate-elevation] Error:", error);
    return NextResponse.json(
      { error: "입면전개도 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
