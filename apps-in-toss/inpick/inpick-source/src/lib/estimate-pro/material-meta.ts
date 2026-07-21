// src/lib/estimate-pro/material-meta.ts
//
// 내역 라인 → 공사부위(실별 바닥/벽/천장 등) + 브랜드/제품(SKU) 표준 추천 맵.
// 실제 한국 인테리어 브랜드 기준 "표준 추천" 기본값. 실제 파이프라인에선
// 사용자 선택 / AI 추천 / material_products DB로 바인딩되어 교체됨(여기선 기본 추천).
//
// 부위는 "각 실별 바닥/벽/천장" 수준으로 압축(요구사항).

export type PartCode =
  | '바닥' | '벽' | '천장' | '걸레받이/몰딩'
  | '욕실' | '주방' | '창호/문' | '설비' | '전기' | '단열' | '공통';

export interface MaterialMeta {
  part: PartCode;
  brand: string;     // 추천 브랜드
  product: string;   // 추천 제품/제품군 (SKU 성격)
  grade: 'economy' | 'standard' | 'premium';
  priceBand?: string; // 금액대 가이드 (hover 표시용)
  imageHint?: string; // 이미지/스타일 키워드 (디자인 이미지 구현 연결용)
}

interface Rule {
  kw: string[];          // itemName 매칭 키워드 (하나라도 포함)
  part: PartCode;
  brand: string;
  product: string;
  grade?: 'economy' | 'standard' | 'premium';
  priceBand?: string;
  imageHint?: string;
}

