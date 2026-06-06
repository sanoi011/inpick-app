"""admin_profiles + auth.users 관계 정확히 파악."""
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
print("admin_profiles 전체")
print("=" * 72)
cur.execute("SELECT * FROM admin_profiles ORDER BY created_at;")
rows = cur.fetchall()
for r in rows:
    print(f"  id={r.get('id')}")
    for k, v in r.items():
        if k != 'id':
            print(f"    {k}: {v}")
    print()

print("=" * 72)
print("admin_profiles 스키마")
print("=" * 72)
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'admin_profiles' AND table_schema = 'public'
    ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r['column_name']:20s} {r['data_type']:20s} nullable={r['is_nullable']}")

cur.close()
conn.close()
