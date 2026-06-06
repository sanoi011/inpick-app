"""Seed demo contractor data for /find-contractors directory."""
import json
import os
import urllib.request

env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
env = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v

SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

def rpc(method, table, data=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}{params}"
    body = json.dumps(data, ensure_ascii=False).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if method == "POST":
        req.add_header("Prefer", "return=representation")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode()) if resp.status in (200, 201) else resp.status
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code}: {err}")
        return None

# Step 0: Apply migration (add introduction, logo_url columns)
print("=== Step 0: Add introduction/logo_url columns ===")
sql_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
# Use direct ALTER via REST - if rpc doesn't exist, we'll do it through db push
# For now, let's just try inserting and see if columns exist

# Step 1: Insert demo contractors
print("\n=== Step 1: Insert demo contractors ===")

contractors = [
    {
        "company_name": "한빛 인테리어",
        "contact_name": "김도현",
        "phone": "02-555-1234",
        "email": "hanbit@demo.inpick.kr",
        "address": "서울시 강남구 역삼동 123-45",
        "region": "seoul",
        "license_number": "2024-서울-00123",
        "rating": 4.80,
        "total_reviews": 47,
        "is_verified": True,
        "is_active": True,
        "is_public": True,
        "is_featured": True,
        "completed_projects": 152,
        "contractor_type": "general",
        "subscription_tier": "premium",
        "min_project_budget": 30000000,
        "max_project_budget": 200000000,
        "introduction": "20년 경력의 종합 인테리어 전문 업체. 아파트, 오피스텔, 상업공간까지 고품질 시공을 약속합니다. 3D 시뮬레이션으로 시공 전 완성된 공간을 미리 확인하세요.",
        "metadata": {"registration_status": "approved"},
        "view_count": 1243,
        "inquiry_count": 89,
        "password_hash": "$2b$10$demo_hash_hanbit_000000000000000000000"
    },
    {
        "company_name": "청담 디자인하우스",
        "contact_name": "박서윤",
        "phone": "02-777-5678",
        "email": "cheongdam@demo.inpick.kr",
        "address": "서울시 서초구 반포동 789-12",
        "region": "seoul",
        "license_number": "2023-서울-00456",
        "rating": 4.90,
        "total_reviews": 83,
        "is_verified": True,
        "is_active": True,
        "is_public": True,
        "is_featured": True,
        "completed_projects": 234,
        "contractor_type": "general",
        "subscription_tier": "premium",
        "min_project_budget": 50000000,
        "max_project_budget": 500000000,
        "introduction": "프리미엄 인테리어 디자인 & 시공 전문. 래미안, 자이, 힐스테이트 등 브랜드 아파트 300건+ 시공 실적. 디자인부터 A/S까지 원스톱 서비스를 제공합니다.",
        "metadata": {"registration_status": "approved"},
        "view_count": 2891,
        "inquiry_count": 156,
        "password_hash": "$2b$10$demo_hash_cheongdam_0000000000000000000"
    },
    {
        "company_name": "수원 홈데코",
        "contact_name": "이준혁",
        "phone": "031-222-3456",
        "email": "suwon@demo.inpick.kr",
        "address": "경기도 수원시 영통구 매탄동 456-78",
        "region": "gyeonggi",
        "license_number": "2025-경기-00789",
        "rating": 4.50,
        "total_reviews": 28,
        "is_verified": True,
        "is_active": True,
        "is_public": True,
        "is_featured": False,
        "completed_projects": 87,
        "contractor_type": "general",
        "subscription_tier": "basic",
        "min_project_budget": 20000000,
        "max_project_budget": 150000000,
        "introduction": "수원/용인/화성 지역 아파트 인테리어 전문. 합리적인 가격에 꼼꼼한 시공으로 경기남부 지역 고객만족도 1위. 무료 현장 방문 상담을 진행합니다.",
        "metadata": {"registration_status": "approved"},
        "view_count": 567,
        "inquiry_count": 42,
        "password_hash": "$2b$10$demo_hash_suwon_00000000000000000000000"
    },
    {
        "company_name": "대전 리모델링 파트너",
        "contact_name": "최민서",
        "phone": "042-333-7890",
        "email": "daejeon@demo.inpick.kr",
        "address": "대전광역시 서구 둔산동 1234-5",
        "region": "daejeon",
        "license_number": "2024-대전-00234",
        "rating": 4.60,
        "total_reviews": 35,
        "is_verified": True,
        "is_active": True,
        "is_public": True,
        "is_featured": False,
        "completed_projects": 98,
        "contractor_type": "general",
        "subscription_tier": "basic",
        "min_project_budget": 15000000,
        "max_project_budget": 120000000,
        "introduction": "대전/세종 지역 리모델링 & 인테리어 전문. 아파트 확장형 시공, 올수리 전문. 정직한 견적과 정확한 공기 준수로 신뢰받는 업체입니다.",
        "metadata": {"registration_status": "approved"},
        "view_count": 423,
        "inquiry_count": 31,
        "password_hash": "$2b$10$demo_hash_daejeon_000000000000000000000"
    },
    {
        "company_name": "모던타일 전문",
        "contact_name": "정하윤",
        "phone": "02-888-2345",
        "email": "moderntile@demo.inpick.kr",
        "address": "서울시 마포구 상암동 567-89",
        "region": "seoul",
        "license_number": "2025-서울-00567",
        "rating": 4.70,
        "total_reviews": 62,
        "is_verified": True,
        "is_active": True,
        "is_public": True,
        "is_featured": False,
        "completed_projects": 310,
        "contractor_type": "specialty",
        "subscription_tier": "basic",
        "min_project_budget": 5000000,
        "max_project_budget": 50000000,
        "introduction": "욕실/주방 타일 시공 전문업체. 수입 타일, 대리석, 포세린 전문. 20년 경력 마스터 타일공 보유. 정밀 시공으로 하자 0건 도전 중.",
        "metadata": {"registration_status": "approved"},
        "view_count": 891,
        "inquiry_count": 67,
        "password_hash": "$2b$10$demo_hash_moderntile_00000000000000000"
    },
]

