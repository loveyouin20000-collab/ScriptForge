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
  return Boolean(config?.apiKey && config?.model);
}
