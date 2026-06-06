"""2026-05-19 — 최근 가입자 + 로그인 실패 추적."""
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

print("=" * 78)
print("최근 20명 (자체 가입자 우선, has_pw=True)")
print("=" * 78)
cur.execute("""
    SELECT u.email, u.id,
        u.encrypted_password IS NOT NULL AS has_pw,
        substring(u.encrypted_password, 1, 7) AS hash_prefix,
        u.email_confirmed_at IS NOT NULL AS confirmed,
        u.last_sign_in_at,
        u.created_at,
        u.recovery_sent_at,
        cp.id IS NOT NULL AS has_profile,
        (array_agg(i.provider))[1] AS provider,
        u.raw_user_meta_data->>'account_type' AS acct_type
    FROM auth.users u
    LEFT JOIN consumer_profiles cp ON cp.id = u.id
    LEFT JOIN auth.identities i ON i.user_id = u.id
    GROUP BY u.id, u.email, u.encrypted_password, u.email_confirmed_at, u.last_sign_in_at, u.created_at, u.recovery_sent_at, cp.id, u.raw_user_meta_data
    ORDER BY u.created_at DESC
    LIMIT 20;
""")
for r in cur.fetchall():
    age_days = None
    last_login = r['last_sign_in_at']
    sign_in_status = '한번도 로그인 안함' if not last_login else f"최근 로그인 {last_login.strftime('%m-%d %H:%M')}"
    profile_status = '✓' if r['has_profile'] else '✗ ORPHAN'
    pw_status = '✓pw' if r['has_pw'] else '✗OAuth'
    recovery = ''
    if r['recovery_sent_at']:
        recovery = f" recovery시도={r['recovery_sent_at'].strftime('%m-%d %H:%M')}"
    print(f"  {r['created_at'].strftime('%m-%d %H:%M')} {r['email']:35s} {pw_status:6s} profile={profile_status:9s} provider={r['provider']:8s} acct={r['acct_type']!r:12s} {sign_in_status}{recovery}")

print()
print("=" * 78)
print("자체 가입자(has_pw=True) 중 가입 후 로그인 안한 사람")
print("=" * 78)
cur.execute("""
    SELECT u.email, u.created_at, u.last_sign_in_at,
        EXTRACT(EPOCH FROM (u.last_sign_in_at - u.created_at)) AS first_login_lag_sec,
        u.recovery_sent_at
    FROM auth.users u
    WHERE u.encrypted_password IS NOT NULL
    ORDER BY u.created_at DESC LIMIT 10;
""")
for r in cur.fetchall():
    lag = r['first_login_lag_sec']
    lag_str = f"{lag:.0f}초" if lag is not None and lag < 60 else f"{lag/60:.1f}분" if lag is not None and lag < 3600 else f"{lag/3600:.1f}시간" if lag is not None else "안함"
    recov = f" recovery시도" if r['recovery_sent_at'] else ""
    print(f"  {r['email']:35s} 가입→로그인={lag_str}{recov}")

print()
print("=" * 78)
print("auth schema의 사용자 잠금 관련 (banned_until / deleted_at)")
print("=" * 78)
cur.execute("""
    SELECT email, banned_until, deleted_at, email_change_token_new, email_change_confirm_status
    FROM auth.users
    WHERE encrypted_password IS NOT NULL
      AND (banned_until IS NOT NULL OR deleted_at IS NOT NULL)
    ORDER BY created_at DESC;
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r['email']:35s} banned={r['banned_until']} deleted={r['deleted_at']}")
else:
    print("  (잠금/삭제된 자체 가입자 없음)")

cur.close()
conn.close()
