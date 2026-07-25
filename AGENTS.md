# Codex Working Notes

## Project

- INPICK app, AI interior estimate and contractor matching platform.
- Local root: `/Users/seonbonkim/Desktop/AIOD/개발/InPick/inpick-app`
- Production URL: `https://interiorpick.co.kr`
- Vercel project: `inpick-app`
- Git branch: `main`

## Before Editing

- This repository currently has large line-ending noise. Use:

```bash
git diff --ignore-space-at-eol --stat
git diff --ignore-space-at-eol -- <path>
```

- Do not revert broad modified files unless the user explicitly asks. Preserve existing user/Claude changes.
- Keep changes scoped. Prefer existing app patterns over new abstractions.

## Commands

```bash
npm install
npm run dev
npm run build
npm run test:e2e
```

Mobile:

```bash
npm run mobile:assets
npm run mobile:sync
npm run mobile:open:ios
npm run mobile:open:android
```

Local auxiliary services:

```bash
npm run dev:ai
npm run dev:parser
npm run dev:full
npm run dev:full-v47
```

## Environment

- `.env.local` is local only and can contain secrets. Do not print it.
- `.env.example` documents required keys.
- Required production services: Supabase, Vercel, Anthropic, OpenAI.
- Optional production services: RunPod, Toss Payments, Vercel KV.

## Current Verified State

- `npm install` completed on macOS arm64.
- `npm run build` passes.
- Expected build warnings:
  - `Failed to find font override values for font Bodoni Moda`
  - `onnxruntime-web` critical dependency warning

## Recent Work Area

- Mobile/Capacitor production domain points at `https://interiorpick.co.kr`.
- PWA theme color is `#F73B20`.
- Root viewport uses `viewportFit: "cover"` and safe-area utility CSS.
- OAuth is routed through `src/lib/auth/oauth-start.ts` for web/native branching.
- Kakao and Apple buttons are visible but require Supabase provider and developer console setup before production use.

## Deployment Notes

- Vercel build command: `rm -rf .next && next build`.
- `.vercel/` is local link metadata and must not be committed.
- Supabase migrations live in `supabase/migrations/`; review RLS and service-role use before applying remote DB changes.

## Authentication Release Gate

- Use `$inpick-auth-regression` before committing, pushing, or deploying web changes.
- Treat a permanently spinning login or `로그인 상태를 확인하고 있어요` screen as a release blocker.
- Run the skill's type, authentication unit, and browser regression checks against a local server before deployment.
- Before changing OAuth callbacks, global auth providers, middleware session refresh,
  or Supabase browser-client initialization, read
  `docs/ops/WEB_OAUTH_PKCE_INCIDENT_2026-07-25.md` and preserve its
  single-exchange invariants.
