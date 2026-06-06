import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generationTasks, imageAssets } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";

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

  const assets = await db
    .select()
    .from(imageAssets)
    .where(and(eq(imageAssets.taskId, id), eq(imageAssets.userId, userId)));

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
    task,
    assets,
    sourceAsset: sourceAsset ?? null,
  });
}
