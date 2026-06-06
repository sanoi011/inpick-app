// src/app/api/project/parse-drawing/route.ts
// POST /api/project/parse-drawing - 도면 파일 업로드 → AI 인식 → ParsedFloorPlan

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractFloorPlanFromImage } from "@/lib/services/gemini-floorplan-parser";
import { extractPagesFromPdf } from "@/lib/services/pdf-extractor";
import {
  preprocessFloorPlanImage,
  isImageSizeValid,
  getMimeType,
} from "@/lib/services/image-preprocessor";
import type { ImageSource } from "@/lib/services/image-preprocessor";
import { extractPdfVectors } from "@/lib/services/pymupdf-extractor";
import type { VectorHints } from "@/lib/services/pymupdf-extractor";
import { callFloorplanAI, callPdfParserV47 } from "@/lib/services/floorplan-ai-client";
import { convertFloorplanAIResult, convertPdfParserV47Result } from "@/lib/services/floorplan-ai-converter";
import { enhancedFuse } from "@/lib/services/enhanced-fusion";

const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export const maxDuration = 60; // Vercel 60초 타임아웃

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const knownAreaStr = formData.get("knownArea") as string | null;
    const sourceType = (formData.get("source") as ImageSource) || "pdf";
    const sampleType = formData.get("sampleType") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 필요합니다" },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기가 25MB를 초과합니다" },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    const mimeType = getMimeType(filename);

    // DWG/DXF 미지원
    if (filename.endsWith(".dwg") || filename.endsWith(".dxf")) {
      return NextResponse.json(
        {
          error: "DWG/DXF 파일은 직접 업로드할 수 없습니다. PDF로 내보내기 후 업로드해주세요.",
          hint: "AutoCAD에서 '인쇄' → 'PDF로 저장'을 사용하세요",
        },
        { status: 400 }
      );
    }

    const knownArea = knownAreaStr ? parseFloat(knownAreaStr) : undefined;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let imageBase64: string;
    let imageMimeType: string;

    // 파일 타입별 처리
    if (mimeType === "application/pdf") {
      // PDF → PNG 변환
      try {
        const pdfResult = await extractPagesFromPdf(fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        ), 200, 10);

        if (pdfResult.pages.length === 0) {
          return NextResponse.json(
            { error: "PDF에서 페이지를 추출할 수 없습니다" },
            { status: 400 }
          );
        }

        // 가장 도면일 가능성이 높은 페이지 사용
        const bestPage = pdfResult.pages[pdfResult.bestFloorPlanPage];
        imageBase64 = bestPage.imageBase64;
        imageMimeType = "image/png";

        // 멀티페이지 PDF 정보
        if (pdfResult.pageCount > 1) {
          console.log(
            `[parse-drawing] Multi-page PDF (${pdfResult.pageCount} pages), selected page ${bestPage.pageNumber}`
          );
        }
      } catch (pdfError) {
        // PDF 파싱 실패 시 직접 base64로 시도 (Gemini가 PDF를 직접 처리할 수도 있음)
        console.warn("[parse-drawing] PDF extraction failed, trying raw base64:", pdfError);
        imageBase64 = fileBuffer.toString("base64");
        imageMimeType = "application/pdf";
      }
    } else {
      // 이미지 파일: 크기가 4MB 이하이면 전처리 없이 직접 사용 (canvas 재인코딩 품질 저하 방지)
      const rawBase64 = fileBuffer.toString("base64");
      const rawSizeBytes = (rawBase64.length * 3) / 4;
      if (rawSizeBytes < 4 * 1024 * 1024 && (mimeType === "image/png" || mimeType === "image/jpeg")) {
        imageBase64 = rawBase64;
        imageMimeType = mimeType;
        console.log(`[parse-drawing] Using raw image (${(rawSizeBytes / 1024).toFixed(0)} KB), skipping preprocess`);
      } else {
        const preprocessed = await preprocessFloorPlanImage(fileBuffer, sourceType);
        imageBase64 = preprocessed.base64;
        imageMimeType = preprocessed.mimeType;
      }
    }

    // 크기 검증
    if (!isImageSizeValid(imageBase64)) {
      return NextResponse.json(
        { error: "처리된 이미지가 너무 큽니다. 더 낮은 해상도로 시도해주세요." },
        { status: 400 }
      );
    }

    // 병렬 3호출: Gemini Vision + PyMuPDF + floorplan-ai
    const isPdf = mimeType === "application/pdf";

    // 1단계: PyMuPDF 벡터 추출 (Gemini 프롬프트에 힌트 주입 필요 → 먼저 실행)
    let vectorHints: VectorHints | null = null;
    if (isPdf) {
      try {
        const pyResult = await extractPdfVectors(fileBuffer, knownArea);
        vectorHints = pyResult?.vectorHints ?? null;
        if (vectorHints) {
          console.log(`[parse-drawing] PyMuPDF: ${vectorHints.dimensionTexts.length} dimension texts, ${vectorHints.wallLines.length} wall lines`);
        }
      } catch {
        // PyMuPDF 실패는 무시
      }
    }

    // 2단계: Gemini Vision + floorplan-ai + v4.7 pdf_parser 병렬 실행
    const [geminiSettled, aiSettled, v47Settled] = await Promise.allSettled([
      extractFloorPlanFromImage(imageBase64, imageMimeType, {
        knownAreaM2: knownArea,
        sourceType: sourceType as "pdf" | "photo" | "scan" | "hand_drawing",
        dimensionHints: vectorHints?.dimensionTexts,
        vectorScale: vectorHints?.scale,
        sampleType: sampleType || undefined,
      }),
      callFloorplanAI(fileBuffer, file.name),
      callPdfParserV47(fileBuffer, file.name),
    ]);

    // Gemini 결과 추출 (정책 차단 또는 키 미설정 시 null)
    let result = geminiSettled.status === "fulfilled" ? geminiSettled.value : null;

    // floorplan-ai 결과 변환 (legacy 또는 v4.7)
    const aiRawResult = aiSettled.status === "fulfilled" ? aiSettled.value : null;
    const v47RawResult = v47Settled.status === "fulfilled" ? v47Settled.value : null;

    // v4.7 결과가 있으면 우선 사용, 없으면 legacy 사용
    let aiParsedPlan = null;
    if (v47RawResult && v47RawResult.success) {
      aiParsedPlan = convertPdfParserV47Result(v47RawResult, knownArea);
      console.log(`[parse-drawing] pdf-parser-v47: ${aiParsedPlan.rooms.length} rooms, ${aiParsedPlan.walls.length} walls, ${aiParsedPlan.doors.length} doors`);
    } else if (aiRawResult) {
      aiParsedPlan = convertFloorplanAIResult(aiRawResult, knownArea);
      console.log(`[parse-drawing] floorplan-ai: ${aiParsedPlan.rooms.length} rooms, ${aiParsedPlan.walls.length} walls, ${aiParsedPlan.doors.length} doors`);
    }

    // Phase E (graceful degrade — 2026-05-10): Gemini 정책 차단 시
    // Python 결과(floorplan-ai 또는 v47)만으로 응답 구성
    // TODO: OpenAI Vision으로 마이그레이션 (docs/ops/GEMINI_REMOVAL_AUDIT.md Phase E)
    if (!result) {
      if (aiParsedPlan) {
        console.warn("[parse-drawing] Gemini unavailable — using Python-only fallback");
        // method 필드는 gemini-floorplan-parser의 union literal — 임시 cast로 graceful 응답
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = {
          floorPlan: aiParsedPlan,
          confidence: 0.6,
          warnings: ["Gemini 시맨틱 분석 비활성화 — 정확도 일부 저하"],
          processingTimeMs: 0,
          method: "python_only_fallback",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } else {
        return NextResponse.json(
          {
            error: "도면 분석 미설정",
            hint:
              "Gemini가 비활성화되어 있고 floorplan-ai/pdf-parser-v47도 응답 없음. " +
              "Python 서비스를 켜거나 OpenAI Vision 마이그레이션이 필요합니다.",
          },
          { status: 503 },
        );
      }
    }

    // 3단계: Enhanced Fusion (Gemini + floorplan-ai + PyMuPDF)
    // 위 fallback 분기로 result는 항상 non-null. TS narrowing용 명시.
    const finalResult: NonNullable<typeof result> = result as NonNullable<typeof result>;
    const isTemplateMatch =
      finalResult.confidence >= 1.0 && finalResult.repairMetrics?.sizeCV === 1.0;
    const fusionResult = isTemplateMatch
      ? { floorPlan: finalResult.floorPlan, stats: {}, sources: {} }
      : enhancedFuse(finalResult.floorPlan, aiParsedPlan, vectorHints);
    finalResult.floorPlan = fusionResult.floorPlan;
    // 이후 코드 호환을 위해 result에도 같은 참조 유지
    result = finalResult;

    // 도면 파싱 로그 기록 (fire-and-forget)
    if (supabase) {
      const projectId = formData.get("projectId") as string | null;
      supabase.from("drawing_parse_logs").insert({
        project_id: projectId || null,
        file_name: file.name,
        file_type: filename.split(".").pop() || "unknown",
        file_size_bytes: file.size,
        parse_method: result.method,
        result_json: result.floorPlan,
        confidence_score: result.confidence,
        warnings: result.warnings,
        processing_time_ms: result.processingTimeMs,
        known_area_m2: knownArea || null,
        detected_area_m2: result.floorPlan.totalArea,
        room_count: result.floorPlan.rooms.length,
      }).then(({ error: logError }) => {
        if (logError) console.warn("[parse-drawing] Log insert failed:", logError.message);
      }, (err) => {
        console.warn("[parse-drawing] Log insert error:", err);
      });
    }

    return NextResponse.json({
      floorPlan: result.floorPlan,
      confidence: result.confidence,
      warnings: result.warnings,
      processingTimeMs: result.processingTimeMs,
      method: result.method,
      roomCount: result.floorPlan.rooms.length,
      totalArea: result.floorPlan.totalArea,
      ...(vectorHints ? {
        vectorHints: {
          dimensionTexts: vectorHints.dimensionTexts,
          wallLineCount: vectorHints.wallLines.length,
          scale: vectorHints.scale,
          pageSize: vectorHints.pageSize,
        },
        vectorMethod: "pymupdf_hybrid",
      } : {}),
      aiPipelineUsed: !!aiParsedPlan,
      aiPipelineVersion: v47RawResult?.success ? 'v4.7' : (aiRawResult ? 'legacy' : null),
      ...(aiParsedPlan ? {
        aiPipelineStats: fusionResult.stats,
        aiPipelineSources: fusionResult.sources,
      } : {}),
      ...(v47RawResult?.success ? {
        v47Scale: v47RawResult.scale,
        v47OpeningSubtypes: v47RawResult.opening_subtypes,
      } : {}),
      ...(result.repairMetrics ? {
        repairMetrics: result.repairMetrics,
      } : {}),
    });
  } catch (error) {
    console.error("[parse-drawing] Error:", error);
    return NextResponse.json(
      { error: "도면 분석 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
