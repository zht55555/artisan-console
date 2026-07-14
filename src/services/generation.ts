import { and, eq } from "drizzle-orm";
import { imageAssets, generationTasks, videoAssets } from "@/db/schema";
import { getDb } from "@/db";
import { generateImageWithBailian } from "@/ai/bailian-image";
import { submitVideoTaskWithBailian } from "@/ai/bailian-video";

const allowedVideoStyles = ["电影感", "写实", "动漫", "赛博朋克"] as const;
type VideoStyle = (typeof allowedVideoStyles)[number];

function toVideoStyle(value: string | undefined): VideoStyle | undefined {
  if (!value) return undefined;
  return allowedVideoStyles.includes(value as VideoStyle)
    ? (value as VideoStyle)
    : undefined;
}

export type GenerationInput = {
  type: "text_to_image" | "image_edit" | "text_to_video" | "image_to_video";
  prompt: string;
  negativePrompt?: string;
  style?: string;
  size?: string;
  sourceAssetId?: string;
  ratio?: "9:16" | "16:9";
  duration?: "5s" | "10s";
  camera?: "无" | "环绕" | "推拉" | "缩放";
  motionStrength?: number;
};

export class GenerationServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = "GenerationServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function createGenerationTask(
  db: ReturnType<typeof getDb>,
  userId: string,
  input: GenerationInput,
) {
  if (input.type === "image_edit" && !input.sourceAssetId) {
    throw new GenerationServiceError(
      "source_asset_required",
      400,
      "sourceAssetId is required for image_edit",
    );
  }

  if (input.type === "image_to_video" && !input.sourceAssetId) {
    throw new GenerationServiceError(
      "source_asset_required",
      400,
      "sourceAssetId is required for image_to_video",
    );
  }

  if (
    (input.type === "text_to_image" || input.type === "text_to_video") &&
    input.sourceAssetId
  ) {
    throw new GenerationServiceError(
      "invalid_source_asset",
      400,
      "sourceAssetId is only allowed for image_edit",
    );
  }

  if (input.sourceAssetId) {
    const [sourceAsset] = await db
      .select({ id: imageAssets.id })
      .from(imageAssets)
      .where(
        and(
          eq(imageAssets.id, input.sourceAssetId),
          eq(imageAssets.userId, userId),
        ),
      )
      .limit(1);

    if (!sourceAsset) {
      throw new GenerationServiceError(
        "source_asset_not_found",
        404,
        "source asset not found",
      );
    }
  }

  const taskId = `task_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(generationTasks).values({
    id: taskId,
    userId,
    type: input.type,
    status: "queued",
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    params: {
      style: input.style,
      size: input.size,
      sourceAssetId: input.sourceAssetId,
      ratio: input.ratio,
      duration: input.duration,
      camera: input.camera,
      motionStrength: input.motionStrength,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Minimal MVP real image path: text_to_image calls Bailian directly.
  // image_edit remains queued and can be completed by existing mock-complete endpoint.
  if (input.type === "text_to_image") {
    try {
      const generated = await generateImageWithBailian({
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        size: input.size,
        style: input.style,
      });

      const assetId = `asset_${crypto.randomUUID()}`;

      await db.insert(imageAssets).values({
        id: assetId,
        userId,
        taskId,
        parentAssetId: null,
        url: generated.imageUrl,
        width: generated.width,
        height: generated.height,
        mimeType: "image/png",
        promptSnapshot: input.prompt,
        metadata: {
          provider: "bailian",
          raw: generated.raw,
        },
        createdAt: new Date(),
      });

      await db
        .update(generationTasks)
        .set({
          status: "succeeded",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationTasks.id, taskId),
            eq(generationTasks.userId, userId),
          ),
        );

      return {
        taskId,
        status: "succeeded" as const,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "image_generation_failed";

      await db
        .update(generationTasks)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationTasks.id, taskId),
            eq(generationTasks.userId, userId),
          ),
        );

      throw new GenerationServiceError("image_generation_failed", 502, message);
    }
  }

  if (input.type === "text_to_video" || input.type === "image_to_video") {
    try {
      let sourceImageUrl: string | undefined;
      if (input.sourceAssetId) {
        const [source] = await db
          .select({ url: imageAssets.url })
          .from(imageAssets)
          .where(
            and(
              eq(imageAssets.id, input.sourceAssetId),
              eq(imageAssets.userId, userId),
            ),
          )
          .limit(1);

        if (!source?.url) {
          throw new GenerationServiceError(
            "source_asset_not_found",
            404,
            "source asset not found",
          );
        }
        sourceImageUrl = source.url;
      }

      const submitted = await submitVideoTaskWithBailian({
        type: input.type,
        prompt: input.prompt,
        style: toVideoStyle(input.style),
        ratio: input.ratio,
        duration: input.duration,
        camera: input.camera,
        motionStrength: input.motionStrength,
        sourceImageUrl,
      });

      await db
        .update(generationTasks)
        .set({
          status: "running",
          updatedAt: new Date(),
          params: {
            style: input.style,
            size: input.size,
            sourceAssetId: input.sourceAssetId,
            ratio: input.ratio,
            duration: input.duration,
            camera: input.camera,
            motionStrength: input.motionStrength,
            provider: "bailian",
            providerTaskId: submitted.providerTaskId,
            providerRaw: submitted.raw,
          },
        })
        .where(
          and(
            eq(generationTasks.id, taskId),
            eq(generationTasks.userId, userId),
          ),
        );

      return {
        taskId,
        status: "running" as const,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "video_generation_failed";

      await db
        .update(generationTasks)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationTasks.id, taskId),
            eq(generationTasks.userId, userId),
          ),
        );

      throw new GenerationServiceError("video_generation_failed", 502, message);
    }
  }

  void videoAssets;

  return {
    taskId,
    status: "queued" as const,
  };
}
