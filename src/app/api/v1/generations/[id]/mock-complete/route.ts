import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generationTasks, imageAssets } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getSourceAssetId(params: unknown): string | null {
  if (!params || typeof params !== "object") {
    return null;
  }
  if (!("sourceAssetId" in params)) {
    return null;
  }
  const value = (params as Record<string, unknown>).sourceAssetId;
  if (!value) {
    return null;
  }
  return String(value);
}

export async function POST(
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

  if (!["queued", "running"].includes(task.status)) {
    return jsonError(409, "invalid_status_transition");
  }

  const sourceAssetId = getSourceAssetId(task.params);

  await db
    .update(generationTasks)
    .set({
      status: "succeeded",
      updatedAt: new Date(),
    })
    .where(and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)));

  const assetId = `asset_${crypto.randomUUID()}`;

  await db.insert(imageAssets).values({
    id: assetId,
    userId,
    taskId: id,
    parentAssetId: sourceAssetId,
    url: `https://placehold.co/1024x1024/png?text=${encodeURIComponent(task.type)}`,
    width: 1024,
    height: 1024,
    mimeType: "image/png",
    promptSnapshot: task.prompt,
    metadata: {
      mock: true,
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    taskId: id,
    status: "succeeded",
    assetId,
    parentAssetId: sourceAssetId,
  });
}
