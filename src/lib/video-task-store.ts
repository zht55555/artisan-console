import { queryVideoTaskWithBailian } from "@/ai/bailian-video";

export type VideoTaskMode = "text_to_video" | "image_to_video";

export type VideoTaskRecord = {
  id: string;
  userId: string;
  mode: VideoTaskMode;
  prompt: string;
  providerTaskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  ratio?: "9:16" | "16:9";
  duration?: "5s" | "10s";
  camera?: "无" | "环绕" | "推拉" | "缩放";
  style?: "电影感" | "写实" | "动漫" | "赛博朋克";
  motionStrength?: number;
  fidelityMode?: "preserve" | "creative";
  sourceImageUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

const store = new Map<string, VideoTaskRecord>();

function keyOf(userId: string, taskId: string) {
  return `${userId}:${taskId}`;
}

export function putVideoTask(task: VideoTaskRecord) {
  store.set(keyOf(task.userId, task.id), task);
}

export function getVideoTask(userId: string, taskId: string) {
  return store.get(keyOf(userId, taskId)) || null;
}

export function deleteVideoTask(userId: string, taskId: string) {
  store.delete(keyOf(userId, taskId));
}

export function clearVideoTasks(userId: string) {
  for (const key of store.keys()) {
    if (key.startsWith(`${userId}:`)) {
      store.delete(key);
    }
  }
}

export function listVideoTasks(userId: string) {
  return Array.from(store.values())
    .filter((item) => item.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export async function refreshVideoTaskStatus(task: VideoTaskRecord) {
  if (!["queued", "running"].includes(task.status)) {
    return task;
  }

  const remote = await queryVideoTaskWithBailian(task.providerTaskId);
  const next: VideoTaskRecord = {
    ...task,
    status: remote.status,
    videoUrl: remote.videoUrl || task.videoUrl,
    coverUrl: remote.coverUrl || task.coverUrl,
    errorMessage: remote.errorMessage || task.errorMessage,
    updatedAt: new Date().toISOString(),
  };

  putVideoTask(next);
  return next;
}
