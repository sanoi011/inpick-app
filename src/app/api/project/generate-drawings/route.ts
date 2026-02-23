import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { adaptParsedFloorPlan } from "@/lib/floor-plan/quantity/adapter";
import { calculateAllElevations } from "@/lib/floor-plan/elevation/elevation-calculator";
import { generateAllElectricalPlacements } from "@/lib/floor-plan/elevation/electrical-placement";
import { generateFurnitureLayoutSVG, generateElectricalPlanSVG, generateElevationSVG } from "@/lib/floor-plan/drawing/svg-generators";
import { analyzeFurnitureLayout, generateElevation3DDescription } from "@/lib/floor-plan/drawing/gemini-enhancer";
import type { DrawingType, WallElevation, ConstructionDrawing } from "@/types/construction-drawing";
import type { ParsedFloorPlan } from "@/types/floorplan";

export const maxDuration = 300; // Vercel Pro 5분

// Supabase admin client for Storage uploads
function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );
  }
  return createServerClient();
}

// GET: 기존 도면 세트 조회
export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get("contractId");
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필수" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: drawingSet } = await supabase
    .from("construction_drawing_sets")
    .select("*")
    .eq("contract_id", contractId)
    .single();

  if (!drawingSet) {
    return NextResponse.json({ exists: false });
  }

  const { data: drawings } = await supabase
    .from("construction_drawings")
    .select("*")
    .eq("set_id", drawingSet.id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({
    exists: true,
    drawingSet,
    drawings: drawings || [],
  });
}

