import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/api-helpers";

export async function GET() {
  const status = getEnvStatus();
  return NextResponse.json(status);
}
