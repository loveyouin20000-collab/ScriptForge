import { describe, expect, it } from "vitest";
import { parseManagedProviders, resolveProviderConfig, serializeManagedProviders } from "@/lib/ai/providerCatalog";
import type { ManagedProviderConfig } from "@/lib/types";

const providers: ManagedProviderConfig[] = [
  {
    vendor: "openai",
    label: "OpenAI",
    baseUrl: "https://internal.example.com/openai/v1",
    credential: "admin-key",
    models: ["gpt-4o-mini"],
    enabled: true
  },
  {
    vendor: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://internal.example.com/deepseek/v1",
    credential: "disabled-key",
    models: ["deepseek-chat"],
    enabled: false
  }
];

describe("resolveProviderConfig", () => {
  it("hydrates a user provider selection from admin-managed API settings", () => {
    expect(resolveProviderConfig({ vendor: "openai", model: "gpt-4o-mini" }, providers)).toEqual({
      vendor: "openai",
      baseUrl: "https://internal.example.com/openai/v1",
      credential: "admin-key",
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
});
