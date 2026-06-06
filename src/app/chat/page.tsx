"use client";

import { useRef, useState, useEffect, useCallback, CSSProperties } from "react";
import Link from "next/link";
import {
  Send,
  Square,
  X,
  Zap,
  ChevronDown,
  RotateCcw,
  Moon,
  Sun,
  ImageIcon,
  Cpu,
  Sparkles,
  Play,
} from "lucide-react";
import { motion } from "framer-motion";

/* ────────────────────────────────────────
   Types
   ──────────────────────────────────────── */
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  imageAssetId?: string;
  status?: "streaming" | "done" | "error" | "canceled";
};
type StreamState = "idle" | "sending" | "streaming";
type FollowUpAction = "optimize" | "marketing" | "variants";

/* ────────────────────────────────────────
   Constants
   ──────────────────────────────────────── */
const MODELS = [
  { id: "qwen-turbo", label: "Qwen Turbo", badge: "快速" },
  { id: "qwen-plus", label: "Qwen Plus", badge: "平衡" },
  { id: "qwen-max", label: "Qwen Max", badge: "强力" },
];

const SUGGESTIONS = [
  "帮我写一首关于深夜的诗",
  "解释一下量子纠缠",
  "设计一个现代登录页面",
  "优化这段 React 代码",
];

const FEATURES = [
  { icon: Zap, label: "闪电般快速", color: "text-yellow-500" },
  { icon: Play, label: "简单易用", color: "text-primary" },
  { icon: Sparkles, label: "AI 驱动", color: "text-primary" },
];

const FOLLOW_UP_ACTIONS: Array<{ key: FollowUpAction; label: string }> = [
  { key: "optimize", label: "细节增强" },
  { key: "marketing", label: "商用文案" },
  { key: "variants", label: "再出 3 版" },
];

/* ────────────────────────────────────────
   Meteors (VideoFly pattern)
   ──────────────────────────────────────── */
function Meteors({ count = 15 }: { count?: number }) {
  const [styles, setStyles] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const w = window.innerWidth;
    setStyles(
      Array.from(
        { length: count },
        () =>
          ({
            "--angle": "-215deg",
            "--dur": `${(Math.random() * 5 + 3).toFixed(1)}s`,
            "--delay": `${(Math.random() * 8).toFixed(1)}s`,
            top: "-5%",
            left: `${Math.floor(Math.random() * w)}px`,
          }) as CSSProperties,
      ),
    );
  }, [count]);
  return (
    <>
      {styles.map((s, i) => (
        <span key={i} style={s} className="meteor-span">
          <div className="meteor-tail" />
        </span>
      ))}
    </>
  );
}

/* ────────────────────────────────────────
   Diagonal slashes (VideoFly deco)
   ──────────────────────────────────────── */
const SLASHES = [
  { top: "12%", left: "6%" },
  { top: "18%", left: "10%" },
  { top: "25%", right: "7%" },
  { top: "35%", right: "4%" },
  { top: "8%", left: "45%" },
  { top: "42%", left: "3%" },
  { top: "50%", right: "9%" },
  { top: "60%", left: "15%" },
  { top: "68%", right: "6%" },
  { top: "75%", left: "8%" },
  { top: "82%", right: "13%" },
];
function DecoSlashes() {
  return (
    <>
      {SLASHES.map((p, i) => (
        <div key={i} className="deco-slash" style={p}>
          /
        </div>
      ))}
    </>
  );
}

/* ────────────────────────────────────────
   Theme hook
   ──────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () =>
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  return { dark, toggle };
}

/* ────────────────────────────────────────
   SSE reader — async generator
   Parses named-event SSE: "event: X\ndata: {...}\n\n"
   ──────────────────────────────────────── */
type SseMessage = { event: string; data: string };

async function* readSse(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<SseMessage> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!; // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield { event: currentEvent, data };
          currentEvent = "message"; // reset after each data line
        }
        // blank line = event separator, already handled by reset above
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/* ────────────────────────────────────────
   Helpers
   ──────────────────────────────────────── */
