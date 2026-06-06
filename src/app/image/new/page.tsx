"use client";

import { useState } from "react";

type TaskDetail = {
  ok: boolean;
  task?: { id: string; status: string; prompt: string };
  assets?: Array<{ id: string; url: string }>;
  error?: string;
};

export default function ImageNewPage() {
  const [prompt, setPrompt] = useState(
    "一只赛博朋克风格的小猫，霓虹灯街景，细节丰富",
  );
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState("photography");
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pollTask = async (id: string) => {
    for (let i = 0; i < 25; i++) {
      const r = await fetch(`/api/v1/generations/${id}`);
      const d = (await r.json()) as TaskDetail;
      if (!r.ok) throw new Error(d.error || "查询任务失败");

      const s = d.task?.status || "";
      setStatus(s);

      if (s === "succeeded") {
        const first = d.assets?.[0]?.url || "";
        if (first) setImageUrl(first);
        return;
      }
      if (s === "failed" || s === "canceled") {
        throw new Error(`任务结束: ${s}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setImageUrl("");
    setTaskId("");
    setStatus("");

    try {
      const r = await fetch("/api/v1/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "text_to_image",
          prompt,
          size,
          style,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "提交失败");

      setTaskId(d.taskId);
      setStatus(d.status);
      await pollTask(d.taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">文生图</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          百炼 Wanx 文生图最小 MVP 链路
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="1024x1024"
            />
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="style"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "生成中..." : "开始生成"}
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
        </div>

        {imageUrl && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <img src={imageUrl} alt="generated" className="w-full rounded-lg" />
          </div>
        )}
      </div>
    </main>
  );
}
