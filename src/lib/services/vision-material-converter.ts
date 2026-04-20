// AI Vision 분석 결과 → SelectedMaterial[] 변환
// estimate-calculator의 materialOverrides로 바로 연결

import type { SelectedMaterial } from "@/types/consumer-project";
import type {
  VisionAnalysisResult,
} from "@/app/api/project/analyze-design-image/route";

/**
 * 단일 방의 Vision 분석 결과를 SelectedMaterial[]로 변환
 */
export function convertVisionToMaterials(
  analysis: VisionAnalysisResult,
  roomId: string,
): SelectedMaterial[] {
  return analysis.materials
    .filter((m) => m.confidence >= 0.5) // 신뢰도 50% 이상만
    .map((mat, idx) => ({
      id: `vision-${roomId}-${mat.categoryCode}-${idx}`,
      roomId,
      roomName: analysis.roomName,
      category: mat.categoryName,
      categoryCode: mat.categoryCode,
      part: mat.categoryName,
      materialName: mat.materialName,
      specification: mat.specification,
      unitPrice: mat.estimatedUnitPrice,
      laborPrice: mat.estimatedLaborPrice,
      unit: mat.unit,
      priceGrade: mat.priceGrade,
      confirmed: true, // Vision 분석 결과는 자동 확정
    }));
}

/**
 * 4개 방(거실/주방/침실/욕실) Vision 분석 결과를 합쳐서
 * 전체 프로젝트의 SelectedMaterial[]로 변환
 */
export function convertAllRoomsVisionToMaterials(
  analyses: { roomKey: string; roomId: string; result: VisionAnalysisResult }[],
): SelectedMaterial[] {
  const allMaterials: SelectedMaterial[] = [];
  const seenCategories = new Set<string>();

  for (const { roomId, result } of analyses) {
    const converted = convertVisionToMaterials(result, roomId);

    for (const mat of converted) {
      // 같은 categoryCode가 이미 있으면 (예: 거실/침실 둘 다 FLOORING)
      // 첫 번째 것만 유지 (전체 주거 공간에 동일 바닥재 적용 가정)
      const globalCategories = ["FLOORING", "WALLPAPER", "PAINT", "CEILING", "BASEBOARD", "DOOR_ROOM", "ENTRY_DOOR"];
      if (globalCategories.includes(mat.categoryCode || "")) {
        if (seenCategories.has(mat.categoryCode || "")) continue;
        seenCategories.add(mat.categoryCode || "");
      }

      allMaterials.push(mat);
    }
  }

  return allMaterials;
}

/**
 * Vision 분석에서 빌트인 가구만 추출하여 SelectedMaterial에 추가
 * (붙박이장, 신발장 등 시공에 포함되는 항목)
 */
export function extractBuiltInFurniture(
  analysis: VisionAnalysisResult,
  roomId: string,
): SelectedMaterial[] {
  return analysis.furniture
    .filter((f) => f.isBuiltIn)
    .map((f, idx) => {
      // 가구 종류에 따라 categoryCode 매핑
      const categoryMap: Record<string, { code: string; name: string }> = {
        "붙박이장": { code: "WARDROBE", name: "붙박이장" },
        "신발장": { code: "SHOE_CABINET", name: "신발장" },
        "드레스룸": { code: "WARDROBE", name: "붙박이장" },
      };

      const matched = Object.entries(categoryMap).find(([key]) =>
        f.name.includes(key)
      );
      const category = matched?.[1] || { code: "WARDROBE", name: "빌트인 가구" };

      return {
        id: `vision-builtin-${roomId}-${idx}`,
        roomId,
        roomName: analysis.roomName,
        category: category.name,
        categoryCode: category.code,
        part: category.name,
        materialName: f.name,
        specification: `${f.material} ${f.estimatedSize}`,
        unitPrice: f.estimatedPrice,
        laborPrice: 0,
        unit: "EA",
        priceGrade: "standard" as const,
        confirmed: true,
      };
    });
}

/**
 * Vision 분석 결과의 요약 정보 생성
 */
export function createVisionSummary(
  analyses: VisionAnalysisResult[],
): {
  totalMaterials: number;
  totalFurniture: number;
  averageConfidence: number;
  styles: string[];
  estimatedGrade: "economy" | "standard" | "premium";
} {
  let totalMaterials = 0;
  let totalFurniture = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  const styles = new Set<string>();
  const grades: string[] = [];

  for (const a of analyses) {
    totalMaterials += a.materials.length;
    totalFurniture += a.furniture.length;
    styles.add(a.overallStyle);

    for (const m of a.materials) {
      totalConfidence += m.confidence;
      confidenceCount++;
      grades.push(m.priceGrade);
    }
  }

  // 가장 많이 나온 등급
  const gradeCount = { economy: 0, standard: 0, premium: 0 };
  for (const g of grades) {
    if (g in gradeCount) gradeCount[g as keyof typeof gradeCount]++;
  }
  const estimatedGrade = (Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "standard") as "economy" | "standard" | "premium";

  return {
    totalMaterials,
    totalFurniture,
    averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    styles: Array.from(styles),
    estimatedGrade,
  };
}
