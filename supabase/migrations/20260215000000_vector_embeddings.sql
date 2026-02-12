-- ============================================================
-- Vector Embeddings for RAG Pipeline
-- pgvector 확장 + construction_knowledge 임베딩 컬럼
-- ============================================================

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. construction_knowledge에 임베딩 컬럼 추가 (768차원, Gemini embedding-001)
ALTER TABLE construction_knowledge
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. HNSW 인덱스 (코사인 거리 기반, 자동 갱신)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON construction_knowledge
  USING hnsw (embedding vector_cosine_ops);

-- 4. 벡터 유사도 검색 RPC 함수
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  subcategory text,
  keywords text[],
  source_type text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.title,
    ck.content,
    ck.category,
    ck.subcategory,
    ck.keywords,
    ck.source_type,
    1 - (ck.embedding <=> query_embedding) AS similarity
  FROM construction_knowledge ck
  WHERE ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
