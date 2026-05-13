# INPICK Step1 → Step2 → Step3 연결 감사

> 작성일: 2026-05-13
> 기반: `inpick-step1-floorplan-step3-estimate-connection-audit-fix-20260512.md`
> 적용 작업: P0~P6 (estimate evidence pipeline + 도면 호출 속도 개선)
> 목적: 데이터 체인 끊김/silent fallback/하드코딩 견적금액 추적 및 정정

---

## 0. 한 줄 요약

```
Step1 도면 (normalize-floorplan)
    ↓ basicInfo.floorplanPropertyId / normalizedImageUrl / cleanedImageUrl
Step2 이미지 생성 (render-room / render-photo-style / render-commercial-zone)
    ↓ rendersByRoom[] (sessionStorage)
    + design_outputs DB (P1) — material_hints + status
    ↓ status=analysis_pending → vision-materials/analyze 자동 백그라운드 (P3)
    ↓ status=analysis_done → material_hints 갱신
Step2→견적 진입
    → /api/inpick/estimate-context/finalize (P2)
    → contextId 발급
Step3 견적 페이지 (/workflow/estimate?contextId=...)
    → /api/inpick/build-estimate { contextId }
    → buildEstimateFromContext (P2)
    → ContextEstimateLine[] (source/confidence 포함)
    → UI에 source 배지 (P4)
```

---

## 1. 단계별 연결 표

| 단계 | 파일 | 함수/핸들러 | 입력 | 출력 | 다음 연결 | 상태 |
|---|---|---|---|---|---|---|
| Step1 주소 | `BasicInfoCard.tsx` | `loadBuildings` / `selectPyeong` | 주소+평형 | `selectedPyeong.grandPlanUrl` | `normalize-floorplan` | ✅ |
| Step1 도면 정형화 | `BasicInfoCard.tsx:369-433` | `selectPyeong → POST normalize-floorplan` | grandPlanUrl + 면적 | `floorplanPropertyId/normalizedImageUrl/rooms` | basicInfo | ✅ P6-1 가속 |
| 도면 정형화 API | `normalize-floorplan/route.ts` | 2단 병렬: Vision + cleaning | imageUrl | `rooms[]/openings[]/dimensionOverlaySvg/cleanedImageUrl` | client | ✅ P6-1 (`skipImageClean: true`) |
| Step1→Step2 전환 | `workflow/page.tsx:goNext` | normalizedFloorplan 채우고 setStep(2) | step1 | step2 활성 | Step2 | ✅ |
| Step1 "내공간꾸미기" 버튼 | `Step1Cards.tsx:399-420` | onNext | allOk 체크 | next | Step2 | ✅ P6-2 (normalizing 중 비활성) |
| Step2 모드 분기 | `Step2Designer.tsx:handleChatToImage` | workflowEntry + hasFloorplan | prompt | render-room / render-photo-style | render API | ✅ P6-3 (silent fallback 차단) |
| Step2 apartment render | `Step2Designer.tsx:handleGenerate/handleBulkGenerate` | tab+prompt+dim | render-room call | rendersByRoom | sessionStorage | ✅ |
| Step2 photo/zone render | `Step2Designer.tsx:handlePhotoStyleGenerate` | stylePrompt | render-photo-style call | rendersByRoom | sessionStorage | ✅ |
| render-room API | `render-room/route.ts` | propertyId 자동 normalized 로드 → image gen | RenderRoomBody | imageUrl + metadata | client | ✅ P6-4 metadata.floorplanUsed |
| design_outputs 저장 | `Step2Designer.tsx → client.ts` | saveDesignOutputAfterRender | image+prompt+target | DB row | API | ✅ P1 |
| design_outputs API | `api/inpick/design-outputs/route.ts` | POST→DB→백그라운드 analyze | DesignOutput | row + analysis_pending | analyze | ✅ P1+P3 |
| 자재 분석 자동 | `design-outputs/route.ts:startVisionAnalysisInBackground` | analyze 호출 + materialHints 병합 | image | status→done/failed | DB update | ✅ P3 |
| Step2→견적 진입 | `workflow/page.tsx:goBranch` | finalize 호출 + contextId | step1+projectId | contextId | router.push | ✅ P2 |
| estimate-context finalize | `estimate-context/finalize/route.ts` | snapshot 묶음 | projectId+mode | contextId + readiness | client | ✅ P2 |
| 견적 페이지 로드 | `estimate/page.tsx:useEffect` | contextId 우선, legacy 폴백 | URL contextId | runEstimate 호출 | runEstimate | ✅ P2 |
| 견적 합성 (context) | `build-estimate-from-context.ts` | design_outputs.material_hints → lines | ctx row | EstimateLine[] | UI | ✅ P2 |
| 견적 합성 (legacy) | `build-estimate/route.ts` | rooms[] + visionAnalysisByRoom (DB 자동 보강) | rooms + projectId | estimates | UI | ✅ P5 |
| 견적 라인 source UI | `estimate/page.tsx:EstimateSourceBadge` | source/confidence | row | 색상 배지 | 사용자 표시 | ✅ P4 |
| design 갤러리 | `estimate/page.tsx` 우측 카드 | design_outputs + sessionStorage 병합 | DB+ss | items[] | 갤러리 | ✅ P5 |

