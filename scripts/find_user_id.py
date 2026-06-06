"""특정 이메일의 user_id 조회."""
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
cur.execute("""
    SELECT u.id, u.email, u.email_confirmed_at IS NOT NULL AS confirmed,
           u.encrypted_password IS NOT NULL AS has_password,
           u.created_at, u.last_sign_in_at,
           cp.name, cp.phone
    FROM auth.users u
    LEFT JOIN consumer_profiles cp ON cp.id = u.id
    WHERE u.email = 'tjsqhs011@naver.com';
""")
for r in cur.fetchall():
    print(f"user_id    : {r['id']}")
    print(f"email      : {r['email']}")
    print(f"name       : {r['name']}")
    print(f"phone      : {r['phone']}")
    print(f"confirmed  : {r['confirmed']}")
    print(f"has_pw     : {r['has_password']}")
    print(f"created    : {r['created_at']}")
    print(f"last_login : {r['last_sign_in_at']}")
cur.close()
conn.close()
