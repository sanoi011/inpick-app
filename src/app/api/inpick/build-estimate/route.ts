/**
 * POST /api/inpick/build-estimate
 *
 * 입력: { rooms: [{ roomName, dim, renderImageUrl }] }
 *
 * 정밀성 원칙: 생성된 디자인 이미지에서 GPT-4o Vision으로 자재를 직접 추출.
 * 이미지 없으면 그 방은 견적에서 제외 (mock 자재 자동 채움 X).
 *
 * 출력: { estimates: RoomEstimate[], grandTotal, skippedRooms }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildRoomEstimate,
  extractMaterialsFromRender,
  type MaterialItem,
  type RoomEstimate,
} from "@/lib/inpick/estimate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rooms } = body;
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "rooms 배열 필수" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY 미설정 — GPT-4o Vision 자재 추출 불가",
          hint: "Vercel 환경변수에 OPENAI_API_KEY 등록 필요",
        },
        { status: 500 },
      );
    }

    const estimates: RoomEstimate[] = [];
    const skippedRooms: Array<{ roomName: string; reason: string }> = [];
    const errors: Array<{ roomName: string; error: string }> = [];

    for (const r of rooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];

      // 이미지 필수 (정밀성)
      if ((!surfaces || surfaces.length === 0) && !r.renderImageUrl) {
        skippedRooms.push({
          roomName: r.roomName,
          reason: "디자인 이미지 없음 — Step2에서 생성 필요",
        });
        continue;
      }

      // Vision으로 자재 추출
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl) {
        try {
          surfaces = await extractMaterialsFromRender({
            renderImageUrl: r.renderImageUrl,
            roomName: r.roomName,
            dim: r.dim,
          });
        } catch (e) {
          errors.push({
            roomName: r.roomName,
            error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          });
          continue;
        }
      }

      if (!surfaces || surfaces.length === 0) {
        errors.push({
          roomName: r.roomName,
          error: "Vision이 자재를 추출하지 못했습니다. 더 명확한 이미지 필요",
        });
        continue;
      }

      estimates.push(
        buildRoomEstimate({
          roomName: r.roomName,
          dim: r.dim,
          surfaces,
        }),
      );
    }

    const grand = estimates.reduce(
      (acc, e) => ({
        mainTotal: acc.mainTotal + e.mainTotalWon,
        auxTotal: acc.auxTotal + e.auxTotalWon,
        laborTotal: acc.laborTotal + e.laborTotalWon,
        totalWon: acc.totalWon + e.totalWon,
      }),
      { mainTotal: 0, auxTotal: 0, laborTotal: 0, totalWon: 0 },
    );

    return NextResponse.json({
      estimates,
      grandTotal: grand,
      skippedRooms,
      errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
