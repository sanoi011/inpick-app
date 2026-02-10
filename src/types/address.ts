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
}
