/**
 * 전체 건축 자재·기구 분류 체계 (Construction Material & Fixture Catalog)
 *
 * 인테리어/건축에 들어가는 모든 자재·기구류를 그룹/카테고리로 망라한다.
 * 각 카테고리는:
 *  - query  : 실제 구매 가능한 상품 검색어 (/api/product-search → 쇼핑몰 실링크)
 *  - surface: 부분 적산(src/lib/partial/partial-estimate) 단위기준 매핑
 *             면적기준(floor/wall/ceiling) vs 수량기준(etc)
 *
 * partial-install / material-preview / 견적 등에서 공용으로 사용.
 */
import type { PartialSurface } from "@/lib/partial/partial-estimate";

export interface MaterialCategory {
  code: string;
  name: string;
  query: string; // 쇼핑 검색어 (실구매)
  surface: PartialSurface;
  hot?: boolean; // 인기/대표 카테고리
}

export interface MaterialGroup {
  key: string;
  title: string;
  items: MaterialCategory[];
}

export const MATERIAL_GROUPS: MaterialGroup[] = [
  {
    key: "bath",
    title: "욕실·화장실",
    items: [
      { code: "toilet", name: "양변기", query: "양변기", surface: "etc", hot: true },
      { code: "bidet", name: "비데", query: "비데", surface: "etc" },
      { code: "basin", name: "세면대", query: "욕실 세면대", surface: "etc", hot: true },
      { code: "basin_faucet", name: "세면수전", query: "세면 수전", surface: "etc" },
      { code: "shower_faucet", name: "샤워수전", query: "욕실 샤워수전", surface: "etc", hot: true },
      { code: "shower_head", name: "샤워헤드", query: "절수 샤워헤드", surface: "etc" },
      { code: "bath_cabinet", name: "욕실장", query: "욕실장", surface: "etc" },
      { code: "mirror_cabinet", name: "거울장", query: "욕실 거울장", surface: "etc" },
      { code: "bath_fan", name: "환풍기", query: "욕실 환풍기", surface: "etc" },
      { code: "bath_acc", name: "욕실 악세서리", query: "욕실 수건걸이 세트", surface: "etc" },
      { code: "drain_trap", name: "배수트랩", query: "욕실 배수트랩", surface: "etc" },
      { code: "bath_floor_tile", name: "욕실 바닥타일", query: "욕실 바닥 타일", surface: "floor" },
      { code: "bath_wall_tile", name: "욕실 벽타일", query: "욕실 벽 타일", surface: "wall" },
      { code: "grout_silicone", name: "줄눈·실리콘", query: "욕실 줄눈 시공", surface: "etc" },
      { code: "bath_door", name: "욕실 도어", query: "욕실 중문", surface: "etc" },
    ],
  },
  {
    key: "kitchen",
    title: "주방",
    items: [
      { code: "kitchen_faucet", name: "주방수전", query: "거위목 주방수전", surface: "etc", hot: true },
      { code: "sink_bowl", name: "싱크볼", query: "사각 싱크볼", surface: "etc", hot: true },
      { code: "hood", name: "후드", query: "주방 후드", surface: "etc" },
      { code: "cooktop", name: "쿡탑", query: "인덕션 쿡탑", surface: "etc" },
      { code: "countertop", name: "주방 상판", query: "주방 상판 엔지니어드스톤", surface: "etc" },
      { code: "lower_cabinet", name: "하부장", query: "싱크대 하부장", surface: "etc" },
      { code: "upper_cabinet", name: "상부장", query: "주방 상부장", surface: "etc" },
      { code: "tall_cabinet", name: "키큰장·팬트리", query: "주방 키큰장", surface: "etc" },
      { code: "backsplash", name: "백스플래시 타일", query: "주방 백스플래시 타일", surface: "wall" },
      { code: "kitchen_floor_tile", name: "주방 바닥타일", query: "주방 바닥 타일", surface: "floor" },
      { code: "kitchen_film", name: "주방 시트지·필름", query: "주방 인테리어필름", surface: "wall" },
    ],
  },
  {
    key: "door",
    title: "문·철물",
    items: [
      { code: "door_room", name: "방문", query: "ABS 방문", surface: "etc" },
      { code: "door_mid", name: "중문", query: "중문", surface: "etc", hot: true },
      { code: "door_handle", name: "방문 손잡이", query: "무광 블랙 문고리", surface: "etc", hot: true },
      { code: "door_lock", name: "현관 도어록", query: "현관 디지털도어록", surface: "etc", hot: true },
      { code: "hinge", name: "경첩", query: "방문 경첩", surface: "etc" },
      { code: "door_closer", name: "도어클로저", query: "도어클로저", surface: "etc" },
      { code: "door_frame", name: "문틀·몰딩", query: "문틀 몰딩", surface: "etc" },
      { code: "slide_rail", name: "미닫이 레일", query: "미닫이문 레일", surface: "etc" },
      { code: "door_stopper", name: "자석 스토퍼", query: "현관 자석 스토퍼", surface: "etc" },
    ],
  },
  {
    key: "furniture",
    title: "가구·수납",
    items: [
      { code: "wardrobe", name: "붙박이장", query: "붙박이장", surface: "etc", hot: true },
      { code: "shoe_cabinet", name: "신발장", query: "현관 신발장", surface: "etc", hot: true },
      { code: "system_cabinet", name: "시스템장", query: "시스템 수납장", surface: "etc" },
      { code: "pantry", name: "팬트리장", query: "팬트리 수납장", surface: "etc" },
      { code: "dressroom", name: "드레스룸", query: "드레스룸 시스템행거", surface: "etc" },
      { code: "shelf", name: "수납 선반", query: "벽선반", surface: "etc" },
      { code: "bench_cabinet", name: "현관 벤치장", query: "현관 벤치 수납장", surface: "etc" },
    ],
  },
  {
    key: "floor",
    title: "바닥재",
    items: [
      { code: "laminate", name: "강마루", query: "강마루", surface: "floor", hot: true },
      { code: "reinforced", name: "강화마루", query: "강화마루", surface: "floor" },
      { code: "hardwood", name: "원목마루", query: "원목마루", surface: "floor" },
      { code: "spc_lvt", name: "SPC·LVT", query: "SPC 클릭 바닥재", surface: "floor", hot: true },
      { code: "sheet_floor", name: "장판", query: "모노륨 장판", surface: "floor" },
      { code: "deco_tile", name: "데코타일", query: "데코타일", surface: "floor" },
      { code: "porcelain", name: "포세린 타일", query: "포세린 타일 바닥", surface: "floor" },
      { code: "polishing", name: "폴리싱 타일", query: "폴리싱 타일", surface: "floor" },
      { code: "baseboard", name: "걸레받이", query: "걸레받이", surface: "etc" },
    ],
  },
  {
    key: "wall",
    title: "벽·천장 마감",
    items: [
      { code: "silk_wallpaper", name: "실크벽지", query: "실크벽지", surface: "wall", hot: true },
      { code: "combine_wallpaper", name: "합지벽지", query: "합지벽지", surface: "wall" },
      { code: "ceiling_paper", name: "천장지", query: "천장지", surface: "ceiling" },
      { code: "interior_film", name: "인테리어 필름", query: "인테리어 필름", surface: "wall", hot: true },
      { code: "accent_wall", name: "아트월", query: "아트월 패널", surface: "wall" },
      { code: "louver", name: "루버·템바보드", query: "템바보드", surface: "wall" },
      { code: "molding", name: "몰딩", query: "천장 몰딩", surface: "etc" },
      { code: "paint", name: "도장·페인트", query: "친환경 수성페인트", surface: "wall" },
      { code: "art_tile", name: "아트타일", query: "포인트 아트타일", surface: "wall" },
    ],
  },
  {
    key: "electric",
    title: "전기·조명",
    items: [
      { code: "switch", name: "스위치", query: "매입 스위치", surface: "etc" },
      { code: "outlet", name: "콘센트", query: "매입 콘센트", surface: "etc" },
      { code: "downlight", name: "다운라이트", query: "LED 다운라이트 매입등", surface: "etc", hot: true },
      { code: "indirect", name: "간접조명", query: "LED 간접조명 라인", surface: "etc" },
      { code: "rail_light", name: "레일조명", query: "레일조명", surface: "etc" },
      { code: "sensor_light", name: "센서등", query: "현관 센서등", surface: "etc" },
      { code: "bath_light", name: "욕실등", query: "욕실 방습등", surface: "etc" },
      { code: "pendant", name: "펜던트·식탁등", query: "식탁 펜던트 조명", surface: "etc" },
      { code: "ceiling_light", name: "거실·방등", query: "LED 방등 거실등", surface: "etc", hot: true },
    ],
  },
  {
    key: "window",
    title: "창호·차양",
    items: [
      { code: "window_frame", name: "창호(샷시)", query: "이중창 샷시", surface: "etc" },
      { code: "blind", name: "블라인드", query: "맞춤 블라인드", surface: "etc", hot: true },
      { code: "curtain", name: "커튼", query: "암막 커튼", surface: "etc" },
      { code: "screen", name: "방충망", query: "교체용 방충망", surface: "etc" },
      { code: "draft_seal", name: "문풍지", query: "창문 문풍지", surface: "etc" },
      { code: "window_film", name: "창호 필름", query: "단열 창문필름", surface: "etc" },
    ],
  },
  {
    key: "plumbing",
    title: "설비·난방",
    items: [
      { code: "boiler", name: "보일러", query: "가정용 보일러", surface: "etc" },
      { code: "manifold", name: "온수분배기", query: "온수분배기", surface: "etc" },
      { code: "pipe", name: "배관 자재", query: "PB 배관 자재", surface: "etc" },
      { code: "ventilation", name: "전열교환기·환기", query: "전열교환기", surface: "etc" },
      { code: "water_heater", name: "온수기", query: "전기 온수기", surface: "etc" },
    ],
  },
  {
    key: "repair",
    title: "보수·유지관리",
    items: [
      { code: "silicone_redo", name: "곰팡이·실리콘 재시공", query: "욕실 실리콘 재시공", surface: "etc" },
      { code: "drain_clog", name: "배수 막힘", query: "배수구 뚫음 청소", surface: "etc" },
      { code: "tile_lift", name: "타일 들뜸 보수", query: "타일 보수", surface: "wall" },
      { code: "floor_repair", name: "마루 들뜸 보수", query: "마루 보수", surface: "floor" },
      { code: "wallpaper_patch", name: "벽지 부분 보수", query: "벽지 부분 시공", surface: "wall" },
      { code: "leak_check", name: "누수 진단", query: "누수 탐지", surface: "etc" },
    ],
  },
];

export const ALL_CATEGORIES: MaterialCategory[] = MATERIAL_GROUPS.flatMap((g) => g.items);

export const HOT_CATEGORIES: MaterialCategory[] = ALL_CATEGORIES.filter((c) => c.hot);

export function findCategory(code: string): MaterialCategory | undefined {
  return ALL_CATEGORIES.find((c) => c.code === code);
}

export function categoryCount(): number {
  return ALL_CATEGORIES.length;
}
