-- ============================================================
-- category_taxonomy 시드 : 전기 / 설비 / 건축 3개 도메인 약 420 항목
-- 계층: L1 Domain → L2 Category → L3 SubCategory → L4 Variant
-- 아직 제품 데이터는 없고 카테고리 체계만 선제 구축.
-- ============================================================

BEGIN;

-- ============================================================
-- L1 : Domain (3)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, name_en, sort_order) VALUES
  ('ELEC',   NULL, 1, 'electrical',   '전기',   'Electrical',   1),
  ('MECH',   NULL, 1, 'mechanical',   '설비',   'Mechanical',   2),
  ('ARCH',   NULL, 1, 'architecture', '건축마감','Architecture', 3);

-- ============================================================
-- L2 : Category (전기)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, name_en, typical_unit, sort_order) VALUES
  ('ELEC_LIGHT',   'ELEC', 2, 'electrical', '조명',       'Lighting',        'EA', 10),
  ('ELEC_SWITCH',  'ELEC', 2, 'electrical', '스위치',     'Switch',          'EA', 20),
  ('ELEC_OUTLET',  'ELEC', 2, 'electrical', '콘센트',     'Outlet',          'EA', 30),
  ('ELEC_WIRE',    'ELEC', 2, 'electrical', '전선',       'Wire',            'm',  40),
  ('ELEC_CONDUIT', 'ELEC', 2, 'electrical', '배관/후렉스','Conduit',         'm',  50),
  ('ELEC_DIST',    'ELEC', 2, 'electrical', '배전',       'Distribution',    'EA', 60),
  ('ELEC_EARTH',   'ELEC', 2, 'electrical', '접지',       'Earthing',        'EA', 70),
  ('ELEC_WEAK',    'ELEC', 2, 'electrical', '약전',       'WeakCurrent',     'EA', 80),
  ('ELEC_PROTECT', 'ELEC', 2, 'electrical', '피뢰/보호',  'Protection',      'EA', 90);

-- ============================================================
-- L2 : Category (설비)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, name_en, typical_unit, sort_order) VALUES
  ('MECH_SUPPLY',   'MECH', 2, 'mechanical', '급수배관',   'WaterSupply',  'm',  10),
  ('MECH_DRAIN',    'MECH', 2, 'mechanical', '배수배관',   'Drain',        'm',  20),
  ('MECH_FITTING',  'MECH', 2, 'mechanical', '피팅',       'Fitting',      'EA', 30),
  ('MECH_VALVE',    'MECH', 2, 'mechanical', '밸브',       'Valve',        'EA', 40),
  ('MECH_FAUCET',   'MECH', 2, 'mechanical', '수전',       'Faucet',       'EA', 50),
  ('MECH_SANITARY', 'MECH', 2, 'mechanical', '위생도기',   'Sanitary',     'EA', 60),
  ('MECH_HEAT',     'MECH', 2, 'mechanical', '난방',       'Heating',      'EA', 70),
  ('MECH_HVAC',     'MECH', 2, 'mechanical', '환기/공조',  'HVAC',         'EA', 80),
  ('MECH_GAS',      'MECH', 2, 'mechanical', '가스',       'Gas',          'EA', 90),
  ('MECH_BOILER',   'MECH', 2, 'mechanical', '보일러/온수','Boiler',       'EA', 100);

-- ============================================================
-- L2 : Category (건축 — 기존 material_products 카테고리 동화)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, name_en, typical_unit, sort_order) VALUES
  ('ARCH_FLOOR',    'ARCH', 2, 'architecture', '바닥재',     'Flooring',      'm²', 10),
  ('ARCH_WALL',     'ARCH', 2, 'architecture', '벽지',       'Wallpaper',     'm²', 20),
  ('ARCH_TILE',     'ARCH', 2, 'architecture', '타일',       'Tile',          'm²', 30),
  ('ARCH_WIN',      'ARCH', 2, 'architecture', '창호',       'Window',        'EA', 40),
  ('ARCH_DOOR',     'ARCH', 2, 'architecture', '도어',       'Door',          'EA', 50),
  ('ARCH_FILM',     'ARCH', 2, 'architecture', '인테리어필름','Film',         'm²', 60),
  ('ARCH_PAINT',    'ARCH', 2, 'architecture', '도장',       'Paint',         'L',  70),
  ('ARCH_CEIL',     'ARCH', 2, 'architecture', '천장재',     'Ceiling',       'm²', 80),
  ('ARCH_INSUL',    'ARCH', 2, 'architecture', '단열재',     'Insulation',    'm²', 90),
  ('ARCH_HARDWARE', 'ARCH', 2, 'architecture', '철물',       'Hardware',      'EA', 100),
  ('ARCH_KITCHEN',  'ARCH', 2, 'architecture', '싱크/주방',  'KitchenCabinet','set', 110),
  ('ARCH_BATH',     'ARCH', 2, 'architecture', '욕실',       'Bathroom',      'set', 120),
  ('ARCH_ROOM',     'ARCH', 2, 'architecture', '공간세트',   'RoomSet',       'set', 130);

-- ============================================================
-- L3 : SubCategory (전기 — 조명)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_rooms, aliases, sort_order) VALUES
  ('ELEC_LIGHT_DOWN',    'ELEC_LIGHT', 3, 'electrical', '다운라이트',       ARRAY['living_room','bedroom','kitchen','corridor'], ARRAY['매입등','LED다운'], 10),
  ('ELEC_LIGHT_EMBED',   'ELEC_LIGHT', 3, 'electrical', '매입등(사각/원형)', ARRAY['living_room','bedroom'], ARRAY['평판등'], 20),
  ('ELEC_LIGHT_PENDANT', 'ELEC_LIGHT', 3, 'electrical', '펜던트',           ARRAY['dining','kitchen','living_room'], NULL, 30),
  ('ELEC_LIGHT_INDIRECT','ELEC_LIGHT', 3, 'electrical', '간접등/라인조명',   ARRAY['living_room','bedroom','ceiling_border'], ARRAY['COB','라인등','엣지등'], 40),
  ('ELEC_LIGHT_SPOT',    'ELEC_LIGHT', 3, 'electrical', '스포트',           ARRAY['shop','gallery','living_room'], NULL, 50),
  ('ELEC_LIGHT_WALL',    'ELEC_LIGHT', 3, 'electrical', '벽부등(브라켓)',    ARRAY['bathroom','entrance','bedroom'], ARRAY['브라켓'], 60),
  ('ELEC_LIGHT_CEIL',    'ELEC_LIGHT', 3, 'electrical', '천장 직부',        ARRAY['bedroom','living_room'], ARRAY['방등','거실등'], 70),
  ('ELEC_LIGHT_SENSOR',  'ELEC_LIGHT', 3, 'electrical', '센서등',           ARRAY['entrance','corridor','bathroom'], NULL, 80),
  ('ELEC_LIGHT_EXT',     'ELEC_LIGHT', 3, 'electrical', '외부등/보안등',     ARRAY['exterior','balcony'], NULL, 90),
  ('ELEC_LIGHT_DECO',    'ELEC_LIGHT', 3, 'electrical', '장식등/샹들리에',   ARRAY['dining','living_room'], NULL, 100);

