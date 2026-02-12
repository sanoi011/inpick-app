"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AdminAuth {
  adminId: string | null;
  adminEmail: string | null;
  adminName: string | null;
  authChecked: boolean;
  logout: () => void;
}

export function useAdminAuth(): AdminAuth {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const id = localStorage.getItem("admin_id");
    const email = localStorage.getItem("admin_email");
    const name = localStorage.getItem("admin_name");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAdminId(id);
    setAdminEmail(email);
    setAdminName(name);
    setAuthChecked(true);
  }, [router]);

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_role");
    router.replace("/admin/login");
  };

  return { adminId, adminEmail, adminName, authChecked, logout };
}
