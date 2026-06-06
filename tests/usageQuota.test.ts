import { describe, expect, it } from "vitest";
import { getUsageQuota } from "@/lib/usageQuota";

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
});
