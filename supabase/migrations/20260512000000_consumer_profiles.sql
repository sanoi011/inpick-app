-- 소비자 회원가입 프로필 — 휴대폰 UNIQUE로 중복가입 방지
CREATE TABLE IF NOT EXISTS consumer_profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        VARCHAR(254) NOT NULL,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(20) NOT NULL,
    -- 약관 동의 시각(법적 근거 보존)
    agreed_terms_at         TIMESTAMPTZ,
    agreed_privacy_at       TIMESTAMPTZ,
    agreed_age14_at         TIMESTAMPTZ,
    agreed_marketing_at     TIMESTAMPTZ,
    -- 휴대폰 본인인증 결과(Phase 2, 미사용 시 NULL)
    phone_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified_at       TIMESTAMPTZ,
    ci_hash                 VARCHAR(128),
    -- 메타
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE: 동일 휴대폰번호로 중복가입 차단
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_profiles_phone ON consumer_profiles(phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_profiles_email ON consumer_profiles(email);
CREATE INDEX IF NOT EXISTS idx_consumer_profiles_created_at ON consumer_profiles(created_at DESC);

-- updated_at 트리거 (update_updated_at_column 함수는 초기 스키마에 이미 존재)
CREATE TRIGGER trg_consumer_profiles_updated_at
    BEFORE UPDATE ON consumer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: 본인 행만 read/update, INSERT는 service role 또는 본인 가입 직후
ALTER TABLE consumer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumer_profiles_select_own"
    ON consumer_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "consumer_profiles_update_own"
    ON consumer_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "consumer_profiles_insert_own"
    ON consumer_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

COMMENT ON TABLE consumer_profiles IS '소비자 회원 프로필 — phone UNIQUE로 1인 1계정 정책. Phase 2에서 본인인증 도입 시 ci_hash 활용';
COMMENT ON COLUMN consumer_profiles.ci_hash IS 'PASS/다날 등 본인확인 결과 CI 해시 (Phase 2)';
