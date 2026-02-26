import { NextRequest, NextResponse } from "next/server";
import { queryRequestAttempts, getAttemptStats, getRequestAttempts } from "@/lib/localDb";

/**
 * GET /api/request-attempts
 * Query request attempts with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    // If requestId provided, return all attempts for that request
    if (requestId) {
      const attempts = getRequestAttempts(requestId);
      return NextResponse.json({ attempts });
    }

    // Otherwise, query with filters
    const filters: any = {};
    if (searchParams.get("model")) filters.model = searchParams.get("model");
    if (searchParams.get("provider")) filters.provider = searchParams.get("provider");
    if (searchParams.get("status")) filters.status = parseInt(searchParams.get("status")!);
    if (searchParams.get("skipped")) filters.skipped = searchParams.get("skipped") === "true";
    if (searchParams.get("comboName")) filters.comboName = searchParams.get("comboName");
    if (searchParams.get("limit")) filters.limit = parseInt(searchParams.get("limit")!);

    const attempts = queryRequestAttempts(filters);
    return NextResponse.json({ attempts });
  } catch (error: any) {
    console.error("[request-attempts] Query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
