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
    timeline: [{ order: 1, chapter_id: "ch_001", event: "收到短信", conflict_ids: ["conflict_001"] }],
    conflicts: [
      {
        id: "conflict_001",
        title: "短信引发的对峙",
        type: "external",
        description: "林晚收到短信后被迫面对隐藏真相。",
        parties: ["char_001"],
        stakes: "如果无法确认短信来源，旧案会继续失控。",
        status: "active",
        source_chapters: ["ch_001"],
        related_timeline: [1]
      }
    ],
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
        conflict_ids: ["conflict_001"],
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

  it("reports invalid conflict party references", () => {
    const script = validScript();
    script.conflicts[0].parties = ["char_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "conflicts.0.parties.0")).toBe(true);
  });

  it("reports invalid timeline conflict references", () => {
    const script = validScript();
    script.timeline[0].conflict_ids = ["conflict_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "timeline.0.conflict_ids.0")).toBe(true);
  });

  it("reports invalid timeline scene references", () => {
    const script = validScript();
    script.timeline[0].scene_id = "scene_missing";
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "timeline.0.scene_id")).toBe(true);
  });

  it("reports invalid scene conflict references", () => {
    const script = validScript();
    script.scenes[0].conflict_ids = ["conflict_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "scenes.0.conflict_ids.0")).toBe(true);
  });

  it("reports invalid conflict source chapter references", () => {
    const script = validScript();
    script.conflicts[0].source_chapters = ["ch_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "conflicts.0.source_chapters.0")).toBe(true);
  });

  it("reports invalid conflict related timeline references", () => {
    const script = validScript();
    script.conflicts[0].related_timeline = [99];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "conflicts.0.related_timeline.0")).toBe(true);
  });
});
