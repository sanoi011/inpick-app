# INPICK App

AI 기반 인테리어 견적, 디자인, RFQ, 사업자 매칭 플랫폼입니다.

## 현재 작업 기준

- 로컬 경로: `/Users/seonbonkim/Desktop/AIOD/개발/InPick/inpick-app`
- 운영 도메인: `https://interiorpick.co.kr`
- Vercel 프로젝트: `inpick-app` (`.vercel/repo.json` 기준)
- 메인 배포 단위: Next.js 14 App Router
- 모바일 앱 방식: Capacitor 7 native shell이 운영 도메인을 WebView로 로드

## 주요 스택

- Next.js 14, React 18, TypeScript, Tailwind CSS
- Supabase Auth/DB/Storage/Realtime
- Vercel 배포
- OpenAI/Anthropic/RunPod 기반 AI 파이프라인
- Capacitor iOS/Android shell
- Playwright E2E

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

전체 로컬 개발용 보조 서비스:

```bash
npm run dev:ai       # python/floorplan-ai, port 8100
npm run dev:parser   # services/pdf_parser, port 8101
npm run dev:full
npm run dev:full-v47
```

## 검증

```bash
npm run build
npm run test:e2e
```

현재 빌드 참고사항:

- `npm run build`는 통과합니다.
- 빌드 중 `Bodoni Moda` font override 경고와 `onnxruntime-web` critical dependency 경고가 나올 수 있습니다.
- 이 경고들은 현재 프로덕션 빌드를 막지는 않습니다.

## 환경 변수

`.env.example`을 기준으로 `.env.local`을 구성합니다. 필수 축은 다음입니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `ADMIN_PASSWORD`

운영 배포에서는 같은 값을 Vercel Project Settings > Environment Variables에 설정합니다.

## 배포

Vercel은 GitHub `main` 브랜치와 연결된 상태로 관리합니다. `vercel.json`의 build command는 다음입니다.

```bash
rm -rf .next && next build
```

Supabase 마이그레이션은 `supabase/migrations/`를 기준으로 관리합니다. 원격 DB 적용 전에는 SQL과 RLS 영향을 반드시 검토합니다.

## 모바일 앱

주요 스크립트:

```bash
npm run mobile:assets
npm run mobile:sync
npm run mobile:open:ios
npm run mobile:open:android
```

`capacitor.config.ts`는 현재 `https://interiorpick.co.kr`을 로드합니다. 웹 배포만 변경되는 경우 앱 재빌드 없이 운영 웹이 갱신됩니다. 네이티브 플러그인, 권한, 앱 아이콘, splash 변경 시에는 `mobile:sync` 후 Xcode/Android Studio에서 새 빌드가 필요합니다.

## 작업 메모

- `git status`에서 많은 파일이 수정된 것처럼 보이면 먼저 `git diff --ignore-space-at-eol --stat`로 실제 변경만 확인합니다. 현재 작업트리는 줄끝 변환 노이즈가 큽니다.
- 실제 최근 변경 축은 모바일 안전영역, PWA/Capacitor 메타, 운영 도메인, OAuth 시작 helper입니다.
- Codex 작업 지침은 `AGENTS.md`, Claude Code 작업 지침은 `CLAUDE.md`를 우선 확인합니다.
