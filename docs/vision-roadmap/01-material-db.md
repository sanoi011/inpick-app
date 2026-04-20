# Stage 1: 건자재 이미지 DB 구축

> 예상 기간: 2주
> 선행 조건: Supabase Pro (완료), pgvector 확장 활성화

---

## 1. 목표

한국 인테리어 시장의 실제 건자재 제품 1,000개를 DB화.
각 제품에 대해 **이미지 + 스펙 + 단가 + 시각 특성**을 구조화하여 저장.
Stage 3의 CLIP 임베딩 매칭과 Stage 4의 정밀 견적에 직접 연결.

---

## 2. 기술 스택

| 역할 | 기술 | 버전/스펙 | 비고 |
|------|------|----------|------|
| DB | Supabase PostgreSQL | 15+ | 운영 중 |
| 벡터 검색 | pgvector | 0.7+ | Supabase 내장 |
| 이미지 저장 | Supabase Storage | - | CDN 포함 |
| 크롤링 | Playwright + Crawlee | latest | `scripts/crawlers/` |
| 이미지 전처리 | Sharp (Node.js) | 0.33+ | 리사이즈/크롭 |
| 데이터 정제 | Gemini 2.5 Pro | - | 구조화 추출 |
| PDF 파싱 | PyMuPDF + Gemini Vision | - | 카탈로그 처리 |
| 색상 추출 | sharp + color-thief | - | dominant color |

---

## 3. DB 스키마

### 3-1. material_products (건자재 제품)

```sql
CREATE TABLE material_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 분류
  category_code TEXT NOT NULL,
  -- FLOORING | WALLPAPER | PAINT | CEILING | DOOR_ROOM | ENTRY_DOOR |
  -- BASEBOARD | LIGHTING | BATH_TILE | TOILET | VANITY | SHOWER_BATH |
  -- KITCHEN_SINK | KITCHEN_CABINET | KITCHEN_TILE | WINDOW
  
  sub_category TEXT,
  -- 바닥재: laminate(강마루) | engineered(강화마루) | solid_wood(원목) | SPC | vinyl(장판)
  -- 타일: porcelain(포세린) | ceramic(세라믹) | natural_stone(천연석) | mosaic
  -- 벽지: silk(실크) | hapji(합지) | point(포인트) | fabric(직물)
  
  -- 제품 정보
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_number TEXT,
  specification TEXT,           -- "1200x190x8mm T"
  description TEXT,             -- 제품 설명
  
  -- 가격 (원)
  retail_price INTEGER,         -- 소비자가 (자재만)
  contractor_price INTEGER,     -- 시공가 (자재만, 업자 매입가)
  labor_price INTEGER,          -- 시공비 (인건비)
  unit TEXT NOT NULL,           -- m² | EA | SET | LM | LOT
  price_grade TEXT DEFAULT 'standard',
  -- economy: 평당 150만원 이하
  -- standard: 평당 150~250만원
  -- premium: 평당 250만원 이상
  
  -- 이미지
  thumbnail_url TEXT,           -- 제품 대표 이미지 (Supabase Storage)
  texture_url TEXT,             -- 텍스처/패턴 이미지 (CLIP 매칭 핵심)
  installed_photo_urls TEXT[],  -- 시공 완료 사진들 (YOLO 학습 데이터)
  catalog_pdf_url TEXT,         -- 카탈로그 PDF 원본
  
  -- 시각 특성 (Vision 매칭용 메타데이터)
  dominant_colors TEXT[],       -- ["#8B6F47", "#A0845C", "#D4C5B0"]
  pattern_type TEXT,
  -- straight | herringbone | chevron | mosaic | subway | hexagon |
  -- plain | striped | floral | geometric
  
  surface_finish TEXT,
  -- matte | semi_gloss | gloss | textured | brushed | polished
  
  material_texture TEXT,
  -- wood_grain | stone | ceramic | marble | concrete | fabric | metal
  
  -- 제품 상세
  color_name TEXT,              -- 제조사 공식 색상명 ("내추럴 오크")
  thickness TEXT,               -- 두께 ("8mm", "12mm")
  origin TEXT,                  -- 원산지 ("국산", "독일")
  warranty TEXT,                -- 보증기간 ("10년")
  
  -- 매칭 관련
  item_codes TEXT[],            -- 연결되는 견적 itemCode ["07.MAIN"]
  
  -- 메타데이터
  data_source TEXT,             -- 크롤링 소스 URL
  is_verified BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_mp_category ON material_products(category_code);
CREATE INDEX idx_mp_brand ON material_products(brand);
CREATE INDEX idx_mp_grade ON material_products(price_grade);
CREATE INDEX idx_mp_verified ON material_products(is_verified);
```