-- L4 Variants : 다운라이트
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, notes, sort_order) VALUES
  ('ELEC_LIGHT_DOWN_3IN',  'ELEC_LIGHT_DOWN', 4, 'electrical', '3인치 다운라이트',  'EA', '주로 5~10W', 10),
  ('ELEC_LIGHT_DOWN_4IN',  'ELEC_LIGHT_DOWN', 4, 'electrical', '4인치 다운라이트',  'EA', '주로 10~15W', 20),
  ('ELEC_LIGHT_DOWN_6IN',  'ELEC_LIGHT_DOWN', 4, 'electrical', '6인치 다운라이트',  'EA', '주로 15~20W', 30),
  ('ELEC_LIGHT_DOWN_COB',  'ELEC_LIGHT_DOWN', 4, 'electrical', 'COB 타입',         'EA', NULL, 40),
  ('ELEC_LIGHT_DOWN_DIM',  'ELEC_LIGHT_DOWN', 4, 'electrical', '디밍 타입',        'EA', NULL, 50);

-- L4 Variants : 매입등
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_LIGHT_EMBED_SQ', 'ELEC_LIGHT_EMBED', 4, 'electrical', '사각 매입등',  'EA', 10),
  ('ELEC_LIGHT_EMBED_RD', 'ELEC_LIGHT_EMBED', 4, 'electrical', '원형 매입등',  'EA', 20),
  ('ELEC_LIGHT_EMBED_EDGE','ELEC_LIGHT_EMBED',4, 'electrical', '엣지 LED 패널','EA', 30);

-- L4 Variants : 간접등
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_LIGHT_INDIRECT_COB',  'ELEC_LIGHT_INDIRECT', 4, 'electrical', 'COB 라인바',    'm',  10),
  ('ELEC_LIGHT_INDIRECT_SMD',  'ELEC_LIGHT_INDIRECT', 4, 'electrical', 'SMD 스트립',    'm',  20),
  ('ELEC_LIGHT_INDIRECT_NEON', 'ELEC_LIGHT_INDIRECT', 4, 'electrical', '네온플렉스',     'm',  30);

-- L4 Variants : 센서등
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_LIGHT_SENSOR_PIR',  'ELEC_LIGHT_SENSOR', 4, 'electrical', '적외선(PIR) 센서등', 'EA', 10),
  ('ELEC_LIGHT_SENSOR_MW',   'ELEC_LIGHT_SENSOR', 4, 'electrical', '마이크로웨이브 센서등', 'EA', 20),
  ('ELEC_LIGHT_SENSOR_PHOTO','ELEC_LIGHT_SENSOR', 4, 'electrical', '광센서 자동점멸기', 'EA', 30);

-- L4 Variants : 천장 직부(방등/거실등)
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_LIGHT_CEIL_SQ',    'ELEC_LIGHT_CEIL', 4, 'electrical', '사각 방등',   'EA', 10),
  ('ELEC_LIGHT_CEIL_RD',    'ELEC_LIGHT_CEIL', 4, 'electrical', '원형 방등',   'EA', 20),
  ('ELEC_LIGHT_CEIL_SMART', 'ELEC_LIGHT_CEIL', 4, 'electrical', '스마트 방등(조광·색온)','EA', 30);

-- ============================================================
-- L3/L4 : 스위치
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_SWITCH_STD',   'ELEC_SWITCH', 3, 'electrical', '일반 스위치',    ARRAY['융스위치'], 10),
  ('ELEC_SWITCH_DIM',   'ELEC_SWITCH', 3, 'electrical', '디머 스위치',    ARRAY['조광스위치'], 20),
  ('ELEC_SWITCH_3WAY',  'ELEC_SWITCH', 3, 'electrical', '3로/4로 스위치', ARRAY['쓰리웨이','포웨이'], 30),
  ('ELEC_SWITCH_SENSOR','ELEC_SWITCH', 3, 'electrical', '센서 스위치',    NULL, 40),
  ('ELEC_SWITCH_SMART', 'ELEC_SWITCH', 3, 'electrical', '스마트 스위치',  ARRAY['WiFi','Zigbee'], 50),
  ('ELEC_SWITCH_PULL',  'ELEC_SWITCH', 3, 'electrical', '풀스위치',       ARRAY['끈스위치'], 60);

