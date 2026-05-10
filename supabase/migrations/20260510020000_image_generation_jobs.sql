-- ════════════════════════════════════════════════════════════════════════════
-- image_generation_jobs — Phase 2 async job 추적 테이블
-- 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
--        Prompt 2 (Async job 구조 추가)
--
-- 핵심:
--   - sync 모드: 사용 안 함 (기존 즉시 응답)
--   - async 모드: 모든 호출이 이 테이블에 행 생성 → 폴링으로 상태 조회
--   - RunPod backend: external_job_id에 RunPod의 jobId 매핑
--   - OpenAI backend: 현재 sync only (필요 시 async wrapper로 mock)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS image_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 호출자 (옵션 — 인증 없는 호출도 가능)
  user_id UUID,                               -- Supabase auth user (소비자)
  contractor_id UUID,                         -- specialty_contractors (사업자)

  -- 작업 상태 (state machine)
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),

  -- 백엔드 정보
  backend TEXT NOT NULL CHECK (backend IN ('openai', 'runpod')),
  model TEXT,                                 -- "gpt-image-2", "FLUX.2-klein-4b", ...
  external_job_id TEXT,                       -- RunPod /run 응답의 id

  -- 입력/출력
  request JSONB NOT NULL,                     -- RenderRoomRequest 직렬화
  result JSONB,                               -- RenderRoomResult 전체
  result_url TEXT,                            -- 최종 imageUrl (편의 컬럼)

  -- 메트릭
  cost_usd NUMERIC(10,4),
  elapsed_ms INTEGER,

  -- 에러 (실패 시)
  error TEXT,
  hint TEXT,
  model_status TEXT,                          -- blocked/billing/rate_limited/timeout/auth/unknown

  -- 추가 메타
  metadata JSONB DEFAULT '{}'::jsonb,         -- 디버그/추적

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ                    -- status = completed/failed 시 set
);

-- 사용자별 조회
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_user
  ON image_generation_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_contractor
  ON image_generation_jobs(contractor_id, created_at DESC);

-- 상태 폴링용 (active jobs만)
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_active
  ON image_generation_jobs(status, updated_at DESC)
  WHERE status IN ('queued', 'processing');

-- external_job_id로 RunPod 상태 sync
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_external
  ON image_generation_jobs(external_job_id) WHERE external_job_id IS NOT NULL;

-- updated_at 자동 갱신 trigger
CREATE OR REPLACE FUNCTION touch_image_gen_jobs_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- status가 completed/failed로 변경되면 completed_at set
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_image_gen_jobs ON image_generation_jobs;
CREATE TRIGGER trg_touch_image_gen_jobs
BEFORE UPDATE ON image_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION touch_image_gen_jobs_updated_at();

-- RLS — 사용자 인증/소유권 검증은 API 레이어 (createAdminClient + 명시 쿼리)
ALTER TABLE image_generation_jobs ENABLE ROW LEVEL SECURITY;
-- 정책 없음 → service_role 전용 (admin client만 read/write)

COMMENT ON TABLE image_generation_jobs IS 'Phase 2 async image generation job tracking. RunPod runsync 대안 + 폴링용.';
COMMENT ON COLUMN image_generation_jobs.external_job_id IS 'RunPod /run 응답의 id. polling 시 /status/{id}로 조회';
COMMENT ON COLUMN image_generation_jobs.result IS 'RenderRoomResult 전체 직렬화 (debug + audit)';
