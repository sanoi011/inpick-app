-- INPICK EXPO — 컨셉 이미지 갤러리 (최근 생성본 보관, 대표는 concept_image_url).

alter table public.expo_projects
  add column if not exists concept_images jsonb;

comment on column public.expo_projects.concept_images is
  '컨셉 이미지 갤러리 [{url, prompt, createdAt}] 최대 8장 — 전부 AI 컨셉(시공 기준 아님)';
