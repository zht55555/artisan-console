import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  createGenerationTask,
  GenerationServiceError,
} from "@/services/generation";

const createGenerationSchema = z.object({
  type: z.enum([
    "text_to_image",
    "image_edit",
    "text_to_video",
    "image_to_video",
  ]),
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(4000).optional(),
  style: z.string().max(120).optional(),
  size: z.string().max(40).optional(),
  sourceAssetId: z.string().max(120).optional(),
  ratio: z.enum(["9:16", "16:9"]).optional(),
  duration: z.enum(["5s", "10s"]).optional(),
  camera: z.enum(["无", "环绕", "推拉", "缩放"]).optional(),
  motionStrength: z.number().min(0).max(100).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createGenerationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

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

  let task: { taskId: string; status: "queued" | "running" | "succeeded" };
  try {
    task = await createGenerationTask(db, userId, parsed.data);
  } catch (error) {
    if (error instanceof GenerationServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          detail: error.message,
        },
        { status: error.statusCode },
      );
    }
    return jsonError(500, "create_task_failed");
  }

  return NextResponse.json(
    {
      ok: true,
      taskId: task.taskId,
      status: task.status,
    },
    { status: 201 },
  );
}
