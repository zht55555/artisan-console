import { fetchWithRetry } from "@/lib/retry";

type GenerateImageInput = {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  style?: string;
};

type GenerateImageResult = {
  imageUrl: string;
  width?: number;
  height?: number;
  raw: unknown;
};

type DashscopePayload = {
  message?: string;
  error?: { message?: string };
  output?: {
    task_id?: string;
    task_status?: string;
    message?: string;
    result_url?: string;
    image_url?: string;
    results?: Array<{ url?: string }>;
  };
  result?: { url?: string };
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

function getImageModel() {
  return process.env.AI_IMAGE_MODEL?.trim() || "wanx2.1-t2i-turbo";
}

function parseSize(size?: string): {
  width?: number;
  height?: number;
  size?: string;
} {
  if (!size) return {};
  const m = size.match(/^(\d{2,4})x(\d{2,4})$/);
  if (!m) return { size };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function pickImageUrlFromPayload(payload: DashscopePayload): string | null {
  const direct =
    payload?.output?.results?.[0]?.url ||
    payload?.output?.result_url ||
    payload?.output?.image_url ||
    payload?.result?.url;
  return typeof direct === "string" && direct.length > 0 ? direct : null;
}

async function pollTaskUntilDone(
  taskId: string,
  apiKey: string,
): Promise<DashscopePayload> {
  const baseUrl = getDashscopeBaseUrl();
  const maxAttempts = 20;

  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetchWithRetry(`${baseUrl}/api/v1/tasks/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = (await r.json().catch(() => ({}))) as DashscopePayload;
    if (!r.ok) {
      const msg = data?.message || `dashscope task query failed: ${r.status}`;
      throw new Error(msg);
    }

    const status = String(data?.output?.task_status || "").toUpperCase();
    if (status === "SUCCEEDED") return data;
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(data?.output?.message || "dashscope task failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("dashscope task timeout");
}

export async function generateImageWithBailian(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const apiKey = getDashscopeApiKey();
  const baseUrl = getDashscopeBaseUrl();
  const model = getImageModel();

  const sizeInfo = parseSize(input.size);

  const body = {
    model,
    input: {
      prompt: input.prompt,
      ...(input.negativePrompt
        ? { negative_prompt: input.negativePrompt }
        : {}),
    },
    parameters: {
      ...(sizeInfo.size ? { size: sizeInfo.size } : {}),
      ...(input.style ? { style: input.style } : {}),
    },
  };

  const res = await fetchWithRetry(
    `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(body),
    },
    { retries: 3, retryUnsafeMethods: true },
  );

  const payload = (await res.json().catch(() => ({}))) as DashscopePayload;
  if (!res.ok) {
    const msg =
      payload?.message ||
      payload?.error?.message ||
      `dashscope request failed: ${res.status}`;
    throw new Error(msg);
  }

  // Some models may return URL directly.
  const direct = pickImageUrlFromPayload(payload);
  if (direct) {
    return {
      imageUrl: direct,
      width: sizeInfo.width,
      height: sizeInfo.height,
      raw: payload,
    };
  }

  const taskId = payload?.output?.task_id;
  if (!taskId) {
    throw new Error("dashscope response missing task_id");
  }

  const done = await pollTaskUntilDone(taskId, apiKey);
  const url = pickImageUrlFromPayload(done);
  if (!url) {
    throw new Error("dashscope response missing output image url");
  }

  return {
    imageUrl: url,
    width: sizeInfo.width,
    height: sizeInfo.height,
    raw: done,
  };
}
