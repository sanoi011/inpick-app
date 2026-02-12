// src/app/api/project/parse-drawing/route.ts
// POST /api/project/parse-drawing - 도면 파일 업로드 → AI 인식 → ParsedFloorPlan

import { NextRequest, NextResponse } from "next/server";
import { extractFloorPlanFromImage } from "@/lib/services/gemini-floorplan-parser";
import { extractPagesFromPdf } from "@/lib/services/pdf-extractor";
import {
  preprocessFloorPlanImage,
  isImageSizeValid,
  getMimeType,
} from "@/lib/services/image-preprocessor";
import type { ImageSource } from "@/lib/services/image-preprocessor";

export const maxDuration = 60; // Vercel 60초 타임아웃

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const knownAreaStr = formData.get("knownArea") as string | null;
    const sourceType = (formData.get("source") as ImageSource) || "pdf";

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

    // Gemini Vision 도면 인식
    const result = await extractFloorPlanFromImage(imageBase64, imageMimeType, {
      knownAreaM2: knownArea,
    });

    return NextResponse.json({
      floorPlan: result.floorPlan,
      confidence: result.confidence,
      warnings: result.warnings,
      processingTimeMs: result.processingTimeMs,
      method: result.method,
      roomCount: result.floorPlan.rooms.length,
      totalArea: result.floorPlan.totalArea,
    });
  } catch (error) {
    console.error("[parse-drawing] Error:", error);
    return NextResponse.json(
      {
        error: "도면 분석 중 오류가 발생했습니다",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
