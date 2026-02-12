import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/lib/gemini-client";

export async function GET() {
  const configured = isGeminiConfigured();

  return NextResponse.json({
    status: configured ? "configured" : "mock",
    message: configured
      ? "Gemini API가 설정되어 있습니다."
      : "Gemini API 키가 설정되지 않았습니다. Mock 모드로 동작합니다.",
  });
}
