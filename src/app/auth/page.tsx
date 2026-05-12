"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  User,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  Hexagon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SignupModal } from "@/components/auth/SignupModal";

type OAuthProvider = "google" | "kakao" | "apple" | "naver";

/* ─── 공용: OAuth 버튼 묶음 ────────────────────── */
function OAuthRow({
  onProvider,
  loadingProvider,
}: {
  onProvider: (p: OAuthProvider) => void;
  loadingProvider: OAuthProvider | null;
}) {
  const items: {
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
    {
      key: "kakao",
      label: "카카오",
      bg: "bg-[#FEE500]",
      fg: "text-[#3C1E1E]",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#3C1E1E">
          <path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.76 5.01 4.41 6.36l-1.12 4.12c-.1.36.3.65.62.45l4.84-3.2c.41.04.82.07 1.25.07 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" />
        </svg>
      ),
    },
    {
      key: "apple",
      label: "Apple",
      bg: "bg-ink",
      fg: "text-offwhite",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
        </svg>
      ),
    },
    {
      key: "naver",
      label: "네이버",
      bg: "bg-[#03C75A]",
      fg: "text-white",
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.273 12.845L7.376 0H0v24h7.726V11.155L16.624 24H24V0h-7.727v12.845z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((it) => {
        const loading = loadingProvider === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => !it.disabled && !loadingProvider && onProvider(it.key)}
            disabled={!!loadingProvider || it.disabled}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-all ${it.bg} ${it.fg} ${it.border ?? ""} disabled:opacity-50`}
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
function ConsumerAuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSignupModal, setShowSignupModal] = useState(searchParams.get("mode") === "signup");
  const [forgotMode, setForgotMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setNeedsConfirm(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message || "";
        if (msg.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirm(true);
          setError("이메일 인증이 완료되지 않았습니다. 받은 메일함에서 인증 링크를 눌러주세요.");
        } else if (msg.toLowerCase().includes("invalid login")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (msg.toLowerCase().includes("too many") || msg.toLowerCase().includes("rate limit")) {
          setError("잠시 후 다시 시도해주세요. 너무 많은 시도가 감지되었습니다.");
        } else {
          setError(msg || "로그인에 실패했습니다.");
        }
        return;
      }
      // hard navigation — 미들웨어가 새 인증 쿠키를 읽도록 보장
      const returnUrl = searchParams.get("returnUrl");
      window.location.href = returnUrl || "/";
    } catch (err) {
      console.error("[auth] login error", err);
      setError("로그인 중 오류가 발생했습니다.");
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
      const returnUrl = searchParams.get("returnUrl");
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "kakao" | "apple",
        options: { redirectTo: callbackUrl },
      });
      if (error) {
        setError(`${provider} 로그인에 실패했습니다: ${error.message}`);
        setOauthLoading(null);
      }
    } catch (err) {
      console.error("[auth] oauth error", err);
      setError("소셜 로그인 중 오류가 발생했습니다.");
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) setError(error.message);
      else setMessage("비밀번호 재설정 이메일을 발송했습니다. 이메일을 확인해주세요.");
    } catch {
      setError("이메일 발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <FormFrame>
        {error && <Alert kind="danger">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <h3 className="text-lg font-extrabold tracking-tight text-ink">비밀번호 찾기</h3>
        <p className="mt-1 text-[13px] text-ink-60">
          가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
        </p>
        <form onSubmit={handleForgotPassword} className="mt-5 flex flex-col gap-4">
          <Field label="이메일">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              autoFocus
            />
          </Field>
          <PrimaryButton type="submit" loading={loading}>
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
      {message && <Alert kind="success">{message}</Alert>}

      <OAuthRow onProvider={handleOAuth} loadingProvider={oauthLoading} />

      <Divider>또는 이메일로</Divider>

      <div className="mb-5 flex rounded-full bg-primary-50 p-1">
        <button
          type="button"
          className="flex-1 rounded-full bg-white py-2 text-[13px] font-semibold text-ink shadow-sm"
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
          className="flex-1 rounded-full py-2 text-[13px] font-semibold text-ink-60 transition-colors hover:text-ink"
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
        <Field label="이메일">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            required
          />
        </Field>
        <Field label="비밀번호">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
            minLength={6}
          />
        </Field>
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
            회원가입 <Hexagon className="inline h-3 w-3 align-text-bottom" /> +5 토큰
          </button>
        </p>
      </div>

      <SignupModal
        open={showSignupModal}
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
      const res = await fetch("/api/contractor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      localStorage.setItem("contractor_token", data.token);
      localStorage.setItem("contractor_id", data.contractor.id);
      localStorage.setItem("contractor_name", data.contractor.company_name);
      router.push("/contractor");
    } catch {
      setError("서버 오류가 발생했습니다.");
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "kakao" | "apple",
        options: {
          redirectTo: callbackUrl,
          queryParams: { account_type: "contractor" },
        },
      });
      if (error) {
        setError(`${provider} 로그인에 실패했습니다: ${error.message}`);
        setOauthLoading(null);
      }
    } catch (err) {
      console.error("[auth] contractor oauth error", err);
      setError("소셜 로그인 중 오류가 발생했습니다.");
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

      {/* 안내 배너 — 소셜 로그인 후 사업자 정보 등록 안내 */}
      <div className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/70 p-4">
        <p className="text-[12px] font-bold uppercase tracking-widest text-primary-500">
          간편 로그인
        </p>
        <p className="mt-1 text-[14px] font-bold tracking-tight text-ink">
          소셜 계정으로 즉시 시작
        </p>
        <p className="mt-0.5 text-[12px] text-ink-60 leading-relaxed">
          로그인 후 첫 화면에서 사업자등록번호·대표자명 등 입찰 조건 정보를 등록하면 즉시 입찰 참여 가능합니다.
        </p>
      </div>

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
        <div className="w-full border-t border-primary-100" />
      </div>
      <div className="font-mono relative flex justify-center text-[11px] uppercase tracking-[0.16em]">
        <span className="bg-white px-2 text-ink-40">{children}</span>
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
      <label className="mb-1.5 block text-[12px] font-bold tracking-tight text-ink-60">
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
      className={`w-full rounded-2xl border border-primary-100 bg-white py-3 text-[14px] tracking-tight text-ink outline-none transition-all placeholder:text-ink-40 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 ${
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
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-500 text-[14px] font-semibold tracking-tight text-white shadow-cta transition-colors hover:bg-primary-600 disabled:bg-primary-100 disabled:text-ink-40 disabled:shadow-none"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

/* ─── 통합 인증 페이지 ─────────────────────── */
function AuthContent() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("type") === "contractor" ? "contractor" : "consumer";
  const [activeTab, setActiveTab] = useState<"consumer" | "contractor">(initialTab);

  return (
    <div className="font-kr relative flex min-h-screen items-center justify-center overflow-hidden bg-burgundy px-4 py-12 text-ink">
      {/* 백그라운드 인테리어 콜라주 */}
      <InteriorCollage />
      {/* 살구 그라데이션 오버랩 (가독성) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(54,8,2,0.55)_0%,rgba(247,59,32,0.32)_45%,rgba(54,8,2,0.65)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(253,203,196,0.30),transparent_60%)]" />
        <div className="absolute -right-[15%] top-[15%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.30),transparent_70%)] blur-3xl" />
        <div className="absolute -left-[12%] top-[45%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.40),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-[440px]">
        {/* 브랜드 배지 (Archisketch 패턴) */}
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 shadow-card ring-1 ring-primary-100">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[18px] font-extrabold tracking-[-0.04em] text-ink"
          >
            <span className="hex-mask h-5 w-5 text-primary-500" />
            <span className="font-en">inpick</span>
          </Link>
        </div>
        <p className="mb-6 text-center text-[13px] font-medium tracking-tight text-offwhite/85">
          {activeTab === "consumer"
            ? "한 계정으로 인테리어의 모든 단계를."
            : "사업자로 입찰·매칭을 받아보세요."}
        </p>

        {/* 소비자 / 사업자 탭 */}
        <div className="mb-5 flex gap-2.5">
          <TabButton
            active={activeTab === "consumer"}
            onClick={() => setActiveTab("consumer")}
            icon={<User className="h-4 w-4" />}
            title="소비자"
            sub="견적·디자인·계약"
          />
          <TabButton
            active={activeTab === "contractor"}
            onClick={() => setActiveTab("contractor")}
            icon={<Building2 className="h-4 w-4" />}
            title="사업자"
            sub="입찰·매칭·시공"
          />
        </div>

        {/* 카드 */}
        <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white p-7 shadow-card">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, #F73B20, transparent)",
            }}
          />
          {activeTab === "consumer" ? <ConsumerAuthForm /> : <ContractorAuthForm />}
        </div>

        <p className="font-mono mt-6 text-center text-[11px] tracking-[0.08em] text-offwhite/60">
          로그인 시 <span className="underline">서비스 이용약관</span> 및{" "}
          <span className="underline">개인정보처리방침</span>에 동의합니다.
        </p>
      </div>
    </div>
  );
}

