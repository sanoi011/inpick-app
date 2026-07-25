# InPick 작업 재개 핸드오프

마지막 갱신: 2026-07-26 (KST)
현재 작업 경로: `/Users/seonbonkim/Desktop/AIOD/개발/inpick beta ver1/inpick_product_hide_hotfix`
현재 로컬 브랜치: `codex/hide-product-and-enlarge-estimate`
작성 시점 원격 기준: `origin/main`의 `d17d533`
최신 핸드오프: `docs/status/HANDOFF-2026-07-26-WEB-AUTH-AND-MOBILE-STEP2.md`

이 문서는 터미널, Codex, Claude Code를 완전히 종료한 뒤에도 현재 상태에서 바로
작업을 재개하기 위한 단일 기준 문서다. 날짜가 붙은 예전 핸드오프보다 이 파일을
먼저 사용한다.

## 0. 2026-07-26 최신 상태

아래의 과거 기록보다 다음 최신 핸드오프를 우선한다.

- `docs/status/HANDOFF-2026-07-26-WEB-AUTH-AND-MOBILE-STEP2.md`
- 웹 Google 로그인은 운영에서 실제 사용자 로그인과 세션 유지까지 확인됐다.
- 확정 원인과 재발 방지는
  `docs/ops/WEB_OAUTH_PKCE_INCIDENT_2026-07-25.md`가 정본이다.
- 작성 시점 `origin/main`은 `d17d533`이며, 다른 터미널의 Step 2 모바일 변경을
  포함한다. 해당 변경을 덮어쓰지 말고 최신 핸드오프의 검수 순서부터 진행한다.
- 인증 관련 변경이나 웹 배포 전에 반드시 `$inpick-auth-regression`을 실행한다.

## 0-A. 2026-07-21 22:53 과거 재개 상태 — 84㎡ 골든 타입만 진행

이 절은 아래의 2026-07-19 지시보다 최신이며, 범위가 충돌하면 이 절을 우선한다.

### 사용자 확정 범위

- 지금부터 **84㎡ 한 타입만 완성**한다. 59/74/114㎡ 구현·검수·패키징은 중단한다.
- 4타입 traversal matrix를 잠깐 시작했지만 사용자가 즉시 84㎡ 전용으로 정정해
  중단했다. 그 실행에서 생긴 다른 평형 로그나 화면은 승인 근거로 사용하지 않는다.
- 84㎡가 창호, 문, 동선, 조명, 재질, 외부 조망과 실제 조작까지 골든 기준에 도달한
  뒤에만 다른 타입 확장을 다시 검토한다.

### 84㎡ 현관 동선 현재 증거

- 최신 소스에는 실제 `CharacterMovement` 캡슐을 이동시키는 traversal audit와
  `elevator → corridor → front-door → entrance → entry-corridor → corridor-turn →
  living-approach → living` 경로가 존재한다.
- 84㎡ editor game/offscreen 검수는 성공했다.
  - 로그: `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-traversal-84.log`
  - 최종 marker: `INPICK_TRAVERSAL_AUDIT_COMPLETE success=1 timed_out=0 type=84`
  - 8개 checkpoint 모두 `collision_clear=1`
  - 최종 위치: `V(X=827.48, Y=421.03, Z=92.15)`
- 사람이 확인한 1280×720 화면:
  - `unreal/InPickLiving/Saved/InPickLiving/Smoke/interior-traversal-84-entrance.png`
  - `unreal/InPickLiving/Saved/InPickLiving/Smoke/interior-traversal-84-living.png`
- 정확한 상태는 **source present + editor launched + automated traversal passed +
  screenshots human-inspected**다. 이 변경을 담은 새 packaged `.app`은 아직 없다.
- 사용자가 실제로 확인한 패키지는
  `Build/Artifacts/macOS/0.3.10-dev.20260719/InPickLiving.app`이다. 이 패키지는
  traversal/현관 보완 전 산출물이므로 최신 수정 반영 패키지로 보고하지 않는다.

### 다음 84㎡ 그래픽·건축 요구사항

- 사용자 피드백: 현재 창밖은 평면 배경처럼 보이고 사실감이 부족하며, 실제 창호가
  없는 것처럼 보인다.
- 외부창호는 **이건창호 공식 제품 한 모델**을 기준으로 프레임 비례와 개폐 분할을
  만든다. 이건 공식 사이트에서 시스템창호 회사/제품군 존재까지 확인했지만, 정확한
  모델명·공식 도면·치수는 아직 선정하지 않았다. 임의 모델명을 만들지 않는다.
- 공식 모델과 치수/3D/PBR 권리 근거가 완전히 확보되기 전에는 화면과 데이터에
  `이건창호 레퍼런스 프로토타입 / 견적 SKU 미승인`으로 표시한다.
- 창호는 최소 외곽 프레임, 실제 창짝 분할, 멀리언, 창대, 복층유리 깊이와 유리
  반사/거칠기 표현을 가져야 한다. 창밖은 게임 카메라 높이·원근·노출이 자연스러운
  고해상도 도시/한강 조망으로 교체한다.
- 현관문은 문짝 중심이 아니라 **벽 쪽 경첩축**을 피벗으로 회전해야 한다.
- 같은 재사용 가능한 hinged-door 구조를 이후 각 방문과 다용도실 터닝도어에
  적용한다. 지금 우선 구현/검수 대상은 84㎡ 현관문이다.
- 위 요구에 대해 코드와 자산 구조만 조사했다. **창호/유리/힌지 변경은 아직 소스에
  적용하지 않았고, 새 외부 조망 이미지도 생성하지 않았다.**

현재 관련 파일:

- `unreal/InPickLiving/Source/InPickLiving/Private/Interior/InPickInteriorPrototypeGameMode.cpp`
- `unreal/InPickLiving/Source/InPickLiving/Private/Interior/InPickExteriorViewActor.cpp`
- `unreal/InPickLiving/Source/InPickLiving/Private/Interior/InPickPrototypeSurfaceActor.cpp`
- `unreal/InPickLiving/Build/Scripts/create_interior_material_library.py`
- `unreal/InPickLiving/Build/Scripts/import_exterior_view_assets.py`
- 현재 조망 원본: `Content/InPickLiving/Interior/Art/gangnam-han-river-day-v1.png`
  (4096×1519, 기존 runtime candidate)

재개 순서:

1. 이건창호 공식 카탈로그/제품 페이지에서 84㎡ 거실 외창에 적합한 정확한 모델 하나와
   프레임·개폐 방식을 확정한다. 유료 다운로드나 사용권 동의가 필요하면 사용자에게
   넘긴다.
2. 84㎡ 전용 외부창호 assembly와 유리 재질을 구현한다.
3. 현관문을 벽측 hinge pivot actor/scene root 구조로 바꾸고, 문짝 clearance와
   traversal을 다시 검수한다.
4. 사실적 외부 조망을 비파괴 버전 파일로 생성·import한다.
5. UBT compile → 84㎡ traversal → 84㎡ 창호/거실 visual capture → 새 macOS
   internal package → 실제 게임 창 사용자 확인 순서로 진행한다.

