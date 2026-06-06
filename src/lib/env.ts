const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "AI_CHAT_PROVIDER",
  "AI_CHAT_MODEL",
  "AI_IMAGE_PROVIDER",
  "AI_IMAGE_MODEL",
] as const;

const OPTIONAL_STORAGE_ENV_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_DOMAIN",
] as const;

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function missingKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => isBlank(process.env[key]));
}

export function getEnvCheck() {
  const missingRequired = missingKeys(REQUIRED_ENV_KEYS);
  const missingStorage = missingKeys(OPTIONAL_STORAGE_ENV_KEYS);

  const chatProvider = process.env.AI_CHAT_PROVIDER?.trim();
  const imageProvider = process.env.AI_IMAGE_PROVIDER?.trim();

  const providerKeys: string[] = [];
  if (chatProvider === "bailian" || imageProvider === "bailian") {
    providerKeys.push("DASHSCOPE_API_KEY");
  }
  if (chatProvider === "deepseek" || chatProvider === "openai") {
    providerKeys.push("OPENAI_API_KEY");
  }

  const missingProviderKeys = missingKeys(providerKeys);
  const allMissingRequired = [...missingRequired, ...missingProviderKeys];

  return {
    requiredKeys: REQUIRED_ENV_KEYS,
    missingRequired: allMissingRequired,
    optionalStorageKeys: OPTIONAL_STORAGE_ENV_KEYS,
    missingOptionalStorage: missingStorage,
    storageEnabled: missingStorage.length === 0,
  };
}
