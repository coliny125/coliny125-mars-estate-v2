import { NextResponse } from "next/server";
import { threadStore } from "@/lib/storage";
import { getUserId } from "@/lib/auth-util";

export async function GET() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const threads = await threadStore.list(auth.userId);
  return NextResponse.json({ threads });
}

export async function POST() {
  const auth = getUserId();
  if (auth.error) return auth.error;
  const thread = await threadStore.create(auth.userId);
  return NextResponse.json({ thread }, { status: 201 });
}
