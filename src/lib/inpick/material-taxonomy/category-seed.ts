/**
 * 자재 카테고리 seed — 5대 discipline (MAT/ARC/MEC/ELE/FUR).
 * 가이드: inpick-material-category-taxonomy-base-20260513.md §4~8
 *
 * AI는 이 카테고리를 통해 material_products를 조회한다.
 * AI가 brand/manufacturer/sku를 생성하지 않는다.
 */

export type Discipline = "MAT" | "ARC" | "MEC" | "ELE" | "FUR";

export interface MaterialCategorySeed {
  categoryCode: string;
  discipline: Discipline;
  majorNameKo: string;
  middleNameKo: string;
  minorNameKo: string;
  displayNameKo: string;
  /** 연결 공종 코드 (17공종) */
  tradeCodes: string[];
  defaultUnit: "m2" | "m" | "ea" | "set" | "roll" | "box" | "sheet" | "kg" | "lot" | "L" | "bag";
  /** specJson 권장 키 (검색 시 활용) */
  specKeys: string[];
  /** 자연어 검색 키워드 — alias 자동 생성 */
  keywords: string[];
  /** material_products 매칭 강제 (false면 카테고리 표준 단가 허용) */
  requiresProductMatch: boolean;
  /** 500K+ 평균 단가 → fallback 시 경고 필수 */
  highValue: boolean;
}

