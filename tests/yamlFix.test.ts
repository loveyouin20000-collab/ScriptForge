import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/yaml/fix/route";
import { fromYaml } from "@/lib/yaml";

describe("POST /api/yaml/fix", () => {
  it("adds conflicts to old yaml and keeps scene and timeline conflict references valid", async () => {
    const yaml = `
metadata:
  title: 雨夜旧案
  author: 原作者
  generated_by: test
  version: "1.0"
source:
  chapter_count: 1
  chapters:
    - id: ch_001
      title: 第一章
      summary: 收到短信
characters:
  - id: char_001
    name: 林晚
    role: protagonist
    description: 主角
locations:
  - id: loc_001
    name: 咖啡馆
    type: interior
    description: 雨夜空间
timeline:
  - order: 1
    chapter_id: ch_001
    event: 收到短信
    scene_id: scene_missing
    conflict_ids:
      - conflict_missing
scenes:
  - id: scene_001
    title: 雨夜
    source:
      chapters:
        - ch_001
    setting:
      location: loc_001
      time: 夜晚
      atmosphere: 悬疑
    characters:
      - char_001
    conflict_ids:
      - conflict_missing
    purpose: 引出悬念
    beats:
      - 等待
    script:
      - type: action
        content: 雨水滑落
`;

    const response = await POST(
      new Request("http://localhost/api/yaml/fix", {
        method: "POST",
        body: JSON.stringify({ yaml })
      })
    );
    const body = await response.json();
    const repaired = fromYaml(body.yaml) as {
      conflicts: Array<{ id: string }>;
      timeline: Array<{ scene_id?: string; conflict_ids?: string[] }>;
      scenes: Array<{ conflict_ids: string[] }>;
    };
    const conflictIds = new Set(repaired.conflicts.map((conflict) => conflict.id));

    expect(body.validation.valid).toBe(true);
    expect(repaired.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(repaired.timeline[0].scene_id).toBeUndefined();
    expect(repaired.timeline[0].conflict_ids?.every((id) => conflictIds.has(id))).toBe(true);
    expect(repaired.scenes[0].conflict_ids.every((id) => conflictIds.has(id))).toBe(true);
  });
});
