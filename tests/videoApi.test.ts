import { describe, expect, it } from "vitest";
import { POST as applyRevisionRoute } from "@/app/api/revisions/apply/route";
import { POST as generateStoryboardRoute } from "@/app/api/storyboard/generate/route";
import { POST as createVideoTasksRoute } from "@/app/api/video/tasks/route";
import { POST as generateVideoPromptsRoute } from "@/app/api/video-prompts/generate/route";
import { toYaml } from "@/lib/yaml";
import type { ScriptYaml } from "@/lib/types";

function request(body: unknown) {
  return new Request("http://scriptforge.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

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
    characters: [{ id: "char_001", name: "林晚", role: "protagonist", description: "追查旧案的年轻作者" }],
    locations: [{ id: "loc_001", name: "咖啡馆", type: "interior", description: "雨夜里的咖啡馆" }],
    timeline: [{ order: 1, chapter_id: "ch_001", event: "林晚收到短信", conflict_ids: ["conflict_001"] }],
    conflicts: [
      {
        id: "conflict_001",
        title: "神秘短信引发的对峙",
        type: "external",
        description: "林晚必须判断短信是否与父亲失踪有关。",
        parties: ["char_001"],
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
        setting: { location: "loc_001", time: "夜晚", atmosphere: "悬疑、压抑" },
        characters: ["char_001"],
        conflict_ids: ["conflict_001"],
        purpose: "引出旧案主线",
        beats: ["林晚收到短信"],
        script: [{ type: "action", content: "雨水拍打着咖啡馆的玻璃窗。" }]
      }
    ]
  };
}

describe("video chain API routes", () => {
  it("generates storyboard yaml from input yaml", async () => {
    const response = await generateStoryboardRoute(request({ yaml: toYaml(validScript()) }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.validation.valid).toBe(true);
    expect(payload.script.storyboard.shots[0].id).toBe("shot_scene_001_001");
    expect(payload.yaml).toContain("storyboard:");
  });

  it("generates prompts and submits mock video tasks", async () => {
    const promptsResponse = await generateVideoPromptsRoute(request({ yaml: toYaml(validScript()) }));
    const promptsPayload = await promptsResponse.json();

    const tasksResponse = await createVideoTasksRoute(request({ yaml: promptsPayload.yaml }));
    const tasksPayload = await tasksResponse.json();

    expect(promptsPayload.validation.valid).toBe(true);
    expect(tasksResponse.status).toBe(200);
    expect(tasksPayload.validation.valid).toBe(true);
    expect(tasksPayload.script.video_tasks[0]).toMatchObject({
      provider: "mock",
      status: "queued",
      prompt_id: "prompt_shot_scene_001_001"
    });
  });

  it("applies revision feedback through the API", async () => {
    const promptsResponse = await generateVideoPromptsRoute(request({ yaml: toYaml(validScript()) }));
    const promptsPayload = await promptsResponse.json();

    const response = await applyRevisionRoute(
      request({
        yaml: promptsPayload.yaml,
        scope: { type: "shot", id: "shot_scene_001_001" },
        feedback: "强调雨滴特写。"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.validation.valid).toBe(true);
    expect(payload.script.revision_log[0].feedback).toBe("强调雨滴特写。");
    expect(payload.diffSummary).toContain("shot_scene_001_001");
  });

  it("returns a clear error when storyboard input yaml fails validation", async () => {
    const script = validScript();
    script.scenes[0].characters = ["char_missing"];

    const response = await generateStoryboardRoute(request({ yaml: toYaml(script) }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("YAML 校验未通过");
    expect(payload.error).toContain("scenes.0.characters.0");
  });
});