export const MATERIAL_CATEGORY_SEED: MaterialCategorySeed[] = [
  // ─── MAT 건자재 — 바닥재 ─────────────────────────────────────
  { categoryCode: "MAT-FLR-ENGINEERED", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "강마루", displayNameKo: "강마루", tradeCodes: ["10"], defaultUnit: "m2", specKeys: ["thickness_mm", "width_mm", "length_mm", "surface_finish"], keywords: ["강마루", "마루", "engineered wood", "엔지니어드"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-SOLIDWOOD", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "원목마루", displayNameKo: "원목마루", tradeCodes: ["10"], defaultUnit: "m2", specKeys: ["wood_species", "thickness_mm", "width_mm"], keywords: ["원목마루", "solid wood"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-LAMINATE", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "강화마루", displayNameKo: "강화마루", tradeCodes: ["10"], defaultUnit: "m2", specKeys: ["thickness_mm", "grade", "click_method"], keywords: ["강화마루", "laminate"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-SHEET", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "장판", displayNameKo: "장판/륨", tradeCodes: ["10"], defaultUnit: "m2", specKeys: ["thickness_mm", "width_mm"], keywords: ["장판", "륨", "vinyl sheet"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-LVT", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "데코타일", displayNameKo: "데코타일/LVT", tradeCodes: ["10"], defaultUnit: "m2", specKeys: ["thickness_mm", "size", "installation"], keywords: ["데코타일", "LVT", "luxury vinyl"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-PORCELAIN", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "포세린타일", displayNameKo: "포세린 타일", tradeCodes: ["07", "10"], defaultUnit: "m2", specKeys: ["size", "finish", "slip_rating"], keywords: ["포세린", "porcelain", "포세린타일"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-FLR-CERAMIC", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "바닥재", minorNameKo: "세라믹타일", displayNameKo: "세라믹 타일", tradeCodes: ["07"], defaultUnit: "m2", specKeys: ["size", "glaze"], keywords: ["세라믹", "ceramic"], requiresProductMatch: true, highValue: false },

  // ─── MAT 건자재 — 벽/천장 ────────────────────────────────────
  { categoryCode: "MAT-WAL-WALLPAPER-SILK", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "실크벽지", displayNameKo: "실크벽지", tradeCodes: ["09"], defaultUnit: "m2", specKeys: ["width_mm", "pattern", "eco_grade"], keywords: ["실크벽지", "실크", "silk wallpaper"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WAL-WALLPAPER-PAPER", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "합지벽지", displayNameKo: "합지벽지", tradeCodes: ["09"], defaultUnit: "m2", specKeys: ["width_mm", "pattern"], keywords: ["합지", "합지벽지", "paper wallpaper"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WAL-PAINT", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "도장", displayNameKo: "친환경 도장", tradeCodes: ["08"], defaultUnit: "L", specKeys: ["paint_type", "eco", "sheen"], keywords: ["도장", "페인트", "paint"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WAL-FILM", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "인테리어필름", displayNameKo: "인테리어 필름", tradeCodes: ["08", "03"], defaultUnit: "m2", specKeys: ["width_mm", "color", "pattern"], keywords: ["필름", "인테리어필름", "interior film"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WAL-TILE", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "벽타일", displayNameKo: "벽 타일", tradeCodes: ["07"], defaultUnit: "m2", specKeys: ["size", "absorption_rate"], keywords: ["벽타일", "wall tile"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WAL-WOODPANEL", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "벽마감", minorNameKo: "우드패널", displayNameKo: "우드패널/템바보드", tradeCodes: ["03", "08"], defaultUnit: "m2", specKeys: ["width_mm", "thickness_mm", "wood_species"], keywords: ["우드패널", "템바보드", "wood panel"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-CEI-GYPSUM", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "천장재", minorNameKo: "석고보드", displayNameKo: "석고보드 천장", tradeCodes: ["03", "09"], defaultUnit: "sheet", specKeys: ["thickness_mm", "waterproof"], keywords: ["석고보드", "gypsum"], requiresProductMatch: false, highValue: false },
  { categoryCode: "MAT-CEI-SMC", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "천장재", minorNameKo: "욕실 SMC", displayNameKo: "욕실 SMC 천장", tradeCodes: ["13"], defaultUnit: "m2", specKeys: ["size", "fan_hole"], keywords: ["SMC", "욕실천장", "smc ceiling"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-MLD-BASEBOARD", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "몰딩", minorNameKo: "걸레받이", displayNameKo: "걸레받이", tradeCodes: ["10"], defaultUnit: "m", specKeys: ["height_mm", "material"], keywords: ["걸레받이", "baseboard"], requiresProductMatch: false, highValue: false },

  // ─── MAT 건자재 — 부자재 ─────────────────────────────────────
  { categoryCode: "MAT-AUX-TILE-ADHESIVE", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "타일부자재", minorNameKo: "타일접착제", displayNameKo: "타일 접착제", tradeCodes: ["07"], defaultUnit: "bag", specKeys: ["type", "weight_kg"], keywords: ["타일접착제", "백시멘트"], requiresProductMatch: false, highValue: false },
  { categoryCode: "MAT-AUX-GROUT", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "타일부자재", minorNameKo: "줄눈재", displayNameKo: "줄눈재", tradeCodes: ["07"], defaultUnit: "kg", specKeys: ["color", "waterproof"], keywords: ["줄눈재", "줄눈", "grout"], requiresProductMatch: false, highValue: false },
  { categoryCode: "MAT-AUX-SILICONE", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "실리콘", minorNameKo: "실리콘", displayNameKo: "실리콘/실란트", tradeCodes: ["07", "13"], defaultUnit: "ea", specKeys: ["color", "type"], keywords: ["실리콘", "실란트", "silicone"], requiresProductMatch: false, highValue: false },

  // ─── MAT 건자재 — 도어/창호 ──────────────────────────────────
  { categoryCode: "MAT-DOOR-ABS", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "도어", minorNameKo: "ABS도어", displayNameKo: "ABS 도어", tradeCodes: ["11"], defaultUnit: "ea", specKeys: ["width_mm", "height_mm"], keywords: ["ABS도어", "ABS 도어", "방문"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-DOOR-WOOD", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "도어", minorNameKo: "목문", displayNameKo: "목문", tradeCodes: ["11"], defaultUnit: "ea", specKeys: ["width_mm", "height_mm", "finish"], keywords: ["목문", "원목문", "wood door"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MAT-WDW-PVC", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "창호", minorNameKo: "PVC창호", displayNameKo: "PVC 창호", tradeCodes: ["11"], defaultUnit: "m2", specKeys: ["frame_type", "glass", "u_value"], keywords: ["PVC창호", "이중창", "시스템창호"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MAT-WDW-AL", discipline: "MAT", majorNameKo: "건자재", middleNameKo: "창호", minorNameKo: "알루미늄창호", displayNameKo: "알루미늄 창호", tradeCodes: ["11"], defaultUnit: "m2", specKeys: ["frame_type", "thermal_break"], keywords: ["알루미늄창호", "AL창호"], requiresProductMatch: true, highValue: true },

  // ─── ARC 건축자재 — 가설/보양/철거 ───────────────────────────
  { categoryCode: "ARC-TMP-FLOOR-PROTECT", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "보양", minorNameKo: "바닥보양", displayNameKo: "바닥 보양재", tradeCodes: ["01"], defaultUnit: "m2", specKeys: ["material"], keywords: ["보양", "바닥보양", "PE보양"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-DEM-FLOOR", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "철거", minorNameKo: "바닥철거", displayNameKo: "기존 바닥재 철거", tradeCodes: ["02"], defaultUnit: "m2", specKeys: [], keywords: ["바닥철거", "마루철거", "장판철거"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-DEM-WALLPAPER", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "철거", minorNameKo: "벽지철거", displayNameKo: "기존 벽지 제거", tradeCodes: ["02"], defaultUnit: "m2", specKeys: [], keywords: ["벽지철거", "도배철거"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-DEM-TILE", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "철거", minorNameKo: "타일철거", displayNameKo: "기존 타일 철거", tradeCodes: ["02"], defaultUnit: "m2", specKeys: [], keywords: ["타일철거"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-DEM-KITCHEN", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "철거", minorNameKo: "주방철거", displayNameKo: "기존 싱크대 철거", tradeCodes: ["02", "14"], defaultUnit: "m", specKeys: [], keywords: ["싱크대철거", "주방철거"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-WST-TRUCK", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "폐기물", minorNameKo: "운반", displayNameKo: "폐기물 반출", tradeCodes: ["15"], defaultUnit: "lot", specKeys: ["truck_size"], keywords: ["폐기물", "운반", "반출"], requiresProductMatch: false, highValue: false },

  // ─── ARC 건축자재 — 목공/방수 ────────────────────────────────
  { categoryCode: "ARC-WP-LIQUID", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "방수", minorNameKo: "액체방수", displayNameKo: "액체 방수", tradeCodes: ["06"], defaultUnit: "m2", specKeys: ["grade"], keywords: ["액체방수", "방수"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-WP-MEMBRANE", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "방수", minorNameKo: "도막방수", displayNameKo: "도막 방수", tradeCodes: ["06"], defaultUnit: "m2", specKeys: ["type"], keywords: ["도막방수", "우레탄방수"], requiresProductMatch: false, highValue: false },
  { categoryCode: "ARC-WPPR-UNDER", discipline: "ARC", majorNameKo: "건축자재", middleNameKo: "도배보조", minorNameKo: "초배지", displayNameKo: "초배지/부직포", tradeCodes: ["09"], defaultUnit: "m2", specKeys: [], keywords: ["초배지", "부직포"], requiresProductMatch: false, highValue: false },

  // ─── MEC 기계설비 — 위생기구 ─────────────────────────────────
  { categoryCode: "MEC-SAN-TOILET", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "위생기구", minorNameKo: "양변기", displayNameKo: "양변기", tradeCodes: ["05", "13"], defaultUnit: "ea", specKeys: ["type", "trap"], keywords: ["양변기", "변기", "toilet"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-SAN-BASIN", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "위생기구", minorNameKo: "세면대", displayNameKo: "세면대", tradeCodes: ["05", "13"], defaultUnit: "ea", specKeys: ["type", "leg_type"], keywords: ["세면대", "세면기", "basin"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-SAN-BATHTUB", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "위생기구", minorNameKo: "욕조", displayNameKo: "욕조", tradeCodes: ["13"], defaultUnit: "ea", specKeys: ["length_mm", "type"], keywords: ["욕조", "bathtub"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-SAN-SHOWERBOOTH", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "위생기구", minorNameKo: "샤워부스", displayNameKo: "샤워부스", tradeCodes: ["13"], defaultUnit: "set", specKeys: ["layout", "glass_thickness"], keywords: ["샤워부스", "shower booth"], requiresProductMatch: true, highValue: true },

  // ─── MEC 기계설비 — 수전/배수 ────────────────────────────────
  { categoryCode: "MEC-FAU-BASIN", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "수전", minorNameKo: "세면수전", displayNameKo: "세면수전", tradeCodes: ["05", "13"], defaultUnit: "ea", specKeys: ["hole_count", "mount_type"], keywords: ["세면수전", "수전", "basin faucet"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-FAU-SHOWER", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "수전", minorNameKo: "샤워수전", displayNameKo: "샤워수전", tradeCodes: ["05", "13"], defaultUnit: "ea", specKeys: ["mount_type", "sunflower"], keywords: ["샤워수전", "shower faucet"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-FAU-KITCHEN", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "수전", minorNameKo: "주방수전", displayNameKo: "주방수전", tradeCodes: ["05", "14"], defaultUnit: "ea", specKeys: ["mount_type", "sprayer"], keywords: ["주방수전", "kitchen faucet"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-DRN-FLOOR", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "배수", minorNameKo: "바닥육가", displayNameKo: "바닥 육가/트랩", tradeCodes: ["05", "13"], defaultUnit: "ea", specKeys: ["diameter_A", "odor_block"], keywords: ["육가", "바닥트랩", "floor drain"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-DRN-SINK", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "배수", minorNameKo: "싱크트랩", displayNameKo: "싱크 배수트랩", tradeCodes: ["05", "14"], defaultUnit: "ea", specKeys: ["bowls"], keywords: ["싱크트랩", "sink trap"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-VAL-ANGLE", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "밸브", minorNameKo: "앵글밸브", displayNameKo: "앵글밸브", tradeCodes: ["05"], defaultUnit: "ea", specKeys: ["diameter_A"], keywords: ["앵글밸브", "angle valve"], requiresProductMatch: true, highValue: false },

  // ─── MEC 기계설비 — 배관 ─────────────────────────────────────
  { categoryCode: "MEC-PIPE-PB", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "급수관", minorNameKo: "PB관", displayNameKo: "PB 급수관", tradeCodes: ["05"], defaultUnit: "m", specKeys: ["diameter_A"], keywords: ["PB관", "PB pipe"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-PIPE-PEX", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "급수관", minorNameKo: "PEX관", displayNameKo: "PEX/XL 급수관", tradeCodes: ["05"], defaultUnit: "m", specKeys: ["diameter_A"], keywords: ["PEX", "XL관", "엑셀관"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-PIPE-PVC-VG1", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "배수관", minorNameKo: "PVC-VG1", displayNameKo: "PVC VG1 배수관", tradeCodes: ["05"], defaultUnit: "m", specKeys: ["diameter_A"], keywords: ["PVC관", "VG1", "PVC VG1"], requiresProductMatch: true, highValue: false },

  // ─── MEC 기계설비 — 환기/난방 ────────────────────────────────
  { categoryCode: "MEC-VNT-FAN", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "환기", minorNameKo: "환풍기", displayNameKo: "환풍기", tradeCodes: ["20", "13"], defaultUnit: "ea", specKeys: ["airflow_cmh", "diameter"], keywords: ["환풍기", "exhaust fan"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-VNT-HOOD", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "환기", minorNameKo: "후드", displayNameKo: "주방 후드", tradeCodes: ["20", "14"], defaultUnit: "ea", specKeys: ["type", "airflow_cmh"], keywords: ["주방후드", "후드", "range hood"], requiresProductMatch: true, highValue: false },
  { categoryCode: "MEC-HVAC-AC", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "냉난방", minorNameKo: "에어컨", displayNameKo: "에어컨", tradeCodes: ["22"], defaultUnit: "ea", specKeys: ["type", "kw"], keywords: ["에어컨", "AC", "냉난방"], requiresProductMatch: true, highValue: true },
  { categoryCode: "MEC-HEAT-BOILER", discipline: "MEC", majorNameKo: "기계설비", middleNameKo: "난방", minorNameKo: "보일러", displayNameKo: "보일러", tradeCodes: ["05", "22"], defaultUnit: "ea", specKeys: ["kw", "condensing"], keywords: ["보일러", "boiler"], requiresProductMatch: true, highValue: true },

  // ─── ELE 전기 — 조명 ────────────────────────────────────────
  { categoryCode: "ELE-LGT-DOWNLIGHT", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "다운라이트", displayNameKo: "다운라이트", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["mount", "watt", "kelvin", "hole_mm"], keywords: ["다운라이트", "매입등", "downlight"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-LGT-CEILING", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "방등", displayNameKo: "방등/거실등", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["watt", "size", "kelvin"], keywords: ["방등", "거실등", "전등", "조명"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-LGT-PENDANT", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "펜던트등", displayNameKo: "펜던트등", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["watt", "length"], keywords: ["펜던트", "pendant"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-LGT-RAIL", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "레일조명", displayNameKo: "레일 조명", tradeCodes: ["04"], defaultUnit: "set", specKeys: ["rail_length_m", "spot_count"], keywords: ["레일조명", "rail light"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-LGT-STRIP", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "LED스트립", displayNameKo: "LED 스트립", tradeCodes: ["04"], defaultUnit: "m", specKeys: ["watt_per_m", "kelvin", "waterproof"], keywords: ["LED스트립", "스트립조명"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-LGT-INDIRECT", discipline: "ELE", majorNameKo: "전기", middleNameKo: "조명", minorNameKo: "간접조명", displayNameKo: "간접 조명", tradeCodes: ["04"], defaultUnit: "m", specKeys: ["watt_per_m"], keywords: ["간접조명", "indirect light"], requiresProductMatch: true, highValue: false },

  // ─── ELE 전기 — 스위치/콘센트 ────────────────────────────────
  { categoryCode: "ELE-SWT-1G", discipline: "ELE", majorNameKo: "전기", middleNameKo: "스위치", minorNameKo: "1구스위치", displayNameKo: "1구 스위치", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["color", "way"], keywords: ["1구 스위치", "1구스위치"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-SWT-2G", discipline: "ELE", majorNameKo: "전기", middleNameKo: "스위치", minorNameKo: "2구스위치", displayNameKo: "2구 스위치", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["color", "way"], keywords: ["2구 스위치", "2구스위치"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-SWT-3G", discipline: "ELE", majorNameKo: "전기", middleNameKo: "스위치", minorNameKo: "3구스위치", displayNameKo: "3구 스위치", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["color", "way"], keywords: ["3구 스위치", "3구스위치"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-SWT-DIMMER", discipline: "ELE", majorNameKo: "전기", middleNameKo: "스위치", minorNameKo: "디머", displayNameKo: "디머/조광기", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["led_compatible"], keywords: ["디머", "조광기", "dimmer"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-1G", discipline: "ELE", majorNameKo: "전기", middleNameKo: "콘센트", minorNameKo: "1구콘센트", displayNameKo: "1구 콘센트", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["ground", "color"], keywords: ["1구 콘센트", "1구콘센트"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-2G", discipline: "ELE", majorNameKo: "전기", middleNameKo: "콘센트", minorNameKo: "2구콘센트", displayNameKo: "2구 콘센트", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["ground", "mount"], keywords: ["2구 콘센트", "2구콘센트", "콘센트"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-USB", discipline: "ELE", majorNameKo: "전기", middleNameKo: "콘센트", minorNameKo: "USB콘센트", displayNameKo: "USB 콘센트", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["usb_type", "watt"], keywords: ["USB콘센트", "usb outlet"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-WATERPROOF", discipline: "ELE", majorNameKo: "전기", middleNameKo: "콘센트", minorNameKo: "방우콘센트", displayNameKo: "방우 콘센트", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["ip_rating"], keywords: ["방우 콘센트", "방수콘센트"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-FLOOR", discipline: "ELE", majorNameKo: "전기", middleNameKo: "콘센트", minorNameKo: "바닥콘센트", displayNameKo: "바닥 콘센트", tradeCodes: ["04", "21"], defaultUnit: "ea", specKeys: [], keywords: ["바닥 콘센트", "플로어 콘센트"], requiresProductMatch: true, highValue: false },

  // ─── ELE 전기 — 전선관/전선 ──────────────────────────────────
  { categoryCode: "ELE-CND-CD", discipline: "ELE", majorNameKo: "전기", middleNameKo: "전선관", minorNameKo: "CD관", displayNameKo: "CD관", tradeCodes: ["04", "21"], defaultUnit: "m", specKeys: ["diameter_mm"], keywords: ["CD관", "공배관", "전선관"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-CND-PF", discipline: "ELE", majorNameKo: "전기", middleNameKo: "전선관", minorNameKo: "PF관", displayNameKo: "PF관/후렉시블", tradeCodes: ["04", "21"], defaultUnit: "m", specKeys: ["diameter_mm"], keywords: ["PF관", "후렉시블"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-CND-ELP", discipline: "ELE", majorNameKo: "전기", middleNameKo: "전선관", minorNameKo: "ELP관", displayNameKo: "ELP관", tradeCodes: ["04", "21"], defaultUnit: "m", specKeys: ["diameter_mm"], keywords: ["ELP관"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-WIR-IV", discipline: "ELE", majorNameKo: "전기", middleNameKo: "전선", minorNameKo: "IV전선", displayNameKo: "IV/HIV 전선", tradeCodes: ["04"], defaultUnit: "m", specKeys: ["conductor_sqmm", "core_count", "color"], keywords: ["IV전선", "전기선", "IV", "HIV"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-WIR-KIV", discipline: "ELE", majorNameKo: "전기", middleNameKo: "전선", minorNameKo: "KIV전선", displayNameKo: "KIV 전선", tradeCodes: ["04"], defaultUnit: "m", specKeys: ["conductor_sqmm"], keywords: ["KIV전선", "KIV"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-WIR-VCTF", discipline: "ELE", majorNameKo: "전기", middleNameKo: "케이블", minorNameKo: "VCTF", displayNameKo: "VCTF 케이블", tradeCodes: ["04"], defaultUnit: "m", specKeys: ["core_count", "conductor_sqmm"], keywords: ["VCTF"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-COM-UTP", discipline: "ELE", majorNameKo: "전기", middleNameKo: "통신케이블", minorNameKo: "UTP", displayNameKo: "UTP 케이블", tradeCodes: ["21"], defaultUnit: "m", specKeys: ["category"], keywords: ["UTP", "랜선", "LAN"], requiresProductMatch: true, highValue: false },

  // ─── ELE 전기 — 분전반/차단기 ────────────────────────────────
  { categoryCode: "ELE-PNL-DIST", discipline: "ELE", majorNameKo: "전기", middleNameKo: "분전반", minorNameKo: "분전반", displayNameKo: "분전반", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["circuits", "mount"], keywords: ["분전반"], requiresProductMatch: true, highValue: true },
  { categoryCode: "ELE-BRK-MCCB", discipline: "ELE", majorNameKo: "전기", middleNameKo: "차단기", minorNameKo: "배선용차단기", displayNameKo: "배선용 차단기", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["amp", "poles"], keywords: ["배선용차단기", "MCCB"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-BRK-ELCB", discipline: "ELE", majorNameKo: "전기", middleNameKo: "차단기", minorNameKo: "누전차단기", displayNameKo: "누전차단기", tradeCodes: ["04"], defaultUnit: "ea", specKeys: ["amp", "poles"], keywords: ["누전차단기", "ELCB"], requiresProductMatch: true, highValue: false },

  // ─── ELE 통신/보안 ──────────────────────────────────────────
  { categoryCode: "ELE-OUT-LAN", discipline: "ELE", majorNameKo: "전기", middleNameKo: "통신", minorNameKo: "LAN단자", displayNameKo: "LAN 단자", tradeCodes: ["21"], defaultUnit: "ea", specKeys: ["category"], keywords: ["LAN", "랜포트"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-OUT-TV", discipline: "ELE", majorNameKo: "전기", middleNameKo: "통신", minorNameKo: "TV단자", displayNameKo: "TV 단자", tradeCodes: ["21"], defaultUnit: "ea", specKeys: [], keywords: ["TV단자", "안테나"], requiresProductMatch: true, highValue: false },
  { categoryCode: "ELE-SEC-DOORLOCK", discipline: "ELE", majorNameKo: "전기", middleNameKo: "보안", minorNameKo: "도어락", displayNameKo: "도어락", tradeCodes: ["21"], defaultUnit: "ea", specKeys: ["type"], keywords: ["도어락", "디지털도어락"], requiresProductMatch: true, highValue: true },

  // ─── FUR 주방가구 ──────────────────────────────────────────
  { categoryCode: "FUR-KIT-LOWER-CAB", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방가구", minorNameKo: "하부장", displayNameKo: "주방 하부장", tradeCodes: ["12", "14"], defaultUnit: "m", specKeys: ["door_material", "internal"], keywords: ["하부장", "싱크대 하부장"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-UPPER-CAB", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방가구", minorNameKo: "상부장", displayNameKo: "주방 상부장", tradeCodes: ["12", "14"], defaultUnit: "m", specKeys: ["door_material", "height_mm"], keywords: ["상부장", "싱크대 상부장"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-TALL-CAB", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방가구", minorNameKo: "키큰장", displayNameKo: "키큰장/팬트리", tradeCodes: ["12", "14"], defaultUnit: "ea", specKeys: ["width_mm", "height_mm"], keywords: ["키큰장", "팬트리", "냉장고장"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-COUNTERTOP", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방상판", minorNameKo: "상판", displayNameKo: "주방 상판", tradeCodes: ["12", "14"], defaultUnit: "m", specKeys: ["material", "thickness_mm"], keywords: ["상판", "주방 상판", "엔지니어드스톤"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-SINKBOWL", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방부속", minorNameKo: "싱크볼", displayNameKo: "싱크볼", tradeCodes: ["14", "05"], defaultUnit: "ea", specKeys: ["bowls", "mount"], keywords: ["싱크볼"], requiresProductMatch: true, highValue: false },
  { categoryCode: "FUR-KIT-HOOD", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방기기", minorNameKo: "후드", displayNameKo: "주방 후드", tradeCodes: ["14", "20"], defaultUnit: "ea", specKeys: ["airflow_cmh", "type"], keywords: ["주방후드", "주방 후드"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-COOKTOP", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방기기", minorNameKo: "쿡탑", displayNameKo: "쿡탑/인덕션", tradeCodes: ["14", "04", "05"], defaultUnit: "ea", specKeys: ["type", "burner_count"], keywords: ["쿡탑", "인덕션", "가스레인지"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-KIT-BACKSPLASH", discipline: "FUR", majorNameKo: "가구", middleNameKo: "주방마감", minorNameKo: "백스플래시", displayNameKo: "백스플래시", tradeCodes: ["07", "14"], defaultUnit: "m2", specKeys: ["material"], keywords: ["백스플래시"], requiresProductMatch: true, highValue: false },

  // ─── FUR 붙박이/수납 ──────────────────────────────────────
  { categoryCode: "FUR-STO-WARDROBE", discipline: "FUR", majorNameKo: "가구", middleNameKo: "수납", minorNameKo: "붙박이장", displayNameKo: "붙박이장", tradeCodes: ["12"], defaultUnit: "m", specKeys: ["door_type", "internal"], keywords: ["붙박이장", "옷장"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-STO-SHOERACK", discipline: "FUR", majorNameKo: "가구", middleNameKo: "수납", minorNameKo: "신발장", displayNameKo: "신발장", tradeCodes: ["12"], defaultUnit: "ea", specKeys: ["width_mm", "height_mm"], keywords: ["신발장"], requiresProductMatch: true, highValue: true },
  { categoryCode: "FUR-STO-DRESSING", discipline: "FUR", majorNameKo: "가구", middleNameKo: "수납", minorNameKo: "드레스룸", displayNameKo: "드레스룸 시스템장", tradeCodes: ["12"], defaultUnit: "m", specKeys: ["module"], keywords: ["드레스룸", "시스템장"], requiresProductMatch: true, highValue: true },
];

/** alias seed — 자연어 → category_code (한국어 + 영어) */
export const CATEGORY_ALIAS_SEED: Array<{ alias: string; categoryCode: string; weight?: number }> = [
  // 바닥
  { alias: "강마루", categoryCode: "MAT-FLR-ENGINEERED", weight: 1.0 },
  { alias: "마루", categoryCode: "MAT-FLR-ENGINEERED", weight: 0.8 },
  { alias: "원목마루", categoryCode: "MAT-FLR-SOLIDWOOD" },
  { alias: "강화마루", categoryCode: "MAT-FLR-LAMINATE" },
  { alias: "장판", categoryCode: "MAT-FLR-SHEET" },
  { alias: "륨", categoryCode: "MAT-FLR-SHEET" },
  { alias: "데코타일", categoryCode: "MAT-FLR-LVT" },
  { alias: "LVT", categoryCode: "MAT-FLR-LVT" },
  { alias: "포세린타일", categoryCode: "MAT-FLR-PORCELAIN" },
  { alias: "포세린", categoryCode: "MAT-FLR-PORCELAIN", weight: 0.9 },
  // 벽/천장
  { alias: "실크벽지", categoryCode: "MAT-WAL-WALLPAPER-SILK" },
  { alias: "합지", categoryCode: "MAT-WAL-WALLPAPER-PAPER" },
  { alias: "합지벽지", categoryCode: "MAT-WAL-WALLPAPER-PAPER" },
  { alias: "도장", categoryCode: "MAT-WAL-PAINT" },
  { alias: "페인트", categoryCode: "MAT-WAL-PAINT" },
  { alias: "필름", categoryCode: "MAT-WAL-FILM" },
  { alias: "인테리어필름", categoryCode: "MAT-WAL-FILM" },
  { alias: "벽타일", categoryCode: "MAT-WAL-TILE" },
  { alias: "걸레받이", categoryCode: "MAT-MLD-BASEBOARD" },
  // 도어/창호
  { alias: "ABS도어", categoryCode: "MAT-DOOR-ABS" },
  { alias: "방문", categoryCode: "MAT-DOOR-ABS" },
  { alias: "PVC창호", categoryCode: "MAT-WDW-PVC" },
  { alias: "시스템창호", categoryCode: "MAT-WDW-PVC" },
  // 전기 — 조명
  { alias: "전등", categoryCode: "ELE-LGT-CEILING" },
  { alias: "방등", categoryCode: "ELE-LGT-CEILING" },
  { alias: "거실등", categoryCode: "ELE-LGT-CEILING" },
  { alias: "다운라이트", categoryCode: "ELE-LGT-DOWNLIGHT" },
  { alias: "매입등", categoryCode: "ELE-LGT-DOWNLIGHT" },
  { alias: "펜던트", categoryCode: "ELE-LGT-PENDANT" },
  { alias: "펜던트조명", categoryCode: "ELE-LGT-PENDANT" },
  { alias: "레일조명", categoryCode: "ELE-LGT-RAIL" },
  { alias: "LED스트립", categoryCode: "ELE-LGT-STRIP" },
  { alias: "간접조명", categoryCode: "ELE-LGT-INDIRECT" },
  // 전기 — 스위치/콘센트
  { alias: "스위치", categoryCode: "ELE-SWT-1G", weight: 0.5 },
  { alias: "1구 스위치", categoryCode: "ELE-SWT-1G" },
  { alias: "2구 스위치", categoryCode: "ELE-SWT-2G" },
  { alias: "3구 스위치", categoryCode: "ELE-SWT-3G" },
  { alias: "디머", categoryCode: "ELE-SWT-DIMMER" },
  { alias: "조광기", categoryCode: "ELE-SWT-DIMMER" },
  { alias: "콘센트", categoryCode: "ELE-OUT-2G", weight: 0.7 },
  { alias: "1구 콘센트", categoryCode: "ELE-OUT-1G" },
  { alias: "2구 콘센트", categoryCode: "ELE-OUT-2G" },
  { alias: "USB 콘센트", categoryCode: "ELE-OUT-USB" },
  { alias: "방우 콘센트", categoryCode: "ELE-OUT-WATERPROOF" },
  { alias: "바닥 콘센트", categoryCode: "ELE-OUT-FLOOR" },
  // 전기 — 전선관/전선
  { alias: "CD관", categoryCode: "ELE-CND-CD" },
  { alias: "전선관", categoryCode: "ELE-CND-CD", weight: 0.7 },
  { alias: "공배관", categoryCode: "ELE-CND-CD", weight: 0.6 },
  { alias: "PF관", categoryCode: "ELE-CND-PF" },
  { alias: "후렉시블", categoryCode: "ELE-CND-PF" },
  { alias: "ELP관", categoryCode: "ELE-CND-ELP" },
  { alias: "전기선", categoryCode: "ELE-WIR-IV", weight: 0.5 },
  { alias: "IV전선", categoryCode: "ELE-WIR-IV" },
  { alias: "HIV", categoryCode: "ELE-WIR-IV" },
  { alias: "KIV", categoryCode: "ELE-WIR-KIV" },
  { alias: "VCTF", categoryCode: "ELE-WIR-VCTF" },
  { alias: "랜선", categoryCode: "ELE-COM-UTP" },
  { alias: "UTP", categoryCode: "ELE-COM-UTP" },
  { alias: "LAN", categoryCode: "ELE-COM-UTP" },
  // 전기 — 분전반/차단기
  { alias: "분전반", categoryCode: "ELE-PNL-DIST" },
  { alias: "차단기", categoryCode: "ELE-BRK-MCCB", weight: 0.6 },
  { alias: "누전차단기", categoryCode: "ELE-BRK-ELCB" },
  { alias: "ELCB", categoryCode: "ELE-BRK-ELCB" },
  { alias: "도어락", categoryCode: "ELE-SEC-DOORLOCK" },
  // 기계설비
  { alias: "수전", categoryCode: "MEC-FAU-BASIN", weight: 0.6 },
  { alias: "세면수전", categoryCode: "MEC-FAU-BASIN" },
  { alias: "샤워수전", categoryCode: "MEC-FAU-SHOWER" },
  { alias: "주방수전", categoryCode: "MEC-FAU-KITCHEN" },
  { alias: "세면대", categoryCode: "MEC-SAN-BASIN" },
  { alias: "변기", categoryCode: "MEC-SAN-TOILET" },
  { alias: "양변기", categoryCode: "MEC-SAN-TOILET" },
  { alias: "욕조", categoryCode: "MEC-SAN-BATHTUB" },
  { alias: "샤워부스", categoryCode: "MEC-SAN-SHOWERBOOTH" },
  { alias: "환풍기", categoryCode: "MEC-VNT-FAN" },
  { alias: "후드", categoryCode: "MEC-VNT-HOOD", weight: 0.7 },
  { alias: "주방후드", categoryCode: "FUR-KIT-HOOD", weight: 1.0 }, // 주방 후드는 FUR로 매핑
  { alias: "에어컨", categoryCode: "MEC-HVAC-AC" },
  { alias: "보일러", categoryCode: "MEC-HEAT-BOILER" },
  { alias: "앵글밸브", categoryCode: "MEC-VAL-ANGLE" },
  { alias: "육가", categoryCode: "MEC-DRN-FLOOR" },
  { alias: "바닥트랩", categoryCode: "MEC-DRN-FLOOR" },
  { alias: "PB관", categoryCode: "MEC-PIPE-PB" },
  { alias: "PEX", categoryCode: "MEC-PIPE-PEX" },
  { alias: "XL관", categoryCode: "MEC-PIPE-PEX" },
  // 주방가구
  { alias: "싱크대", categoryCode: "FUR-KIT-LOWER-CAB", weight: 0.7 },
  { alias: "하부장", categoryCode: "FUR-KIT-LOWER-CAB" },
  { alias: "상부장", categoryCode: "FUR-KIT-UPPER-CAB" },
  { alias: "키큰장", categoryCode: "FUR-KIT-TALL-CAB" },
  { alias: "팬트리", categoryCode: "FUR-KIT-TALL-CAB" },
  { alias: "냉장고장", categoryCode: "FUR-KIT-TALL-CAB" },
  { alias: "상판", categoryCode: "FUR-KIT-COUNTERTOP", weight: 0.8 },
  { alias: "엔지니어드스톤", categoryCode: "FUR-KIT-COUNTERTOP" },
  { alias: "싱크볼", categoryCode: "FUR-KIT-SINKBOWL" },
  { alias: "쿡탑", categoryCode: "FUR-KIT-COOKTOP" },
  { alias: "인덕션", categoryCode: "FUR-KIT-COOKTOP" },
  { alias: "백스플래시", categoryCode: "FUR-KIT-BACKSPLASH" },
  { alias: "붙박이장", categoryCode: "FUR-STO-WARDROBE" },
  { alias: "옷장", categoryCode: "FUR-STO-WARDROBE", weight: 0.7 },
  { alias: "신발장", categoryCode: "FUR-STO-SHOERACK" },
  { alias: "드레스룸", categoryCode: "FUR-STO-DRESSING" },
];

export function getCategoryByCode(code: string): MaterialCategorySeed | undefined {
  return MATERIAL_CATEGORY_SEED.find((c) => c.categoryCode === code);
}
