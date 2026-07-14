import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { deleteVideoTask, getVideoTask } from "@/lib/video-task-store";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) return jsonError(401, "unauthorized");

  const { id } = await params;
  const existing = getVideoTask(userId, id);
  if (!existing) return jsonError(404, "task_not_found");

  deleteVideoTask(userId, id);
  return NextResponse.json({ ok: true, taskId: id });
}
