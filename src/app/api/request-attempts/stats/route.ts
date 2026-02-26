import { NextRequest, NextResponse } from "next/server";
import { getAttemptStats } from "@/lib/localDb";

/**
 * GET /api/request-attempts/stats
 * Get aggregated statistics for request attempts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: any = {};

    if (searchParams.get("model")) filters.model = searchParams.get("model");
    if (searchParams.get("comboName")) filters.comboName = searchParams.get("comboName");

    const stats = getAttemptStats(filters);
    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("[request-attempts/stats] Query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