---

## 2. 잘못된 silent fallback / 하드코딩 추적

### 2-1. apartment 모드 silent fallback (수정 완료)

**위치**: `Step2Designer.tsx:handleChatToImage` (이전 코드)

```ts
// 이전 — 잘못된 silent fallback (apartment인데 도면 없으면 photo로 떨어짐)
const isPhotoMode =
  workflowEntry === "photo_residential" ||
  workflowEntry === "photo_commercial" ||
  !hasFloorplan; // ← 이게 silent fallback 원인
```

**수정** (P6-3):
```ts
if (explicitPhotoMode) {
  await handlePhotoStyleGenerate(...);
  return;
}
// apartment인데 도면 없으면 명확한 오류 표시 — render-photo-style로 조용히 떨어지지 않음
if (!hasFloorplan) {
  setErrorMsg("아파트 도면 기반 생성에는 평면도가 필요합니다...");
  return;
}
await handleBulkGenerate(...);
```

서버측 `render-room/route.ts:101-121`도 `missing_floorplan` 400 가드 기존부터 존재 — 토큰 차감 전 차단.

### 2-2. 견적 금액 "67,322,609원 고정" 추적

**grep 결과**:
- `rg "67322609|67,322,609|67322,609|67,322609"` → **하드코딩 0건**
- `rg "mockEstimate|sampleEstimate|fallbackEstimate"` → **하드코딩 0건**

**원인 진단**:
1. 사용자가 같은 step1 (130/97.36㎡ 같은 평형) + 같은 expansionType (확장형) + Step2에서 이미지 생성 없음/실패로 진입
2. `build-estimate`가 모든 방에 대해 `defaultSurfacesForRoom(roomName)` 표준자재 적용
3. 표준자재 단가 + 같은 면적 = 매번 같은 결과 (계산 정확성 측면에서는 정상)
4. 사용자는 이걸 "Vision으로 추출했다"는 산정 근거 문구 때문에 사기 견적으로 인식 — **P5에서 산정 근거를 실제 라인 source 통계로 동적 표시**하여 해결

**견적 값 가변화 조건** (이걸 사용자가 한 가지라도 충족해야 금액 변동):
- Step2에서 이미지 생성 → `design_outputs.material_hints`에 prompt 추출 자재 들어감 → 견적 라인의 자재명/단가 변동
- 자재 분석 자동 완료 → `material_hints`에 vision 자재 들어감 → 견적 라인 변동
- 사용자가 부위별 자재 선택 → `render_material_edits` → 견적 라인 변동
- expansionType 변경 → 면적 변경 → 견적 변경

### 2-3. 분석된 디자인 갤러리에 이미지 1장만 표시 (수정 완료)

**위치**: `estimate/page.tsx:1330-1358` (이전)
- `step2.rendersByRoom`만 보고 `selectedByRoom` 인덱스로 1장씩만 표시
- DB design_outputs 조회 안 함

**수정** (P5):
- `designOutputsForGallery` (DB) + `step2.rendersByRoom` 모든 render 항목 병합
- URL 기준 중복 제거 + 분석 상태(분석중/완료/실패) 배지 표시
- DB 미수신 시 "로컬만" 노란 배지로 진단 가능

---

## 3. 견적 페이지가 사용하는 데이터 출처

### 3-1. contextId 있을 때 (정상 경로)

```
URL → searchParams.get('contextId')
    → POST /api/inpick/build-estimate { contextId }
    → buildEstimateFromContext(ctx) (DB조회)
    → ContextEstimateLine[] (각 line에 source/confidence)
    → UI 변환 + 배지 표시
```

### 3-2. contextId 없을 때 (legacy 폴백)

