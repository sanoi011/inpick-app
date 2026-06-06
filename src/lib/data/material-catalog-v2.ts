/**
 * 자재 카탈로그 v2 - 19개 카테고리, ~65개 제품
 * 가격 기준: 물가협회 2025 + 제조사 소비자가
 * 실제 한국 브랜드 기반
 */

import type { SubMaterial } from "@/types/consumer-project";

export interface MaterialProduct {
  id: string;
  brand: string;
  productName: string;
  spec: string;
  unitPrice: number;     // 자재 단가 (원/단위)
  laborPrice: number;    // 시공비 (원/단위)
  unit: string;
  priceGrade: "economy" | "standard" | "premium";
  priceSource: string;
  colorHex?: string;
  tags: string[];
  subItems: SubMaterial[];
}

export interface MaterialCategory {
  code: string;
  nameKr: string;
  icon: string;          // lucide-react icon name
  applicableRooms: string[];
  products: MaterialProduct[];
}

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  // ── 1. 바닥재 ──
  {
    code: "FLOORING",
    nameKr: "바닥재",
    icon: "Layers",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "DRESSROOM", "CORRIDOR"],
    products: [
      {
        id: "floor-1",
        brand: "한화 L&C",
        productName: "모노륨 SPC 마루",
        spec: "1220×183×5.5mm, UV코팅, 방수",
        unitPrice: 28000,
        laborPrice: 8000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#C4A882",
        tags: ["방수", "친환경"],
        subItems: [
          { name: "바닥 밑작업", specification: "레벨링", unitPrice: 8000, unit: "m²" },
          { name: "걸레받이", specification: "PVC 60mm", unitPrice: 3000, unit: "m" },
        ],
      },
      {
        id: "floor-2",
        brand: "동화자연마루",
        productName: "감탄마루 강화",
        spec: "1220×183×12mm, 오크, HDF",
        unitPrice: 38000,
        laborPrice: 10000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#B8926A",
        tags: ["친환경", "항균"],
        subItems: [
          { name: "바닥 밑작업", specification: "레벨링", unitPrice: 8000, unit: "m²" },
          { name: "걸레받이", specification: "MDF 80mm", unitPrice: 5000, unit: "m" },
        ],
      },
      {
        id: "floor-3",
        brand: "LG하우시스",
        productName: "지아소리잠",
        spec: "1220×183×9.5mm, 흡음층, 원목무늬",
        unitPrice: 45000,
        laborPrice: 10000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#A0835E",
        tags: ["방음", "친환경"],
        subItems: [
          { name: "바닥 밑작업", specification: "합판깔기", unitPrice: 12000, unit: "m²" },
          { name: "걸레받이", specification: "MDF 80mm", unitPrice: 5000, unit: "m" },
        ],
      },
      {
        id: "floor-4",
        brand: "동화자연마루",
        productName: "프리미엄 원목마루",
        spec: "1820×150×15mm, 월넛 원목",
        unitPrice: 85000,
        laborPrice: 15000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        colorHex: "#6B4E37",
        tags: ["원목", "프리미엄"],
        subItems: [
          { name: "바닥 밑작업", specification: "합판깔기", unitPrice: 15000, unit: "m²" },
          { name: "걸레받이", specification: "원목 100mm", unitPrice: 8000, unit: "m" },
        ],
      },
    ],
  },

  // ── 2. 도배 ──
  {
    code: "WALLPAPER",
    nameKr: "도배",
    icon: "PaintBucket",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "CORRIDOR", "DRESSROOM"],
    products: [
      {
        id: "wall-1",
        brand: "LG하우시스",
        productName: "디아망 실크벽지",
        spec: "106cm 폭, 친환경 잉크, 무지",
        unitPrice: 12000,
        laborPrice: 6000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#F5F0E8",
        tags: ["친환경"],
        subItems: [
          { name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" },
        ],
      },
      {
        id: "wall-2",
        brand: "신한벽지",
        productName: "포레스트 합포벽지",
        spec: "106cm 폭, 포인트 패턴, 엠보싱",
        unitPrice: 20000,
        laborPrice: 7000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#E8E0D4",
        tags: ["포인트", "디자인"],
        subItems: [
          { name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" },
        ],
      },
      {
        id: "wall-3",
        brand: "Cole & Son",
        productName: "수입 프리미엄 벽지",
        spec: "52cm 폭, 영국 수입, 패턴",
        unitPrice: 45000,
        laborPrice: 10000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        colorHex: "#D4C5B0",
        tags: ["수입", "프리미엄"],
        subItems: [
          { name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" },
          { name: "본드", specification: "수입벽지 전용", unitPrice: 2000, unit: "m²" },
        ],
      },
    ],
  },

  // ── 3. 페인트 ──
  {
    code: "PAINT",
    nameKr: "페인트",
    icon: "Droplets",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "KITCHEN", "BATHROOM", "CORRIDOR", "ENTRANCE"],
    products: [
      {
        id: "paint-1",
        brand: "KCC",
        productName: "숲으로 수성페인트",
        spec: "18L, 무광, 친환경 1등급",
        unitPrice: 8500,
        laborPrice: 5000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#FAFAF8",
        tags: ["친환경", "무광"],
        subItems: [
          { name: "퍼티 작업", specification: "2회", unitPrice: 5000, unit: "m²" },
        ],
      },
      {
        id: "paint-2",
        brand: "노루페인트",
        productName: "팬톤 프리미엄",
        spec: "4L, 반광, 500색 조색 가능",
        unitPrice: 15000,
        laborPrice: 6000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        colorHex: "#F0EDE6",
        tags: ["조색", "항균"],
        subItems: [
          { name: "퍼티 작업", specification: "2회", unitPrice: 5000, unit: "m²" },
        ],
      },
      {
        id: "paint-3",
        brand: "벤자민무어",
        productName: "Regal Select 매트",
        spec: "3.78L, 매트, 미국 수입",
        unitPrice: 32000,
        laborPrice: 8000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        colorHex: "#E8E4DC",
        tags: ["수입", "프리미엄"],
        subItems: [
          { name: "퍼티 작업", specification: "3회 정밀", unitPrice: 8000, unit: "m²" },
        ],
      },
    ],
  },

  // ── 4. 천장재 ──
  {
    code: "CEILING",
    nameKr: "천장재",
    icon: "ArrowUpFromLine",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "KITCHEN", "CORRIDOR"],
    products: [
      {
        id: "ceil-1",
        brand: "KCC",
        productName: "도장 마감",
        spec: "수성페인트 2회 도장",
        unitPrice: 8000,
        laborPrice: 6000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: [],
        subItems: [],
      },
      {
        id: "ceil-2",
        brand: "대한석고",
        productName: "우물천장 (석고보드+몰딩)",
        spec: "9.5mm 석고보드, PU몰딩 120mm",
        unitPrice: 35000,
        laborPrice: 20000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        tags: ["디자인"],
        subItems: [
          { name: "석고보드", specification: "9.5mm", unitPrice: 5000, unit: "m²" },
          { name: "크라운 몰딩", specification: "PU 120mm", unitPrice: 12000, unit: "m" },
        ],
      },
      {
        id: "ceil-3",
        brand: "필립스",
        productName: "간접조명 포함 천장",
        spec: "LED 스트립 + 알루미늄 몰딩",
        unitPrice: 55000,
        laborPrice: 25000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        tags: ["간접조명", "LED"],
        subItems: [
          { name: "석고보드", specification: "9.5mm", unitPrice: 5000, unit: "m²" },
          { name: "LED 스트립", specification: "SMD 5050 24V", unitPrice: 8000, unit: "m" },
          { name: "알루미늄 몰딩", specification: "매입형", unitPrice: 15000, unit: "m" },
        ],
      },
    ],
  },

  // ── 5. 방문 (문짝+문틀+문선) ──
  {
    code: "DOOR_ROOM",
    nameKr: "방문",
    icon: "DoorOpen",
    applicableRooms: ["BED", "MASTER_BED", "BATHROOM", "DRESSROOM"],
    products: [
      {
        id: "door-1",
        brand: "경남도어",
        productName: "ABS 방문 세트",
        spec: "900×2100mm, ABS 엣지, 화이트",
        unitPrice: 180000,
        laborPrice: 50000,
        unit: "SET",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#FFFFFF",
        tags: [],
        subItems: [
          { name: "문짝", specification: "ABS 플래시", unitPrice: 95000, unit: "EA" },
          { name: "문틀", specification: "ABS 갈바", unitPrice: 55000, unit: "EA" },
          { name: "문선", specification: "ABS 60mm", unitPrice: 30000, unit: "SET" },
        ],
      },
      {
        id: "door-2",
        brand: "영림도어",
        productName: "원목무늬 도어 세트",
        spec: "900×2100mm, 올리브 오크",
        unitPrice: 280000,
        laborPrice: 60000,
        unit: "SET",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        colorHex: "#C4A77D",
        tags: ["원목무늬"],
        subItems: [
          { name: "문짝", specification: "원목무늬 시트", unitPrice: 150000, unit: "EA" },
          { name: "문틀", specification: "원목무늬 갈바", unitPrice: 80000, unit: "EA" },
          { name: "문선", specification: "원목무늬 70mm", unitPrice: 50000, unit: "SET" },
        ],
      },
      {
        id: "door-3",
        brand: "한솔도어",
        productName: "호마이카 도어 세트",
        spec: "900×2100mm, 고광택 호마이카",
        unitPrice: 450000,
        laborPrice: 70000,
        unit: "SET",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        colorHex: "#8B7355",
        tags: ["프리미엄", "고광택"],
        subItems: [
          { name: "문짝", specification: "호마이카 무늬목", unitPrice: 250000, unit: "EA" },
          { name: "문틀", specification: "호마이카 갈바", unitPrice: 120000, unit: "EA" },
          { name: "문선", specification: "호마이카 80mm", unitPrice: 80000, unit: "SET" },
        ],
      },
    ],
  },

  // ── 6. 중문 ──
  {
    code: "SLIDING_PARTITION",
    nameKr: "중문",
    icon: "PanelLeftOpen",
    applicableRooms: ["LIVING", "ENTRANCE"],
    products: [
      {
        id: "mid-1",
        brand: "에넥스",
        productName: "3연동 슬라이딩 중문",
        spec: "2400×2300mm, 강화유리 5mm, 알루미늄",
        unitPrice: 350000,
        laborPrice: 100000,
        unit: "SET",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["3연동"],
        subItems: [
          { name: "레일", specification: "알루미늄 상하", unitPrice: 40000, unit: "SET" },
        ],
      },
      {
        id: "mid-2",
        brand: "한샘",
        productName: "4연동 슬라이딩 중문",
        spec: "3200×2300mm, 강화유리 5mm, 블랙 프레임",
        unitPrice: 550000,
        laborPrice: 120000,
        unit: "SET",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["4연동", "블랙"],
        subItems: [
          { name: "레일", specification: "소프트 클로징", unitPrice: 60000, unit: "SET" },
        ],
      },
      {
        id: "mid-3",
        brand: "한샘",
        productName: "시스템 프리미엄 중문",
        spec: "3600×2400mm, Low-E유리, 슬림 프레임",
        unitPrice: 850000,
        laborPrice: 150000,
        unit: "SET",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        tags: ["시스템", "프리미엄"],
        subItems: [
          { name: "레일", specification: "매립형 소프트", unitPrice: 80000, unit: "SET" },
        ],
      },
    ],
  },

  // ── 7. 현관문 ──
  {
    code: "ENTRY_DOOR",
    nameKr: "현관문",
    icon: "KeyRound",
    applicableRooms: ["ENTRANCE"],
    products: [
      {
        id: "entry-1",
        brand: "금강도어",
        productName: "갑종 방화문",
        spec: "900×2100mm, 60분 내화, 번호키",
        unitPrice: 350000,
        laborPrice: 80000,
        unit: "SET",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["방화"],
        subItems: [],
      },
      {
        id: "entry-2",
        brand: "현대L&C",
        productName: "방화문 + 디지털도어락",
        spec: "900×2100mm, 지문+번호, 원목무늬",
        unitPrice: 650000,
        laborPrice: 100000,
        unit: "SET",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["디지털락", "방화"],
        subItems: [
          { name: "디지털도어락", specification: "지문+번호+카드", unitPrice: 250000, unit: "EA" },
        ],
      },
      {
        id: "entry-3",
        brand: "삼성SDS",
        productName: "스마트 현관문 세트",
        spec: "1000×2100mm, IoT 연동, 자동잠금",
        unitPrice: 1200000,
        laborPrice: 150000,
        unit: "SET",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        tags: ["IoT", "스마트"],
        subItems: [
          { name: "디지털도어락", specification: "삼성 SHP-DP960", unitPrice: 500000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 8. 걸레받이/몰딩 ──
  {
    code: "BASEBOARD",
    nameKr: "걸레받이/몰딩",
    icon: "Minus",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "CORRIDOR", "DRESSROOM"],
    products: [
      {
        id: "base-1",
        brand: "일반",
        productName: "PVC 걸레받이",
        spec: "60mm, 화이트, 접착식",
        unitPrice: 3000,
        laborPrice: 2000,
        unit: "m",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#FFFFFF",
        tags: [],
        subItems: [],
      },
      {
        id: "base-2",
        brand: "동화자연마루",
        productName: "MDF 걸레받이",
        spec: "80mm, 마루 동색 코디, 피스 시공",
        unitPrice: 5000,
        laborPrice: 3000,
        unit: "m",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#B8926A",
        tags: ["마루 매칭"],
        subItems: [],
      },
      {
        id: "base-3",
        brand: "수입",
        productName: "알루미늄 걸레받이",
        spec: "100mm, 매립형, 실버",
        unitPrice: 12000,
        laborPrice: 5000,
        unit: "m",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        colorHex: "#C0C0C0",
        tags: ["모던", "매립형"],
        subItems: [],
      },
    ],
  },

  // ── 9. 조명 ──
  {
    code: "LIGHTING",
    nameKr: "조명",
    icon: "Lightbulb",
    applicableRooms: ["LIVING", "BED", "MASTER_BED", "KITCHEN", "BATHROOM", "CORRIDOR", "ENTRANCE"],
    products: [
      {
        id: "light-1",
        brand: "KDL",
        productName: "LED 평판등",
        spec: "600×600mm, 40W, 주백색",
        unitPrice: 35000,
        laborPrice: 15000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["LED"],
        subItems: [],
      },
      {
        id: "light-2",
        brand: "삼성전자",
        productName: "LED 다운라이트 6인치",
        spec: "Ø150mm, 15W, 매입형, 조색변환",
        unitPrice: 55000,
        laborPrice: 20000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["매입", "조색변환"],
        subItems: [],
      },
      {
        id: "light-3",
        brand: "필립스",
        productName: "LED 간접조명 스트립",
        spec: "SMD 5050, 24V, 14.4W/m, 3000K",
        unitPrice: 15000,
        laborPrice: 8000,
        unit: "m",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["간접조명", "LED"],
        subItems: [
          { name: "전원 드라이버", specification: "24V 100W", unitPrice: 25000, unit: "EA" },
          { name: "알루미늄 프로파일", specification: "매입형", unitPrice: 5000, unit: "m" },
        ],
      },
      {
        id: "light-4",
        brand: "필립스",
        productName: "Hue 스마트 조명 세트",
        spec: "E26, 9W, 1600만색, 앱 제어",
        unitPrice: 89000,
        laborPrice: 15000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        tags: ["스마트홈", "IoT"],
        subItems: [
          { name: "Hue 브릿지", specification: "ZigBee", unitPrice: 65000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 10. 창호 ──
  {
    code: "WINDOW",
    nameKr: "창호",
    icon: "SquareDashed",
    applicableRooms: ["LIVING", "BED", "MASTER_BED"],
    products: [
      {
        id: "win-1",
        brand: "KCC",
        productName: "이중창 24mm",
        spec: "PVC 프레임, 복층유리 16mm",
        unitPrice: 250000,
        laborPrice: 50000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["단열"],
        subItems: [
          { name: "실리콘", specification: "방수형", unitPrice: 2000, unit: "m" },
        ],
      },
      {
        id: "win-2",
        brand: "LG하우시스",
        productName: "수퍼세이브 시스템창",
        spec: "PVC 5챔버, 아르곤 삼중유리 42mm",
        unitPrice: 450000,
        laborPrice: 80000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["3중유리", "고단열"],
        subItems: [
          { name: "실리콘", specification: "방수형", unitPrice: 2000, unit: "m" },
        ],
      },
      {
        id: "win-3",
        brand: "슈코",
        productName: "시스템 창호 AWS",
        spec: "알루미늄, Low-E 삼중유리, 독일 수입",
        unitPrice: 800000,
        laborPrice: 120000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["수입", "시스템"],
        subItems: [
          { name: "실리콘", specification: "구조용", unitPrice: 3000, unit: "m" },
        ],
      },
    ],
  },

  // ── 11. 양변기 ──
  {
    code: "TOILET",
    nameKr: "양변기",
    icon: "Bath",
    applicableRooms: ["BATHROOM"],
    products: [
      {
        id: "toilet-1",
        brand: "대림바스",
        productName: "CC-750 투피스",
        spec: "S트랩 300mm, 절수형 4.8L",
        unitPrice: 150000,
        laborPrice: 50000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#FFFFFF",
        tags: ["절수"],
        subItems: [
          { name: "부속품", specification: "급수관+앵글밸브", unitPrice: 15000, unit: "SET" },
        ],
      },
      {
        id: "toilet-2",
        brand: "아메리칸스탠다드",
        productName: "액티바 원피스",
        spec: "S트랩 300mm, 듀얼플러시, 항균",
        unitPrice: 350000,
        laborPrice: 60000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        colorHex: "#FFFFFF",
        tags: ["원피스", "항균"],
        subItems: [
          { name: "부속품", specification: "급수관+앵글밸브", unitPrice: 15000, unit: "SET" },
        ],
      },
      {
        id: "toilet-3",
        brand: "토토",
        productName: "네오레스트 비데일체형",
        spec: "자동 개폐, 온수세정, 건조, 탈취",
        unitPrice: 850000,
        laborPrice: 80000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "제조사 소비자가",
        colorHex: "#FFFFFF",
        tags: ["비데일체형", "자동"],
        subItems: [
          { name: "전기 배선", specification: "전용 콘센트", unitPrice: 30000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 12. 세면대 ──
  {
    code: "VANITY",
    nameKr: "세면대",
    icon: "Droplet",
    applicableRooms: ["BATHROOM"],
    products: [
      {
        id: "vanity-1",
        brand: "대림바스",
        productName: "카운터형 세면대",
        spec: "600mm, 도기 세면기+하부장",
        unitPrice: 180000,
        laborPrice: 50000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: [],
        subItems: [
          { name: "세면수전", specification: "싱글레버", unitPrice: 45000, unit: "EA" },
        ],
      },
      {
        id: "vanity-2",
        brand: "이누스",
        productName: "슬림 카운터형 세면대",
        spec: "800mm, 인조대리석 상판+하부장",
        unitPrice: 380000,
        laborPrice: 60000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["슬림", "인조대리석"],
        subItems: [
          { name: "세면수전", specification: "원홀 수전", unitPrice: 80000, unit: "EA" },
        ],
      },
      {
        id: "vanity-3",
        brand: "듀라빗",
        productName: "벽걸이형 세면대",
        spec: "1000mm, 세라믹 세면기, 독일 수입",
        unitPrice: 650000,
        laborPrice: 80000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["수입", "벽걸이"],
        subItems: [
          { name: "세면수전", specification: "벽부형 수전", unitPrice: 180000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 13. 샤워부스/욕조 ──
  {
    code: "SHOWER_BATH",
    nameKr: "샤워부스/욕조",
    icon: "ShowerHead",
    applicableRooms: ["BATHROOM"],
    products: [
      {
        id: "shower-1",
        brand: "대림바스",
        productName: "코너형 샤워부스",
        spec: "900×900mm, 강화유리 8mm",
        unitPrice: 250000,
        laborPrice: 80000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["코너형"],
        subItems: [],
      },
      {
        id: "shower-2",
        brand: "대림바스",
        productName: "슬라이딩 샤워부스",
        spec: "1200×900mm, 강화유리 10mm, 논프레임",
        unitPrice: 450000,
        laborPrice: 100000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["논프레임", "슬라이딩"],
        subItems: [],
      },
      {
        id: "shower-3",
        brand: "칼데바이",
        productName: "욕조 + 샤워 세트",
        spec: "1500×700mm, 강화 아크릴, 독일 수입",
        unitPrice: 800000,
        laborPrice: 120000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["욕조", "수입"],
        subItems: [
          { name: "샤워 수전", specification: "레인샤워 세트", unitPrice: 150000, unit: "SET" },
        ],
      },
    ],
  },

  // ── 14. 욕실수전 ──
  {
    code: "BATH_FAUCET",
    nameKr: "욕실수전",
    icon: "Waves",
    applicableRooms: ["BATHROOM"],
    products: [
      {
        id: "bfaucet-1",
        brand: "대림바스",
        productName: "세면+샤워 수전 세트",
        spec: "싱글레버, 크롬, 국산",
        unitPrice: 120000,
        laborPrice: 30000,
        unit: "SET",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: [],
        subItems: [],
      },
      {
        id: "bfaucet-2",
        brand: "한스그로에",
        productName: "Focus 세면+샤워 세트",
        spec: "에코 스마트, 크롬, 독일",
        unitPrice: 350000,
        laborPrice: 40000,
        unit: "SET",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["절수", "수입"],
        subItems: [],
      },
      {
        id: "bfaucet-3",
        brand: "그로에",
        productName: "Essence 세면+레인샤워 세트",
        spec: "써모스탯, 크롬, 독일",
        unitPrice: 650000,
        laborPrice: 50000,
        unit: "SET",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["써모스탯", "레인샤워"],
        subItems: [],
      },
    ],
  },

  // ── 15. 욕실타일 ──
  {
    code: "BATH_TILE",
    nameKr: "욕실타일",
    icon: "Grid3x3",
    applicableRooms: ["BATHROOM"],
    products: [
      {
        id: "btile-1",
        brand: "한일타일",
        productName: "자기질 200×200 논슬립",
        spec: "논슬립 바닥 + 200×400 벽타일",
        unitPrice: 25000,
        laborPrice: 20000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#D4D0C8",
        tags: ["논슬립"],
        subItems: [
          { name: "방수 시공", specification: "우레탄 2중", unitPrice: 25000, unit: "m²" },
          { name: "타일 접착제", specification: "방수형", unitPrice: 6000, unit: "m²" },
        ],
      },
      {
        id: "btile-2",
        brand: "동서",
        productName: "포세린 300×600 유광",
        spec: "벽+바닥 겸용, 이탈리아 디자인",
        unitPrice: 45000,
        laborPrice: 25000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#E8E4DC",
        tags: ["포세린"],
        subItems: [
          { name: "방수 시공", specification: "우레탄 2중", unitPrice: 25000, unit: "m²" },
          { name: "타일 접착제", specification: "방수형", unitPrice: 6000, unit: "m²" },
        ],
      },
      {
        id: "btile-3",
        brand: "수입",
        productName: "대리석 600×600",
        spec: "천연 대리석, 비앙코 카라라",
        unitPrice: 90000,
        laborPrice: 35000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        colorHex: "#F0ECE3",
        tags: ["천연대리석", "수입"],
        subItems: [
          { name: "방수 시공", specification: "우레탄 3중", unitPrice: 30000, unit: "m²" },
          { name: "대리석 접착제", specification: "전용 본드", unitPrice: 8000, unit: "m²" },
        ],
      },
    ],
  },

  // ── 16. 싱크대 ──
  {
    code: "KITCHEN_SINK",
    nameKr: "싱크대",
    icon: "CookingPot",
    applicableRooms: ["KITCHEN"],
    products: [
      {
        id: "ksink-1",
        brand: "한샘",
        productName: "스테인리스 언더마운트",
        spec: "780×430mm, SUS304, 2볼",
        unitPrice: 150000,
        laborPrice: 40000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: ["스테인리스"],
        subItems: [
          { name: "싱크 수전", specification: "핸드스프레이", unitPrice: 60000, unit: "EA" },
        ],
      },
      {
        id: "ksink-2",
        brand: "한샘",
        productName: "인조대리석 싱크볼",
        spec: "850×500mm, 언더마운트, 화이트",
        unitPrice: 350000,
        laborPrice: 50000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["인조대리석"],
        subItems: [
          { name: "싱크 수전", specification: "터치리스", unitPrice: 120000, unit: "EA" },
        ],
      },
      {
        id: "ksink-3",
        brand: "블랑코",
        productName: "그라니트 싱크 SILGRANIT",
        spec: "860×500mm, 독일 수입, 앤트라싯",
        unitPrice: 650000,
        laborPrice: 60000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        colorHex: "#3A3A3A",
        tags: ["수입", "그라니트"],
        subItems: [
          { name: "싱크 수전", specification: "블랑코 풀다운", unitPrice: 250000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 17. 주방가구 ──
  {
    code: "KITCHEN_CABINET",
    nameKr: "주방가구",
    icon: "ChefHat",
    applicableRooms: ["KITCHEN"],
    products: [
      {
        id: "kcab-1",
        brand: "한샘",
        productName: "리체 씽크대 세트",
        spec: "하부장 3m + 상부장 3m, PET 도어",
        unitPrice: 2500000,
        laborPrice: 400000,
        unit: "LOT",
        priceGrade: "economy",
        priceSource: "제조사 소비자가",
        tags: [],
        subItems: [
          { name: "상판", specification: "인조대리석 15mm", unitPrice: 300000, unit: "LOT" },
          { name: "레인지후드", specification: "슬림형", unitPrice: 200000, unit: "EA" },
        ],
      },
      {
        id: "kcab-2",
        brand: "한샘",
        productName: "키친바흐 세트",
        spec: "하부장 3.5m + 상부장 3.5m, 래커 도어",
        unitPrice: 4500000,
        laborPrice: 500000,
        unit: "LOT",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["래커"],
        subItems: [
          { name: "상판", specification: "엔지니어드스톤 20mm", unitPrice: 500000, unit: "LOT" },
          { name: "레인지후드", specification: "T형 스테인리스", unitPrice: 400000, unit: "EA" },
        ],
      },
      {
        id: "kcab-3",
        brand: "시에마틱",
        productName: "프리미엄 키친 세트",
        spec: "하부장 4m + 상부장 4m, 독일 수입",
        unitPrice: 8000000,
        laborPrice: 800000,
        unit: "LOT",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["수입", "프리미엄"],
        subItems: [
          { name: "상판", specification: "천연석 세자르스톤 30mm", unitPrice: 800000, unit: "LOT" },
          { name: "레인지후드", specification: "매입형 천장", unitPrice: 700000, unit: "EA" },
        ],
      },
    ],
  },

  // ── 18. 주방수전 ──
  {
    code: "KITCHEN_FAUCET",
    nameKr: "주방수전",
    icon: "GlassWater",
    applicableRooms: ["KITCHEN"],
    products: [
      {
        id: "kfaucet-1",
        brand: "대림바스",
        productName: "싱글레버 주방수전",
        spec: "벽부형, 크롬, 국산",
        unitPrice: 80000,
        laborPrice: 20000,
        unit: "EA",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        tags: [],
        subItems: [],
      },
      {
        id: "kfaucet-2",
        brand: "한스그로에",
        productName: "M71 풀아웃 수전",
        spec: "싱크장착형, 핸드스프레이, 독일",
        unitPrice: 250000,
        laborPrice: 25000,
        unit: "EA",
        priceGrade: "standard",
        priceSource: "제조사 소비자가",
        tags: ["풀아웃", "수입"],
        subItems: [],
      },
      {
        id: "kfaucet-3",
        brand: "그로에",
        productName: "Minta Touch 터치수전",
        spec: "터치 ON/OFF, C스파우트, 독일",
        unitPrice: 450000,
        laborPrice: 30000,
        unit: "EA",
        priceGrade: "premium",
        priceSource: "수입 대리점가",
        tags: ["터치", "프리미엄"],
        subItems: [],
      },
    ],
  },

  // ── 19. 주방타일 ──
  {
    code: "KITCHEN_TILE",
    nameKr: "주방타일",
    icon: "LayoutGrid",
    applicableRooms: ["KITCHEN"],
    products: [
      {
        id: "ktile-1",
        brand: "한일타일",
        productName: "서브웨이 타일",
        spec: "75×150mm, 화이트, 유광",
        unitPrice: 25000,
        laborPrice: 15000,
        unit: "m²",
        priceGrade: "economy",
        priceSource: "물가협회 2025",
        colorHex: "#FFFFFF",
        tags: ["서브웨이"],
        subItems: [
          { name: "타일 접착제", specification: "일반", unitPrice: 5000, unit: "m²" },
        ],
      },
      {
        id: "ktile-2",
        brand: "동서",
        productName: "포세린 300×600 패턴",
        spec: "벽면용, 이탈리아 디자인",
        unitPrice: 45000,
        laborPrice: 20000,
        unit: "m²",
        priceGrade: "standard",
        priceSource: "물가협회 2025",
        colorHex: "#E0D8CC",
        tags: ["포세린", "패턴"],
        subItems: [
          { name: "타일 접착제", specification: "일반", unitPrice: 5000, unit: "m²" },
        ],
      },
      {
        id: "ktile-3",
        brand: "일반",
        productName: "강화유리 백스플래시",
        spec: "5mm, 투명/컬러, 주문제작",
        unitPrice: 55000,
        laborPrice: 25000,
        unit: "m²",
        priceGrade: "premium",
        priceSource: "물가협회 2025",
        tags: ["강화유리"],
        subItems: [
          { name: "실리콘", specification: "방수형", unitPrice: 2000, unit: "m" },
        ],
      },
    ],
  },
];

// 전체 카테고리 목록
export function getAllCategories(): MaterialCategory[] {
  return MATERIAL_CATEGORIES;
}

// 특정 공간에 적용 가능한 카테고리 필터
export function getCategoriesForRoom(roomType: string): MaterialCategory[] {
  return MATERIAL_CATEGORIES.filter(
    (cat) => cat.applicableRooms.length === 0 || cat.applicableRooms.includes(roomType)
  );
}

// 제품 ID로 찾기
export function getProductById(productId: string): { category: MaterialCategory; product: MaterialProduct } | null {
  for (const cat of MATERIAL_CATEGORIES) {
    const product = cat.products.find((p) => p.id === productId);
    if (product) return { category: cat, product };
  }
  return null;
}

// 로컬 카탈로그 검색 (DB 폴백용)
export function searchProducts(query: string): { category: MaterialCategory; product: MaterialProduct }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { category: MaterialCategory; product: MaterialProduct }[] = [];
  for (const cat of MATERIAL_CATEGORIES) {
    for (const p of cat.products) {
      if (
        p.brand.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q) ||
        cat.nameKr.includes(q) ||
        p.tags.some((t) => t.includes(q))
      ) {
        results.push({ category: cat, product: p });
      }
    }
  }
  return results.slice(0, 20);
}
