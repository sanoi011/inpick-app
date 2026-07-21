/**
 * material_products 테이블 lookup — 견적 라인에 실제 brand/sku/spec 채움.
 *
 * 대표 지목 핵심 기능 ("우리의 킥"):
 *   견적 생성 시 generic 자재명("강마루") 대신
 *   material_products 테이블 (253K rows, vision 기반 카탈로그)에서
 *   surface 타입별 top product (brand + sku + spec + 실제 가격)를 자동 매칭.
 *
 * 매칭 우선순위:
 *   1. is_verified=true + popularity_score DESC + price_grade=standard
 *   2. is_verified=true + price_grade=standard
 *   3. price_grade=standard
 *   4. (없으면 lookup 미적용 — 기존 generic 자재명 + KPA 단가 그대로)
 *
 * Surface → category_code 매핑:
 *   - 거실/안방/일반 거주 공간:
 *     바닥 → FLOORING
 *     벽   → WALLPAPER
 *     천장 → CEILING
 *     도어 → DOOR_ROOM
 *   - 욕실:
 *     바닥 → BATH_TILE
 *     벽   → BATH_TILE
 *     fixture → BATH_SET / TOILET / VANITY
 *   - 주방:
 *     fixture → KITCHEN_CABINET / KITCHEN_SINK
 *     벽   → KITCHEN_TILE (있으면) / WALLPAPER
 *   - 현관:
 *     도어 → ENTRY_DOOR
 *
 * 사용:
 *   const item = await lookupMaterialProduct({ surface: "바닥", roomName: "거실" });
 *   if (item) { brand=item.brand, sku=item.sku, ... }
 */

import { createClient } from "@supabase/supabase-js";
import {
  MATERIAL_PRODUCT_CATEGORY_CODES,
  materialProductCategoryCodes,
} from "@/lib/inpick/material-product-category-codes";

// ─── 매칭 결과 ───
export interface MaterialProductMatch {
  brand: string;
  productName: string;
  sku?: string; // model_number
  specification?: string;
  contractorPrice?: number; // 사업자 단가 (원)
  retailPrice?: number; // 소비자 단가 (원)
  unit: string;
  priceGrade?: string;
  thumbnailUrl?: string;
  categoryCode: string;
  sourceProductId: string; // audit
}

// ─── Surface + Room → category_code 결정 ───
type RoomCategory =
  | "living_general"
  | "bath"
  | "kitchen"
  | "entry"
  | "balcony"
  | "utility"
  | "dressroom";

function classifyRoom(roomName: string): RoomCategory {
  const r = roomName.toLowerCase();
  if (r.includes("욕실") || r.includes("화장실") || r.includes("bath")) return "bath";
  if (r.includes("부엌") || r.includes("주방") || r.includes("kitchen")) return "kitchen";
  if (r.includes("현관") || r.includes("entrance") || r.includes("entry")) return "entry";
  if (r.includes("베란다") || r.includes("발코니") || r.includes("balcony")) return "balcony";
  if (r.includes("다용도실") || r.includes("팬트리") || r.includes("utility")) return "utility";
  if (r.includes("드레스룸") || r.includes("walk")) return "dressroom";
  return "living_general";
}

function surfaceToCategoryCodes(
  surface: string,
  roomCat: RoomCategory,
  materialName: string,
): string[] {
  const s = surface.toLowerCase();
  const m = (materialName || "").toLowerCase();

  // 1. 명시적 surface 키워드
  if (s.includes("fixture")) {
    if (roomCat === "bath") {
      if (m.includes("변기") || m.includes("toilet")) {
        return ["MEC-SAN-TOILET", "MECH_SANITARY_WC", "TOILET"];
      }
      if (m.includes("세면") || m.includes("vanity")) {
        return ["MEC-SAN-BASIN", "MEC-FAU-BASIN", "MECH_SANITARY_BASIN", "VANITY"];
      }
      if (m.includes("샤워") || m.includes("욕조") || m.includes("shower")) {
        return ["MEC-SAN-BATHTUB", "MECH_SANITARY_TUB", "MECH_FAUCET_SHOWER", "SHOWER_BATH"];
      }
      return materialProductCategoryCodes("sanitary", "fixture");
    }
    if (roomCat === "kitchen") {
      if (m.includes("수전")) return ["MEC-FAU-KITCHEN", "MECH_FAUCET"];
      if (m.includes("싱크")) return ["ARCH_KITCHEN_SINK", "KITCHEN_SINK"];
      if (m.includes("상판")) return materialProductCategoryCodes("countertop");
      if (m.includes("후드")) return ["FUR-KIT-HOOD", "ARCH_KITCHEN_HOOD"];
      if (m.includes("쿡탑") || m.includes("인덕션")) return ["FUR-KIT-COOKTOP"];
      return materialProductCategoryCodes("cabinet", "countertop", "fixture");
    }
    if (m.includes("보일러")) return ["MEC-HEAT-BOILER"];
    if (roomCat === "dressroom") return ["STORAGE", ...MATERIAL_PRODUCT_CATEGORY_CODES.cabinet];
    return materialProductCategoryCodes("fixture", "cabinet");
  }

  if (s.includes("도어") || s.includes("door")) {
    return materialProductCategoryCodes("door");
  }

  if (s.includes("창호") || s.includes("window")) return materialProductCategoryCodes("window");

  if (s.includes("조명") || s.includes("light")) return materialProductCategoryCodes("lighting");

  if (s.includes("걸레") || s.includes("baseboard")) return materialProductCategoryCodes("baseboard");

  if (s.includes("바닥") || s.includes("floor")) {
    if (roomCat === "bath" || m.includes("타일") || m.includes("포세린")) {
      return materialProductCategoryCodes("tile");
    }
    return MATERIAL_PRODUCT_CATEGORY_CODES.floor.filter(
      (code) => code !== "MAT-FLR-PORCELAIN",
    );
  }

  if (s.includes("벽") || s.includes("wall")) {
    if (roomCat === "bath" || (roomCat === "kitchen" && m.includes("타일"))) {
      return materialProductCategoryCodes("tile");
    }
    if (m.includes("도장") || m.includes("페인트")) {
      return ["MAT-WAL-PAINT", "ARCH_WALL_PAINT", "ARCH_PAINT", "PAINT", "WALL_PAINT"];
    }
    return [
      "MAT-WAL-WALLPAPER-SILK",
      "ARCH_WALL",
      "ARCH_WALL_SILK",
      "ARCH_WALL_PAPER",
      "WALLPAPER",
      "WALL_PAPER",
    ];
  }

  if (s.includes("천장") || s.includes("ceil")) {
    return roomCat === "bath"
      ? materialProductCategoryCodes("ceiling")
      : MATERIAL_PRODUCT_CATEGORY_CODES.ceiling.filter(
          (code) => code !== "MAT-CEI-SMC",
        );
  }

  return [];
}

