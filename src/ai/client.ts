/**
 * AI Client — 支持 OpenAI / DeepSeek / 阿里百炼（OpenAI 兼容协议）
 *
 * DeepSeek API 与 OpenAI SDK 完全兼容，只需换 baseURL：
 *   https://api.deepseek.com  →  deepseek-chat / deepseek-reasoner
 *   https://dashscope.aliyuncs.com/compatible-mode/v1 → qwen-plus / qwen-turbo
 *   https://api.openai.com    →  gpt-4.1-mini / gpt-4o 等
 */
import OpenAI from "openai";

function createAIClient(): OpenAI {
  const provider = process.env.AI_CHAT_PROVIDER ?? "bailian";
  const apiKey =
    process.env.DASHSCOPE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY/OPENAI_API_KEY is not set");
  }

  if (provider === "bailian") {
    return new OpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }

  if (provider === "deepseek") {
    return new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }

  // Default: OpenAI
  return new OpenAI({ apiKey });
}

// Singleton
let _client: OpenAI | null = null;
export function getAIClient(): OpenAI {
  if (!_client) _client = createAIClient();
  return _client;
}

export function getChatModel(): string {
  return process.env.AI_CHAT_MODEL ?? "qwen-plus";
}