function uid() {
  return Math.random().toString(36).slice(2);
}
/** 初始化 visitor session（middleware 会设 cookie，首次需手动触发） */
async function initVisitorSession(): Promise<void> {
  await fetch("/api/auth/visitor", { method: "POST" }).catch(() => null);
}

async function ensureConvId(current: string): Promise<string> {
  if (current) return current;

  const doCreate = async () =>
    fetch("/api/v1/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "新会话" }),
    });

  let r = await doCreate();

  // 401 means no session cookie yet — init visitor then retry once
  if (r.status === 401) {
    await initVisitorSession();
    r = await doCreate();
  }

  const d = await r.json();
  if (!r.ok || !d.conversationId) throw new Error("创建会话失败");
  return String(d.conversationId);
}

/* ════════════════════════════════════════
   Main Page
   ════════════════════════════════════════ */
export default function ChatPage() {
  const { dark, toggle } = useTheme();

  /* pre-warm visitor session on mount */
  useEffect(() => {
    initVisitorSession();
  }, []);

  /* state */
  const [convId, setConvId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [lastInput, setLastInput] = useState("");
  const [error, setError] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [composerMode, setComposerMode] = useState<"chat" | "image">("chat");
  const [imgPreview, setImgPreview] = useState("");
  const [imgBase64, setImgBase64] = useState("");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [imagePrompt, setImagePrompt] = useState(
    "一张现代科技风格的办公场景插画，明亮配色，4k",
  );
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageStyle, setImageStyle] = useState("photography");
  const [imageTaskId, setImageTaskId] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAssetId, setImageAssetId] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chatMode = messages.length > 0;
  const busy = streamState !== "idle";
  const currentModel = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const latestUserText = [...messages]
    .reverse()
    .find((m) => m.role === "user" && m.content.trim())?.content;

  /* auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input, imagePrompt, composerMode]);

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* image pick */
  const pickImage = useCallback(() => fileRef.current?.click(), []);
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const r = ev.target?.result as string;
        setImgPreview(r);
        setImgBase64(r);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  /* send */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && !imgPreview) return;
    if (busy) return;

    setError("");
    setLastInput(text);
    setInput("");
    setImgPreview("");
    setImgBase64("");

    const userMsg: ChatMsg = {
      id: uid(),
      role: "user",
      content: text,
      image: imgPreview || undefined,
    };
    const asstMsg: ChatMsg = {
      id: uid(),
      role: "assistant",
      content: "",
      status: "streaming",
    };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setStreamState("sending");

    try {
      const cid = await ensureConvId(convId);
      setConvId(cid);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStreamState("streaming");

      const body: Record<string, unknown> = {
        conversationId: cid,
        content: text,
        model,
      };
      if (imgBase64) body.image = imgBase64;

      const res = await fetch("/api/v1/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // ── Consume named SSE events via async generator ──
      for await (const { event, data } of readSse(res, ctrl.signal)) {
        if (event === "token") {
          const parsed = JSON.parse(data) as { delta: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id
                ? { ...m, content: m.content + parsed.delta }
                : m,
            ),
          );
        } else if (event === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id ? { ...m, status: "done" } : m,
            ),
          );
        } else if (event === "error") {
          const err = JSON.parse(data) as { code: string; message: string };
          throw new Error(`${err.code}: ${err.message}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id ? { ...m, status: "canceled" } : m,
          ),
        );
      } else {
        const msg = err instanceof Error ? err.message : "未知错误";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id
              ? { ...m, content: `请求失败: ${msg}`, status: "error" }
              : m,
          ),
        );
      }
    } finally {
      setStreamState("idle");
      abortRef.current = null;
    }
  }, [input, imgPreview, imgBase64, busy, convId, model]);

  const handleAbort = useCallback(() => abortRef.current?.abort(), []);
  const handleRetry = useCallback(() => {
    if (!lastInput) return;
    setMessages((prev) => prev.slice(0, -2));
    setInput(lastInput);
  }, [lastInput]);

  const handleUseLastChatAsImagePrompt = useCallback(() => {
    if (!latestUserText) return;
    setComposerMode("image");
    setImagePrompt(latestUserText);
  }, [latestUserText]);

  const handleFollowUpFromImage = useCallback(
    (action: FollowUpAction, hint?: string) => {
      const imageContext = hint?.trim() || "当前图片";

      const nextInput =
        action === "optimize"
          ? `请基于${imageContext}给出 3 个可执行的细节增强方案，并说明分别适合的使用场景。`
          : action === "marketing"
            ? `请基于${imageContext}生成 3 条不同风格的商用宣传文案（专业版、年轻版、极简版）。`
            : `请基于${imageContext}设计 3 个视觉变体方向，分别说明关键词、色彩和构图建议。`;

      setComposerMode("chat");
      setInput(nextInput);
    },
    [],
  );

  const renderFollowUpActions = useCallback(
    (hint?: string, compact = false) => (
      <div
        className={`flex ${compact ? "flex-wrap gap-1.5" : "flex-wrap gap-2"}`}
      >
        {FOLLOW_UP_ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => handleFollowUpFromImage(action.key, hint)}
            className={`rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors ${compact ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    ),
    [handleFollowUpFromImage],
  );

  const pollImageTask = useCallback(
    async (taskId: string) => {
      for (let i = 0; i < 25; i++) {
        const res = await fetch(`/api/v1/generations/${taskId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "查询图片任务失败");
        }

        const taskStatus = String(data?.task?.status || "");
        setImageStatus(taskStatus);

        if (taskStatus === "succeeded") {
          const firstAsset = data?.assets?.[0]?.url;
          const firstAssetId = data?.assets?.[0]?.id;
          if (typeof firstAsset === "string" && firstAsset.length > 0) {
            setImageUrl(firstAsset);
            if (typeof firstAssetId === "string" && firstAssetId.length > 0) {
              setImageAssetId(firstAssetId);
            }
            setMessages((prev) => [
              ...prev,
              {
                id: uid(),
                role: "assistant",
                content: `已为你生成图片${imagePrompt.trim() ? `：${imagePrompt.trim()}` : ""}`,
                image: firstAsset,
                imageAssetId:
                  typeof firstAssetId === "string" && firstAssetId.length > 0
                    ? firstAssetId
                    : undefined,
                status: "done",
              },
            ]);
            setComposerMode("chat");
          }
          return;
        }

        if (taskStatus === "failed" || taskStatus === "canceled") {
          throw new Error(`任务已结束：${taskStatus}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      throw new Error("图片任务轮询超时");
    },
    [imagePrompt],
  );

  const handleGenerateImage = useCallback(async () => {
    const prompt = imagePrompt.trim();
    if (!prompt) return;

    setImageLoading(true);
    setImageError("");
    setImageTaskId("");
    setImageStatus("");
    setImageUrl("");
    setImageAssetId("");

    try {
      await initVisitorSession();

      let res = await fetch("/api/v1/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "text_to_image",
          prompt,
          size: imageSize,
          style: imageStyle,
        }),
      });

      let data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        await initVisitorSession();
        res = await fetch("/api/v1/generations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "text_to_image",
            prompt,
            size: imageSize,
            style: imageStyle,
          }),
        });
        data = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw new Error(data?.error || "创建图片任务失败");
      }

      const taskId = String(data?.taskId || "");
      if (!taskId) throw new Error("图片任务缺少 taskId");

      setImageTaskId(taskId);
      setImageStatus(String(data?.status || "queued"));
      await pollImageTask(taskId);
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : "图片生成失败");
    } finally {
      setImageLoading(false);
    }
  }, [imagePrompt, imageSize, imageStyle, pollImageTask]);
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (composerMode === "image") {
          handleGenerateImage();
        } else {
          handleSend();
        }
      }
    },
    [composerMode, handleGenerateImage, handleSend],
  );

  /* ── Input Card (reused in both modes) ── */
  const InputCard = (
    <div className="rounded-2xl border border-border bg-card/80 shadow-xl backdrop-blur-sm overflow-hidden transition-all focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.15),0_8px_40px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          onClick={() => setComposerMode("chat")}
          className={`rounded-full px-3 py-1.5 text-xs transition-colors ${composerMode === "chat" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
        >
          对话
        </button>
        <button
          onClick={() => setComposerMode("image")}
          className={`rounded-full px-3 py-1.5 text-xs transition-colors ${composerMode === "image" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
        >
          文生图
        </button>
        <div className="flex-1" />
        <div className="text-[11px] text-muted-foreground">
          {composerMode === "chat" ? "SSE 流式返回" : "图片任务轮询返回"}
        </div>
      </div>

      {/* image preview */}
      {imgPreview && (
        <div className="px-4 pt-3 flex gap-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgPreview}
              alt="preview"
              className="w-16 h-16 rounded-xl object-cover"
            />
            <button
              onClick={() => {
                setImgPreview("");
                setImgBase64("");
              }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      {/* textarea */}
      <textarea
        ref={textareaRef}
        value={composerMode === "image" ? imagePrompt : input}
        onChange={(e) =>
          composerMode === "image"
            ? setImagePrompt(e.target.value)
            : setInput(e.target.value)
        }
        onKeyDown={handleKey}
        placeholder={
          composerMode === "image" ? "输入图片描述…" : "输入你的想法…"
        }
        rows={2}
        disabled={busy || imageLoading}
        style={{ resize: "none", outline: "none", background: "transparent" }}
        className="w-full px-5 py-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground disabled:opacity-50"
      />

      {composerMode === "image" && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-3">
          <input
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            placeholder="1024x1024"
          />
          <input
            value={imageStyle}
            onChange={(e) => setImageStyle(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            placeholder="photography"
          />
        </div>
      )}

      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/40">
        {composerMode === "chat" ? (
          <>
            {/* image upload */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={pickImage}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-40"
            >
              <ImageIcon size={13} /> <span>图片</span>
            </button>

            {/* model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelMenu((v) => !v)}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-40"
              >
                <Cpu size={13} />
                <span>{currentModel.label}</span>
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 py-0.5 rounded-full">
                  {currentModel.badge}
                </span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${showModelMenu ? "rotate-180" : ""}`}
                />
              </button>
              {showModelMenu && (
                <div className="absolute bottom-full mb-2 left-0 min-w-[170px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden z-50">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setShowModelMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-primary/8 transition-colors
                        ${m.id === model ? "text-primary font-medium" : "text-foreground"}`}
                    >
                      <span>{m.label}</span>
                      <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 py-0.5 rounded-full">
                        {m.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              文生图模式下直接生成，不需要模型切换
            </div>
            <button
              onClick={handleUseLastChatAsImagePrompt}
              disabled={!latestUserText || imageLoading}
              className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-40"
            >
              用上一轮对话出图
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* abort / send */}
        {composerMode === "chat" ? (
          busy ? (
            <button
              onClick={handleAbort}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Square size={13} fill="currentColor" /> 停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && !imgPreview}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={13} /> 发送
            </button>
          )
        ) : (
          <button
            onClick={handleGenerateImage}
            disabled={imageLoading || !imagePrompt.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ImageIcon size={13} /> {imageLoading ? "生成中" : "生成图片"}
          </button>
        )}
      </div>

      {composerMode === "image" && (
        <div className="px-4 pb-4">
          {imageTaskId && (
            <div className="text-xs text-muted-foreground mb-1">
              task: {imageTaskId}
            </div>
          )}
          {imageStatus && (
            <div className="text-xs text-muted-foreground mb-2">
              status: {imageStatus}
            </div>
          )}
          {imageError && (
            <div className="text-sm text-red-500 mb-2">{imageError}</div>
          )}
          {imageUrl && (
            <>
              <div className="rounded-xl border border-border overflow-hidden bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="generated"
                  className="w-full object-cover"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <div className="flex flex-wrap gap-2">
                  {imageAssetId && (
                    <Link
                      href={`/edit/${imageAssetId}?from=chat`}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    >
                      进入编辑
                    </Link>
                  )}
                  {renderFollowUpActions(imagePrompt)}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  /* ════════════════════════════════════════
     Render
     ════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Fixed Background (VideoFly exact) ── */}
      <div className="fixed inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 bg-background" />
        {/* dark aurora */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.25), transparent 70%)",
          }}
        />
        {/* light soft glow */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(22,163,74,0.15), var(--background) 70%)",
          }}
        />
        {/* grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.025) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Meteors (dark only) ── */}
      <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
        {dark && <Meteors count={15} />}
      </div>

      {/* ── Deco slashes ── */}
      <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
        <DecoSlashes />
      </div>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap
                size={15}
                className="text-primary-foreground"
                fill="currentColor"
              />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              Artisan
            </span>
          </div>
          <nav className="flex items-center gap-0.5 text-sm text-muted-foreground">
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-lg hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              对话
            </Link>
          </nav>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════
          EMPTY / HERO MODE  (VideoFly layout)
          ══════════════════════════════════════ */}
      {!chatMode && (
        <section className="relative min-h-[calc(100vh-56px)] overflow-hidden pb-20">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="flex flex-col items-center gap-10">
              {/* Title block */}
              <div className="fade-up-1 text-center space-y-6 max-w-3xl mx-auto">
                {/* Badge */}
                <div className="fade-up-1 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    支持多模型 · 流式输出 · 图片上传
                  </span>
                </div>

                {/* Headline */}
                <h1 className="fade-up-2 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                  将你的想法转化为
                  <br />
                  <span className="text-primary">精彩对话</span>
                </h1>

                {/* Sub */}
                <p className="fade-up-3 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  在几秒内获得高质量 AI
                  回答。支持文字、图片输入，多模型自由切换。
                </p>

                {/* Feature pills */}
                <div className="fade-up-4 flex flex-wrap justify-center gap-3">
                  {FEATURES.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 dark:bg-white/10 backdrop-blur-sm border border-border/50"
                    >
                      <f.icon className={`h-4 w-4 ${f.color}`} />
                      <span className="text-sm font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input card — max-w-4xl like VideoFly */}
              <div className="fade-up-5 w-full max-w-4xl mx-auto relative">
                {/* Decorative glow behind card */}
                <div
                  className="absolute -inset-4 rounded-3xl blur-3xl -z-10 opacity-25 dark:opacity-10"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, #16a34a, #22c55e)",
                  }}
                />
                {InputCard}
              </div>

              {/* Suggestion chips */}
              <div className="fade-up-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs px-3.5 py-1.5 rounded-full border border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          CHAT MODE
          ══════════════════════════════════════ */}
      {chatMode && (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 mr-3 mt-0.5 flex items-center justify-center">
                      <Zap
                        size={13}
                        className="text-primary-foreground"
                        fill="currentColor"
                      />
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                    ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card/80 border border-border backdrop-blur-sm text-foreground rounded-bl-sm"
                    }
                    ${msg.status === "error" ? "border-red-400/50 text-red-400" : ""}`}
                  >
                    {msg.image && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.image}
                          alt="uploaded"
                          className="rounded-xl mb-2 max-h-48 object-contain"
                        />
                        {msg.role === "assistant" && (
                          <div className="mb-2 flex justify-end">
                            <div className="flex flex-wrap gap-1.5">
                              {msg.imageAssetId && (
                                <Link
                                  href={`/edit/${msg.imageAssetId}?from=chat`}
                                  className="text-[11px] px-2.5 py-1 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                                >
                                  进入编辑
                                </Link>
                              )}
                              {renderFollowUpActions(msg.content, true)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {msg.content ||
                      (msg.status === "streaming" ? (
                        <span className="flex gap-1 items-center h-4">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </span>
                      ) : (
                        ""
                      ))}
                    {msg.status === "canceled" && (
                      <span className="block text-xs opacity-40 mt-1">
                        已中断
                      </span>
                    )}
                  </motion.div>
                </div>
              ))}
              {error && !busy && messages.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RotateCcw size={12} /> 重新发送
                  </button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* sticky input */}
          <div className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 py-4">
            <div className="max-w-3xl mx-auto">{InputCard}</div>
          </div>
        </>
      )}
    </div>
  );
}
