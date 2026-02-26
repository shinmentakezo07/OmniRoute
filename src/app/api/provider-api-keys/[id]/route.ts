import { NextRequest, NextResponse } from "next/server";
import { getProviderApiKeyById, updateProviderApiKey, deleteProviderApiKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const key = await getProviderApiKeyById(params.id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ key });
  } catch (error: any) {
    console.error("[API] Failed to get provider API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const updated = await updateProviderApiKey(params.id, body);

    if (!updated) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ key: updated });
  } catch (error: any) {
    console.error("[API] Failed to update provider API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = await deleteProviderApiKey(params.id);
    if (!success) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Failed to delete provider API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
