"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type VideoMode = "text_to_video" | "image_to_video";
type Ratio = "9:16" | "16:9";
type Duration = "5s" | "10s";
type Camera = "无" | "环绕" | "推拉" | "缩放";
type Style = "电影感" | "写实" | "动漫" | "赛博朋克";
type FidelityMode = "preserve" | "creative";

type UploadAsset = {
  id: string;
  url: string;
  mimeType?: string | null;
};

type HistoryItem = {
  id: string;
  mode: VideoMode;
  providerTaskId?: string;
  prompt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  videoUrl?: string;
  coverUrl?: string;
};

type GenerationDetail = {
  task: {
    id: string;
    prompt: string;
    status: string;
    mode: VideoMode;
    ratio?: Ratio;
    duration?: Duration;
    camera?: Camera;
    style?: Style;
    motionStrength?: number;
    videoUrl?: string;
    coverUrl?: string;
    errorMessage?: string;
  };
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function VideoPage() {
  const [mode, setMode] = useState<VideoMode>("text_to_video");
  const [prompt, setPrompt] = useState(
    "深夜雨巷里，镜头从霓虹倒影推近，人物回头凝视镜头。",
  );
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [duration, setDuration] = useState<Duration>("5s");
  const [camera, setCamera] = useState<Camera>("无");
  const [style, setStyle] = useState<Style>("电影感");
  const [motionStrength, setMotionStrength] = useState(18);
  const [fidelityMode, setFidelityMode] = useState<FidelityMode>("preserve");

  const [uploads, setUploads] = useState<UploadAsset[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [detail, setDetail] = useState<GenerationDetail | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [taskError, setTaskError] = useState("");
  const providerTaskIdMapRef = useRef<Record<string, string>>({});
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  const [atmosphere, setAtmosphere] = useState(20);

  const pollTimerRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedVideoUrl = useMemo(() => {
    return detail?.task?.videoUrl || "";
  }, [detail]);

  const selectedCoverUrl = useMemo(() => {
    return detail?.task?.coverUrl || "";
  }, [detail]);

  async function fetchHistory() {
    const res = await fetch("/api/v1/video/history");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok && Array.isArray(data.items)) {
      setHistory(data.items as HistoryItem[]);
      if (!selectedTaskId && data.items[0]?.id) {
        setSelectedTaskId(data.items[0].id);
      }
    }
  }

  async function fetchDetail(taskId: string) {
    if (!taskId) return;
    const providerTaskId = providerTaskIdMapRef.current[taskId] || "";
    const qs = providerTaskId
      ? `?providerTaskId=${encodeURIComponent(providerTaskId)}`
      : "";
    const res = await fetch(`/api/v1/video/tasks/${taskId}${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setDetail({ task: data.task } as GenerationDetail);
      if (data?.task?.providerTaskId) {
        providerTaskIdMapRef.current[taskId] = String(data.task.providerTaskId);
        localStorage.setItem(
          "video-provider-task-map",
          JSON.stringify(providerTaskIdMapRef.current),
        );
      }
      setTaskError(String(data?.task?.errorMessage || ""));
    } else if (data?.error) {
      setTaskError(String(data.error));
    }
  }

  function clearPoll() {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function startPoll(taskId: string) {
    clearPoll();
    pollTimerRef.current = window.setInterval(async () => {
      await fetchDetail(taskId);
      await fetchHistory();
    }, 2200);
  }

  async function createTask(seedPrompt?: string) {
    if (!prompt.trim()) {
      window.alert("请输入视频描述");
      return;
    }

    if (mode === "image_to_video" && uploads.length === 0) {
      window.alert("图生视频请先上传图片");
      return;
    }

    setIsGenerating(true);
    setTaskError("");
    const selectedUpload =
      mode === "image_to_video"
        ? uploads.find((item) => item.id === selectedUploadId) || uploads[0]
        : undefined;
    const sourceImageUrl =
      mode === "image_to_video" ? selectedUpload?.url : undefined;

    const payload = {
      mode,
      prompt,
      style,
      ratio,
      duration,
      camera,
      motionStrength,
      sourceImageUrl,
      fidelityMode,
    };

    const res = await fetch("/api/v1/video/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.taskId) {
      setIsGenerating(false);
      setTaskError(String(data?.error || res.status));
      window.alert(`创建任务失败: ${data?.error || res.status}`);
      return;
    }

    const taskId = String(data.taskId);
    const providerTaskId = String(data.providerTaskId || "");
    if (providerTaskId) {
      providerTaskIdMapRef.current[taskId] = providerTaskId;
      localStorage.setItem(
        "video-provider-task-map",
        JSON.stringify(providerTaskIdMapRef.current),
      );
    }
    setSelectedTaskId(taskId);
    await fetchHistory();
    await fetchDetail(taskId);

    if (data.status === "running" || data.status === "queued") {
      startPoll(taskId);
    } else {
      clearPoll();
      setIsGenerating(false);
    }

    if (seedPrompt) {
      setPrompt(seedPrompt);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).slice(
      0,
      Math.max(0, 9 - uploads.length),
    );
    for (const file of files) {
      const key = uid();
      setUploadProgress((prev) => ({ ...prev, [key]: 8 }));

      const fakeTimer = window.setInterval(() => {
        setUploadProgress((prev) => {
          const next = Math.min(90, (prev[key] || 0) + 10);
          return { ...prev, [key]: next };
        });
      }, 120);

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const assetId = `local_${uid()}`;
          window.clearInterval(fakeTimer);
          setUploadProgress((prev) => ({ ...prev, [key]: 100 }));
          setUploads((prev) => [
            ...prev,
            {
              id: assetId,
              url: String(reader.result || ""),
              mimeType: file.type,
            },
          ]);
          setSelectedUploadId((prev) => prev || assetId);
          resolve();
        };
        reader.onerror = () => {
          window.clearInterval(fakeTimer);
          setUploadProgress((prev) => ({ ...prev, [key]: 0 }));
          window.alert("上传失败: 图片读取失败");
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  async function deleteTask(taskId: string) {
    if (!taskId) return;
    const res = await fetch(`/api/v1/video/tasks/${taskId}/delete`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`删除失败: ${data?.error || res.status}`);
    }
    await fetchHistory();
    delete providerTaskIdMapRef.current[taskId];
    localStorage.setItem(
      "video-provider-task-map",
      JSON.stringify(providerTaskIdMapRef.current),
    );
    if (selectedTaskId === taskId) {
      setSelectedTaskId("");
      setDetail(null);
    }
  }

  function downloadVideo() {
    if (!selectedVideoUrl) {
      window.alert("当前没有可下载视频");
      return;
    }
    const a = document.createElement("a");
    a.href = selectedVideoUrl;
    a.download = `video_${selectedTaskId || "result"}.mp4`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  async function clearHistory() {
    const res = await fetch("/api/v1/video/history/clear", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`清空失败: ${data?.error || res.status}`);
      return;
    }
    setHistory([]);
    setSelectedTaskId("");
    setDetail(null);
    providerTaskIdMapRef.current = {};
    localStorage.removeItem("video-provider-task-map");
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("video-provider-task-map");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        providerTaskIdMapRef.current = parsed || {};
      }
    } catch {
      providerTaskIdMapRef.current = {};
    }

    void fetchHistory();
    return () => {
      clearPoll();
    };
  }, []);

  useEffect(() => {
    if (!selectedTaskId) return;
    void fetchDetail(selectedTaskId);
  }, [selectedTaskId]);

  useEffect(() => {
    const status = detail?.task?.status;
    if (
      status === "succeeded" ||
      status === "failed" ||
      status === "canceled"
    ) {
      setIsGenerating(false);
      clearPoll();
    }
  }, [detail]);

  useEffect(() => {
    if (!previewVideoRef.current) return;
    previewVideoRef.current.playbackRate = previewSpeed;
  }, [previewSpeed, selectedVideoUrl]);

  useEffect(() => {
    if (mode !== "image_to_video") return;
    if (
      selectedUploadId &&
      uploads.some((item) => item.id === selectedUploadId)
    ) {
      return;
    }
    setSelectedUploadId(uploads[0]?.id || "");
  }, [mode, selectedUploadId, uploads]);

  const inputCardClass =
    "rounded-2xl border border-[rgba(122,162,255,0.16)] bg-[rgba(16,24,42,0.85)] p-4";
  const chipClass =
    "rounded-xl border border-[rgba(122,162,255,0.18)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm hover:border-[rgba(122,162,255,0.38)]";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(80,140,255,0.18),transparent_28%),linear-gradient(180deg,#091224_0%,#060c18_100%)] px-3 py-4 text-[#edf4ff] md:px-5 md:py-6">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_420px]">
        <aside className="rounded-3xl border border-[rgba(122,162,255,0.14)] bg-[rgba(12,19,34,0.88)] p-4">
          <div className="rounded-2xl border border-[rgba(122,162,255,0.2)] bg-[rgba(255,255,255,0.03)] p-3">
            <div className="text-lg font-semibold">视频生成</div>
            <div className="text-xs text-[#8ea3c9]">阿里模型 · 实时任务</div>
          </div>

          <div className="mt-4 text-sm font-semibold">功能</div>
          <div className="mt-2 grid gap-2">
            <button
              className={`${chipClass} text-left ${mode === "text_to_video" ? "border-[rgba(122,162,255,0.55)] bg-[rgba(79,140,255,0.15)]" : ""}`}
              onClick={() => setMode("text_to_video")}
            >
              <div className="font-medium">文生视频</div>
              <div className="text-xs text-[#8ea3c9]">
                多行中文输入，直接生成
              </div>
            </button>
            <button
              className={`${chipClass} text-left ${mode === "image_to_video" ? "border-[rgba(122,162,255,0.55)] bg-[rgba(79,140,255,0.15)]" : ""}`}
              onClick={() => setMode("image_to_video")}
            >
              <div className="font-medium">图生视频</div>
              <div className="text-xs text-[#8ea3c9]">拖拽上传，最多 9 张</div>
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-sm font-semibold">历史记录</div>
            <button
              className="text-xs text-[#8ea3c9] hover:text-white"
              onClick={() => {
                void clearHistory();
              }}
            >
              清空历史
            </button>
          </div>

          <div className="mt-2 grid max-h-[58vh] gap-2 overflow-auto pr-1">
            {history.length === 0 && (
              <div className="rounded-xl border border-dashed border-[rgba(122,162,255,0.2)] p-3 text-xs text-[#8ea3c9]">
                暂无视频历史记录
              </div>
            )}
            {history.map((item) => (
              <div
                key={item.id}
                className={`cursor-pointer rounded-xl border p-3 ${
                  selectedTaskId === item.id
                    ? "border-[rgba(122,162,255,0.52)] bg-[rgba(79,140,255,0.14)]"
                    : "border-[rgba(122,162,255,0.16)] bg-[rgba(255,255,255,0.03)]"
                }`}
                onClick={() => setSelectedTaskId(item.id)}
              >
                <div className="line-clamp-2 text-sm font-medium">
                  {item.prompt}
                </div>
                <div className="mt-1 text-xs text-[#8ea3c9]">
                  状态: {item.status}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] text-[#8ea3c9]">
                    {new Date(item.updatedAt).toLocaleString()}
                  </div>
                  <button
                    className="text-xs text-[#ff8ca4] hover:text-[#ffb6c7]"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteTask(item.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-3xl border border-[rgba(122,162,255,0.14)] bg-[rgba(12,19,34,0.88)] p-4">
          <div className="rounded-2xl border border-[rgba(122,162,255,0.18)] bg-[rgba(10,16,29,0.8)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">视频生成工作台</h1>
                <p className="mt-1 text-sm text-[#8ea3c9]">
                  暗黑蓝色布局，接入阿里视频任务，支持文生视频和图生视频
                </p>
                <p className="mt-1 text-xs text-[#7fa0d7]">
                  提示：视频任务通常需要 1-5 分钟，状态为 running 时请耐心等待。
                </p>
              </div>
              <button
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#4787ff_0%,#62a5ff_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(71,135,255,0.35)] disabled:cursor-wait disabled:opacity-70"
                disabled={isGenerating}
                onClick={() => {
                  void createTask();
                }}
              >
                {isGenerating ? "生成中..." : "生成"}
              </button>
            </div>
          </div>

          <div className={`${inputCardClass} mt-4`}>
            <div className="mb-2 text-sm font-semibold">提示词</div>
            <textarea
              className="min-h-[180px] w-full rounded-2xl border border-[rgba(122,162,255,0.18)] bg-[rgba(5,10,20,0.8)] p-4 text-sm text-[#edf4ff] outline-none placeholder:text-[#7890ba] focus:border-[rgba(122,162,255,0.5)]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="输入视频描述，支持多行中文"
            />
          </div>

          {mode === "image_to_video" && (
            <div className={`${inputCardClass} mt-4`}>
              <div className="mb-2 text-sm font-semibold">上传图片</div>
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(122,162,255,0.35)] bg-[rgba(7,12,24,0.8)] px-4 py-8 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void uploadFiles(e.dataTransfer.files);
                }}
              >
                <span className="text-sm">拖拽上传图片</span>
                <span className="mt-1 text-xs text-[#8ea3c9]">
                  最多 9 张，支持缩略图预览与上传进度
                </span>
                <span className="mt-3 rounded-xl border border-[rgba(122,162,255,0.24)] px-3 py-2 text-xs">
                  上传图片
                </span>
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) void uploadFiles(e.target.files);
                  }}
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {uploads.map((item, idx) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-[rgba(122,162,255,0.18)] bg-[rgba(255,255,255,0.03)]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedUploadId(item.id)}
                      className={`w-full text-left ${selectedUploadId === item.id ? "ring-2 ring-[rgba(122,162,255,0.65)]" : ""}`}
                    >
                      <img
                        src={item.url}
                        alt={`upload-${idx}`}
                        className="h-24 w-full object-cover"
                      />
                      <div className="p-2 text-xs text-[#8ea3c9]">
                        {selectedUploadId === item.id
                          ? "已选为源图"
                          : "上传完成（点击设为源图）"}
                      </div>
                    </button>
                  </div>
                ))}
                {Object.entries(uploadProgress)
                  .filter((entry) => entry[1] > 0 && entry[1] < 100)
                  .map(([id, value]) => (
                    <div
                      key={id}
                      className="rounded-xl border border-[rgba(122,162,255,0.18)] bg-[rgba(255,255,255,0.03)] p-2"
                    >
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.15)]">
                        <div
                          className="h-full bg-[linear-gradient(90deg,#4f8cff,#7ab2ff)]"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-[#8ea3c9]">
                        上传中 {value}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className={`${inputCardClass} mt-4`}>
            <div className="mb-3 text-sm font-semibold">参数面板</div>
            <div className="grid gap-3 md:grid-cols-2">
              {mode === "image_to_video" && (
                <ParamChips
                  label="保真模式"
                  options={["保真优先", "创意优先"]}
                  value={fidelityMode === "preserve" ? "保真优先" : "创意优先"}
                  onChange={(v) =>
                    setFidelityMode(v === "创意优先" ? "creative" : "preserve")
                  }
                />
              )}
              <ParamChips
                label="比例"
                options={["9:16", "16:9"]}
                value={ratio}
                onChange={(v) => setRatio(v as Ratio)}
              />
              <ParamChips
                label="时长"
                options={["5s", "10s"]}
                value={duration}
                onChange={(v) => setDuration(v as Duration)}
              />
              <ParamChips
                label="运镜"
                options={["无", "环绕", "推拉", "缩放"]}
                value={camera}
                onChange={(v) => setCamera(v as Camera)}
              />
              <ParamChips
                label="风格"
                options={["电影感", "写实", "动漫", "赛博朋克"]}
                value={style}
                onChange={(v) => setStyle(v as Style)}
              />
            </div>
          </div>

          <div className={`${inputCardClass} mt-4`}>
            <div className="mb-2 text-sm font-semibold">结果卡片</div>
            {!detail && (
              <div className="text-xs text-[#8ea3c9]">
                暂无结果，点击“生成”后显示。
              </div>
            )}
            {detail && (
              <div className="overflow-hidden rounded-2xl border border-[rgba(122,162,255,0.2)] bg-[rgba(255,255,255,0.03)]">
                <div className="h-44 w-full bg-[linear-gradient(145deg,#0d1730,#1c3360,#0b1326)]">
                  {selectedCoverUrl ? (
                    <img
                      src={selectedCoverUrl}
                      alt="cover"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-sm">
                    {detail.task.prompt}
                  </div>
                  <div className="mt-1 text-xs text-[#8ea3c9]">
                    时长: {String(detail.task.duration || duration)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={chipClass}
                      onClick={() => void deleteTask(detail.task.id)}
                    >
                      删除
                    </button>
                    <button
                      className={chipClass}
                      onClick={() => void createTask(detail.task.prompt)}
                    >
                      重生成
                    </button>
                    <button className={chipClass} onClick={downloadVideo}>
                      下载
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-[rgba(122,162,255,0.14)] bg-[rgba(12,19,34,0.88)] p-4">
          <div className="text-sm font-semibold">预览</div>
          <div className="mt-1 text-xs text-[#8ea3c9]">
            {detail?.task?.status
              ? `状态: ${detail.task.status}`
              : "未选择结果"}
          </div>
          {!!taskError && (
            <div className="mt-2 rounded-xl border border-[rgba(255,111,143,0.45)] bg-[rgba(255,111,143,0.08)] p-2 text-xs text-[#ff9ab2]">
              错误: {taskError}
            </div>
          )}

          <div className="mt-3 overflow-hidden rounded-3xl border border-[rgba(122,162,255,0.2)] bg-[linear-gradient(150deg,#0b1221,#1a2f55,#0d1729)] p-2">
            {selectedVideoUrl ? (
              <video
                ref={previewVideoRef}
                key={selectedVideoUrl}
                src={selectedVideoUrl}
                className="h-[320px] w-full rounded-2xl object-cover"
                controls
                style={{
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${100 + atmosphere}%)`,
                  boxShadow: `inset 0 0 ${Math.round(sharpness / 2)}px rgba(255,255,255,0.24)`,
                }}
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-2xl text-sm text-[#8ea3c9]">
                暂无可预览视频
              </div>
            )}
          </div>

          <div className={`${inputCardClass} mt-4`}>
            <div className="text-sm font-semibold">播放速度</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0.5, 1, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  className={`${chipClass} ${previewSpeed === speed ? "border-[rgba(122,162,255,0.55)] bg-[rgba(79,140,255,0.15)]" : ""}`}
                  onClick={() => setPreviewSpeed(speed)}
                >
                  {speed} 倍
                </button>
              ))}
            </div>
          </div>

          <div className={`${inputCardClass} mt-4`}>
            <div className="text-sm font-semibold">画面调节</div>
            <Slider label="亮度" value={brightness} onChange={setBrightness} />
            <Slider label="对比度" value={contrast} onChange={setContrast} />
            <Slider label="锐度" value={sharpness} onChange={setSharpness} />
            <Slider
              label="氛围浓度"
              value={atmosphere}
              onChange={setAtmosphere}
            />
            <Slider
              label="运镜幅度"
              value={motionStrength}
              onChange={setMotionStrength}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function ParamChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-[#8ea3c9]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item}
            className={`rounded-xl border px-3 py-2 text-sm ${
              value === item
                ? "border-[rgba(122,162,255,0.55)] bg-[rgba(79,140,255,0.15)]"
                : "border-[rgba(122,162,255,0.18)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(122,162,255,0.4)]"
            }`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs text-[#8ea3c9]">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        className="w-full accent-[#4f8cff]"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
