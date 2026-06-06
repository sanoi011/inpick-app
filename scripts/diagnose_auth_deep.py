"""상세 진단: consumer_profiles 누락 원인 + phone 중복 가능성."""
from __future__ import annotations
import io, os, sys
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv("E:/InPick/data/materials/.env")
load_dotenv("E:/InPick/inpick-app/.env.local")

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 72)
print("auth.users 자체 가입(provider=email) 사용자 + user_metadata.phone 매칭")
print("=" * 72)
cur.execute("""
    SELECT
        u.id,
        u.email,
        u.raw_user_meta_data->>'phone' AS meta_phone,
        u.raw_user_meta_data->>'full_name' AS meta_name,
        u.raw_user_meta_data->>'account_type' AS acct,
        cp.id IS NOT NULL AS has_profile,
        cp.phone AS profile_phone,
        u.created_at
    FROM auth.users u
    LEFT JOIN consumer_profiles cp ON cp.id = u.id
    WHERE u.encrypted_password IS NOT NULL
    ORDER BY u.created_at DESC;
""")
for r in cur.fetchall():
    flag = "OK" if r['has_profile'] else "*** ORPHAN ***"
    print(f"  {r['email']:30s} {flag:15s} meta_phone={r['meta_phone']} acct={r['acct']} created={r['created_at']:%Y-%m-%d %H:%M}")

print()
print("=" * 72)
print("consumer_profiles 전체 phone 분포 (orphan과 중복하는 phone?)")
print("=" * 72)
cur.execute("SELECT phone, email, name, created_at FROM consumer_profiles ORDER BY created_at DESC;")
for r in cur.fetchall():
    print(f"  phone={r['phone']} email={r['email']} name={r['name']} created={r['created_at']:%Y-%m-%d %H:%M}")

print()
print("=" * 72)
print("SMTP / 메일 설정 상태 (auth.config는 admin API에서만 — 대신 최근 password reset 토큰 확인)")
print("=" * 72)
cur.execute("""
    SELECT
        u.email,
        u.recovery_sent_at,
        u.confirmation_sent_at,
        u.email_change_sent_at
    FROM auth.users u
    WHERE u.recovery_sent_at IS NOT NULL OR u.confirmation_sent_at IS NOT NULL
    ORDER BY GREATEST(coalesce(u.recovery_sent_at, '1970-01-01'::timestamptz),
                       coalesce(u.confirmation_sent_at, '1970-01-01'::timestamptz)) DESC
    LIMIT 10;
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r['email']:35s} recovery_sent={r['recovery_sent_at']} confirm_sent={r['confirmation_sent_at']}")
else:
    print("  (아무도 recovery/confirm 메일 시도 기록 없음)")

cur.close()
conn.close()
