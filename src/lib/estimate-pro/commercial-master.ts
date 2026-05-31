// src/lib/estimate-pro/commercial-master.ts
// 상가/근린상가 고정 마스터 내역 (모든 상가 견적서 공통). 약 165㎡(50평) 점포 기준 기본수량.
// 상가 전용 공종(간판·파사드 / 소방 / 환기·후드 / 네트워크·통신 / 냉난방) 포함.
// 프로젝트별 수량 0/삭제로 운용. 값은 표준 기본(편집 가능).
import type { MasterItem } from './detail-model';

const S = '2025 상업 인테리어 표준(편집 가능)';

export const COMMERCIAL_MASTER: MasterItem[] = [
  // 가설
  { trade: '가설', order: 1, itemName: '가설·양중·보양', part: '공통', spec: '현장 보양 + 자재 양중', brand: '-', product: '시공', unit: '식', quantity: 1, matUnit: 300000, labUnit: 500000, optional: false, source: S },
  // 철거
  { trade: '철거', order: 2, itemName: '기존 집기·간판 철거', part: '공통', spec: '집기/간판/사인 해체', brand: '-', product: '해체', unit: '식', quantity: 1, matUnit: 0, labUnit: 1200000, optional: false, source: S },
  { trade: '철거', order: 2, itemName: '기존 마감 철거', part: '공통', spec: '벽/천장/바닥 마감 해체', brand: '-', product: '해체', unit: 'm²', quantity: 165, matUnit: 0, labUnit: 9000, optional: false, source: S },
  { trade: '철거', order: 2, itemName: '폐기물 반출·처리', part: '공통', spec: '5톤 다회', brand: '-', product: '반출', unit: '식', quantity: 1, matUnit: 1200000, labUnit: 600000, optional: false, source: S },
  // 창호/문 (전면)
  { trade: '창호/문', order: 12, itemName: '전면 강화유리 파사드', part: '창호/문', spec: '12T 강화유리 + 자동/여닫이 도어', brand: '이건/KCC', product: '강화유리 시스템도어', priceBand: '식 600~1,200만', imageHint: '통유리 파사드', unit: '식', quantity: 1, matUnit: 6000000, labUnit: 1500000, optional: false, source: S },
  // 목공
  { trade: '목공', order: 10, itemName: '천장 목공 하지', part: '천장', spec: 'M-bar/각재 천장틀', brand: '동아스틸', product: '천장 하지', unit: 'm²', quantity: 165, matUnit: 9000, labUnit: 11000, optional: false, source: S },
  { trade: '목공', order: 10, itemName: '벽체·파티션 목공', part: '벽', spec: '경량 스터드 + 석고 2겹', brand: '제작', product: '파티션', unit: 'm²', quantity: 40, matUnit: 18000, labUnit: 26000, optional: false, source: S },
  { trade: '목공', order: 10, itemName: '카운터·바 제작', part: '주방', spec: '계산대/바 카운터 제작', brand: '제작', product: '카운터', priceBand: '식 150~400만', imageHint: '우드/스톤 카운터', unit: '식', quantity: 1, matUnit: 1500000, labUnit: 1200000, optional: false, source: S },
  // 기계설비
  { trade: '기계설비(배관)', order: 8, itemName: '급배수 배관', part: '설비', spec: '급수/배수/온수 배관', brand: '한일/PPI', product: '배관', unit: '식', quantity: 1, matUnit: 800000, labUnit: 1200000, optional: false, source: S },
  { trade: '기계설비(배관)', order: 8, itemName: '위생기구 설치', part: '욕실', spec: '공용화장실 기구 설치', brand: '대림바스', product: '위생기구', unit: '식', quantity: 1, matUnit: 400000, labUnit: 500000, optional: false, source: S },
  // 전기
  { trade: '전기', order: 9, itemName: '전기 인입·증설', part: '전기', spec: '계량기/승압 + 간선', brand: '한전 협의', product: '인입증설', priceBand: '식 100~300만', unit: '식', quantity: 1, matUnit: 800000, labUnit: 700000, optional: false, source: S },
  { trade: '전기', order: 9, itemName: '배선·배관', part: '전기', spec: 'HIV + 몰드/CD관', brand: 'LS전선', product: '배선', unit: 'm²', quantity: 165, matUnit: 4000, labUnit: 6000, optional: false, source: S },
  { trade: '전기', order: 9, itemName: '콘센트·스위치', part: '전기', spec: '매립 콘센트/스위치', brand: '르그랑', product: '배선기구', unit: '개', quantity: 40, matUnit: 12000, labUnit: 18000, optional: false, source: S },
  { trade: '전기', order: 9, itemName: '분전반', part: '전기', spec: '상가 분전반(ELB)', brand: '상도전기', product: '분전반', unit: '식', quantity: 1, matUnit: 350000, labUnit: 250000, optional: false, source: S },
  { trade: '전기', order: 9, itemName: '조명기구', part: '전기', spec: '레일/매입/펜던트 조명', brand: '비츠온/수입', product: 'LED 조명', priceBand: '식 150~400만', imageHint: '레일·펜던트 연출조명', unit: '식', quantity: 1, matUnit: 2000000, labUnit: 500000, optional: false, source: S },
  // 냉난방
  { trade: '냉난방공사', order: 24, itemName: '시스템 냉난방기', part: '설비', spec: '천장형 4way (제품)', brand: '삼성/LG', product: '시스템에어컨', priceBand: 'EA 120~200만', unit: '대', quantity: 3, matUnit: 1500000, labUnit: 300000, optional: false, source: S },
  { trade: '냉난방공사', order: 24, itemName: '냉매배관·드레인', part: '설비', spec: '배관 + 드레인 + 단열', brand: '시공', product: '냉매배관', unit: '식', quantity: 1, matUnit: 600000, labUnit: 900000, optional: false, source: S },
  // 환기·후드
  { trade: '환기·후드공사', order: 25, itemName: '주방 후드·급배기 덕트', part: '주방', spec: '스텐 후드 + 급/배기 덕트', brand: '하츠/제작', product: '후드·덕트', priceBand: '식 200~500만', unit: '식', quantity: 1, matUnit: 2000000, labUnit: 1500000, optional: true, source: S },
  { trade: '환기·후드공사', order: 25, itemName: '홀·화장실 환기', part: '설비', spec: '전열교환/환풍 시스템', brand: '힘펠', product: '환기설비', unit: '식', quantity: 1, matUnit: 500000, labUnit: 400000, optional: false, source: S },
  // 소방
  { trade: '소방공사', order: 26, itemName: '스프링클러 헤드 이설', part: '설비', spec: '칸막이 변경 따른 헤드 이설', brand: '소방업체', product: '스프링클러', unit: '개', quantity: 8, matUnit: 35000, labUnit: 45000, optional: false, source: S },
  { trade: '소방공사', order: 26, itemName: '감지기·수신반', part: '설비', spec: '연기/열 감지기 + 수신반 연동', brand: '소방업체', product: '감지설비', unit: '식', quantity: 1, matUnit: 400000, labUnit: 500000, optional: false, source: S },
  { trade: '소방공사', order: 26, itemName: '피난유도등·유도표지', part: '설비', spec: '유도등 + 축광 표지', brand: '소방업체', product: '피난설비', unit: '식', quantity: 1, matUnit: 300000, labUnit: 300000, optional: false, source: S },
  { trade: '소방공사', order: 26, itemName: '소화기·완강기', part: '공통', spec: '소화기 + 비상조명', brand: '소방업체', product: '소화설비', unit: '식', quantity: 1, matUnit: 250000, labUnit: 150000, optional: false, source: S },
  // 네트워크·통신
  { trade: '네트워크·통신공사', order: 27, itemName: '랜·전화 배선', part: '전기', spec: 'UTP/전화 단자', brand: '시공', product: '통신배선', unit: '식', quantity: 1, matUnit: 300000, labUnit: 400000, optional: false, source: S },
  { trade: '네트워크·통신공사', order: 27, itemName: 'CCTV', part: '전기', spec: '카메라 4ch + 녹화기', brand: '한화비전', product: 'CCTV', priceBand: '식 60~150만', unit: '식', quantity: 1, matUnit: 700000, labUnit: 300000, optional: false, source: S },
  { trade: '네트워크·통신공사', order: 27, itemName: 'POS·사운드', part: '전기', spec: 'POS 배선 + 매장음향', brand: '시공', product: 'POS/음향', unit: '식', quantity: 1, matUnit: 500000, labUnit: 300000, optional: true, source: S },
  // 타일
  { trade: '타일', order: 11, itemName: '바닥 포세린 타일', part: '바닥', spec: '600×600 포세린', brand: '이펀세라', product: '포세린', priceBand: '재료 35~55천/㎡', imageHint: '대형 포세린 바닥', unit: 'm²', quantity: 120, matUnit: 45000, labUnit: 35000, optional: false, source: S },
  { trade: '타일', order: 11, itemName: '화장실 벽·바닥 타일', part: '욕실', spec: '포세린/자기질', brand: '윌로우세라믹', product: '타일', unit: 'm²', quantity: 25, matUnit: 35000, labUnit: 35000, optional: false, source: S },
  { trade: '타일', order: 11, itemName: '주방 벽타일', part: '주방', spec: '위생타일 200×400', brand: '동서타일', product: '위생타일', unit: 'm²', quantity: 15, matUnit: 30000, labUnit: 35000, optional: true, source: S },
  // 바닥재 (옵션 — 에폭시/데코)
  { trade: '바닥재', order: 16, itemName: '에폭시/데코타일 바닥', part: '바닥', spec: '에폭시 코팅 또는 데코타일', brand: 'LX하우시스', product: '데코타일/에폭시', priceBand: '재료 18~35천/㎡', imageHint: '인더스트리얼 바닥', unit: 'm²', quantity: 0, matUnit: 25000, labUnit: 18000, optional: true, source: S },
  // 도장
  { trade: '도배/페인트', order: 15, itemName: '벽 도장', part: '벽', spec: '수성 도장 2회 (퍼티 포함)', brand: '삼화페인트', product: '수성도장', unit: 'm²', quantity: 180, matUnit: 4000, labUnit: 7000, optional: false, source: S },
  { trade: '도배/페인트', order: 15, itemName: '노출 천장 도장', part: '천장', spec: '노출 콘크리트/덕트 무광 도장', brand: '삼화페인트', product: '노출도장', imageHint: '블랙 노출천장', unit: 'm²', quantity: 80, matUnit: 4000, labUnit: 8000, optional: true, source: S },
  // 천장
  { trade: '천장', order: 17, itemName: '석고 천장', part: '천장', spec: '석고보드 9.5T + 마감', brand: 'KCC', product: '석고천장', unit: 'm²', quantity: 85, matUnit: 10000, labUnit: 16000, optional: false, source: S },
  { trade: '천장', order: 17, itemName: 'SMC/마감 천장', part: '천장', spec: '화장실/주방 SMC 천장', brand: '제작', product: 'SMC 천장', unit: 'm²', quantity: 20, matUnit: 18000, labUnit: 12000, optional: false, source: S },
  // 간판·파사드
  { trade: '간판·파사드공사', order: 28, itemName: '외부 LED 채널 간판', part: '공통', spec: 'LED 채널사인 (인허가 별도)', brand: '사인업체', product: 'LED 채널사인', priceBand: '식 180~500만', imageHint: '전면 채널 간판', unit: '식', quantity: 1, matUnit: 1800000, labUnit: 450000, optional: false, source: S },
  { trade: '간판·파사드공사', order: 28, itemName: '파사드 외장재', part: '공통', spec: 'ACM/세라믹 패널', brand: '시공', product: '외장패널', unit: 'm²', quantity: 25, matUnit: 95000, labUnit: 35000, optional: true, source: S },
  { trade: '간판·파사드공사', order: 28, itemName: '내부 사인·픽토그램', part: '공통', spec: '입구/화장실/메뉴 사인', brand: '사인업체', product: '아크릴 사인', unit: '식', quantity: 1, matUnit: 600000, labUnit: 300000, optional: false, source: S },
  // 상업주방 (옵션)
  { trade: '상업주방', order: 29, itemName: '스테인리스 주방기구', part: '주방', spec: '싱크/작업대/선반 (제품 별도 가능)', brand: '제작', product: '스텐 주방', priceBand: '식 200~600만', optional: true, unit: '식', quantity: 0, matUnit: 3000000, labUnit: 800000, source: S },
  // 위생도기
  { trade: '위생도기', order: 19, itemName: '공용화장실 도기', part: '욕실', spec: '양변기 + 세면대 + 수전', brand: '대림바스', product: '위생도기', unit: '조', quantity: 2, matUnit: 450000, labUnit: 200000, optional: false, source: S },
  // 정리/청소
  { trade: '정리/청소', order: 23, itemName: '준공 청소', part: '공통', spec: '오픈 전 전문 청소', brand: '-', product: '청소', unit: 'm²', quantity: 165, matUnit: 0, labUnit: 4000, optional: false, source: S },
];