/* ─── 인테리어 백그라운드 콜라주 (Archisketch 결) ─── */
function InteriorCollage() {
  // 12장 그리드. 화면 사이즈 기준 4×3 (데스크톱) / 3×4 (모바일)
  const tiles = Array.from({ length: 12 }, (_, i) => ({
    src: `/auth-bg/${i + 1}.jpg`,
    rot: [-3, 2, -1.5, 1.8, -2.4, 1.2, -1.6, 2.6, -2, 1.4, -1.8, 2.2][i],
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="grid h-full w-full grid-cols-2 grid-rows-6 gap-[6px] p-[6px] sm:grid-cols-3 sm:grid-rows-4 lg:grid-cols-4 lg:grid-rows-3">
        {tiles.map((t, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-[14px] shadow-[0_10px_24px_-8px_rgba(54,8,2,0.5)]"
            style={{ transform: `rotate(${t.rot}deg) scale(1.04)` }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${t.src})` }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(54,8,2,0.10),rgba(247,59,32,0.08))]" />
          </div>
        ))}
      </div>
    </div>
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
      className={`flex flex-1 items-center justify-center gap-2.5 rounded-2xl border-2 py-3.5 transition-all ${
        active
          ? "border-primary-500 bg-primary-50 text-primary-700 shadow-cta"
          : "border-primary-100 bg-white text-ink-60 hover:border-primary-300"
      }`}
    >
      {icon}
      <div className="text-left">
        <p className="text-[14px] font-bold tracking-tight">{title}</p>
        <p className="text-[11px] opacity-70">{sub}</p>
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
