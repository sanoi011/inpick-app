-- INPICK EXPO — AI 컨셉 이미지 저장 (Phase 3 슬라이스).
-- 이미지 파일은 renders 버킷(Storage)에 있고 여기엔 URL만 저장한다.

alter table public.expo_projects
  add column if not exists concept_image_url text,
  add column if not exists concept_generated_at timestamptz;

comment on column public.expo_projects.concept_image_url is
  'AI 컨셉 이미지 URL (컨셉 전용 — 시공 기준 아님, geometry truth는 scene)';
