// src/lib/estimate-pro/detail-model.ts
//
// 종합건설사 표준 「수량내역서」 모델 (단가·금액 분리) + 아파트 누락항목 보강.
// 카테고리(주택/상가)별로 내역이 갈리며, 본 파일은 주택(아파트) 내역을 담당.
// 현재 17공종 엔진 결과(EstimateLine[]) → DetailLine[]로 변환 + 실제 올수리 견적에서
// 빠져있던 공종(샷시/중문/단열/필름/주방벽타일/발코니/조명기구/환풍기/도어락/목공보강) 보강.

import type { EstimateResult, EstimateLine } from '@/lib/floor-plan/quantity/estimate-calculator';
import { TRADE_NAMES } from '@/lib/floor-plan/quantity/types';
import { resolveMaterialMeta, resolvePart, type PartCode } from './material-meta';
import { LABOR_CALIBRATION } from './material-meta';
import type { ConstructionEstimate } from '@/lib/inpick/estimate-v2/types';
import type { PricingBasis } from '@/lib/inpick/estimate-v2/types';

const UNIT_LABELS: Record<string, string> = {
  SQM: 'm²', LM: 'm', EA: '개', SET: '세트', LOT: '식',
  M3: 'm³', KG: 'kg', ROLL: '롤', CAN: '캔', BAG: '포',
};

// ─── 내역 라인 (단가·금액 분리) ───

export interface DetailLine {
  id: string;           // 편집 식별자
  trade: string;        // 공종명 (그룹 키)
  order: number;        // 공종 시공 순서
  itemCode: string;     // 엔진 itemCode (보강은 빈 문자열)
  itemName: string;     // 품명
  part: PartCode;       // 공사부위 (바닥/벽/천장/욕실/주방/창호·문/설비/전기/단열/공통)
  spec: string;         // 규격
  brand: string;        // 추천 브랜드
  product: string;      // 추천 제품(SKU 성격)
  priceBand?: string;   // 금액대 가이드 (hover)
  imageHint?: string;   // 이미지/스타일 키워드 (hover)
  unit: string;         // 단위
  quantity: number;     // 수량(면적 등)
  matUnit: number;      // 재료비 단가
  labUnit: number;      // 노무비 단가
  expenseUnit: number;  // 경비 단가
  labWas?: number;      // 보정 전 노무단가 (있으면 보정됨)
  labNote?: string;     // 노무 보정 사유
  matAmount: number;    // 재료비 금액
  labAmount: number;    // 노무비 금액
  expenseAmount: number;// 경비 금액
  amount: number;       // 합계 금액
  room: string;         // 실(室)
  source: string;       // 단가 근거
  optional: boolean;    // 옵션 항목(샷시/확장단열 등)
  added: boolean;       // 보강(신규 추가) 항목 여부 — UI 강조용
  pricingBasis?: PricingBasis; // 기본단가/현장가견적 구분
  contractorEditable?: boolean;
  siteVerificationRequired?: boolean;
  variationNotice?: string;
  siteAdjustmentFactors?: string[];
  siteConditionAdjustmentFactor?: number;
  siteConditionAdjustmentReason?: string;
  /** ConstructionEstimate의 surface_plan 단위. 실별 화면에서 같은 마감 공정을 1줄로 묶는 키 */
  workPackageKey?: string;
  /** 실별 표시에만 사용하는 공사 패키지 대표행 */
  isWorkPackage?: boolean;
  /** 대표 수량의 산출 기준(예: 방 바닥면적, 벽 면적) */
  quantityBasis?: string;
  /** 원가를 구성하는 철거·바탕·마감·부대공정. 공종별 원본 라인은 별도로 유지된다. */
  workBreakdown?: DetailWorkBreakdownLine[];
}

export interface DetailWorkBreakdownLine {
  id: string;
  trade: string;
  subTrade: string;
  taskName: string;
  itemName: string;
  spec: string;
  unit: string;
  quantity: number;
  quantityBasis: string;
  matAmount: number;
  laborAmount: number;
  expenseAmount: number;
  amount: number;
}

export interface DetailGroup {
  trade: string;
  order: number;
  lines: DetailLine[];
  matSum: number;
  labSum: number;
  expenseSum: number;
  sum: number;
}

export interface DetailSheet {
  groups: DetailGroup[];
  directMaterial: number;
  directLabor: number;
  directExpense: number;
  directTotal: number;
  lineCount: number;
}

// ─── 공종 시공 순서 (아파트 내역서 표준 순서) ───

