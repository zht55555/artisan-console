const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504] as const;

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryOnStatuses?: number[];
  retryOnNetworkError?: boolean;
  retryUnsafeMethods?: boolean;
  signal?: AbortSignal;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function shouldRetryByMethod(method: string, retryUnsafeMethods: boolean): boolean {
  return SAFE_METHODS.has(method) || retryUnsafeMethods;
}

async function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    signal?.addEventListener("abort", onAbort);
  });
}

function getDelay(attempt: number, options: Required<Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "backoffFactor">>): number {
  const raw = options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1);
  return Math.min(options.maxDelayMs, Math.round(raw));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = Math.max(1, options.retries ?? 3);
  const method = (init.method ?? "GET").toUpperCase();
  const retryUnsafeMethods = options.retryUnsafeMethods ?? false;
  const retryOnNetworkError = options.retryOnNetworkError ?? true;
  const retryOnStatuses = options.retryOnStatuses ?? [...DEFAULT_RETRY_STATUSES];
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 1500;
  const backoffFactor = options.backoffFactor ?? 2;
  const signal = (options.signal ?? init.signal) ?? undefined;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const canRetryMethod = shouldRetryByMethod(method, retryUnsafeMethods);
      const canRetryStatus = retryOnStatuses.includes(response.status);

      if (!(canRetryMethod && canRetryStatus && attempt < maxAttempts)) {
        return response;
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      lastError = error;
      const canRetryMethod = shouldRetryByMethod(method, retryUnsafeMethods);
      if (!(retryOnNetworkError && canRetryMethod && attempt < maxAttempts)) {
        throw error;
      }
    }

    const delay = getDelay(attempt, { baseDelayMs, maxDelayMs, backoffFactor });
    await sleepWithSignal(delay, signal);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("fetch_with_retry_failed");
}
