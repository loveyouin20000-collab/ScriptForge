import { describe, expect, it } from "vitest";
import { normalizeGlobalStory, normalizeScene, normalizeStoryStructure } from "@/lib/pipeline";
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

  it("normalizes remote global story fields that omit required schema data", () => {
    const global = normalizeGlobalStory(
      {
        characters: [{ id: "char_001", name: "林晚" }],
        locations: [{ id: "loc_001", name: "咖啡馆" }],
        timeline: [{ order: 1, event: "收到短信" }],
        conflicts: [{ id: "conflict_001", description: "短信引出旧案" }],
        theme: "追查真相"
      },
      [
        { id: "ch_001", title: "第一章 雨夜", text: "林晚收到短信。", key_events: ["收到短信"] }
      ]
    );

    expect(global.locations[0]).toMatchObject({ type: "unknown", description: "咖啡馆承载故事中的关键行动与情绪氛围。" });
    expect(global.timeline[0]).toMatchObject({ chapter_id: "ch_001", conflict_ids: ["conflict_001"] });
    expect(global.conflicts[0]).toMatchObject({
      title: "短信引出旧案",
      parties: ["char_001"],
      stakes: "如果冲突无法解决，关键线索和人物关系都会继续失控。",
      status: "active",
      source_chapters: ["ch_001"]
    });
  });

  it("normalizes remote story structure arrays into full objects", () => {
    const global = normalizeGlobalStory(
      {
        characters: [{ id: "char_001", name: "林晚" }],
        locations: [{ id: "loc_001", name: "咖啡馆" }],
        timeline: [{ order: 1, chapter_id: "ch_001", event: "收到短信", conflict_ids: ["conflict_001"] }],
        conflicts: [{ id: "conflict_001", title: "短信引出旧案", description: "短信引出旧案", parties: ["char_001"] }],
        theme: "追查真相"
      },
      [{ id: "ch_001", title: "第一章 雨夜", text: "林晚收到短信。", key_events: ["收到短信"] }]
    );

    const storyStructure = normalizeStoryStructure(
      {
        premise: "林晚收到短信。",
        acts: [{ id: "act_001" }],
        conflicts: ["短信引出旧案"],
        turning_points: [{ }],
        character_arcs: [{ character: "char_001" }]
      },
      [{ id: "ch_001", title: "第一章 雨夜", text: "林晚收到短信。", key_events: ["收到短信"] }],
      global
    );

    expect(storyStructure.acts[0]).toMatchObject({
      id: "act_001",
      name: "开端",
      purpose: "建立人物目标和核心悬念",
      source_chapters: ["ch_001"],
      key_events: ["收到短信"]
    });
    expect(storyStructure.conflicts[0]).toMatchObject({
      id: "conflict_001",
      type: "mystery",
      description: "短信引出旧案",
      characters: ["char_001"],
      source_chapters: ["ch_001"],
      status: "active"
    });
    expect(storyStructure.turning_points[0]).toMatchObject({
      id: "tp_001",
      source_chapter: "ch_001",
      event: "收到短信"
    });
    expect(storyStructure.character_arcs[0]).toMatchObject({
      character: "char_001",
      start_state: "被动面对异常事件",
      desire: "查清真相并重新掌握选择权",
      obstacle: "外部阻力与被遮蔽的信息持续干扰判断",
      end_state: "主动推进调查并承担后果"
    });
  });
});