### 3-2. material_embeddings (CLIP 임베딩)

```sql
-- pgvector 확장 필요
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE material_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES material_products(id) ON DELETE CASCADE,
  embedding_type TEXT NOT NULL,   -- 'texture' | 'installed' | 'thumbnail'
  embedding VECTOR(768),          -- OpenAI CLIP ViT-L/14
  source_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 코사인 유사도 검색 인덱스
CREATE INDEX idx_me_cosine
  ON material_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_me_product ON material_embeddings(product_id);
CREATE INDEX idx_me_type ON material_embeddings(embedding_type);

-- 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_materials(
  query_embedding VECTOR(768),
  category_filter TEXT,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  product_id UUID,
  brand TEXT,
  product_name TEXT,
  model_number TEXT,
  retail_price INTEGER,
  labor_price INTEGER,
  unit TEXT,
  thumbnail_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.brand,
    mp.product_name,
    mp.model_number,
    mp.retail_price,
    mp.labor_price,
    mp.unit,
    mp.thumbnail_url,
    1 - (me.embedding <=> query_embedding) AS similarity
  FROM material_embeddings me
  JOIN material_products mp ON mp.id = me.product_id
  WHERE mp.category_code = category_filter
    AND me.embedding_type = 'texture'
    AND 1 - (me.embedding <=> query_embedding) > similarity_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 3-3. RLS 정책

```sql
-- 읽기: 모든 사용자
ALTER TABLE material_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read materials"
  ON material_products FOR SELECT USING (true);

-- 쓰기: 관리자만 (서비스 키 또는 admin)
CREATE POLICY "Service role can manage materials"
  ON material_products FOR ALL
  USING (auth.role() = 'service_role');