const TRADE_ORDER: Record<string, number> = {
  '가설': 1,
  '철거': 2,
  '샷시': 3,
  '단열': 4,
  '조적': 5,
  '미장': 6,
  '방수': 7,
  '기계설비(배관)': 8,
  '전기': 9,
  '목공': 10,
  '타일': 11,
  '창호/문': 12,
  '중문': 13,
  '필름': 14,
  '도배/페인트': 15,
  '바닥재': 16,
  '천장': 17,
  '고정설비': 18,   // 주방·붙박이 가구
  '위생도기': 19,
  '조명': 20,
  '잡철/하드웨어': 21,
  '걸레받이/몰딩': 22,
  '정리/청소': 23,
  // ── 상가 전용 공종 ──
  '냉난방공사': 24,
  '환기·후드공사': 25,
  '소방공사': 26,
  '네트워크·통신공사': 27,
  '간판·파사드공사': 28,
  '상업주방': 29,
};

function orderOf(trade: string): number {
  return TRADE_ORDER[trade] ?? 99;
}

function round(n: number): number {
  return Math.round(n);
}

let _seq = 0;
function nextId(): string { _seq += 1; return `dl-${_seq}`; }

// 엔진 EstimateLine → DetailLine (부위/브랜드 메타 + 노무 시장가 보정 적용)
function fromEngine(line: EstimateLine): DetailLine {
  const trade = TRADE_NAMES[line.tradeCode] || line.tradeCode;
  const meta = resolveMaterialMeta(line.itemName);
  const qty = round(line.quantity * 100) / 100;

  // 노무 시장가 보정 (itemCode 기준)
  const calib = LABOR_CALIBRATION[line.itemCode];
  const labUnit = calib ? calib.labor : line.laborCost;
  const expenseUnit = 0;
  const matUnit = line.materialCost;
  const matAmount = round(qty * matUnit);
  const labAmount = round(qty * labUnit);
  const expenseAmount = 0;

  return {
    id: nextId(),
    trade,
    order: orderOf(trade),
    itemCode: line.itemCode,
    itemName: line.itemName,
    part: meta.part,
    spec: line.specification || '-',
    brand: meta.brand,
    product: meta.product,
    priceBand: meta.priceBand,
    imageHint: meta.imageHint,
    unit: UNIT_LABELS[line.unit] || line.unit,
    quantity: qty,
    matUnit,
    labUnit,
    expenseUnit,
    labWas: calib ? calib.was : undefined,
    labNote: calib ? calib.note : undefined,
    matAmount,
    labAmount,
    expenseAmount,
    amount: matAmount + labAmount + expenseAmount,
    room: line.roomName || '공통',
    source: line.priceSource || '',
    optional: false,
    added: false,
  };
}

// 보강 라인 생성 헬퍼
function add(
  trade: string, itemName: string, spec: string, unit: string,
  qty: number, matUnit: number, labUnit: number,
  opts: { room?: string; source?: string; optional?: boolean } = {}
): DetailLine {
  const meta = resolveMaterialMeta(itemName);
  const matAmount = round(qty * matUnit);
  const labAmount = round(qty * labUnit);
  const expenseUnit = 0;
  const expenseAmount = 0;
  return {
    id: nextId(),
    trade, order: orderOf(trade), itemCode: '',
    itemName, part: meta.part, spec,
    brand: meta.brand, product: meta.product, priceBand: meta.priceBand, imageHint: meta.imageHint,
    unit, quantity: qty, matUnit, labUnit, expenseUnit, matAmount, labAmount,
    expenseAmount, amount: matAmount + labAmount + expenseAmount,
    room: opts.room || '공통',
    source: opts.source || '2025 서울 실거래 기준(보강)',
    optional: opts.optional || false,
    added: true,
  };
}

export interface ResidentialOptions {
  sash: boolean;            // 샷시(발코니 이중창) 교체
  expansionInsulation: boolean; // 발코니 확장부 단열
  doorCount?: number;       // 문 개수 (필름)
  bathCount?: number;       // 욕실 수 (환풍기/샤워부스)
  area?: number;            // 전용면적 m²
}

