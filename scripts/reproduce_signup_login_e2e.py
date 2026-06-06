"""
실제 production endpoint를 사용해 회원가입→로그인 통합 재현.

테스트:
  1) production /api/auth/signup → 신규 계정 만들기 (실제 사용자가 거치는 경로)
  2) 즉시 production Supabase /auth/v1/token?grant_type=password 로 로그인
  3) 실패 시 어디서 어긋났는지 추적
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
APP_URL = "https://inpick-app.vercel.app"

TEST_EMAIL = "_signup_e2e_20260518@inpick.test"
TEST_PASSWORD = "InpickE2E123!"


def http(method: str, url: str, body: dict | None = None, headers: dict | None = None):
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"raw": e.read().decode()}


# Cleanup
conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id FROM auth.users WHERE email = %s", (TEST_EMAIL,))
existing = cur.fetchone()
if existing:
    http("DELETE", f"{SB_URL}/auth/v1/admin/users/{existing['id']}",
         headers={"apikey": SB_SERVICE, "Authorization": f"Bearer {SB_SERVICE}"})
    print(f"[cleanup] {existing['id']} 삭제")

# ─── Step 1: 실제 /api/auth/signup 호출 ────────────────────────
print("=" * 72)
print(f"Step 1: POST {APP_URL}/api/auth/signup")
print("=" * 72)
code, body = http("POST", f"{APP_URL}/api/auth/signup", {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "name": "E2E Diag",
    "phone": "01088887777",
    "agreeTerms": True,
    "agreePrivacy": True,
    "agreeAge14": True,
    "agreeMarketing": False,
})
print(f"HTTP {code}")
print(json.dumps(body, indent=2, ensure_ascii=False)[:600])

if code >= 300:
    print("\n[STOP] signup API 실패 — Vercel 배포 문제일 수 있음")
    sys.exit(1)

# DB 검증
cur.execute("""
    SELECT id, encrypted_password, substring(encrypted_password,1,7) AS prefix,
           length(encrypted_password) AS len, email_confirmed_at IS NOT NULL AS confirmed,
           raw_user_meta_data
    FROM auth.users WHERE email = %s
""", (TEST_EMAIL,))
r = cur.fetchone()
user_id = r['id']
print(f"\nDB 저장 상태:")
print(f"  user_id    : {user_id}")
print(f"  hash_prefix: {r['prefix']}  len={r['len']}")
print(f"  confirmed  : {r['confirmed']}")
print(f"  metadata   : {r['raw_user_meta_data']}")

# ─── Step 2: 같은 비번으로 Supabase REST 로그인 ─────────────────
print()
print("=" * 72)
print(f"Step 2: POST {SB_URL}/auth/v1/token?grant_type=password (Supabase REST)")
print("=" * 72)
code, body = http("POST", f"{SB_URL}/auth/v1/token?grant_type=password",
    {"email": TEST_EMAIL, "password": TEST_PASSWORD},
    headers={"apikey": SB_ANON, "Authorization": f"Bearer {SB_ANON}"})
print(f"HTTP {code}")
if code == 200 and body.get("access_token"):
    print("✅ Supabase REST 로그인 성공")
    print(f"  access_token: ...{body['access_token'][-30:]}")
else:
    print("❌ Supabase REST 로그인 실패")
    print(json.dumps(body, indent=2, ensure_ascii=False))

# ─── Step 3: production 페이지에 로그인 시도 (HTML form 시뮬레이션 X — auth는 클라 SDK)
# 직접 의미가 없으므로 스킵.

# ─── Step 4: 사용자가 다른 비번을 시도하면? (대표가 비번 입력 실수 가설 검증)
print()
print("=" * 72)
print("Step 4: 비번 살짝 다른 값으로 시도 (오타 시뮬레이션)")
print("=" * 72)
for variant in [
    TEST_PASSWORD + " ",                # 끝 공백
    " " + TEST_PASSWORD,                # 앞 공백
    TEST_PASSWORD.lower(),              # 소문자
    TEST_PASSWORD.upper(),              # 대문자
]:
    code, body = http("POST", f"{SB_URL}/auth/v1/token?grant_type=password",
        {"email": TEST_EMAIL, "password": variant},
        headers={"apikey": SB_ANON, "Authorization": f"Bearer {SB_ANON}"})
    status = "✅" if code == 200 else "❌"
    print(f"  {status} {variant!r:35s} → HTTP {code} {body.get('error_code') or body.get('msg', '')[:60]}")

# ─── Cleanup ───
print()
print("=" * 72)
print("Cleanup")
print("=" * 72)
http("DELETE", f"{SB_URL}/auth/v1/admin/users/{user_id}",
     headers={"apikey": SB_SERVICE, "Authorization": f"Bearer {SB_SERVICE}"})
cur.execute("DELETE FROM consumer_profiles WHERE id = %s", (user_id,))
conn.commit()
print(f"삭제 완료: {user_id}")

cur.close()
conn.close()
