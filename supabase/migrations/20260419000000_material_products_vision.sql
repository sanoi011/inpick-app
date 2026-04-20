-- Vision 기반 정밀 견적 시스템 Stage 1: 건자재 이미지 DB
-- 출처: docs/vision-roadmap/01-material-db.md §3-1, §3-2, §3-3

-- ============================================================
-- 1) pgvector 확장
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2) material_products (건자재 제품)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 분류
  category_code TEXT NOT NULL,
  -- FLOORING | WALLPAPER | PAINT | CEILING | DOOR_ROOM | ENTRY_DOOR |
  -- BASEBOARD | LIGHTING | BATH_TILE | TOILET | VANITY | SHOWER_BATH |
  -- KITCHEN_SINK | KITCHEN_CABINET | KITCHEN_TILE | WINDOW | FILM | BATH_SET | STORAGE
  sub_category TEXT,

  -- 제품 정보
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_number TEXT,
  specification TEXT,
  description TEXT,

  -- 가격 (원)
  retail_price INTEGER,
  contractor_price INTEGER,
  labor_price INTEGER,
  unit TEXT NOT NULL DEFAULT 'EA',
  price_grade TEXT DEFAULT 'standard',
  -- economy | standard | premium

  -- 이미지
  thumbnail_url TEXT,
  texture_url TEXT,
  installed_photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  catalog_pdf_url TEXT,

  -- 시각 특성 (CLIP 매칭 보조)
  dominant_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
  pattern_type TEXT,
  surface_finish TEXT,
  material_texture TEXT,

  -- 제품 상세
  color_name TEXT,
  thickness TEXT,
  origin TEXT,
  warranty TEXT,

  -- 매칭 관련
  item_codes TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- 메타데이터
  data_source TEXT,
  source_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_category  ON material_products(category_code);
CREATE INDEX IF NOT EXISTS idx_mp_brand     ON material_products(brand);
CREATE INDEX IF NOT EXISTS idx_mp_grade     ON material_products(price_grade);
CREATE INDEX IF NOT EXISTS idx_mp_verified  ON material_products(is_verified);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mp_source_url ON material_products(source_url) WHERE source_url IS NOT NULL;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mp_updated_at ON material_products;
CREATE TRIGGER trg_mp_updated_at
  BEFORE UPDATE ON material_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3) material_embeddings (CLIP 임베딩)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES material_products(id) ON DELETE CASCADE,
  embedding_type TEXT NOT NULL,      -- 'texture' | 'installed' | 'thumbnail'
  embedding VECTOR(768),             -- OpenAI CLIP ViT-L/14
  source_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_me_cosine
  ON material_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_me_product ON material_embeddings(product_id);
CREATE INDEX IF NOT EXISTS idx_me_type    ON material_embeddings(embedding_type);

-- ============================================================
-- 4) 유사도 검색 RPC
-- ============================================================
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

-- ============================================================
-- 5) RLS
-- ============================================================
ALTER TABLE material_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read materials" ON material_products;
CREATE POLICY "Anyone can read materials"
  ON material_products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages materials" ON material_products;
CREATE POLICY "Service role manages materials"
  ON material_products FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can read embeddings" ON material_embeddings;
CREATE POLICY "Anyone can read embeddings"
  ON material_embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages embeddings" ON material_embeddings;
CREATE POLICY "Service role manages embeddings"
  ON material_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6) Storage 버킷 (material-images)
-- 주의: Storage 버킷 생성은 Dashboard > Storage > New bucket 으로도 수동 가능.
-- 아래는 SQL 기반 등록 방법.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('material-images', 'material-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책: 읽기 공개, 쓰기는 service_role만
DROP POLICY IF EXISTS "Public read material images" ON storage.objects;
CREATE POLICY "Public read material images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'material-images');

DROP POLICY IF EXISTS "Service role writes material images" ON storage.objects;
CREATE POLICY "Service role writes material images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'material-images' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'material-images' AND auth.role() = 'service_role');
