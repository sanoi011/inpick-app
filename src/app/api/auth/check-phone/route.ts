import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// 010XXXXYYYY 형식으로 정규화 (하이픈/공백 제거)
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export async function POST(req: NextRequest) {
  let phone: string | undefined;
  try {
    const body = await req.json();
    phone = body?.phone;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }
  const normalized = normalizePhone(phone);
  if (!/^01[016789]\d{7,8}$/.test(normalized)) {
    return NextResponse.json({ error: "invalid phone format" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("consumer_profiles")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle();

  if (error) {
    console.error("[check-phone] query error:", error.message);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  return NextResponse.json({ available: !data, phone: normalized });
}
