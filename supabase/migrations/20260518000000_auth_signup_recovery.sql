-- 2026-05-18: 자체 회원가입 흐름 견고화 + orphan 정리
--
-- 배경 (진단 2026-05-18):
--   * auth.users 자체 가입 5건 중 3건이 consumer_profiles에 누락된 orphan 상태
--   * tjsqhs011@naver.com (대표 본인) 포함 — 가입 직후 비번 찾기 시도 흔적 (recovery_sent_at 2026-05-12 09:31)
--   * Supabase 기본 SMTP 시간당 4건 제한으로 비번 재설정 메일 미수신 → 비번 잊은 상태로 로그인 실패
--
-- 본 마이그가 처리하는 것:
--   §1. handle_new_consumer_user 트리거 — auth.users INSERT 시 consumer_profiles 자동 생성 (재발 방지)
--       * 정책: account_type='consumer' AND phone 제공된 경우에만 INSERT.
--       * OAuth 가입자는 별도 onboarding 페이지에서 phone 입력 후 consumer_profiles 생성 (기존 흐름 유지)
--   §2. 기존 orphan 백필 — phone이 있는 row만 INSERT, 없는 row는 남겨둠
--
-- 메일 SMTP는 코드/DB가 아닌 Supabase 대시보드 설정 — 별도 가이드 참조 (Resend/SendGrid 등록).

-- ─── §1. handle_new_consumer_user — auth.users INSERT 시 consumer_profiles 자동 생성 ───

CREATE OR REPLACE FUNCTION handle_new_consumer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_phone        TEXT;
  v_name         TEXT;
BEGIN
  v_account_type := NEW.raw_user_meta_data->>'account_type';

  -- consumer 가입만 처리. OAuth는 미설정이므로 스킵 (별도 onboarding 흐름).
  IF v_account_type IS NULL OR v_account_type <> 'consumer' THEN
    RETURN NEW;
  END IF;

  -- phone 정규화: 숫자만 추출
  v_phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g');

  -- phone 없으면 INSERT 안 함 (UNIQUE 충돌 회피 + 추후 마이페이지에서 입력 유도)
  IF length(v_phone) < 10 THEN
    RAISE WARNING '[handle_new_consumer_user] phone 누락 — consumer_profiles 미생성. user_id=% email=%', NEW.id, NEW.email;
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO consumer_profiles (
    id, email, name, phone,
    agreed_terms_at, agreed_privacy_at, agreed_age14_at, agreed_marketing_at,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    lower(btrim(NEW.email)),
    v_name,
    v_phone,
    CASE WHEN (NEW.raw_user_meta_data->>'agreed_terms') IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'agreed_privacy') IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'agreed_age14') IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'agreed_marketing') IS NOT NULL THEN NOW() ELSE NULL END,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- phone UNIQUE 충돌은 무시 (이미 다른 계정으로 가입된 휴대폰)
  RAISE WARNING '[handle_new_consumer_user] phone UNIQUE 충돌. user_id=% phone=%', NEW.id, v_phone;
  RETURN NEW;
WHEN OTHERS THEN
  -- 다른 모든 에러도 가입 자체는 막지 않음
  RAISE WARNING '[handle_new_consumer_user] 알 수 없는 에러. user_id=% err=%', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_consumer_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_consumer_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_consumer_user();

COMMENT ON FUNCTION handle_new_consumer_user IS
  '2026-05-18: auth.users INSERT 시 consumer_profiles 자동 생성. account_type=consumer + 유효한 phone(10자리 이상)인 경우만. EXCEPTION 발생해도 가입 자체는 막지 않음 (RAISE WARNING).';

-- ─── §2. 기존 orphan 백필 (phone 있는 자체 가입자만) ─────────────────────

INSERT INTO consumer_profiles (id, email, name, phone, created_at, updated_at)
SELECT
  u.id,
  lower(btrim(u.email)) AS email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) AS name,
  regexp_replace(u.raw_user_meta_data->>'phone', '[^0-9]', '', 'g') AS phone,
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN consumer_profiles cp ON cp.id = u.id
WHERE cp.id IS NULL
  AND u.encrypted_password IS NOT NULL                       -- 자체 가입만
  AND u.raw_user_meta_data->>'account_type' = 'consumer'
  AND length(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g')) >= 10
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_remaining INT;
  v_phone_missing INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM auth.users u
  LEFT JOIN consumer_profiles cp ON cp.id = u.id
  WHERE cp.id IS NULL AND u.encrypted_password IS NOT NULL
    AND u.raw_user_meta_data->>'account_type' = 'consumer';

  SELECT COUNT(*) INTO v_phone_missing
  FROM auth.users u
  LEFT JOIN consumer_profiles cp ON cp.id = u.id
  WHERE cp.id IS NULL AND u.encrypted_password IS NOT NULL
    AND u.raw_user_meta_data->>'account_type' = 'consumer'
    AND length(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g')) < 10;

  RAISE NOTICE '[migration 20260518] orphan 백필 완료. 잔존 orphan=%, phone 누락=%', v_remaining, v_phone_missing;
END $$;
