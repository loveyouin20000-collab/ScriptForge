import { describe, expect, it } from "vitest";
import { buildChapterReviewItems } from "@/lib/chapterReview";
import type { Chapter, ScriptYaml } from "@/lib/types";

const chapters: Chapter[] = [
  {
    id: "ch_001",
    title: "Chapter 1",
    text: "Body",
    summary: "The message appears",
    main_characters: ["Lin"],
    locations: ["Cafe"],
    key_events: ["Message arrives"]
  },
  {
    id: "ch_002",
    title: "Chapter 2",
    text: "Body",
    summary: "The old case returns",
    main_characters: ["Lin", "Zhou"],
    locations: ["Station"],
    key_events: ["Photo found"]
  }
];

const script: ScriptYaml = {
  metadata: {
    title: "Rain case",
    author: "Author",
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
      description: "Rainy room"
    }
  ],
  timeline: [
    { order: 1, chapter_id: "ch_001", event: "Message arrives", conflict_ids: ["conflict_001"] },
    { order: 2, chapter_id: "ch_002", event: "Photo found", conflict_ids: ["conflict_002"] }
  ],
  conflicts: [
    {
      id: "conflict_001",
      title: "Message mystery",
      type: "external",
      description: "Lin faces the strange message.",
      parties: ["char_001"],
      stakes: "The clue may disappear.",
      status: "active",
      source_chapters: ["ch_001"],
      related_timeline: [1]
    },
    {
      id: "conflict_002",
      title: "Old case",
      type: "external",
      description: "The old case changes direction.",
      parties: ["char_001"],
      stakes: "The investigation may fail.",
      status: "active",
      source_chapters: ["ch_002"],
      related_timeline: [2]
    }
  ],
  scenes: [
    {
      id: "scene_001",
      title: "Message clue",
      source: { chapters: ["ch_001"] },
      setting: {
        location: "loc_001",
        time: "Night",
        atmosphere: "Suspenseful"
      },
      characters: ["char_001"],
      conflict_ids: ["conflict_001"],
      purpose: "Introduce the clue",
      beats: ["Message arrives"],
      script: [{ type: "action", content: "Rain runs down the glass." }]
    },
    {
      id: "scene_002",
      title: "Old case returns",
      source: { chapters: ["ch_002"] },
      setting: {
        location: "loc_001",
        time: "Morning",
        atmosphere: "Tense"
      },
      characters: ["char_001"],
      conflict_ids: ["conflict_002"],
      purpose: "Move the investigation",
      beats: ["Photo found"],
      script: [{ type: "action", content: "The photo drops." }]
    }
  ]
};

describe("buildChapterReviewItems", () => {
  it("pairs each chapter understanding with only its matching yaml scene data", () => {
    const items = buildChapterReviewItems(script, chapters);

    expect(items).toHaveLength(2);
    expect(items[0].chapter.id).toBe("ch_001");
    expect(items[0].yaml).toContain("scene_001");
    expect(items[0].yaml).toContain("conflict_001");
    expect(items[0].yaml).not.toContain("scene_002");
    expect(items[0].yaml).not.toContain("conflict_002");
    expect(items[1].chapter.id).toBe("ch_002");
    expect(items[1].yaml).toContain("scene_002");
    expect(items[1].yaml).toContain("conflict_002");
    expect(items[1].yaml).not.toContain("scene_001");
    expect(items[1].yaml).not.toContain("conflict_001");
  });
});
