import { NextRequest, NextResponse } from "next/server";

// This imports the mutable module-level cache from the parent route
// In production, use a database instead
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Note: module-level state doesn't share across route files in Next.js
  // This is a stub — the client optimistically updates, and a real DB would persist this
  const body = await req.json();
  return NextResponse.json({ ok: true, id: params.id, ...body });
}