// 아파트 누락항목 보강 (실제 올수리 견적 대조 결과)
export function residentialSupplement(opts: ResidentialOptions): DetailLine[] {
  const doors = opts.doorCount ?? 9;
  const baths = opts.bathCount ?? 2;
  const lines: DetailLine[] = [];

  // 가설
  lines.push(add('가설', '세대 양중·운반', '엘리베이터 양생 + 자재 양중', '식', 1, 0, 300000));

  // 샷시 (옵션)
  lines.push(add('샷시', '발코니 하이샷시 교체', '시스템 이중창(로이유리) 전면', '식', 1, 8000000, 1800000, { optional: true, source: 'KCC/LX 하이샷시 2025' }));

  // 단열 (옵션)
  lines.push(add('단열', '발코니 확장부 단열', '아이소핑크 30T + 열반사 단열', 'm²', 25, 18000, 22000, { optional: true }));

  // 목공 보강
  lines.push(add('목공', '아트월 제작', '거실 TV벽 아트월 (석고+무늬목/타일 하지)', '식', 1, 400000, 600000));
  lines.push(add('목공', '우물천장/간접조명 박스', '거실 우물천장 + 커튼박스 하지', '식', 1, 300000, 500000));
  lines.push(add('목공', '가벽·문선 하지 보강', '석고 가벽 + 문선 보강 목공', '식', 1, 200000, 300000));

  // 타일 보강 (주방벽/발코니/현관)
  lines.push(add('타일', '주방 벽타일', '주방 후드벽·싱크벽 포세린 300×600', 'm²', 8, 35000, 45000, { room: '주방/식당' }));
  lines.push(add('타일', '발코니 바닥타일', '자기질 타일 300×300', 'm²', 10, 30000, 40000, { room: '발코니' }));
  lines.push(add('타일', '현관 바닥타일', '포세린 600×600 (현관 강마루 대체)', 'm²', 4, 40000, 45000, { room: '현관' }));

  // 방수 보강 (발코니)
  lines.push(add('방수', '발코니 바닥 방수', '액체방수 2회 (배수구 주변 포함)', 'm²', 10, 15000, 20000, { room: '발코니' }));

  // 도배/페인트 보강 (발코니 탄성코트)
  lines.push(add('도배/페인트', '발코니 벽·천장 탄성코트', '결로방지 탄성코트 2회', 'm²', 25, 6000, 9000, { room: '발코니' }));

  // 창호/문 — 중문
  lines.push(add('중문', '3연동 중문', '슬라이딩 3연동 + 유리 (현관)', '세트', 1, 1200000, 300000, { room: '현관' }));

  // 필름
  lines.push(add('필름', '도어/문틀 필름 래핑', '인테리어 필름 (문짝+문틀)', '개', doors, 30000, 50000));
  lines.push(add('필름', '창틀·문선 필름', '창틀·걸레받이 상부 문선 필름', 'm²', 45, 8000, 12000));

  // 위생도기 보강
  lines.push(add('위생도기', '욕실 환풍기', '저소음 환풍기 (덕트 연결)', '개', baths, 60000, 40000));
  lines.push(add('위생도기', '샤워부스/유리파티션', '강화유리 파티션 (욕실당 1)', '개', baths, 350000, 100000));

  // ── 전기 보강 (아파트 전기 내역 기준) ──
  lines.push(add('전기', '세대 배선 전면 교체', 'HIV 전선 + CD관 재배선', '식', 1, 350000, 450000));
  lines.push(add('전기', '추가 콘센트 증설', '매립 콘센트 2구 (가전 증설 대응)', '개', 8, 12000, 35000));
  lines.push(add('전기', '4구/USB 콘센트', '멀티 4구·USB 매립 콘센트', '개', 4, 25000, 35000));
  lines.push(add('전기', '인덕션 전용회로', '단상 220V 전용회로 + 차단기', '개', 1, 60000, 90000, { room: '주방/식당' }));
  lines.push(add('전기', '에어컨 전용회로', '에어컨 전용 콘센트 + 회로', '개', 2, 45000, 70000));
  lines.push(add('전기', '욕실 방수 콘센트', '방수형 콘센트 + 면도기 단자', '개', baths, 18000, 35000, { room: '욕실' }));
  lines.push(add('전기', '디머/3로 스위치', '디밍·3로 스위치 (거실/침실)', '개', 6, 18000, 30000));
  lines.push(add('전기', '통신·TV 단자', '인터넷·TV·전화 단자 재배선', '개', 5, 20000, 35000));
  lines.push(add('전기', '누전차단기 증설', 'ELB 분기 차단기 증설', '식', 1, 120000, 80000));
  lines.push(add('전기', '디지털 도어락', '번호+카드 디지털 도어락', '개', 1, 180000, 50000, { room: '현관' }));

  // ── 조명기구 보강 (등기구 제품 — 현재 전기는 배선만) ──
  lines.push(add('조명', '거실 평판등 (LED)', '640각/슬림 평판등', '개', 1, 180000, 30000, { room: '거실' }));
  lines.push(add('조명', '방 LED등', '방등 (침실/안방)', '개', 3, 90000, 25000));
  lines.push(add('조명', '주방·식탁 조명', '주방 직부등 + 식탁 펜던트', '개', 2, 120000, 30000, { room: '주방/식당' }));
  lines.push(add('조명', '욕실 방습등', '방습형 욕실등', '개', baths, 70000, 25000, { room: '욕실' }));
  lines.push(add('조명', '현관·복도 센서등', '인체감지 센서등', '개', 2, 45000, 25000));
  lines.push(add('조명', '다운라이트(매입등)', 'LED 4인치 매입 다운라이트', '개', 12, 18000, 12000));
  lines.push(add('조명', '간접조명 LED바', '우물천장/아트월 간접조명', 'm', 12, 15000, 12000));

  return lines;
}

