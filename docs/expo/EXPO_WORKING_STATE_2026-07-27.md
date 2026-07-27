# INPICK EXPO — 작업 현황 전체 문서 (2026-07-27)

> 목적: 이 문서 하나로 어떤 에이전트/개발자든 EXPO의 현재 구조·동작·알려진 문제를
> 스스로 파악하고("자체적으로 물어보고") 정확히 문제를 해결할 수 있게 한다.
> 설계 원문: `inpick beta ver1/inpick_expo_booth/docs/` (마스터 지시문·블루프린트).
> 이 문서는 "현재 구현 사실"만 기록한다 — 계획이 아니라 상태.

## 1. 아키텍처 결정 (대표 확정)

- 웹 = 본체 `inpick-app` 저장소의 `/expo` 섹션. DB = 본체 Supabase(`pyhsjjtxcfmkcqmaxozd`)의 `expo_projects` 단일 테이블.
- 앱 = 독립 iOS(Capacitor, `kr.inpick.expo`, `inpick beta ver1/inpick_expo_booth/app/`) — 운영 웹(`interiorpick.co.kr/expo`)을 로드하므로 웹 배포 = 앱 반영.
- 경계: expo 코드는 `src/app/expo/`, `src/app/api/expo/`, `src/lib/expo/`, `src/components/expo/`, `expo_*` 테이블. 본체 공유 코드 수정은 대표 지시 기반 예외만(현재 2건: `credit-policy.ts`의 `expo-concept` 항목, 랜딩/헤더 내비 링크).

## 2. 확정 사용자 플로우 (대표 확정, 2026-07-27)

스텝 내비: **1.컨셉 → 2.3D 배치 → 3.기업정보 → 4.인쇄물 → 5.확정·견적** (`FlowStep` in `src/app/expo/page.tsx`)

1. **컨셉**: 면적(+단위) 입력 → AI 컨셉 렌더 카드에서 프롬프트 입력 → 컨셉 생성(GPT Image 2, 갤러리 최대 8장) → "이 컨셉으로 3D 배치하기".
   - 생성은 컨셉 카드에서만. 빈 프롬프트/면적 미입력 시 생성 차단(2026-07-27 수정).
   - 3D 전 단계이므로 dims는 면적에서 `createProvisionalFootprint`로 임시 계산.
2. **3D 배치**: 부스는 **무벽(island, 4면 오픈)** 으로 새로 생성(이전 잔재 승계 금지 — 2026-07-27 수정). 컨셉 이미지가 있으면 `autoApplyConcept`로 **이미지 속 사물·매스 재구성** 자동 실행. 사용자 편집: 카탈로그 7종 추가/이동(0.5m 스냅)/90° 회전/**가로·세로 크기 입력**/삭제/undo·redo(⌘Z)/카메라 프리셋 4종+360°. 치수 확정(치수·부스타입·높이) 가능.
3. **기업정보**: 행사 규정(장소·부스번호·허용높이·전기kW·출처 — 전부 사용자 입력, 위반=blocked), 공식 서비스 자가 체크, 브랜드 URL 가져오기(후보→사용 권한 확인 후 확정→벽 요소 컬러+로고 데칼), 시공사/고객사/행사명.
4. **인쇄물**: 씬의 graphic_wall/lightbox_panel/signage_tower에서 항목 파생(`derivePrintItems` — id로 사용자 데이터 유지, 씬에서 삭제되면 항목도 제거). 항목별: 컨셉 메모, **이미지 첨부**(참조), **시안 생성/재생성**(평면 2D, kind별 가로/세로 비율, 첨부 있으면 edits로 실자산 반영·없으면 로고 발명 금지), 확정 체크(n/m).
   - 생성된 시안은 해당 컴포넌트의 3D 텍스처로 입혀짐(`wallTextures` map).
5. **확정·견적**: 3D 뷰 + 견적(라인아이템·검토단가·CSV) + 준비도 레일 + 제안 발행 + 공유 링크 + 고객 결정 표시 + 계약 준비 기록.

기타 진입 경로: Builder Kit(면적 프리셋, 컨셉 단계 내), Clone & Reflow(복제+새 면적 리플로우→final), 이어하기(전체 상태 복원, 같은 프로젝트로 저장→final), draft 복구(→final).

## 3. 파일 맵

