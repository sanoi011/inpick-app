"""Seed roadmap data directly to Supabase."""
import json
import os
import sys
import urllib.request

# Read env
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

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

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
        print(f"  ERROR {e.code}: {e.read().decode()}")
        return e.code

# Features
features = [
  {"title":"AI 도면 인식","description":"Gemini 3.0 Pro + YOLOv26 + PyMuPDF 5소스 융합 파이프라인","detail":"PDF/이미지 업로드 → 5개 소스 병렬 분석:\n1. Gemini 3.0 Pro Vision\n2. YOLOv26 (ONNX)\n3. PyMuPDF\n4. floorplan-ai\n5. Template Matcher\n\n검증: 59/84A/84B 3타입 신뢰도 1.0","icon_name":"ScanLine","tags":["Gemini 3.0","YOLOv26","PyMuPDF"],"status":"completed","sort_order":0,"has_demo":False,"images":[]},
  {"title":"2D/3D 도면 뷰어","description":"SVG 치수선 + Three.js PBR 재질 렌더링","detail":"2D: SVG 엔지니어링 도면\n3D: Three.js R3F PBR + SSAO + Bloom","icon_name":"Box","tags":["Three.js","SVG","PBR"],"status":"completed","sort_order":1,"link":"/project/new","has_demo":False,"images":[]},
  {"title":"AI 디자인 상담","description":"Gemini 3.0 Pro 멀티모달 + RAG 지식베이스","detail":"SSE 스트리밍 + RAG 시맨틱 검색","icon_name":"MessageSquare","tags":["Gemini 3.0","RAG","SSE"],"status":"completed","sort_order":2,"has_demo":False,"images":[]},
  {"title":"17공종 물량산출","description":"한국 아파트 표준 기반 자동 산출 엔진 60+ 항목 단가DB","detail":"17개 공종 모듈, 3타입 모두 E2E PASS","icon_name":"Calculator","tags":["17공종","60+ 단가"],"status":"completed","sort_order":3,"has_demo":False,"images":[]},
  {"title":"견적서/계약서 PDF","description":"jsPDF 한국어 NanumGothic + 공정위 표준계약서","detail":"3종 PDF 자동 생성","icon_name":"FileText","tags":["jsPDF","한국어"],"status":"completed","sort_order":4,"has_demo":False,"images":[]},
  {"title":"실시간 도면 생성","description":"네이버 원본 → Gemini 3.0 Pro 4단계 SSE 파이프라인","detail":"4단계 SSE: 다운로드→클린→반전→마스크","icon_name":"ImageIcon","tags":["Gemini 3.0","SSE"],"status":"completed","sort_order":5,"has_demo":False,"images":[]},
  {"title":"세그멘테이션 마스크","description":"Canvas 픽셀 조작 자재 실시간 오버레이","detail":"13개 방 타입 RGB 매핑 + alpha blend","icon_name":"Layers","tags":["Canvas","실시간"],"status":"completed","sort_order":6,"has_demo":False,"images":[]},
  {"title":"소비자 6탭 워크플로우","description":"우리집 찾기→도면/3D→AI 디자인→렌더링→물량산출→견적요청","detail":"6탭 + 4가지 도면 입력 방식","icon_name":"Home","tags":["6탭","E2E"],"status":"completed","sort_order":7,"link":"/project/new","has_demo":False,"images":[]},
  {"title":"사업자 포털 8페이지","description":"대시보드/입찰/프로젝트/AI/매칭/일정/재무/프로필","detail":"8개 페이지 완전 구현","icon_name":"Building2","tags":["8페이지","CRM"],"status":"completed","sort_order":8,"link":"/auth?type=contractor","has_demo":False,"images":[]},
  {"title":"실시간 채팅","description":"Supabase Realtime + 옵티미스틱 UI","detail":"postgres_changes 구독","icon_name":"Wifi","tags":["Realtime","WebSocket"],"status":"completed","sort_order":9,"has_demo":False,"images":[]},
  {"title":"공정관리 Gantt","description":"SVG/DOM 하이브리드 Gantt + 드래그 리사이즈","detail":"7공정 자동 배분","icon_name":"BarChart3","tags":["Gantt","드래그"],"status":"completed","sort_order":10,"has_demo":False,"images":[]},
  {"title":"업체 디렉토리","description":"종합/전문 업체 검색, 필터, 포트폴리오","detail":"업체 상세 4탭","icon_name":"Users","tags":["검색","필터"],"status":"completed","sort_order":11,"link":"/find-contractors","has_demo":False,"images":[]},
  {"title":"Toss 결제 연동","description":"크레딧 충전 + 웹훅 검증 + 결제 이력","detail":"Mock 모드 지원","icon_name":"CreditCard","tags":["Toss","웹훅"],"status":"completed","sort_order":12,"has_demo":False,"images":[]},
  {"title":"보안 감사 + E2E 테스트","description":"70+ API 전수 인증 검사, Playwright 33개","detail":"보안 감사 Rounds 8-13","icon_name":"Shield","tags":["보안","E2E"],"status":"completed","sort_order":13,"has_demo":False,"images":[]},
  {"title":"입면전개도 AI 생성","description":"참고 이미지 + 도면 + 인테리어 4컷 → Gemini 3.0 Pro → SVG","detail":"하이브리드 파이프라인: 입력 → Gemini 3.0 Pro → 방별 벽 전개도 JSON → SVG 렌더링","icon_name":"PenTool","tags":["Gemini 3.0","SVG","입면도"],"status":"in_progress","sort_order":0,"has_demo":True,"images":[{"src":f"/showcase/elevation-{str(i+1).zfill(2)}.jpg","label":f"입면전개도 참고 {i+1}"} for i in range(9)]},
  {"title":"시공도면 자동생성 고도화","description":"가구배치도/전기배선도/입면전개도 3종 AI 보강","detail":"3종 도면 + Gemini 3.0 Pro 보강","icon_name":"PenTool","tags":["SVG","Gemini 3.0"],"status":"in_progress","sort_order":1,"has_demo":False,"images":[]},
  {"title":"AI 3D 인테리어 렌더링","description":"Gemini 3.0 Pro 텍스처 생성 + WebGL","detail":"스타일별 4컷 병렬 생성","icon_name":"Camera","tags":["Gemini 3.0","WebGL"],"status":"in_progress","sort_order":2,"has_demo":False,"images":[]},
  {"title":"카카오 로그인 연동","description":"Supabase Auth 카카오 provider","icon_name":"Smartphone","tags":["카카오","OAuth"],"status":"planned","sort_order":0,"has_demo":False,"images":[]},
  {"title":"Toss 실결제 오픈","description":"Mock → 실결제 전환","icon_name":"CreditCard","tags":["Toss","결제"],"status":"planned","sort_order":1,"has_demo":False,"images":[]},
  {"title":"다평형 도면 라이브러리 (30+)","description":"전국 아파트 도면 수집 + 자동 파싱","icon_name":"Database","tags":["30+ 타입"],"status":"planned","sort_order":2,"has_demo":False,"images":[]},
  {"title":"사업자 SaaS 구독","description":"월간/연간 3단계 플랜","icon_name":"Building2","tags":["SaaS","구독"],"status":"planned","sort_order":3,"has_demo":False,"images":[]},
  {"title":"자재사 API 연동","description":"실시간 시세 반영","icon_name":"DollarSign","tags":["API","단가"],"status":"planned","sort_order":4,"has_demo":False,"images":[]},
  {"title":"모바일 앱","description":"React Native + PWA 강화","icon_name":"Smartphone","tags":["React Native"],"status":"planned","sort_order":5,"has_demo":False,"images":[]},
  {"title":"B2C 타겟 광고","description":"계약 진행 유저 맞춤형 광고 + PPL","icon_name":"Target","tags":["광고","AI 추천"],"status":"planned","sort_order":6,"has_demo":False,"images":[]},
  {"title":"AR 도면 오버레이 + 전국 확장","description":"ARKit/ARCore + 수도권→전국","icon_name":"TrendingUp","tags":["AR","확장"],"status":"planned","sort_order":7,"has_demo":False,"images":[]},
]

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

# Normalize: ensure all features have the same keys
all_keys = set()
for f in features:
    all_keys.update(f.keys())
for f in features:
    for k in all_keys:
        if k not in f:
            f[k] = None

print(f"=== Seeding Roadmap Data ===")
print(f"Features: {len(features)} (keys: {sorted(all_keys)})")
status = post("roadmap_features", features)
print(f"  -> HTTP {status}")

print(f"Milestones: {len(milestones)}")
status = post("roadmap_milestones", milestones)
print(f"  -> HTTP {status}")

print(f"Stats: {len(stats)}")
status = post("roadmap_stats", stats)
print(f"  -> HTTP {status}")

# Verify
print(f"\n=== Verification ===")
for table in ["roadmap_features", "roadmap_milestones", "roadmap_stats"]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id"
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    print(f"  {table}: {len(data)} rows")

print("\nDone!")
