import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export function getUserId():
  | { userId: string; error?: never }
  | { userId?: never; error: NextResponse } {
  const { userId } = auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId };
}
