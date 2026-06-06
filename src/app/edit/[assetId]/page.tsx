"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithRetry } from "@/lib/retry";

type TaskDetail = {
  ok: boolean;
  task?: {
    id: string;
    status: string;
    prompt: string;
    errorMessage?: string | null;
  };
  assets?: Array<{ id: string; url: string }>;
  sourceAsset?: { id: string; url: string } | null;
  error?: string;
};

export default function EditPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const [prompt, setPrompt] = useState("把画面改成日落光线，增加电影感");
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    setTaskId("");
    setStatus("");
    setResultUrl("");

    try {
      const r = await fetchWithRetry(
        "/api/v1/edits",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceAssetId: assetId,
            prompt,
          }),
        },
        { retries: 3, retryUnsafeMethods: true },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "创建编辑任务失败");
      setTaskId(d.taskId);
      setStatus(d.status);
      await pollTask(d.taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "编辑失败");
    } finally {
      setLoading(false);
    }
  };

  const pollTask = async (id: string) => {
    for (let i = 0; i < 25; i++) {
      const r = await fetchWithRetry(`/api/v1/generations/${id}`);
      const d = (await r.json()) as TaskDetail;
      if (!r.ok) throw new Error(d.error || "查询编辑任务失败");

      const s = d.task?.status || "";
      setStatus(s);

      const src = d.sourceAsset?.url || "";
      if (src) setSourceUrl(src);

      if (s === "succeeded") {
        const first = d.assets?.[0]?.url || "";
        if (first) setResultUrl(first);
        return;
      }

      if (s === "failed" || s === "canceled") {
        throw new Error(d.task?.errorMessage || `任务结束: ${s}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error("编辑任务轮询超时");
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-3">
          <Link
            href="/chat"
            className="inline-flex text-sm rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            返回对话
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">图像编辑</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          sourceAssetId: {assetId}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <button
            onClick={submit}
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "提交中..." : "创建编辑任务"}
          </button>

          {taskId && (
            <div className="text-xs text-muted-foreground">task: {taskId}</div>
          )}
          {status && (
            <div className="text-xs text-muted-foreground">
              status: {status}
            </div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}

          {taskId && (
            <div className="pt-1">
              <Link
                href={`/image/${taskId}`}
                className="text-xs text-primary hover:underline"
              >
                查看任务详情
              </Link>
            </div>
          )}
        </div>

        {(sourceUrl || resultUrl) && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 text-xs text-muted-foreground">原图</div>
              {sourceUrl ? (
                <img
                  src={sourceUrl}
                  alt="source"
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="text-xs text-muted-foreground">
                  暂无原图预览
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 text-xs text-muted-foreground">编辑后</div>
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt="edited"
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="text-xs text-muted-foreground">
                  任务处理中...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