results = rpc("POST", "specialty_contractors", contractors)
if results:
    contractor_ids = {r["company_name"]: r["id"] for r in results}
    print(f"  Inserted {len(contractor_ids)} contractors")
    for name, cid in contractor_ids.items():
        print(f"    {name}: {cid}")
else:
    print("  Failed to insert contractors")
    exit(1)

# Step 2: Insert trades for each contractor
print("\n=== Step 2: Insert contractor trades ===")

trade_data = {
    "한빛 인테리어": [
        {"trade_code": "T01", "trade_name": "도배", "experience_years": 18, "is_primary": False},
        {"trade_code": "T02", "trade_name": "타일", "experience_years": 15, "is_primary": False},
        {"trade_code": "T03", "trade_name": "목공", "experience_years": 20, "is_primary": True},
        {"trade_code": "T04", "trade_name": "전기", "experience_years": 12, "is_primary": False},
        {"trade_code": "T05", "trade_name": "설비", "experience_years": 14, "is_primary": False},
        {"trade_code": "T07", "trade_name": "철거", "experience_years": 18, "is_primary": False},
        {"trade_code": "T17", "trade_name": "바닥재", "experience_years": 16, "is_primary": False},
        {"trade_code": "T19", "trade_name": "욕실", "experience_years": 15, "is_primary": False},
    ],
    "청담 디자인하우스": [
        {"trade_code": "T01", "trade_name": "도배", "experience_years": 22, "is_primary": False},
        {"trade_code": "T02", "trade_name": "타일", "experience_years": 20, "is_primary": False},
        {"trade_code": "T03", "trade_name": "목공", "experience_years": 25, "is_primary": True},
        {"trade_code": "T04", "trade_name": "전기", "experience_years": 18, "is_primary": False},
        {"trade_code": "T05", "trade_name": "설비", "experience_years": 20, "is_primary": False},
        {"trade_code": "T06", "trade_name": "도장", "experience_years": 22, "is_primary": False},
        {"trade_code": "T07", "trade_name": "철거", "experience_years": 22, "is_primary": False},
        {"trade_code": "T08", "trade_name": "방수", "experience_years": 18, "is_primary": False},
        {"trade_code": "T15", "trade_name": "주방가구", "experience_years": 15, "is_primary": False},
        {"trade_code": "T17", "trade_name": "바닥재", "experience_years": 20, "is_primary": False},
        {"trade_code": "T19", "trade_name": "욕실", "experience_years": 18, "is_primary": False},
    ],
    "수원 홈데코": [
        {"trade_code": "T01", "trade_name": "도배", "experience_years": 10, "is_primary": False},
        {"trade_code": "T02", "trade_name": "타일", "experience_years": 8, "is_primary": False},
        {"trade_code": "T03", "trade_name": "목공", "experience_years": 12, "is_primary": True},
        {"trade_code": "T04", "trade_name": "전기", "experience_years": 8, "is_primary": False},
        {"trade_code": "T07", "trade_name": "철거", "experience_years": 10, "is_primary": False},
        {"trade_code": "T17", "trade_name": "바닥재", "experience_years": 10, "is_primary": False},
    ],
    "대전 리모델링 파트너": [
        {"trade_code": "T01", "trade_name": "도배", "experience_years": 12, "is_primary": False},
        {"trade_code": "T02", "trade_name": "타일", "experience_years": 10, "is_primary": False},
        {"trade_code": "T03", "trade_name": "목공", "experience_years": 14, "is_primary": True},
        {"trade_code": "T05", "trade_name": "설비", "experience_years": 10, "is_primary": False},
        {"trade_code": "T07", "trade_name": "철거", "experience_years": 12, "is_primary": False},
        {"trade_code": "T08", "trade_name": "방수", "experience_years": 10, "is_primary": False},
        {"trade_code": "T17", "trade_name": "바닥재", "experience_years": 12, "is_primary": False},
    ],
    "모던타일 전문": [
        {"trade_code": "T02", "trade_name": "타일", "experience_years": 20, "is_primary": True},
        {"trade_code": "T08", "trade_name": "방수", "experience_years": 15, "is_primary": False},
        {"trade_code": "T19", "trade_name": "욕실", "experience_years": 18, "is_primary": False},
    ],
}

all_trades = []
for company, trades in trade_data.items():
    cid = contractor_ids[company]
    for t in trades:
        t["contractor_id"] = cid
        all_trades.append(t)

result = rpc("POST", "contractor_trades", all_trades)
if result:
    print(f"  Inserted {len(all_trades)} trades")
else:
    print("  Failed to insert trades")

# Step 3: Verify
print("\n=== Verification ===")
url = f"{SUPABASE_URL}/rest/v1/specialty_contractors?select=id,company_name,introduction,is_public,is_verified,rating&is_public=eq.true&is_active=eq.true&order=rating.desc"
req = urllib.request.Request(url)
req.add_header("apikey", SUPABASE_KEY)
req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode())
print(f"Public active contractors: {len(data)}")
for c in data:
    intro = (c.get("introduction") or "")[:40]
    print(f"  {c['company_name']} | rating={c['rating']} | verified={c['is_verified']} | {intro}...")

print("\nDone!")
