-- 510K 라벨 벡터 임베딩 저장 + HNSW 인덱스
-- pgvector 확장 활성화 + vision_embeddings 테이블 + 검색 함수
-- 2026-05-01 (P1 - BMEED 임베딩)

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 벡터 임베딩 테이블
CREATE TABLE IF NOT EXISTS vision_embeddings (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,                    -- 임베딩 원본 텍스트 (라벨 자연어화)
  embedding VECTOR(768) NOT NULL,        -- Gemini text-embedding-004 768d
  source VARCHAR(16),                    -- tier1 | tier2
  model VARCHAR(64),                     -- text-embedding-004

  -- 라벨 핵심 메타 (검색 필터용 — JSONB 풀 라벨은 별도 테이블)
  space VARCHAR(32),                     -- 거실/안방/침실 등
  style VARCHAR(32),                     -- modern/korean_traditional 등
  drawing_type VARCHAR(16),              -- plan/elevation 등
  trade_code VARCHAR(32),                -- ARCH_PLAN/CARP 등
  has_pair BOOLEAN DEFAULT FALSE,
  quality VARCHAR(2),                    -- A/B/C

  -- 한국 미감 + 자재 (배열로 저장)
  korean_aesthetic_tokens TEXT[],
  emotion_tags TEXT[],
  materials_simple TEXT[],

  -- 카테고리 (자동 추출 — path 의 디렉토리)
  category VARCHAR(64),                  -- emotion / loom / drawing_symbols 등

  ts TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_space ON vision_embeddings(space);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_style ON vision_embeddings(style);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_drawing_type ON vision_embeddings(drawing_type);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_trade_code ON vision_embeddings(trade_code);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_has_pair ON vision_embeddings(has_pair) WHERE has_pair = TRUE;
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_quality ON vision_embeddings(quality);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_category ON vision_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_korean_tokens ON vision_embeddings USING GIN(korean_aesthetic_tokens);
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_emotion_tags ON vision_embeddings USING GIN(emotion_tags);

-- 4. HNSW 벡터 인덱스 (검색 핵심)
-- M=16: 각 노드 연결 수 (메모리/품질 균형)
-- ef_construction=64: 인덱스 빌드 시 후보 수
CREATE INDEX IF NOT EXISTS idx_vision_embeddings_hnsw
  ON vision_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. RLS 정책 (관리자만 쓰기, 모두 읽기)
ALTER TABLE vision_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_embeddings_read_all" ON vision_embeddings
  FOR SELECT USING (TRUE);

CREATE POLICY "vision_embeddings_admin_write" ON vision_embeddings
  FOR ALL USING (auth.role() = 'service_role');

-- 6. 검색 함수 — VSMCS Constrained-kNN 의 Stage 1 (ANN) 부분
CREATE OR REPLACE FUNCTION search_vision_embeddings(
  query_embedding VECTOR(768),
  filter_space TEXT DEFAULT NULL,
  filter_style TEXT DEFAULT NULL,
  filter_drawing_type TEXT DEFAULT NULL,
  filter_trade_code TEXT DEFAULT NULL,
  filter_has_pair BOOLEAN DEFAULT NULL,
  filter_min_quality TEXT DEFAULT NULL,    -- 'A' or 'B' (이상)
  filter_korean_tokens TEXT[] DEFAULT NULL, -- 하나 이상 매칭
  filter_category TEXT DEFAULT NULL,
  match_count INT DEFAULT 20,
  ef_search INT DEFAULT 64
)
RETURNS TABLE (
  path TEXT,
  text TEXT,
  similarity FLOAT,
  space VARCHAR(32),
  style VARCHAR(32),
  korean_aesthetic_tokens TEXT[],
  materials_simple TEXT[],
  drawing_type VARCHAR(16),
  category VARCHAR(64)
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- HNSW ef_search 동적 조정
  PERFORM set_config('hnsw.ef_search', ef_search::TEXT, TRUE);

  RETURN QUERY
  SELECT
    ve.path,
    ve.text,
    1 - (ve.embedding <=> query_embedding) AS similarity,
    ve.space,
    ve.style,
    ve.korean_aesthetic_tokens,
    ve.materials_simple,
    ve.drawing_type,
    ve.category
  FROM vision_embeddings ve
  WHERE
    (filter_space IS NULL OR ve.space = filter_space)
    AND (filter_style IS NULL OR ve.style = filter_style)
    AND (filter_drawing_type IS NULL OR ve.drawing_type = filter_drawing_type)
    AND (filter_trade_code IS NULL OR ve.trade_code = filter_trade_code)
    AND (filter_has_pair IS NULL OR ve.has_pair = filter_has_pair)
    AND (filter_category IS NULL OR ve.category = filter_category)
    AND (
      filter_min_quality IS NULL
      OR (filter_min_quality = 'A' AND ve.quality = 'A')
      OR (filter_min_quality = 'B' AND ve.quality IN ('A', 'B'))
    )
    AND (
      filter_korean_tokens IS NULL
      OR ve.korean_aesthetic_tokens && filter_korean_tokens
    )
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. 통계 뷰
CREATE OR REPLACE VIEW vision_embeddings_stats AS
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE source = 'tier1') AS tier1_only,
  COUNT(*) FILTER (WHERE source = 'tier2') AS tier2_refined,
  COUNT(DISTINCT space) AS distinct_spaces,
  COUNT(DISTINCT style) AS distinct_styles,
  COUNT(DISTINCT category) AS distinct_categories,
  COUNT(*) FILTER (WHERE has_pair) AS has_pair_count,
  ROUND(AVG(array_length(korean_aesthetic_tokens, 1))::NUMERIC, 2) AS avg_korean_tokens,
  ROUND(AVG(array_length(materials_simple, 1))::NUMERIC, 2) AS avg_materials,
  pg_size_pretty(pg_total_relation_size('vision_embeddings')) AS table_size
FROM vision_embeddings;

COMMENT ON TABLE vision_embeddings IS
  'INPICK BMEED — Building Material Emotion Embedding Dataset (Patent A 구현)';
COMMENT ON FUNCTION search_vision_embeddings IS
  'INPICK VSMCS Stage 1 — Constrained-kNN ANN 검색 (Patent B 구현)';
