import type { ProviderConfig } from "./types";

type AccountQuota = {
  totalRuns: number;
  usedRuns: number;
};

export type UsageQuota = {
  plan: "Free";
  totalRuns: number;
  usedRuns: number;
  remainingRuns: number;
  note: string;
};

export function getUsageQuota(accountQuota?: AccountQuota | null): UsageQuota {
  const totalRuns = accountQuota?.totalRuns ?? 10;
  const usedRuns = accountQuota?.usedRuns ?? 0;

  return {
    plan: "Free",
    totalRuns,
    usedRuns,
    remainingRuns: Math.max(totalRuns - usedRuns, 0),
    note: "本地 mock 不扣次数"
  };
}

export function getProviderUsageCost(provider: Pick<ProviderConfig, "vendor"> | null | undefined) {
  switch (provider?.vendor) {
    case "openai":
      return 3;
    case "deepseek":
    case "tongyi":
    case "custom":
      return 1;
    default:
      return 0;
  }
}

export function getMergedYamlSaveUsage(cost: number) {
  const normalizedCost = Math.max(cost, 0);

  return {
    action: "保存合并 YAML",
    cost: normalizedCost,
    note: normalizedCost > 0 ? `保存合并 YAML，扣除 ${normalizedCost} 次` : "本地 mock 生成，不扣次数"
  };
}
