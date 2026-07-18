# InPick 작업 재개 핸드오프

마지막 갱신: 2026-07-19 02:38 (KST)  
저장소: `/Users/seonbonkim/Desktop/AIOD/개발/InPick/inpick-app`  
브랜치: `main`  
기준 커밋: `34a31e9 feat: streamline room design and estimate flow`

이 문서는 터미널, Codex, Claude Code를 완전히 종료한 뒤에도 현재 상태에서 바로
작업을 재개하기 위한 단일 기준 문서다. 날짜가 붙은 예전 핸드오프보다 이 파일을
먼저 사용한다.

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
> 수정사항을 보존한 채 `다음 작업 우선순위`의 P1부터 이어서 진행해. 결제,
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
- 우선 평형은 **59 / 74 / 84 / 114㎡** 네 종류만 사용한다.

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
  - 36 actions
  - 22.80초
  - UBT 로그: `/Users/seonbonkim/Library/Application Support/Epic/UnrealBuildTool/Log.txt`
- 4개 평형 interior smoke matrix: 성공

| 평형 | work cells | 최종 stage | 테스트 견적 합계 | 입력 상태 |
| --- | ---: | ---: | ---: | --- |
| 59㎡ | 4 | 5 | ₩83,900 | 이동/시점 정상 |
| 74㎡ | 9 | 5 | ₩151,322 | 이동/시점 정상 |
| 84㎡ | 4 | 5 | ₩135,800 | 이동/시점 정상 |
| 114㎡ | 12 | 5 | ₩116,400 | 이동/시점 정상 |

모두 `move_ignored=0`, `look_ignored=0`, walking=1, stage=5를 기록했다.

```bash
./unreal/InPickLiving/Build/Scripts/run_interior_smoke_matrix.sh
```

로그:

- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-59.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-74.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-84.log`
- `unreal/InPickLiving/Saved/InPickLiving/Automation/interior-smoke-114.log`

현재 최신 소스의 정확한 상태는 **compiled + automated smoke verified**다.
최신 work-cell/PBR 변경분을 다시 package하고 사람이 실제 화면에서 검수한 상태는
아니다.

### 존재하는 이전 macOS 개발 패키지

가장 최근에 존재하는 이전 산출물:

`unreal/InPickLiving/Build/Artifacts/macOS/0.3.3-dev.20260718/`

- ZIP: `InPickLiving-macOS-0.3.3-dev.20260718.zip`
- architecture: arm64
- configuration: Development
- size: 466,666,301 bytes
- SHA-256: `6e715072bfbbd908a71244f6585776f2428cd6d76e252819155c8fce3c86b858`
- signed: false
- notarized: false
- releaseReady: false

이 산출물의 존재를 최신 소스 패키징 완료로 오해하지 않는다. 다음 단계에서 최신
소스를 새 버전으로 다시 package하고, 실행/조작/화면까지 별도로 검수해야 한다.

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

### P0 — 재개 안전 확인

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
   - 남음: 실제 렌더 화면에서 normal 방향/스케일과 단계별 외형을 사람 눈으로 검수.
2. 59/74/84/114의 건축 shell을 개선한다: 실 인접 관계, 문, 창, 벽 두께, 높이,
   치수, 충돌, 동선을 우선한다. 가구는 넣지 않는다.
3. 엘리베이터 → 복도 → 현관 문 열기 → 실내 진입 흐름과 170cm 1인칭 이동을
   실제 키보드/마우스로 확인한다.
4. mesh/work-cell 선택과 철거 → substrate → 평탄화 → primer → finish의 시각 및
   상태 전이를 구현하고 undo와 금액 변화를 연결한다.
5. 권리 문제가 없는 고품질 강남/한강 창밖 환경, 실내 조명, 재질 스케일을
   개선한다.
6. 공식 SKU 5개 파일럿의 identity/PBR/권리 근거를 확보한다. 승인 전에는 임시
   재질로 명시하고 견적 truth에 넣지 않는다.

P1 완료 기준:

- 네 평형에서 이동과 시점 입력이 동작한다.
- 거실/주방/욕실 사이 실제 동선과 문/창/충돌이 확인된다.
- 최소 벽/바닥/천장 work-cell을 선택해 공정 0→5를 실제 화면에서 수행한다.
- 단계별 표면 외형과 금액 변화가 재현된다.
- automation log와 실제 실행 screenshot/video가 모두 남는다.

### P2 — 최신 네이티브 패키징 검수

1. UBT compile과 4-type smoke matrix를 다시 통과시킨다.
2. `unreal/InPickLiving/Build/Scripts/build_macos.sh`로 새 버전의 macOS 내부 개발
   패키지를 만든다.
3. `verify_release_artifact.py`로 manifest, checksum, 엔진, artifact를 확인한다.
4. `.app` 직접 launch, 즉시 crash 여부, WASD/마우스, type 선택, 실내 진입,
   work-cell 공정 수행을 확인하고 화면을 캡처한다.
5. 위 네 단계를 통과한 산출물만 다운로드 후보로 표시한다.

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
./unreal/InPickLiving/Build/Scripts/run_interior_smoke_matrix.sh
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
- Unreal 최신 소스: 실제 surface master 자산 생성, compile 및 4개 평형 smoke 검수 완료
- 최신 Unreal 소스 재패키징/실행 화면 검수: 미완료, P2에서 수행
- 자재 후보 조사: 완료, 실제 승인: 0/5로 미완료
- 원격 authority 동시성/쿼터/정리 QA: 완료
- 이 핸드오프 작성 당시 위 감사 작업을 맡았던 3개 백그라운드 작업은 종료되었다.
  터미널 종료 뒤에도 어떤 프로세스가 계속 돈다고 가정하지 말고 이 문서에서
  명시한 다음 단계로 새 세션을 시작한다.