// 구체적인 규칙을 먼저(위) 배치 — 먼저 매칭되는 규칙 채택
const RULES: Rule[] = [
  // ── 바닥 ──
  { kw: ['강마루'], part: '바닥', brand: '동화자연마루', product: '나투스진 강마루 7.5T (오크)', priceBand: '재료 38~48천/㎡', imageHint: '내추럴 오크 톤' },
  { kw: ['강화마루'], part: '바닥', brand: 'LX하우시스', product: '지아 강화마루 8mm', priceBand: '재료 28~38천/㎡' },
  { kw: ['원목마루'], part: '바닥', brand: '구정마루', product: '프라하 원목마루 15T', priceBand: '재료 75~95천/㎡', imageHint: '월넛 고급' },
  { kw: ['바닥 하지', '방음매트', '바닥 밑작업'], part: '바닥', brand: '범퍼매트', product: '방음매트 30T + 내수합판', priceBand: '재료 8~12천/㎡' },
  { kw: ['바닥 타일'], part: '바닥', brand: '이펀세라', product: '포세린 600×600 무광', priceBand: '재료 35~55천/㎡', imageHint: '그레이 포세린' },
  { kw: ['바닥 미장'], part: '바닥', brand: '아주산업', product: '레미탈 드라이몰탈', priceBand: '재료 6~8천/㎡' },
  { kw: ['바닥 방수', '바닥 단차', '턱 방수'], part: '바닥', brand: '아주방수', product: '액체방수 2회', priceBand: '재료 15~20천/㎡' },
  { kw: ['걸레받이'], part: '걸레받이/몰딩', brand: '재현하늘창', product: 'PVC 걸레받이 H80', priceBand: '재료 3~5천/m' },

  // ── 벽 ──
  { kw: ['벽지', '도배'], part: '벽', brand: 'LX하우시스', product: '베스띠 실크벽지', grade: 'standard', priceBand: '재료 6~9천/㎡', imageHint: '웜화이트 무지' },
  { kw: ['초배'], part: '벽', brand: '개나리벽지', product: '운용지 초배', priceBand: '재료 2~3천/㎡' },
  { kw: ['벽 타일', '주방 벽타일'], part: '벽', brand: '윌로우세라믹', product: '포세린 300×600', priceBand: '재료 30~45천/㎡', imageHint: '화이트 무광 벽타일' },
  { kw: ['벽체 미장'], part: '벽', brand: '아주산업', product: '레미탈 미장', priceBand: '재료 6~8천/㎡' },
  { kw: ['벽체 방수'], part: '벽', brand: '아주방수', product: '벽체 액체방수', priceBand: '재료 13~18천/㎡' },
  { kw: ['탄성코트'], part: '벽', brand: '삼화페인트', product: '수퍼탄성코트 2회', priceBand: '재료 5~8천/㎡', imageHint: '발코니 화이트' },
  { kw: ['아트월'], part: '벽', brand: '제작', product: '아트월 (무늬목/타일 하지)', priceBand: '협의', imageHint: 'TV벽 포인트' },

  // ── 천장 ──
  { kw: ['천장 석고', '석고보드'], part: '천장', brand: 'KCC', product: '방화석고보드 9.5T', priceBand: '재료 8~12천/㎡' },
  { kw: ['천장 경량틀', '경량틀', 'M-bar'], part: '천장', brand: '동아스틸', product: 'M-bar + 캐링채널', priceBand: '재료 7~10천/㎡' },
  { kw: ['천장 도장'], part: '천장', brand: '삼화페인트', product: '아이생각 수성 2회', priceBand: '재료 3~5천/㎡' },
  { kw: ['우물천장', '커튼박스'], part: '천장', brand: '제작', product: '석고 2단 우물천장/커튼박스', priceBand: '협의', imageHint: '간접조명' },
  { kw: ['몰딩'], part: '걸레받이/몰딩', brand: '재현하늘창', product: 'PS 크라운몰딩', priceBand: '재료 4~6천/m' },

  // ── 창호/문/필름 ──
  { kw: ['샷시', '하이샷시'], part: '창호/문', brand: 'LX하우시스', product: '수퍼세이브 이중창(로이)', priceBand: '식 800~1,400만', imageHint: '블랙 슬림프레임' },
  { kw: ['중문'], part: '창호/문', brand: '위드지스', product: '3연동 슬림 중문', priceBand: '세트 120~180만', imageHint: '블랙 슬림 유리중문' },
  { kw: ['외여닫이문', '문틀', '도어', '여닫이'], part: '창호/문', brand: '예림도어', product: 'ABS 도어세트', priceBand: '세트 28~38만', imageHint: '화이트 도어' },
  { kw: ['필름', '래핑'], part: '창호/문', brand: 'LX하우시스', product: '인테리어필름 베니프', priceBand: '재료 8~12천/㎡', imageHint: '문/문틀 화이트래핑' },
  { kw: ['단열'], part: '단열', brand: 'KCC', product: '아이소핑크 30T + 열반사', priceBand: '재료 16~22천/㎡' },

  // ── 욕실 ──
  { kw: ['양변기'], part: '욕실', brand: '대림바스', product: '스마트렛 직수 양변기', priceBand: '제품 25~45만', imageHint: '화이트 투피스' },
  { kw: ['세면대'], part: '욕실', brand: '대림바스', product: '반다리움 세면대 + 수전', priceBand: '제품 18~35만' },
  { kw: ['욕조'], part: '욕실', brand: '이누스', product: '아크릴 욕조 1500', priceBand: '제품 40~70만' },
  { kw: ['환풍기'], part: '욕실', brand: '힘펠', product: '환풍기 휴앤봇', priceBand: '제품 6~9만' },
  { kw: ['샤워부스', '파티션'], part: '욕실', brand: '이누스', product: '강화유리 파티션', priceBand: '제품 30~45만', imageHint: '프레임리스 유리' },
  { kw: ['악세서리', '악세사리'], part: '욕실', brand: '대림바스', product: '욕실 액세서리 세트', priceBand: '세트 15~25만' },

  // ── 주방/가구 ──
  { kw: ['상판'], part: '주방', brand: 'LX하우시스', product: '비아테라 엔지니어드스톤', priceBand: '재료 28~45천/m', imageHint: '화이트 스톤상판' },
  { kw: ['싱크대', '상부장', '하부장', '주방'], part: '주방', brand: '한샘', product: '키친바흐 도어', priceBand: 'm당 60~95만', imageHint: '무광 화이트 주방' },
  { kw: ['신발장'], part: '주방', brand: '한샘', product: '시그니처 신발장', priceBand: 'm당 38~55만' },
  { kw: ['붙박이장', '붙박이'], part: '주방', brand: '한샘', product: '시스템 붙박이장', priceBand: 'm당 50~75만' },
  { kw: ['가스레인지'], part: '주방', brand: 'SK매직', product: '가스레인지', priceBand: '제품 25~40만' },
  { kw: ['레인지후드', '후드'], part: '주방', brand: '하츠', product: '슬림 레인지후드', priceBand: '제품 25~40만' },

  // ── 설비 ──
  { kw: ['급수'], part: '설비', brand: '한일', product: 'PB 급수관 + 밸브', priceBand: '포인트 4~6만' },
  { kw: ['배수'], part: '설비', brand: 'PPI', product: 'PVC 배수관 + 트랩', priceBand: '포인트 3.5~5만' },
  { kw: ['가스 배관', '가스배관'], part: '설비', brand: '도시가스 승인', product: '가스배관 연결', priceBand: '포인트 15~25만' },
  { kw: ['보일러'], part: '설비', brand: '경동나비엔', product: 'NCB 콘덴싱 보일러', priceBand: '제품 70~110만' },
  { kw: ['난방 배관', '난방배관', 'XL'], part: '설비', brand: '에이콘', product: 'XL 엑셀 난방배관', priceBand: '식 150~250만' },

  // ── 전기 ──
  { kw: ['도어락'], part: '전기', brand: '삼성SDS', product: 'SHP 디지털 도어락', priceBand: '제품 18~30만', imageHint: '푸시풀 블랙' },
  { kw: ['등기구', 'LED', '조명'], part: '전기', brand: '비츠온', product: 'LED 평판/방등 세트', priceBand: '식 100~200만', imageHint: '주백색 평판등' },
  { kw: ['콘센트', '스위치'], part: '전기', brand: '르그랑', product: '매립 콘센트/스위치', priceBand: '개 1.2~2만' },
  { kw: ['분전반'], part: '전기', brand: '상도전기', product: '세대 분전반(ELB)', priceBand: '제품 20~35만' },
  { kw: ['인터폰', '통신'], part: '전기', brand: '코맥스', product: '비디오폰', priceBand: '제품 12~20만' },

  // ── 잡철/기타 ──
  { kw: ['실리콘', '코킹'], part: '공통', brand: '다우코닝', product: '바이오 실리콘 코킹', priceBand: 'm 1.5~3천' },
  { kw: ['에어컨'], part: '전기', brand: '삼성/LG', product: '벽걸이/스탠드(제품 별도)', priceBand: '설치 20~30만' },
  { kw: ['타일 접착제', '접착제'], part: '공통', brand: 'ABC상사', product: '압착시멘트 드라이픽스', priceBand: '재료 1~1.5천/kg' },
  { kw: ['줄눈'], part: '공통', brand: '탑시멘트', product: '에폭시 줄눈', priceBand: '재료 3.5~5천/kg' },
];

