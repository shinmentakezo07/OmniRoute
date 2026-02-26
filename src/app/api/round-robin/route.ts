import { NextRequest, NextResponse } from "next/server";
import {
  getRoundRobinSettings,
  setRoundRobinSettings,
  getGlobalRoundRobinEnabled,
  setGlobalRoundRobinEnabled,
} from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (provider) {
      const settings = await getRoundRobinSettings(provider);
      return NextResponse.json({ settings });
    }

    const globalEnabled = await getGlobalRoundRobinEnabled();
    const allSettings = await getRoundRobinSettings();

    return NextResponse.json({
      globalEnabled,
      providerSettings: allSettings,
    });
  } catch (error: any) {
    console.error("[API] Failed to get round-robin settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, enabled, strategy, globalEnabled } = body;

    if (globalEnabled !== undefined) {
      await setGlobalRoundRobinEnabled(globalEnabled);
    }

    if (provider !== undefined && enabled !== undefined) {
      await setRoundRobinSettings(provider, enabled, strategy || "round_robin");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Failed to update round-robin settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
