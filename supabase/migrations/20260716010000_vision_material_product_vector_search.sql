-- AI 렌더에서 추출한 OpenCLIP 512d 임베딩을 실제 자재 제품 이미지와 비교한다.
-- 제품별 이미지가 여러 장이어도 가장 높은 유사도 1건만 반환한다.

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
  'OpenCLIP 512d 이미지 유사도와 카테고리로 material_products 실제 제품 후보를 검색한다.';
