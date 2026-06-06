"use client";

import { useState } from "react";
import { fetchWithRetry } from "@/lib/retry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const response = await fetchWithRetry(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  }, { retries: 3, retryUnsafeMethods: true });

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
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Batch 1/2/3
              </Badge>
              <CardTitle>Artisan API Debug Panel</CardTitle>
              <CardDescription>用于快速验证生成与编辑接口链路。</CardDescription>
              <div className="flex gap-2 pt-1">
                <Button asChild variant="secondary">
                  <a href="/chat">打开聊天流式页 /chat</a>
                </Button>
                <Button asChild variant="secondary">
                  <a href="/prompts">打开模板页 /prompts</a>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Step 1: 初始化匿名身份</h2>
              <Button
                type="button"
                disabled={loading}
                onClick={() =>
                  run(() => requestJson("/api/auth/visitor", { method: "POST" }))
                }
              >
                POST /api/auth/visitor
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Step 2: 创建文生图任务</h2>
              <Input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="prompt"
              />
              <Button
                type="button"
                disabled={loading}
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
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Step 3: 任务状态与完成</h2>
              <Input
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                placeholder="taskId"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={loading || !taskId}
                  onClick={() => run(() => requestJson(`/api/v1/generations/${taskId}`))}
                >
                  GET /api/v1/generations/:id
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !taskId}
                  onClick={() =>
                    run(() =>
                      requestJson(`/api/v1/generations/${taskId}/mock-complete`, {
                        method: "POST",
                      }),
                    )
                  }
                >
                  POST /mock-complete
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !taskId}
                  onClick={() =>
                    run(() =>
                      requestJson(`/api/v1/generations/${taskId}/cancel`, {
                        method: "POST",
                      }),
                    )
                  }
                >
                  POST /cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-medium">Step 4: 创建图像编辑任务</h2>
              <Input
                value={sourceAssetId}
                onChange={(event) => setSourceAssetId(event.target.value)}
                placeholder="sourceAssetId (可来自上一步 mock-complete 返回)"
              />
              <Input
                value={editPrompt}
                onChange={(event) => setEditPrompt(event.target.value)}
                placeholder="edit prompt"
              />
              <Button
                type="button"
                disabled={loading || !sourceAssetId}
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
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="mb-2 font-medium">输出</h2>
              <pre className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-zinc-100">
                {JSON.stringify(output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
