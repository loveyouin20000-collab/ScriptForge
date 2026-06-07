import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(".", "\\.");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }

  return match[1];
}

describe("users admin layout", () => {
  it("stacks user management and provider management as separate sections", () => {
    expect(pageSource).toContain('className="userManagementStack"');
    expect(pageSource.indexOf('className="userManagementStack"')).toBeLessThan(
      pageSource.indexOf("<AdminProviderModule")
    );
    expect(getCssRule(".usersPage")).toMatch(/grid-template-columns:\s*1fr;/);
  });

  it("stacks the user form above the user table inside user management", () => {
    const userManagementStart = pageSource.indexOf('className="userManagementStack"');
    const userFormIndex = pageSource.indexOf('className="panel userFormPanel"');
    const userTableIndex = pageSource.indexOf('className="panel userTablePanel"');

    expect(userManagementStart).toBeGreaterThan(-1);
    expect(userFormIndex).toBeGreaterThan(userManagementStart);
    expect(userTableIndex).toBeGreaterThan(userFormIndex);
    expect(getCssRule(".userManagementStack")).toMatch(/grid-template-columns:\s*1fr;/);
  });

  it("renders api key save and delete controls for managed providers", () => {
    expect(pageSource).toContain('className="apiKeyControl"');
    expect(pageSource).toContain("API Key 已保存，删除后可重新添加");
    expect(pageSource).toContain("API Key 仅保存在本机浏览器 localStorage，不会写入源码或提交到 GitHub。");
    expect(pageSource).toContain("saveManagedProviderApiKey");
    expect(pageSource).toContain("deleteManagedProviderApiKey");
  });
});
