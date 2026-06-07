import { describe, expect, it } from "vitest";
import { hasRemoteConfig } from "@/lib/ai/provider";

describe("hasRemoteConfig", () => {
  it("keeps explicit mock provider local even when stale credentials exist", () => {
    expect(
      hasRemoteConfig({
        vendor: "mock",
        apiKey: "stale-key",
        model: "stale-model"
      })
    ).toBe(false);
  });
});
