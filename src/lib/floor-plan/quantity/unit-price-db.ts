// src/lib/floor-plan/quantity/unit-price-db.ts
// 2025~2026년 한국물가협회, 대한건설협회 시중노임, 국토부 고시 기준
// 84m² 아파트 올수리 기준 5,500~7,000만원 수준

export interface UnitPrice {
  itemCode: string;
  itemName: string;
  unit: string;
  materialCost: number;
  laborCost: number;
  totalUnitCost: number;
  source: string;
  updatedAt: string;
  priceGrade: 'economy' | 'standard' | 'premium';
  priceReference: string;
}

export const DEFAULT_UNIT_PRICES: UnitPrice[] = [
  // ───────────────────────────────────────────
  // 01. 철거
  // ───────────────────────────────────────────
  { itemCode: '01.WALLPAPER', itemName: '벽지 철거', unit: 'SQM', materialCost: 0, laborCost: 4500, totalUnitCost: 4500, source: '2025 보통인부 노임 기준', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.FLOORING', itemName: '바닥재 철거', unit: 'SQM', materialCost: 0, laborCost: 8000, totalUnitCost: 8000, source: '2025 마루/장판 철거', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.CEILING', itemName: '천장재 철거', unit: 'SQM', materialCost: 0, laborCost: 6000, totalUnitCost: 6000, source: '2025 석고보드 천장 철거', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.WALL_TILE', itemName: '벽타일 철거', unit: 'SQM', materialCost: 0, laborCost: 12000, totalUnitCost: 12000, source: '2025 타일공 노임', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.FLOOR_TILE', itemName: '바닥타일 철거', unit: 'SQM', materialCost: 0, laborCost: 15000, totalUnitCost: 15000, source: '2025 바닥타일 철거 (두께감안)', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.DOOR', itemName: '문/문틀 철거', unit: 'EA', materialCost: 0, laborCost: 45000, totalUnitCost: 45000, source: '2025 문짝+문틀 해체', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.SANITARY', itemName: '위생도기 철거', unit: 'EA', materialCost: 0, laborCost: 70000, totalUnitCost: 70000, source: '2025 배관공 노임', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.PARTITION', itemName: '경량벽 철거', unit: 'SQM', materialCost: 0, laborCost: 15000, totalUnitCost: 15000, source: '2025 경량칸막이 해체', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 노임단가' },
  { itemCode: '01.KITCHEN', itemName: '주방 철거', unit: 'LOT', materialCost: 0, laborCost: 450000, totalUnitCost: 450000, source: '2025 싱크대+상하부장 일체 해체', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '01.WASTE', itemName: '폐기물 처리', unit: 'LOT', materialCost: 600000, laborCost: 300000, totalUnitCost: 900000, source: '2025 25평 기준 5톤 2~3회', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 02. 조적
  // ───────────────────────────────────────────
  { itemCode: '02.BLOCK', itemName: '조적', unit: 'SQM', materialCost: 20000, laborCost: 35000, totalUnitCost: 55000, source: '2025 시멘트벽돌 0.5B', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '02.MORTAR', itemName: '조적 모르타르', unit: 'M3', materialCost: 100000, laborCost: 0, totalUnitCost: 100000, source: '2025 시멘트모르타르 1:3', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 03. 미장
  // ───────────────────────────────────────────
  { itemCode: '03.WALL', itemName: '벽체 미장', unit: 'SQM', materialCost: 7000, laborCost: 22000, totalUnitCost: 29000, source: '2025 시멘트 미장 15mm', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 미장공 노임' },
  { itemCode: '03.FLOOR_WET', itemName: '바닥 미장 (습식)', unit: 'SQM', materialCost: 7000, laborCost: 25000, totalUnitCost: 32000, source: '2025 바닥 레벨링 포함', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 미장공 노임' },

  // ───────────────────────────────────────────
  // 04. 방수
  // ───────────────────────────────────────────
  { itemCode: '04.FLOOR', itemName: '바닥 방수', unit: 'SQM', materialCost: 18000, laborCost: 27000, totalUnitCost: 45000, source: '2025 액체방수 2회 도포', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 방수공사' },
  { itemCode: '04.WALL', itemName: '벽체 방수', unit: 'SQM', materialCost: 15000, laborCost: 22000, totalUnitCost: 37000, source: '2025 벽체 방수 1.2m 높이', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 방수공사' },
  { itemCode: '04.CURB', itemName: '턱 방수', unit: 'SQM', materialCost: 18000, laborCost: 27000, totalUnitCost: 45000, source: '2025 턱+접합부 방수', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 방수공사' },

  // ───────────────────────────────────────────
  // 05. 타일
  // ───────────────────────────────────────────
  { itemCode: '05.FLOOR', itemName: '바닥 타일', unit: 'SQM', materialCost: 40000, laborCost: 45000, totalUnitCost: 85000, source: '2025 600x600 포세린 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 타일공사' },
  { itemCode: '05.WALL', itemName: '벽 타일', unit: 'SQM', materialCost: 35000, laborCost: 45000, totalUnitCost: 80000, source: '2025 300x600 포세린 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 타일공사' },
  { itemCode: '05.ADHESIVE', itemName: '타일 접착제', unit: 'KG', materialCost: 1200, laborCost: 0, totalUnitCost: 1200, source: '2025 타일 접착제', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '05.GROUT', itemName: '줄눈재', unit: 'KG', materialCost: 4000, laborCost: 0, totalUnitCost: 4000, source: '2025 에폭시 줄눈', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 06. 목공
  // ───────────────────────────────────────────
  { itemCode: '06.CEILING_FRAME', itemName: '우물천장 틀', unit: 'LM', materialCost: 25000, laborCost: 35000, totalUnitCost: 60000, source: '2025 건축목공 노임', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 건축목공 노임' },
  { itemCode: '06.LIGHT_BOX', itemName: '간접조명 박스', unit: 'LM', materialCost: 20000, laborCost: 28000, totalUnitCost: 48000, source: '2025 LED 간접등 박스', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 건축목공 노임' },
  { itemCode: '06.STUD', itemName: '경량 스터드', unit: 'LM', materialCost: 4000, laborCost: 7000, totalUnitCost: 11000, source: '2025 경량철골', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '06.DRYWALL', itemName: '석고보드', unit: 'SQM', materialCost: 10000, laborCost: 16000, totalUnitCost: 26000, source: '2025 석고보드 9.5T 양면', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '06.DOOR_FRAME_SUB', itemName: '문틀 하지', unit: 'EA', materialCost: 20000, laborCost: 35000, totalUnitCost: 55000, source: '2025 문틀 하지 목공', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 건축목공 노임' },

  // ───────────────────────────────────────────
  // 07. 바닥재
  // ───────────────────────────────────────────
  { itemCode: '07.MAIN', itemName: '바닥재', unit: 'SQM', materialCost: 42000, laborCost: 23000, totalUnitCost: 65000, source: '2025 강마루 중급 (동화자연)', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 바닥재' },
  { itemCode: '07.UNDERLAY', itemName: '바닥 하지', unit: 'SQM', materialCost: 10000, laborCost: 8000, totalUnitCost: 18000, source: '2025 합판+방음재', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 08. 도배/페인트
  // ───────────────────────────────────────────
  { itemCode: '08.WALLPAPER', itemName: '벽지', unit: 'SQM', materialCost: 7000, laborCost: 11000, totalUnitCost: 18000, source: '2025 실크벽지 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 도배공사' },
  { itemCode: '08.PRIMER_PAPER', itemName: '초배지', unit: 'SQM', materialCost: 2000, laborCost: 4000, totalUnitCost: 6000, source: '2025 초배지 시공', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 도배공 노임' },
  { itemCode: '08.PAINT', itemName: '페인트', unit: 'SQM', materialCost: 5000, laborCost: 10000, totalUnitCost: 15000, source: '2025 수성페인트 2회 도장', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 도장공사' },
  { itemCode: '08.PRIMER', itemName: '프라이머', unit: 'SQM', materialCost: 2500, laborCost: 4000, totalUnitCost: 6500, source: '2025 하도 프라이머', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 09. 천장
  // ───────────────────────────────────────────
  { itemCode: '09.GYPSUM', itemName: '천장 석고보드', unit: 'SQM', materialCost: 10000, laborCost: 20000, totalUnitCost: 30000, source: '2025 석고보드 9.5T', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '09.PAINT', itemName: '천장 도장', unit: 'SQM', materialCost: 4000, laborCost: 8000, totalUnitCost: 12000, source: '2025 수성페인트 2회', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 도장공사' },
  { itemCode: '09.FRAME', itemName: '천장 경량틀', unit: 'SQM', materialCost: 8000, laborCost: 12000, totalUnitCost: 20000, source: '2025 경량철골 천장틀', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 10. 창호/문
  // ───────────────────────────────────────────
  { itemCode: '10.DOOR_SINGLE_DOOR', itemName: '외여닫이문', unit: 'SET', materialCost: 250000, laborCost: 130000, totalUnitCost: 380000, source: '2025 ABS 방문 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 창호공사' },
  { itemCode: '10.DOOR_SLIDING_DOOR', itemName: '미닫이문', unit: 'SET', materialCost: 320000, laborCost: 150000, totalUnitCost: 470000, source: '2025 슬라이딩 도어 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 창호공사' },
  { itemCode: '10.DOOR_ENTRANCE_DOOR', itemName: '현관문', unit: 'SET', materialCost: 600000, laborCost: 250000, totalUnitCost: 850000, source: '2025 중급 방화문 (도어록 포함)', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 창호공사' },

  // ───────────────────────────────────────────
  // 11. 잡철
  // ───────────────────────────────────────────
  { itemCode: '11.BATH_ACC', itemName: '화장실 악세서리', unit: 'SET', materialCost: 200000, laborCost: 70000, totalUnitCost: 270000, source: '2025 수건걸이/선반/거울/휴지걸이 세트', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '11.CAULKING', itemName: '실리콘 코킹', unit: 'LM', materialCost: 1500, laborCost: 3000, totalUnitCost: 4500, source: '2025 방수 실리콘', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '11.CURTAIN_BOX', itemName: '커튼박스', unit: 'LM', materialCost: 20000, laborCost: 25000, totalUnitCost: 45000, source: '2025 매립형 커튼박스', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 12. 배관
  // ───────────────────────────────────────────
  { itemCode: '12.WATER_POINT', itemName: '급수 포인트', unit: 'EA', materialCost: 40000, laborCost: 110000, totalUnitCost: 150000, source: '2025 배관공 노임 기준', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 배관공 노임' },
  { itemCode: '12.DRAIN_POINT', itemName: '배수 포인트', unit: 'EA', materialCost: 35000, laborCost: 110000, totalUnitCost: 145000, source: '2025 배관공 노임 기준', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 배관공 노임' },
  { itemCode: '12.GAS', itemName: '가스 배관', unit: 'EA', materialCost: 40000, laborCost: 130000, totalUnitCost: 170000, source: '2025 가스 배관 이설', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 배관공 노임' },
  { itemCode: '12.BOILER', itemName: '보일러 설치', unit: 'EA', materialCost: 0, laborCost: 350000, totalUnitCost: 350000, source: '2025 설치비만 (제품 별도)', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 배관공 노임' },
  { itemCode: '12.ONDOL', itemName: '바닥 난방 배관', unit: 'LOT', materialCost: 1000000, laborCost: 1000000, totalUnitCost: 2000000, source: '2025 25평 기준 XL파이프', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 설비공사' },

  // ───────────────────────────────────────────
  // 13. 위생도기
  // ───────────────────────────────────────────
  { itemCode: '13.TOILET', itemName: '양변기', unit: 'EA', materialCost: 320000, laborCost: 130000, totalUnitCost: 450000, source: '2025 TOTO/대림 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },
  { itemCode: '13.BASIN_CABINET', itemName: '세면대(하부장)', unit: 'EA', materialCost: 400000, laborCost: 120000, totalUnitCost: 520000, source: '2025 하부장 세트 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },
  { itemCode: '13.BASIN', itemName: '세면대', unit: 'EA', materialCost: 200000, laborCost: 80000, totalUnitCost: 280000, source: '2025 벽걸이 세면대', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },
  { itemCode: '13.SHOWER_BOOTH', itemName: '샤워부스', unit: 'EA', materialCost: 500000, laborCost: 250000, totalUnitCost: 750000, source: '2025 강화유리 파티션 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },
  { itemCode: '13.BATHTUB', itemName: '욕조', unit: 'EA', materialCost: 600000, laborCost: 250000, totalUnitCost: 850000, source: '2025 FRP 욕조 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },
  { itemCode: '13.BIDET', itemName: '비데', unit: 'EA', materialCost: 350000, laborCost: 70000, totalUnitCost: 420000, source: '2025 전자식 비데 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 위생도기' },

  // ───────────────────────────────────────────
  // 14. 전기
  // ───────────────────────────────────────────
  { itemCode: '14.LIGHT', itemName: '조명 포인트', unit: 'EA', materialCost: 25000, laborCost: 45000, totalUnitCost: 70000, source: '2025 LED 매입등+시공', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 전기공 노임' },
  { itemCode: '14.OUTLET', itemName: '콘센트', unit: 'EA', materialCost: 12000, laborCost: 35000, totalUnitCost: 47000, source: '2025 2구 콘센트 교체', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 전기공 노임' },
  { itemCode: '14.SWITCH', itemName: '스위치', unit: 'EA', materialCost: 8000, laborCost: 28000, totalUnitCost: 36000, source: '2025 3로 스위치 교체', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '대한건설협회 2025 전기공 노임' },
  { itemCode: '14.PANEL', itemName: '분전반', unit: 'EA', materialCost: 200000, laborCost: 150000, totalUnitCost: 350000, source: '2025 24회로 분전반', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 전기공사' },
  { itemCode: '14.INTERCOM', itemName: '인터폰', unit: 'EA', materialCost: 120000, laborCost: 70000, totalUnitCost: 190000, source: '2025 비디오 인터폰', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 전기공사' },

  // ───────────────────────────────────────────
  // 15. 고정설비
  // ───────────────────────────────────────────
  { itemCode: '15.KITCHEN_SINK', itemName: '주방 싱크대', unit: 'EA', materialCost: 300000, laborCost: 100000, totalUnitCost: 400000, source: '2025 인조대리석 싱크 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '15.KITCHEN_UPPER_CABINET', itemName: '주방 상부장', unit: 'LM', materialCost: 320000, laborCost: 130000, totalUnitCost: 450000, source: '2025 래핑 도어 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 가구공사' },
  { itemCode: '15.KITCHEN_LOWER_CABINET', itemName: '주방 하부장', unit: 'LM', materialCost: 430000, laborCost: 170000, totalUnitCost: 600000, source: '2025 래핑 도어 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 가구공사' },
  { itemCode: '15.KITCHEN_COUNTER', itemName: '주방 상판', unit: 'LM', materialCost: 280000, laborCost: 70000, totalUnitCost: 350000, source: '2025 엔지니어드 스톤', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 가구공사' },
  { itemCode: '15.RANGE_HOOD', itemName: '레인지후드', unit: 'EA', materialCost: 280000, laborCost: 70000, totalUnitCost: 350000, source: '2025 빌트인 후드 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '15.SHOE_CABINET', itemName: '신발장', unit: 'LM', materialCost: 380000, laborCost: 120000, totalUnitCost: 500000, source: '2025 빌트인 신발장', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 가구공사' },
  { itemCode: '15.WARDROBE', itemName: '붙박이장', unit: 'LM', materialCost: 500000, laborCost: 150000, totalUnitCost: 650000, source: '2025 빌트인 수납장', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02 가구공사' },
  { itemCode: '15.AC', itemName: '에어컨 설치', unit: 'EA', materialCost: 0, laborCost: 200000, totalUnitCost: 200000, source: '2025 설치비만 (제품별도)', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '15.GAS_RANGE', itemName: '가스레인지', unit: 'EA', materialCost: 350000, laborCost: 70000, totalUnitCost: 420000, source: '2025 3구 가스레인지 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '15.INDUCTION', itemName: '인덕션', unit: 'EA', materialCost: 500000, laborCost: 70000, totalUnitCost: 570000, source: '2025 3구 인덕션 중급', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 16. 걸레받이/몰딩
  // ───────────────────────────────────────────
  { itemCode: '16.BASEBOARD', itemName: '걸레받이', unit: 'LM', materialCost: 3500, laborCost: 3500, totalUnitCost: 7000, source: '2025 PVC/MDF필름 걸레받이 80mm', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '16.CROWN', itemName: '크라운 몰딩', unit: 'LM', materialCost: 4000, laborCost: 4000, totalUnitCost: 8000, source: '2025 PS/PU 크라운 몰딩', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },

  // ───────────────────────────────────────────
  // 17. 정리
  // ───────────────────────────────────────────
  { itemCode: '17.FINAL_CLEAN', itemName: '준공 청소', unit: 'SQM', materialCost: 0, laborCost: 4000, totalUnitCost: 4000, source: '2025 입주 청소', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
  { itemCode: '17.PROTECT', itemName: '양생/보양', unit: 'LOT', materialCost: 150000, laborCost: 150000, totalUnitCost: 300000, source: '2025 공용부+엘리베이터 보양', updatedAt: '2025-03', priceGrade: 'standard', priceReference: '물가협회 2025-02' },
];

/** itemCode로 단가 조회 (부분 매칭 지원) */
export function findUnitPrice(itemCode: string): UnitPrice | undefined {
  const exact = DEFAULT_UNIT_PRICES.find(p => p.itemCode === itemCode);
  if (exact) return exact;

  // 부분 매칭: '10.DOOR_SINGLE_DOOR_900x2100' → '10.DOOR_SINGLE_DOOR'
  const baseCode = itemCode.replace(/_\d+x\d+$/, '');
  return DEFAULT_UNIT_PRICES.find(p => p.itemCode === baseCode);
}