-- L4 일반 스위치: 구수
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, notes, sort_order) VALUES
  ('ELEC_SWITCH_STD_1GANG', 'ELEC_SWITCH_STD', 4, 'electrical', '1구',  'EA', '융 1구 동일',  10),
  ('ELEC_SWITCH_STD_2GANG', 'ELEC_SWITCH_STD', 4, 'electrical', '2구',  'EA', NULL, 20),
  ('ELEC_SWITCH_STD_3GANG', 'ELEC_SWITCH_STD', 4, 'electrical', '3구',  'EA', NULL, 30),
  ('ELEC_SWITCH_STD_4GANG', 'ELEC_SWITCH_STD', 4, 'electrical', '4구',  'EA', '융스위치 4구 대응', 40),
  ('ELEC_SWITCH_STD_6GANG', 'ELEC_SWITCH_STD', 4, 'electrical', '6구',  'EA', NULL, 50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_SWITCH_DIM_ROT', 'ELEC_SWITCH_DIM', 4, 'electrical', '로터리 디머', 'EA', 10),
  ('ELEC_SWITCH_DIM_TCH', 'ELEC_SWITCH_DIM', 4, 'electrical', '터치 디머',   'EA', 20),
  ('ELEC_SWITCH_SENSOR_PIR', 'ELEC_SWITCH_SENSOR', 4, 'electrical', 'PIR 인체감지', 'EA', 10),
  ('ELEC_SWITCH_SMART_WIFI', 'ELEC_SWITCH_SMART', 4, 'electrical', 'WiFi',    'EA', 10),
  ('ELEC_SWITCH_SMART_ZB',   'ELEC_SWITCH_SMART', 4, 'electrical', 'Zigbee',  'EA', 20);

-- ============================================================
-- L3/L4 : 콘센트
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_OUTLET_STD',   'ELEC_OUTLET', 3, 'electrical', '일반 콘센트',      NULL, 10),
  ('ELEC_OUTLET_USB',   'ELEC_OUTLET', 3, 'electrical', 'USB 내장 콘센트',  ARRAY['USB-A','USB-C'], 20),
  ('ELEC_OUTLET_WP',    'ELEC_OUTLET', 3, 'electrical', '방수 콘센트',      ARRAY['옥외콘센트'], 30),
  ('ELEC_OUTLET_HIAMP', 'ELEC_OUTLET', 3, 'electrical', '대용량(에어컨/오븐)', NULL, 40),
  ('ELEC_OUTLET_EV',    'ELEC_OUTLET', 3, 'electrical', '전기차 충전 콘센트', NULL, 50),
  ('ELEC_OUTLET_SAVE',  'ELEC_OUTLET', 3, 'electrical', '대기전력차단 콘센트', ARRAY['스위치내장'], 60),
  ('ELEC_OUTLET_FLOOR', 'ELEC_OUTLET', 3, 'electrical', '바닥매립 콘센트',   NULL, 70);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_OUTLET_STD_1P', 'ELEC_OUTLET_STD', 4, 'electrical', '1구', 'EA', 10),
  ('ELEC_OUTLET_STD_2P', 'ELEC_OUTLET_STD', 4, 'electrical', '2구', 'EA', 20),
  ('ELEC_OUTLET_STD_3P', 'ELEC_OUTLET_STD', 4, 'electrical', '3구', 'EA', 30),
  ('ELEC_OUTLET_STD_4P', 'ELEC_OUTLET_STD', 4, 'electrical', '4구', 'EA', 40),
  ('ELEC_OUTLET_USB_A',  'ELEC_OUTLET_USB', 4, 'electrical', 'USB-A', 'EA', 10),
  ('ELEC_OUTLET_USB_C',  'ELEC_OUTLET_USB', 4, 'electrical', 'USB-C', 'EA', 20),
  ('ELEC_OUTLET_HIAMP_16A','ELEC_OUTLET_HIAMP',4,'electrical','16A 에어컨용','EA',10),
  ('ELEC_OUTLET_HIAMP_32A','ELEC_OUTLET_HIAMP',4,'electrical','32A 대용량',  'EA',20);

-- ============================================================
-- L3/L4 : 전선
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_WIRE_SINGLE', 'ELEC_WIRE', 3, 'electrical', '단상 전력선',    ARRAY['HIV','IV'], 10),
  ('ELEC_WIRE_THREE',  'ELEC_WIRE', 3, 'electrical', '3상 전력선',     ARRAY['3상선','VCT'], 20),
  ('ELEC_WIRE_CV',     'ELEC_WIRE', 3, 'electrical', 'CV 케이블',      NULL, 30),
  ('ELEC_WIRE_GROUND', 'ELEC_WIRE', 3, 'electrical', '접지선',         ARRAY['GV'], 40),
  ('ELEC_WIRE_UTP',    'ELEC_WIRE', 3, 'electrical', '통신선(UTP)',    ARRAY['LAN케이블'], 50),
  ('ELEC_WIRE_COAX',   'ELEC_WIRE', 3, 'electrical', '동축(CCTV/TV)',   NULL, 60),
  ('ELEC_WIRE_SPEAKER','ELEC_WIRE', 3, 'electrical', '스피커선',        NULL, 70),
  ('ELEC_WIRE_FLEX',   'ELEC_WIRE', 3, 'electrical', '고무(VCTF)',     ARRAY['고무전선'], 80);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, notes, sort_order) VALUES
  ('ELEC_WIRE_SINGLE_1_5',  'ELEC_WIRE_SINGLE', 4, 'electrical', '1.5㎟',  'm', '조명 분기', 10),
  ('ELEC_WIRE_SINGLE_2_5',  'ELEC_WIRE_SINGLE', 4, 'electrical', '2.5㎟',  'm', '콘센트 분기', 20),
  ('ELEC_WIRE_SINGLE_4',    'ELEC_WIRE_SINGLE', 4, 'electrical', '4㎟',    'm', NULL, 30),
  ('ELEC_WIRE_SINGLE_6',    'ELEC_WIRE_SINGLE', 4, 'electrical', '6㎟',    'm', NULL, 40),
  ('ELEC_WIRE_SINGLE_10',   'ELEC_WIRE_SINGLE', 4, 'electrical', '10㎟',   'm', NULL, 50),
  ('ELEC_WIRE_SINGLE_16',   'ELEC_WIRE_SINGLE', 4, 'electrical', '16㎟',   'm', '메인 인입', 60),
  ('ELEC_WIRE_SINGLE_25',   'ELEC_WIRE_SINGLE', 4, 'electrical', '25㎟',   'm', NULL, 70),
  ('ELEC_WIRE_THREE_4',     'ELEC_WIRE_THREE',  4, 'electrical', '4㎟',    'm', NULL, 10),
  ('ELEC_WIRE_THREE_6',     'ELEC_WIRE_THREE',  4, 'electrical', '6㎟',    'm', NULL, 20),
  ('ELEC_WIRE_THREE_10',    'ELEC_WIRE_THREE',  4, 'electrical', '10㎟',   'm', NULL, 30),
  ('ELEC_WIRE_THREE_16',    'ELEC_WIRE_THREE',  4, 'electrical', '16㎟',   'm', NULL, 40),
  ('ELEC_WIRE_UTP_CAT5E',   'ELEC_WIRE_UTP',    4, 'electrical', 'CAT 5E', 'm', NULL, 10),
  ('ELEC_WIRE_UTP_CAT6',    'ELEC_WIRE_UTP',    4, 'electrical', 'CAT 6',  'm', NULL, 20),
  ('ELEC_WIRE_UTP_CAT6A',   'ELEC_WIRE_UTP',    4, 'electrical', 'CAT 6A', 'm', NULL, 30);

