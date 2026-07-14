"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ContractorAuth {
  contractorId: string | null;
  contractorName: string | null;
  authChecked: boolean;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function useContractorAuth(): ContractorAuth {
  const router = useRouter();
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [contractorName, setContractorName] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("contractor_token");
    const id = localStorage.getItem("contractor_id");
    const name = localStorage.getItem("contractor_name");
    if (!token) {
      router.replace("/contractor/login");
      return;
    }
    setContractorId(id);
    setContractorName(name);
    setAuthChecked(true);
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("contractor_token");
    localStorage.removeItem("contractor_id");
    localStorage.removeItem("contractor_name");
    router.replace("/contractor/login");
  }, [router]);

  const authFetch = useCallback((url: string, options?: RequestInit): Promise<Response> => {
    const token = localStorage.getItem("contractor_token");
    const headers = new Headers(options?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }, []);

  return { contractorId, contractorName, authChecked, logout, authFetch };
}
