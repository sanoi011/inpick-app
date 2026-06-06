"""
회원가입/로그인 진단 스크립트.

확인 항목:
  1) 최근 가입된 auth.users (email_confirmed_at, encrypted_password 존재 여부, identities provider)
  2) consumer_profiles와 auth.users 매칭 상태
  3) email 케이스/공백 이상치
  4) Supabase Auth 동일 이메일로 password identity와 OAuth identity가 충돌하는지

사용: python scripts/diagnose_auth.py
"""
from __future__ import annotations
import io, os, sys
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv("E:/InPick/data/materials/.env")
load_dotenv("E:/InPick/inpick-app/.env.local")

url = os.environ.get("DATABASE_URL")
if not url:
    print("[ERR] DATABASE_URL 없음")
    sys.exit(1)

conn = psycopg2.connect(url)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 72)
print("1) 최근 가입된 auth.users — encrypted_password 존재 여부 & email_confirmed_at")
print("=" * 72)
cur.execute("""
    SELECT
        id,
        email,
        email = lower(email) AS email_is_lowercase,
        email_confirmed_at IS NOT NULL AS confirmed,
        encrypted_password IS NOT NULL AS has_password,
        length(encrypted_password) AS pw_hash_len,
        raw_user_meta_data->>'account_type' AS account_type,
        created_at,
        last_sign_in_at,
        banned_until IS NOT NULL AS banned,
        deleted_at IS NOT NULL AS deleted
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 15;
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r['email']:40s} confirmed={r['confirmed']} has_pw={r['has_password']} pw_len={r['pw_hash_len']} acct={r['account_type']} created={r['created_at']:%Y-%m-%d %H:%M}")
print(f"  (총 {len(rows)} 건)\n")

print("=" * 72)
print("2) identities — 같은 user_id에 password+OAuth 동시 존재?")
print("=" * 72)
cur.execute("""
    SELECT
        u.email,
        array_agg(DISTINCT i.provider ORDER BY i.provider) AS providers,
        count(i.*) AS identity_count
    FROM auth.users u
    LEFT JOIN auth.identities i ON i.user_id = u.id
    GROUP BY u.id, u.email
    ORDER BY u.created_at DESC
    LIMIT 15;
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r['email']:40s} providers={r['providers']} count={r['identity_count']}")
print()

print("=" * 72)
print("3) consumer_profiles ↔ auth.users 매칭 (orphan 점검)")
print("=" * 72)
cur.execute("""
    SELECT
        cp.email AS cp_email,
        u.email AS au_email,
        cp.email = u.email AS email_match,
        u.encrypted_password IS NOT NULL AS has_password,
        u.email_confirmed_at IS NOT NULL AS confirmed
    FROM consumer_profiles cp
    LEFT JOIN auth.users u ON u.id = cp.id
    ORDER BY cp.created_at DESC
    LIMIT 15;
""")
rows = cur.fetchall()
for r in rows:
    print(f"  cp={r['cp_email']:30s} au={r['au_email']} match={r['email_match']} has_pw={r['has_password']} confirmed={r['confirmed']}")
print(f"  (총 {len(rows)} 건)\n")

print("=" * 72)
print("4) auth.users 중 email_confirmed_at NULL")
print("=" * 72)
cur.execute("""
    SELECT email, created_at, encrypted_password IS NOT NULL AS has_password
    FROM auth.users
    WHERE email_confirmed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20;
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r['email']:40s} has_pw={r['has_password']} created={r['created_at']:%Y-%m-%d %H:%M}")
else:
    print("  (없음 — 모두 confirmed)")
print()

print("=" * 72)
print("5) email 케이스/공백 이상치")
print("=" * 72)
cur.execute("""
    SELECT email, btrim(email) AS trimmed, lower(btrim(email)) AS normalized
    FROM auth.users
    WHERE email <> lower(btrim(email))
    LIMIT 10;
""")
rows = cur.fetchall()
if rows:
    print(f"  ⚠️ {len(rows)} 건의 비정규 email 발견:")
    for r in rows:
        print(f"    raw={r['email']!r}  normalized={r['normalized']!r}")
else:
    print("  (없음 — 모두 lowercase + trimmed)")

cur.close()
conn.close()
print("\n[OK]")
