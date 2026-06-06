import { describe, expect, it } from "vitest";
import type { GenerateJsonRequest } from "@/lib/ai/provider";
import { chaptersFromManualText, parseChaptersWithProvider, splitChapters } from "@/lib/chapterSplitter";

describe("splitChapters", () => {
  it("splits Chinese numeric chapter titles", () => {
    const chapters = splitChapters("第1章 雨夜\n正文一\n第二章 旧案\n正文二");
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({ id: "ch_001", title: "第1章 雨夜" });
    expect(chapters[1]).toMatchObject({ id: "ch_002", title: "第二章 旧案" });
  });

  it("splits English Chapter titles", () => {
    const chapters = splitChapters("Chapter 1: Return\nText\nChapter 2: Case\nText");
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1: Return");
  });

  it("splits markdown headings", () => {
    const chapters = splitChapters("## 第一章 雨夜\n正文\n## 第二章 旧案\n正文");
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("第一章 雨夜");
  });

  it("falls back to one chapter when no markers exist", () => {
    const chapters = splitChapters("没有明显章节标题的一段小说。");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("未识别章节");
  });
});

describe("chaptersFromManualText", () => {
  it("uses divider separated manual chapters", () => {
    const chapters = chaptersFromManualText("第一章\n正文\n\n---\n\n第二章\n正文");
    expect(chapters).toHaveLength(2);
    expect(chapters[1].id).toBe("ch_002");
  });
});

describe("parseChaptersWithProvider", () => {
  it("uses the remote provider when available", async () => {
    const calls: string[] = [];
    const chapters = await parseChaptersWithProvider("没有明显章节标题的一段小说。", {
      async generateJson<T>(request: GenerateJsonRequest) {
        calls.push(request.schemaName);
        return {
          chapters: [
            { title: "AI 识别第一章", text: "第一段内容" },
            { title: "AI 识别第二章", text: "第二段内容" }
          ]
        } as T;
      }
    });

    expect(calls).toEqual(["chapter_split"]);
    expect(chapters).toEqual([
      { id: "ch_001", title: "AI 识别第一章", text: "第一段内容" },
      { id: "ch_002", title: "AI 识别第二章", text: "第二段内容" }
    ]);
  });
});
