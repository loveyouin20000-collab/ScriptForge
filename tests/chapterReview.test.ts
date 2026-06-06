import { describe, expect, it } from "vitest";
import { buildChapterReviewItems } from "@/lib/chapterReview";
import type { Chapter, ScriptYaml } from "@/lib/types";

const chapters: Chapter[] = [
  {
    id: "ch_001",
    title: "第一章 雨夜",
    text: "正文",
    summary: "雨夜线索出现",
    main_characters: ["林晚"],
    locations: ["咖啡馆"],
    key_events: ["收到短信"]
  },
  {
    id: "ch_002",
    title: "第二章 旧案",
    text: "正文",
    summary: "旧案重启",
    main_characters: ["林晚", "周沉"],
    locations: ["车站"],
    key_events: ["找到照片"]
  }
];

const script: ScriptYaml = {
  metadata: {
    title: "雨夜旧案",
    author: "原作者",
    generated_by: "test",
    version: "1.0"
  },
  source: {
    chapter_count: 2,
    chapters: chapters.map(({ id, title, summary }) => ({ id, title, summary }))
  },
  characters: [
    {
      id: "char_001",
      name: "林晚",
      role: "protagonist",
      description: "主角"
    }
  ],
  locations: [
    {
      id: "loc_001",
      name: "咖啡馆",
      type: "interior",
      description: "雨夜空间"
    }
  ],
  timeline: [
    { order: 1, chapter_id: "ch_001", event: "收到短信" },
    { order: 2, chapter_id: "ch_002", event: "找到照片" }
  ],
  scenes: [
    {
      id: "scene_001",
      title: "雨夜线索",
      source: { chapters: ["ch_001"] },
      setting: {
        location: "loc_001",
        time: "夜晚",
        atmosphere: "悬疑"
      },
      characters: ["char_001"],
      purpose: "引出线索",
      beats: ["收到短信"],
      script: [{ type: "action", content: "雨水滑落" }]
    },
    {
      id: "scene_002",
      title: "旧案重启",
      source: { chapters: ["ch_002"] },
      setting: {
        location: "loc_001",
        time: "清晨",
        atmosphere: "紧张"
      },
      characters: ["char_001"],
      purpose: "推进调查",
      beats: ["找到照片"],
      script: [{ type: "action", content: "照片掉落" }]
    }
  ]
};

describe("buildChapterReviewItems", () => {
  it("pairs each chapter understanding with only its matching yaml scene data", () => {
    const items = buildChapterReviewItems(script, chapters);

    expect(items).toHaveLength(2);
    expect(items[0].chapter.id).toBe("ch_001");
    expect(items[0].yaml).toContain("scene_001");
    expect(items[0].yaml).not.toContain("scene_002");
    expect(items[1].chapter.id).toBe("ch_002");
    expect(items[1].yaml).toContain("scene_002");
    expect(items[1].yaml).not.toContain("scene_001");
  });
});