// 주택(아파트) 상세내역서 빌드
export function buildResidentialDetail(
  engine: EstimateResult,
  opts: ResidentialOptions
): DetailSheet {
  // 엔진 라인 (현관 강마루는 현관 타일로 대체하므로 제외)
  const engineLines = engine.lines
    .filter((l) => !(TRADE_NAMES[l.tradeCode] === '바닥재' && l.roomName === '현관'))
    .map(fromEngine);

  // 보강 라인 (옵션 미선택 시 해당 라인 제외)
  const supp = residentialSupplement(opts).filter((l) => {
    if (l.trade === '샷시' && !opts.sash) return false;
    if (l.trade === '단열' && !opts.expansionInsulation) return false;
    return true;
  });

  return assembleSheet([...engineLines, ...supp]);
}

// 평탄 라인 (엔진 매핑 + 보강 전체) — 마스터 생성기/검증용
export function residentialDetailLines(engine: EstimateResult, opts: ResidentialOptions): DetailLine[] {
  const engineLines = engine.lines
    .filter((l) => !(TRADE_NAMES[l.tradeCode] === '바닥재' && l.roomName === '현관'))
    .map(fromEngine);
  const supp = residentialSupplement(opts); // 마스터는 옵션 포함 전체
  return [...engineLines, ...supp];
}

// 공통: 라인 → 공종 그룹 + 합계
export function assembleSheet(all: DetailLine[]): DetailSheet {
  const byTrade = new Map<string, DetailLine[]>();
  for (const l of all) {
    if (!byTrade.has(l.trade)) byTrade.set(l.trade, []);
    byTrade.get(l.trade)!.push(l);
  }

  const groups: DetailGroup[] = Array.from(byTrade.entries())
    .map(([trade, lines]) => {
      const matSum = lines.reduce((s, x) => s + x.matAmount, 0);
      const labSum = lines.reduce((s, x) => s + x.labAmount, 0);
      const expenseSum = lines.reduce((s, x) => s + x.expenseAmount, 0);
      return {
        trade,
        order: orderOf(trade),
        lines,
        matSum,
        labSum,
        expenseSum,
        sum: matSum + labSum + expenseSum,
      };
    })
    .sort((a, b) => a.order - b.order);

  const directMaterial = groups.reduce((s, g) => s + g.matSum, 0);
  const directLabor = groups.reduce((s, g) => s + g.labSum, 0);
  const directExpense = groups.reduce((s, g) => s + g.expenseSum, 0);

  return {
    groups,
    directMaterial,
    directLabor,
    directExpense,
    directTotal: directMaterial + directLabor + directExpense,
    lineCount: all.length,
  };
}

// 실(室)별 × 부위별 그룹 — 안방/거실/부엌 등 실 단위로 묶고, 실 내부는 부위(바닥/벽/천장…) 순.
const PART_ORDER: Record<string, number> = {
  '바닥': 1, '벽': 2, '천장': 3, '걸레받이/몰딩': 4, '창호/문': 5,
  '욕실': 6, '주방': 7, '설비': 8, '전기': 9, '단열': 10, '공통': 11,
};

