import { NextResponse } from "next/server";
import { isOpenAIConfigured } from "@/lib/openai-client";

export async function GET() {
  const configured = isOpenAIConfigured();

  return NextResponse.json({
    status: configured ? "configured" : "mock",
    message: configured
      ? "AI API가 설정되어 있습니다."
      : "AI API 키가 설정되지 않았습니다. Mock 모드로 동작합니다.",
  });
}
