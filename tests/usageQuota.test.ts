import { describe, expect, it } from "vitest";
import { getMergedYamlSaveUsage, getProviderUsageCost, getUsageQuota } from "@/lib/usageQuota";

describe("getUsageQuota", () => {
  it("shows the free real-LLM allowance and remaining runs", () => {
    expect(getUsageQuota()).toEqual({
      plan: "Free",
      totalRuns: 10,
      usedRuns: 0,
      remainingRuns: 10,
      note: "本地 mock 不扣次数"
    });
  });

  it("reflects the current account quota when available", () => {
    expect(getUsageQuota({ totalRuns: 10, usedRuns: 3 })).toEqual({
      plan: "Free",
      totalRuns: 10,
      usedRuns: 3,
      remainingRuns: 7,
      note: "本地 mock 不扣次数"
    });
  });

  it("charges provider-specific usage costs for remote calls", () => {
    expect(getProviderUsageCost({ vendor: "openai" })).toBe(3);
    expect(getProviderUsageCost({ vendor: "deepseek" })).toBe(1);
    expect(getProviderUsageCost({ vendor: "tongyi" })).toBe(1);
    expect(getProviderUsageCost({ vendor: "mock" })).toBe(0);
  });

  it("builds usage records for saving merged YAML", () => {
    expect(getMergedYamlSaveUsage(3)).toEqual({
      action: "保存合并 YAML",
      cost: 3,
      note: "保存合并 YAML，扣除 3 次"
    });
    expect(getMergedYamlSaveUsage(0)).toEqual({
      action: "保存合并 YAML",
      cost: 0,
      note: "本地 mock 生成，不扣次数"
    });
  });
});
