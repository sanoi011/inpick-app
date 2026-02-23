// src/lib/floor-plan/drawing/drawing-constants.ts
// 시공도면 렌더링 상수 (다크 배경 loom_drawings 스타일)

// ─── 도면 색상 팔레트 ───

export const DRAWING_COLORS = {
  BG: '#0D1117',              // 다크 배경
  BG_LIGHTER: '#161B22',     // 약간 밝은 배경 (섹션 구분)

  WALL_LINE: '#FFFFFF',       // 벽선 (흰색)
  WALL_FILL: '#2D2D3D',      // 벽체 채우기
  WALL_HATCH: '#3D3D4D',     // 벽체 해치 패턴

  DIM_LINE: '#8B949E',        // 치수선
  DIM_TEXT: '#C9D1D9',        // 치수 텍스트
  DIM_TICK: '#8B949E',        // 치수 틱 마크

  ANNOTATION: '#58A6FF',      // 자재 주석 (파란색)
  ANNOTATION_BG: '#1A2332',   // 자재 주석 배경

  DOOR: '#FFA657',            // 문 호 (주황색)
  WINDOW: '#79C0FF',          // 창문 (하늘색)
  WINDOW_GLASS: '#4A90D9',    // 유리 (반투명 파랑)

  FURNITURE: '#8B949E',       // 가구 외곽
  FURNITURE_FILL: '#1A1D23',  // 가구 채우기

  ELEC_OUTLET: '#FFA657',     // 콘센트 (주황)
  ELEC_SWITCH: '#56D364',     // 스위치 (초록)
  ELEC_TV: '#BC8CFF',         // TV 단자 (보라)
  ELEC_DATA: '#79C0FF',       // 데이터 단자 (하늘)
  ELEC_SPECIAL: '#F778BA',    // 특수 (분홍)

  TITLE: '#FFFFFF',           // 제목
  SUBTITLE: '#C9D1D9',       // 부제목
  LABEL: '#8B949E',           // 라벨

  GRID: '#21262D',            // 그리드 라인
  ROOM_FILL: '#161B22',       // 방 채우기 (입면도)

  RENDER_BORDER: '#30363D',   // 렌더 이미지 영역 테두리
} as const;

// ─── 스케일 ───

export const DRAWING_SCALE = 0.15;      // mm → SVG px (평면도)
export const ELEVATION_SCALE = 0.12;    // mm → SVG px (입면도)

// ─── SVG 캔버스 크기 ───

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 900;
export const ELEVATION_SVG_WIDTH = 1200;
export const ELEVATION_SVG_HEIGHT = 900;

// ─── 도면 레이아웃 여백 ───

export const LAYOUT = {
  MARGIN_TOP: 80,
  MARGIN_BOTTOM: 40,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 60,
  TITLE_HEIGHT: 60,
  DIM_OFFSET: 30,            // 치수선 오프셋 (벽에서의 거리)
  DIM_TICK_SIZE: 6,
  DIM_TEXT_OFFSET: 14,
  ANNOTATION_OFFSET: 16,
} as const;

// ─── 텍스트 크기 ───

export const FONT = {
  TITLE: 20,
  SUBTITLE: 14,
  DIM_TEXT: 10,
  LABEL: 11,
  ANNOTATION: 9,
  ELEC_LABEL: 8,
  FURNITURE_LABEL: 9,
  ROOM_NAME: 13,
} as const;

// ─── 한국 아파트 표준 가구 치수 (mm) ───

export const FURNITURE_SIZES: Record<string, { w: number; h: number; label: string }> = {
  // 거실
  sofa_3seat:      { w: 2100, h: 900,  label: '3인 소파' },
  sofa_2seat:      { w: 1500, h: 850,  label: '2인 소파' },
  sofa_l_shape:    { w: 2700, h: 1800, label: 'L자 소파' },
  coffee_table:    { w: 1200, h: 600,  label: '커피 테이블' },
  side_table:      { w: 500,  h: 500,  label: '사이드 테이블' },
  tv_stand:        { w: 1800, h: 450,  label: 'TV 스탠드' },
  tv_wall_mount:   { w: 1400, h: 50,   label: '벽걸이 TV' },

  // 다이닝
  dining_table_4:  { w: 1200, h: 800,  label: '4인 식탁' },
  dining_table_6:  { w: 1800, h: 900,  label: '6인 식탁' },
  dining_chair:    { w: 450,  h: 450,  label: '의자' },

  // 침실
  queen_bed:       { w: 1600, h: 2100, label: '퀸 침대' },
  single_bed:      { w: 1000, h: 2000, label: '싱글 침대' },
  super_single_bed: { w: 1100, h: 2000, label: '슈퍼싱글 침대' },
  nightstand:      { w: 500,  h: 450,  label: '협탁' },

  // 서재/작업
  desk:            { w: 1200, h: 600,  label: '책상' },
  desk_chair:      { w: 550,  h: 550,  label: '의자' },
  bookshelf:       { w: 800,  h: 300,  label: '책장' },

  // 수납
  wardrobe_2door:  { w: 1200, h: 600,  label: '2문 옷장' },
  wardrobe_3door:  { w: 1800, h: 600,  label: '3문 옷장' },
  shoe_cabinet:    { w: 1200, h: 350,  label: '신발장' },

  // 가전
  washing_machine: { w: 600,  h: 650,  label: '세탁기' },
  dryer:           { w: 600,  h: 650,  label: '건조기' },
  refrigerator:    { w: 700,  h: 700,  label: '냉장고' },
  kitchen_island:  { w: 1200, h: 600,  label: '아일랜드' },
} as const;

// ─── 방 타입별 기본 가구 세트 ───

export const ROOM_DEFAULT_FURNITURE: Record<string, string[]> = {
  LIVING_ROOM: ['sofa_3seat', 'coffee_table', 'tv_stand'],
  MASTER_BEDROOM: ['queen_bed', 'nightstand', 'nightstand', 'wardrobe_3door'],
  BEDROOM: ['single_bed', 'nightstand', 'desk', 'desk_chair'],
  KITCHEN: ['refrigerator'],
  ENTRANCE: ['shoe_cabinet'],
  UTILITY: ['washing_machine'],
  DINING: ['dining_table_4', 'dining_chair', 'dining_chair', 'dining_chair', 'dining_chair'],
  DRESSROOM: ['wardrobe_3door'],
};

// ─── 전기 심볼 크기 (SVG px) ───

export const ELEC_SYMBOL_SIZE = {
  OUTLET: 10,          // 원 반지름
  SWITCH: 8,           // 사각형 반변
  TV: 12,              // 원 반지름 (TV)
  SPECIAL: 10,
} as const;

// ─── 전기 타입별 높이 기본값 (mm) ───

export const ELEC_DEFAULT_HEIGHT: Record<string, number> = {
  outlet: 300,
  outlet_double: 300,
  outlet_grounded: 300,
  switch_single: 1200,
  switch_double: 1200,
  switch_three_way: 1200,
  tv_outlet: 300,
  data_outlet: 300,
  ac_outlet: 1800,
  gas_valve: 450,
  exhaust_fan: 2200,
  intercom: 1200,
  doorbell: 1200,
  fire_detector: 2400,
  light_switch: 1200,
};