// POST: SSE 도면 생성 파이프라인
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { contractId } = body;

  if (!contractId) {
    return NextResponse.json({ error: "contractId 필수" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));
        } catch { closed = true; }
      };

      const sendProgress = (step: number, progress: number, message: string) => {
        send("progress", { step, progress: Math.round(progress), message });
      };

      try {
        // ─── Step 0: 데이터 로드 (0~5%) ───
        sendProgress(0, 0, "계약 정보 로딩 중...");

        // 계약 정보 로드
        const { data: contract } = await supabase
          .from("contracts")
          .select("*")
          .eq("id", contractId)
          .single();

        if (!contract) {
          send("error", { message: "계약 정보를 찾을 수 없습니다." });
          controller.close();
          return;
        }

        sendProgress(0, 2, "프로젝트 데이터 로딩 중...");

        // 소비자 프로젝트 로드
        const { data: consumerProject } = await supabase
          .from("consumer_projects")
          .select("*")
          .eq("user_id", contract.consumer_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        const projectData = consumerProject?.project_data;
        if (!projectData?.floorPlan) {
          send("error", { message: "도면 데이터가 없습니다." });
          controller.close();
          return;
        }

        const floorPlan: ParsedFloorPlan = projectData.floorPlan;

        // 도면 세트 생성 (또는 기존 것 재사용)
        const { data: existingSet } = await supabase
          .from("construction_drawing_sets")
          .select("id")
          .eq("contract_id", contractId)
          .single();

        let setId: string;
        if (existingSet) {
          setId = existingSet.id;
          await supabase
            .from("construction_drawing_sets")
            .update({ status: "processing", progress: 0, error_message: null })
            .eq("id", setId);
          // 기존 도면 삭제
          await supabase
            .from("construction_drawings")
            .delete()
            .eq("set_id", setId);
        } else {
          const { data: newSet } = await supabase
            .from("construction_drawing_sets")
            .insert({
              contract_id: contractId,
              consumer_project_id: consumerProject?.id,
              status: "processing",
            })
            .select("id")
            .single();
          setId = newSet!.id;
        }

        sendProgress(0, 5, "데이터 로드 완료");

        // ─── Step 1: 입면도 계산 + 전기 배치 (5~15%) ───
        sendProgress(1, 5, "입면도 계산 중...");

        const project = adaptParsedFloorPlan(floorPlan, contractId, contract.project_name || "인테리어 공사");
        const allElevations = calculateAllElevations(project);

        sendProgress(1, 10, "전기 배치 생성 중...");

        // 전기 배치 생성
        const elevationMap = new Map<string, WallElevation[]>();
        for (const ed of allElevations) {
          elevationMap.set(ed.roomId, ed.elevations);
        }
        const electricalMap = generateAllElectricalPlacements(project, elevationMap);

        // 입면도에 전기 배치 주입
        for (const ed of allElevations) {
          const placements = electricalMap.get(ed.roomId) || [];
          for (const elev of ed.elevations) {
            elev.electricalPlacements = placements.filter(p => p.wallId === elev.wallId);
          }
        }

        sendProgress(1, 15, "입면도 계산 완료");

        // ─── Step 2: 평면도 SVG 생성 (15~30%) ───
        sendProgress(2, 15, "가구배치도 생성 중...");

        const furnitureLayoutSVG = generateFurnitureLayoutSVG(project);

        sendProgress(2, 22, "전기배선도 생성 중...");

        const electricalPlanSVG = generateElectricalPlanSVG(project, electricalMap);

        sendProgress(2, 30, "평면도 SVG 완료");

        // ─── Step 3: 입면도 SVG 생성 (30~50%) ───
        sendProgress(3, 30, "입면도 생성 중...");

        const elevationSVGs: { type: DrawingType; svg: string; roomName: string; wallLabel: string }[] = [];
        const drawingTypeMap: Record<string, DrawingType> = {
          LIVING_ROOM: "elevation_living",
          KITCHEN: "elevation_kitchen",
          MASTER_BEDROOM: "elevation_master_bed",
          BATHROOM: "elevation_bathroom1",
          BEDROOM: "elevation_bed",
        };

        let bathroomCount = 0;
        for (const ed of allElevations) {
          // 각 방의 가장 긴 벽면 선택
          const bestWall = ed.elevations.reduce((best, curr) =>
            curr.wallLengthMm > best.wallLengthMm ? curr : best,
            ed.elevations[0]
          );

          if (!bestWall) continue;

          let drawingType = drawingTypeMap[ed.roomType];
          if (ed.roomType === "BATHROOM") {
            bathroomCount++;
            drawingType = bathroomCount === 1 ? "elevation_bathroom1" : "elevation_bathroom2";
          }
          if (!drawingType) continue;

          const svg = generateElevationSVG(bestWall, ed.roomName, true);
          elevationSVGs.push({
            type: drawingType,
            svg,
            roomName: ed.roomName,
            wallLabel: bestWall.wallLabel,
          });

          const pct = 30 + (elevationSVGs.length / Math.max(allElevations.length, 1)) * 20;
          sendProgress(3, pct, `${ed.roomName} 입면도 생성 완료`);
        }

        sendProgress(3, 50, "모든 SVG 도면 생성 완료");

        // ─── Step 4: AI 보강 (50~70%) ───
        sendProgress(4, 50, "AI 분석 중...");

        // SVG → PNG 변환
        let furnitureAnalysis = null;
        try {
          const furniturePng = await sharp(Buffer.from(furnitureLayoutSVG))
            .png()
            .toBuffer();

          furnitureAnalysis = await analyzeFurnitureLayout(furniturePng);
          sendProgress(4, 60, furnitureAnalysis
            ? `가구배치 점수: ${furnitureAnalysis.layoutScore}/10`
            : "AI 분석 건너뜀 (API 미설정)"
          );
        } catch (err) {
          console.error("[generate-drawings] SVG→PNG error:", err);
          sendProgress(4, 60, "SVG 변환 오류, 원본 사용");
        }

        // 입면도 3D 묘사 생성
        for (let i = 0; i < elevationSVGs.length; i++) {
          const es = elevationSVGs[i];
          const ed = allElevations.find(e => e.roomName === es.roomName);
          if (ed) {
            const bestWall = ed.elevations.find(e => e.wallLabel === es.wallLabel);
            if (bestWall) {
              await generateElevation3DDescription(bestWall, es.roomName);
            }
          }
          const pct = 60 + (i / Math.max(elevationSVGs.length, 1)) * 10;
          sendProgress(4, pct, `${es.roomName} AI 보강 중...`);
        }

        sendProgress(4, 70, "AI 보강 완료");

        // ─── Step 5: Storage 업로드 (70~85%) ───
        sendProgress(5, 70, "이미지 업로드 중...");

        const drawings: Partial<ConstructionDrawing>[] = [];
        let sortOrder = 0;

        // 가구배치도 업로드
        const furniturePngBuf = await svgToPng(furnitureLayoutSVG);
        const furnitureUrl = await uploadToStorage(
          supabase, contractId, "furniture_layout.png", furniturePngBuf
        );
        drawings.push({
          setId,
          drawingType: "furniture_layout" as DrawingType,
          status: "completed",
          svgUrl: null as unknown as undefined,
          finalUrl: furnitureUrl || undefined,
          metadata: { svgWidth: 1200, svgHeight: 900 },
          sortOrder: sortOrder++,
        });
        sendProgress(5, 73, "가구배치도 업로드 완료");

        // 전기배선도 업로드
        const electricalPngBuf = await svgToPng(electricalPlanSVG);
        const electricalUrl = await uploadToStorage(
          supabase, contractId, "electrical_plan.png", electricalPngBuf
        );
        drawings.push({
          setId,
          drawingType: "electrical_plan" as DrawingType,
          status: "completed",
          finalUrl: electricalUrl || undefined,
          metadata: { svgWidth: 1200, svgHeight: 900 },
          sortOrder: sortOrder++,
        });
        sendProgress(5, 76, "전기배선도 업로드 완료");

        // 입면도 업로드
        for (const es of elevationSVGs) {
          const pngBuf = await svgToPng(es.svg);
          const filename = `${es.type}_${es.wallLabel}.png`;
          const url = await uploadToStorage(supabase, contractId, filename, pngBuf);
          drawings.push({
            setId,
            drawingType: es.type,
            status: "completed",
            finalUrl: url || undefined,
            metadata: {
              roomName: es.roomName,
              wallLabel: es.wallLabel,
              svgWidth: 1200,
              svgHeight: 900,
            },
            sortOrder: sortOrder++,
          });
          const pct = 76 + (sortOrder / (elevationSVGs.length + 2)) * 9;
          sendProgress(5, pct, `${es.roomName} 업로드 완료`);
        }

        sendProgress(5, 85, "모든 이미지 업로드 완료");

        // ─── Step 6: DB 저장 (85~100%) ───
        sendProgress(6, 85, "도면 데이터 저장 중...");

        // 개별 도면 INSERT
        for (const drawing of drawings) {
          await supabase
            .from("construction_drawings")
            .insert({
              set_id: drawing.setId,
              drawing_type: drawing.drawingType,
              status: drawing.status,
              svg_url: drawing.svgUrl || null,
              final_url: drawing.finalUrl || null,
              metadata: drawing.metadata || {},
              sort_order: drawing.sortOrder,
            });
        }

        sendProgress(6, 95, "도면 세트 업데이트 중...");

        // 도면 세트 업데이트
        const totalTime = Date.now() - startTime;
        await supabase
          .from("construction_drawing_sets")
          .update({
            status: "completed",
            total_pages: drawings.length,
            progress: 100,
            processing_time_ms: totalTime,
          })
          .eq("id", setId);

        sendProgress(6, 100, "도면 생성 완료!");

        // 완료 이벤트
        send("complete", {
          drawingSetId: setId,
          drawingCount: drawings.length,
          processingTimeMs: totalTime,
          drawings: drawings.map(d => ({
            drawingType: d.drawingType,
            finalUrl: d.finalUrl,
            metadata: d.metadata,
          })),
        });

      } catch (err) {
        console.error("[generate-drawings] Pipeline error:", err);
        const errMsg = err instanceof Error ? err.message : "알 수 없는 오류";
        send("error", { message: `도면 생성 실패: ${errMsg}` });
      } finally {
        if (!closed) {
          try { controller.close(); } catch { /* already closed */ }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── 유틸리티 ───

async function svgToPng(svgString: string): Promise<Buffer> {
  try {
    return await sharp(Buffer.from(svgString)).png().toBuffer();
  } catch {
    // sharp SVG 렌더링 실패 시 빈 이미지
    return await sharp({
      create: { width: 1200, height: 900, channels: 4, background: { r: 13, g: 17, b: 23, alpha: 1 } },
    }).png().toBuffer();
  }
}

async function uploadToStorage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contractId: string,
  filename: string,
  buffer: Buffer
): Promise<string | null> {
  const path = `drawings/${contractId}/${filename}`;
  try {
    const { error } = await supabase.storage
      .from("construction-drawings")
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error(`[generate-drawings] Upload error for ${filename}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("construction-drawings")
      .getPublicUrl(path);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error(`[generate-drawings] Upload exception for ${filename}:`, err);
    return null;
  }
}
