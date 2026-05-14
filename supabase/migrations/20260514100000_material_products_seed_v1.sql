-- material_products seed v1 — P16-5 매칭 진단 결과 자주 fallback 되던 카테고리 보강
-- 한국 주거 인테리어 시장 대표 SKU (3등급: economy/standard/premium)
-- 가격: 2025년 평균 시세 (소매 기준, 원/단위). 시공비 별도(labor_price).
-- idempotent: source_url UNIQUE 활용 (ux_mp_source_url)

-- ─── §1. 바닥재 — 강마루 ──────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-FLR-ENGINEERED', '강마루', '동화자연마루', 'AVA 일반등급', '8T x 192 x 1212mm',
    62000, 52000, 35000, 'm2', 'economy',
    'seed_v1', 'inpick://seed/MAT-FLR-ENGINEERED/economy', TRUE),
  ('MAT-FLR-ENGINEERED', '강마루', '이건마루', 'Best 표준등급', '8T x 192 x 1212mm',
    78000, 66000, 38000, 'm2', 'standard',
    'seed_v1', 'inpick://seed/MAT-FLR-ENGINEERED/standard', TRUE),
  ('MAT-FLR-ENGINEERED', '강마루', '구정마루', 'NaturalLuxury 고급', '12T x 220 x 1820mm 헤링본',
    120000, 100000, 48000, 'm2', 'premium',
    'seed_v1', 'inpick://seed/MAT-FLR-ENGINEERED/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §2. 바닥재 — 포세린 타일 ─────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-FLR-PORCELAIN', '폴리싱', '한솔홈데코', '폴리싱 베이지', '600x600x9.8T',
    25000, 22000, 30000, 'm2', 'economy',
    'seed_v1', 'inpick://seed/MAT-FLR-PORCELAIN/economy', TRUE),
  ('MAT-FLR-PORCELAIN', '폴리싱', '유로세라믹', 'Carrara White', '600x1200x9.8T',
    48000, 42000, 35000, 'm2', 'standard',
    'seed_v1', 'inpick://seed/MAT-FLR-PORCELAIN/standard', TRUE),
  ('MAT-FLR-PORCELAIN', '대형타일', '이탈리아 직수입', 'Calacatta Gold', '900x1800x9.8T 광택',
    98000, 85000, 55000, 'm2', 'premium',
    'seed_v1', 'inpick://seed/MAT-FLR-PORCELAIN/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §3. 벽지 — 실크 ────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-WAL-WALLPAPER-SILK', '실크', 'LX하우시스', 'Z-IN 일반', '폭 1062mm, 친환경1등급',
    12000, 9500, 8000, 'm2', 'economy',
    'seed_v1', 'inpick://seed/MAT-WAL-WALLPAPER-SILK/economy', TRUE),
  ('MAT-WAL-WALLPAPER-SILK', '실크', '신한벽지', 'EcoSilk 표준', '폭 1062mm, 친환경1등급',
    18000, 14500, 9000, 'm2', 'standard',
    'seed_v1', 'inpick://seed/MAT-WAL-WALLPAPER-SILK/standard', TRUE),
  ('MAT-WAL-WALLPAPER-SILK', '실크', '디아이디', 'Premium Silk', '폭 1062mm, 항균/방염',
    28000, 23000, 11000, 'm2', 'premium',
    'seed_v1', 'inpick://seed/MAT-WAL-WALLPAPER-SILK/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §4. 도장 ──────────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-WAL-PAINT', '수성도장', '삼화페인트', '홈앤', '4L, 친환경 무광',
    35000, 30000, 12000, 'L', 'economy',
    'seed_v1', 'inpick://seed/MAT-WAL-PAINT/economy', TRUE),
  ('MAT-WAL-PAINT', '수성도장', '노루페인트', '순앤수 EcoComfort', '4L, EL인증 친환경',
    55000, 47000, 15000, 'L', 'standard',
    'seed_v1', 'inpick://seed/MAT-WAL-PAINT/standard', TRUE),
  ('MAT-WAL-PAINT', '수성도장', 'Benjamin Moore', 'Aura Interior', '3.78L, 친환경 프리미엄',
    140000, 120000, 22000, 'L', 'premium',
    'seed_v1', 'inpick://seed/MAT-WAL-PAINT/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §5. 조명 — 다운라이트 ───────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('ELE-LGT-DOWNLIGHT', '매입형', '금호전기', 'LED Downlight 8W', 'Φ100, 3000K/6500K',
    8500, 6800, 8000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/ELE-LGT-DOWNLIGHT/economy', TRUE),
  ('ELE-LGT-DOWNLIGHT', '매입형', '오스람', 'COB 10W', 'Φ100, CRI 90+',
    16000, 13000, 8000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/ELE-LGT-DOWNLIGHT/standard', TRUE),
  ('ELE-LGT-DOWNLIGHT', '매입형', 'Philips', 'CoreLine 12W Tunable', 'Φ100, dim2warm',
    35000, 28000, 9000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/ELE-LGT-DOWNLIGHT/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §6. 조명 — 거실/방등 ────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('ELE-LGT-CEILING', '방등', '이라이팅', 'Slim Edge', '50W, 600x600, 3000K~6500K',
    78000, 65000, 12000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/ELE-LGT-CEILING/economy', TRUE),
  ('ELE-LGT-CEILING', '거실등', '원우LED', '아트랙 III', '120W, 800x800, 직간접',
    180000, 150000, 15000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/ELE-LGT-CEILING/standard', TRUE),
  ('ELE-LGT-CEILING', '거실등', '필립스 Hue', 'Aurelle Tunable', '60W, 색온도가변, 앱연동',
    420000, 360000, 25000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/ELE-LGT-CEILING/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §7. 위생기구 — 양변기 ───────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-SAN-TOILET', '일반형', '대림바스', 'CC-241', '직배수 일반형 1피스',
    220000, 180000, 45000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-SAN-TOILET/economy', TRUE),
  ('MEC-SAN-TOILET', '일체형', '계림요업', 'CL-401', '일체형, 절수형 4L',
    380000, 320000, 50000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-SAN-TOILET/standard', TRUE),
  ('MEC-SAN-TOILET', '비데일체', 'TOTO', 'CES980 비데일체', '리모컨식, 자동개폐',
    1200000, 1000000, 80000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-SAN-TOILET/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §8. 위생기구 — 세면대 ───────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-SAN-BASIN', '카운터', '대림바스', 'CL-303', '카운터 매립형 500x420',
    95000, 80000, 35000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-SAN-BASIN/economy', TRUE),
  ('MEC-SAN-BASIN', '반매립', 'PARETO', 'SemiUnder 580', '반매립형 580x430',
    180000, 150000, 40000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-SAN-BASIN/standard', TRUE),
  ('MEC-SAN-BASIN', '탑볼', 'Duravit', 'Vero Air 600', '탑볼 디자인 600',
    520000, 440000, 55000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-SAN-BASIN/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §9. 수전 — 세면 ────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-FAU-BASIN', '냉온수', '대림바스', 'DL-B1003', '냉온수 일반형',
    52000, 44000, 18000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-FAU-BASIN/economy', TRUE),
  ('MEC-FAU-BASIN', '냉온수', '더죤', 'TheJohn 1100', '7년 무상AS',
    120000, 100000, 20000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-FAU-BASIN/standard', TRUE),
  ('MEC-FAU-BASIN', '냉온수', 'GROHE', 'Eurosmart Cosmo', '독일 직수입',
    280000, 230000, 28000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-FAU-BASIN/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §10. 수전 — 주방 ──────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-FAU-KITCHEN', '인덕션호환', '대림바스', 'DL-K2200', '회전형 일반',
    85000, 72000, 20000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-FAU-KITCHEN/economy', TRUE),
  ('MEC-FAU-KITCHEN', '하이체크', '더죤', 'TheJohn K1500', '회전+높이형, 스프레이',
    180000, 150000, 22000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-FAU-KITCHEN/standard', TRUE),
  ('MEC-FAU-KITCHEN', '풀아웃', 'GROHE', 'Minta Pull-out', '풀아웃 + 듀얼스프레이',
    420000, 360000, 30000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-FAU-KITCHEN/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §11. 욕조 ─────────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-SAN-BATHTUB', '아크릴', '대림바스', '베이직 1500', '1500x720x420',
    280000, 240000, 60000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-SAN-BATHTUB/economy', TRUE),
  ('MEC-SAN-BATHTUB', '아크릴', '아메리칸스탠다드', 'Studio 1600', '1600x750x440',
    480000, 410000, 70000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-SAN-BATHTUB/standard', TRUE),
  ('MEC-SAN-BATHTUB', '독립형', 'Duravit', 'DuraStyle 독립형', '1700x800 자립형',
    1500000, 1280000, 120000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-SAN-BATHTUB/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §12. 주방가구 — 하부장 ────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('FUR-KIT-LOWER-CAB', 'PET', '한샘', 'KITCHEN BACH 일반', 'PET도어, 일반 손잡이',
    580000, 490000, 65000, 'm', 'economy',
    'seed_v1', 'inpick://seed/FUR-KIT-LOWER-CAB/economy', TRUE),
  ('FUR-KIT-LOWER-CAB', '하이그로시', '리바트', 'Aria Smart', '하이그로시, 소프트클로징',
    880000, 750000, 75000, 'm', 'standard',
    'seed_v1', 'inpick://seed/FUR-KIT-LOWER-CAB/standard', TRUE),
  ('FUR-KIT-LOWER-CAB', '원목/세라믹', '에넥스', 'Bellagio Premium', '원목 도어, 통합 손잡이',
    1450000, 1240000, 100000, 'm', 'premium',
    'seed_v1', 'inpick://seed/FUR-KIT-LOWER-CAB/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §13. 주방 상판 ────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('FUR-KIT-COUNTERTOP', '엔지니어드스톤', '한샘', 'Tristone STD', '20T x 600 일반',
    180000, 150000, 40000, 'm', 'economy',
    'seed_v1', 'inpick://seed/FUR-KIT-COUNTERTOP/economy', TRUE),
  ('FUR-KIT-COUNTERTOP', '엔지니어드스톤', '큐스톤', 'Caesarstone 표준', '20T x 600',
    320000, 280000, 50000, 'm', 'standard',
    'seed_v1', 'inpick://seed/FUR-KIT-COUNTERTOP/standard', TRUE),
  ('FUR-KIT-COUNTERTOP', '세라믹/대리석', 'Dekton', '12T 세라믹', '12T x 600, 무이음',
    680000, 580000, 80000, 'm', 'premium',
    'seed_v1', 'inpick://seed/FUR-KIT-COUNTERTOP/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §14. 후드 ─────────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('FUR-KIT-HOOD', '벽부착', '하츠', 'HVB-905', '900mm, 800CMH',
    320000, 270000, 50000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/FUR-KIT-HOOD/economy', TRUE),
  ('FUR-KIT-HOOD', '슬림형', 'SK매직', 'EHR-A2900', '900mm, 1200CMH, 슬림',
    580000, 490000, 55000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/FUR-KIT-HOOD/standard', TRUE),
  ('FUR-KIT-HOOD', '아일랜드', 'BOSCH', 'DIB97IM50', 'Island, 1300CMH',
    1850000, 1580000, 80000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/FUR-KIT-HOOD/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §15. 쿡탑 ─────────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('FUR-KIT-COOKTOP', '가스레인지', 'SK매직', 'CRG-300', '3구 가스레인지',
    280000, 240000, 40000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/FUR-KIT-COOKTOP/economy', TRUE),
  ('FUR-KIT-COOKTOP', '인덕션', '쿠첸', 'EFW-N31IND', '3구 인덕션 6.7kW',
    780000, 660000, 60000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/FUR-KIT-COOKTOP/standard', TRUE),
  ('FUR-KIT-COOKTOP', '인덕션', 'Miele', 'KM 7464 FL', '4구 인덕션 7.4kW',
    2800000, 2400000, 80000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/FUR-KIT-COOKTOP/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §16. 창호 — PVC ──────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-WDW-PVC', '이중창', 'LX하우시스', '수퍼세이브 II', '이중 22mm 유리, 일반',
    280000, 240000, 60000, 'm2', 'economy',
    'seed_v1', 'inpick://seed/MAT-WDW-PVC/economy', TRUE),
  ('MAT-WDW-PVC', '시스템', 'KCC', '클렌즈 시스템', 'TripleGlass 36mm, 단열',
    450000, 380000, 75000, 'm2', 'standard',
    'seed_v1', 'inpick://seed/MAT-WDW-PVC/standard', TRUE),
  ('MAT-WDW-PVC', '시스템', 'EAGON', 'Premium PVC', '시스템 창호, 패시브하우스',
    780000, 660000, 100000, 'm2', 'premium',
    'seed_v1', 'inpick://seed/MAT-WDW-PVC/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §17. 방문 — ABS 도어 ─────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-DOOR-ABS', 'ABS', '영림', 'YL-200', '900x2100, 일반 ABS',
    180000, 150000, 50000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MAT-DOOR-ABS/economy', TRUE),
  ('MAT-DOOR-ABS', 'ABS', '예림임업', 'YESLIM Smart', '900x2100, 무모티프 슬림',
    280000, 240000, 55000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MAT-DOOR-ABS/standard', TRUE),
  ('MAT-DOOR-ABS', 'ABS', '우딘', 'Premium Loft', '900x2400, 히든프레임',
    480000, 410000, 70000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MAT-DOOR-ABS/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §18. 천장 — 욕실 SMC ─────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MAT-CEI-SMC', 'SMC', '일진', 'IJ-Bath Standard', '600x600, 환기구포함',
    35000, 28000, 18000, 'm2', 'economy',
    'seed_v1', 'inpick://seed/MAT-CEI-SMC/economy', TRUE),
  ('MAT-CEI-SMC', 'SMC', '대림B&Co', 'BathTop Premium', '600x600, 무광 마감',
    55000, 46000, 22000, 'm2', 'standard',
    'seed_v1', 'inpick://seed/MAT-CEI-SMC/standard', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §19. 도어락 ─────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('ELE-SEC-DOORLOCK', '키패드', '삼성SDS', 'SHP-DP740', '키패드 + 카드',
    180000, 150000, 40000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/ELE-SEC-DOORLOCK/economy', TRUE),
  ('ELE-SEC-DOORLOCK', '지문', '게이트맨', 'WF-200', '지문 + 키패드',
    280000, 240000, 50000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/ELE-SEC-DOORLOCK/standard', TRUE),
  ('ELE-SEC-DOORLOCK', '얼굴인식', '삼성SDS', 'SHP-DR708', '얼굴인식 + IoT',
    580000, 490000, 60000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/ELE-SEC-DOORLOCK/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §20. 보일러 ────────────────────────────────────
INSERT INTO material_products
  (category_code, sub_category, brand, product_name, specification,
   retail_price, contractor_price, labor_price, unit, price_grade,
   data_source, source_url, is_verified)
VALUES
  ('MEC-HEAT-BOILER', '일반형', '경동나비엔', 'NCB-15LSWE', '15kW 일반',
    750000, 640000, 120000, 'ea', 'economy',
    'seed_v1', 'inpick://seed/MEC-HEAT-BOILER/economy', TRUE),
  ('MEC-HEAT-BOILER', '콘덴싱', '경동나비엔', 'NCB571-22K', '22kW 콘덴싱 1등급',
    1280000, 1080000, 140000, 'ea', 'standard',
    'seed_v1', 'inpick://seed/MEC-HEAT-BOILER/standard', TRUE),
  ('MEC-HEAT-BOILER', '콘덴싱+IoT', '귀뚜라미', 'CRH-30FUW', '30kW 콘덴싱 + 스마트',
    1980000, 1680000, 160000, 'ea', 'premium',
    'seed_v1', 'inpick://seed/MEC-HEAT-BOILER/premium', TRUE)
ON CONFLICT (source_url) DO UPDATE SET
  retail_price = EXCLUDED.retail_price,
  contractor_price = EXCLUDED.contractor_price,
  labor_price = EXCLUDED.labor_price,
  updated_at = NOW();

-- ─── §21. material_product_category_map 자동 백필 ─────
-- material_product_category_map(material_product_id, category_code) — 매칭 진단에서 활용
INSERT INTO material_product_category_map (material_product_id, category_code, confidence, source)
SELECT mp.id, mp.category_code, 1.0, 'seed_v1'
FROM material_products mp
WHERE mp.data_source = 'seed_v1'
ON CONFLICT (material_product_id, category_code) DO NOTHING;

COMMENT ON COLUMN material_products.data_source IS
  'seed_v1: P16-5 매칭 진단 결과 보강 시드 (2026-05-14)';
