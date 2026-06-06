"""
실제 Supabase Auth REST API를 직접 호출해 로그인 실패를 재현.

테스트:
  1) 신규 테스트 계정을 admin API로 생성 (회원가입 API와 동일 흐름)
  2) 즉시 signInWithPassword 시도 → 어떤 에러 메시지/HTTP 코드?
  3) auth.config 메타 확인 — 이메일 인증 강제 / 비번 정책 / hook
"""
from __future__ import annotations
import io, os, sys, json
from urllib.request import Request, urlopen
from urllib.error import HTTPError
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv("E:/InPick/data/materials/.env")
load_dotenv("E:/InPick/inpick-app/.env.local")

SB_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SB_ANON = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SB_SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DB_URL = os.environ["DATABASE_URL"]

TEST_EMAIL = "_diagnostic_20260518@inpick.test"
TEST_PASSWORD = "InpickTest123!"


def http(method: str, path: str, body: dict | None = None, key: str = SB_SERVICE):
    url = f"{SB_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    try:
        with urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except HTTPError as e:
        return e.code, json.loads(e.read().decode())


# ─── Cleanup: 기존 테스트 계정 정리 ─────────────────────────
conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id FROM auth.users WHERE email = %s", (TEST_EMAIL,))
existing = cur.fetchone()
if existing:
    print(f"[cleanup] 기존 테스트 계정 삭제: {existing['id']}")
    code, body = http("DELETE", f"/auth/v1/admin/users/{existing['id']}")
    print(f"  → HTTP {code}")

# ─── Step 1: admin.createUser로 가입 (signup API와 동일 흐름) ───
print()
print("=" * 72)
print("Step 1: POST /auth/v1/admin/users — 가입")
print("=" * 72)
code, body = http("POST", "/auth/v1/admin/users", {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "email_confirm": True,
    "user_metadata": {
        "full_name": "Diagnostic Test",
        "account_type": "consumer",
        "phone": "01099999999",
    },
})
print(f"HTTP {code}")
print(json.dumps(body, indent=2, ensure_ascii=False)[:800])

if code >= 300:
    print("\n[STOP] 가입 자체가 실패. 위 에러 확인 필요.")
    sys.exit(1)

user_id = body.get("id")
print(f"\n생성된 user_id: {user_id}")

# ─── DB 직접 검증 — auth.users에 무엇이 저장됐는지 ───
cur.execute("""
    SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed,
           encrypted_password,
           substring(encrypted_password, 1, 7) AS hash_prefix,
           length(encrypted_password) AS hash_len,
           raw_app_meta_data, raw_user_meta_data,
           aud, role, instance_id
    FROM auth.users WHERE id = %s
""", (user_id,))
r = cur.fetchone()
print()
print("DB 상태:")
print(f"  email           : {r['email']}")
print(f"  confirmed       : {r['confirmed']}")
print(f"  hash_prefix     : {r['hash_prefix']}  (bcrypt=$2a/$2b/$2y, scrypt=시작이 다름)")
print(f"  hash_len        : {r['hash_len']}")
print(f"  aud             : {r['aud']}")
print(f"  role            : {r['role']}")
print(f"  app_metadata    : {r['raw_app_meta_data']}")

# ─── Step 2: signInWithPassword 시도 (anon key + password grant) ───
print()
print("=" * 72)
print("Step 2: POST /auth/v1/token?grant_type=password — 로그인 시도")
print("=" * 72)
code, body = http("POST", "/auth/v1/token?grant_type=password", {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
}, key=SB_ANON)
print(f"HTTP {code}")
print(json.dumps(body, indent=2, ensure_ascii=False)[:1500])

if code == 200 and "access_token" in body:
    print("\n*** 로그인 정상 동작 — 시스템 자체는 문제 없음 ***")
else:
    print("\n*** 로그인 실패 — 시스템 레벨 문제 확인 ***")
    print(f"error_code: {body.get('error_code')}")
    print(f"error: {body.get('error')}")
    print(f"msg: {body.get('msg')}")

# ─── Step 3: Auth 설정/hook 확인 ────────────────────────────
print()
print("=" * 72)
print("Step 3: Supabase Auth schema 객체 / hook 확인")
print("=" * 72)
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name IN ('flow_state', 'hooks', 'config')
    ORDER BY table_name;
""")
for r in cur.fetchall():
    print(f"  auth.{r['table_name']} 존재")

# Auth hooks
cur.execute("""
    SELECT routine_schema, routine_name
    FROM information_schema.routines
    WHERE routine_name ILIKE '%password%' OR routine_name ILIKE '%hook%' OR routine_name ILIKE '%signin%'
    ORDER BY routine_schema, routine_name;
""")
print("\n관련 함수 (password/hook/signin):")
for r in cur.fetchall():
    print(f"  {r['routine_schema']}.{r['routine_name']}")

# auth.users 인덱스/제약
cur.execute("""
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'auth.users'::regclass;
""")
print("\nauth.users 제약:")
for r in cur.fetchall():
    print(f"  {r['conname']}: {r['pg_get_constraintdef']}")

# ─── cleanup ───
print()
print("=" * 72)
print("Cleanup: 테스트 계정 삭제")
print("=" * 72)
code, body = http("DELETE", f"/auth/v1/admin/users/{user_id}")
print(f"HTTP {code}")

cur.close()
conn.close()
