"""
트리거 비활성화 → production /api/auth/signup 재시도 → 다른 실패 원인 노출.
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

TEST_EMAIL = "_signup_no_trigger_20260518@inpick.test"
TEST_PASSWORD = "InpickT123!"


def http(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except HTTPError as e:
        try: return e.code, json.loads(e.read().decode())
        except: return e.code, {"raw": e.read().decode()}


conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)

# 1) 트리거 비활성화
print("=" * 72)
print("1) 트리거 비활성화")
print("=" * 72)
cur.execute("DROP TRIGGER IF EXISTS on_auth_user_created_consumer_profile ON auth.users;")
conn.commit()
print("드롭 완료")

# 2) cleanup 기존 테스트 계정
cur.execute("SELECT id FROM auth.users WHERE email = %s", (TEST_EMAIL,))
ex = cur.fetchone()
if ex:
    http("DELETE", f"{SB_URL}/auth/v1/admin/users/{ex['id']}",
         headers={"apikey": SB_SERVICE, "Authorization": f"Bearer {SB_SERVICE}"})
    cur.execute("DELETE FROM consumer_profiles WHERE id = %s", (ex['id'],))
    conn.commit()
    print(f"[cleanup] {ex['id']} 삭제")

# 3) production signup 호출
print()
print("=" * 72)
print(f"2) POST {APP_URL}/api/auth/signup")
print("=" * 72)
code, body = http("POST", f"{APP_URL}/api/auth/signup", {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "name": "No Trigger",
    "phone": "01088886666",
    "agreeTerms": True,
    "agreePrivacy": True,
    "agreeAge14": True,
})
print(f"HTTP {code}")
print(json.dumps(body, indent=2, ensure_ascii=False))

# 4) DB 결과 확인
print()
print("=" * 72)
print("3) DB 결과")
print("=" * 72)
cur.execute("""
    SELECT u.id, u.email, u.encrypted_password IS NOT NULL AS has_pw,
           u.email_confirmed_at IS NOT NULL AS confirmed,
           cp.id IS NOT NULL AS has_profile,
           cp.phone, cp.name
    FROM auth.users u
    LEFT JOIN consumer_profiles cp ON cp.id = u.id
    WHERE u.email = %s
""", (TEST_EMAIL,))
r = cur.fetchone()
if r:
    print(f"  user_id     : {r['id']}")
    print(f"  has_pw      : {r['has_pw']}")
    print(f"  confirmed   : {r['confirmed']}")
    print(f"  has_profile : {r['has_profile']}")
    print(f"  profile     : phone={r['phone']} name={r['name']}")
else:
    print("  auth.users에도 row 없음 — createUser 자체 실패")

# 5) 로그인 시도
if r and r['has_pw']:
    print()
    print("=" * 72)
    print(f"4) Supabase REST 로그인 시도 (가입 직후)")
    print("=" * 72)
    code, body = http("POST", f"{SB_URL}/auth/v1/token?grant_type=password",
        {"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"apikey": SB_ANON, "Authorization": f"Bearer {SB_ANON}"})
    print(f"HTTP {code}")
    if code == 200 and body.get("access_token"):
        print("✅ 로그인 성공 — signup API 응답과 무관하게 비번은 정상")
    else:
        print(f"❌ 로그인 실패: {body.get('error_code') or body.get('msg')}")
        print(json.dumps(body, indent=2, ensure_ascii=False)[:400])

# 6) cleanup
print()
print("=" * 72)
print("Cleanup")
print("=" * 72)
if r:
    http("DELETE", f"{SB_URL}/auth/v1/admin/users/{r['id']}",
         headers={"apikey": SB_SERVICE, "Authorization": f"Bearer {SB_SERVICE}"})
    cur.execute("DELETE FROM consumer_profiles WHERE id = %s", (r['id'],))
    conn.commit()
    print(f"삭제 완료: {r['id']}")

# 7) 트리거 복원
print()
print("트리거는 복원 안 함 — 픽스 마이그 적용 후 재생성")

cur.close()
conn.close()