### Apps in Toss 결제 저장 상태

- 토스 미니앱 전용으로 토큰/PDF 결제를 앱인토스 페이 `checkoutPayment` 흐름으로
  교체했다. 운영 웹·App Store·Google Play 결제 코드는 커밋 범위에 포함하지 않았다.
- API: `https://inpick-apps-in-toss-api.vercel.app`
- 새 `.ait`: `apps-in-toss/inpick/inpick.ait`
  - SHA-256: `d8bb3b2fd6c74b2c3b270f5d03ae8365c449697626d67f02b5f35c3b07e7e6f6`
  - AIT deployment ID: `019f849a-d7eb-799d-9347-f5752cdc36e9`
- 커밋·push 완료: `774b8fb feat(apps-in-toss): replace payments with Toss Pay`
- API typecheck, 7/7 tests, isolated snapshot 116 files, production build와 결제 모달
  렌더 검수를 통과했다. 실제 라이브 결제는 앱인토스 콘솔 토스페이 이용 신청과
  mTLS 키 등록 완료 후 별도 검수해야 한다.

### 작업 트리/프로세스 주의

- `unreal/`, `docs/inpick-living/`, `public/inpick-living/`, `scripts/inpick-living/`는
  현재 저장소에서 큰 untracked 작업 묶음이다. 삭제·clean·광범위 add를 하지 않는다.
- 중단 시 실행 중인 InPickLiving/UnrealEditor/UBT/RunUAT는 없고 저부하
  `UnrealEditorServices`만 확인됐다. 백그라운드 빌드가 계속된다고 가정하지 않는다.

## 0-A. 2026-07-19 21:37 과거 중단 상태 — 현관 진입 차단 P0

아래는 당시 기록이다. 네 평형을 모두 우선하라는 내용은 위 2026-07-21의
`84㎡만 진행` 결정으로 대체됐다.

- 사용자가 실제 실행 화면에서 **현관 문을 연 뒤 내부 진입 동선이 벽/충돌에
  막힌다**고 확인했다. 현재 결과물의 체감 품질이 기대에 미달한다는 피드백도
  명확히 받았다. 다음 세션은 이 문제를 다른 어떤 기능보다 먼저 해결한다.
- 기존 `0.3.9`의 macOS HID 18/18은 `50cm 이동`, `현관 문 열림`, surface 선택과
  상태 전이를 각각 확인했을 뿐, **엘리베이터 → 현관 → 거실까지 캡슐이 실제로
  연속 통과하는지 검증하지 않았다**. topology validator의 room reachability도
  런타임 벽 mesh/collision 통과를 증명하지 않는다. 따라서 종전의 “동선 정상”
  표현을 제품 체감 검수로 받아들이면 안 된다.
- 재개 즉시 59/74/84/114 각각에서 entry door 개구부, entry와 첫 내부 실 사이의
  개구부, 문틀/문짝/threshold 충돌, player capsule 폭, 시작 위치를 런타임
  geometry와 패키지에서 확인한다. 원인을 추측으로 고정하지 말고 실제 충돌
  sweep와 위치 로그로 특정한다.
- 완료 기준은 네 평형 모두에서 실제 OS 입력 또는 동등한 이동 입력으로
  `elevator → corridor → front door → entrance → living` 체크포인트를 순서대로
  통과하고, 각 체크포인트 좌표·충돌 없음·최종 거실 도달 marker가 패키지 로그에
  남으며, 최소 현관/거실 화면을 사람이 직접 확인하는 것이다.
- 이 P0가 통과하기 전에는 서비스 프로토콜, 계정 연동, 자재 조사, 그래픽 향상으로
  넘어가지 않는다. 불완전한 패키지를 사용자에게 다시 열어 보여주지 않는다.
- 발열 요청으로 빌드/검수를 중단했다. 중단 시점에 실행 중인 InPickLiving,
  UnrealEditor, UnrealBuildTool, RunUAT, zenserver는 없었고 저부하
  `UnrealEditorServices`만 남아 있었다.

### 중단 직전 서비스 브리지 작업 보존 상태

- 운영 계정/API에는 연결하지 않았다. 가짜 토큰만 사용했다.
- Unreal launch/session 관련 전체 automation은 수정 전 소스 기준 77/77,
  웹 identity/session/contracts 집중 테스트는 20/20 통과했다.
- `0.3.10-dev.20260719` Development 패키징은 성공했다.
  - 경로: `unreal/InPickLiving/Build/Artifacts/macOS/0.3.10-dev.20260719/`
  - ZIP size: 486,149,803 bytes
  - SHA-256: `05eab6ce687519c340ac4d7719e27565864615fb7e777d2edf1bea66fa72d85d`
  - arm64, ad-hoc internal, signed=false, notarized=false, releaseReady=false
- 패키지의 `inpickliving://` **warm activation은 통과**했고 capability 문자열이
  로그에 노출되지 않았다. **cold activation은 앱 시작 전 URL event가 런타임
  handler보다 먼저 도착해 유실되어 실패**했다.
- `Build/Scripts/run_packaged_protocol_activation_audit.sh`는 상대 앱 경로를
  절대경로로 바꾸도록 수정했다.
- cold 보완을 위해 `InPickMacProtocolBridge.mm`에 Objective-C `+load` 단계의
  early handler와 메모리 1건 pending URI를 추가했지만, 사용자 중단 요청 직전
  변경이라 **아직 컴파일/패키징/실행 검증되지 않았다**. 마지막 직접 UBT 시도는
  sandbox의 shared-memory/SDK validation 제한으로 코드 컴파일 전에 종료됐다.
  이 소스를 완료로 보고하지 않는다.
- 서비스 브리지 검수는 현관 P0 완료 뒤에만 재개한다.

## 1. 새 터미널에서 바로 재개하기

```bash
cd "/Users/seonbonkim/Desktop/AIOD/개발/InPick/inpick-app"
sed -n '1,320p' AGENTS.md
sed -n '1,360p' docs/status/HANDOFF-CURRENT.md
git status --short
git log -5 --oneline
```

새 작업 세션에 전달할 첫 지시문:

> `AGENTS.md`와 `docs/status/HANDOFF-CURRENT.md`를 먼저 끝까지 읽고, 기존의
> 수정사항을 보존한 채 `다음 작업 우선순위`의 긴급 P0부터 이어서 진행해. 결제,
> 법적 동의, 계정 인증이 필요한 경우를 제외하면 1/2/3 선택을 묻지 말고 기본값
> 2로 진행하고, 각 단계 검수까지 수행해. 소스/컴파일/패키징/실행/사용자 화면
> 확인 상태를 구분해서 보고해.

경로의 `개발` 글자가 터미널에서 분해된 유니코드로 표시될 수 있다. 같은 Finder
폴더이므로 경로를 새로 만들지 말고 위의 따옴표 처리된 절대 경로를 사용한다.

## 2. 절대 보존 규칙

