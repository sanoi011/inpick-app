import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  BUSINESS_INQUIRY_TYPES,
  type BusinessInquiryType,
} from "@/lib/business-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const INQUIRY_EMAIL = process.env.BUSINESS_INQUIRY_EMAIL || "lookingseon@aiod.kr";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function isRateLimited(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || now >= current.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}

async function sendInquiryEmail(input: {
  inquiryTypeLabel: string;
  companyName: string;
  registrationNo: string;
  address: string;
  contactEmail: string;
  message: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BUSINESS_INQUIRY_FROM;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [INQUIRY_EMAIL],
      reply_to: input.contactEmail,
      subject: `[INPICK 비즈니스 문의] ${input.inquiryTypeLabel} · ${input.companyName}`,
      html: `
        <h2>INPICK 비즈니스 문의</h2>
        <p><b>신청 유형</b>: ${escapeHtml(input.inquiryTypeLabel)}</p>
        <p><b>사업자명</b>: ${escapeHtml(input.companyName)}</p>
        <p><b>사업자등록번호</b>: ${escapeHtml(input.registrationNo)}</p>
        <p><b>사업장 주소</b>: ${escapeHtml(input.address)}</p>
        <p><b>회신 이메일</b>: ${escapeHtml(input.contactEmail)}</p>
        <hr />
        <p>${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
      `,
    }),
  });
  if (!response.ok) {
    console.warn("[business-inquiries] email delivery failed", response.status, (await response.text()).slice(0, 160));
  }
  return response.ok;
}

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: "문의가 너무 빠르게 반복됐습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const inquiryType = clean(body.inquiryType, 40) as BusinessInquiryType;
  const companyName = clean(body.companyName, 200);
  const registrationNo = clean(body.businessRegistrationNo, 20);
  const registrationDigits = registrationNo.replace(/\D/g, "");
  const address = clean(body.businessAddress, 500);
  const contactEmail = clean(body.contactEmail, 200).toLowerCase();
  const message = clean(body.message, 4_000);
  const validTypes = BUSINESS_INQUIRY_TYPES.map((item) => item.value) as readonly string[];

  if (!validTypes.includes(inquiryType) || !companyName || !address || !message) {
    return NextResponse.json({ error: "필수 항목을 확인해주세요." }, { status: 400 });
  }
  if (registrationDigits.length !== 10) {
    return NextResponse.json({ error: "사업자등록번호 10자리를 확인해주세요." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "회신받을 이메일을 확인해주세요." }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "문의 접수 서비스가 준비되지 않았습니다." }, { status: 503 });

  const { data, error } = await admin
    .from("business_inquiries")
    .insert({
      inquiry_type: inquiryType,
      company_name: companyName,
      business_registration_no: registrationDigits,
      business_address: address,
      contact_email: contactEmail,
      message,
      source: "business_page",
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[business-inquiries] insert", error);
    return NextResponse.json({ error: "문의를 저장하지 못했습니다. 관리자에게 연락해주세요." }, { status: 500 });
  }

  const typeLabel = BUSINESS_INQUIRY_TYPES.find((item) => item.value === inquiryType)?.label || inquiryType;
  const emailDelivered = await sendInquiryEmail({
    inquiryTypeLabel: typeLabel,
    companyName,
    registrationNo: registrationDigits,
    address,
    contactEmail,
    message,
  }).catch((emailError) => {
    console.warn("[business-inquiries] email error", emailError);
    return false;
  });

  return NextResponse.json({ ok: true, inquiryId: data.id, createdAt: data.created_at, emailDelivered });
}
