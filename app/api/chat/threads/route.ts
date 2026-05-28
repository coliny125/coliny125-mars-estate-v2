import { NextResponse } from "next/server";
import { threadStore } from "@/lib/storage";

export async function GET() {
  const threads = await threadStore.list();
  return NextResponse.json({ threads });
}

export async function POST() {
  const thread = await threadStore.create();
  return NextResponse.json({ thread }, { status: 201 });
}
