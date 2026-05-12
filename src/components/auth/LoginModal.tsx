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
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback },
      });
      if (oauthErr) setError(`${provider} 로그인 실패: ${oauthErr.message}`);
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
          <div className="grid grid-cols-2 gap-2">
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
      className={`h-10 rounded-full text-[13px] font-semibold transition-colors ${config.bg}`}
    >
      {config.label}
    </button>
  );
}
