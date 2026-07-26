-- INPICK EXPO — 브랜드 킷 (Brand URL Importer, 블루프린트 §3.2/§3.3).
-- 후보가 아닌 "사용자가 확정한" 킷만 저장한다 (rightsConfirmed 포함).

alter table public.expo_projects
  add column if not exists brand jsonb;

comment on column public.expo_projects.brand is
  '확정된 브랜드 킷 {name, logoUrl, colorHex, sourceUrl, retrievedAt, rightsConfirmed}';