export function assembleByRoom(all: DetailLine[]): DetailSheet {
  const byRoom = new Map<string, DetailLine[]>();
  for (const l of all) {
    const k = l.room || '공통';
    if (!byRoom.has(k)) byRoom.set(k, []);
    byRoom.get(k)!.push(l);
  }
  let idx = 0;
  const groups: DetailGroup[] = Array.from(byRoom.entries()).map(([room, lines]) => {
    // 소비자용 실별 내역은 같은 surface_plan에서 전개된 원가 라인을
    // "거실 > 바닥 > 강마루 마감공사" 한 줄로 표시한다.
    // 철거·바탕·부자재·마감·폐기물 원본은 workBreakdown과 공종별 화면에 그대로 보존한다.
    const sorted = collapseSurfaceWorkPackages(lines)
      .sort((a, b) => (PART_ORDER[a.part] ?? 99) - (PART_ORDER[b.part] ?? 99));
    const matSum = sorted.reduce((s, x) => s + x.matAmount, 0);
    const labSum = sorted.reduce((s, x) => s + x.labAmount, 0);
    const expenseSum = sorted.reduce((s, x) => s + x.expenseAmount, 0);
    return {
      trade: room,
      order: ++idx,
      lines: sorted,
      matSum,
      labSum,
      expenseSum,
      sum: matSum + labSum + expenseSum,
    };
  });
  groups.sort((a, b) => (a.trade === '공통' ? 1 : 0) - (b.trade === '공통' ? 1 : 0)); // 공통 맨 뒤
  const directMaterial = groups.reduce((s, g) => s + g.matSum, 0);
  const directLabor = groups.reduce((s, g) => s + g.labSum, 0);
  const directExpense = groups.reduce((s, g) => s + g.expenseSum, 0);
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0);
  return {
    groups,
    directMaterial,
    directLabor,
    directExpense,
    directTotal: directMaterial + directLabor + directExpense,
    lineCount,
  };
}

const PACKAGE_PARTS = new Set<PartCode>(['바닥', '벽', '천장']);

function collapseSurfaceWorkPackages(lines: DetailLine[]): DetailLine[] {
  const buckets = new Map<string, DetailLine[]>();
  const output: Array<{ index: number; line?: DetailLine; packageLines?: DetailLine[] }> = [];

  lines.forEach((line, index) => {
    if (!line.workPackageKey || !PACKAGE_PARTS.has(line.part)) {
      output.push({ index, line });
      return;
    }
    const existing = buckets.get(line.workPackageKey);
    if (existing) {
      existing.push(line);
      return;
    }
    const packageLines = [line];
    buckets.set(line.workPackageKey, packageLines);
    output.push({ index, packageLines });
  });

  return output
    .sort((a, b) => a.index - b.index)
    .map((entry) => {
      if (entry.line) return entry.line;
      const packageLines = entry.packageLines!;
      return packageLines.length > 1
        ? createSurfaceWorkPackage(packageLines)
        : packageLines[0];
    });
}

function createSurfaceWorkPackage(lines: DetailLine[]): DetailLine {
  // 마감재 라인은 일반적으로 패키지에서 재료비 비중이 가장 크다.
  // 비동기 resolver가 모든 하위 라인의 품명을 덮어쓴 구 견적도 taskName 기반 어댑터와
  // 이 선택 규칙으로 정상적인 대표 마감을 복구한다.
  const finish = lines.reduce((best, line) =>
    line.matAmount > best.matAmount ? line : best
  );
  const sameUnit = lines.filter((line) =>
    line.unit === finish.unit && line.quantity > 0
  );
  const quantityBasisLine = sameUnit.reduce(
    (best, line) => line.quantity < best.quantity ? line : best,
    sameUnit[0] || finish,
  );
  const quantity = quantityBasisLine.quantity || finish.quantity || 1;
  const matAmount = round(lines.reduce((sum, line) => sum + line.matAmount, 0));
  const labAmount = round(lines.reduce((sum, line) => sum + line.labAmount, 0));
  const expenseAmount = round(lines.reduce((sum, line) => sum + (line.expenseAmount || 0), 0));
  const itemStem = finish.itemName
    .replace(/^기존\s+/, '')
    .replace(/\s+(철거|제거|시공|설치|교체|공사)$/, '')
    .trim() || finish.itemName;
  const pricingBases = new Set(lines.map((line) => line.pricingBasis).filter(Boolean));
  const source = Array.from(new Set(lines.map((line) => line.source).filter(Boolean))).join(' · ');

  return {
    ...finish,
    id: `wp-${finish.workPackageKey}`,
    trade: `${finish.part} 마감공사`,
    order: Math.min(...lines.map((line) => line.order)),
    itemName: `${itemStem} ${finish.part} 마감공사`,
    spec: finish.spec === '-'
      ? `${lines.length}개 세부공정 포함`
      : `${finish.spec} · ${lines.length}개 세부공정 포함`,
    quantity,
    matUnit: quantity > 0 ? round(matAmount / quantity) : 0,
    labUnit: quantity > 0 ? round(labAmount / quantity) : 0,
    expenseUnit: quantity > 0 ? round(expenseAmount / quantity) : 0,
    matAmount,
    labAmount,
    expenseAmount,
    amount: matAmount + labAmount + expenseAmount,
    source,
    isWorkPackage: true,
    quantityBasis: quantityBasisLine.quantityBasis || `${finish.part} 순면적`,
    workBreakdown: lines.map((line) => ({
      id: line.id,
      trade: line.trade,
      subTrade: line.itemCode,
      taskName: line.itemName,
      itemName: line.product && line.product !== '-' ? line.product : line.itemName,
      spec: line.spec,
      unit: line.unit,
      quantity: line.quantity,
      quantityBasis: line.quantityBasis || '-',
      matAmount: line.matAmount,
      laborAmount: line.labAmount,
      expenseAmount: line.expenseAmount,
      amount: line.amount,
    })),
    contractorEditable: false,
    pricingBasis: pricingBases.has('site_allowance')
      ? 'site_allowance'
      : finish.pricingBasis,
    siteVerificationRequired: lines.some((line) => line.siteVerificationRequired),
    variationNotice: Array.from(
      new Set(lines.map((line) => line.variationNotice).filter(Boolean)),
    ).join(' '),
    siteAdjustmentFactors: Array.from(
      new Set(lines.flatMap((line) => line.siteAdjustmentFactors || [])),
    ),
  };
}

