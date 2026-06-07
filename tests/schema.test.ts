import { describe, expect, it } from "vitest";
import { validateScriptYaml } from "@/lib/schema";
import type { ScriptYaml } from "@/lib/types";

function validScript(): ScriptYaml {
  return {
    metadata: {
      title: "Sample",
      author: "Author",
      generated_by: "test",
      version: "1.0"
    },
    source: {
      chapter_count: 1,
      chapters: [{ id: "ch_001", title: "Chapter 1", summary: "Summary" }]
    },
    characters: [
      {
        id: "char_001",
        name: "Lin",
        role: "protagonist",
        description: "Lead character"
      }
    ],
    locations: [
      {
        id: "loc_001",
        name: "Cafe",
        type: "interior",
        description: "Dim cafe"
      }
    ],
    timeline: [
      {
        order: 1,
        chapter_id: "ch_001",
        event: "Message arrives",
        conflict_ids: ["conflict_001"],
        impact: "Raises the stakes"
      }
    ],
    conflicts: [
      {
        id: "conflict_001",
        title: "Message source",
        type: "external",
        description: "The lead must discover who sent the message.",
        parties: ["char_001"],
        stakes: "The truth may disappear.",
        status: "active",
        source_chapters: ["ch_001"],
        related_timeline: [1]
      }
    ],
    scenes: [
      {
        id: "scene_001",
        title: "Rainy night",
        source: { chapters: ["ch_001"] },
        setting: {
          location: "loc_001",
          time: "Night",
          atmosphere: "Suspenseful"
        },
        characters: ["char_001"],
        conflict_ids: ["conflict_001"],
        purpose: "Introduce the mystery",
        beats: ["Waiting"],
        script: [
          {
            type: "dialogue",
            character: "char_001",
            content: "You came."
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
        content: "Broken dialogue"
      }
    ];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "scenes.0.script.0.character")).toBe(true);
  });

  it("reports invalid conflict character references", () => {
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

  it("reports invalid scene conflict references", () => {
    const script = validScript();
    script.scenes[0].conflict_ids = ["conflict_missing"];
    const result = validateScriptYaml(script);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "scenes.0.conflict_ids.0")).toBe(true);
  });
});
