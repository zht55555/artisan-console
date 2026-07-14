import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { clearVideoTasks } from "@/lib/video-task-store";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST() {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) return jsonError(401, "unauthorized");

  clearVideoTasks(userId);
  return NextResponse.json({ ok: true });
}
