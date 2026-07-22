# InPick 메인 서비스 수정 및 경쟁사 기반 업그레이드 계획

기준일: 2026-07-22  
대상: 웹 · iOS App Store · Android Google Play · 앱인토스 공통 Step 1→2→3  
제외: InPick Living/Unreal 전부

## 1. 이번 수정의 제품 기준

InPick의 경쟁력은 예쁜 AI 이미지 자체가 아니라 사용자의 디자인 의도를 실별 최종안, 실제 공종·수량, 비교 가능한 견적으로 잃지 않고 전달하는 데 있다. 따라서 이번 수정의 단일 기준선은 다음과 같다.

`사용자 원본·요구사항 → 실별 디자인 → 확정 이미지 → 부품/SKU → 공종·수량·가격 근거`

어느 단계가 실패해도 실과 사용자 요구사항을 삭제하지 않는다. AI 분석 실패는 견적 항목 삭제 사유가 아니라, 추정치와 현장확인 표시를 붙인 fallback 사유다.

## 2. 사용자 제보 5건의 수정 설계

### P0-1 신규 프로젝트 상태 격리

문제: 새 프로젝트 진입 후 계정의 최근 기존 프로젝트가 다시 채택되어 Step 2 이미지와 선택 상태가 혼입됨.

수정:
- `?new=1`은 항상 새 project ID를 발급한다.
- fresh 요청에서는 최근 프로젝트 자동 복원을 금지한다.
- 프로젝트별 snapshot만 읽고 글로벌 호환 키는 신규 세션에서 삭제한다.
- 회귀 테스트로 기존 이미지·선택·최종안이 0인 상태를 보장한다.

완료 기준:
- 프로젝트 A 생성 후 `새 프로젝트`로 B 시작 시 A의 URL, prompt, selection, unlock 상태가 B의 DOM/session/API 요청에 없음.

### P0-2 사진 원본·주거유형·요구사항 보존

문제: 오피스텔 사진이 text-to-image 과정에서 아파트로 재해석되고, 첨부 사진은 채팅 분석에만 쓰임.

수정:
- `photoSpaceType`을 provider prompt와 design output/context에 보존한다.
- 업로드 사진을 실 순서에 매핑한다.
- 사진이 있는 실은 신규 text-to-image가 아니라 구조 보존 image-edit 경로를 사용한다.
- 창·문·시점·주거유형·면적감을 변경 금지 조건으로 둔다.
- 실별 사진이 없는 경우에는 “실제 사진 기반”이 아니라 “사용자 요구·면적 기반 추론”으로 표시한다.

완료 기준:
- 오피스텔 요청이 apartment prompt로 승격되지 않음.
- source image가 실제 provider edit payload에 포함됨.
- photo source와 residential type이 최종 context provenance에 남음.

### P0-3 분석 실패에도 누락 없는 Step 3

문제: `design_outputs` 저장 또는 Vision 분석 실패 시 주방이 `전체 공간/unknown`으로 축약되고 상세 공종이 사라짐.

수정:
- Step 1의 실 목록과 `roomFurnishings`를 estimate context 정본에 저장한다.
- design output 0건, 일부 실패, pending 상태에서도 모든 요청 실을 surface plan에 생성한다.
- 분석 성공 evidence는 유지하고 실패 실만 표준 fallback을 사용한다.
- `final_images_only`는 이미지 필터일 뿐 material evidence/user edit 삭제 스위치로 사용하지 않는다.
- fallback 라인에는 `추정`, 근거, confidence, 현장확인 필요를 표시한다.

주방 최소 필수 항목:
- 하부장
- 상부장
- 상판
- 백스플래시 타일
- 싱크볼
- 수전
- 냉장고장
- 김치냉장고장
- 선택 시 후드·쿡탑 및 추가 전기·설비

### P0-4 전체 실 선생성·서버 잠금

문제: 현재는 거실만 생성하고 다른 실은 하나씩 생성한다. 기존 잠금은 원본 URL을 이미 브라우저에 내려준 뒤 CSS blur만 적용한다.

수정:
- 생성 batch와 방별 job을 서버에 영속화한다.
- 모든 대상 실을 먼저 생성한다.
- 거실은 추가 unlock 없이 공개한다.
- 비거실 원본은 private storage에 두고 클라이언트에는 locked asset ID와 안전한 placeholder만 제공한다.
- 잠금 해제 RPC가 소유권 확인, 잔액 잠금, 1토큰 차감, 원장 기록, grant 생성을 한 DB 트랜잭션으로 수행한다.
- 성공 후에만 5~10분 signed URL을 발급한다.
- 같은 idempotency key와 동시 요청은 정확히 한 번만 과금한다.
- session/workflow snapshot에는 private path나 signed URL을 저장하지 않는다.

완료 기준:
- 잠금 상태 DOM·Network·sessionStorage에 원본 URL 없음.
- 새로고침/다른 기기에서도 grant 복원.
- 실패·잔액 부족 시 차감과 grant 모두 없음.

### P1-5 주방 assembly·부품별 실제 SKU

문제: 현재 선택 key는 `room::surface`라서 주방 부품을 독립 표현할 수 없음.