```

---

## 4. 데이터 수집 계획

### 4-1. 1순위 (Stage 1-A, 1주차)

견적 금액 비중이 가장 큰 3개 카테고리. 시각 차이가 뚜렷하여 매칭 정확도 높음.

| 카테고리 | 목표 | 소스 | 수집 항목 |
|----------|------|------|----------|
| **바닥재** (FLOORING) | 50개 | 동화자연마루, LX하우시스, 한샘 | 강마루/강화마루/SPC/원목, 이미지, 단가, 패턴, 색상 |
| **타일** (BATH_TILE, KITCHEN_TILE) | 50개 | 이눅스, 동서타일 | 포세린/세라믹, 크기, 이미지, 단가 |
| **위생도기** (TOILET, VANITY, SHOWER_BATH) | 30개 | TOTO, 대림바스 | 양변기/세면대/샤워/욕조, 이미지, 단가 |

### 4-2. 2순위 (Stage 1-B, 2주차)

| 카테고리 | 목표 | 소스 |
|----------|------|------|
| **주방** (KITCHEN_*) | 40개 | 한샘, 에넥스 |
| **벽지** (WALLPAPER) | 40개 | 신한벽지, LG하우시스 |
| **문** (DOOR_*) | 30개 | 영림도어 |
| **조명** (LIGHTING) | 30개 | 필립스, KS조명 |

### 4-3. 데이터 품질 기준

| 필드 | 필수 | 검증 기준 |
|------|------|----------|
| brand, product_name | 필수 | 비어있으면 저장 안 함 |
| category_code | 필수 | 허용된 16개 코드 중 하나 |
| retail_price | 필수 | 양수, 현실적 범위 (1,000~10,000,000원) |
| thumbnail_url | 필수 | 이미지 접근 가능 확인 |
| texture_url | 권장 | CLIP 매칭에 필수, 없으면 thumbnail로 대체 |
| specification | 권장 | 규격 정보 |
| dominant_colors | 자동 | Sharp로 자동 추출 |

---

## 5. API 엔드포인트

### 5-1. 관리자용

```
GET    /api/admin/materials          ← 제품 목록 (필터/페이지네이션)
POST   /api/admin/materials          ← 제품 등록 (단건)
PATCH  /api/admin/materials/:id      ← 제품 수정
DELETE /api/admin/materials/:id      ← 제품 삭제
POST   /api/admin/materials/bulk     ← 일괄 등록 (크롤링 결과)
GET    /api/admin/materials/stats    ← 카테고리별 통계
```

### 5-2. 소비자용 (매칭 결과 조회)

```
GET    /api/materials/search         ← 카테고리 + 키워드 검색
GET    /api/materials/:id            ← 제품 상세
POST   /api/materials/match          ← 이미지 기반 유사 제품 검색 (Stage 3)
```

### 5-3. 관리자 건자재 관리 페이지

```
/admin/material-catalog             ← 신규 페이지
  - 카테고리 탭 (바닥재/타일/위생도기/주방/벽지/문/조명)
  - 제품 카드 그리드 (이미지 + 브랜드 + 가격)
  - 검색/필터 (브랜드, 등급, 검증여부)
  - 제품 등록/수정 모달
  - 크롤링 실행 버튼 → 결과 미리보기 → 확인 후 저장
  - 통계 대시보드 (카테고리별 제품 수, 검증률)
```

---

## 6. 파일 구조

```
src/
├── app/api/admin/materials/
│   ├── route.ts                    ← GET/POST 제품 CRUD
│   ├── [id]/route.ts               ← PATCH/DELETE 개별 제품
│   ├── bulk/route.ts               ← POST 일괄 등록
│   └── stats/route.ts              ← GET 통계
│
├── app/api/materials/
│   ├── route.ts                    ← GET 검색
│   ├── [id]/route.ts               ← GET 상세
│   └── match/route.ts              ← POST 이미지 매칭 (Stage 3)
│
├── app/admin/material-catalog/
│   └── page.tsx                    ← 관리자 건자재 페이지
│
├── types/
│   └── material-product.ts         ← MaterialProduct, MaterialEmbedding 타입
│
└── lib/services/
    └── material-db.ts              ← DB 조회/저장 서비스 함수

scripts/
├── migrations/
│   └── 20260414000000_material_products.sql
│
└── seed/
    └── seed-initial-materials.ts   ← 초기 시드 데이터
```

---

## 7. 체크리스트

- [ ] Supabase에 pgvector 확장 활성화 확인
- [ ] material_products 테이블 생성 (마이그레이션)
- [ ] material_embeddings 테이블 생성
- [ ] match_materials RPC 함수 생성
- [ ] MaterialProduct TypeScript 타입 정의
- [ ] 관리자 API (CRUD) 구현
- [ ] 소비자 API (검색/상세) 구현
- [ ] 관리자 건자재 관리 페이지 UI
- [ ] 1순위 크롤러 3개 작성 (동화자연마루, TOTO, 이눅스)
- [ ] Gemini 구조화 파싱 스크립트
- [ ] 이미지 → Supabase Storage 업로드 스크립트
- [ ] dominant_colors 자동 추출 스크립트
- [ ] 1순위 130개 제품 데이터 확보
- [ ] 2순위 크롤러 4개 작성
- [ ] 2순위 370개 제품 데이터 확보
- [ ] 전체 500개 데이터 품질 검증
