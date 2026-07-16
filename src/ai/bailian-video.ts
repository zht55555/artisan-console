import { fetchWithRetry } from "@/lib/retry";

type VideoGenerateInput = {
  type: "text_to_video" | "image_to_video";
  prompt: string;
  model?: string;
  ratio?: "9:16" | "16:9";
  duration?: "5s" | "10s";
  camera?: "无" | "环绕" | "推拉" | "缩放";
  style?: "电影感" | "写实" | "动漫" | "赛博朋克";
  motionStrength?: number;
  sourceImageUrl?: string;
  fidelityMode?: "preserve" | "creative";
};

type DashscopePayload = {
  message?: string;
  error?: { message?: string };
  output?: {
    task_id?: string;
    task_status?: string;
    message?: string;
    video_url?: string;
    videoUrl?: string;
    result_url?: string;
    resultUrl?: string;
    cover_url?: string;
    coverUrl?: string;
    video_url_list?: Array<string>;
    videoUrls?: Array<string>;
    results?: Array<{ url?: string; video_url?: string; cover_url?: string }>;
  };
  task_id?: string;
  task_status?: string;
};

export type BailianVideoSubmitResult = {
  providerTaskId: string;
  raw: unknown;
};

export type BailianVideoQueryResult = {
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  raw: unknown;
};

function getDashscopeBaseUrl() {
  return (
    process.env.DASHSCOPE_BASE_URL?.trim() || "https://dashscope.aliyuncs.com"
  );
}

function getDashscopeApiKey() {
  const key = process.env.DASHSCOPE_API_KEY?.trim();
  if (!key) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }
  return key;
}

function getVideoModel() {
  return process.env.AI_VIDEO_MODEL?.trim() || "wan2.2-t2v-plus";
}

function getVideoSubmitPath() {
  return (
    process.env.DASHSCOPE_VIDEO_SUBMIT_PATH?.trim() ||
    "/api/v1/services/aigc/video-generation/video-synthesis"
  );
}

function shouldRetryWithoutDuration(message: string, hasDuration: boolean) {
  if (!hasDuration) return false;
  const text = message.toLowerCase();
  return (
    text.includes("duration customization is not supported") ||
    (text.includes("duration") && text.includes("not supported"))
  );
}

function toDurationSeconds(
  duration: VideoGenerateInput["duration"],
): number | undefined {
  if (!duration) return undefined;
  const parsed = Number(String(duration).replace("s", ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function toProviderPrompt(input: VideoGenerateInput): string {
  const extras: string[] = [];
  if (input.style) extras.push(`风格:${input.style}`);
  if (input.camera) extras.push(`运镜:${input.camera}`);
  if (typeof input.motionStrength === "number") {
    extras.push(`运镜幅度:${input.motionStrength}`);
  }
  if (input.type === "image_to_video") {
    const preserveHint =
      input.fidelityMode !== "creative"
        ? "严格保持源图主体身份特征、服装、发型、构图与场景，不改变人物脸部与衣着，仅做自然微动态和镜头运动。"
        : "允许在保留主体核心身份的前提下做适度风格化。";
    extras.push(preserveHint);
  }
  if (extras.length === 0) return input.prompt;
  return `${input.prompt}\n${extras.join("，")}`;
}

function mapStatus(value: string): BailianVideoQueryResult["status"] {
  const upper = value.toUpperCase();
  if (upper === "SUCCEEDED") return "succeeded";
  if (upper === "FAILED") return "failed";
  if (upper === "CANCELED") return "canceled";
  if (upper === "RUNNING") return "running";
  return "queued";
}

function pickVideoUrl(payload: DashscopePayload): string | undefined {
  return (
    payload?.output?.video_url ||
    payload?.output?.videoUrl ||
    payload?.output?.result_url ||
    payload?.output?.resultUrl ||
    payload?.output?.video_url_list?.[0] ||
    payload?.output?.videoUrls?.[0] ||
    payload?.output?.results?.[0]?.video_url ||
    payload?.output?.results?.[0]?.url
  );
}

function pickCoverUrl(payload: DashscopePayload): string | undefined {
  return (
    payload?.output?.cover_url ||
    payload?.output?.coverUrl ||
    payload?.output?.results?.[0]?.cover_url
  );
}

export async function submitVideoTaskWithBailian(
  input: VideoGenerateInput,
): Promise<BailianVideoSubmitResult> {
  const apiKey = getDashscopeApiKey();
  const baseUrl = getDashscopeBaseUrl();
  const model = input.model || getVideoModel();
  const submitPath = getVideoSubmitPath();

  const submitOnce = async (withDuration: boolean) => {
    const requestBody: Record<string, unknown> = {
      model,
      input: {
        prompt: toProviderPrompt(input),
        ...(input.sourceImageUrl ? { image_url: input.sourceImageUrl } : {}),
      },
      parameters: {
        ...(input.ratio ? { ratio: input.ratio } : {}),
        ...(withDuration && toDurationSeconds(input.duration)
          ? { duration: toDurationSeconds(input.duration) }
          : {}),
      },
    };

    const res = await fetchWithRetry(
      `${baseUrl}${submitPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify(requestBody),
      },
      { retries: 3, retryUnsafeMethods: true },
    );

    const payload = (await res.json().catch(() => ({}))) as DashscopePayload;
    return { res, payload };
  };

  const hasDuration = Boolean(toDurationSeconds(input.duration));
  let { res, payload } = await submitOnce(true);

  if (!res.ok) {
    const firstMessage =
      payload?.message ||
      payload?.error?.message ||
      `dashscope video submit failed: ${res.status}`;

    if (shouldRetryWithoutDuration(firstMessage, hasDuration)) {
      const retried = await submitOnce(false);
      res = retried.res;
      payload = retried.payload;
    }
  }

  if (!res.ok) {
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        `dashscope video submit failed: ${res.status}`,
    );
  }

  const providerTaskId = payload?.output?.task_id || payload?.task_id;
  if (!providerTaskId) {
    throw new Error("dashscope video response missing task_id");
  }

  return {
    providerTaskId,
    raw: payload,
  };
}

export async function queryVideoTaskWithBailian(
  providerTaskId: string,
): Promise<BailianVideoQueryResult> {
  const apiKey = getDashscopeApiKey();
  const baseUrl = getDashscopeBaseUrl();

  const res = await fetchWithRetry(
    `${baseUrl}/api/v1/tasks/${providerTaskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const payload = (await res.json().catch(() => ({}))) as DashscopePayload;
  if (!res.ok) {
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        `dashscope video query failed: ${res.status}`,
    );
  }

  const status = mapStatus(
    payload?.output?.task_status || payload?.task_status || "QUEUED",
  );

  return {
    status,
    videoUrl: pickVideoUrl(payload),
    coverUrl: pickCoverUrl(payload),
    errorMessage: payload?.output?.message || payload?.message,
    raw: payload,
  };
}
