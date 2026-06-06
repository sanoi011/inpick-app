-- 자재 자산화(B): material_products에 검색어 매핑 컬럼 추가.
-- 자재 미리보기 카드의 query(예: "헤링본 강마루")로 우리 소유 이미지를 조회하기 위함.

alter table material_products
  add column if not exists search_query text;

create index if not exists material_products_search_query_idx
  on material_products (search_query);
