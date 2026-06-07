import { describe, expect, it } from "vitest";
import { normalizeScene } from "@/lib/pipeline";
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
    expect(result.yaml).toContain("conflicts:");
    expect(result.script.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(result.yaml).toContain("story_structure:");
    expect(result.script.story_structure?.acts.length).toBeGreaterThan(0);
    expect(result.script.story_structure?.main_conflict).toContain("冲突");
    expect(result.script.story_structure?.turning_points.length).toBeGreaterThan(0);
    expect(result.script.scenes.length).toBeGreaterThanOrEqual(3);

    const turningPointEvents = result.script.story_structure?.turning_points.map((point) => point.event) ?? [];
    expect(turningPointEvents).not.toContain("章节结尾留下下一步悬念");
    expect(new Set(turningPointEvents).size).toBe(turningPointEvents.length);

    const storyConflictTypes = result.script.story_structure?.conflicts.map((conflict) => conflict.type) ?? [];
    expect(storyConflictTypes).toContain("mystery");
    expect(storyConflictTypes.every((type) => type === "external")).toBe(false);

    const conflictIds = new Set(result.script.conflicts.map((conflict) => conflict.id));
    expect(result.script.scenes.every((scene) => scene.conflict_ids.every((id) => conflictIds.has(id)))).toBe(true);
    expect(result.script.timeline.some((item) => item.conflict_ids?.some((id) => conflictIds.has(id)))).toBe(true);
  });

  it("normalizes remote scenes that omit setting.location", () => {
    const scene = normalizeScene(
      {
        id: "scene_remote",
        title: "远程场景",
        source: { chapters: ["ch_001"] },
        characters: ["char_001"],
        conflict_ids: ["conflict_001"],
        purpose: "推进冲突",
        beats: ["线索出现"],
        script: [{ type: "action", content: "林晚看向窗外。" }]
      },
      0,
      {
        chapterIds: ["ch_001"],
        characterIds: ["char_001"],
        conflictIds: ["conflict_001"],
        locationIds: ["loc_001"]
      }
    );

    expect(scene.setting.location).toBe("loc_001");
    expect(scene.setting.time).toBe("连续时间");
    expect(scene.setting.atmosphere).toBe("紧张、克制");
  });
});
