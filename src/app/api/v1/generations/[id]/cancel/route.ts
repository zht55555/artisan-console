import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generationTasks } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canTransitionStatus,
  parseGenerationStatus,
} from "@/lib/generation-status";

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

  const current = parseGenerationStatus(task.status);
  if (!canTransitionStatus(current, "canceled")) {
    return jsonError(409, "invalid_status_transition");
  }

  await db
    .update(generationTasks)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(and(eq(generationTasks.id, id), eq(generationTasks.userId, userId)));

  return NextResponse.json({
    ok: true,
    taskId: id,
    status: "canceled",
  });
}
