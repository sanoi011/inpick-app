"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const supabase = createClient();

  // URL 에러 파라미터 처리
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth_failed") {
      setError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
    }
  }, [searchParams]);

  // 이메일/비밀번호 로그인
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else {
          setError(error.message);
        }
      } else {
        router.push("/project/new");
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 이메일/비밀번호 회원가입
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        if (error.message.includes("already registered")) {
          setError("이미 가입된 이메일입니다.");
        } else {
          setError(error.message);
        }
      } else {
        setMessage("확인 이메일을 발송했습니다. 이메일을 확인해주세요.");
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 소셜 로그인 (Google / Kakao)
  const handleOAuth = async (provider: "google" | "kakao") => {
    setError("");
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(`${provider === "google" ? "Google" : "카카오"} 로그인에 실패했습니다: ${error.message}`);
        setOauthLoading(null);
      }
      // 성공 시 리다이렉트되므로 loading 해제 불필요
    } catch {
      setError("소셜 로그인 중 오류가 발생했습니다.");
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-neutral-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-blue-600">
            INPICK
          </Link>
          <p className="mt-2 text-neutral-500">
            {isSignUp ? "회원가입하고 시작하세요" : "로그인하여 계속하세요"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          {/* 에러/성공 메시지 */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {message}
            </div>
          )}

          {/* 소셜 로그인 */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth("google")}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              <span className="font-medium text-neutral-700">Google로 계속하기</span>
            </button>
            {/* 카카오 로그인 - 비즈니스 심사 완료 후 활성화 예정 */}
            {/* <button
              onClick={() => handleOAuth("kakao")}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-3 bg-[#FEE500] rounded-lg hover:bg-[#FDD835] transition-colors disabled:opacity-50"
            >
              {oauthLoading === "kakao" ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-700" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.76 5.01 4.41 6.36l-1.12 4.12c-.1.36.3.65.62.45l4.84-3.2c.41.04.82.07 1.25.07 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" />
                </svg>
              )}
              <span className="font-medium text-neutral-900">카카오로 계속하기</span>
            </button> */}
          </div>

          {/* 구분선 */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-neutral-500">또는 이메일로</span>
            </div>
          </div>

          {/* 로그인/회원가입 토글 */}
          <div className="flex rounded-lg bg-neutral-100 p-1 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isSignUp ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => { setIsSignUp(false); setError(""); setMessage(""); }}
            >
              로그인
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isSignUp ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => { setIsSignUp(true); setError(""); setMessage(""); }}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSignUp ? "회원가입" : "로그인"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          로그인 시 <span className="underline">서비스 이용약관</span> 및 <span className="underline">개인정보처리방침</span>에 동의합니다.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