### 순수 도메인 (`src/lib/expo/`) — 전부 순수 함수, `npm run test:expo` (node --test, 72개)
| 파일 | 책임 |
|---|---|
| `footprint.ts` | 면적→임시 footprint(기본 island·무벽), 치수 확정. 4–1,000㎡ |
| `scene.ts` | BoothScene v1: 카탈로그 7종, 추가/이동/회전/**크기 override(resizeExpoComponent 0.1–20m)**/삭제/리사이즈, 0.5m 스냅+경계 클램프(wallMounted는 벽면 밀착+벽접촉 경고 제외), 겹침/벽접촉 경고(자동수정 금지), `expoDecalPlacement`, `promptMentionsWall`/`addWallFromPrompt`, `applyConceptSuggestions`(구형·수량 top-up), **`applyConceptLayout`(비전 좌표·크기·회전 정밀 배치, ai_ 접두 배치만 교체·사용자 배치 보존)** |
| `scene-history.ts` | undo/redo (past/present/future, 50캡, 분기 절단) |
| `estimate.ts` | 가격 단계(conceptual_range→catalog_estimate→contractor_proposal→contract)·금액 소스 5상태(planned/allowance/quoted/committed/actual) 분리, v1 allowance 코스트북, 전기 kW 연동, **검토 단가 override(quoted)**, CSV 내보내기 |
| `readiness.ts` | 준비도 7항목×6상태 — 자동 confirmed 승격 금지, % 단독 표시 금지 |
| `event-rules.ts` | 행사 규정(사용자 입력만 기준·출처 명시), 공식 서비스 체크 |
| `brand-import.ts` | 브랜드 후보 추출(자동 확정 금지)·킷 가드 |
| `concept-prompt.ts` | 컨셉 이미지 프롬프트(치수·타입·씬 수량 반영, 실로고·텍스트 생성 금지) |
| `proposal.ts` | 발행 게이트(치수확정+전 직접비 quoted), 스냅샷, stale 감지 |
| `client-decision.ts` | 고객 결정(승인/변경요청 — "시공 확정 아님" 라벨) |
| `print-items.ts` | 인쇄물 파생·확정, kind별 비율 |
| `server/safe-fetch.ts` | 서버 전용 — 리다이렉트 홉마다 SSRF 가드, 바운드 읽기 |

### API (`src/app/api/expo/`)
| 라우트 | 역할 · 가드 |
|---|---|
| `projects` | draft 업서트/목록(RLS 소유자). **새 컬럼은 유효값 있을 때만 행에 포함**(컬럼 미적용 환경 보호 패턴) |
| `concept` | GPT Image 2 컨셉 1장. `enforceConsume("expo-concept")` — **테스트 기간 0토큰**(정식 오픈 시 1 복원, `credit-policy.ts`), 실패 자동 환불, 1536x1024→1024 폴백, storage 업로드(실패 시 dataURL) |
| `apply-concept` | **비전 v2: 이미지 속 사물별 평면 좌표(x/z 비율)·크기(m)·방향 추출**(부스 실치수 컨텍스트, medium reasoning, 12개 캡) + sharp 팔레트. 로그인 필수 |
| `brand-import` / `brand-logo-store` | 후보 추출 / 로고 재호스팅(512px PNG). 로그인+SSRF 가드 |
| `print-upload` / `print-artwork` | 참조 첨부(8MB) / 평면 2D 시안 생성(첨부 시 edits). 로그인, 테스트 무료 |
| `share` / `proposal-decision` / `publish` | 공유 토큰 발급 / 고객 결정(토큰=capability, 소유자 인앱 알림) / **발행(서버 재계산 — 클라이언트 금액 불신, 게이트 409)** |

### UI
- `src/app/expo/page.tsx` — 단일 페이지(스텝 게이트). draft v3(`expo_brief_draft_v3`) + 1.2s 디바운스 서버 저장.
- `src/components/expo/BoothShell3D.tsx` — R3F 캔버스(WebGL 프로브+포스터 폴백), 카메라 프리셋+360°, 브랜드 컬러/로고 데칼, **컴포넌트별 wallTextures**, 선택/이동.
- `SharedBoothView`(공유 페이지 읽기전용 3D), `ProposalDecisionForm`, `PrintProposalButton`.
- `src/app/expo/p/[token]/page.tsx` — 공개 제안 공유본(service role 조회, noindex, 라벨 유지, 인쇄 CSS).

## 4. DB (`expo_projects` — 전부 운영 적용됨)

