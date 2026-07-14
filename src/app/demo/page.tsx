"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, MessageSquare, Image as ImageIcon, Wand2 } from "lucide-react";
import { fetchWithRetry } from "@/lib/retry";

type StepResult = {
  title: string;
  detail: string;
};

export default function DemoPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);

  useEffect(() => {
    void fetchWithRetry(
      "/api/auth/visitor",
      { method: "POST" },
      { retries: 3, retryUnsafeMethods: true },
    ).catch(() => null);
  }, []);

  const runDemo = async () => {
    setLoading(true);
    setResults([]);

    const next: StepResult[] = [];

    try {
      await fetchWithRetry(
        "/api/auth/visitor",
        { method: "POST" },
        { retries: 3, retryUnsafeMethods: true },
      ).catch(() => null);

      // 1) Chat quick demo: create conversation + stream one message
      const convRes = await fetchWithRetry(
        "/api/v1/conversations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Demo 会话" }),
        },
        { retries: 3, retryUnsafeMethods: true },
      );
      const convJson = await convRes.json();
      if (!convRes.ok || !convJson.conversationId) {
        throw new Error("创建 demo 会话失败");
      }

      const streamRes = await fetchWithRetry(
        "/api/v1/chat/stream",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversationId: convJson.conversationId,
            content: "请用一句话介绍这个 Artisan MVP 的价值。",
          }),
        },
        { retries: 3, retryUnsafeMethods: true },
      );
      if (!streamRes.ok) throw new Error("对话流式调用失败");
      next.push({
        title: "对话流式演示",
        detail: `会话已创建：${convJson.conversationId}，SSE 调用成功。`,
      });

      // 2) Prompt template demo
      const promptRes = await fetchWithRetry(
        "/api/v1/prompt-templates",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Demo 模板",
            template: "为{{brand}}生成一段{{tone}}风格的品牌介绍。",
            description: "演示模板",
          }),
        },
        { retries: 3, retryUnsafeMethods: true },
      );
      const promptJson = await promptRes.json();
      if (!promptRes.ok || !promptJson.templateId) {
        throw new Error("模板创建失败");
      }
      next.push({
        title: "模板变量演示",
        detail: `模板已创建：${promptJson.templateId}（变量: ${promptJson.variables?.join(", ") || "brand, tone"}）`,
      });

      // 3) Image generation demo (Bailian)
      const genRes = await fetchWithRetry(
        "/api/v1/generations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "text_to_image",
            prompt: "一张现代科技风格的办公场景插画，明亮配色，4k",
            size: "1024x1024",
          }),
        },
        { retries: 3, retryUnsafeMethods: true },
      );
      const genJson = await genRes.json();
      if (!genRes.ok || !genJson.taskId) {
        throw new Error("文生图任务创建失败");
      }
      next.push({
        title: "文生图状态流转演示",
        detail: `任务已创建：${genJson.taskId}，状态：${genJson.status}`,
      });

      setResults(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      setResults([
        {
          title: "演示执行失败",
          detail: message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">一键演示 /demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            按 PRD 的 P0
            要求：快速展示对话流式、模板变量、文生图任务三条核心链路。
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">附加演示页面</div>
              <div className="mt-1 text-sm text-muted-foreground">
                新增了视频工作台页面，不影响当前 demo 链路。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/video"
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                打开站内视频页
              </Link>
              <Link
                href="/copilot-video-studio.html"
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                打开静态原型页
              </Link>
            </div>
          </div>

          <button
            onClick={runDemo}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Play size={14} />
            {loading ? "执行中..." : "运行一键演示"}
          </button>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare size={14} />
              <span>场景 1：流式对话（SSE）</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wand2 size={14} />
              <span>场景 2：模板变量套用</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ImageIcon size={14} />
              <span>场景 3：文生图任务状态流转</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {results.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
