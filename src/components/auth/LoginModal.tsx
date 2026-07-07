"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startOAuth } from "@/lib/auth/oauth-start";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToSignup?: () => void;
  returnUrl?: string;
}

export function LoginModal({ open, onClose, onSwitchToSignup, returnUrl }: LoginModalProps) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError("");
      setInfo("");
      setNeedsConfirm(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsConfirm(false);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        const msg = err.message || "";
        if (msg.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirm(true);
          setError("이메일 인증이 완료되지 않았습니다. 받은 메일함에서 인증 링크를 눌러주세요.");
        } else if (msg.toLowerCase().includes("invalid login")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (msg.toLowerCase().includes("too many") || msg.toLowerCase().includes("rate")) {
          setError("잠시 후 다시 시도해주세요. 너무 많은 시도가 감지되었습니다.");
        } else {
          setError(msg);
        }
        return;
      }
      // 이메일 로그인 완료 계측 (sendBeacon — hard nav에도 전송됨)
      trackClientEvent(AnalyticsEvents.LoginCompleted, {
        props: { provider: "email", method: "password" },
      });
      window.location.href = returnUrl || "/";
    } catch (err) {
      console.error("[login-modal] error", err);
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "kakao" | "naver" | "apple") => {
    setError("");
    if (provider === "naver") {
      const params = new URLSearchParams();
      params.set("account_type", "consumer");
      if (returnUrl) params.set("next", returnUrl);
      window.location.href = `/api/auth/naver/start?${params.toString()}`;
      return;
    }
    try {
      const callback = returnUrl
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`
        : `${window.location.origin}/auth/callback`;
      const { error: oauthErr } = await startOAuth(supabase, provider as "google" | "kakao" | "apple", {
        redirectTo: callback,
      });
      if (oauthErr) setError(`${provider} 로그인 실패: ${oauthErr}`);
    } catch (err) {
      console.error("[login-modal] oauth error", err);
      setError("소셜 로그인 중 오류가 발생했습니다.");
    }
  };

  const handleResendConfirm = async () => {
    if (!email) {
      setError("이메일을 먼저 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) setError(err.message);
      else setInfo("확인 메일을 다시 보냈습니다. 받은 메일함과 스팸함을 확인해주세요.");
    } catch (err) {
      console.error("[login-modal] resend error", err);
      setError("재발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("이메일을 먼저 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (err) setError(err.message);
      else setInfo("비밀번호 재설정 메일을 발송했습니다. 메일을 확인해주세요.");
    } catch (err) {
      console.error("[login-modal] reset error", err);
      setError("메일 발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-7 pt-7 pb-2">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900">로그인</h2>
          <p className="mt-1 text-[13px] text-gray-500">INPICK 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="px-7 pb-7 pt-4">
          <div className="flex flex-col gap-2.5">
            <OAuthBtn provider="google" onClick={() => handleOAuth("google")} />
            <OAuthBtn provider="kakao" onClick={() => handleOAuth("kakao")} />
            <OAuthBtn provider="naver" onClick={() => handleOAuth("naver")} />
            <OAuthBtn provider="apple" onClick={() => handleOAuth("apple")} />
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[11px] uppercase tracking-widest text-gray-400">
                또는 이메일로
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-700">
              {info}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative rounded-lg border border-gray-200 bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                required
                autoComplete="email"
                className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="relative rounded-lg border border-gray-200 bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                autoComplete="current-password"
                className="w-full bg-transparent pl-10 pr-10 py-2.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "로그인 중…" : "로그인"}
          </button>

          <div className="mt-3 flex justify-between text-[12px] text-gray-500">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="hover:text-orange-600 hover:underline disabled:opacity-50"
            >
              비밀번호를 잊으셨나요?
            </button>
            {needsConfirm && (
              <button
                type="button"
                onClick={handleResendConfirm}
                disabled={loading}
                className="font-semibold text-orange-600 hover:underline"
              >
                확인 메일 재발송
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-[12px] text-gray-500">
            계정이 없으신가요?{" "}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToSignup?.();
              }}
              className="font-semibold text-orange-600 hover:underline"
            >
              회원가입
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

const OAUTH_ICONS: Record<"google" | "kakao" | "naver" | "apple", React.ReactNode> = {
  google: (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  kakao: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.58 2 10.96c0 2.83 1.9 5.31 4.74 6.7-.16.57-.6 2.16-.69 2.5-.1.42.16.42.33.31.13-.09 2.1-1.43 2.96-2.01.54.08 1.1.12 1.66.12 5.52 0 10-3.58 10-7.62C21 6.58 17.52 3 12 3z" />
    </svg>
  ),
  naver: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.273 12.845L7.376 0H0v24h7.726V11.155L16.624 24H24V0h-7.727v12.845z" />
    </svg>
  ),
  apple: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.04c-.03-2.07 1.69-3.06 1.77-3.11-.97-1.41-2.47-1.6-3-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.39 2.05-1.45 2.51-.37 6.22 1.04 8.26.69.99 1.51 2.1 2.58 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.7.65 1.12-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.27 1.13-2.33-.02-.01-2.17-.83-2.2-3.3zM15.0 5.38c.57-.69.96-1.65.85-2.61-.83.03-1.83.55-2.42 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.87-.47 2.44-1.16z" />
    </svg>
  ),
};

function OAuthBtn({
  provider,
  onClick,
}: {
  provider: "google" | "kakao" | "naver" | "apple";
  onClick: () => void;
}) {
  const config = {
    google: { label: "Google", bg: "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50" },
    kakao: { label: "카카오", bg: "bg-[#FEE500] text-[#3C1E1E] hover:brightness-95" },
    naver: { label: "네이버", bg: "bg-[#03C75A] text-white hover:brightness-95" },
    apple: { label: "Apple", bg: "bg-black text-white hover:bg-gray-900" },
  }[provider];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-colors ${config.bg}`}
    >
      {OAUTH_ICONS[provider]}
      <span>{config.label}</span>
    </button>
  );
}
