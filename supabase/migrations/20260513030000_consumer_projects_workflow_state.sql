-- P8: 사용자×프로젝트 단위 워크플로 상태 영속화.
-- consumer_projects에 workflow_state JSONB 컬럼 추가.
-- /workflow/page.tsx + /workflow/estimate/page.tsx에서 mount 시 복원 + 변경 시 자동 저장.
alter table consumer_projects
  add column if not exists workflow_state jsonb;

create index if not exists idx_consumer_projects_user_updated
  on consumer_projects(user_id, updated_at desc);

comment on column consumer_projects.workflow_state is
  '워크플로 페이지 상태 — { step1, step2, contextId, lastStep } JSONB. 이미지 URL은 design_outputs DB에서 별도 관리 (base64는 제외).';
