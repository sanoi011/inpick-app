"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { User, Mail, Phone, Shield, Bell, LogOut, Trash2, Save, Loader2, Lock } from "lucide-react";

type NotifPref = { bid: boolean; contract: boolean; payment: boolean; system: boolean };
const DEFAULT_NOTIF: NotifPref = { bid: true, contract: true, payment: true, system: true };

export default function MyPageAccount() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifPref, setNotifPref] = useState<NotifPref>(DEFAULT_NOTIF);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const provider = user?.user_metadata?.provider || user?.app_metadata?.provider || "email";
  const isEmailUser = provider === "email";

  const providerLabel: Record<string, { label: string; cls: string }> = {
    google: { label: "Google", cls: "bg-[#f4f4f2] text-black/60" },
    kakao: { label: "카카오", cls: "bg-[#f4f4f2] text-black/60" },
    naver: { label: "네이버", cls: "bg-[#f4f4f2] text-black/60" },
    apple: { label: "Apple", cls: "bg-[#0d0d0d] text-white" },
    email: { label: "이메일", cls: "bg-[#f4f4f2] text-black/60" },
  };
  const providerInfo = providerLabel[provider] ?? providerLabel.email;

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setPhone(user.user_metadata?.phone || user.phone || "");
      setNotifPref(user.user_metadata?.notification_preferences || DEFAULT_NOTIF);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, phone, notification_preferences: notifPref } });
      if (error) throw error;
      toast({ type: "success", title: "프로필이 저장되었습니다" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "다시 시도해주세요";
      toast({ type: "error", title: "저장 실패", message: msg });
    }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast({ type: "warning", title: "비밀번호는 6자 이상이어야 합니다" }); return; }
    if (newPassword !== confirmPassword) { toast({ type: "warning", title: "비밀번호가 일치하지 않습니다" }); return; }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ type: "success", title: "비밀번호가 변경되었습니다" });
      setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "다시 시도해주세요";
      toast({ type: "error", title: "비밀번호 변경 실패", message: msg });
    }
    finally { setChangingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
      const data = await res.json();
      if (!res.ok) { toast({ type: "error", title: "계정 삭제 실패", message: data.error || "다시 시도해주세요" }); return; }
      if (data.pending) toast({ type: "warning", title: data.message });
      else toast({ type: "success", title: data.message });
      setShowDeleteConfirm(false); setDeleteText("");
      await signOut(); router.push("/");
    } catch { toast({ type: "error", title: "계정 삭제 중 오류가 발생했습니다" }); }
    finally { setDeleting(false); }
  };

  const toggleNotif = (key: keyof NotifPref) => setNotifPref((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!user) return null;

  const initials = (fullName || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <div className="mb-7">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">ACCOUNT</p>
        <h1 className="mt-2 text-[30px] font-medium tracking-[-0.055em] sm:text-[36px]">내 계정</h1>
        <p className="mt-2 text-sm text-black/45">프로필과 로그인, 알림 설정을 관리합니다.</p>
      </div>

      {/* 프로필 */}
      <div className="mb-5 rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-2"><User className="h-5 w-5 text-black/65" strokeWidth={1.7} /><h2 className="text-lg font-medium tracking-[-0.03em]">프로필</h2></div>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0d0d0d] text-xl font-semibold text-white">{initials}</div>
          <div>
            <p className="text-sm font-medium">{fullName || user.email?.split("@")[0]}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${providerInfo.cls}`}>
              <Shield className="w-3 h-3" />{providerInfo.label}
            </span>
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-black/55">이름</label>
          <div className="relative"><User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="이름을 입력하세요" className="w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/45" />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-black/55">이메일</label>
          <div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input type="email" value={user.email || ""} readOnly className="w-full cursor-not-allowed rounded-xl border border-black/[0.06] bg-[#f7f7f5] py-3 pl-10 pr-4 text-sm text-black/45" />
          </div>
        </div>
        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-black/55">전화번호</label>
          <div className="relative"><Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/45" />
          </div>
        </div>
        <button onClick={handleSaveProfile} disabled={saving} className="flex h-10 items-center gap-2 rounded-full bg-[#0d0d0d] px-5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}프로필 저장
        </button>
      </div>

      {/* 알림 설정 */}
      <div className="mb-5 rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-2"><Bell className="h-5 w-5 text-black/65" strokeWidth={1.7} /><h2 className="text-lg font-medium tracking-[-0.03em]">알림 설정</h2></div>
        <div className="space-y-4">
          {([
            { key: "bid" as const, label: "입찰 알림", desc: "새 입찰이 도착하면 알림을 받습니다" },
            { key: "contract" as const, label: "계약 알림", desc: "계약 관련 변경사항을 알림으로 받습니다" },
            { key: "payment" as const, label: "결제 알림", desc: "결제 관련 알림을 받습니다" },
            { key: "system" as const, label: "시스템 알림", desc: "공지사항 및 시스템 알림을 받습니다" },
          ]).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f7f5] px-4 py-3">
              <div><p className="text-sm font-medium">{item.label}</p><p className="mt-0.5 text-xs text-black/43">{item.desc}</p></div>
              <button aria-label={`${item.label} ${notifPref[item.key] ? "끄기" : "켜기"}`} onClick={() => toggleNotif(item.key)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${notifPref[item.key] ? "bg-[#0d0d0d]" : "bg-black/15"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${notifPref[item.key] ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-black/35">알림 설정은 프로필 저장 시 함께 저장됩니다</p>
      </div>

      {/* 계정 관리 */}
      <div className="rounded-[24px] border border-black/[0.07] bg-white p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-2"><Shield className="h-5 w-5 text-black/65" strokeWidth={1.7} /><h2 className="text-lg font-medium tracking-[-0.03em]">계정 관리</h2></div>
        {isEmailUser && (
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-3">비밀번호 변경</h3>
            <div className="space-y-3">
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="새 비밀번호 (6자 이상)" className="w-full rounded-xl border border-black/10 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/45" />
              </div>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호 확인" className="w-full rounded-xl border border-black/10 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/45" />
              </div>
              <button onClick={handleChangePassword} disabled={changingPassword || !newPassword} className="flex items-center gap-2 rounded-full bg-[#f4f4f2] px-4 py-2 text-sm font-medium text-black/70 transition hover:bg-[#e9e9e5] disabled:opacity-40">
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}비밀번호 변경
              </button>
            </div>
          </div>
        )}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><LogOut className="w-4 h-4" />로그아웃</button>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-600 mb-2">계정 삭제</h3>
          <p className="text-xs text-gray-500 mb-3">계정을 삭제하면 모든 프로젝트, 계약, 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" />계정 삭제</button>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800 font-medium mb-2">정말 삭제하시겠습니까?</p>
              <p className="text-xs text-red-600 mb-3">확인을 위해 &quot;삭제합니다&quot;를 입력하세요</p>
              <input type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="삭제합니다" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500" />
              <div className="flex gap-2">
                <button onClick={handleDeleteAccount} disabled={deleteText !== "삭제합니다" || deleting} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}{deleting ? "삭제 중..." : "삭제 확인"}
                </button>
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }} className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">취소</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