// ─── 고정 마스터 내역 (모든 견적서 공통 항목셋) ───
// 프로젝트별로 수량 0 또는 삭제로 운용. 단가/규격/브랜드는 표준 기본값(편집 가능).

export interface MasterItem {
  trade: string;
  order: number;
  itemName: string;
  part: PartCode;
  spec: string;
  brand: string;
  product: string;
  priceBand?: string;
  imageHint?: string;
  unit: string;
  quantity: number;   // 84㎡(34평) 표준 기본 수량
  matUnit: number;
  labUnit: number;
  labWas?: number;
  labNote?: string;
  optional: boolean;
  source: string;
}

// ─── Vision 분석 견적(v2) → DetailLine[] 어댑터 ───
// 파이프라인: 디자인 이미지 → Vision 분석 → build-estimate(ConstructionEstimate) → 본 어댑터 → 우리 4문서 폼.

const V2_UNIT: Record<string, string> = {
  m2: 'm²', sqm: 'm²', m: 'm', lm: 'm', ea: '개', set: '세트', lot: '식', kg: 'kg', roll: '롤',
};
const SURFACE_PART: Record<string, PartCode> = {
  floor: '바닥', wall: '벽', ceiling: '천장', door: '창호/문', window: '창호/문',
  baseboard: '걸레받이/몰딩', fixture: '욕실', sink: '주방', cabinet: '주방', counter: '주방', lighting: '전기',
};

function isSupportingWorkTask(taskName: string): boolean {
  return [
    '철거', '제거', '바탕', '면정리', '보수', '부자재', '방습', '접착',
    '폐기', '반출', '양중', '운반', '초배', '방수', '몰탈', '모르타르',
    '실리콘', '줄눈',
  ].some((keyword) => taskName.includes(keyword));
}

function materialLookupNameForDiscipline(
  taskName: string,
  tradeCode?: string,
): string {
  if (tradeCode === '05') {
    return taskName.replace(
      /(주방|욕실|싱크대|싱크볼|양변기|세면대|샤워|식기세척기)/g,
      '',
    );
  }
  if (tradeCode === '04') {
    return taskName.replace(
      /(주방|욕실|상부장|인덕션|식기세척기|오븐|환풍기)/g,
      '',
    );
  }
  return taskName;
}

