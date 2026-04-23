-- 2026-04-23: 공종별 부자재 마스터 + 견적 로직 부자재 계수 + 크롤링 타겟.
-- 소스: D:/InPick/data/InPick_공종별_부자재_완전판.xlsx
--       D:/08. 대영토건/김선본/인픽/inpick-app/reports/aux_materials_coefficient_template.xlsx
-- 총 3개 독립 테이블 (material_products 와 분리 — 부자재는 UI 카탈로그가 아니라 견적 엔진용 지식베이스).

-- 1) 공종별 자재 마스터 (337 rows)
CREATE TABLE IF NOT EXISTS aux_materials_master (
  id                bigserial PRIMARY KEY,
  sheet             text,                           -- 출처 시트명 ('4_목공사' 등)
  sheet_row         integer,                        -- 출처 행 번호 (추적성)
  trade             text NOT NULL,                  -- 철거/설비/전기/목공/... (원문)
  trade_code        text NOT NULL,                  -- DEMO/MECH/ELEC/CARP/...
  category          text,                           -- 분류 (본자재/부자재/소모품/목재/...)
  standard_name     text NOT NULL,                  -- 표준 자재명
  aliases           text[] DEFAULT ARRAY[]::text[], -- 현장 별칭
  spec              text,                           -- 규격/스펙
  unit              text,                           -- 단위 (장/m/㎡/L/kg/개 등)
  usage_type        text,                           -- 마감재/필수부자재/부자재/소모품
  manufacturers     text[] DEFAULT ARRAY[]::text[], -- 주 제조사/브랜드 목록
  price_low         integer,                        -- 가격 하단 (원)
  price_high        integer,                        -- 가격 상단 (원)
  price_range_text  text,                           -- 원본 가격 문자열
  note              text,                           -- 비고
  created_at        timestamptz DEFAULT now(),
  UNIQUE (trade_code, standard_name, spec)
);
CREATE INDEX IF NOT EXISTS idx_aux_master_trade        ON aux_materials_master (trade_code);
CREATE INDEX IF NOT EXISTS idx_aux_master_usage_type   ON aux_materials_master (usage_type);
CREATE INDEX IF NOT EXISTS idx_aux_master_aliases      ON aux_materials_master USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_aux_master_manufacturers ON aux_materials_master USING gin (manufacturers);

COMMENT ON TABLE aux_materials_master IS 'InPick 공종별 자재 완전판 마스터. 견적 엔진 부자재 지식베이스 (UI 카탈로그와 분리).';
COMMENT ON COLUMN aux_materials_master.trade_code IS 'DEMO/MECH/ELEC/CARP/WIN/INSL/GYPS/PLAS/WPAP/TILE/FLOR/PAIN/KIT/BATH/FURN/LGHT/FINI/CLN';

-- 2) 견적 로직 부자재 계수 (67 rows — 완전판 sheet17 + 계수 템플릿 결합)
CREATE TABLE IF NOT EXISTS aux_material_coefficients (
  id                   bigserial PRIMARY KEY,
  source               text NOT NULL,               -- 'full_sheet17' / 'template'
  trade                text,
  trade_code           text,
  main_material        text NOT NULL,               -- 주자재 (예: '일반 석고보드 9.5T')
  main_material_cat    text,                        -- 주자재 카테고리 (예: '석고보드')
  main_material_ref    text,                        -- 주자재 기준치 (예: '1장 (900×1800)')
  main_material_unit   text,                        -- 주자재 단위
  sub_material         text NOT NULL,               -- 부자재 품명
  sub_material_cat     text,                        -- 부자재 카테고리 (피스/본드/...)
  sub_material_unit    text,
  coefficient          numeric,                     -- 수치 계수 (NULL이면 formula_text 참조)
  loss_pct             numeric,                     -- 손실률(%)
  formula_text         text,                        -- 원본 공식 문자열 ('장당 30~40개')
  note                 text,
  created_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aux_coef_trade ON aux_material_coefficients (trade_code);
CREATE INDEX IF NOT EXISTS idx_aux_coef_main  ON aux_material_coefficients (main_material);

COMMENT ON TABLE aux_material_coefficients IS '견적 로직 부자재 계수. 주자재 1단위당 부자재 산출량 + 손실률.';

-- 3) 부자재 크롤링 우선순위 타겟 (44 rows)
CREATE TABLE IF NOT EXISTS aux_material_crawl_targets (
  id          bigserial PRIMARY KEY,
  priority    text,                                 -- P1/P2/P3/P4
  site        text NOT NULL,
  url         text,
  specialty   text,                                 -- 전문 분야
  coverage    text,                                 -- 품목 커버리지
  price_open  text,                                 -- 공개/비공개/일부
  difficulty  text,                                 -- 낮음/중간/높음
  note        text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (site, url)
);
CREATE INDEX IF NOT EXISTS idx_aux_targets_priority ON aux_material_crawl_targets (priority);

COMMENT ON TABLE aux_material_crawl_targets IS '부자재 크롤링 P1~P4 우선순위 사이트 목록.';
