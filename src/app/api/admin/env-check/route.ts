import { NextRequest, NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/api-helpers";
import { isAdminAuthorized } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const status = getEnvStatus();
  return NextResponse.json(status);
}