export function constructionEstimateToDetailLines(est: ConstructionEstimate): DetailLine[] {
  const lines = (est.lines || []).filter((l) => l.included !== false);
  let i = 0;
  return lines.map((l) => {
    const trade = l.tradeNameKo || l.tradeCode || '기타';
    // taskName은 원가 라인의 실제 작업(철거/바탕/마감)을 나타낸다.
    // 구 버전 resolver가 itemNameKo를 최종 마감재명으로 덮어쓴 견적도 여기서 복구한다.
    const itemName = l.taskNameKo || l.itemNameKo || l.subTradeNameKo || '항목';
    const materialLookupName = materialLookupNameForDiscipline(itemName, l.tradeCode);
    const resolvedMeta = resolveMaterialMeta(materialLookupName);
    const meta =
      resolvedMeta.brand === '-' && resolvedMeta.product === materialLookupName
        ? { ...resolvedMeta, product: itemName }
        : resolvedMeta;
    const semanticPart = resolvePart(itemName);
    const disciplinePart: PartCode | undefined =
      l.tradeCode === '04'
        ? '전기'
        : l.tradeCode === '05'
          ? '설비'
          : undefined;
    const preferSemanticPart =
      semanticPart !== '공통' &&
      !(l.surfaceType === 'ceiling' && semanticPart === '벽');
    const part: PartCode =
      // 전기·설비는 주방/욕실 SurfacePlan에서 파생돼도 독립 공종으로 표시한다.
      disciplinePart ||
      // fixture/sink 계획 안의 천장·욕실·주방 작업과 LH의 AB(걸레받이)는
      // 실제 작업 부위를 우선한다. 단, 천장 벽지는 "벽"으로 오인하지 않는다.
      (preferSemanticPart
        ? semanticPart
        : (l.surfaceType && SURFACE_PART[l.surfaceType]) || semanticPart || meta.part);
    const supportingWork = isSupportingWorkTask(l.taskNameKo || itemName);
    // 구 견적의 하위 공정에 잘못 복제된 최종 마감재 상품 메타도 제거한다.
    const brand = supportingWork
      ? meta.brand
      : l.brand || l.manufacturer || meta.brand;
    const product = supportingWork
      ? meta.product
      : l.productName || l.modelNo || l.sku || meta.product;
    const spec = l.spec || l.productSpec || meta.priceBand || '-';
    const qty = Math.round((l.quantity || 0) * 100) / 100;
    const matUnit = Math.round(l.materialUnitPrice || 0);
    const labUnit = Math.round(l.laborUnitPrice || 0);
    const expenseUnit = Math.round(l.expenseUnitPrice || 0);
    const matAmount = Math.round(l.materialAmount || 0);
    const labAmount = Math.round(l.laborAmount || 0);
    const expenseAmount = Math.round(l.expenseAmount || 0);
    const surfacePlanRefs = Array.from(new Set(
      (l.evidenceRefs || [])
        .filter((ref) => ref.type === 'surface_plan')
        .map((ref) => ref.id),
    )).sort();
    const workPackageKey = surfacePlanRefs.length > 0 && l.surfaceType
      ? `${l.roomId}:${l.surfaceType}:${surfacePlanRefs.join('+')}`
      : undefined;
    return {
      id: l.id || `ce-${i++}`,
      trade,
      order: orderOf(trade),
      itemCode: l.subTradeCode || l.tradeCode || '',
      itemName,
      part,
      spec,
      brand,
      product,
      priceBand: meta.priceBand,
      imageHint: meta.imageHint,
      unit: V2_UNIT[(l.unit || '').toLowerCase()] || l.unit || '식',
      quantity: qty,
      matUnit,
      labUnit,
      expenseUnit,
      matAmount,
      labAmount,
      expenseAmount,
      amount: matAmount + labAmount + expenseAmount,
      room: l.roomName || '공통',
      source:
        l.materialPriceSource ||
        (l.source ? String(l.source) : '') ||
        'Vision 분석 견적',
      optional: false,
      added: false,
      pricingBasis: l.pricingBasis,
      contractorEditable: l.contractorEditable,
      siteVerificationRequired: l.siteVerificationRequired,
      variationNotice: l.variationNotice,
      siteAdjustmentFactors: l.siteAdjustmentFactors,
      siteConditionAdjustmentFactor: l.siteConditionAdjustmentFactor,
      siteConditionAdjustmentReason: l.siteConditionAdjustmentReason,
      workPackageKey,
      quantityBasis: l.quantityFormulaKo,
    };
  });
}

/**
 * Supabase construction_estimate_lines 응답을 정식 견적 폼 라인으로 변환한다.
 * 사업자 입찰 화면에서도 소비자 견적과 동일한 문서·수량·공정 모델을 사용하기 위한 어댑터.
 */
