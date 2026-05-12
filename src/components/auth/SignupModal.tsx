"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
  onSignedUp?: () => void;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) s++;
  if (pw.length >= 12) s++;
  const map = [
    { label: "너무 짧음", color: "bg-gray-200" },
    { label: "약함", color: "bg-red-500" },
    { label: "보통", color: "bg-yellow-500" },
    { label: "강함", color: "bg-green-500" },
    { label: "매우 강함", color: "bg-emerald-600" },
  ] as const;
  return { score: s as 0 | 1 | 2 | 3 | 4, ...map[s] };
}

export function SignupModal({ open, onClose, onSwitchToLogin, onSignedUp }: SignupModalProps) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge14, setAgreeAge14] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 회원가입 단계: 입력 → 최종 동의 확인 → 완료
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [finalConsent, setFinalConsent] = useState(false);

  // 휴대폰 사전 체크 결과
  const [phoneStatus, setPhoneStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle"
  );

  // 약관 전체동의 토글
  useEffect(() => {
    if (agreeAll) {
      setAgreeTerms(true);
      setAgreePrivacy(true);
      setAgreeAge14(true);
      setAgreeMarketing(true);
    }
  }, [agreeAll]);
  useEffect(() => {
    if (!(agreeTerms && agreePrivacy && agreeAge14 && agreeMarketing) && agreeAll) {
      setAgreeAll(false);
    }
  }, [agreeTerms, agreePrivacy, agreeAge14, agreeMarketing, agreeAll]);

  // 휴대폰 onBlur 시 사전 중복 체크
  const checkPhone = async () => {
    const digits = phone.replace(/[^0-9]/g, "");
    if (!/^01[016789]\d{7,8}$/.test(digits)) {
      setPhoneStatus("invalid");
      return;
    }
    setPhoneStatus("checking");
    try {
      const res = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneStatus(data.error?.includes("format") ? "invalid" : "idle");
        return;
      }
      setPhoneStatus(data.available ? "available" : "taken");
    } catch {
      setPhoneStatus("idle");
    }
  };

  // 모달 닫힘 시 폼 초기화
  useEffect(() => {
    if (!open) {
      setError("");
      setSuccess("");
      setStep("form");
      setFinalConsent(false);
    }
  }, [open]);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const strength = passwordStrength(password);
  const passwordMatch = password === passwordConfirm && password.length > 0;

  const canSubmit =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    passwordMatch &&
    phoneStatus === "available" &&
    agreeTerms &&
    agreePrivacy &&
    agreeAge14 &&
    !loading;

  // 1단계 (form) → 2단계 (confirm)로 이동
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setStep("confirm");
  };

  // 2단계 → 가입 API 실제 호출
  const handleFinalSubmit = async () => {
    if (!finalConsent) {
      setError("개인정보 수집·이용에 동의해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim(),
          phone: phone.replace(/[^0-9]/g, ""),
          agreeTerms,
          agreePrivacy,
          agreeAge14,
          agreeMarketing,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        setStep("form");
        return;
      }
      setSuccess(
        data.message ||
          "회원가입이 완료되었습니다. 등록하신 이메일로 인증 메일을 발송했습니다."
      );
      setStep("success");
      onSignedUp?.();
    } catch (err) {
      console.error("[signup-modal] submit error", err);
      setError("회원가입 중 오류가 발생했습니다. 다시 시도해주세요.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "kakao" | "naver" | "apple") => {
    setError("");
    if (provider === "naver") {
      window.location.href = "/api/auth/naver/start?account_type=consumer";
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(`${provider} 로그인 실패: ${error.message}`);
    } catch (err) {
      console.error("[signup-modal] oauth error", err);
      setError("소셜 로그인 중 오류가 발생했습니다.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
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
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900">회원가입</h2>
          <p className="mt-1 text-[13px] text-gray-500">
            INPICK 가입 시 <span className="font-semibold text-orange-600">+5 토큰</span> 증정
          </p>
        </div>

        {/* 성공 화면 */}
        {step === "success" ? (
          <div className="px-7 pb-7 pt-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <p className="text-sm font-semibold text-green-900">{success}</p>
              <p className="mt-2 text-xs text-green-700">
                받은 메일함과 스팸함을 확인해주세요. 인증을 완료해야 로그인이 가능합니다.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onSwitchToLogin?.();
              }}
              className="mt-4 w-full rounded-full bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              로그인하기
            </button>
          </div>
        ) : step === "confirm" ? (
          <FinalConsentStep
            agreeMarketing={agreeMarketing}
            finalConsent={finalConsent}
            setFinalConsent={setFinalConsent}
            loading={loading}
            error={error}
            onBack={() => {
              setStep("form");
              setError("");
            }}
            onConfirm={handleFinalSubmit}
          />
        ) : (
          <form onSubmit={handleProceedToConfirm} className="px-7 pb-7 pt-4">
            {/* OAuth */}
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

            <div className="space-y-3">
              <Field label="이름" required>
                <InputWithIcon icon={<User className="h-4 w-4" />}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    required
                    autoComplete="name"
                    className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none"
                  />
                </InputWithIcon>
              </Field>

              <Field label="이메일" required>
                <InputWithIcon icon={<Mail className="h-4 w-4" />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none"
                  />
                </InputWithIcon>
              </Field>

              <Field
                label="휴대폰번호"
                required
                hint={
                  phoneStatus === "checking"
                    ? "확인 중…"
                    : phoneStatus === "available"
                    ? "사용 가능한 번호입니다."
                    : phoneStatus === "taken"
                    ? "이미 가입된 번호입니다."
                    : phoneStatus === "invalid"
                    ? "형식이 올바르지 않습니다. (010-XXXX-XXXX)"
                    : undefined
                }
                hintColor={
                  phoneStatus === "available"
                    ? "text-green-600"
                    : phoneStatus === "taken" || phoneStatus === "invalid"
                    ? "text-red-600"
                    : "text-gray-500"
                }
              >
                <InputWithIcon icon={<Phone className="h-4 w-4" />}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhone(e.target.value));
                      setPhoneStatus("idle");
                    }}
                    onBlur={checkPhone}
                    placeholder="010-1234-5678"
                    required
                    autoComplete="tel"
                    className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none"
                  />
                </InputWithIcon>
              </Field>

              <Field label="비밀번호" required hint="영문 + 숫자 8자 이상">
                <InputWithIcon icon={<Lock className="h-4 w-4" />}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호"
                    required
                    autoComplete="new-password"
                    className="w-full bg-transparent pl-10 pr-10 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </InputWithIcon>
                {password && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex h-1 flex-1 gap-0.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm ${
                            i < strength.score ? strength.color : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-500">{strength.label}</span>
                  </div>
                )}
              </Field>

              <Field
                label="비밀번호 확인"
                required
                hint={
                  passwordConfirm && !passwordMatch
                    ? "비밀번호가 일치하지 않습니다."
                    : passwordConfirm && passwordMatch
                    ? "일치합니다."
                    : undefined
                }
                hintColor={
                  passwordConfirm && !passwordMatch
                    ? "text-red-600"
                    : passwordConfirm && passwordMatch
                    ? "text-green-600"
                    : "text-gray-500"
                }
              >
                <InputWithIcon icon={<Lock className="h-4 w-4" />}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 확인"
                    required
                    autoComplete="new-password"
                    className="w-full bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none"
                  />
                </InputWithIcon>
              </Field>
            </div>

            {/* 약관 동의 */}
            <div className="mt-4 space-y-1.5 rounded-xl bg-gray-50 p-3 text-[13px]">
              <CheckRow
                checked={agreeAll}
                onChange={setAgreeAll}
                label="전체 동의 (필수 + 선택)"
                bold
              />
              <div className="border-t border-gray-200 my-1.5" />
              <CheckRow
                checked={agreeTerms}
                onChange={setAgreeTerms}
                label={
                  <>
                    <span className="text-red-500">[필수]</span> 이용약관 동의{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      className="text-gray-500 underline hover:text-gray-700"
                    >
                      보기
                    </a>
                  </>
                }
              />
              <CheckRow
                checked={agreePrivacy}
                onChange={setAgreePrivacy}
                label={
                  <>
                    <span className="text-red-500">[필수]</span> 개인정보 수집·이용 동의{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      className="text-gray-500 underline hover:text-gray-700"
                    >
                      보기
                    </a>
                  </>
                }
              />
              <CheckRow
                checked={agreeAge14}
                onChange={setAgreeAge14}
                label={
                  <>
                    <span className="text-red-500">[필수]</span> 만 14세 이상입니다
                  </>
                }
              />
              <CheckRow
                checked={agreeMarketing}
                onChange={setAgreeMarketing}
                label="[선택] 마케팅 정보 수신 동의 (이벤트·할인쿠폰 등)"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              다음: 개인정보 수집·이용 확인
            </button>

            <p className="mt-3 text-center text-[12px] text-gray-500">
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToLogin?.();
                }}
                className="font-semibold text-orange-600 hover:underline"
              >
                로그인
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── 보조 컴포넌트 ─── */

function Field({
  label,
  required,
  hint,
  hintColor = "text-gray-500",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold tracking-tight text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className={`mt-1 text-[11px] ${hintColor}`}>{hint}</p>}
    </div>
  );
}

function InputWithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  bold,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
      />
      <span className={`flex-1 ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{label}</span>
    </label>
  );
}

function FinalConsentStep({
  agreeMarketing,
  finalConsent,
  setFinalConsent,
  loading,
  error,
  onBack,
  onConfirm,
}: {
  agreeMarketing: boolean;
  finalConsent: boolean;
  setFinalConsent: (v: boolean) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="px-7 pb-7 pt-2">
      <p className="mb-3 text-[12px] text-gray-500">
        아래 약관에 동의하시면 가입이 완료됩니다.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-[12px] text-black">
        <p className="font-semibold">보유·이용 기간</p>
        <p>회원 탈퇴 시 즉시 파기. 단, 관련 법령에 따라 다음 정보는 별도 보관됩니다.</p>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>계약·결제 기록: 5년 (전자상거래법)</li>
          <li>소비자 불만·분쟁 처리 기록: 3년</li>
          <li>접속 로그: 3개월 (통신비밀보호법)</li>
        </ul>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-[12px] text-black">
        <p className="font-semibold">제3자 제공</p>
        <p className="mt-1">
          견적 요청 시 입찰에 참여하는 사업자에게 의뢰자 이름·휴대폰번호가 제공됩니다. 동의하지 않을 권리가 있으나, 견적 요청 기능을 이용하실 수 없습니다.
        </p>
      </div>

      {agreeMarketing && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-[12px] text-black">
          <p className="font-semibold">[선택] 마케팅 정보 수신</p>
          <p className="mt-1">
            이벤트·할인쿠폰·신규 기능 안내를 이메일·SMS로 발송합니다. 마이페이지에서 언제든 수신 거부 가능합니다.
          </p>
        </div>
      )}

      <div className="mt-3 text-[11px] text-gray-500">
        자세한 사항은{" "}
        <a href="/privacy" target="_blank" className="underline hover:text-gray-700">
          개인정보처리방침
        </a>
        을 참조하세요.
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border-2 border-orange-200 bg-orange-50 p-3 hover:bg-orange-100">
        <input
          type="checkbox"
          checked={finalConsent}
          onChange={(e) => setFinalConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
        />
        <span className="text-[13px] font-semibold text-gray-900">
          위 개인정보 수집·이용·제3자 제공에 동의합니다 <span className="text-red-500">*</span>
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 rounded-full border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!finalConsent || loading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "처리 중…" : "동의 후 가입 완료"}
        </button>
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
