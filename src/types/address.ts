export interface AddressSearchResult {
  roadAddress: string;
  jibunAddress: string;
  zipCode: string;
  buildingName?: string;
  sigunguCode: string;
  bcode: string;
  bdMgtSn?: string;
}

export interface BuildingInfo {
  id: string;
  address: string;
  buildingName?: string;
  dongName: string;
  hoName: string;
  buildingType: string;
  totalFloor: number;
  floor: number;
  exclusiveArea: number;
  supplyArea?: number;
  roomCount?: number;
  bathroomCount?: number;
  approvalDate?: string;
  floorPlanAvailable: boolean;
  sampleId?: string;          // 매칭된 샘플 도면 ID (sample-59 등)
  typeName?: string;          // 평형 타입명 (59A, 84A, 84B)
  complexName?: string;       // 아파트 단지명
}
