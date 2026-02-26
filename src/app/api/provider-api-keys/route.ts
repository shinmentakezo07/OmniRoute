import { NextRequest, NextResponse } from "next/server";
import {
  getProviderApiKeys,
  createProviderApiKey,
  getGlobalRoundRobinEnabled,
  setGlobalRoundRobinEnabled,
} from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const connectionId = searchParams.get("connectionId");

    const filter: any = {};
    if (provider) filter.provider = provider;
    if (connectionId) filter.connectionId = connectionId;

    const keys = await getProviderApiKeys(filter);
    return NextResponse.json({ keys });
  } catch (error: any) {
    console.error("[API] Failed to get provider API keys:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, connectionId, apiKey, name, priority, isActive } = body;

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 });
    }

    const newKey = await createProviderApiKey({
      provider,
      connectionId,
      apiKey,
      name,
      priority,
      isActive,
    });

    return NextResponse.json({ key: newKey });
  } catch (error: any) {
    console.error("[API] Failed to create provider API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
