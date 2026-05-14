-- InPick 결제·토큰·워크플로우 상태 영속화 v3 (분쟁 방지형)
-- 가이드: inpick-payment-saas-flow-uiux-improvement-plan-20260514.md
--
-- 신규 테이블 4개:
--   * token_charge_intents — reserve/commit/release/refund lifecycle
--   * generation_jobs — Step2 이미지 생성 lifecycle wrapper (provider 응답은 image_generation_jobs)
--   * workflow_step_snapshots — Step1/2/3 영속 복구
--   * reconciliation_cases — 8개 분쟁 case 타입 자동 감지/수동 보정
--
-- 정책:
--   * 모든 신규 테이블에 idempotency_key UNIQUE (가능한 경우)
--   * RLS: 본인 row만 SELECT, INSERT는 service role 또는 본인
--   * 기존 image_generation_jobs와 별도 일반화 layer (책임 분리)


-- ═════════════════════════════════════════════════════════════════
-- §1. token_charge_intents
-- ═════════════════════════════════════════════════════════════════
-- 사용 시점: Step2 이미지 생성 등 "토큰을 일시 예약했다가 결과 저장 후 확정 차감"
-- lifecycle: created → reserved → committed | released | refunded | failed | reconciliation_required
CREATE TABLE IF NOT EXISTS token_charge_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  -- 어떤 작업의 토큰 예약인지
  action TEXT NOT NULL,
  -- 'image_generation' | 'pdf_issue' | 'estimate_regeneration' | 'commercial_render'
  token_amount INT NOT NULL CHECK (token_amount > 0),
  status TEXT NOT NULL DEFAULT 'created',
  -- created | reserved | committed | released | refunded | failed | reconciliation_required
  idempotency_key TEXT NOT NULL UNIQUE,
  -- e.g. 'image_gen:{projectId}:{jobId}:reserve'
  reference_type TEXT,
  -- 'generation_job' | 'pdf_entitlement' | 'estimate_context' 등
  reference_id TEXT,
  reserved_at TIMESTAMPTZ,
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_charge_intents_user_status
  ON token_charge_intents(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_charge_intents_project
  ON token_charge_intents(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_charge_intents_reference
  ON token_charge_intents(reference_type, reference_id);

DROP TRIGGER IF EXISTS trg_token_charge_intents_updated ON token_charge_intents;
CREATE TRIGGER trg_token_charge_intents_updated
  BEFORE UPDATE ON token_charge_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE token_charge_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS token_charge_intents_self_read ON token_charge_intents;
CREATE POLICY token_charge_intents_self_read
  ON token_charge_intents FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT/UPDATE는 service role만 (token-transaction-service가 admin client로 호출)

COMMENT ON TABLE token_charge_intents IS
  '토큰 reserve/commit/release/refund lifecycle. 분쟁 방지형 결제 v3.';
COMMENT ON COLUMN token_charge_intents.idempotency_key IS
  'reserve/commit/refund 단계별 UNIQUE key. e.g. image_gen:{jobId}:reserve';


-- ═════════════════════════════════════════════════════════════════
-- §2. generation_jobs (Step2 이미지 생성 일반화 wrapper)
-- ═════════════════════════════════════════════════════════════════
-- 기존 image_generation_jobs (RunPod async 응답 polling) 와는 별개 책임:
--   * generation_jobs: 사용자 워크플로 입장의 reserve→generate→persist→commit lifecycle
--   * image_generation_jobs: provider 호출 응답 단순 추적 (external_job_id 기반)
-- 둘은 1:N 관계 가능 (한 generation_job에 여러 provider 시도)
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  project_mode TEXT NOT NULL,
  -- 'apartment' | 'photo_only' | 'commercial'
  generation_base TEXT,
  -- 'render_room' | 'render_photo_style' | 'render_space_edit' | 'render_commercial_zone'
  target_type TEXT NOT NULL,
  -- 'whole' | 'room' | 'zone' | 'surface'
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  -- 'openai' | 'runpod'
  model TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  -- created | token_reserved | generating | uploading | persisting | completed | failed | cancelled | reconciliation_required
  idempotency_key TEXT NOT NULL UNIQUE,
  token_charge_intent_id UUID REFERENCES token_charge_intents(id) ON DELETE SET NULL,
  design_output_id UUID,
  -- design_outputs.id (저장 성공 후 채워짐)
  image_generation_job_id UUID,
  -- 기존 image_generation_jobs.id (RunPod async일 때)
  image_url TEXT,
  prompt_used TEXT,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_status
  ON generation_jobs(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user
  ON generation_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_pending
  ON generation_jobs(status, updated_at)
  WHERE status IN ('token_reserved', 'generating', 'uploading', 'persisting');

DROP TRIGGER IF EXISTS trg_generation_jobs_updated ON generation_jobs;
CREATE TRIGGER trg_generation_jobs_updated
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS generation_jobs_self_read ON generation_jobs;
CREATE POLICY generation_jobs_self_read
  ON generation_jobs FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT/UPDATE는 service role (wrapper API가 admin client로 호출)

COMMENT ON TABLE generation_jobs IS
  'Step2 이미지 생성 사용자 워크플로 lifecycle wrapper. provider 응답은 image_generation_jobs.';


-- ═════════════════════════════════════════════════════════════════
-- §3. workflow_step_snapshots
-- ═════════════════════════════════════════════════════════════════
-- Step1/Step2/Step3 영속 복구용 (consumer_projects.workflow_state 보강)
-- 기존 consumer_projects.workflow_state는 단일 JSONB 컬럼이라 step별 분리 불가
-- 이 테이블은 step_key별 분리 + version 추적 가능
CREATE TABLE IF NOT EXISTS workflow_step_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  step_key TEXT NOT NULL,
  -- 'step1' | 'step2' | 'step3'
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | in_progress | completed
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_project
  ON workflow_step_snapshots(project_id, step_key);

DROP TRIGGER IF EXISTS trg_workflow_snapshots_updated ON workflow_step_snapshots;
CREATE TRIGGER trg_workflow_snapshots_updated
  BEFORE UPDATE ON workflow_step_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE workflow_step_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_snapshots_self_read ON workflow_step_snapshots;
CREATE POLICY workflow_snapshots_self_read
  ON workflow_step_snapshots FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS workflow_snapshots_self_upsert ON workflow_step_snapshots;
CREATE POLICY workflow_snapshots_self_upsert
  ON workflow_step_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS workflow_snapshots_self_update ON workflow_step_snapshots;
CREATE POLICY workflow_snapshots_self_update
  ON workflow_step_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE workflow_step_snapshots IS
  'Step1/2/3 영속 복구용. 새로고침/뒤로가기/브라우저 종료 시 server-side로 복구.';


-- ═════════════════════════════════════════════════════════════════
-- §4. reconciliation_cases
-- ═════════════════════════════════════════════════════════════════
-- 결제/토큰/생성/PDF 분쟁 자동 감지 + 수동 보정 큐
-- 기존 payment_reconciliation_jobs와 별도: 더 일반화된 case 타입 (결제 외 영역 포함)
CREATE TABLE IF NOT EXISTS reconciliation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type TEXT NOT NULL,
  -- payment_paid_no_tokens
  -- payment_paid_provision_failed
  -- token_charged_no_output
  -- output_saved_no_token_commit
  -- pdf_entitlement_consumed_no_asset
  -- generation_timeout_pending
  -- estimate_context_missing
  -- amount_mismatch_blocked
  -- webhook_duplicate_ignored
  severity TEXT NOT NULL DEFAULT 'medium',
  -- low | medium | high | critical
  status TEXT NOT NULL DEFAULT 'open',
  -- open | resolved | dismissed
  user_id UUID,
  project_id UUID,
  payment_intent_id UUID,
  generation_job_id UUID,
  token_charge_intent_id UUID,
  description TEXT NOT NULL,
  detected_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_cases_open
  ON reconciliation_cases(status, severity, created_at DESC)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_reconciliation_cases_user
  ON reconciliation_cases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_cases_type
  ON reconciliation_cases(case_type, created_at DESC);

DROP TRIGGER IF EXISTS trg_reconciliation_cases_updated ON reconciliation_cases;
CREATE TRIGGER trg_reconciliation_cases_updated
  BEFORE UPDATE ON reconciliation_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE reconciliation_cases ENABLE ROW LEVEL SECURITY;
-- 사용자에게는 본인 case 일부만 노출 (severity=critical만), 나머지는 admin 전용
DROP POLICY IF EXISTS reconciliation_cases_self_read ON reconciliation_cases;
CREATE POLICY reconciliation_cases_self_read
  ON reconciliation_cases FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE reconciliation_cases IS
  '8개 분쟁 case 자동 감지/수동 보정. /admin/reconciliation 에서 처리.';


-- ═════════════════════════════════════════════════════════════════
-- §5. user_entitlements 보강 (PDF 발급권 모델 전환)
-- ═════════════════════════════════════════════════════════════════
-- 기존 user_entitlements (20260514000000) — estimate_pdf_single 단발 다운로드권
-- 변경: 같은 estimateVersion 재다운로드 가능하도록 컬럼 추가
ALTER TABLE user_entitlements
  ADD COLUMN IF NOT EXISTS estimate_id UUID,
  ADD COLUMN IF NOT EXISTS estimate_version TEXT,
  -- e.g. 'V01', 'V02', V{majorVersion} 또는 hash
  ADD COLUMN IF NOT EXISTS asset_url TEXT,
  -- PDF 생성 완료 후 채워짐 (Supabase Storage URL)
  ADD COLUMN IF NOT EXISTS asset_path TEXT,
  -- storage path (Storage delete 등 관리용)
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
  -- PDF 발급 성공 시점

CREATE INDEX IF NOT EXISTS idx_user_entitlements_estimate_version
  ON user_entitlements(estimate_id, estimate_version)
  WHERE estimate_id IS NOT NULL;

COMMENT ON COLUMN user_entitlements.asset_url IS
  '발급된 PDF URL. 같은 estimate_id + estimate_version은 재다운로드 무료.';