- 현재 작업 트리는 많은 수정 및 신규 파일을 포함한다. 사용자, Codex, Claude가
  함께 만든 작업이므로 광범위하게 되돌리거나 삭제하지 않는다.
- `git reset --hard`, `git checkout --`, 무차별적인 `git clean`, 광범위한
  `git add .`를 사용하지 않는다.
- 변경 확인은 우선 다음 명령으로 한다.

```bash
git diff --ignore-space-at-eol --stat
git diff --ignore-space-at-eol -- <확인할-파일>
```

- `.env.local`에는 비밀 키가 있으므로 내용을 화면, 로그, 커밋, 문서에 출력하지
  않는다.
- Supabase migration 파일은 원격 이력과 조정된 상태다. 차이를 확인하지 않고
  `supabase db push`부터 실행하지 않는다.
- 웹 `/viewer` 또는 정적 와이어프레임을 InPick Living 네이티브 게임이라고
  제시하지 않는다.
- 생성 텍스처나 임시 색상을 실제 승인 자재/SKU 또는 견적 진실로 표시하지 않는다.
- 완료 보고는 항상 `source-only`, `compiled`, `packaged`, `launched`,
  `user-visible verified`를 분리한다.

## 3. 사용자 고정 의사결정

- 일반적인 구현 선택은 기본값 **2**로 자동 진행한다. 검수는 항상 포함한다.
- 결제, 법적 동의, 라이선스 승인, 사용자 계정 인증이 필요한 경우에만 멈추고
  사용자에게 요청한다.
- 작업 중간에 불완전한 GUI를 띄우지 않는다. 조작 가능한 수준과 검수를 확보한
  다음 보여준다.
- 게임 품질이 일정 수준에 도달하기 전에는 InPick 서비스 계정/프로젝트와 실제
  연동하지 않는다. 우선 네이티브 게임 자체를 완성한다.
- 지금 캐릭터와 가구는 후순위다. 건축 공간, 실 이동, 부위 선택, 실제 시공
  공정과 고품질 재질 표현이 먼저다.
- 장기 지원 후보는 **59 / 74 / 84 / 114㎡**지만, 2026-07-21 사용자 결정에 따라
  현재 개발·검수·패키징 범위는 **84㎡ 한 타입**으로 고정한다.

## 4. 설치 및 연결 상태

| 항목 | 현재 확인 상태 |
| --- | --- |
| 저장소 | 위 절대 경로, `main` 브랜치 |
| Node / npm | Node `v24.16.0`, npm `11.13.0` |
| Unreal Engine | UE 5.8, `/Users/Shared/Epic Games/UE_5.8` |
| Epic Games Launcher | `/Applications/Epic Games Launcher.app` |
| Blender | `/Applications/Blender.app` |
| Xcode 선택 경로 | 현재 `/Library/Developer/CommandLineTools` |
| Vercel | 저장소의 `.vercel` 연결 정보 존재, 프로젝트 `inpick-app` |
| Supabase | `supabase/config.toml` 및 로컬 환경 설정 존재 |
| 비밀 키 | `.env.local` 존재, 절대 출력/커밋 금지 |

Developer ID 서명, Apple notarization, Windows Authenticode, Steam 앱/디포는 아직
완료된 배포 설정이 아니다. 이 단계는 계정, 비용 또는 법적 동의가 필요할 수 있다.

## 5. 웹 서비스 현재 상태

### 2026-07-18 최종 결정: 주소·평형 평균 기반으로 단순화

- 주소 검색은 현재 네이버 단지/평형 호출을 유지한다.
- 네이버 평면도가 있으면 건축도면 형식으로 다시 그리지 않는다. 외부 이미지 편집은
  원본 레이아웃·문자·가구·치수를 보존하고 워터마크/로고만 최소 정리한다.
- 네이버 평면도가 없으면 검색 결과 아래 `공급 평형 직접 입력`을 표시한다. 수동
  평형은 전용률 76% 평균으로 전용면적을 추정한다.
- 도면 유무와 관계없이 주소·평형 선택 뒤 외부 frontier 모델에 평형 평균 실 구성을
  JSON prompt로 요청한다. 실패하거나 키가 없으면 로컬 표준 평균표로 폴백한다.
- 산출 실 치수는 전용면적의 약 92%를 거실/안방/침실/주방/욕실/현관 등에 배분하고
  나머지는 벽체·복도·수납 여유로 둔다. 실제 실측값으로 표시하지 않는다.
- Step 1 분석은 Step 2 진입을 막지 않는다. 도면이 없거나 정리가 실패해도 Step 2는
  평균 실 치수 prompt로 `gpt-image-2 /images/generations`를 호출할 수 있다.
- 정리된 도면이 준비된 경우에만 `/images/edits` 구조 참조로 사용한다. 네이버 원본
  URL을 정리 완료 전에 이미지 생성 입력으로 직접 넘기지 않는다.
- 견적은 `normalizedFloorplan.rooms`의 평균/도면 치수를 우선하고, 전체 면적과 생성
  이미지 자재 분석을 함께 사용한다. 이것은 가견적이며 실측 전 확정 견적이 아니다.
- 내부 AI 모델 학습/ONNX endpoint는 현재 사용자 흐름의 필수 조건이 아니다.
  아래 AI-Hub 파이프라인은 향후 정확도 개선용으로 보존하되 즉시 운영 전제에서 제외한다.

관련 문서와 도구:

- `docs/construction-drawings/04-AIHUB-STRUCTURE-PIPELINE.md`
- `scripts/prepare-aihub-floorplan-dataset.py`
- `scripts/train-aihub-floorplan.py`

로컬 AI-Hub zip 감사 결과는 STR 11,643/1,461, SPA 9,645/1,210,
OBJ 8,099/1,014, OCR 9,018/1,129(학습/검증)이며 이미지-라벨 누락은 0이다.
원본 PNG를 그대로 풀면 500GB 이상이므로 준비 스크립트는 기본적으로 장변
1600px PNG로 zip 스트리밍 축소한다.

### 2026-07-18 Step 2 단순화: 공용 프롬프트 + 실별 최종 이미지

- Step 2 생성 결과는 기본적으로 중앙 상담을 가리지 않는 우측 미니 썸네일로 열린다.
  사용자가 썸네일을 누를 때만 크게 본다.
- `즉시 생성 / AI 상담` 토글과 실별 입력창 개념을 없애고, 모든 실이 하나의 공용
  프롬프트를 공유한다. 왼쪽 실 카테고리는 해당 실의 이미지 이력 선택에 사용한다.
- 공용 프롬프트는 `안방 문을 밝은 오크로 바꿔줘`처럼 실 이름과 수정 동사를 읽는다.
  해당 실의 현재 선택 이미지를 `/api/inpick/render-space-edit`에 보내 구조/시점을
  보존한 편집을 수행하고, 결과를 같은 실의 새 시안으로 누적·선택한다.
- 방 이름이 없으면 현재 왼쪽에서 선택한 실을 대상으로 한다. 문, 바닥, 벽, 천장,
  창호, 수납장, 카운터, 가구를 인식해 target surface 힌트로 전달한다.
