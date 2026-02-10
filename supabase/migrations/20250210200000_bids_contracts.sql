-- =============================================
-- 입찰(bids) 및 계약(contracts) 테이블
-- =============================================

-- 입찰 테이블
CREATE TABLE IF NOT EXISTS bids (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id         UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    contractor_id       UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    bid_amount          NUMERIC(14,2) NOT NULL,
    discount_rate       NUMERIC(5,2),
    estimated_days      INTEGER NOT NULL DEFAULT 30,
    start_available_date DATE,
    message             TEXT,
    attachments         JSONB DEFAULT '[]'::jsonb,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','selected','rejected')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estimate_id, contractor_id)
);

-- 계약 테이블
CREATE TABLE IF NOT EXISTS contracts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id           UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    bid_id                UUID REFERENCES bids(id),
    consumer_id           UUID,
    contractor_id         UUID NOT NULL REFERENCES specialty_contractors(id),
    project_name          VARCHAR(200) NOT NULL,
    address               TEXT,
    total_amount          NUMERIC(14,2) NOT NULL,
    deposit_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    progress_payments     JSONB DEFAULT '[]'::jsonb,
    final_payment         NUMERIC(14,2) NOT NULL DEFAULT 0,
    start_date            DATE,
    expected_end_date     DATE,
    consult_session_id    UUID REFERENCES consult_sessions(id),
    consult_log_snapshot  JSONB DEFAULT '[]'::jsonb,
    consumer_signature    TEXT,
    contractor_signature  TEXT,
    signed_at             TIMESTAMPTZ,
    status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pending_signature','signed','in_progress','completed')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bids_estimate ON bids(estimate_id);
CREATE INDEX IF NOT EXISTS idx_bids_contractor ON bids(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_contracts_estimate ON contracts(estimate_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contractor ON contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- completed_projects 컬럼 (specialty_contractors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'specialty_contractors' AND column_name = 'completed_projects'
    ) THEN
        ALTER TABLE specialty_contractors ADD COLUMN completed_projects INTEGER DEFAULT 0;
    END IF;
END $$;