```
sessionStorage workflow_step1/workflow_step2 읽음
→ requestRooms[] 구성 (rendersByRoom의 키 + Step1 rooms 합집합)
→ POST /api/inpick/build-estimate { rooms, projectId }
→ P5: API가 자동으로 design_outputs.material_hints 조회 → visionAnalysisByRoom 자동 보강
→ 3단 우선순위: vision → legacy vision (OpenAI) → defaultSurfacesForRoom (표준)
→ UI에 matchMetaByRoom → source 추정 매핑 (P4)
```

---

## 4. 산출 경로 사용자 진단 표시 (P5)

견적 페이지 우측 "산정 근거" 박스에 현재 경로 표시:
- 🟢 **Evidence 기반 (L1/L2/L3)** — contextId 경로 작동, design_outputs 활용
- 🟡 **Legacy Vision** — contextId 실패했지만 OpenAI vision 작동
- 🔴 **표준자재 폴백** — 모든 evidence 미반영 → 인증/마이그레이션 의심

라인 source 분포(이미지 분석 N건/표준 M건/...) + 신뢰도 등급 표시.

---

## 5. 적용된 작업 매트릭스 (P0~P6)

| Phase | 산출물 | 작업 |
|---|---|---|
| **P0** | build-estimate blocking 차단 제거 + warnings | `rooms`/`area`/`zones` 누락 시 폴백 |
| **P1** | design_outputs 테이블 + API + Step2Designer 통합 | 3개 render 경로 자동 저장 + prompt hint 추출 |
| **P2** | estimate_contexts 테이블 + finalize + build-estimate contextId | snapshot 합성 + readiness |
| **P3** | 자재 분석 자동 백그라운드화 | design_outputs POST 후 vision-materials/analyze fire-and-forget |
| **P4** | 견적 라인 source/confidence 배지 + 범례 | 6종 색상 구분 |
| **P5** | 산정 근거 동적 표시 + 갤러리 보강 + legacy 경로 design_outputs 자동 활용 | 사기 표시 방지 |
| **P6-1** | Step1 도면 호출 속도 (40s→8-15s) | `skipImageClean: true` + 백그라운드 클리닝 |
| **P6-2** | "내공간꾸미기" 버튼 normalizing 중 비활성 | Step2 진입 차단 |
| **P6-3** | apartment 도면 없을 때 silent fallback 차단 | 명확한 오류 메시지 |
| **P6-4** | render-room 응답 `metadata.floorplanUsed` | "도면 기반 생성됨" 배지 |
| **PDF** | 견적서 PDF 다운로드 anonymous 허용 + 라벨 변경 | preview 모드 인증 없이 PDF 가능 |

---

## 6. 수동 검증 절차

### 6-1. Step1 도면 호출 시간 검증
1. `/workflow` 진입 → 주소 검색 → 평형 선택
2. 도면 정리 진행률 표시 시간 측정
3. **기대**: 8-15초 내 normalizing=false → "내 공간 꾸미기" 활성화
4. 이전: 40초+ 소요 (cleaning 포함)

### 6-2. apartment 모드 도면 없을 때 차단
1. 도면 없는 상태로 Step2 진입 (예: 평형 선택 안 함)
2. Step2에서 채팅 → "이미지 생성" 클릭
3. **기대**: "아파트 도면 기반 생성에는 평면도가 필요합니다..." 오류 메시지
4. 이전: photo_style로 silent fallback (도면 무시)

### 6-3. 견적 라인 source 표시
1. Step2에서 거실 이미지 생성 → 견적 진입
2. 견적 페이지 라인별 색상 배지 확인
3. 산정 근거 박스에 "이미지 분석 N건 / 표준 M건" 표시
4. 진단 경로 (🟢/🟡/🔴) 확인

### 6-4. PDF 다운로드
1. 견적 페이지에서 "견적서 PDF 다운로드" 클릭
2. **기대**: INPICK_견적서_*.pdf 다운로드
3. 이전: alert("견적서 발행 실패: PROJECT_NOT_FOUND_OR_NO_CONSUMER")

---

## 7. 남은 작업 (P7+ 후속)

- [ ] floorplan_assets 테이블 도입 (현재는 propertyId + storage만 사용)
- [ ] analytics_events 연결 (floorplan.asset.ready / render.apartment.completed / estimate.built 등)
- [ ] 사용자 부위별 자재 선택 → L3_USER_CONFIRMED 견적 연결
- [ ] PDF 견적서에 source/confidence 범례 반영
- [ ] commercial scope_spec_id → estimate_contexts.commercial_scope_snapshot_id 연결 보강
- [ ] 정형화 결과를 propertyId 기반 캐시에서 즉시 활용하는 워밍업 (재방문 시 0초)
