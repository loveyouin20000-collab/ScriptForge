import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("pricing layout", () => {
  it("explains that one script generation usually consumes several runs", () => {
    expect(pageSource).toContain(
      "一次三章剧本生成通常需要 3-4 次额度，每次生成消耗额度的数目具体取决于章节数量以及启用的生成模块。"
    );
  });
});
