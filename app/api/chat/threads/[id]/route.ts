import { NextRequest, NextResponse } from "next/server";
import { threadStore } from "@/lib/storage";
import { getUserId } from "@/lib/auth-util";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const thread = await threadStore.get(auth.userId, params.id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ messages: thread.messages });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const deleted = await threadStore.delete(auth.userId, params.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
