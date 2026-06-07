import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNTS,
  authenticateAccount,
  canManageUsers,
  createAccount,
  deleteAccount,
  getRemainingRuns,
  parseAccounts,
  recordAccountUsage,
  serializeAccounts,
  updateAccount
} from "@/lib/accounts";

describe("accounts", () => {
  it("loads default admin and user accounts", () => {
    expect(parseAccounts(null).map((account) => [account.username, account.role])).toEqual([
      ["admin", "admin"],
      ["user", "user"]
    ]);
    expect(getRemainingRuns(parseAccounts(null)[0])).toBe(10);
  });

  it("authenticates active accounts only", () => {
    expect(authenticateAccount(DEFAULT_ACCOUNTS, "admin", "admin123")?.role).toBe("admin");
    expect(authenticateAccount(DEFAULT_ACCOUNTS, "admin", "wrong")).toBeNull();
    expect(authenticateAccount([{ ...DEFAULT_ACCOUNTS[0], status: "disabled" }], "admin", "admin123")).toBeNull();
  });

  it("allows only active admins to manage users", () => {
    expect(canManageUsers(DEFAULT_ACCOUNTS[0])).toBe(true);
    expect(canManageUsers(DEFAULT_ACCOUNTS[1])).toBe(false);
    expect(canManageUsers({ ...DEFAULT_ACCOUNTS[0], status: "disabled" })).toBe(false);
  });

  it("creates, updates, serializes, and deletes accounts", () => {
    const created = createAccount(
      DEFAULT_ACCOUNTS,
      {
        username: "editor",
        passphrase: "pass123",
        role: "user",
        status: "active"
      },
      "2026-06-06T10:00:00.000Z"
    );

    expect(created).toHaveLength(3);
    expect(created[2]).toMatchObject({ username: "editor", role: "user", status: "active" });

    const updated = updateAccount(created, created[2].id, {
      username: "manager",
      passphrase: "newpass",
      role: "admin",
      status: "disabled"
    });

    expect(updated[2]).toMatchObject({ username: "manager", passphrase: "newpass", role: "admin", status: "disabled" });
    expect(parseAccounts(serializeAccounts(updated))).toEqual(updated);
    expect(deleteAccount(updated, updated[2].id)).toEqual(DEFAULT_ACCOUNTS);
  });

  it("normalizes older stored accounts without quota fields", () => {
    const [account] = parseAccounts(
      JSON.stringify([
        {
          id: "legacy",
          username: "legacy",
          passphrase: "pass",
          role: "user",
          status: "active",
          createdAt: "2026-06-06T10:00:00.000Z"
        }
      ])
    );

    expect(account.quota).toEqual({ totalRuns: 10, usedRuns: 0 });
    expect(account.usageRecords).toEqual([]);
  });

  it("records usage and updates remaining runs", () => {
    const updated = recordAccountUsage(DEFAULT_ACCOUNTS, "user", {
      action: "生成改编结果",
      cost: 1,
      note: "真实 LLM 调用",
      createdAt: "2026-06-06T10:00:00.000Z"
    });

    expect(updated[1].quota.usedRuns).toBe(1);
    expect(getRemainingRuns(updated[1])).toBe(9);
    expect(updated[1].usageRecords[0]).toMatchObject({
      action: "生成改编结果",
      cost: 1,
      note: "真实 LLM 调用"
    });
  });

  it("rejects duplicate usernames", () => {
    expect(
      createAccount(DEFAULT_ACCOUNTS, {
        username: "admin",
        passphrase: "pass123",
        role: "user",
        status: "active"
      })
    ).toEqual(DEFAULT_ACCOUNTS);
  });
});
