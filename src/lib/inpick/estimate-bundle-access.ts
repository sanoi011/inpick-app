import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeEstimateAccessId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return id;
}

export async function hasEstimateBundleAccess(
  userId: string,
  accessId: string,
): Promise<boolean> {
  const marker = `estimate-details:${accessId}`;
  const admin = createAdminClient();
  const { data } = await admin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "USE")
    .like("description", `%${marker}%`)
    .limit(1);
  return (data?.length || 0) > 0;
}
