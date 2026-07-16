-- 실제 제품 이미지 인덱스의 중복 및 embedding provenance를 보장한다.

ALTER TABLE material_product_images
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_provider text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- 과거 재실행으로 같은 제품/URL이 중복된 경우 가장 오래된 1건만 유지한다.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY material_product_id, image_url
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM material_product_images
)
DELETE FROM material_product_images mpi
USING ranked
WHERE mpi.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mpi_product_image_url
  ON material_product_images(material_product_id, image_url);

CREATE INDEX IF NOT EXISTS idx_mpi_embedding_model
  ON material_product_images(embedding_model)
  WHERE clip_embedding IS NOT NULL;

COMMENT ON COLUMN material_product_images.embedding_model IS
  '벡터를 생성한 모델 ID. 승인 모델: openclip-vit-b-32-laion2b-s34b-b79k';
COMMENT ON COLUMN material_product_images.embedding_provider IS
  'runpod 등 실제 embedding 실행 제공자. mock 값은 운영 저장 금지';

-- 모델이 다른 벡터는 같은 공간에서 비교할 수 없으므로 승인 모델만 검색한다.
CREATE OR REPLACE FUNCTION match_material_product_images(
  query_embedding vector(512),
  category_filters text[],
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.15
)
RETURNS TABLE (
  product_id uuid,
  brand text,
  product_name text,
  model_number text,
  specification text,
  category_code text,
  unit text,
  retail_price integer,
  contractor_price integer,
  price_grade text,
  thumbnail_url text,
  image_url text,
  popularity_score integer,
  is_verified boolean,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      mp.id AS product_id,
      mp.brand,
      mp.product_name,
      mp.model_number,
      mp.specification,
      mp.category_code,
      mp.unit,
      mp.retail_price,
      mp.contractor_price,
      mp.price_grade,
      mp.thumbnail_url,
      mpi.image_url,
      mp.popularity_score,
      mp.is_verified,
      (1 - (mpi.clip_embedding <=> query_embedding))::double precision AS similarity,
      row_number() OVER (
        PARTITION BY mp.id
        ORDER BY mpi.clip_embedding <=> query_embedding
      ) AS product_image_rank
    FROM material_product_images mpi
    JOIN material_products mp ON mp.id = mpi.material_product_id
    WHERE mpi.clip_embedding IS NOT NULL
      AND mpi.embedding_model = 'openclip-vit-b-32-laion2b-s34b-b79k'
      AND (
        category_filters IS NULL
        OR cardinality(category_filters) = 0
        OR mp.category_code = ANY(category_filters)
      )
  )
  SELECT
    ranked.product_id,
    ranked.brand,
    ranked.product_name,
    ranked.model_number,
    ranked.specification,
    ranked.category_code,
    ranked.unit,
    ranked.retail_price,
    ranked.contractor_price,
    ranked.price_grade,
    ranked.thumbnail_url,
    ranked.image_url,
    ranked.popularity_score,
    ranked.is_verified,
    ranked.similarity
  FROM ranked
  WHERE ranked.product_image_rank = 1
    AND ranked.similarity >= similarity_threshold
  ORDER BY ranked.similarity DESC, ranked.is_verified DESC, ranked.popularity_score DESC NULLS LAST
  LIMIT LEAST(GREATEST(match_count, 1), 100);
$$;

REVOKE ALL ON FUNCTION match_material_product_images(vector, text[], integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_material_product_images(vector, text[], integer, double precision) TO service_role;

COMMENT ON FUNCTION match_material_product_images IS
  '승인된 OpenCLIP 모델로 생성한 실제 제품 이미지 벡터만 검색한다.';
