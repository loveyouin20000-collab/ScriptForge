export type AccountRole = "admin" | "user";

export type AccountStatus = "active" | "disabled";

export type AccountUsageRecord = {
  id: string;
  action: string;
  cost: number;
  createdAt: string;
  note: string;
};

export type Account = {
  id: string;
  username: string;
  passphrase: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  quota: {
    totalRuns: number;
    usedRuns: number;
  };
  usageRecords: AccountUsageRecord[];
};

export type AccountDraft = {
  username: string;
  passphrase: string;
  role: AccountRole;
  status: AccountStatus;
};

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "admin",
    username: "admin",
    passphrase: "admin123",
    role: "admin",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    quota: {
      totalRuns: 10,
      usedRuns: 0
    },
    usageRecords: []
  },
  {
    id: "user",
    username: "user",
    passphrase: "user123",
    role: "user",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    quota: {
      totalRuns: 10,
      usedRuns: 0
    },
    usageRecords: []
  }
];

function normalizeAccount(item: Account): Account {
  return {
    ...item,
    quota: {
      totalRuns: typeof item.quota?.totalRuns === "number" ? item.quota.totalRuns : 10,
      usedRuns: typeof item.quota?.usedRuns === "number" ? item.quota.usedRuns : 0
    },
    usageRecords: Array.isArray(item.usageRecords)
      ? item.usageRecords.filter((record): record is AccountUsageRecord => {
          return (
            typeof record?.id === "string" &&
            typeof record.action === "string" &&
            typeof record.cost === "number" &&
            typeof record.createdAt === "string" &&
            typeof record.note === "string"
          );
        })
      : []
  };
}

export function parseAccounts(rawValue: string | null) {
  if (!rawValue) return DEFAULT_ACCOUNTS;

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return DEFAULT_ACCOUNTS;
    const accounts = parsed.filter((item): item is Account => {
      return (
        typeof item?.id === "string" &&
        typeof item.username === "string" &&
        typeof item.passphrase === "string" &&
        (item.role === "admin" || item.role === "user") &&
        (item.status === "active" || item.status === "disabled") &&
        typeof item.createdAt === "string"
      );
    }).map(normalizeAccount);

    return accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function serializeAccounts(accounts: Account[]) {
  return JSON.stringify(accounts);
}

export function authenticateAccount(accounts: Account[], username: string, passphrase: string) {
  const normalizedUsername = username.trim();
  return (
    accounts.find(
      (account) =>
        account.username === normalizedUsername && account.passphrase === passphrase && account.status === "active"
    ) ?? null
  );
}

export function canManageUsers(account: Account | null) {
  return account?.role === "admin" && account.status === "active";
}

export function createAccount(accounts: Account[], draft: AccountDraft, createdAt = new Date().toISOString()) {
  const username = draft.username.trim();
  if (!username || !draft.passphrase.trim()) return accounts;
  if (accounts.some((account) => account.username === username)) return accounts;

  return [
    ...accounts,
    {
      id: `${createdAt}-${username}`,
      username,
      passphrase: draft.passphrase,
      role: draft.role,
      status: draft.status,
      createdAt,
      quota: {
        totalRuns: 10,
        usedRuns: 0
      },
      usageRecords: []
    }
  ];
}

export function updateAccount(accounts: Account[], accountId: string, draft: AccountDraft) {
  const username = draft.username.trim();
  if (!username || !draft.passphrase.trim()) return accounts;
  if (accounts.some((account) => account.id !== accountId && account.username === username)) return accounts;

  return accounts.map((account) => {
    if (account.id !== accountId) return account;
    return {
      ...account,
      username,
      passphrase: draft.passphrase,
      role: draft.role,
      status: draft.status
    };
  });
}

export function deleteAccount(accounts: Account[], accountId: string) {
  return accounts.filter((account) => account.id !== accountId);
}

export function getRemainingRuns(account: Account) {
  return Math.max(account.quota.totalRuns - account.quota.usedRuns, 0);
}

export function recordAccountUsage(
  accounts: Account[],
  accountId: string,
  usage: Omit<AccountUsageRecord, "id" | "createdAt"> & { createdAt?: string }
) {
  const createdAt = usage.createdAt ?? new Date().toISOString();

  return accounts.map((account) => {
    if (account.id !== accountId) return account;
    const cost = Math.max(usage.cost, 0);
    return {
      ...account,
      quota: {
        ...account.quota,
        usedRuns: Math.min(account.quota.usedRuns + cost, account.quota.totalRuns)
      },
      usageRecords: [
        {
          id: `${createdAt}-${accountId}-${account.usageRecords.length + 1}`,
          action: usage.action,
          cost,
          createdAt,
          note: usage.note
        },
        ...account.usageRecords
      ].slice(0, 20)
    };
  });
}
