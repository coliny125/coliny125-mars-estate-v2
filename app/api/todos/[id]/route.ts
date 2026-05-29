import { NextRequest, NextResponse } from "next/server";
import { todoStore } from "@/lib/storage";
import { getUserId } from "@/lib/auth-util";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const body = await req.json();
  const updated = await todoStore.update(auth.userId, params.id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ todo: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const deleted = await todoStore.delete(auth.userId, params.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
