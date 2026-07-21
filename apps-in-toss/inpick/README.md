# INPICK Apps in Toss

앱스토어/플레이스토어 출시본의 인픽 클라이언트 코드를 `inpick-source/`에 고정 복제해
Apps in Toss의 CSR WebView 런타임에서 실행한다. 토스 빌드는 운영 `src/`를 직접 import하지 않는다.

## 공유 범위

- `src/app/workflow/page.tsx`: 주소·평형·도면 처리 및 Step 1
- `src/components/workflow/Step2Designer.tsx`: AI 생성, 대화형 실별 수정, 최종 이미지 선택
- `src/app/workflow/estimate/page.tsx`: 최종 이미지 기반 견적, 저장, 문서
- 운영 `https://www.interiorpick.co.kr/api/**`: 동일 AI·DB·견적 서버 파이프라인

별도 간이 견적기나 별도 디자인 로직은 두지 않는다. 업체 입찰은 공용 기능 플래그
`NEXT_PUBLIC_CONTRACTOR_BIDDING_ENABLED=false`로 숨긴다.

## 토스 전용 어댑터

- 토스 로그인 인가 코드를 `/api/apps-in-toss/session`에서 Supabase 사용자 세션으로 교환
- 패키지 오리진의 상대 API 요청에 Supabase Bearer 세션을 붙여 운영 API로 전달
- Next 클라이언트 라우터를 토스 WebView history로 연결
- 로그인·실행 셸 외 제품 UI와 기능은 해시로 검증된 `inpick-source/` 격리 복사본에서 import

서버에는 콘솔에서 발급한 `APPS_IN_TOSS_MTLS_CERT`, `APPS_IN_TOSS_MTLS_KEY`와
`APPS_IN_TOSS_USER_HASH_SECRET`가 필요하다.

## 명령

```bash
npm install
npm run snapshot:verify
npm run dev
npm run build
```

로컬 UI 확인은 `http://localhost:5173/?preview=1`에서 로그인 셸만 건너뛸 수 있다.
`import.meta.env.DEV` 조건이므로 배포 번들에서는 동작하지 않는다.

현재 운영 API 주소는 `.env.production`의
`https://inpick-apps-in-toss-api.vercel.app`로 고정한다. 최종 `inpick.ait`에는
Step 2 디자이너, 견적 PDF 엔진, 나눔고딕 폰트, 공정위 표준계약서를 포함한다.
