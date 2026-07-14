import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { listVideoTasks } from "@/lib/video-task-store";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) return jsonError(401, "unauthorized");

  return NextResponse.json({
    ok: true,
    items: listVideoTasks(userId),
  });
}
