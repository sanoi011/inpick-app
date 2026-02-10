"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function AuthForm() {
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Supabase auth integration
    console.log(isSignUp ? "Sign Up" : "Login", { email, password, name });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-neutral-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-600">
            INPICK
          </Link>
          <p className="mt-2 text-neutral-500">
            {isSignUp ? "회원가입하고 시작하세요" : "로그인하여 계속하세요"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          {/* Toggle */}
          <div className="flex rounded-lg bg-neutral-100 p-1 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isSignUp
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500"
              }`}
              onClick={() => setIsSignUp(false)}
            >
              로그인
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isSignUp
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500"
              }`}
              onClick={() => setIsSignUp(true)}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <button type="submit" className="w-full btn-primary">
              {isSignUp ? "회원가입" : "로그인"}
            </button>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-neutral-500">또는</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <button className="w-full flex items-center justify-center gap-3 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">
                <span className="font-medium text-neutral-700">Google로 계속하기</span>
              </button>
              <button className="w-full flex items-center justify-center gap-3 py-3 bg-[#FEE500] rounded-lg hover:bg-[#FDD835] transition-colors">
                <span className="font-medium text-neutral-900">카카오로 계속하기</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-400">로딩 중...</div>
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
