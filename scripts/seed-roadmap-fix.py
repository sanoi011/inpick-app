"""Re-insert milestones and stats."""
import json
import os
import sys
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

def post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code}: {err}")
        return e.code

milestones = [
  {"phase":"Phase 1","title":"1.0 출시버전 완성","period":"2026.01 ~ 02","status":"completed","sort_order":0,"items":["AI 도면 인식 (5소스 융합)","소비자 6탭 워크플로우","사업자 8페이지 포털","관리자 12페이지","17공종 물량산출 엔진","실시간 채팅","공정관리 Gantt","시공도면 3종","PDF 3종","보안 감사 70+ API","E2E 33테스트","PWA + SEO"]},
  {"phase":"Phase 2","title":"서비스 고도화","period":"2026.03 ~ 04","status":"in_progress","sort_order":1,"items":["입면전개도 AI 생성","AI 3D 렌더링","카카오 로그인","Toss 실결제","다평형 30+ 타입","SaaS 구독","자재사 API","모바일 앱","커스텀 도메인"]},
  {"phase":"Phase 3","title":"스케일업","period":"2026.05 ~","status":"planned","sort_order":2,"items":["B2C 광고","자재 AI (PPL)","기능공 매칭 수수료","프리미엄 리스팅","AR 도면 오버레이","전국 확장","해외 진출","가격 예측"]},
]

stats = [
  {"label":"완성 기능","value":"35+","sub":"핵심 기능 모듈","sort_order":0},
  {"label":"페이지 수","value":"40+","sub":"소비자+사업자+관리자","sort_order":1},
  {"label":"API 라우트","value":"70+","sub":"보안 감사 완료","sort_order":2},
  {"label":"DB 테이블","value":"26+","sub":"Supabase 마이그레이션","sort_order":3},
]

print("Milestones:")
s = post("roadmap_milestones", milestones)
print(f"  -> {s}")

print("Stats:")
s = post("roadmap_stats", stats)
print(f"  -> {s}")

# Verify
for table in ["roadmap_features", "roadmap_milestones", "roadmap_stats"]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id"
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    print(f"{table}: {len(data)} rows")
