import { describe, expect, it } from "vitest";
import {
  deleteManagedProviderApiKey,
  parseManagedProviders,
  resolveProviderConfig,
  saveManagedProviderApiKey,
  serializeManagedProviders
} from "@/lib/ai/providerCatalog";
import type { ManagedProviderConfig } from "@/lib/types";

const providers: ManagedProviderConfig[] = [
  {
    vendor: "openai",
    label: "OpenAI",
    baseUrl: "https://internal.example.com/openai/v1",
    apiKey: "admin-key",
    models: ["gpt-4o-mini"],
    enabled: true
  },
  {
    vendor: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://internal.example.com/deepseek/v1",
    apiKey: "disabled-key",
    models: ["deepseek-chat"],
    enabled: false
  }
];

describe("resolveProviderConfig", () => {
  it("hydrates a user provider selection from admin-managed API settings", () => {
    expect(resolveProviderConfig({ vendor: "openai", model: "gpt-4o-mini" }, providers)).toEqual({
      vendor: "openai",
      baseUrl: "https://internal.example.com/openai/v1",
      apiKey: "admin-key",
      model: "gpt-4o-mini"
    });
  });

  it("falls back to local mock when the selected provider is unavailable", () => {
    expect(resolveProviderConfig({ vendor: "deepseek", model: "deepseek-chat" }, providers)).toEqual({
      vendor: "mock",
      baseUrl: "",
      model: ""
    });
  });

  it("serializes and parses admin-managed provider settings", () => {
    expect(parseManagedProviders(serializeManagedProviders(providers))).toEqual(providers);
    expect(parseManagedProviders("not json")).toEqual(expect.any(Array));
  });

  it("saves api keys once and requires deletion before replacement", () => {
    const withoutKey = providers.map((provider) => ({ ...provider, apiKey: "" }));
    const saved = saveManagedProviderApiKey(withoutKey, "openai", " new-key ");
    const unchanged = saveManagedProviderApiKey(saved, "openai", "replacement-key");
    const deleted = deleteManagedProviderApiKey(unchanged, "openai");
    const replaced = saveManagedProviderApiKey(deleted, "openai", "replacement-key");

    expect(saved.find((provider) => provider.vendor === "openai")?.apiKey).toBe("new-key");
    expect(unchanged.find((provider) => provider.vendor === "openai")?.apiKey).toBe("new-key");
    expect(deleted.find((provider) => provider.vendor === "openai")?.apiKey).toBe("");
    expect(replaced.find((provider) => provider.vendor === "openai")?.apiKey).toBe("replacement-key");
  });
});