- 부위별 자재 선택/수정 UI와 Step 2 진입 시 SAM warmup을 비활성화했다. 새 공용
  프롬프트 편집은 `analyzeSurfaces: false`를 보내 구형 자재 분석도 실행하지 않는다.
- 견적 버튼은 바로 이동하지 않는다. 생성된 각 실에서 최종 시안 1장씩 고르는
  팝업을 먼저 띄우고, `selectedByRoom`과 `finalSelectedImageUrlsByRoom`을 확정한다.
- 견적 context finalize는 `selectionMode: final_images_only`와 실별 선택 이미지만
  받는다. 이전 생성본과 구형 사용자 자재 선택을 섞지 않고, 실제 견적 방 목록과
  갤러리도 선택된 이미지 기준으로 이어진다.

관련 핵심 파일:

- `src/components/workflow/Step2Designer.tsx`
- `src/lib/inpick/workflow/prompt-room-router.ts`
- `src/app/api/inpick/render-space-edit/route.ts`
- `src/lib/inpick/estimate-context/final-selection.ts`
- `src/app/api/inpick/estimate-context/finalize/route.ts`
- `src/app/workflow/estimate/page.tsx`

검증:

- `npx tsc --noEmit`: 통과
- 공용 프롬프트 라우팅/최종 선택/평형 평균 테스트: 9/9 통과
- `npm run build`: 통과
- 기존 `onnxruntime-web` dynamic require warning만 유지
- 2026-07-19 로컬 `http://127.0.0.1:3002`에서 Chromium E2E 추가·통과:
  `E2E_BASE_URL=http://127.0.0.1:3002 npx playwright test e2e/workflow-step2.spec.ts --project=chromium --workers=1`
- E2E가 확인하는 범위: 공용 프롬프트 `안방 문` 라우팅, `door` surface 전송,
  `analyzeSurfaces:false`, 안방 3번째 시안 누적, 자재 UI 미노출, 우측 미니 이미지,
  데스크톱/390px 모바일 최종 선택 팝업, 실별 1장 선택, 선택된 두 URL만 session에 저장,
  `/workflow/estimate` 전환
- 실화면 검수 중 발견·수정한 회귀:
  1. Framer Motion transform이 CSS 중앙 정렬 transform을 덮어 팝업 하단 버튼이
     뷰포트 밖으로 나가던 문제 — fixed flex wrapper로 교체
  2. 화면 체크 표시는 바뀌었지만 확정 시 이전 선택 index가 저장될 수 있던 경쟁 —
     모달의 현재 선택 맵을 확정 콜백에 직접 전달
  3. 수정 이미지는 완료됐지만 토큰 잔액 refresh를 기다리며 생성 overlay가 남던 문제 —
     결과 해제와 잔액 비동기 갱신 분리
- 화면 증거는 해당 Playwright test result의 `step2-room-edit.png`,
  `step2-final-selection.png`, `step2-final-selection-mobile.png`에 생성된다.
- 정확한 상태: source 변경 + compiled + local launched + automated user-visible verified
  + production deployed + production automated user-visible verified.
- 운영 브라우저 E2E는 API 호출을 목킹해 UI·상태 연결을 확인했다. 실제
  외부 이미지 엔진 생성·과금 계정을 소비하는 운영 E2E는 수행하지 않았다.

축소 학습셋 준비 완료 상태:

- `datasets/aihub-floorplan/structure`: 13,104 image/label pairs, 1.6GB,
  polygon 1,752,285개, invalid 0
- `datasets/aihub-floorplan/space`: 10,855 pairs, 1.4GB,
  polygon 505,052개, invalid 0
- `datasets/aihub-floorplan/object`: 9,113 pairs, 1.2GB,
  bbox 129,164개, invalid 0
- 전체 이미지 장변 최대 1600px, 초과 0. `datasets/`는 git ignored다.
- 아직 미완료: CUDA 전체 학습, 검증셋 성능 게이트, ONNX export,
  `FLOORPLAN_AI_URL` 운영 endpoint 배포. 기존 합성 104장 모델 성능을 실도면
  성능으로 보고하지 않는다.

### 최근 긴급 수정: 도면 생성 무한 대기

사용자 녹화 파일:
`/Users/seonbonkim/Desktop/KakaoTalk_Video_2026-07-18-19-18-37.mp4`

확인된 원인:

1. 클라이언트 fetch 제한 120초와 stale 감지 125초 때문에 무한 대기처럼 보였다.
2. 응답 헤더 후 JSON 본문을 읽기 전에 타이머가 해제되어 본문 정지 시 끝나지
   않을 수 있었다.
3. 결과 이미지가 준비된 뒤에도 Supabase cache/storage와 Vision 작업을 기다렸다.
4. 선택 변경이나 컴포넌트 종료 시 진행 요청을 적극 취소하지 않았다.

반영된 수정:

- `src/lib/inpick/floorplan/normalize-request.ts`: 요청 80초, stale 85초, JSON 본문까지
  제한 범위에 포함하고 호출자 취소를 전달한다.
- `src/lib/inpick/floorplan/deadline.ts`: 외부 SDK 작업별 제한을 둔다.
- `src/components/workflow/BasicInfoCard.tsx`: pipeline v7, 요청 하나만 유지하고 선택
  변경 시 기존 요청을 취소한다. Step 2 전환 시에는 의도적으로 요청을 중단하지 않고
  평형 평균/워터마크 정리를 백그라운드에서 마친다.
- `src/app/api/inpick/normalize-floorplan/route.ts`: cache 3초, storage 5초,
  source 10초, Vision 35초, image edit 65초 제한과 metadata fallback을 적용한다.
- `src/lib/openai-client.ts`: 응답 본문 파싱도 제한 범위에 포함한다.
- 이후 제품 결정으로 주소 모드의 생성 도면 preview와 blocking은 제거되었고,
  UI는 `공간 정보 분석 중`으로 바뀌었다. 도면이 없을 때 수동 평형 입력과 평균
  실 구성 산출도 같은 비차단 흐름을 사용한다.

검증 증거:

```bash
npx tsc --noEmit --pretty false
node --import tsx --test \
  src/lib/inpick/floorplan/__tests__/deadline.test.ts \
  src/lib/inpick/floorplan/__tests__/normalize-request.test.ts \
  src/lib/inpick/floorplan/__tests__/area-average.test.ts \
  src/lib/inpick/floorplan/__tests__/openai-room-render.test.ts
npm run build
```

- TypeScript: 통과
- 새 도면 제한/취소 테스트: 5/5 통과
- 평형 평균 산출/검증 테스트: 2/2 통과
- 도면 없는 `gpt-image-2` generations 분기 테스트: 1/1 통과
- Next.js production build: 통과
- 기존 `onnxruntime-web` dynamic require warning은 알려진 경고다.
- `render-room-spec.test.ts`는 현재 설치되지 않은 `vitest`를 요구하는 기존 별도
  테스트다. 통과했다고 간주하지 않는다.

### 배포 기준점

