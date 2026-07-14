import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getVideoTask, refreshVideoTaskStatus } from "@/lib/video-task-store";
import { queryVideoTaskWithBailian } from "@/ai/bailian-video";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) return jsonError(401, "unauthorized");

  const { id } = await params;
  const task = getVideoTask(userId, id);
  const url = new URL(request.url);
  const providerTaskIdFromQuery = url.searchParams.get("providerTaskId") || "";

  try {
    if (task) {
      const fresh = await refreshVideoTaskStatus(task);
      return NextResponse.json({ ok: true, task: fresh });
    }

    // Fallback for dev/hot-reload or restarted process in no-DB mode:
    // if in-memory task is gone but client still has providerTaskId, query provider directly.
    if (providerTaskIdFromQuery) {
      const remote = await queryVideoTaskWithBailian(providerTaskIdFromQuery);
      return NextResponse.json({
        ok: true,
        task: {
          id,
          userId,
          mode: "text_to_video",
          prompt: "",
          providerTaskId: providerTaskIdFromQuery,
          status: remote.status,
          ratio: undefined,
          duration: undefined,
          camera: undefined,
          style: undefined,
          motionStrength: undefined,
          sourceImageUrl: undefined,
          videoUrl: remote.videoUrl,
          coverUrl: remote.coverUrl,
          errorMessage: remote.errorMessage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return jsonError(404, "task_not_found");
  } catch (error) {
    return jsonError(
      502,
      error instanceof Error ? error.message : "video_task_query_failed",
    );
  }
}
