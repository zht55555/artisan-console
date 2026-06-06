"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithRetry } from "@/lib/retry";

type TaskPayload = {
  ok: boolean;
  task?: {
    id: string;
    status: string;
    prompt: string;
    type: string;
    errorMessage?: string | null;
  };
  assets?: Array<{ id: string; url: string }>;
  error?: string;
};

export default function ImageTaskPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = params.taskId;
  const [data, setData] = useState<TaskPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) return;
    const run = async () => {
      try {
        const r = await fetchWithRetry(`/api/v1/generations/${taskId}`);
        const d = (await r.json()) as TaskPayload;
        if (!r.ok) throw new Error(d.error || "加载失败");
        setData(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    };
    run();
  }, [taskId]);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">生成详情</h1>
        <p className="mt-2 text-sm text-muted-foreground">taskId: {taskId}</p>

        {error && <div className="mt-4 text-sm text-red-500">{error}</div>}

        {data?.task && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
            <div>status: {data.task.status}</div>
            <div className="mt-1">type: {data.task.type}</div>
            <div className="mt-1">prompt: {data.task.prompt}</div>
            {data.task.errorMessage && (
              <div className="mt-1 text-red-500">
                error: {data.task.errorMessage}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {data?.assets?.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              <img
                src={asset.url}
                alt={asset.id}
                className="w-full rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
