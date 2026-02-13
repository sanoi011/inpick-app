// src/app/api/project/convert-roomplan/route.ts
// POST /api/project/convert-roomplan - Apple RoomPlan JSON → ParsedFloorPlan 변환

import { NextRequest, NextResponse } from "next/server";
import { convertRoomPlanToFloorPlan } from "@/lib/services/roomplan-converter";
import type { RoomPlanCapturedRoom } from "@/types/roomplan";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // RoomPlan JSON 유효성 검증
    const captured = body as RoomPlanCapturedRoom;

    if (!captured.walls || !captured.floors) {
      return NextResponse.json(
        { error: "유효하지 않은 RoomPlan JSON입니다. walls와 floors 필드가 필요합니다." },
        { status: 400 }
      );
    }

    if (!Array.isArray(captured.walls) || !Array.isArray(captured.floors)) {
      return NextResponse.json(
        { error: "walls와 floors는 배열이어야 합니다." },
        { status: 400 }
      );
    }

    if (captured.floors.length === 0) {
      return NextResponse.json(
        { error: "floors 배열이 비어있습니다. 최소 1개의 바닥 데이터가 필요합니다." },
        { status: 400 }
      );
    }

    // 필수 필드 기본값
    if (!captured.doors) captured.doors = [];
    if (!captured.windows) captured.windows = [];
    if (!captured.objects) captured.objects = [];

    // 변환
    const { floorPlan, furniture } = convertRoomPlanToFloorPlan(captured);

    return NextResponse.json({
      floorPlan,
      furniture,
      confidence: 0.85,
      method: "roomplan_lidar",
      warnings: floorPlan.rooms.length === 0 ? ["공간이 감지되지 않았습니다"] : [],
      roomCount: floorPlan.rooms.length,
      totalArea: floorPlan.totalArea,
    });
  } catch (error) {
    console.error("[convert-roomplan] Error:", error);
    return NextResponse.json(
      {
        error: "RoomPlan 데이터 변환 중 오류가 발생했습니다",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