// ─── Supabase admin client (캐시) ───
let _cachedClient: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_cachedClient) return _cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _cachedClient;
}

// ─── In-memory 단순 캐시 (process 수명) ───
const matchCache = new Map<string, MaterialProductMatch | null>();

/**
 * surface + roomName → material_products 매칭.
 * 매칭 실패 시 null (호출자가 기존 generic name + KPA 가격 사용).
 */
export async function lookupMaterialProduct(input: {
  surface: string;
  roomName: string;
  materialName?: string;
  preferredGrade?: "economy" | "standard" | "premium";
}): Promise<MaterialProductMatch | null> {
  const admin = getAdmin();
  if (!admin) return null; // env 미설정 시 lookup skip (호환)

  const roomCat = classifyRoom(input.roomName);
  const categoryCodes = surfaceToCategoryCodes(
    input.surface,
    roomCat,
    input.materialName || "",
  );
  if (categoryCodes.length === 0) return null;

  const grade = input.preferredGrade || "standard";
  const cacheKey = `${categoryCodes.join(",")}|${grade}`;
  if (matchCache.has(cacheKey)) {
    return matchCache.get(cacheKey) ?? null;
  }

  // 우선순위: verified + grade 일치 → grade 일치 → 카테고리만
  // popularity_score DESC, retail_price IS NOT NULL 우선
  try {
    const select =
      "id, category_code, brand, product_name, model_number, specification, retail_price, contractor_price, unit, price_grade, thumbnail_url, popularity_score, is_verified";
    const queryOne = async (options: {
      verified?: boolean;
      matchingGrade?: boolean;
      priced?: boolean;
    }) => {
      let query = admin
        .from("material_products")
        .select(select)
        .in("category_code", categoryCodes)
        .not("brand", "is", null)
        .order("is_verified", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .limit(1);
      if (options.verified) query = query.eq("is_verified", true);
      if (options.matchingGrade) query = query.eq("price_grade", grade);
      if (options.priced) {
        query = query.or("contractor_price.not.is.null,retail_price.not.is.null");
      }
      return query;
    };

    // 실제 견적에서는 이미지/인기도보다 검증 가격을 먼저 선택한다.
    const attempts = [
      { verified: true, matchingGrade: true, priced: true },
      { matchingGrade: true, priced: true },
      { verified: true, matchingGrade: true },
      { matchingGrade: true },
      {},
    ];
    let data: Array<Record<string, unknown>> | null = null;
    let error: { message: string } | null = null;
    for (const attempt of attempts) {
      const result = await queryOne(attempt);
      data = result.data as Array<Record<string, unknown>> | null;
      error = result.error;
      if (error || (data && data.length > 0)) break;
    }

    if (error) {
      console.warn(
        `[material-lookup] supabase error for ${categoryCodes.join(",")}: ${error.message}`,
      );
      matchCache.set(cacheKey, null);
      return null;
    }
    if (!data || data.length === 0) {
      matchCache.set(cacheKey, null);
      return null;
    }

    const p = data[0] as {
      id: string;
      category_code: string;
      brand: string;
      product_name: string;
      model_number?: string;
      specification?: string;
      retail_price?: number;
      contractor_price?: number;
      unit?: string;
      price_grade?: string;
      thumbnail_url?: string;
    };
    const result: MaterialProductMatch = {
      brand: p.brand,
      productName: p.product_name,
      sku: p.model_number || undefined,
      specification: p.specification || undefined,
      contractorPrice: p.contractor_price || undefined,
      retailPrice: p.retail_price || undefined,
      unit: p.unit || "EA",
      priceGrade: p.price_grade || undefined,
      thumbnailUrl: p.thumbnail_url || undefined,
      categoryCode: p.category_code,
      sourceProductId: p.id,
    };
    matchCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.warn(
      `[material-lookup] unexpected error for ${categoryCodes.join(",")}: ${e instanceof Error ? e.message : String(e)}`,
    );
    matchCache.set(cacheKey, null);
    return null;
  }
}

// ─── 캐시 클리어 (test/admin) ───
export function clearMaterialLookupCache(): void {
  matchCache.clear();
}