- 최종 Vercel deployment:
  `https://inpick-cyb4zkt2y-sanois-projects.vercel.app`
- deployment id: `dpl_3TDXgFr58o3Dm8fWy9qGvK8UJKJY`
- 상태: Ready
- 운영 alias: `https://www.interiorpick.co.kr`,
  `https://interiorpick.co.kr`, `https://inpick-app.vercel.app`
- `/workflow`, `/api/inpick/health`: HTTP 200 확인
- 운영 `https://www.interiorpick.co.kr` 기준 Chromium Step 2 E2E 1/1 통과
- 평형 평균/최종 선택/워크플로 재개/프롬프트 라우팅 단위 테스트 16/16 통과
- 운영 DB에 `20260716020000_construction_line_site_pricing_meta.sql` 적용됨
- 직접 deployment URL은 Vercel SSO로 보호된다.
- 무거운 Unreal/native 폴더가 직접 CLI 배포에 섞이지 않도록 `.vercelignore`가
  적용되어 있다. 평상시에는 Git push 기반 배포를 우선한다.

최근 도면 관련 커밋은 모두 push되어 있다.

```text
34a31e9 feat: streamline room design and estimate flow
e7b09fe fix: simplify floorplan loading copy
33535eb fix: persist floorplan cache variant metadata
6760de6 fix: prevent floorplan generation stalls
```

## 6. InPick Living 게임 목표 사양

게임은 웹 뷰어가 아니라 다운로드 가능한 Unreal 네이티브 1인칭 인테리어
시뮬레이션이다.

- 로비: InPick에서 생성한 평형별 거실 배경 위에 59/74/84/114 카드를 좌우
  스크롤로 선택한다.
- 시작 연출: 엘리베이터 문이 열리고, 플레이어가 내려서 현관 밖에서 집 문을
  여는 장면부터 시작한다.
- 카메라: 사람 눈높이 약 170cm, 마우스 시점, WASD 이동, 충돌과 중력을 갖춘다.
- 공간: 거실, 주방, 욕실 등 방 사이를 실제로 걸어서 이동한다.
- 상호작용: 중앙 시선으로 벽/바닥/천장 등 시공 가능한 mesh/work-cell 덩어리를
  선택한다.
- 공정: 철거 → 바탕 정리 → 미장/수지미장 등 평탄화 → 프라이머 → 마감 순서를
  실제 작업처럼 수행한다.
- 천장: 우물천장/단천장 하부 구조와 필요한 자재 순서를 포함한다.
- 전기/설비: 숨은 전공정, 철거, 배관/배선, 현장 조건에 따른 금액 변동을 견적에
  연결할 수 있게 도메인을 유지한다.
- 재질: 제조사/브랜드/SKU의 정확한 제품 identity, PBR map hash와 실제 스케일을
  검증한 경우에만 견적용 자재로 승인한다.
- 창밖: 밝고 고품질인 강남/한강 조망을 목표로 하되, 권리 문제가 없는 생성 또는
  정식 라이선스 에셋만 사용한다.
- 장기 목표: 유성구 공공 지도 기반 도로/건물/식재 → 대전/충남 확장 → 거주 인증
  공간 배포 → GTA/심즈형 이동과 생활이다. 현재 우선순위는 아니다.

## 7. Unreal 현재 구현 및 검증 상태

### 최신 소스 상태

- UE 5.8 `InPickLivingEditor Mac Development` UBT compile: 성공
  - 2026-07-19 최종 외측면 와인딩/work-cell 변경: 2 actions
  - UBA 2.88초, 전체 4.77초
  - UBT 로그: `/Users/seonbonkim/Library/Application Support/Epic/UnrealBuildTool/Log.txt`
- 4개 평형 interior smoke matrix: 성공

| 평형 | work cells | 최종 stage | 테스트 견적 합계 | 입력 상태 |
| --- | ---: | ---: | ---: | --- |
| 59㎡ | 4 | 5 | ₩83,900 | 이동/시점 정상 |
| 74㎡ | 9 | 5 | ₩151,322 | 이동/시점 정상 |
| 84㎡ | 4 | 5 | ₩135,800 | 이동/시점 정상 |
| 114㎡ | 12 | 5 | ₩116,400 | 이동/시점 정상 |

모두 `move_ignored=0`, `look_ignored=0`, walking=1, stage=5를 기록했다.

- 2026-07-19 재검증은 `UnrealEditor-Cmd`, `-nullrhi`, `-trace=none`을 사용해
  59/74/84/114를 각각 직접 실행했고 위 값이 모두 재현됐다.
- 현재 macOS에서 `run_interior_smoke_matrix.sh`의 Unreal 자식 프로세스가 드물게
  로그 생성 전에 LaunchServices 대기 상태가 되는 현상이 있었다. 같은 NFC 절대경로
  명령을 직접 실행하면 평형당 약 6초에 정상 종료됐다. 코드/게임 루프 실패와
  혼동하지 말고, wrapper가 멈추면 직접 명령과 각 `interior-smoke-*.log`를 확인한다.

```bash
./unreal/InPickLiving/Build/Scripts/run_interior_smoke_matrix.sh
```

로그:

- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-59.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-74.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-84.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-114.log`

### 2026-07-19 실제 PBR/work-cell 렌더 검수

- `M_InPickSurface_Master` 및 paint/timber/stone/metal 자산 생성 commandlet:
  `0 error`, `0 warning`, materials=5, textures=9, loose_objects=0.
- 모든 기본 박스와 라운드 박스의 procedural triangle winding을 외측면 기준으로
  수정했다. 이전에는 가까운 면이 컬링되고 반대편 내측면이 보여 normal/조명이
  평평하며 work-cell이 원본 면 뒤로 숨었다.
- 변경된 셀은 동일 surface mesh의 별도 non-collision section으로 렌더한다.
- 벽 work-cell 높이를 90cm로 조정해 2.7m 벽에서도 6개 공정 상태를 한 화면에
  검증할 수 있다.
- 철거/바탕/레벨링/프라이머는 검증된 paint PBR graph에 단계 tint를 100% 적용하고,
  finish는 timber/stone/paint PBR과 물리 UV 스케일을 유지한다. 승인 SKU truth는
  여전히 0건이며 이 표시는 draft 시공 상태다.
- 84㎡ 거실 바닥/벽/천장을 각각 1920x1080 offscreen 캡처하고 사람이 원본 해상도로
  검수했다. 벽에서는 existing, demolition, substrate, levelling, primer, finish의
  6개 셀이 명확히 분리됐고 바닥/천장에서도 가까운 외측면과 단계 차이가 확인됐다.

```bash
./unreal/InPickLiving/Build/Scripts/run_interior_visual_matrix.sh
```

캡처:

- `unreal/InPickLiving/Saved/InPickLiving/Smoke/interior-visual-84-floor.png`
- `unreal/InPickLiving/Saved/InPickLiving/Smoke/interior-visual-84-wall.png`
- `unreal/InPickLiving/Saved/InPickLiving/Smoke/interior-visual-84-ceiling.png`

시각 매트릭스는 `INPICK_VISUAL_SURFACES=wall`처럼 단일 표면만 재실행할 수도 있다.

현재 최신 소스의 정확한 상태는 **compiled + construction automation 10/10 +
editor/package 4-type batch/hold smoke + offscreen render human-reviewed + macOS
Development packaged + visible package macOS HID input audit 18/18**이다. 마지막 입력
검수는 앱 창에 운영체제 키보드/마우스 이벤트를 보내 실제 게임 상태 변화를 확인한
자동 검수다. 사람이 직접 조작하며 감도·충돌·멀미·가독성을 판단하는 대면 검수와
Developer ID 서명/공증은 별도로 남아 있다.

### 2026-07-19 제품 마스터 설계와 네 평형 shell 기능

- PUBG 공식 Dev Letter/roadmap/GDC 자료와 EA SPORTS FIFA/FC 공식 Pitch Notes,
  Frostbite/SEED 자료를 바탕으로 제품 기획부터 라이브 운영까지의 상위 설계도를
  `docs/inpick-living/PRODUCT-DEVELOPMENT-BLUEPRINT.md`에 작성했다.
- 코어 루프는 `ENTER → INSPECT → SELECT → BUILD → VERIFY → QUOTE → SAVE`이며,
  합성·초안이 허용되는 `Prototype Experience`와 승인 geometry/SKU/서버 견적만
  허용하는 `Verified Project Experience`를 분리한다.
- 보유 5천 도면은 런타임이 직접 AI 분석하는 구조가 아니라 batch ingest → canonical
  ApartmentSchema → 규칙 검사 → 사람 승인 → versioned ApartmentPack으로 제품화한다.
  내부 AI 워크스테이션은 현재 선행 필수 조건이 아니다.
- 74/114 후보 데이터는 원본 checksum을 보존하고 Unreal staged 사본만 비중첩
  runtime shell로 만들었다. 두 사본 모두 `approvedPlanTruth=false`,
  `quoteGeometryAllowed=false`다.
- shell 결과:
  - 74㎡: rooms 16, walls 15, doors 16, windows 10, surfaces 121
  - 114㎡: rooms 13, walls 16, doors 16, windows 12, surfaces 124
- `validate_apartment_prototypes.py`는 schema, ID, polygon, wall/opening, clearance,
  창 높이, room adjacency, entry에서 living/kitchen/bathroom 도달성을 검사한다.
  59/74/84/114 전체가 오류 0, 경고 0으로 통과한다.
- 검증기가 찾은 59/84 잘못된 창 wall ID/anchor 5건은 원본을 수정하지 않고 staged
  사본에서 보정하고 source/runtime 값을 correction metadata에 함께 기록했다.
- 59/84 door audit를 추가해 실제 partition 문은 wall ID/위치/실 ID를 고정하고,
  무문 통로는 가짜 door actor 대신 `openConnections`로 표현했다. 59의
  circulation 단절과 room overlap도 staged runtime 사본에서 원본 audit metadata를
  보존하며 해소했다.
- data-driven `FInPickConstructionState`가 GameMode Apply/Undo/Redo의 권한을 갖는다.
  stable ID, prerequisite, int64 draft amount, immutable history, SHA-256 hash와 함께
  화면에 `DRAFT / U UNDO / Y REDO` rail을 항상 표시한다.
- `FInPickConstructionDraftSnapshot`은 core JSON object, hash, lossless int64/uint64,
  cell/material/history/redo와 현장확인 셀을 fail-closed로 검증한다. schema v2로
  저장하되 v1 개발 초안도 읽는다. K는 평형별 local draft를 저장하고 L은 불러온다.
- `B`는 선택 실에서 가장 뒤처진 공정의 모든 셀을 candidate state에 먼저 적용하고
  전부 성공할 때만 확정한다. 한 셀이라도 실패하면 hash/금액/history가 바뀌지 않는다.
  같은 batch의 `U/Y`는 모든 셀을 한 번에 undo/redo한다.
- 철거 다음 substrate 단계는 명시적인 `H` 현장조건 확인 전에는 `F/B` 모두 막힌다.
  확인 상태는 local draft에 저장되며 unknown/중복/기존마감 셀 확인은 거부된다.
- 변조 hash/금액/히스토리/중복 cell, 원자적 batch, 현장확인, v1 호환을 포함한
  construction automation 10/10이 통과했다.
- floor/ceiling surface는 이제 표시명과 별개의 stable room ID를 유지하고,
  cell별 material index를 보존한다. HUD에 room progress, 완료 cell 수, runtime
  geometry truth badge, quote-blocked 초안 견적 panel을 추가했다.
- HUD 우측에는 승인 견적과 분리된 공정·실·부위·셀 수·금액 line item panel을,
  하단에는 hold point 상태를 표시한다.
- UBT, `InPickLiving.Construction` 10/10, editor 4-type batch/hold smoke, 84㎡
  1920×1080 floor/wall/ceiling offscreen 캡처, packaged app 4-type direct smoke를
  통과했다. 모두 `hold_blocked=1`,
  `move_ignored=0`, `look_ignored=0`, walking=1, stage 5, undo/redo 1,
  draft save/load 1, hash length 64다.
- `O` 로컬 설정 화면을 추가했다. Performance/Balanced/High 화질, 0.50~1.50x
  시점 감도, 90~130% HUD, high contrast, reduce motion을 기기 ini에만 저장하고
  계정/프로젝트 데이터는 쓰지 않는다. 명령행 성능 프로필은 로컬 ini가 덮어쓰지 않는다.
- settings automation 3/3, performance automation 10/10, high contrast + 115% HUD +
  reduce motion 1920×1080 화면 검수를 통과했다. 검수 이미지는
  `Saved/InPickLiving/Smoke/interior-settings-84.png`다.
- cooked 84㎡ Balanced/1920×1080 Metal strict gate는 post-load 0.75초 warmup 뒤
  3초/361 frame을 측정해 avg 8.334ms, P95 9.065ms, max 9.353ms,
  GPU avg 6.580ms, hard hitch 0, reported resident 5069.1 MiB, over-budget 0을 기록했다.
- `-InPickNativeInputAudit`는 gameplay 함수를 직접 호출하지 않고 실제 입력 결과만
  관찰한다. macOS CoreGraphics HID 드라이버가 보이는 패키지 창에 `3`, WASD,
  마우스, E/F/H/B/U/Y/X/K/L/O/화살표/Q를 전송했고 `0.3.9`에서 type 선택,
  입력 수신, 50cm 이상 실제 이동, 시점, 문 열림, surface 선택, apply/hold/batch,
  undo/redo, 자재 cycle, save/load, 설정 열기/변경/닫기, 로비 복귀 18/18을 통과했다.
- 입력 검수 로그:
  `Saved/InPickLiving/PackagedAutomation/interior-packaged-native-input-84.log`
- 보이는 설정 화면 증거:
  `Saved/InPickLiving/Smoke/interior-packaged-native-input-settings-84.png`
- 같은 `0.3.9` cooked strict gate는 361 frame에서 avg 8.332ms, P95 9.067ms,
  max 9.537ms, GPU avg 6.584ms, hard hitch 0, resident 5074.8 MiB,
  over-budget 0으로 재통과했다.

### 최신 macOS 내부 개발 패키지

`unreal/InPickLiving/Build/Artifacts/macOS/0.3.9-dev.20260719/`

- ZIP: `InPickLiving-macOS-0.3.9-dev.20260719.zip`
- architecture: arm64
- configuration: Development
- size: 486,144,585 bytes
- SHA-256: `d07cb60b306ed64c6b56f2cd7e38311ce2528adf10699667f6430a1505362539`
- signed: false
- notarized: false
- releaseReady: false

`verify_release_artifact.py`의 manifest/checksum/ZIP CRC/번들 서명 검사와 패키지
직접 실행 4-type smoke 및 macOS HID 입력 18/18을 통과했다. 이는 ad-hoc 내부 QA
산출물이지 외부 배포 후보가 아니다. Developer ID 서명·Apple 공증·실제 사람의
조작감/편안함 검수는 남아 있다.

## 8. 자재 승인 파이프라인 상태

- 공식 자재 파일럿 후보: 바닥 2, 벽 2, 천장 1 조사 완료
- 정확한 제품 identity 일치: 0/5
- 승인 카탈로그 등록 가능: 0/5
- LX BENIF RS130은 coverage lead일 뿐 승인된 PBR SKU가 아니다.
- evidence audit: `safeFailClosed=true`, errors 0
- 자재 승인 카탈로그는 의도적으로 비어 있다.

다음에는 제조사 공식 페이지/다운로드 자료에서 제품 코드, 치수, 적용 범위,
정확한 PBR map, 사용권을 모두 확보해야 한다. 유료 구매나 라이선스 동의가
필요하면 해당 페이지만 열어두고 사용자 승인을 요청한다.

## 9. 백엔드 및 데이터 권한 상태

원격 authority QA에서 확인된 항목:

- 같은 ticket 동시 claim: 정확히 1건만 성공
- quota: project 5, user 20
- revision 동시 commit: 1건 성공, 1건 409
- replay 방지, retention cleanup, fixture cleanup 확인
- Living 테스트: 28/28 통과
- release QA 스크립트:
  `scripts/inpick-living/release-qa-remote-authority.ts`

Supabase migration 이력은 이미 조정되었다. 근거 문서:
`docs/ops/SUPABASE_MIGRATION_RECONCILIATION_2026-07-17.md`

게임과 계정/프로젝트/행동 이벤트/견적의 실제 연결은 게임 품질 게이트를 통과한
뒤 진행한다. 현재는 API와 권한 기반이 준비된 상태이지 최종 게임 연동 완료가 아니다.

## 10. 다음 작업 우선순위

### 긴급 P0 — 실제 현관 진입 동선 복구

1. 위 최신 재개 상태를 기준으로 84㎡ runtime entry geometry만 검사한다.
2. door opening이 wall mesh에 실제 cut됐는지, entrance에서 living으로 나가는
   다음 opening이 존재하는지, door/frame/threshold collision과 capsule clearance가
   맞는지 확인하고 수정한다.
3. 기존 smoke처럼 문을 자동으로 열고 surface 함수를 직접 호출하는 검수로 끝내지
   않는다. 패키지에서 플레이어 위치가 체크포인트를 순서대로 통과하는 새
   traversal audit를 추가한다.
4. 84㎡ 거실 도달 + 현관/거실 화면 + 새 패키지 검수 전에는 다른 평형으로 가지 않는다.

### P0-A — 재개 안전 확인

1. `AGENTS.md`와 이 문서를 끝까지 읽는다.
2. `pwd`, `git status --short`, `git log -5 --oneline`으로 정확한 저장소와 변경분을
   확인한다.
3. 기존 dirty worktree를 보존한다. 관련 파일만 선택적으로 수정/스테이징한다.
4. 긴급 웹 회귀가 의심될 때만 운영 alias와 `/workflow`를 빠르게 확인한다.

### P1 — 게임 시각 품질과 인테리어 핵심 루프

1. 실제 Unreal `M_InPickSurface_Master` PBR master material을 확정하고 work-cell의
   단계별 외형 변화를 offscreen 자동화와 실제 화면으로 검수한다.
   - 2026-07-18 추가: `/Game/InPickLiving/Materials/M_InPickSurface_Master` 자산 생성,
     world-aligned baseColor/normal/roughness, 물리 크기, metallic/AO 선택 파라미터
     연결 완료. commandlet `0 error`, UBT compile, 4-type offscreen smoke 통과.
   - 2026-07-19 완료: 외측면 winding/normal 수정, 84㎡ 바닥·벽·천장 1920x1080
     visual matrix 통과, 6단계 외형과 물리 UV 스케일 사람 눈 검수 완료.
2. 현재는 84㎡ 건축 shell만 개선한다: 실 인접 관계, 문, 창, 벽 두께, 높이,
   치수, 충돌, 동선을 우선한다. 가구는 넣지 않는다. 59/74/114는 동결한다.
   - 2026-07-19 데이터·headless 단계 완료: 전체 4-type topology 오류/경고 0,
     editor/package direct smoke 통과. 최신 package OS HID 이동·문·상호작용
     검수는 P2에서 통과했고, 사람의 동선/충돌 체감 검수는 별도다.
3. 엘리베이터 → 복도 → 현관 문 열기 → 실내 진입 흐름과 170cm 1인칭 이동을
   실제 키보드/마우스로 확인한다.
4. mesh/work-cell 선택과 철거 → substrate → 평탄화 → primer → finish의 시각 및
   상태 전이를 구현하고 undo와 금액 변화를 연결한다.
   - 2026-07-19 소스/자동화 완료: data-driven 0→5, U/Y undo/redo, int64 초안
     금액, K/L local draft, room progress/truth HUD, cell별 material state.
   - 2026-07-19 추가 완료: 원자적 B room batch, 그룹 U/Y, H 현장확인 hold point,
     공정·실·부위별 견적 line item panel과 0.3.8 package matrix.
   - 2026-07-19 추가 완료: `O` 로컬 설정, 화질/감도/HUD scale/high contrast/
     reduce motion, 1920×1080 설정 화면 검수, cooked Metal strict performance gate.
   - 2026-07-19 추가 완료: 보이는 `0.3.9` 패키지 창에 macOS HID 입력을 전송해
     type→이동/시점→문→surface→공정→저장→설정→로비 18/18 상태 전이 검수.
     다음은 짧은 사람 조작감/동선 검수다.
5. 권리 문제가 없는 고품질 강남/한강 창밖 환경, 실내 조명, 재질 스케일을
   개선한다.
6. 공식 SKU 5개 파일럿의 identity/PBR/권리 근거를 확보한다. 승인 전에는 임시
   재질로 명시하고 견적 truth에 넣지 않는다.

P1 완료 기준(현재 84㎡ 골든 타입에만 적용):

- 84㎡에서 이동과 시점 입력이 동작한다.
- 거실/주방/욕실 사이 실제 동선과 문/창/충돌이 확인된다.
- 최소 벽/바닥/천장 work-cell을 선택해 공정 0→5를 실제 화면에서 수행한다.
- 단계별 표면 외형과 금액 변화가 재현된다.
- automation log와 실제 실행 screenshot/video가 모두 남는다.

### P2 — 최신 네이티브 패키징 검수

1. UBT compile과 84㎡ smoke/traversal을 다시 통과시킨다. 4-type matrix는 실행하지 않는다.
2. `unreal/InPickLiving/Build/Scripts/build_macos.sh`로 새 버전의 macOS 내부 개발
   패키지를 만든다.
3. `verify_release_artifact.py`로 manifest, checksum, 엔진, artifact를 확인한다.
4. `.app` 직접 launch, 즉시 crash 여부, WASD/마우스, type 선택, 실내 진입,
   work-cell 공정 수행을 확인하고 화면을 캡처한다.
5. 위 네 단계를 통과한 산출물만 다운로드 후보로 표시한다.

2026-07-19 현재 1~4의 자동 검수는 `0.3.9-dev.20260719`에서 통과했다. `.app`
direct 4-type launch/smoke와 별도로 보이는 앱 창에 macOS HID 이벤트를 보내
WASD/마우스/E/F/H/B/U/Y/X/K/L/O/화살표/Q의 18개 실제 상태 변화를 검증했다.
사람이 직접 조작하며 감도·충돌·동선·멀미·가독성을 평가하는 대면 검수는 남아
있으므로 아직 외부 다운로드/배포 후보로 승격하지 않는다.

서명/notarization과 Windows/Steam 배포는 내부 품질 검수 뒤 별도 진행한다.
Win64는 Windows builder가 필요하다.

### P3 — InPick 서비스와 실제 연결

P1/P2 게이트 통과 후 다음 순서로 연결한다.

1. 사용자 로그인과 프로젝트 선택
2. 게임 세션/launch ticket
3. 자재 선택 및 work-cell 행동 이벤트
4. 공정 수량과 견적 snapshot
5. 웹 마이페이지 프로젝트로 결과 회수
6. 커뮤니티 공유와 Living remix

## 11. 기본 검증 명령

웹 변경 시:

```bash
npx tsc --noEmit --pretty false
npm run build
```

Living TypeScript/authority 변경 시:

```bash
npm run test:living
npm run test:living:approval
npm run test:living:release-qa
```

Unreal 변경 시:

```bash
python3 unreal/InPickLiving/Build/Scripts/stage_apartment_prototypes.py
python3 unreal/InPickLiving/Build/Scripts/validate_apartment_prototypes.py
./unreal/InPickLiving/Build/Scripts/run_interior_smoke_matrix.sh
```

최신 패키지 direct matrix:

```bash
cd unreal/InPickLiving
./Build/Scripts/run_packaged_interior_smoke_matrix.sh \
  Build/Artifacts/macOS/0.3.9-dev.20260719/InPickLiving.app

