import { NextResponse } from "next/server";
import { threadStore } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ threads: threadStore.list() });
}

export async function POST() {
  const thread = threadStore.create();
  return NextResponse.json({ thread }, { status: 201 });
}
