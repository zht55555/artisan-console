import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  createGenerationTask,
  GenerationServiceError,
} from "@/services/generation";

const createEditSchema = z.object({
  sourceAssetId: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(4000).optional(),
  style: z.string().max(120).optional(),
  size: z.string().max(40).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createEditSchema.safeParse(payload);

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

  try {
    const task = await createGenerationTask(db, userId, {
      type: "image_edit",
      prompt: parsed.data.prompt,
      negativePrompt: parsed.data.negativePrompt,
      style: parsed.data.style,
      size: parsed.data.size,
      sourceAssetId: parsed.data.sourceAssetId,
    });

    return NextResponse.json(
      {
        ok: true,
        taskId: task.taskId,
        status: task.status,
        sourceAssetId: parsed.data.sourceAssetId,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GenerationServiceError) {
      return jsonError(error.statusCode, error.code);
    }
    return jsonError(500, "create_edit_failed");
  }
}
