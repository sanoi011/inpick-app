/**
 * GPT-4o Vision 기반 segmentation provider.
 * 인프라 없이 작동. SAM이 비활성/미인증인 동안의 기본 동작.
 * 정확도는 SAM 2.1 대비 떨어지지만 polygon 좌표 직접 출력해서 단일 호출로 끝남.
 */
import { analyzeImageVision } from "../openai-client";
import {
  INTERIOR_CATEGORIES,
  REPLACEABLE_CATEGORIES,
  FURNITURE_CATEGORIES,
  type InteriorCategory,
  type SegRegion,
  type SegmentationData,
} from "@/types/segmentation";
import type { SegmentationProvider, SegmentInput } from "./provider";

const PROMPT = `이 이미지는 한국 인테리어 렌더링 사진입니다. 클릭 가능한 자재/가구 영역을 추출하세요.

JSON 응답 (반드시 valid object):
{
  "imageWidth": <px>,
  "imageHeight": <px>,
  "regions": [
    {
      "id": "region_001",
      "category": "floor|wall|ceiling|window|door|curtain|sofa|chair|table|bed|cabinet|lighting|plant|rug|artwork|unknown",
      "polygon": [[0.12, 0.65], [0.88, 0.62], [0.92, 0.95], [0.08, 0.98]],
      "bbox": [0.08, 0.62, 0.84, 0.36],
      "confidence": 0.92,
      "guessed_material": "오크 원목마루",
      "guessed_color_hex": "#C8A77D"
    }
  ]
}

규칙:
- polygon 좌표는 0~1 정규화 (이미지 left-top = (0,0), right-bottom = (1,1))
- bbox = [x_min, y_min, width, height] 정규화
- 4~10개 꼭짓점으로 단순화. 곡면은 다각형 근사 OK
- id는 "region_001" 형식으로 0부터 순번
- category는 위 enum 중 정확히 하나 (한국어 X, 영문 소문자)
- 큰 면적 우선: 바닥 → 주벽 3면 → 천장 → 주요 가구
- 작은 소품(쿠션, 책, 식기) 무시
- confidence 0.3 미만이면 category="unknown"
- 최대 12개 영역까지`;

interface RawRegion {
  id?: string;
  category?: string;
  polygon?: [number, number][];
  bbox?: [number, number, number, number];
  confidence?: number;
  guessed_material?: string;
  guessed_color_hex?: string;
}

function polygonAreaNormalized(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0, n = polygon.length; i < n; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function isCategory(c: string): c is InteriorCategory {
  return Object.prototype.hasOwnProperty.call(INTERIOR_CATEGORIES, c);
}

export const gpt4oProvider: SegmentationProvider = {
  name: "gpt-4o-vision",
  async segment(input: SegmentInput): Promise<SegmentationData> {
    const visionRes = await analyzeImageVision({
      imageUrl: input.imageUrl,
      imageBase64: input.imageBase64,
      prompt: PROMPT + (input.roomName ? `\n공간: ${input.roomName}` : ""),
      responseFormat: "json_object",
    });

    let parsed: { imageWidth?: number; imageHeight?: number; regions?: RawRegion[] };
    try {
      parsed = JSON.parse(visionRes.content);
    } catch {
      throw new Error("GPT-4o segmentation JSON 파싱 실패");
    }

    const imageWidth = parsed.imageWidth || 1024;
    const imageHeight = parsed.imageHeight || 1024;
    const raw = parsed.regions || [];

    const regions: SegRegion[] = [];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      if (!r.polygon || !Array.isArray(r.polygon) || r.polygon.length < 3) continue;
      const cat: InteriorCategory =
        r.category && isCategory(r.category) ? r.category : "unknown";
      const conf = typeof r.confidence === "number" ? r.confidence : 0.5;
      const finalCat: InteriorCategory = conf < 0.3 ? "unknown" : cat;
      const areaN = polygonAreaNormalized(r.polygon);
      // 0.5% 미만 영역 스킵 (가이드 §1-4 § "너무 작은 영역 제외")
      if (areaN < 0.005) continue;

      const bbox: [number, number, number, number] = (() => {
        if (r.bbox && r.bbox.length === 4) return r.bbox as [number, number, number, number];
        const xs = r.polygon.map(([x]) => x);
        const ys = r.polygon.map(([, y]) => y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY];
      })();

      regions.push({
        id: r.id || `region_${String(i).padStart(3, "0")}`,
        category: finalCat,
        label_ko: INTERIOR_CATEGORIES[finalCat],
        polygon: r.polygon,
        bbox,
        confidence: conf,
        is_replaceable: REPLACEABLE_CATEGORIES.has(finalCat),
        is_furniture: FURNITURE_CATEGORIES.has(finalCat),
        current_material: null,
        current_material_sku: null,
        area_normalized: areaN,
        guessed_material: r.guessed_material,
        guessed_color_hex: r.guessed_color_hex,
      });
    }

    // 픽셀↔실면적 변환 비율 (시공 가능 영역의 정규화 면적 합으로 매핑)
    let pixel_to_sqm_ratio: number | undefined;
    if (input.realWorldAreaSqm && input.realWorldAreaSqm > 0) {
      const constructionAreaN = regions
        .filter((r) => r.is_replaceable)
        .reduce((s, r) => s + r.area_normalized, 0);
      if (constructionAreaN > 0) {
        pixel_to_sqm_ratio = input.realWorldAreaSqm / constructionAreaN;
        for (const r of regions) {
          r.area_sqm = Math.round(r.area_normalized * pixel_to_sqm_ratio * 100) / 100;
        }
      }
    }

    return {
      image_id: `img_${Date.now().toString(36)}`,
      image_url: input.imageUrl,
      image_size: [imageWidth, imageHeight],
      real_world_area_sqm: input.realWorldAreaSqm,
      pixel_to_sqm_ratio,
      total_regions: regions.length,
      regions,
      provider: "gpt-4o-vision",
      created_at: new Date().toISOString(),
    };
  },
};
