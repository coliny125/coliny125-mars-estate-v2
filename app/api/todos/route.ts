import { NextRequest, NextResponse } from "next/server";
import { todoStore } from "@/lib/storage";
import type { Priority } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ todos: todoStore.list() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  const priority = (body.priority ?? "M") as Priority;
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const todo = todoStore.add(text, priority);
  return NextResponse.json({ todo }, { status: 201 });
}
