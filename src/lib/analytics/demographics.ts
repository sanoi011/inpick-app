/**
 * 로그인 제공사별 인구통계 수집 — user_demographics upsert.
 *
 * provider별 데이터 가용성:
 *  - google/apple : 성별·연령 미제공 → provider만 기록
 *  - kakao        : kakao_account.age_range/gender (동의항목 승인 시)
 *  - naver        : gender/birthyear/age (검수 승인 시) — 콜백에서 직접 전달
 *
 * 어떤 provider든 최소 provider는 기록해 대시보드 집계(GROUP BY provider)를 가능케 한다.
 * PII 원칙: 성별·연령대·출생연도는 통계용 저해상도 값만 저장(생일 전체·주소 등은 저장 안 함).
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

export interface DemographicInput {
  gender?: "male" | "female" | null;
  ageRange?: string | null;
  birthyear?: number | null;
  source?: string | null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 카카오 age_range('20~29' 또는 '20-29') 등을 '20~29'로 정규화 */
function normalizeAgeRange(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const m = raw.match(/(\d{1,3})\s*[~\-–]\s*(\d{1,3})/);
  if (m) return `${m[1]}~${m[2]}`;
  const single = raw.match(/(\d{1,3})/);
  if (single) {
    const base = Math.floor(Number(single[1]) / 10) * 10;
    return `${base}~${base + 9}`;
  }
  return null;
}

function normalizeGender(raw: unknown): "male" | "female" | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase();
  if (["male", "m", "man", "남", "남성"].includes(v)) return "male";
  if (["female", "f", "woman", "여", "여성"].includes(v)) return "female";
  return null;
}

/** Supabase identities의 identity_data에서 provider별 인구통계 추출 */
export function extractDemographicsFromIdentity(
  provider: string,
  identityData: Record<string, unknown> | null | undefined,
): DemographicInput {
  if (!identityData) return {};
  if (provider === "kakao") {
    // Supabase가 kakao_account를 평탄화하는 경우와 중첩하는 경우 모두 대응
    const acct = (identityData.kakao_account ?? identityData) as Record<string, unknown>;
    return {
      gender: normalizeGender(acct.gender),
      ageRange: normalizeAgeRange(acct.age_range),
      birthyear: typeof acct.birthyear === "string" ? Number(acct.birthyear) || null : null,
      source: "kakao",
    };
  }
  return {};
}

/**
 * provider(+선택적 인구통계)를 user_demographics에 upsert.
 * demo가 비어도 provider는 항상 갱신. 실패해도 로그인 흐름을 막지 않는다(throw 안 함).
 */
export async function upsertUserDemographics(
  userId: string,
  provider: string,
  demo: DemographicInput = {},
): Promise<void> {
  const admin = serviceClient();
  if (!admin) return;

  const row: Record<string, unknown> = {
    user_id: userId,
    provider: provider || "email",
    updated_at: new Date().toISOString(),
  };
  // 값이 있을 때만 덮어쓴다(다른 로그인에서 채운 값을 null로 지우지 않도록)
  if (demo.gender) row.gender = demo.gender;
  if (demo.ageRange) row.age_range = demo.ageRange;
  if (demo.birthyear) row.birthyear = demo.birthyear;
  if (demo.source) row.demo_source = demo.source;

  const { error } = await admin
    .from("user_demographics")
    .upsert(row, { onConflict: "user_id" });
  if (error) console.error("[demographics] upsert error:", error.message);
}
