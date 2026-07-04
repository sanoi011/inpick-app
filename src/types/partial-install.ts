/**
 * 부분 자재·시공 서비스 공용 타입.
 * API(/api/partial-install/contractors)와 페이지(/partial-install)가 공유.
 */
export interface LocalContractor {
  id: string;
  name: string;
  category: string;
  address: string;
  telephone: string | null;
  /** 업체 자체 홈페이지 (네이버가 제공할 때만) */
  homepage: string | null;
  /** 네이버 지도 검색 링크 — 리뷰·사진·전화 확인 */
  naverMapUrl: string;
}
