/**
 * POST /api/inpick/build-estimate
 *
 * 입력 (둘 중 하나):
 *  A) { rooms: [{ roomName, dim, surfaces: [...] }] } — 자재 직접 지정
 *  B) { rooms: [{ roomName, dim, renderImageUrl }] } — 렌더 이미지에서 자재 자동 추출
 *
 * 출력: { estimates: RoomEstimate[], grandTotal: { mainTotal, auxTotal, laborTotal, totalWon } }
 */
import { NextRequest, NextResponse } from "next/server";
import { buildRoomEstimate, extractMaterialsFromRender, type MaterialItem, type RoomEstimate } from "@/lib/inpick/estimate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rooms } = body;
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: "rooms 배열 필수" }, { status: 400 });
    }

    const estimates: RoomEstimate[] = [];
    for (const r of rooms) {
      let surfaces: MaterialItem[] = r.surfaces || [];
      // 렌더 이미지에서 자재 자동 추출
      if ((!surfaces || surfaces.length === 0) && r.renderImageUrl) {
        surfaces = await extractMaterialsFromRender({
          renderImageUrl: r.renderImageUrl,
          roomName: r.roomName,
          dim: r.dim,
        });
      }
      if (surfaces.length === 0) continue;
      estimates.push(buildRoomEstimate({
        roomName: r.roomName,
        dim: r.dim,
        surfaces,
      }));
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

    return NextResponse.json({ estimates, grandTotal: grand });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
