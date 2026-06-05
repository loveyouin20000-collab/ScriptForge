import { describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/pipeline";

const text = `第一章 雨夜
林晚在咖啡馆收到短信。周沉出现。

第二章 旧案
林晚和周沉在老城区讨论旧案。

第三章 证人
清晨，证人消失，新的线索出现。`;

describe("runPipeline", () => {
  it("returns valid yaml with the mock provider", async () => {
    const result = await runPipeline({
      title: "雨夜旧案",
      author: "原作者",
      text
    });

    expect(result.validation.valid).toBe(true);
    expect(result.script.source.chapter_count).toBe(3);
    expect(result.yaml).toContain("metadata:");
    expect(result.script.scenes.length).toBeGreaterThanOrEqual(3);
  });
});
