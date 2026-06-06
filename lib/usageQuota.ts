export type UsageQuota = {
  plan: "Free";
  totalRuns: number;
  usedRuns: number;
  remainingRuns: number;
  note: string;
};

export function getUsageQuota(): UsageQuota {
  const totalRuns = 10;
  const usedRuns = 0;

  return {
    plan: "Free",
    totalRuns,
    usedRuns,
    remainingRuns: totalRuns - usedRuns,
    note: "本地 mock 不扣次数"
  };
}
