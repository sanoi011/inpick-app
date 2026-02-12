// src/lib/floor-plan/quantity/unit-price-db.ts

export interface UnitPrice {
  itemCode: string;
  itemName: string;
  unit: string;
  materialCost: number;
  laborCost: number;
  totalUnitCost: number;
  source: string;
  updatedAt: string;
}

export const DEFAULT_UNIT_PRICES: UnitPrice[] = [
  // 01. 철거
  { itemCode: '01.WALLPAPER', itemName: '벽지 철거', unit: 'SQM', materialCost: 0, laborCost: 3000, totalUnitCost: 3000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.FLOORING', itemName: '바닥재 철거', unit: 'SQM', materialCost: 0, laborCost: 5000, totalUnitCost: 5000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.CEILING', itemName: '천장재 철거', unit: 'SQM', materialCost: 0, laborCost: 4000, totalUnitCost: 4000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.WALL_TILE', itemName: '벽타일 철거', unit: 'SQM', materialCost: 0, laborCost: 8000, totalUnitCost: 8000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.FLOOR_TILE', itemName: '바닥타일 철거', unit: 'SQM', materialCost: 0, laborCost: 10000, totalUnitCost: 10000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.DOOR', itemName: '문/문틀 철거', unit: 'EA', materialCost: 0, laborCost: 30000, totalUnitCost: 30000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.SANITARY', itemName: '위생도기 철거', unit: 'EA', materialCost: 0, laborCost: 50000, totalUnitCost: 50000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.PARTITION', itemName: '경량벽 철거', unit: 'SQM', materialCost: 0, laborCost: 12000, totalUnitCost: 12000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.KITCHEN', itemName: '주방 철거', unit: 'LOT', materialCost: 0, laborCost: 300000, totalUnitCost: 300000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '01.WASTE', itemName: '폐기물 처리', unit: 'LOT', materialCost: 400000, laborCost: 200000, totalUnitCost: 600000, source: '2025 실거래 (34평 기준)', updatedAt: '2025-01' },

  // 02. 조적
  { itemCode: '02.BLOCK', itemName: '조적', unit: 'SQM', materialCost: 15000, laborCost: 25000, totalUnitCost: 40000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '02.MORTAR', itemName: '조적 모르타르', unit: 'M3', materialCost: 80000, laborCost: 0, totalUnitCost: 80000, source: '2025 실거래', updatedAt: '2025-01' },

  // 03. 미장
  { itemCode: '03.WALL', itemName: '벽체 미장', unit: 'SQM', materialCost: 5000, laborCost: 15000, totalUnitCost: 20000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '03.FLOOR_WET', itemName: '바닥 미장 (습식)', unit: 'SQM', materialCost: 5000, laborCost: 18000, totalUnitCost: 23000, source: '2025 실거래', updatedAt: '2025-01' },

  // 04. 방수
  { itemCode: '04.FLOOR', itemName: '바닥 방수', unit: 'SQM', materialCost: 12000, laborCost: 18000, totalUnitCost: 30000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '04.WALL', itemName: '벽체 방수', unit: 'SQM', materialCost: 10000, laborCost: 15000, totalUnitCost: 25000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '04.CURB', itemName: '턱 방수', unit: 'SQM', materialCost: 12000, laborCost: 18000, totalUnitCost: 30000, source: '2025 실거래', updatedAt: '2025-01' },

  // 05. 타일
  { itemCode: '05.FLOOR', itemName: '바닥 타일', unit: 'SQM', materialCost: 30000, laborCost: 35000, totalUnitCost: 65000, source: '2025 중급 포세린', updatedAt: '2025-01' },
  { itemCode: '05.WALL', itemName: '벽 타일', unit: 'SQM', materialCost: 25000, laborCost: 35000, totalUnitCost: 60000, source: '2025 중급 포세린', updatedAt: '2025-01' },
  { itemCode: '05.ADHESIVE', itemName: '타일 접착제', unit: 'KG', materialCost: 800, laborCost: 0, totalUnitCost: 800, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '05.GROUT', itemName: '줄눈재', unit: 'KG', materialCost: 3000, laborCost: 0, totalUnitCost: 3000, source: '2025 에폭시 줄눈', updatedAt: '2025-01' },

  // 06. 목공
  { itemCode: '06.CEILING_FRAME', itemName: '우물천장 틀', unit: 'LM', materialCost: 20000, laborCost: 25000, totalUnitCost: 45000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '06.LIGHT_BOX', itemName: '간접조명 박스', unit: 'LM', materialCost: 15000, laborCost: 20000, totalUnitCost: 35000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '06.STUD', itemName: '경량 스터드', unit: 'LM', materialCost: 3000, laborCost: 5000, totalUnitCost: 8000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '06.DRYWALL', itemName: '석고보드', unit: 'SQM', materialCost: 8000, laborCost: 12000, totalUnitCost: 20000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '06.DOOR_FRAME_SUB', itemName: '문틀 하지', unit: 'EA', materialCost: 15000, laborCost: 25000, totalUnitCost: 40000, source: '2025 실거래', updatedAt: '2025-01' },

  // 07. 바닥재
  { itemCode: '07.MAIN', itemName: '바닥재', unit: 'SQM', materialCost: 35000, laborCost: 15000, totalUnitCost: 50000, source: '2025 중급 강마루', updatedAt: '2025-01' },
  { itemCode: '07.UNDERLAY', itemName: '바닥 하지', unit: 'SQM', materialCost: 8000, laborCost: 5000, totalUnitCost: 13000, source: '2025 실거래', updatedAt: '2025-01' },

  // 08. 도배/페인트
  { itemCode: '08.WALLPAPER', itemName: '벽지', unit: 'SQM', materialCost: 5000, laborCost: 8000, totalUnitCost: 13000, source: '2025 실크 합지', updatedAt: '2025-01' },
  { itemCode: '08.PRIMER_PAPER', itemName: '초배지', unit: 'SQM', materialCost: 1500, laborCost: 3000, totalUnitCost: 4500, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '08.PAINT', itemName: '페인트', unit: 'SQM', materialCost: 4000, laborCost: 8000, totalUnitCost: 12000, source: '2025 수성 페인트', updatedAt: '2025-01' },
  { itemCode: '08.PRIMER', itemName: '프라이머', unit: 'SQM', materialCost: 2000, laborCost: 3000, totalUnitCost: 5000, source: '2025 실거래', updatedAt: '2025-01' },

  // 09. 천장
  { itemCode: '09.GYPSUM', itemName: '천장 석고보드', unit: 'SQM', materialCost: 8000, laborCost: 15000, totalUnitCost: 23000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '09.PAINT', itemName: '천장 도장', unit: 'SQM', materialCost: 3000, laborCost: 6000, totalUnitCost: 9000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '09.FRAME', itemName: '천장 경량틀', unit: 'SQM', materialCost: 6000, laborCost: 8000, totalUnitCost: 14000, source: '2025 실거래', updatedAt: '2025-01' },

  // 10. 창호/문
  { itemCode: '10.DOOR_SINGLE_DOOR', itemName: '외여닫이문', unit: 'SET', materialCost: 200000, laborCost: 80000, totalUnitCost: 280000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '10.DOOR_SLIDING_DOOR', itemName: '미닫이문', unit: 'SET', materialCost: 250000, laborCost: 100000, totalUnitCost: 350000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '10.DOOR_ENTRANCE_DOOR', itemName: '현관문', unit: 'SET', materialCost: 400000, laborCost: 150000, totalUnitCost: 550000, source: '2025 중급', updatedAt: '2025-01' },

  // 11. 잡철
  { itemCode: '11.BATH_ACC', itemName: '화장실 악세서리', unit: 'SET', materialCost: 150000, laborCost: 50000, totalUnitCost: 200000, source: '2025 중급 세트', updatedAt: '2025-01' },
  { itemCode: '11.CAULKING', itemName: '실리콘 코킹', unit: 'LM', materialCost: 1000, laborCost: 2000, totalUnitCost: 3000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '11.CURTAIN_BOX', itemName: '커튼박스', unit: 'LM', materialCost: 15000, laborCost: 20000, totalUnitCost: 35000, source: '2025 실거래', updatedAt: '2025-01' },

  // 12. 배관
  { itemCode: '12.WATER_POINT', itemName: '급수 포인트', unit: 'EA', materialCost: 30000, laborCost: 80000, totalUnitCost: 110000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '12.DRAIN_POINT', itemName: '배수 포인트', unit: 'EA', materialCost: 25000, laborCost: 80000, totalUnitCost: 105000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '12.GAS', itemName: '가스 배관', unit: 'EA', materialCost: 30000, laborCost: 100000, totalUnitCost: 130000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '12.BOILER', itemName: '보일러 설치', unit: 'EA', materialCost: 0, laborCost: 200000, totalUnitCost: 200000, source: '2025 설치비만 (제품 별도)', updatedAt: '2025-01' },
  { itemCode: '12.ONDOL', itemName: '바닥 난방 배관', unit: 'LOT', materialCost: 800000, laborCost: 600000, totalUnitCost: 1400000, source: '2025 34평 기준', updatedAt: '2025-01' },

  // 13. 위생도기
  { itemCode: '13.TOILET', itemName: '양변기', unit: 'EA', materialCost: 250000, laborCost: 80000, totalUnitCost: 330000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '13.BASIN_CABINET', itemName: '세면대(하부장)', unit: 'EA', materialCost: 300000, laborCost: 80000, totalUnitCost: 380000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '13.BASIN', itemName: '세면대', unit: 'EA', materialCost: 150000, laborCost: 60000, totalUnitCost: 210000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '13.SHOWER_BOOTH', itemName: '샤워부스', unit: 'EA', materialCost: 400000, laborCost: 150000, totalUnitCost: 550000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '13.BATHTUB', itemName: '욕조', unit: 'EA', materialCost: 500000, laborCost: 200000, totalUnitCost: 700000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '13.BIDET', itemName: '비데', unit: 'EA', materialCost: 300000, laborCost: 50000, totalUnitCost: 350000, source: '2025 중급', updatedAt: '2025-01' },

  // 14. 전기
  { itemCode: '14.LIGHT', itemName: '조명 포인트', unit: 'EA', materialCost: 15000, laborCost: 35000, totalUnitCost: 50000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '14.OUTLET', itemName: '콘센트', unit: 'EA', materialCost: 8000, laborCost: 25000, totalUnitCost: 33000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '14.SWITCH', itemName: '스위치', unit: 'EA', materialCost: 5000, laborCost: 20000, totalUnitCost: 25000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '14.PANEL', itemName: '분전반', unit: 'EA', materialCost: 150000, laborCost: 100000, totalUnitCost: 250000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '14.INTERCOM', itemName: '인터폰', unit: 'EA', materialCost: 80000, laborCost: 50000, totalUnitCost: 130000, source: '2025 실거래', updatedAt: '2025-01' },

  // 15. 고정설비
  { itemCode: '15.KITCHEN_SINK', itemName: '주방 싱크대', unit: 'EA', materialCost: 200000, laborCost: 80000, totalUnitCost: 280000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '15.KITCHEN_UPPER_CABINET', itemName: '주방 상부장', unit: 'LM', materialCost: 250000, laborCost: 80000, totalUnitCost: 330000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '15.KITCHEN_LOWER_CABINET', itemName: '주방 하부장', unit: 'LM', materialCost: 350000, laborCost: 100000, totalUnitCost: 450000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '15.KITCHEN_COUNTER', itemName: '주방 상판', unit: 'LM', materialCost: 200000, laborCost: 50000, totalUnitCost: 250000, source: '2025 엔지니어드 스톤', updatedAt: '2025-01' },
  { itemCode: '15.RANGE_HOOD', itemName: '레인지후드', unit: 'EA', materialCost: 200000, laborCost: 50000, totalUnitCost: 250000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '15.SHOE_CABINET', itemName: '신발장', unit: 'LM', materialCost: 300000, laborCost: 100000, totalUnitCost: 400000, source: '2025 빌트인', updatedAt: '2025-01' },
  { itemCode: '15.WARDROBE', itemName: '붙박이장', unit: 'LM', materialCost: 400000, laborCost: 120000, totalUnitCost: 520000, source: '2025 빌트인', updatedAt: '2025-01' },
  { itemCode: '15.AC', itemName: '에어컨 설치', unit: 'EA', materialCost: 0, laborCost: 150000, totalUnitCost: 150000, source: '2025 설치비만', updatedAt: '2025-01' },
  { itemCode: '15.GAS_RANGE', itemName: '가스레인지', unit: 'EA', materialCost: 300000, laborCost: 50000, totalUnitCost: 350000, source: '2025 중급', updatedAt: '2025-01' },
  { itemCode: '15.INDUCTION', itemName: '인덕션', unit: 'EA', materialCost: 400000, laborCost: 50000, totalUnitCost: 450000, source: '2025 중급', updatedAt: '2025-01' },

  // 16. 걸레받이/몰딩
  { itemCode: '16.BASEBOARD', itemName: '걸레받이', unit: 'LM', materialCost: 5000, laborCost: 5000, totalUnitCost: 10000, source: '2025 PVC', updatedAt: '2025-01' },
  { itemCode: '16.TILE_BASEBOARD', itemName: '타일 걸레받이', unit: 'LM', materialCost: 8000, laborCost: 8000, totalUnitCost: 16000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '16.CROWN', itemName: '크라운 몰딩', unit: 'LM', materialCost: 10000, laborCost: 8000, totalUnitCost: 18000, source: '2025 PU 몰딩', updatedAt: '2025-01' },

  // 17. 정리
  { itemCode: '17.FINAL_CLEAN', itemName: '준공 청소', unit: 'SQM', materialCost: 0, laborCost: 3000, totalUnitCost: 3000, source: '2025 실거래', updatedAt: '2025-01' },
  { itemCode: '17.PROTECT', itemName: '양생/보양', unit: 'LOT', materialCost: 100000, laborCost: 100000, totalUnitCost: 200000, source: '2025 실거래', updatedAt: '2025-01' },
];

/** itemCode로 단가 조회 (부분 매칭 지원) */
export function findUnitPrice(itemCode: string): UnitPrice | undefined {
  const exact = DEFAULT_UNIT_PRICES.find(p => p.itemCode === itemCode);
  if (exact) return exact;

  // 부분 매칭: '10.DOOR_SINGLE_DOOR_900x2100' → '10.DOOR_SINGLE_DOOR'
  const baseCode = itemCode.replace(/_\d+x\d+$/, '');
  return DEFAULT_UNIT_PRICES.find(p => p.itemCode === baseCode);
}
