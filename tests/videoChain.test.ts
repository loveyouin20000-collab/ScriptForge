import { describe, expect, it } from "vitest";
import { applyRevision } from "@/lib/revisions";
import { generateStoryboard } from "@/lib/storyboard";
import { generateVideoPrompts } from "@/lib/videoPrompts";
import { MockVideoProvider } from "@/lib/video/mockProvider";
import type { ScriptYaml } from "@/lib/types";

function validScript(): ScriptYaml {
  return {
    metadata: {
      title: "雨夜旧案",
      author: "原作者",
      generated_by: "test",
      version: "1.0"
    },
    source: {
      chapter_count: 1,
      chapters: [{ id: "ch_001", title: "第一章", summary: "林晚收到短信。" }]
    },
    characters: [
      {
        id: "char_001",
        name: "林晚",
        role: "protagonist",
        description: "追查旧案的年轻作者"
      },
      {
        id: "char_002",
        name: "周沉",
        role: "supporting",
        description: "掌握旧案线索的人"
      }
    ],
    locations: [
      {
        id: "loc_001",
        name: "老城区咖啡馆",
        type: "interior",
        description: "雨夜里昏暗安静的咖啡馆"
      }
    ],
    timeline: [{ order: 1, chapter_id: "ch_001", event: "林晚收到短信", conflict_ids: ["conflict_001"] }],
    conflicts: [
      {
        id: "conflict_001",
        title: "神秘短信引发的对峙",
        type: "external",
        description: "林晚必须判断短信是否与父亲失踪有关。",
        parties: ["char_001", "char_002"],
        stakes: "判断失误会让旧案线索再次断裂。",
        status: "active",
        source_chapters: ["ch_001"],
        related_timeline: [1]
      }
    ],
    scenes: [
      {
        id: "scene_001",
        title: "雨夜重逢",
        source: { chapters: ["ch_001"] },
        setting: {
          location: "loc_001",
          time: "夜晚",
          atmosphere: "悬疑、压抑"
        },
        characters: ["char_001", "char_002"],
        conflict_ids: ["conflict_001"],
        purpose: "引出旧案主线",
        beats: ["林晚收到短信", "周沉出现"],
        script: [
          { type: "action", content: "雨水拍打着咖啡馆的玻璃窗，林晚看着手机里的陌生短信。" },
          { type: "dialogue", character: "char_001", content: "这条短信提到了我父亲。" },
          { type: "dialogue", character: "char_002", content: "今晚之后，你就不能回头了。" }
        ]
      }
    ]
  };
}

describe("video chain", () => {
  it("generates stable storyboard shots from scene script lines", () => {
    const script = generateStoryboard(validScript());

    expect(script.storyboard?.shots).toHaveLength(3);
    expect(script.storyboard?.shots[0]).toMatchObject({
      id: "shot_scene_001_001",
      scene_id: "scene_001",
      source_script_index: 0,
      camera: "static",
      framing: "medium",
      movement: "slow push-in",
      duration_seconds: 4,
      location: "loc_001"
    });
    expect(script.storyboard?.shots[1].characters).toEqual(["char_001"]);
  });

  it("generates reproducible video prompts that reference shot, character and location context", () => {
    const script = generateVideoPrompts(generateStoryboard(validScript()));

    expect(script.video_prompts).toHaveLength(3);
    expect(script.video_prompts?.[0]).toMatchObject({
      id: "prompt_shot_scene_001_001",
      shot_id: "shot_scene_001_001",
      duration_seconds: 4,
      aspect_ratio: "16:9"
    });
    expect(script.video_prompts?.[0].positive).toContain("雨夜重逢");
    expect(script.video_prompts?.[0].positive).toContain("老城区咖啡馆");
    expect(script.video_prompts?.[1].positive).toContain("林晚");
  });

  it("keeps mock video tasks queryable through running and succeeded states", async () => {
    const provider = new MockVideoProvider();
    const submitted = await provider.submit({
      prompt_id: "prompt_shot_scene_001_001",
      prompt: "雨夜咖啡馆，中景，慢慢推进",
      duration_seconds: 4,
      aspect_ratio: "16:9"
    });

    const running = await provider.getTask(submitted.id);
    const succeeded = await provider.getTask(submitted.id);

    expect(submitted.status).toBe("queued");
    expect(running?.status).toBe("running");
    expect(succeeded?.status).toBe("succeeded");
    expect(succeeded?.result_url).toContain("mock-video");
  });

  it("applies feedback only to the selected shot and records a revision log", () => {
    const script = generateVideoPrompts(generateStoryboard(validScript()));
    const result = applyRevision(script, {
      scope: { type: "shot", id: "shot_scene_001_001" },
      feedback: "镜头更贴近窗外雨滴，人物暂时不要入画。"
    });

    expect(result.validation.valid).toBe(true);
    expect(result.script.storyboard?.shots[0].description).toContain("窗外雨滴");
    expect(result.script.storyboard?.shots[1].description).not.toContain("窗外雨滴");
    expect(result.script.revision_log?.[0]).toMatchObject({
      scope: { type: "shot", id: "shot_scene_001_001" },
      feedback: "镜头更贴近窗外雨滴，人物暂时不要入画。"
    });
  });
});
