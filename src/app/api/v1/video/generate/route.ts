import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { submitVideoTaskWithBailian } from "@/ai/bailian-video";
import { putVideoTask } from "@/lib/video-task-store";

const allowedCameras = ["无", "环绕", "推拉", "缩放"] as const;
const allowedStyles = ["电影感", "写实", "动漫", "赛博朋克"] as const;

function toCamera(value: string | undefined) {
  if (!value) return undefined;
  return allowedCameras.includes(value as (typeof allowedCameras)[number])
    ? (value as (typeof allowedCameras)[number])
    : undefined;
}

function toStyle(value: string | undefined) {
  if (!value) return undefined;
  return allowedStyles.includes(value as (typeof allowedStyles)[number])
    ? (value as (typeof allowedStyles)[number])
    : undefined;
}

const schema = z.object({
  mode: z.enum(["text_to_video", "image_to_video"]),
  prompt: z.string().min(1).max(4000),
  ratio: z.enum(["9:16", "16:9"]).optional(),
  duration: z.enum(["5s", "10s"]).optional(),
  camera: z.string().trim().max(32).optional(),
  style: z.string().trim().max(32).optional(),
  motionStrength: z.number().min(0).max(100).optional(),
  sourceImageUrl: z.string().max(2000000).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) return jsonError(401, "unauthorized");

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.mode === "image_to_video" && !input.sourceImageUrl) {
    return jsonError(400, "source_image_url_required");
  }

  try {
    const camera = toCamera(input.camera);
    const style = toStyle(input.style);

    const submitted = await submitVideoTaskWithBailian({
      type: input.mode,
      prompt: input.prompt,
      ratio: input.ratio,
      duration: input.duration,
      camera,
      style,
      motionStrength: input.motionStrength,
      sourceImageUrl: input.sourceImageUrl,
    });

    const taskId = `video_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    putVideoTask({
      id: taskId,
      userId,
      mode: input.mode,
      prompt: input.prompt,
      providerTaskId: submitted.providerTaskId,
      status: "running",
      ratio: input.ratio,
      duration: input.duration,
      camera,
      style,
      motionStrength: input.motionStrength,
      sourceImageUrl: input.sourceImageUrl,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      taskId,
      status: "running",
      providerTaskId: submitted.providerTaskId,
    });
  } catch (error) {
    return jsonError(
      502,
      error instanceof Error ? error.message : "video_submit_failed",
    );
  }
}
