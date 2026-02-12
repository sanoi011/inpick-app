"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  LogOut,
  Trash2,
  Save,
  Loader2,
  ArrowLeft,
  Lock,
} from "lucide-react";

type NotifPref = {
  bid: boolean;
  contract: boolean;
  payment: boolean;
  system: boolean;
};

const DEFAULT_NOTIF: NotifPref = {
  bid: true,
  contract: true,
  payment: true,
  system: true,
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const supabase = createClient();

  // Profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Notification prefs (stored in user_metadata)
  const [notifPref, setNotifPref] = useState<NotifPref>(DEFAULT_NOTIF);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // Auth provider
  const provider = user?.app_metadata?.provider || "email";
  const isEmailUser = provider === "email";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [authLoading, user, router]);

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
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone,
          notification_preferences: notifPref,
        },
      });
      if (error) throw error;
      toast({ type: "success", title: "프로필이 저장되었습니다" });
    } catch {
      toast({ type: "error", title: "저장 실패", message: "다시 시도해주세요" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ type: "warning", title: "비밀번호는 6자 이상이어야 합니다" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ type: "warning", title: "비밀번호가 일치하지 않습니다" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ type: "success", title: "비밀번호가 변경되었습니다" });
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ type: "error", title: "비밀번호 변경 실패" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    toast({ type: "warning", title: "계정 삭제 요청이 접수되었습니다", message: "관리자 확인 후 처리됩니다" });
    setShowDeleteConfirm(false);
    setDeleteText("");
  };

  const toggleNotif = (key: keyof NotifPref) => {
    setNotifPref((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const initials = (fullName || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">내 계정</h1>
        </div>

        {/* Section 1: Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">프로필</h2>
          </div>

          {/* Avatar + Provider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {fullName || user.email?.split("@")[0]}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  provider === "google"
                    ? "bg-red-50 text-red-700"
                    : provider === "kakao"
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <Shield className="w-3 h-3" />
                  {provider === "google" ? "Google" : provider === "kakao" ? "카카오" : "이메일"}
                </span>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={user.email || ""}
                readOnly
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            프로필 저장
          </button>
        </div>

        {/* Section 2: Notification Preferences */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">알림 설정</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: "bid" as const, label: "입찰 알림", desc: "새 입찰이 도착하면 알림을 받습니다" },
              { key: "contract" as const, label: "계약 알림", desc: "계약 관련 변경사항을 알림으로 받습니다" },
              { key: "payment" as const, label: "결제 알림", desc: "결제 관련 알림을 받습니다" },
              { key: "system" as const, label: "시스템 알림", desc: "공지사항 및 시스템 알림을 받습니다" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => toggleNotif(item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifPref[item.key] ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      notifPref[item.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            알림 설정은 프로필 저장 시 함께 저장됩니다
          </p>
        </div>

        {/* Section 3: Account Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">계정 관리</h2>
          </div>

          {/* Password change - only for email users */}
          {isEmailUser && (
            <div className="mb-6 pb-6 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900 mb-3">비밀번호 변경</h3>
              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새 비밀번호 (6자 이상)"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 확인"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  비밀번호 변경
                </button>
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>

          {/* Delete account */}
          <div>
            <h3 className="text-sm font-medium text-red-600 mb-2">계정 삭제</h3>
            <p className="text-xs text-gray-500 mb-3">
              계정을 삭제하면 모든 프로젝트, 계약, 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                계정 삭제
              </button>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800 font-medium mb-2">
                  정말 삭제하시겠습니까?
                </p>
                <p className="text-xs text-red-600 mb-3">
                  확인을 위해 &quot;삭제합니다&quot;를 입력하세요
                </p>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="삭제합니다"
                  className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteText !== "삭제합니다"}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    삭제 확인
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); }}
                    className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
