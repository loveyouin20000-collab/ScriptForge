import type { ProviderConfig } from "../types";

export type GenerateJsonRequest = {
  system: string;
  prompt: string;
  schemaName: string;
};

export type AiProvider = {
  generateJson<T>(request: GenerateJsonRequest): Promise<T>;
};

export function hasRemoteConfig(config?: ProviderConfig) {
  if (config?.vendor === "mock") return false;
  if (!config?.credential || !config?.model) return false;
  if (config.vendor === "custom" && !config.baseUrl) return false;
  return true;
}
