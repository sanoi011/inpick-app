/**
 * Party resolver — consumer / contractor 정보 → snapshot.
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §6
 *
 * 우선순위 (consumer):
 *   1. consumer_projects.contact_snapshot / metadata
 *   2. auth.users.user_metadata
 *   3. profiles / user_profiles (테이블 있으면)
 *   4. 누락 시 displayName="(미입력)"
 *
 * 우선순위 (contractor):
 *   1. contractor_profiles
 *   2. specialty_contractors
 *   3. contractors 공개 디렉토리
 *   4. auth.users.user_metadata
 */

import { createClient } from "@supabase/supabase-js";
import type { EstimateDocumentMode, EstimatePartySnapshot } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── 마스킹 헬퍼 ───
function maskName(name?: string): string | undefined {
  if (!name) return undefined;
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskEmail(email?: string): string | undefined {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const maskedLocal =
    local.length <= 2 ? local[0] + "*" : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

function maskDetailedAddress(address?: string): string | undefined {
  if (!address) return undefined;
  // "서울특별시 강남구 ... 101동 2104호" → "서울특별시 강남구 ... ***동 ****호"
  return address
    .replace(/\d+동/g, "***동")
    .replace(/\d+호/g, "****호")
    .replace(/\d+층/g, "**층");
}

// ─── Consumer resolver ───
export async function resolveConsumerPartySnapshot(input: {
  projectId: string;
  consumerId: string;
  mode: EstimateDocumentMode;
}): Promise<EstimatePartySnapshot> {
  const admin = getAdmin();
  let snap: EstimatePartySnapshot = {
    role: "consumer",
    userId: input.consumerId,
    displayName: "(미입력)",
  };

  if (!admin) return snap;

  // 1. consumer_projects metadata
  try {
    const { data: project } = await admin
      .from("consumer_projects")
      .select("contact_snapshot, metadata, user_id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (project) {
      const meta = ((project as { contact_snapshot?: Record<string, unknown> }).contact_snapshot ||
        (project as { metadata?: Record<string, unknown> }).metadata ||
        {}) as Record<string, unknown>;
      if (meta.displayName || meta.name) snap.displayName = String(meta.displayName || meta.name);
      if (meta.phone) snap.phone = String(meta.phone);
      if (meta.email) snap.email = String(meta.email);
      if (meta.address) snap.address = String(meta.address);
    }
  } catch {
    /* 무시 */
  }

  // 2. auth.users
  if (snap.displayName === "(미입력)" || !snap.email) {
    try {
      const { data: userResult } = await admin.auth.admin.getUserById(input.consumerId);
      if (userResult?.user) {
        const u = userResult.user;
        if (snap.displayName === "(미입력)") {
          snap.displayName =
            (u.user_metadata as { name?: string } | null)?.name ||
            u.email ||
            "(미입력)";
        }
        if (!snap.email) snap.email = u.email;
        if (!snap.phone) {
          snap.phone = (u.user_metadata as { phone?: string } | null)?.phone;
        }
      }
    } catch {
      /* 무시 */
    }
  }

  // 3. 마스킹 (contractor_bid mode)
  if (input.mode === "contractor_bid") {
    snap = {
      ...snap,
      displayName: maskName(snap.displayName) || snap.displayName,
      phone: maskPhone(snap.phone),
      email: maskEmail(snap.email),
      address: maskDetailedAddress(snap.address),
      isMasked: true,
    };
  }

  return snap;
}

// ─── Contractor resolver ───
export async function resolveContractorPartySnapshot(input: {
  contractorId: string;
  userId?: string;
}): Promise<EstimatePartySnapshot> {
  const admin = getAdmin();
  let snap: EstimatePartySnapshot = {
    role: "contractor",
    contractorId: input.contractorId,
    displayName: "(상호 미입력)",
  };
  if (!admin) return snap;

  // 1. contractor_profiles
  try {
    const { data: profile } = await admin
      .from("contractor_profiles")
      .select("company_name, ceo_name, business_registration_no, phone, email, address, license_no")
      .eq("contractor_id", input.contractorId)
      .maybeSingle();
    if (profile) {
      const p = profile as Record<string, unknown>;
      if (p.company_name) {
        snap.companyName = String(p.company_name);
        snap.displayName = String(p.company_name);
      }
      if (p.ceo_name) snap.ceoName = String(p.ceo_name);
      if (p.business_registration_no) snap.businessRegistrationNo = String(p.business_registration_no);
      if (p.phone) snap.phone = String(p.phone);
      if (p.email) snap.email = String(p.email);
      if (p.address) snap.address = String(p.address);
      if (p.license_no) snap.licenseNo = String(p.license_no);
    }
  } catch {
    /* 무시 */
  }

  // 2. specialty_contractors fallback
  if (snap.displayName === "(상호 미입력)") {
    try {
      const { data: spec } = await admin
        .from("specialty_contractors")
        .select("company_name, rating, contractor_trades(trade_name)")
        .eq("id", input.contractorId)
        .maybeSingle();
      if (spec) {
        const s = spec as Record<string, unknown>;
        if (s.company_name) {
          snap.companyName = String(s.company_name);
          snap.displayName = String(s.company_name);
        }
      }
    } catch {
      /* 무시 */
    }
  }

  return snap;
}

/**
 * InPick 회사 정보 스냅샷 (Footer/공급자 표시용).
 */
export function resolveInPickPartySnapshot(): EstimatePartySnapshot {
  return {
    role: "inpick",
    displayName: "InPick (인픽)",
    companyName: "InPick",
    ceoName: "김선본",
    address: "대전광역시",
    email: "tjsqhs011@gmail.com",
  };
}
