import { describe, expect, it } from "vitest";
import { validateScriptYaml } from "@/lib/schema";
import type { ScriptYaml } from "@/lib/types";

function validScript(): ScriptYaml {
  return {
    metadata: {
      title: "示例",
      author: "作者",
      generated_by: "test",
      version: "1.0"
    },
    source: {
      chapter_count: 1,
      chapters: [{ id: "ch_001", title: "第一章", summary: "摘要" }]
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
        description: "昏暗"
      }
    ],
    timeline: [{ order: 1, chapter_id: "ch_001", event: "收到短信" }],
    scenes: [
      {
        id: "scene_001",
        title: "雨夜",
        source: { chapters: ["ch_001"] },
        setting: {
          location: "loc_001",
          time: "夜晚",
          atmosphere: "悬疑"
        },
        characters: ["char_001"],
        purpose: "引出悬念",
        beats: ["等待"],
        script: [
          {
            type: "dialogue",
            character: "char_001",
            content: "你来了。"
          }
        ]
      }
    ]
  };
}

describe("validateScriptYaml", () => {
  it("accepts a complete script yaml object", () => {
    expect(validateScriptYaml(validScript()).valid).toBe(true);
  });

  it("reports missing required fields", () => {
    const script = validScript() as unknown as Record<string, unknown>;
    delete script.metadata;
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toBe("metadata");
  });

  it("reports invalid character references", () => {
    const script = validScript();
    script.scenes[0].characters = ["char_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "scenes.0.characters.0")).toBe(true);
  });

  it("reports invalid dialogue character references", () => {
    const script = validScript();
    script.scenes[0].script = [
      {
        type: "dialogue",
        character: "char_missing",
        content: "失效对白"
      }
    ];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "scenes.0.script.0.character")).toBe(true);
  });
});
