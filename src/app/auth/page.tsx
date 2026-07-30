"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  User,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Hexagon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startOAuth } from "@/lib/auth/oauth-start";
import { NAVER_LOGIN_ENABLED } from "@/lib/auth/naver-login-flag";
import { SignupModal } from "@/components/auth/SignupModal";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  isAuthOperationTimeoutError,
  runPostLoginBestEffort,
  withAuthTimeout,
} from "@/lib/auth/resilience";
import { sanitizeAuthReturnPath } from "@/lib/auth/return-path";

type OAuthProvider = "google" | "kakao" | "apple" | "naver";

/* ─── 공용: OAuth 버튼 묶음 ────────────────────── */
function OAuthRow({
  onProvider,
  loadingProvider,
  showPendingNaver = false,
}: {
  onProvider: (p: OAuthProvider) => void;
  loadingProvider: OAuthProvider | null;
  showPendingNaver?: boolean;
}) {
  const allItems: {
    key: OAuthProvider;
    label: string;
    bg: string;
    fg: string;
    border?: string;
    disabled?: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      key: "google",
      label: "Google",
      bg: "bg-white",
      fg: "text-ink",
      border: "border border-primary-100",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      ),
    },
    // 카카오: Supabase provider 활성화 완료(2026-06). 애플은 심사 통과 후 복구.
    {
      key: "kakao",
      label: "카카오",
      bg: "bg-[#FEE500]",
      fg: "text-[#3C1E1E]",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C6.48 3 2 6.58 2 10.96c0 2.83 1.9 5.31 4.74 6.7-.16.57-.6 2.16-.69 2.5-.1.42.16.42.33.31.13-.09 2.1-1.43 2.96-2.01.54.08 1.1.12 1.66.12 5.52 0 10-3.58 10-7.62C21 6.58 17.52 3 12 3z" />
        </svg>
      ),
    },
    {
      key: "naver",
      label: NAVER_LOGIN_ENABLED ? "네이버" : "네이버 (검수 중)",
      bg: "bg-[#03C75A]",
      fg: "text-white",
      disabled: !NAVER_LOGIN_ENABLED,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.273 12.845L7.376 0H0v24h7.726V11.155L16.624 24H24V0h-7.727v12.845z" />
        </svg>
      ),
    },
    // 애플: iOS 심사(가이드 4.8) 필수. Supabase Apple provider 활성화(2026-07).
    {
      key: "apple",
      label: "Apple",
      bg: "bg-black",
      fg: "text-white",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.7c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
        </svg>
      ),
    },
  ];
  // 네이버 검수 재신청 중 — 통과 후 NEXT_PUBLIC_ENABLE_NAVER_LOGIN=true로 재노출.
  const items = NAVER_LOGIN_ENABLED || showPendingNaver ? allItems : allItems.filter((it) => it.key !== "naver");

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it) => {
        const loading = loadingProvider === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => !it.disabled && !loadingProvider && onProvider(it.key)}
            disabled={!!loadingProvider || it.disabled}
            className="inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-full border border-black/10 bg-white text-[13px] font-semibold text-black transition hover:bg-black/[0.035] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : it.icon}
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── 소비자 로그인 폼 ────────────────────────── */
function ConsumerAuthForm({ hankwon = false }: { hankwon?: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // 복귀 URL — 코드베이스에 returnUrl/next/redirect 세 이름이 혼재하므로 모두 허용(2026-07-05 로그인 후 복귀 실패 수정)
  const returnUrl =
    searchParams.get("returnUrl") || searchParams.get("next") || searchParams.get("redirect");
  const safeReturnUrl = sanitizeAuthReturnPath(returnUrl);
  const [showSignupModal, setShowSignupModal] = useState(searchParams.get("mode") === "signup");
  const [forgotMode, setForgotMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth_failed") {
      setError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
    } else if (err === "naver_failed") {
      setError("네이버 로그인에 실패했습니다. 다시 시도해주세요.");
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem("inpick_remembered_consumer_email");
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberLogin(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setNeedsConfirm(false);
    setLoading(true);
    try {
      // signup API가 lowercase+trim으로 저장하므로 로그인도 동일하게 정규화
      const normalizedEmail = email.toLowerCase().trim();
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        }),
        undefined,
        "consumer-email-login",
      );
      if (error) {
        const msg = (error.message || "").toLowerCase();
        // 로그인 실패 사유를 명확히 분리 — "없는 이메일"로 뭉뚱그리지 않는다.
        if (msg.includes("email not confirmed")) {
          setNeedsConfirm(true);
          setError("이메일 인증이 완료되지 않았습니다. 받은 메일함에서 인증 링크를 눌러주세요.");
        } else if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          // Supabase는 보안상 미가입/비번오류를 동일 메시지로 반환 → 둘 다 안내
          setError("이메일 또는 비밀번호가 올바르지 않습니다. 가입하지 않은 이메일이라면 회원가입을 진행해주세요.");
        } else if (msg.includes("too many") || msg.includes("rate limit")) {
          setError("잠시 후 다시 시도해주세요. 너무 많은 시도가 감지되었습니다.");
        } else if (msg.includes("network") || msg.includes("fetch")) {
          setError("네트워크 오류로 로그인에 실패했습니다. 연결을 확인하고 다시 시도해주세요.");
        } else {
          setError(error.message || "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
        return;
      }
      // 프로필 자동 보강·감사 기록은 최대 1.5초만 기다린다.
      // 후처리 장애가 성공한 로그인을 다시 무한 로딩으로 만들 수 없다.
      await runPostLoginBestEffort();
      // 이메일 로그인 완료 계측 (sendBeacon — hard nav에도 전송됨)
      trackClientEvent(AnalyticsEvents.LoginCompleted, {
        props: { provider: "email", method: "password" },
      });
      try {
        if (rememberLogin) {
          localStorage.setItem("inpick_remembered_consumer_email", normalizedEmail);
        } else {
          localStorage.removeItem("inpick_remembered_consumer_email");
        }
      } catch {
        /* private mode */
      }
      // hard navigation — 미들웨어가 새 인증 쿠키를 읽도록 보장
      window.location.replace(safeReturnUrl);
    } catch (err) {
      console.error("[auth] login error", err);
      setError(
        isAuthOperationTimeoutError(err)
          ? "로그인 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
          : "로그인 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirm = async () => {
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message || "확인 메일 재발송에 실패했습니다.");
      } else {
        setMessage("확인 메일을 다시 보냈습니다. 받은 메일함과 스팸함을 확인해주세요.");
      }
    } catch (err) {
      console.error("[auth] resend error", err);
      setError("재발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    setOauthLoading(provider);
    try {
      if (provider === "naver") {
        // 네이버는 Supabase 공식 미지원 — 커스텀 OAuth 라우트로 위임
        const params = new URLSearchParams();
        params.set("account_type", "consumer");
        if (returnUrl) params.set("next", returnUrl);
        window.location.href = `/api/auth/naver/start?${params.toString()}`;
        return;
      }
      const callbackUrl = returnUrl
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
        : `${window.location.origin}/auth/callback`;
      const { error } = await withAuthTimeout(
        startOAuth(supabase, provider as "google" | "kakao" | "apple", {
          redirectTo: callbackUrl,
        }),
        undefined,
        `consumer-${provider}-oauth`,
      );
      if (error) {
        setError(`${provider} 로그인에 실패했습니다: ${error}`);
        setOauthLoading(null);
      }
    } catch (err) {
      console.error("[auth] oauth error", err);
      setError(
        isAuthOperationTimeoutError(err)
          ? "소셜 로그인 연결이 지연되고 있습니다. 다시 시도해주세요."
          : "소셜 로그인 중 오류가 발생했습니다.",
      );
      setOauthLoading(null);
    }
  };

  // 자체 비번 복구 — 2-step flow (verify → reset)
  const [forgotStep, setForgotStep] = useState<"verify" | "reset" | "done">("verify");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotName, setForgotName] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotNewPasswordConfirm, setForgotNewPasswordConfirm] = useState("");

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email || !forgotPhone || !forgotName) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/self/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          phone: forgotPhone.replace(/[^0-9]/g, ""),
          name: forgotName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "본인 정보가 일치하지 않습니다.");
        return;
      }
      setMessage("본인 확인 완료. 새 비밀번호를 입력하세요.");
      setForgotStep("reset");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (forgotNewPassword.length < 8 || !/[A-Za-z]/.test(forgotNewPassword) || !/\d/.test(forgotNewPassword)) {
      setError("비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.");
      return;
    }
    if (forgotNewPassword !== forgotNewPasswordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/self/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: forgotNewPassword,
          newPasswordConfirm: forgotNewPasswordConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "비밀번호 변경에 실패했습니다.");
        return;
      }
      setMessage("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.");
      setPassword(forgotNewPassword);
      setForgotStep("done");
      setTimeout(() => {
        setForgotMode(false);
        setForgotStep("verify");
        setForgotPhone("");
        setForgotName("");
        setForgotNewPassword("");
        setForgotNewPasswordConfirm("");
        setMessage("");
      }, 2500);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <FormFrame>
        {error && <Alert kind="danger">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <h3 className="text-lg font-extrabold tracking-tight text-ink">비밀번호 재설정</h3>
        {forgotStep === "verify" && (
          <>
            <p className="mt-1 text-[13px] text-ink-60">
              가입 시 입력한 이메일·휴대폰·이름을 확인합니다.
            </p>
            <form onSubmit={handleForgotVerify} className="mt-5 flex flex-col gap-3">
              <Field label="이메일">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일"
                  required
                  autoFocus
                />
              </Field>
              <Field label="휴대폰번호">
                <Input
                  type="tel"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  placeholder="010-XXXX-XXXX"
                  required
                />
              </Field>
              <Field label="이름">
                <Input
                  type="text"
                  value={forgotName}
                  onChange={(e) => setForgotName(e.target.value)}
                  placeholder="가입 시 입력한 이름"
                  required
                />
              </Field>
              <PrimaryButton type="submit" loading={loading}>
                본인 확인
              </PrimaryButton>
            </form>
            <p className="mt-3 text-[11px] text-ink-40 text-center">
              본인 확인 성공 시 다음 단계에서 새 비밀번호를 설정합니다. 10분 내 5회 시도 제한.
            </p>
          </>
        )}
        {forgotStep === "reset" && (
          <>
            <p className="mt-1 text-[13px] text-ink-60">
              본인 확인 완료. 새 비밀번호를 입력하세요. (10분 내 미설정 시 무효)
            </p>
            <form onSubmit={handleForgotReset} className="mt-5 flex flex-col gap-3">
              <Field label="새 비밀번호">
                <Input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="영문+숫자 포함 8자 이상"
                  required
                  minLength={8}
                  autoFocus
                />
              </Field>
              <Field label="비밀번호 확인">
                <Input
                  type="password"
                  value={forgotNewPasswordConfirm}
                  onChange={(e) => setForgotNewPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  minLength={8}
                />
              </Field>
              <PrimaryButton type="submit" loading={loading}>
                비밀번호 변경
              </PrimaryButton>
            </form>
          </>
        )}
        {forgotStep === "done" && (
          <p className="mt-4 text-[13px] text-ink-60 text-center">로그인 화면으로 이동합니다...</p>
        )}
        <button
          onClick={() => {
            setForgotMode(false);
            setForgotStep("verify");
            setForgotPhone("");
            setForgotName("");
            setForgotNewPassword("");
            setForgotNewPasswordConfirm("");
            setError("");
            setMessage("");
          }}
          className="mt-4 w-full text-[13px] text-ink-60 hover:text-ink"
        >
          로그인으로 돌아가기
        </button>
      </FormFrame>
    );
  }

  return (
    <FormFrame>
      {error && <Alert kind="danger">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}

      <OAuthRow onProvider={handleOAuth} loadingProvider={oauthLoading} showPendingNaver={hankwon} />

      <Divider>또는 이메일로</Divider>

      <div className="mb-5 flex rounded-full bg-[#f4f4f2] p-1">
        <button
          type="button"
          className="flex-1 rounded-full bg-white py-2 text-[13px] font-semibold text-black shadow-sm"
          aria-current="page"
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setMessage("");
            setShowSignupModal(true);
          }}
          className="flex-1 rounded-full py-2 text-[13px] font-semibold text-black/48 transition-colors hover:text-black"
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
        <Field label="이메일">
          <Input
            type="email"
            name="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="비밀번호">
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            required
            minLength={6}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 px-0.5 py-0.5 text-left">
          <input
            type="checkbox"
            checked={rememberLogin}
            onChange={(e) => {
              const checked = e.target.checked;
              setRememberLogin(checked);
              if (!checked) {
                try {
                  localStorage.removeItem("inpick_remembered_consumer_email");
                } catch {
                  /* private mode */
                }
              }
            }}
            className="h-4 w-4 rounded border-black/20 accent-black"
          />
          <span className="text-[12px] font-semibold text-black/62">로그인 저장</span>
        </label>
        <PrimaryButton type="submit" loading={loading}>
          로그인 <ArrowRight className="h-3.5 w-3.5" />
        </PrimaryButton>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <button
          onClick={() => {
            setForgotMode(true);
            setError("");
            setMessage("");
          }}
          className="text-[13px] text-ink-60 hover:text-primary-500"
        >
          비밀번호를 잊으셨나요?
        </button>
        {needsConfirm && (
          <button
            type="button"
            onClick={handleResendConfirm}
            disabled={loading || !email}
            className="text-[13px] font-semibold text-primary-500 hover:text-primary-600 disabled:opacity-50"
          >
            확인 메일 다시 보내기
          </button>
        )}
        <p className="text-[12px] text-ink-60">
          계정이 없으신가요?{" "}
          <button
            type="button"
            onClick={() => setShowSignupModal(true)}
            className="font-semibold text-primary-500 hover:underline"
          >
            {hankwon ? "회원가입" : <>회원가입 <Hexagon className="inline h-3 w-3 align-text-bottom" /> +5 토큰</>}
          </button>
        </p>
      </div>

      <SignupModal
        open={showSignupModal}
        hankwon={hankwon}
        onClose={() => setShowSignupModal(false)}
        onSwitchToLogin={() => setShowSignupModal(false)}
      />
    </FormFrame>
  );
}