const NO_MATERIAL_KW = ['철거', '폐기물', '양생', '보양', '양중', '운반', '청소', '하지 목공', '가벽'];

// 부위(실별 바닥/벽/천장 등) 판정 — 자재 매칭과 독립
const PART_KW: Array<{ kw: string[]; part: PartCode }> = [
  { kw: ['걸레받이', '몰딩'], part: '걸레받이/몰딩' },
  { kw: ['천장', '석고', '경량틀', 'M-bar', '도장', '우물', '커튼박스'], part: '천장' },
  { kw: ['양변기', '세면', '욕조', '환풍기', '샤워', '파티션', '악세서리', '악세사리', '위생'], part: '욕실' },
  { kw: ['싱크', '상부장', '하부장', '상판', '후드', '레인지', '주방', '신발장', '붙박이'], part: '주방' },
  { kw: ['급수', '배수', '가스', '보일러', '난방', '배관', '설비'], part: '설비' },
  { kw: ['조명', '콘센트', '스위치', '분전', '인터폰', '도어락', '등기구', '통신', '에어컨'], part: '전기' },
  { kw: ['단열'], part: '단열' },
  { kw: ['문', '도어', '샷시', '창', '중문', '필름', '여닫이'], part: '창호/문' },
  { kw: ['바닥', '강마루', '마루', '장판', '방음매트'], part: '바닥' },
  { kw: ['벽지', '도배', '초배', '벽 타일', '벽타일', '벽체', '탄성', '아트월', '벽'], part: '벽' },
];

export function resolvePart(itemName: string): PartCode {
  for (const p of PART_KW) {
    if (p.kw.some((k) => itemName.includes(k))) return p.part;
  }
  return '공통';
}

export function resolveMaterialMeta(itemName: string): MaterialMeta {
  for (const r of RULES) {
    if (r.kw.some((k) => itemName.includes(k))) {
      return {
        part: r.part, brand: r.brand, product: r.product,
        grade: r.grade || 'standard', priceBand: r.priceBand, imageHint: r.imageHint,
      };
    }
  }
  // 해체·시공 부자재 등 자재 브랜드 없음 — 부위만 판정
  if (NO_MATERIAL_KW.some((k) => itemName.includes(k))) {
    return { part: resolvePart(itemName), brand: '-', product: '시공/해체', grade: 'standard' };
  }
  return { part: resolvePart(itemName), brand: '-', product: itemName, grade: 'standard' };
}

// 노무 단가 시장가 보정 (itemCode → 보정 노무단가). 기존 단가가 시장 중위값보다 높던 항목.
// 편집 가능 기본값 — 실제론 품셈/시중노임 기준. 보정 사유는 UI 노출.
export const LABOR_CALIBRATION: Record<string, { labor: number; was: number; note: string }> = {
  '07.MAIN':   { labor: 14000, was: 23000, note: '강마루 시공 노무 시장 중위(평당 ~46천)' },
  '05.FLOOR':  { labor: 32000, was: 45000, note: '욕실 바닥타일 시공 노무 보정' },
  '05.WALL':   { labor: 32000, was: 45000, note: '욕실 벽타일 시공 노무 보정' },
  '09.GYPSUM': { labor: 14000, was: 20000, note: '천장 석고 시공 노무 보정' },
  '09.FRAME':  { labor: 9000,  was: 12000, note: '천장 경량틀 노무 보정' },
  '09.PAINT':  { labor: 6000,  was: 8000,  note: '천장 도장 노무 보정' },
  '08.WALLPAPER': { labor: 8000, was: 11000, note: '도배 노무 시장 중위' },
  '08.PRIMER_PAPER': { labor: 3000, was: 4000, note: '초배 노무 보정' },
};