id, user_id, title, area_input, area_unit, footprint, confirmed_dimensions, quick_fields, status, created_at, updated_at, scene, concept_image_url, concept_generated_at, brand, event, share_token, shared_at, client_decision, official_services, estimate_overrides, proposal, concept_images, contract_prep, print_items

- 마이그레이션: `supabase/migrations/20260726100000~20260727170000` (expo 접두 파일들).
- 적용 방법: Supabase Management API `POST /v1/projects/pyhsjjtxcfmkcqmaxozd/database/query` (토큰: `security find-generic-password -s "Supabase CLI" -w`). **주의: 이 엔드포인트는 수 시간 큐 지연이 발생할 수 있음 — `--max-time 590` 백그라운드로 대기하거나 5분 간격 재시도. 클라이언트 50초 타임아웃으로 끊으면 안 됨.**

## 5. 불변조건 (블루프린트 — 위반 금지)

1. 면적≠치수: 확정 전 결과는 전부 "가정" 라벨. 2. AI 이미지는 컨셉 전용 — geometry truth는 씬. 3. 브랜드는 결정적 데칼(AI 로고 생성 금지). 4. 금액: 가격 단계와 소스 5상태 분리, allowance 상시 노출, 발행=인간 행위+서버 검증, stale 발행본 무효화 명시. 5. 렌더/제안 승인 ≠ 제작/시공 확정. 6. 가짜 360 금지(실 3D 회전만). 7. 경고는 사람이 판단(자동 수정 금지). 8. 후보(브랜드·비전 제안)는 자동 확정 금지.

## 6. 알려진 문제 / 한계 (정직 기록)

- **[해결 2026-07-27]** 컨셉 단계 중복 버튼("다음—컨셉프롬프트")이 빈 프롬프트로도 이미지를 생성 → 버튼 제거, 컨셉 카드로 일원화, 빈 프롬프트/면적 미입력 시 생성 차단.
- **[해결 2026-07-27]** "이 컨셉으로 3D 배치하기"가 이전 작업 잔재를 승계(resize 재사용) → 항상 새 씬 생성으로 변경.
- 비전 매스 재구성은 원근 사진→평면 좌표 근사(±0.5m 스냅 수준). 카탈로그 7종 외 사물은 무시. 품질 피드백에 따라 `apply-concept`의 `buildVisionPrompt` 조정.
- 공유 페이지(`/expo/p/[token]`)는 인쇄물 시안 텍스처·컨셉 갤러리를 아직 표시하지 않음(대표 이미지·씬·견적만).
- 복구 안내 문구가 "서버 저장은 준비 중"이라는 옛 카피(실제로는 로그인 시 서버 저장 동작).
- 시뮬레이터 원격 탭 조작 불가(simctl 한계) — 화면 확인은 스크린샷, 상호작용 검증은 운영 headless(playwright).
- 로그인 필요 검증(대표 계정): 컨셉 생성→매스 재구성 품질, 인쇄물 첨부→시안 생성, 발행 E2E, 알림 수신.

## 7. 검증 방법

- 유닛: `npm run test:expo` (72개). 타입: `npx tsc --noEmit`. 빌드: `NODE_OPTIONS=--max-old-space-size=8192 npm run build` (기본 힙 SIGABRT).
- E2E(비로그인 범위): playwright-core + 번들 chromium + SwiftShader 플래그. 스크립트 예시는 세션 스크래치패드 참고(`*-verify.mjs` 패턴 — `createRequire`로 본체 node_modules 로드).
- 배포 감지: `interiorpick.co.kr/expo`의 `/_next/static/chunks` 해시 변화 폴링.
- 시뮬레이터: `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl launch booted kr.inpick.expo`.

## 8. 과금 상태

- 컨셉/인쇄물 생성: **테스트 기간 무료**(로그인 필수). 정식 오픈 시 `src/lib/inpick/credit-policy.ts`의 `"expo-concept": 0`을 `1`로 복원 + 인쇄물 과금 항목 신설 검토.
- OpenAI 원가: 이미지 생성 ~$0.04/장(medium), 비전 분석 소량.

## 9. 이 문서의 갱신 규칙

구조·플로우·불변조건·알려진 문제가 바뀌면 이 문서를 같은 커밋에서 갱신한다.
문제 해결 시 "왜 그런 구조인지"를 여기서 먼저 확인할 것 — 특히 §5 불변조건과
§4의 컬럼-안전 저장 패턴, §6의 Management API 큐 지연은 우회하면 안 되는 이유가 있다.