수정:
- key를 `room::assembly::partCode`로 확장한다.
- 독립 part code: 상부장, 하부장, 상판, 백스플래시, 싱크볼, 수전, 냉장고장, 김치냉장고장, 후드, 쿡탑.
- 서버가 part별 허용 category를 검증하고 실제 `material_products.id`만 저장한다.
- 모델번호/SKU가 없는 상품을 exact SKU로 표시하지 않는다.
- 선택값의 brand, SKU/model, spec, 단가, 가격출처, 확인시점을 snapshot으로 남긴다.
- 동일 선택값을 이미지 prompt와 해당 견적 subtrade line에 적용한다.

UX:
- 기본 흐름은 자연어 수정으로 유지한다.
- 주방 이미지의 `부품별 제품 선택`을 눌렀을 때만 선택형 고급 패널을 연다.
- 중앙의 주방 조립도에서 부품이 원래 위치에서 벌어지는 explode transition을 제공한다.
- 실제 제품 3D 형상으로 오인하지 않도록 `부품 선택용 조립도`라고 표시한다.
- 모바일에는 동일 기능의 접근 가능한 부품 리스트/하단 drawer를 제공한다.

## 3. 경쟁사에서 추가할 기능

### 즉시 추가

1. Houzz selections 원리
- 디자인에서 선택한 제품을 견적 line item과 동일 ID로 연결.
- `final_images_only`에서도 SKU evidence 보존.

2. IKEA Kreativ 원리
- 제품 선택 결과를 시각적으로 확인하되 정확한 상품이 없는 경우 `유사 소재`로 명시.
- 검증 SKU만 구매/견적 연결.

3. Sweeten·JobTread 원리
- Step 3를 총액 카드가 아니라 동일 line item 기준으로 고정.
- 향후 업체별 포함/제외·수량·단가 차이를 자동 비교.

4. Block Renovation 원리
- 사용자의 원본, 디자인 결정, 견적, 변경을 프로젝트 기준선으로 묶음.
- 분석 실패를 숨기지 않고 추정/현장확인 상태를 명시.

5. Qanvast·BuildZoom 원리
- 예쁜 이미지뿐 아니라 평형, 공사 범위, 견적 근거, 실제 변경률을 사례에 표시.

### 이번 수정 뒤 다음 순서

1. Decision Packet 불변 snapshot
- 실별 최종 1장, source/provenance, 선택 SKU, 공종·수량, 추정/확정 상태, revision hash.

2. 3-bid normalization
- 최대 3개 검증 업체가 같은 line item에 응답.
- 총액보다 누락·등급·단위·부가세·일정 차이를 먼저 표시.

3. Contract baseline/change order
- 낙찰 당시 snapshot은 변경 불가.
- 변경은 change order로만 추가하고 이전/이후 금액과 승인 이력을 보존.

4. Verified material graph
- SKU, 대체품, 단위, 가격시점, 재고·지역배송 근거.
- 검증 전 상품명·제조사·가격을 임의 생성하지 않음.

## 4. 경쟁사 기능 중 지금 추가하지 않을 것

- 오늘의집/Houzz 규모의 영감 피드: UGC 규모 경쟁은 저ROI.
- Planner 5D형 범용 3D 편집기: 외부 엔진을 교체 가능하게 사용하고 거래 데이터에 집중.
- 전국 직영 시공: 자본·A/S·품질 운영 위험이 큼.
- 무제한 리드 판매: 업체 불신과 저품질 입찰을 유발.
- 검증되지 않은 제조사/SKU 추천: 상업적 신뢰 훼손.
- InPick Living 게임: 전부 보류.

## 5. 출시 게이트

### 기능
- 신규 프로젝트 교차오염 0.
- 모든 요청 실이 생성 batch 또는 명시적 실패 상태를 가짐.
- 잠긴 원본 URL 클라이언트 노출 0.
- 동시 unlock 10회에도 1회 과금.
- 분석 실패 실의 필수 공종 누락 0.
- 주방 부품 선택이 이미지와 정확히 한 견적 라인에 반영.

### 진실성
- 면적·수량: 도면/사용자 입력/사진 추론/표준 fallback 출처 구분.
- SKU: 검증된 DB ID와 가격시점 필수.
- generated/estimated/site verification required 라벨 유지.

### 배포면
- 웹 production build.
- Capacitor iOS/Android sync 및 native shell smoke.
- 앱인토스 빌드·라우팅·결제/토큰 callback smoke.
- 모바일 좁은 화면에서 Step 2 tab, 잠금, SKU drawer, Step 3 표 회귀 확인.

## 6. 측정 계획

출시 후 첫 측정은 이미지 수가 아니라 다음 전환과 신뢰 지표로 한다.

- 신규 프로젝트 상태 혼입 신고율.
- 첫 전체실 생성 완료율과 소요시간.
- 거실 공개 → 비거실 unlock 전환율.
- 실별 최종 1장 확정률.
- Step 2 → Step 3 전환율.
- 분석 실패율과 fallback 사용률.
- 필수 공종 누락 신고율.
- SKU 선택 → 견적 포함률.
- 견적 수정률 및 수정 사유.

## 7. 상용화 판단

이번 기능은 AI 이미지 업셀이 아니라 Decision Packet 품질을 높이는 기반이다. 토큰은 생성원가 회수 수단으로 보고, 핵심 수익은 이후 업체 Pro 워크플로·구조화된 입찰·낙찰/계약 데이터에서 검증한다. 잠금과 SKU가 거래 진실성을 떨어뜨리면 출시하지 않는다.
