import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generationTasks, imageAssets, videoAssets } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { queryVideoTaskWithBailian } from "@/ai/bailian-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return jsonError(503, "database_not_configured");
  }

  const { id } = await params;
  const [task] = await db
    .select()
    .from(generationTasks)
    .where(and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)))
    .limit(1);

  if (!task) {
    return jsonError(404, "task_not_found");
  }

  const type = String(task.type || "");
  const taskParams = task.params as Record<string, unknown> | null;
  const providerTaskId =
    taskParams && typeof taskParams.providerTaskId === "string"
      ? taskParams.providerTaskId
      : null;

  if (
    (type === "text_to_video" || type === "image_to_video") &&
    providerTaskId &&
    (task.status === "queued" || task.status === "running")
  ) {
    try {
      const remote = await queryVideoTaskWithBailian(providerTaskId);
      if (remote.status !== task.status) {
        await db
          .update(generationTasks)
          .set({
            status: remote.status,
            errorMessage: remote.errorMessage || null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)),
          );
      }

      if (remote.status === "succeeded" && remote.videoUrl) {
        const [existingVideo] = await db
          .select({ id: videoAssets.id })
          .from(videoAssets)
          .where(
            and(eq(videoAssets.taskId, id), eq(videoAssets.userId, userId)),
          )
          .limit(1);

        if (!existingVideo) {
          await db.insert(videoAssets).values({
            id: `video_${crypto.randomUUID()}`,
            userId,
            taskId: id,
            coverImageAssetId: null,
            url: remote.videoUrl,
            coverUrl: remote.coverUrl,
            mimeType: "video/mp4",
            durationSeconds:
              taskParams && typeof taskParams.duration === "string"
                ? Number(String(taskParams.duration).replace("s", "")) || null
                : null,
            ratio:
              taskParams && typeof taskParams.ratio === "string"
                ? taskParams.ratio
                : null,
            promptSnapshot: task.prompt,
            metadata: {
              provider: "bailian",
              raw: remote.raw,
            },
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "video_task_query_failed";
      await db
        .update(generationTasks)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(
          and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)),
        );
    }
  }

  const [freshTask] = await db
    .select()
    .from(generationTasks)
    .where(and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)))
    .limit(1);

  const assets = await db
    .select()
    .from(imageAssets)
    .where(and(eq(imageAssets.taskId, id), eq(imageAssets.userId, userId)));

  const videos =
    type === "text_to_video" || type === "image_to_video"
      ? await db
          .select()
          .from(videoAssets)
          .where(
            and(eq(videoAssets.taskId, id), eq(videoAssets.userId, userId)),
          )
      : [];

  const sourceAssetId =
    task.type === "image_edit" &&
    task.params &&
    typeof task.params === "object" &&
    "sourceAssetId" in task.params
      ? String(task.params.sourceAssetId ?? "")
      : "";

  const [sourceAsset] = sourceAssetId
    ? await db
        .select()
        .from(imageAssets)
        .where(
          and(
            eq(imageAssets.id, sourceAssetId),
            eq(imageAssets.userId, userId),
          ),
        )
        .limit(1)
    : [null];

  return NextResponse.json({
    ok: true,
    task: freshTask ?? task,
    assets,
    videos,
    sourceAsset: sourceAsset ?? null,
  });
}