./Build/Scripts/run_packaged_native_input_audit.sh \
  Build/Artifacts/macOS/0.3.9-dev.20260719/InPickLiving.app

env INPICK_REQUIRE_PERF_BUDGET=1 \
  ./Build/Scripts/run_packaged_performance_smoke.sh \
  Build/Artifacts/macOS/0.3.9-dev.20260719/InPickLiving.app
```

패키징 전 상세 절차는 다음 문서를 함께 본다.

- `unreal/InPickLiving/README.md`
- `docs/inpick-living/UNREAL_NATIVE_CLIENT.md`

위 두 문서의 일부 오래된 상태 설명보다 이 핸드오프의 2026-07-18 검증 결과를
우선한다. 단, 명령과 구조 설명은 계속 참고한다.

## 12. 세션 종료 상태

- 주소·평형 평균 기반 비차단 흐름: 수동 평형, 워터마크 최소 정리, 도면 없는 이미지
  생성, 실별 평균치수 견적 연결까지 소스·타입검사·테스트·build 완료;
  이번 추가 변경은 아직 운영 배포하지 않음
- Step 2 공용 프롬프트/실별 이미지 수정/최종 1장 선택/선택본 전용 견적 전달:
  소스·타입검사·9개 관련 테스트·Chromium 데스크톱/모바일 E2E·production build 완료;
  로컬 실행/자동 사용자 화면 검수 완료, 운영 배포/실 외부엔진·과금 검수 미완료
- AI-Hub 학습셋: 구조/공간/객체 3종 1600px 변환 및 라벨 검증 완료;
  CUDA 학습/ONNX/추론 endpoint는 미완료
- Unreal 최신 소스: 59/74/84/114 topology 오류/경고 0; data-driven
  6단계, 원자적 B room batch, H site hold, 그룹 U/Y, K/L local draft,
  room progress/line-item estimate/truth HUD, cell별 material state, O 로컬
  settings/accessibility; UBT, construction automation 10/10, settings 3/3,
  performance 10/10, editor/package 4-type batch+hold smoke, 보이는 패키지 창
  macOS HID 입력/상태 검수 18/18 통과
- 제품 마스터 설계: source 문서 완료; Prototype/Verified 경험, M0~M6, QA/성능/
  텔레메트리/5천 도면 offline product-data pipeline 확정
- 결정론적 시공 상태: pure core·GameMode·actor·HUD·local file 통합 완료;
  server project revision/approved estimate 연결은 별도
- 최신 Unreal 패키지: `0.3.9-dev.20260719`, 486,144,585 bytes,
  manifest/checksum/ZIP CRC/signature/direct 4-type launch, macOS HID input 18/18,
  cooked 1080p Metal strict 성능 gate 통과; 사람 조작감/편안함 검수·복수 하드웨어
  성능·Developer ID 서명·Apple 공증은 미완료
- 자재 후보 조사: 완료, 실제 승인: 0/5로 미완료
- 원격 authority 동시성/쿼터/정리 QA: 완료
- 이 핸드오프 작성 당시 모든 백그라운드 작업은 종료되었다.
  터미널 종료 뒤에도 어떤 프로세스가 계속 돈다고 가정하지 말고 이 문서에서
  명시한 다음 단계로 새 세션을 시작한다.

## 13. 사용자 복귀 후 직접 처리할 결제·계정 항목

이번 자율 작업에서 유료 구매, 크레딧 소진, 약관/계약 동의는 하지 않았다.
아래는 필요 시 사용자가 직접 처리한다.

- Apple Developer Program/Developer ID Application 인증서, notary profile, 서명·공증
- Steamworks app/depot ID, 약관·세금·배포 계정 처리
- Windows builder 확보와 Authenticode 인증서
- 정확한 SKU/PBR 자산의 유료 구매 또는 제조사 사용권 승인
- Higgsfield 등 유료 이미지/3D 생성 크레딧; 현재 기능 게이트에서는 소진하지 않음
- 신원/거주/권한 검증 vendor와 개인정보·보관 계약
