import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { name, subject, email, phone, question } = await request.json();

    if (!name || !email || !question) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
    }

    const supabase = createClient();

    const { error } = await supabase.from("contact_inquiries").insert({
      name,
      subject: subject || null,
      email,
      phone: phone || null,
      message: question,
      status: "pending",
    });

    if (error) {
      // 테이블이 없으면 무시 (mailto 폴백)
      console.error("Contact save error:", error);
    }

    return NextResponse.json({ success: true, message: "문의가 접수되었습니다" });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json({ error: "문의 접수 중 오류가 발생했습니다" }, { status: 500 });
  }
}
