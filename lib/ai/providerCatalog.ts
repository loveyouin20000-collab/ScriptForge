import type { ManagedProviderConfig, ProviderConfig } from "../types";

export const defaultManagedProviders: ManagedProviderConfig[] = [
  {
    vendor: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    enabled: true
  },
  {
    vendor: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    models: ["deepseek-chat", "deepseek-reasoner"],
    enabled: true
  },
  {
    vendor: "tongyi",
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
    enabled: true
  },
  {
    vendor: "custom",
    label: "自定义兼容接口",
    baseUrl: "",
    apiKey: "",
    models: [],
    enabled: false
  }
];

function normalizeManagedProvider(item: ManagedProviderConfig): ManagedProviderConfig {
  return {
    vendor: item.vendor,
    label: item.label,
    baseUrl: item.baseUrl,
    apiKey: item.apiKey,
    models: item.models,
    enabled: item.enabled
  };
}

export function parseManagedProviders(value: string | null): ManagedProviderConfig[] {
  if (!value) return defaultManagedProviders;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return defaultManagedProviders;

    const providers = parsed.filter((item): item is ManagedProviderConfig => {
      return (
        item &&
        ["openai", "deepseek", "tongyi", "custom"].includes(item.vendor) &&
        typeof item.label === "string" &&
        typeof item.baseUrl === "string" &&
        typeof item.apiKey === "string" &&
        Array.isArray(item.models) &&
        item.models.every((model: unknown) => typeof model === "string") &&
        typeof item.enabled === "boolean"
      );
    });

    return providers.length > 0 ? providers.map(normalizeManagedProvider) : defaultManagedProviders;
  } catch {
    return defaultManagedProviders;
  }
}

export function serializeManagedProviders(providers: ManagedProviderConfig[]) {
  return JSON.stringify(providers.map(normalizeManagedProvider));
}

export function saveManagedProviderApiKey(
  providers: ManagedProviderConfig[],
  vendor: ManagedProviderConfig["vendor"],
  apiKey: string
) {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) return providers;

  return providers.map((provider) => {
    if (provider.vendor !== vendor || provider.apiKey) return provider;
    return {
      ...provider,
      apiKey: trimmedApiKey
    };
  });
}

export function deleteManagedProviderApiKey(providers: ManagedProviderConfig[], vendor: ManagedProviderConfig["vendor"]) {
  return providers.map((provider) => {
    if (provider.vendor !== vendor) return provider;
    return {
      ...provider,
      apiKey: ""
    };
  });
}

export function resolveProviderConfig(
  selection: ProviderConfig,
  providers: ManagedProviderConfig[]
): ProviderConfig {
  const selected = providers.find(
    (provider) =>
      provider.enabled &&
      provider.vendor === selection.vendor &&
      Boolean(selection.model) &&
      provider.models.includes(selection.model ?? "") &&
      Boolean(provider.apiKey) &&
      Boolean(provider.baseUrl)
  );

  if (!selected) {
    return {
      vendor: "mock",
      baseUrl: "",
      model: ""
    };
  }

  return {
    vendor: selected.vendor,
    baseUrl: selected.baseUrl,
    apiKey: selected.apiKey,
    model: selection.model
  };
}
