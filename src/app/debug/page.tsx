"use client";

import { useState } from "react";

type JsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<JsonValue> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response
    .json()
    .catch(() => ({ ok: false, error: "invalid_json" }));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
    };
  }

  return data;
}

export default function DebugPage() {
  const [prompt, setPrompt] = useState("A cyberpunk cat in neon rain");
  const [editPrompt, setEditPrompt] = useState(
    "Add cinematic lighting and film grain",
  );
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [output, setOutput] = useState<JsonValue>(null);
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<JsonValue>) {
    setLoading(true);
    try {
      const result = await action();
      setOutput(result);

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        "taskId" in result &&
        typeof result.taskId === "string"
      ) {
        setTaskId(result.taskId);
      }

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        "assetId" in result &&
        typeof result.assetId === "string"
      ) {
        setSourceAssetId(result.assetId);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="vf-bg min-h-screen">
      <div className="vf-grid min-h-screen">
        <div className="mx-auto w-full max-w-5xl space-y-5 p-6 md:p-10">
          <header className="vf-card space-y-2 rounded-2xl p-5 md:p-6">
            <p className="vf-muted text-xs">Batch 1/2/3</p>
            <h1 className="text-2xl font-semibold">Artisan API Debug Panel</h1>
            <p className="vf-muted text-sm">用于快速验证生成与编辑接口链路。</p>
            <a
              href="/chat"
              className="inline-flex rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium"
            >
              打开聊天流式页 /chat
            </a>
            <a
              href="/prompts"
              className="ml-2 inline-flex rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium"
            >
              打开模板页 /prompts
            </a>
          </header>

          <section className="vf-card rounded-2xl p-4 space-y-3 md:p-5">
            <h2 className="font-medium">Step 1: 初始化匿名身份</h2>
            <button
              type="button"
              disabled={loading}
              className="vf-btn-primary rounded-xl px-3 py-2 text-white disabled:opacity-50"
              onClick={() =>
                run(() => requestJson("/api/auth/visitor", { method: "POST" }))
              }
            >
              POST /api/auth/visitor
            </button>
          </section>

          <section className="vf-card rounded-2xl p-4 space-y-3 md:p-5">
            <h2 className="font-medium">Step 2: 创建文生图任务</h2>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2"
              placeholder="prompt"
            />
            <button
              type="button"
              disabled={loading}
              className="vf-btn-primary rounded-xl px-3 py-2 text-white disabled:opacity-50"
              onClick={() =>
                run(() =>
                  requestJson("/api/v1/generations", {
                    method: "POST",
                    body: JSON.stringify({
                      type: "text_to_image",
                      prompt,
                      size: "1024x1024",
                    }),
                  }),
                )
              }
            >
              POST /api/v1/generations
            </button>
          </section>

          <section className="vf-card rounded-2xl p-4 space-y-3 md:p-5">
            <h2 className="font-medium">Step 3: 任务状态与完成</h2>
            <input
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2"
              placeholder="taskId"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || !taskId}
                className="vf-btn-primary rounded-xl px-3 py-2 text-white disabled:opacity-50"
                onClick={() =>
                  run(() => requestJson(`/api/v1/generations/${taskId}`))
                }
              >
                GET /api/v1/generations/:id
              </button>
              <button
                type="button"
                disabled={loading || !taskId}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-white disabled:opacity-50"
                onClick={() =>
                  run(() =>
                    requestJson(`/api/v1/generations/${taskId}/mock-complete`, {
                      method: "POST",
                    }),
                  )
                }
              >
                POST /mock-complete
              </button>
              <button
                type="button"
                disabled={loading || !taskId}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-white disabled:opacity-50"
                onClick={() =>
                  run(() =>
                    requestJson(`/api/v1/generations/${taskId}/cancel`, {
                      method: "POST",
                    }),
                  )
                }
              >
                POST /cancel
              </button>
            </div>
          </section>

          <section className="vf-card rounded-2xl p-4 space-y-3 md:p-5">
            <h2 className="font-medium">Step 4: 创建图像编辑任务</h2>
            <input
              value={sourceAssetId}
              onChange={(event) => setSourceAssetId(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2"
              placeholder="sourceAssetId (可来自上一步 mock-complete 返回)"
            />
            <input
              value={editPrompt}
              onChange={(event) => setEditPrompt(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2"
              placeholder="edit prompt"
            />
            <button
              type="button"
              disabled={loading || !sourceAssetId}
              className="vf-btn-primary rounded-xl px-3 py-2 text-white disabled:opacity-50"
              onClick={() =>
                run(() =>
                  requestJson("/api/v1/edits", {
                    method: "POST",
                    body: JSON.stringify({
                      sourceAssetId,
                      prompt: editPrompt,
                      size: "1024x1024",
                    }),
                  }),
                )
              }
            >
              POST /api/v1/edits
            </button>
          </section>

          <section className="vf-card rounded-2xl p-4 md:p-5">
            <h2 className="mb-2 font-medium">输出</h2>
            <pre className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-zinc-100">
              {JSON.stringify(output, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}
