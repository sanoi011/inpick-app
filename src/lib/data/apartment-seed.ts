/**
 * 알려진 아파트 단지 시드 데이터
 * 실제 건축도면을 보유한 아파트 단지 정보를 내장하여
 * 주소 검색 시 정확한 동/호/평형 매칭 제공
 */

export interface KnownUnitType {
  typeName: string;           // 59A, 84A, 84B
  areaSqm: number;            // 전용면적
  supplyAreaSqm: number;      // 공급면적
  roomCount: number;
  bathroomCount: number;
  sampleId: string;           // sample-59, sample-84a, sample-84b
  /** 동별 배치 층수 (예: { "101동": [3,7,11,...] }) */
  dongFloors: Record<string, number[]>;
  /** 한 층에서 해당 타입의 라인 번호 (호수 결정용) */
  lineNum: number;            // 1, 2, 3 → x01호, x02호, x03호
}

export interface KnownApartment {
  complexName: string;
  address: string;
  region: string;
  dongCount: number;
  householdCount: number;
  completionYear: number;
  developer: string;
  constructor: string;
  totalFloor: number;
  types: KnownUnitType[];
  /** 주소/건물명에서 매칭할 키워드 */
  matchKeywords: string[];
}

export const KNOWN_APARTMENTS: KnownApartment[] = [
  {
    complexName: "대전용산4블럭",
    address: "대전광역시 유성구 용산동",
    region: "대전",
    dongCount: 5,
    householdCount: 450,
    completionYear: 2024,
    developer: "한국토지주택공사",
    constructor: "현대건설",
    totalFloor: 25,
    types: [
      {
        typeName: "59A",
        areaSqm: 59,
        supplyAreaSqm: 84.8,
        roomCount: 3,
        bathroomCount: 2,
        sampleId: "sample-59",
        lineNum: 1,
        dongFloors: {
          "101동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "102동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "103동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        },
      },
      {
        typeName: "84A",
        areaSqm: 84,
        supplyAreaSqm: 114.5,
        roomCount: 4,
        bathroomCount: 2,
        sampleId: "sample-84a",
        lineNum: 2,
        dongFloors: {
          "101동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "102동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "104동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "105동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        },
      },
      {
        typeName: "84B",
        areaSqm: 84,
        supplyAreaSqm: 114.5,
        roomCount: 3,
        bathroomCount: 2,
        sampleId: "sample-84b",
        lineNum: 3,
        dongFloors: {
          "103동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "104동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
          "105동": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        },
      },
    ],
    matchKeywords: ["용산4블럭", "용산4블록", "용산4BL", "대전용산", "용산동"],
  },
];

/**
 * 주소/건물명에서 매칭되는 아파트 찾기
 */
export function findKnownApartment(
  address: string,
  buildingName?: string
): KnownApartment | null {
  const searchText = `${address} ${buildingName || ""}`.toLowerCase();

  for (const apt of KNOWN_APARTMENTS) {
    for (const keyword of apt.matchKeywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return apt;
      }
    }
  }
  return null;
}