export function storedConstructionEstimateLinesToDetailLines(
  storedLines: Array<Record<string, unknown>>,
): DetailLine[] {
  const lines = storedLines.map((line, index) => ({
    id: String(line.id || `stored-${index}`),
    sortNo: Number(line.sort_no || index),
    tradeCode: String(line.trade_code || ""),
    tradeNameKo: String(line.trade_name_ko || line.trade_code || "기타"),
    subTradeCode: String(line.sub_trade_code || line.trade_code || ""),
    subTradeNameKo: String(
      line.sub_trade_name_ko || line.task_name_ko || "세부공종",
    ),
    roomId: String(line.room_id || "common"),
    roomName: String(line.room_name || "공통"),
    roomType: String(line.room_type || "unknown"),
    surfaceType: line.surface_type
      ? String(line.surface_type)
      : undefined,
    taskNameKo: String(line.task_name_ko || line.item_name_ko || "항목"),
    itemNameKo: String(line.item_name_ko || line.task_name_ko || "항목"),
    brand: line.brand ? String(line.brand) : undefined,
    manufacturer: line.manufacturer
      ? String(line.manufacturer)
      : undefined,
    supplierName: line.supplier_name
      ? String(line.supplier_name)
      : undefined,
    vendorName: line.vendor_name ? String(line.vendor_name) : undefined,
    productName: line.product_name ? String(line.product_name) : undefined,
    modelNo: line.model_no ? String(line.model_no) : undefined,
    sku: line.sku ? String(line.sku) : undefined,
    spec: line.spec ? String(line.spec) : undefined,
    productSpec: line.product_spec
      ? String(line.product_spec)
      : undefined,
    materialCategoryCode: line.material_category_code
      ? String(line.material_category_code)
      : undefined,
    materialPriceSource: line.material_price_source
      ? String(line.material_price_source)
      : undefined,
    productMatchStatus: line.product_match_status
      ? String(line.product_match_status)
      : undefined,
    fallbackReason: line.fallback_reason
      ? String(line.fallback_reason)
      : undefined,
    unit: String(line.unit || "lot"),
    quantityFormulaKo: String(line.quantity_formula_ko || "저장 견적 수량"),
    quantity: Number(line.quantity || 0),
    materialUnitPrice: Number(line.material_unit_price || 0),
    laborUnitPrice: Number(line.labor_unit_price || 0),
    expenseUnitPrice: Number(line.expense_unit_price || 0),
    materialAmount: Number(line.material_amount || 0),
    laborAmount: Number(line.labor_amount || 0),
    expenseAmount: Number(line.expense_amount || 0),
    totalAmount: Number(line.total_amount || 0),
    included: line.included !== false,
    source: String(line.source || "standard_fallback_material"),
    confidence: Number(line.confidence || 0),
    pricingBasis: line.pricing_basis
      ? String(line.pricing_basis)
      : undefined,
    contractorEditable: Boolean(line.contractor_editable),
    siteVerificationRequired: Boolean(line.site_verification_required),
    variationNotice: line.variation_notice
      ? String(line.variation_notice)
      : undefined,
    siteAdjustmentFactors: Array.isArray(line.site_adjustment_factors)
      ? line.site_adjustment_factors.map(String)
      : [],
    siteConditionAdjustmentFactor:
      line.site_condition_adjustment_factor == null
        ? undefined
        : Number(line.site_condition_adjustment_factor),
    siteConditionAdjustmentReason: line.site_condition_adjustment_reason
      ? String(line.site_condition_adjustment_reason)
      : undefined,
    evidenceRefs: Array.isArray(line.evidence_refs)
      ? line.evidence_refs
      : [],
    assumptions: Array.isArray(line.assumptions)
      ? line.assumptions.map(String)
      : [],
    warnings: Array.isArray(line.warnings) ? line.warnings.map(String) : [],
  }));

  return constructionEstimateToDetailLines({
    lines,
  } as unknown as ConstructionEstimate);
}

// 마스터 → DetailSheet (수량 0 항목은 옵션으로 숨김 가능)
export function masterToSheet(items: MasterItem[], opts: { dropZeroQty?: boolean } = {}): DetailSheet {
  let i = 0;
  const lines: DetailLine[] = items
    .filter((m) => !(opts.dropZeroQty && m.quantity <= 0))
    .map((m) => {
      const matAmount = round(m.quantity * m.matUnit);
      const labAmount = round(m.quantity * m.labUnit);
      const expenseUnit = 0;
      const expenseAmount = 0;
      return {
        id: `m-${i++}`,
        trade: m.trade, order: m.order, itemCode: '', itemName: m.itemName,
        part: m.part, spec: m.spec, brand: m.brand, product: m.product,
        priceBand: m.priceBand, imageHint: m.imageHint,
        unit: m.unit, quantity: m.quantity, matUnit: m.matUnit, labUnit: m.labUnit,
        expenseUnit,
        labWas: m.labWas, labNote: m.labNote,
        matAmount, labAmount, expenseAmount,
        amount: matAmount + labAmount + expenseAmount,
        room: '전체', source: m.source, optional: m.optional, added: false,
      };
    });
  return assembleSheet(lines);
}