-- ============================================================
-- L3/L4 : 배관/후렉스
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_CONDUIT_CD',    'ELEC_CONDUIT', 3, 'electrical', 'PVC CD관',      ARRAY['콘크리트매립'], 10),
  ('ELEC_CONDUIT_HI',    'ELEC_CONDUIT', 3, 'electrical', 'PVC HI관',      ARRAY['지중매립'], 20),
  ('ELEC_CONDUIT_STEEL', 'ELEC_CONDUIT', 3, 'electrical', '스틸관',        ARRAY['후강','박강'], 30),
  ('ELEC_CONDUIT_FLEX',  'ELEC_CONDUIT', 3, 'electrical', '주름관/후렉스', ARRAY['후렉스','Flex','플렉시블'], 40),
  ('ELEC_CONDUIT_TRAY',  'ELEC_CONDUIT', 3, 'electrical', '케이블트레이',  ARRAY['Cable Tray'], 50),
  ('ELEC_CONDUIT_DUCT',  'ELEC_CONDUIT', 3, 'electrical', '메탈덕트',       NULL, 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_CONDUIT_CD_16',  'ELEC_CONDUIT_CD', 4, 'electrical', '16Φ', 'm', 10),
  ('ELEC_CONDUIT_CD_22',  'ELEC_CONDUIT_CD', 4, 'electrical', '22Φ', 'm', 20),
  ('ELEC_CONDUIT_CD_28',  'ELEC_CONDUIT_CD', 4, 'electrical', '28Φ', 'm', 30),
  ('ELEC_CONDUIT_CD_36',  'ELEC_CONDUIT_CD', 4, 'electrical', '36Φ', 'm', 40),
  ('ELEC_CONDUIT_CD_42',  'ELEC_CONDUIT_CD', 4, 'electrical', '42Φ', 'm', 50),
  ('ELEC_CONDUIT_FLEX_16','ELEC_CONDUIT_FLEX',4,'electrical','16Φ', 'm', 10),
  ('ELEC_CONDUIT_FLEX_22','ELEC_CONDUIT_FLEX',4,'electrical','22Φ', 'm', 20),
  ('ELEC_CONDUIT_FLEX_28','ELEC_CONDUIT_FLEX',4,'electrical','28Φ', 'm', 30),
  ('ELEC_CONDUIT_FLEX_36','ELEC_CONDUIT_FLEX',4,'electrical','36Φ', 'm', 40);

-- ============================================================
-- L3/L4 : 배전
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_DIST_MAIN',  'ELEC_DIST', 3, 'electrical', '메인차단기',  ARRAY['MCCB','ELB'], 10),
  ('ELEC_DIST_SUB',   'ELEC_DIST', 3, 'electrical', '분기차단기',  ARRAY['MCB'], 20),
  ('ELEC_DIST_ELCB',  'ELEC_DIST', 3, 'electrical', '누전차단기',  ARRAY['ELCB','ELB'], 30),
  ('ELEC_DIST_PANEL', 'ELEC_DIST', 3, 'electrical', '분전반',      ARRAY['세대분전반'], 40),
  ('ELEC_DIST_METER', 'ELEC_DIST', 3, 'electrical', '전력량계',    NULL, 50),
  ('ELEC_DIST_SPD',   'ELEC_DIST', 3, 'electrical', 'SPD 서지보호기', NULL, 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('ELEC_DIST_MAIN_2P_30A',  'ELEC_DIST_MAIN', 4, 'electrical', '2P 30A',  'EA', 10),
  ('ELEC_DIST_MAIN_2P_50A',  'ELEC_DIST_MAIN', 4, 'electrical', '2P 50A',  'EA', 20),
  ('ELEC_DIST_MAIN_3P_100A', 'ELEC_DIST_MAIN', 4, 'electrical', '3P 100A', 'EA', 30),
  ('ELEC_DIST_MAIN_3P_200A', 'ELEC_DIST_MAIN', 4, 'electrical', '3P 200A', 'EA', 40),
  ('ELEC_DIST_SUB_1P_15A',   'ELEC_DIST_SUB',  4, 'electrical', '1P 15A',  'EA', 10),
  ('ELEC_DIST_SUB_1P_20A',   'ELEC_DIST_SUB',  4, 'electrical', '1P 20A',  'EA', 20),
  ('ELEC_DIST_SUB_1P_30A',   'ELEC_DIST_SUB',  4, 'electrical', '1P 30A',  'EA', 30),
  ('ELEC_DIST_PANEL_SEDAE',  'ELEC_DIST_PANEL',4, 'electrical', '세대 매입형', 'EA', 10),
  ('ELEC_DIST_PANEL_EXT',    'ELEC_DIST_PANEL',4, 'electrical', '노출형',    'EA', 20);

-- ============================================================
-- L3/L4 : 약전 / 접지 / 피뢰
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ELEC_WEAK_DOOR',   'ELEC_WEAK', 3, 'electrical', '초인종',      NULL, 10),
  ('ELEC_WEAK_INTER',  'ELEC_WEAK', 3, 'electrical', '인터폰',      ARRAY['비디오폰'], 20),
  ('ELEC_WEAK_FIRE',   'ELEC_WEAK', 3, 'electrical', '화재감지기',  ARRAY['연기감지기','열감지기'], 30),
  ('ELEC_WEAK_CCTV',   'ELEC_WEAK', 3, 'electrical', 'CCTV',        NULL, 40),
  ('ELEC_WEAK_ANT',    'ELEC_WEAK', 3, 'electrical', 'TV 안테나/증폭기', NULL, 50),
  ('ELEC_EARTH_ROD',   'ELEC_EARTH', 3, 'electrical', '접지봉',      NULL, 10),
  ('ELEC_EARTH_BAR',   'ELEC_EARTH', 3, 'electrical', '접지단자대',  NULL, 20),
  ('ELEC_PROTECT_ROD', 'ELEC_PROTECT', 3, 'electrical', '피뢰침',    ARRAY['피뢰도선'], 10),
  ('ELEC_PROTECT_ARRESTOR','ELEC_PROTECT',3,'electrical','서지어레스터', NULL, 20);

-- ============================================================
-- 설비 L3/L4
-- ============================================================

-- 급수
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_SUPPLY_PB',   'MECH_SUPPLY', 3, 'mechanical', 'PB 파이프',       ARRAY['폴리부틸렌'], 10),
  ('MECH_SUPPLY_PE',   'MECH_SUPPLY', 3, 'mechanical', 'PE 파이프',       NULL, 20),
  ('MECH_SUPPLY_XL',   'MECH_SUPPLY', 3, 'mechanical', '엑셀 파이프(XL)', ARRAY['X-L','온돌용'], 30),
  ('MECH_SUPPLY_CU',   'MECH_SUPPLY', 3, 'mechanical', '동관',            ARRAY['Copper'], 40),
  ('MECH_SUPPLY_SS',   'MECH_SUPPLY', 3, 'mechanical', '스테인리스관',     ARRAY['SUS'], 50),
  ('MECH_SUPPLY_GALV', 'MECH_SUPPLY', 3, 'mechanical', '아연도강관',       ARRAY['SPPS'], 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_SUPPLY_PB_15A', 'MECH_SUPPLY_PB', 4, 'mechanical', '15A', 'm', 10),
  ('MECH_SUPPLY_PB_20A', 'MECH_SUPPLY_PB', 4, 'mechanical', '20A', 'm', 20),
  ('MECH_SUPPLY_PB_25A', 'MECH_SUPPLY_PB', 4, 'mechanical', '25A', 'm', 30),
  ('MECH_SUPPLY_PB_32A', 'MECH_SUPPLY_PB', 4, 'mechanical', '32A', 'm', 40),
  ('MECH_SUPPLY_PB_40A', 'MECH_SUPPLY_PB', 4, 'mechanical', '40A', 'm', 50),
  ('MECH_SUPPLY_XL_15A', 'MECH_SUPPLY_XL', 4, 'mechanical', '15A', 'm', 10),
  ('MECH_SUPPLY_XL_20A', 'MECH_SUPPLY_XL', 4, 'mechanical', '20A', 'm', 20),
  ('MECH_SUPPLY_CU_15A', 'MECH_SUPPLY_CU', 4, 'mechanical', '15A', 'm', 10),
  ('MECH_SUPPLY_CU_20A', 'MECH_SUPPLY_CU', 4, 'mechanical', '20A', 'm', 20),
  ('MECH_SUPPLY_CU_25A', 'MECH_SUPPLY_CU', 4, 'mechanical', '25A', 'm', 30);

-- 배수
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_DRAIN_VG',   'MECH_DRAIN', 3, 'mechanical', 'PVC VG관',   ARRAY['일반배수'], 10),
  ('MECH_DRAIN_HI',   'MECH_DRAIN', 3, 'mechanical', 'PVC HI관',   ARRAY['내충격'], 20),
  ('MECH_DRAIN_KP',   'MECH_DRAIN', 3, 'mechanical', 'PVC KP관',   ARRAY['내열'], 30),
  ('MECH_DRAIN_CAST', 'MECH_DRAIN', 3, 'mechanical', '주철관',      NULL, 40),
  ('MECH_DRAIN_TRAP', 'MECH_DRAIN', 3, 'mechanical', '트랩/봉수',  ARRAY['S트랩','P트랩','드럼트랩'], 50),
  ('MECH_DRAIN_GULLY','MECH_DRAIN', 3, 'mechanical', '바닥배수구',  ARRAY['유가','배수트랩'], 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_DRAIN_VG_50',  'MECH_DRAIN_VG', 4, 'mechanical', '50Φ',  'm', 10),
  ('MECH_DRAIN_VG_75',  'MECH_DRAIN_VG', 4, 'mechanical', '75Φ',  'm', 20),
  ('MECH_DRAIN_VG_100', 'MECH_DRAIN_VG', 4, 'mechanical', '100Φ', 'm', 30),
  ('MECH_DRAIN_VG_125', 'MECH_DRAIN_VG', 4, 'mechanical', '125Φ', 'm', 40),
  ('MECH_DRAIN_VG_150', 'MECH_DRAIN_VG', 4, 'mechanical', '150Φ', 'm', 50),
  ('MECH_DRAIN_HI_50',  'MECH_DRAIN_HI', 4, 'mechanical', '50Φ',  'm', 10),
  ('MECH_DRAIN_HI_75',  'MECH_DRAIN_HI', 4, 'mechanical', '75Φ',  'm', 20),
  ('MECH_DRAIN_HI_100', 'MECH_DRAIN_HI', 4, 'mechanical', '100Φ', 'm', 30);

-- 피팅
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_FITTING_ELBOW',  'MECH_FITTING', 3, 'mechanical', '엘보',        ARRAY['90도','45도'], 10),
  ('MECH_FITTING_TEE',    'MECH_FITTING', 3, 'mechanical', '티',          ARRAY['T','분기티'], 20),
  ('MECH_FITTING_REDUCE', 'MECH_FITTING', 3, 'mechanical', '레듀샤',      ARRAY['이경소켓'], 30),
  ('MECH_FITTING_NIPPLE', 'MECH_FITTING', 3, 'mechanical', '니쁠',        ARRAY['니플','short nipple'], 40),
  ('MECH_FITTING_SVC',    'MECH_FITTING', 3, 'mechanical', '서비스니쁠',  ARRAY['service nipple','육각니쁠'], 50),
  ('MECH_FITTING_UNION',  'MECH_FITTING', 3, 'mechanical', '유니온',      ARRAY['Union'], 60),
  ('MECH_FITTING_CAP',    'MECH_FITTING', 3, 'mechanical', '캡',          ARRAY['막음마개'], 70),
  ('MECH_FITTING_SOCKET', 'MECH_FITTING', 3, 'mechanical', '소켓',        ARRAY['커플링'], 80),
  ('MECH_FITTING_FLANGE', 'MECH_FITTING', 3, 'mechanical', '플랜지',      NULL, 90);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, notes, sort_order) VALUES
  ('MECH_FITTING_ELBOW_15A', 'MECH_FITTING_ELBOW', 4, 'mechanical', '15A 90°', 'EA', NULL, 10),
  ('MECH_FITTING_ELBOW_20A', 'MECH_FITTING_ELBOW', 4, 'mechanical', '20A 90°', 'EA', NULL, 20),
  ('MECH_FITTING_ELBOW_25A', 'MECH_FITTING_ELBOW', 4, 'mechanical', '25A 90°', 'EA', NULL, 30),
  ('MECH_FITTING_ELBOW_32A', 'MECH_FITTING_ELBOW', 4, 'mechanical', '32A 90°', 'EA', NULL, 40),
  ('MECH_FITTING_ELBOW_45',  'MECH_FITTING_ELBOW', 4, 'mechanical', '45° 공통', 'EA', NULL, 50),
  ('MECH_FITTING_TEE_15A',   'MECH_FITTING_TEE',   4, 'mechanical', '15A',      'EA', NULL, 10),
  ('MECH_FITTING_TEE_20A',   'MECH_FITTING_TEE',   4, 'mechanical', '20A',      'EA', NULL, 20),
  ('MECH_FITTING_TEE_25A',   'MECH_FITTING_TEE',   4, 'mechanical', '25A',      'EA', NULL, 30),
  ('MECH_FITTING_SVC_15A',   'MECH_FITTING_SVC',   4, 'mechanical', '15A',      'EA', '수전 접속용', 10),
  ('MECH_FITTING_SVC_20A',   'MECH_FITTING_SVC',   4, 'mechanical', '20A',      'EA', NULL, 20),
  ('MECH_FITTING_UNION_15A', 'MECH_FITTING_UNION', 4, 'mechanical', '15A',      'EA', NULL, 10),
  ('MECH_FITTING_UNION_20A', 'MECH_FITTING_UNION', 4, 'mechanical', '20A',      'EA', NULL, 20);

-- 밸브
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_VALVE_BALL',  'MECH_VALVE', 3, 'mechanical', '볼밸브',     ARRAY['Ball Valve'], 10),
  ('MECH_VALVE_GATE',  'MECH_VALVE', 3, 'mechanical', '게이트밸브', ARRAY['슬루스'], 20),
  ('MECH_VALVE_CHECK', 'MECH_VALVE', 3, 'mechanical', '체크밸브',   ARRAY['역지밸브'], 30),
  ('MECH_VALVE_ANGLE', 'MECH_VALVE', 3, 'mechanical', '앵글밸브',   ARRAY['비데앵글'], 40),
  ('MECH_VALVE_PRV',   'MECH_VALVE', 3, 'mechanical', '감압밸브',   ARRAY['PRV'], 50),
  ('MECH_VALVE_STRAIN','MECH_VALVE', 3, 'mechanical', '스트레이너', NULL, 60),
  ('MECH_VALVE_WH',    'MECH_VALVE', 3, 'mechanical', '수격방지기', ARRAY['에어챔버'], 70);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_VALVE_BALL_15A', 'MECH_VALVE_BALL', 4, 'mechanical', '15A', 'EA', 10),
  ('MECH_VALVE_BALL_20A', 'MECH_VALVE_BALL', 4, 'mechanical', '20A', 'EA', 20),
  ('MECH_VALVE_BALL_25A', 'MECH_VALVE_BALL', 4, 'mechanical', '25A', 'EA', 30),
  ('MECH_VALVE_BALL_32A', 'MECH_VALVE_BALL', 4, 'mechanical', '32A', 'EA', 40),
  ('MECH_VALVE_ANGLE_15A','MECH_VALVE_ANGLE',4, 'mechanical', '15A', 'EA', 10),
  ('MECH_VALVE_ANGLE_20A','MECH_VALVE_ANGLE',4, 'mechanical', '20A', 'EA', 20);

-- 수전 (material_products 기존 FAUCET 카테고리와 대응)
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_rooms, aliases, sort_order) VALUES
  ('MECH_FAUCET_SHOWER', 'MECH_FAUCET', 3, 'mechanical', '샤워수전',   ARRAY['bathroom'], NULL, 10),
  ('MECH_FAUCET_BASIN',  'MECH_FAUCET', 3, 'mechanical', '세면수전',   ARRAY['bathroom','powder_room'], ARRAY['세면기수전'], 20),
  ('MECH_FAUCET_KITCHEN','MECH_FAUCET', 3, 'mechanical', '주방수전',   ARRAY['kitchen'], ARRAY['싱크수전'], 30),
  ('MECH_FAUCET_BIDET',  'MECH_FAUCET', 3, 'mechanical', '비데수전',   ARRAY['bathroom'], ARRAY['비데앵글수전'], 40),
  ('MECH_FAUCET_SENSOR', 'MECH_FAUCET', 3, 'mechanical', '센서수전',   ARRAY['bathroom','kitchen'], NULL, 50),
  ('MECH_FAUCET_UTIL',   'MECH_FAUCET', 3, 'mechanical', '다용도수전', ARRAY['veranda','utility'], ARRAY['세탁수전'], 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_FAUCET_SHOWER_STD',  'MECH_FAUCET_SHOWER', 4, 'mechanical', '표준 노출형',    'EA', 10),
  ('MECH_FAUCET_SHOWER_EMBED','MECH_FAUCET_SHOWER', 4, 'mechanical', '매립형',        'EA', 20),
  ('MECH_FAUCET_SHOWER_THERM','MECH_FAUCET_SHOWER', 4, 'mechanical', '항온(써모스탯)', 'EA', 30),
  ('MECH_FAUCET_SHOWER_DUAL', 'MECH_FAUCET_SHOWER', 4, 'mechanical', '2way(해바라기+핸드)', 'EA', 40),
  ('MECH_FAUCET_BASIN_STD',   'MECH_FAUCET_BASIN',  4, 'mechanical', '일반 스탠드형',  'EA', 10),
  ('MECH_FAUCET_BASIN_WALL',  'MECH_FAUCET_BASIN',  4, 'mechanical', '벽부형',        'EA', 20),
  ('MECH_FAUCET_KITCHEN_STD', 'MECH_FAUCET_KITCHEN',4, 'mechanical', '일반 싱크수전',  'EA', 10),
  ('MECH_FAUCET_KITCHEN_PULL','MECH_FAUCET_KITCHEN',4, 'mechanical', '풀아웃',        'EA', 20);

-- 위생도기 (기존 TOILET/VANITY/BATH 대응)
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_rooms, sort_order) VALUES
  ('MECH_SANITARY_WC',    'MECH_SANITARY', 3, 'mechanical', '양변기',    ARRAY['bathroom'], 10),
  ('MECH_SANITARY_URIN',  'MECH_SANITARY', 3, 'mechanical', '소변기',    ARRAY['bathroom_public'], 20),
  ('MECH_SANITARY_BASIN', 'MECH_SANITARY', 3, 'mechanical', '세면기',    ARRAY['bathroom','powder_room'], 30),
  ('MECH_SANITARY_TUB',   'MECH_SANITARY', 3, 'mechanical', '욕조',      ARRAY['bathroom'], 40),
  ('MECH_SANITARY_WASHLET','MECH_SANITARY',3, 'mechanical', '비데',      ARRAY['bathroom'], 50),
  ('MECH_SANITARY_PART',  'MECH_SANITARY', 3, 'mechanical', '샤워파티션',ARRAY['bathroom'], 60);

-- 난방
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_HEAT_FLOOR',    'MECH_HEAT', 3, 'mechanical', '바닥난방배관',  ARRAY['엑셀','XL','온돌배관'], 10),
  ('MECH_HEAT_MANIFOLD', 'MECH_HEAT', 3, 'mechanical', '분배기/헤더',  ARRAY['Manifold'], 20),
  ('MECH_HEAT_THERMO',   'MECH_HEAT', 3, 'mechanical', '온도조절기',    ARRAY['실내온도조절기'], 30),
  ('MECH_HEAT_RAD',      'MECH_HEAT', 3, 'mechanical', '라디에이터',   NULL, 40),
  ('MECH_HEAT_TOWEL',    'MECH_HEAT', 3, 'mechanical', '타월워머',      NULL, 50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_HEAT_FLOOR_16A',  'MECH_HEAT_FLOOR', 4, 'mechanical', '16A',  'm', 10),
  ('MECH_HEAT_FLOOR_20A',  'MECH_HEAT_FLOOR', 4, 'mechanical', '20A',  'm', 20),
  ('MECH_HEAT_MANIFOLD_2', 'MECH_HEAT_MANIFOLD',4,'mechanical','2구',  'EA', 10),
  ('MECH_HEAT_MANIFOLD_4', 'MECH_HEAT_MANIFOLD',4,'mechanical','4구',  'EA', 20),
  ('MECH_HEAT_MANIFOLD_6', 'MECH_HEAT_MANIFOLD',4,'mechanical','6구',  'EA', 30),
  ('MECH_HEAT_MANIFOLD_8', 'MECH_HEAT_MANIFOLD',4,'mechanical','8구',  'EA', 40);

-- HVAC
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_HVAC_DUCT',     'MECH_HVAC', 3, 'mechanical', '덕트',           ARRAY['원형','스파이럴'], 10),
  ('MECH_HVAC_DIFF',     'MECH_HVAC', 3, 'mechanical', '디퓨저/그릴',    NULL, 20),
  ('MECH_HVAC_EXHAUST',  'MECH_HVAC', 3, 'mechanical', '환풍기',         ARRAY['욕실환풍기','주방환풍기'], 30),
  ('MECH_HVAC_ERV',      'MECH_HVAC', 3, 'mechanical', '전열교환기',     ARRAY['ERV','전열교환'], 40),
  ('MECH_HVAC_AC',       'MECH_HVAC', 3, 'mechanical', '에어컨',         ARRAY['시스템에어컨','벽걸이'], 50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_HVAC_DUCT_100','MECH_HVAC_DUCT',4,'mechanical','100Φ','m',10),
  ('MECH_HVAC_DUCT_150','MECH_HVAC_DUCT',4,'mechanical','150Φ','m',20),
  ('MECH_HVAC_DUCT_200','MECH_HVAC_DUCT',4,'mechanical','200Φ','m',30),
  ('MECH_HVAC_DUCT_250','MECH_HVAC_DUCT',4,'mechanical','250Φ','m',40),
  ('MECH_HVAC_EXHAUST_BATH',   'MECH_HVAC_EXHAUST',4,'mechanical','욕실 환풍기',  'EA',10),
  ('MECH_HVAC_EXHAUST_KITCHEN','MECH_HVAC_EXHAUST',4,'mechanical','레인지후드',   'EA',20);

-- 가스
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_GAS_PIPE',  'MECH_GAS', 3, 'mechanical', '가스배관',  ARRAY['백관','SPPW'], 10),
  ('MECH_GAS_VALVE', 'MECH_GAS', 3, 'mechanical', '가스밸브',  NULL, 20),
  ('MECH_GAS_COCK',  'MECH_GAS', 3, 'mechanical', '가스콕',    ARRAY['가스레인지콕'], 30),
  ('MECH_GAS_METER', 'MECH_GAS', 3, 'mechanical', '가스계량기', NULL, 40);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_GAS_PIPE_15A','MECH_GAS_PIPE',4,'mechanical','15A','m',10),
  ('MECH_GAS_PIPE_20A','MECH_GAS_PIPE',4,'mechanical','20A','m',20),
  ('MECH_GAS_PIPE_25A','MECH_GAS_PIPE',4,'mechanical','25A','m',30);

-- 보일러
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('MECH_BOILER_GAS',   'MECH_BOILER', 3, 'mechanical', '가스보일러',     ARRAY['콘덴싱','일반'], 10),
  ('MECH_BOILER_OIL',   'MECH_BOILER', 3, 'mechanical', '기름보일러',     NULL, 20),
  ('MECH_BOILER_ELEC',  'MECH_BOILER', 3, 'mechanical', '전기보일러',     NULL, 30),
  ('MECH_BOILER_HEAT_PUMP','MECH_BOILER',3,'mechanical', '열펌프(하이브리드)', NULL, 40),
  ('MECH_BOILER_TANKLESS','MECH_BOILER',3,'mechanical', '순간온수기',     NULL, 50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, typical_unit, sort_order) VALUES
  ('MECH_BOILER_GAS_COND_16K', 'MECH_BOILER_GAS',4,'mechanical','콘덴싱 16,000kcal','EA',10),
  ('MECH_BOILER_GAS_COND_20K', 'MECH_BOILER_GAS',4,'mechanical','콘덴싱 20,000kcal','EA',20),
  ('MECH_BOILER_GAS_COND_25K', 'MECH_BOILER_GAS',4,'mechanical','콘덴싱 25,000kcal','EA',30),
  ('MECH_BOILER_GAS_COND_30K', 'MECH_BOILER_GAS',4,'mechanical','콘덴싱 30,000kcal','EA',40);

-- ============================================================
-- 건축 L3/L4 (기존 material_products 코드와 호환 매핑)
-- ============================================================
INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ARCH_FLOOR_LAM',    'ARCH_FLOOR', 3, 'architecture', '강마루',       ARRAY['Laminate','LVT상위'], 10),
  ('ARCH_FLOOR_ENG',    'ARCH_FLOOR', 3, 'architecture', '강화마루',     NULL, 20),
  ('ARCH_FLOOR_LVT',    'ARCH_FLOOR', 3, 'architecture', 'LVT/SPC',      ARRAY['SPC타일','석재계'], 30),
  ('ARCH_FLOOR_TILE',   'ARCH_FLOOR', 3, 'architecture', '포세린/자기타일', NULL, 40),
  ('ARCH_FLOOR_EPOXY',  'ARCH_FLOOR', 3, 'architecture', '에폭시 바닥',  NULL, 50),
  ('ARCH_FLOOR_WOOD',   'ARCH_FLOOR', 3, 'architecture', '원목마루',     NULL, 60),
  ('ARCH_FLOOR_BASE',   'ARCH_FLOOR', 3, 'architecture', '걸레받이',     ARRAY['몰딩'], 70);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ARCH_WALL_SILK',  'ARCH_WALL', 3, 'architecture', '실크벽지',   ARRAY['Silk wallpaper'], 10),
  ('ARCH_WALL_PAPER', 'ARCH_WALL', 3, 'architecture', '합지벽지',   NULL, 20),
  ('ARCH_WALL_3D',    'ARCH_WALL', 3, 'architecture', '3D벽지',     NULL, 30),
  ('ARCH_WALL_PAINT', 'ARCH_WALL', 3, 'architecture', '도장벽체',   ARRAY['페인트마감'], 40);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_TILE_CERAMIC','ARCH_TILE',3,'architecture','세라믹타일',10),
  ('ARCH_TILE_PORCEL', 'ARCH_TILE',3,'architecture','포세린타일',20),
  ('ARCH_TILE_MARBLE', 'ARCH_TILE',3,'architecture','대리석/석재타일',30),
  ('ARCH_TILE_MOSAIC', 'ARCH_TILE',3,'architecture','모자이크',40),
  ('ARCH_TILE_SUBWAY', 'ARCH_TILE',3,'architecture','서브웨이',50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ARCH_WIN_PVC',  'ARCH_WIN', 3, 'architecture', 'PVC 창호',   ARRAY['이중창','시스템창'], 10),
  ('ARCH_WIN_ALU',  'ARCH_WIN', 3, 'architecture', '알루미늄 창호', NULL, 20),
  ('ARCH_WIN_WOOD', 'ARCH_WIN', 3, 'architecture', '우드 창호',   NULL, 30);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ARCH_DOOR_ROOM',   'ARCH_DOOR', 3, 'architecture', '방문',     NULL, 10),
  ('ARCH_DOOR_ENTRY',  'ARCH_DOOR', 3, 'architecture', '현관문',   ARRAY['디지털도어'], 20),
  ('ARCH_DOOR_SLIDE',  'ARCH_DOOR', 3, 'architecture', '슬라이딩 도어', NULL, 30),
  ('ARCH_DOOR_POCKET', 'ARCH_DOOR', 3, 'architecture', '포켓 도어', NULL, 40),
  ('ARCH_DOOR_FOLD',   'ARCH_DOOR', 3, 'architecture', '폴딩 도어', NULL, 50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_CEIL_GYPSUM','ARCH_CEIL',3,'architecture','석고보드 천장',10),
  ('ARCH_CEIL_TBAR',  'ARCH_CEIL',3,'architecture','T-bar 천장',20),
  ('ARCH_CEIL_WOOD',  'ARCH_CEIL',3,'architecture','우드 천장',30),
  ('ARCH_CEIL_METAL', 'ARCH_CEIL',3,'architecture','메탈 천장',40);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, aliases, sort_order) VALUES
  ('ARCH_INSUL_EPS',  'ARCH_INSUL', 3, 'architecture', '비드법(EPS)',   ARRAY['스티로폼'], 10),
  ('ARCH_INSUL_XPS',  'ARCH_INSUL', 3, 'architecture', '압출법(XPS)',  NULL, 20),
  ('ARCH_INSUL_PU',   'ARCH_INSUL', 3, 'architecture', '우레탄폼',      ARRAY['경질우레탄'], 30),
  ('ARCH_INSUL_GLASS','ARCH_INSUL', 3, 'architecture', '그라스울',      ARRAY['유리섬유'], 40),
  ('ARCH_INSUL_MIN',  'ARCH_INSUL', 3, 'architecture', '미네랄울',      NULL, 50),
  ('ARCH_INSUL_PHENOL','ARCH_INSUL',3, 'architecture', '페놀폼',        NULL, 60);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_HARDWARE_HINGE', 'ARCH_HARDWARE',3,'architecture','경첩',10),
  ('ARCH_HARDWARE_LOCK',  'ARCH_HARDWARE',3,'architecture','도어락',20),
  ('ARCH_HARDWARE_HANDLE','ARCH_HARDWARE',3,'architecture','손잡이',30),
  ('ARCH_HARDWARE_RAIL',  'ARCH_HARDWARE',3,'architecture','슬라이딩 레일',40),
  ('ARCH_HARDWARE_CLOSER','ARCH_HARDWARE',3,'architecture','도어클로저',50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_KITCHEN_UPPER',  'ARCH_KITCHEN',3,'architecture','상부장',10),
  ('ARCH_KITCHEN_LOWER',  'ARCH_KITCHEN',3,'architecture','하부장',20),
  ('ARCH_KITCHEN_TOP',    'ARCH_KITCHEN',3,'architecture','상판(인조대리석/쿼츠)',30),
  ('ARCH_KITCHEN_SINK',   'ARCH_KITCHEN',3,'architecture','싱크볼',40),
  ('ARCH_KITCHEN_HOOD',   'ARCH_KITCHEN',3,'architecture','후드',50);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_BATH_VANITY', 'ARCH_BATH',3,'architecture','세면대 수납장',10),
  ('ARCH_BATH_MIRROR', 'ARCH_BATH',3,'architecture','거울/수납거울',20),
  ('ARCH_BATH_SHELF',  'ARCH_BATH',3,'architecture','수건걸이/선반',30),
  ('ARCH_BATH_PART',   'ARCH_BATH',3,'architecture','샤워파티션',40);

INSERT INTO category_taxonomy (code, parent_code, level, domain, name_ko, sort_order) VALUES
  ('ARCH_PAINT_WATER', 'ARCH_PAINT',3,'architecture','수성페인트',10),
  ('ARCH_PAINT_OIL',   'ARCH_PAINT',3,'architecture','유성페인트',20),
  ('ARCH_PAINT_FRICTION','ARCH_PAINT',3,'architecture','친환경/저VOC',30),
  ('ARCH_PAINT_BASE',  'ARCH_PAINT',3,'architecture','프라이머/실러',40);

COMMIT;

-- 결과 확인용 쿼리 (실행 후 참고):
-- SELECT level, COUNT(*) FROM category_taxonomy GROUP BY level ORDER BY level;
-- SELECT domain, COUNT(*) FROM category_taxonomy GROUP BY domain ORDER BY domain;