/* ─── 사업자 로그인 폼 ────────────────────────── */
function ContractorAuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [message, setMessage] = useState("");
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await withAuthTimeout(
        fetch("/api/contractor/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }),
        undefined,
        "contractor-email-login",
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      localStorage.setItem("contractor_token", data.token);
      localStorage.setItem("contractor_id", data.contractor.id);
      localStorage.setItem("contractor_name", data.contractor.company_name);
      // 사업자 이메일 로그인 완료 계측
      trackClientEvent(AnalyticsEvents.LoginCompleted, {
        props: { provider: "email", method: "password", account_type: "contractor" },
      });
      router.push("/contractor");
    } catch (error) {
      setError(
        isAuthOperationTimeoutError(error)
          ? "로그인 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
          : "서버 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setError("");
    setOauthLoading(provider);
    try {
      if (provider === "naver") {
        const params = new URLSearchParams();
        params.set("account_type", "contractor");
        params.set("next", "/contractor");
        window.location.href = `/api/auth/naver/start?${params.toString()}`;
        return;
      }
      // 사업자도 supabase OAuth 사용 — callback에서 contractor 등록 페이지로 분기
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/contractor")}`;
      const { error } = await withAuthTimeout(
        startOAuth(supabase, provider as "google" | "kakao" | "apple", {
          redirectTo: callbackUrl,
          queryParams: { account_type: "contractor" },
        }),
        undefined,
        `contractor-${provider}-oauth`,
      );
      if (error) {
        setError(`${provider} 로그인에 실패했습니다: ${error}`);
        setOauthLoading(null);
      }
    } catch (err) {
      console.error("[auth] contractor oauth error", err);
      setError(
        isAuthOperationTimeoutError(err)
          ? "소셜 로그인 연결이 지연되고 있습니다. 다시 시도해주세요."
          : "소셜 로그인 중 오류가 발생했습니다.",
      );
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contractor/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || "비밀번호 재설정 이메일을 발송했습니다.");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <FormFrame>
        {error && <Alert kind="danger">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <h3 className="text-lg font-extrabold tracking-tight text-ink">사업자 비밀번호 찾기</h3>
        <p className="mt-1 text-[13px] text-ink-60">
          등록된 이메일로 재설정 링크를 보내드립니다.
        </p>
        <form onSubmit={handleForgotPassword} className="mt-5 flex flex-col gap-4">
          <Field label="이메일" icon={<Mail className="h-4 w-4 text-ink-40" />}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@company.com"
              autoFocus
              hasIcon
            />
          </Field>
          <PrimaryButton type="submit" loading={loading} disabled={!email}>
            재설정 이메일 보내기
          </PrimaryButton>
        </form>
        <button
          onClick={() => {
            setForgotMode(false);
            setError("");
            setMessage("");
          }}
          className="mt-4 w-full text-[13px] text-ink-60 hover:text-ink"
        >
          로그인으로 돌아가기
        </button>
      </FormFrame>
    );
  }

  return (
    <FormFrame>
      {error && <Alert kind="danger">{error}</Alert>}

      <OAuthRow onProvider={handleOAuth} loadingProvider={oauthLoading} />

      <p className="mt-5 text-center text-[12px] text-ink-60">
        소셜 로그인이 가입과 로그인을 동시 처리합니다.
      </p>

      {/* 비밀번호 찾기 — 임시 hidden (이메일 로그인 비활성) */}
      <div className="mt-3 hidden text-center">
        <button
          onClick={() => {
            setForgotMode(true);
            setError("");
            setMessage("");
          }}
          className="text-[13px] text-ink-60 hover:text-primary-500"
        >
          비밀번호를 잊으셨나요?
        </button>
      </div>
    </FormFrame>
  );
}

/* ─── 폼 공통 컴포넌트 ─────────────────────── */
function FormFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
function Alert({
  kind,
  children,
}: {
  kind: "danger" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-[13px] ${
        kind === "danger"
          ? "border-danger-text/20 bg-danger-bg text-danger-text"
          : "border-success-text/20 bg-success-bg text-success-text"
      }`}
    >
      {children}
    </div>
  );
}
function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-black/[0.08]" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
        <span className="bg-white px-2 text-black/32">{children}</span>
      </div>
    </div>
  );
}
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold tracking-tight text-black/62">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</span>}
        {children}
      </div>
    </div>
  );
}
function Input({
  hasIcon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { hasIcon?: boolean }) {
  return (
    <input
      {...props}
      className={`h-[50px] w-full rounded-2xl border border-black/10 bg-white py-3 text-[14px] tracking-tight text-black outline-none transition placeholder:text-black/28 focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(247,59,32,0.06)] ${
        hasIcon ? "pl-10 pr-4" : "px-4"
      }`}
    />
  );
}
function PrimaryButton({
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-black text-[14px] font-semibold tracking-tight text-white transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

/* ─── 통합 인증 페이지 ─────────────────────── */
function AuthContent() {
  const searchParams = useSearchParams();
  const authReturnUrl = searchParams.get("returnUrl") || searchParams.get("next") || searchParams.get("redirect");
  const hankwon = searchParams.get("client") === "hankwon" || sanitizeAuthReturnPath(authReturnUrl) === "/writing";
  const initialTab =
    searchParams.get("type") === "contractor" ? "contractor" : "consumer";
  const [activeTab, setActiveTab] = useState<"consumer" | "contractor">(initialTab);

  return (
    <main className="min-h-screen bg-white font-kr text-[#0d0d0d]">
      <header className="absolute inset-x-0 top-0 z-20 pt-safe">
        <div className="flex h-16 items-center justify-between px-5 sm:px-8 lg:h-20 lg:px-10">
          <Link href={hankwon ? "/writing" : "/"} className="flex items-center gap-2.5" aria-label={hankwon ? "한권 홈" : "InPick 홈"}>
            {hankwon ? <span className="grid h-[28px] w-[28px] place-items-center rounded-lg bg-[#2d6cff] font-serif text-sm font-bold text-white">한</span> : <span className="hex-mask h-[22px] w-[22px] text-primary-500" />}
            <span className={hankwon ? "font-kr text-[21px] font-bold tracking-[-0.055em]" : "font-en text-[21px] font-bold tracking-[-0.055em]"}>{hankwon ? "한권" : "inpick"}</span>
          </Link>
          <Link href={hankwon ? "/writing" : "/"} className="hidden items-center gap-1.5 text-[13px] font-medium text-black/55 transition hover:text-black sm:inline-flex">
            {hankwon ? "한권으로" : "메인으로"} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden min-h-screen overflow-hidden p-5 lg:block">
          <div className="relative h-full min-h-[720px] overflow-hidden rounded-[28px] bg-[#eee]">
            <Image
              src="/images/feature-fireplace.jpg"
              alt="InPick AI 인테리어"
              fill
              priority
              sizes="54vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/5 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Imagine your space</p>
              <h1 className="mt-4 max-w-xl break-keep text-[44px] font-medium leading-[1.04] tracking-[-0.06em] xl:text-[56px]">
                내 공간의 가능성을 인픽에서 만나보세요.
              </h1>
              <p className="mt-5 max-w-lg break-keep text-[14px] leading-7 text-white/68">
                AI 디자인부터 실제 자재와 견적까지, 하나의 계정으로 인테리어의 모든 단계를 이어갑니다.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 pb-12 pt-[calc(6rem+env(safe-area-inset-top,0px))] sm:px-8 lg:py-24">
          <div className="w-full max-w-[430px]">
            <div className="mb-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
                {hankwon ? "WELCOME TO HANKWON" : activeTab === "consumer" ? "Welcome to InPick" : "InPick for business"}
              </p>
              <h2 className="mt-2 break-keep text-[28px] font-medium tracking-[-0.055em] sm:text-[34px]">
                {hankwon ? "내 이야기를 이어서 써볼까요?" : activeTab === "consumer" ? "다시 만나서 반가워요." : "인픽과 함께 사업을 시작하세요."}
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-black/48">
                {hankwon
                  ? "Google·카카오·네이버·Apple 또는 이메일로 로그인하면 한권 내 서재가 계정별로 안전하게 연결됩니다."
                  : activeTab === "consumer"
                  ? "로그인하고 저장된 디자인과 견적을 이어서 확인하세요."
                  : "소셜 계정으로 로그인하고 사업자 정보를 등록해 입찰·매칭을 시작하세요."}
              </p>
            </div>

            {!hankwon && <div className="mb-6 flex gap-2">
              <TabButton
                active={activeTab === "consumer"}
                onClick={() => setActiveTab("consumer")}
                icon={<User className="h-4 w-4" />}
                title="소비자"
                sub="디자인·견적"
              />
              <TabButton
                active={activeTab === "contractor"}
                onClick={() => setActiveTab("contractor")}
                icon={<Building2 className="h-4 w-4" />}
                title="사업자"
                sub="입찰·매칭"
              />
            </div>}

            <div>{hankwon || activeTab === "consumer" ? <ConsumerAuthForm hankwon={hankwon} /> : <ContractorAuthForm />}</div>

            <p className="mt-7 border-t border-black/[0.07] pt-5 text-center text-[10px] leading-5 text-black/35">
              로그인 시{" "}
              <Link href="/terms" className="underline decoration-black/20 underline-offset-2 hover:text-black">서비스 이용약관</Link>
              {" 및 "}
              <Link href="/privacy" className="underline decoration-black/20 underline-offset-2 hover:text-black">개인정보처리방침</Link>
              에 동의합니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`flex flex-1 items-center justify-center gap-2.5 rounded-2xl border py-3.5 transition ${
        active
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black/52 hover:bg-black/[0.035] hover:text-black"
      }`}
    >
      {icon}
      <div className="text-left">
        <p className="text-[13px] font-semibold tracking-tight">{title}</p>
        <p className="text-[10px] opacity-60">{sub}</p>
      </div>
    </button>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-offwhite">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
