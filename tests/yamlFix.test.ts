import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/yaml/fix/route";
import { fromYaml } from "@/lib/yaml";
import type { ScriptYaml } from "@/lib/types";

function requestWithYaml(yaml: string) {
  return new Request("http://localhost/api/yaml/fix", {
    method: "POST",
    body: JSON.stringify({ yaml })
  });
}

describe("yaml fix route", () => {
  it("adds conflicts to old yaml and removes invalid conflict references", async () => {
    const response = await POST(
      requestWithYaml(`
metadata:
  title: Sample
  author: Author
  generated_by: test
  version: "1.0"
source:
  chapter_count: 1
  chapters:
    - id: ch_001
      title: Chapter 1
characters:
  - id: char_001
    name: Lin
    role: protagonist
    description: Lead
locations:
  - id: loc_001
    name: Cafe
    type: interior
    description: Room
timeline:
  - order: 1
    chapter_id: ch_001
    event: Message arrives
    conflict_ids:
      - conflict_missing
scenes:
  - id: scene_001
    title: Message scene
    source:
      chapters:
        - ch_001
    setting:
      location: loc_001
      time: Night
      atmosphere: Tense
    characters:
      - char_001
    conflict_ids:
      - conflict_missing
    purpose: Introduce clue
    beats:
      - Message arrives
    script:
      - type: action
        content: Rain falls.
`)
    );

    const payload = (await response.json()) as { yaml: string; validation: { valid: boolean } };
    const parsed = fromYaml(payload.yaml) as ScriptYaml;

    expect(payload.validation.valid).toBe(true);
    expect(parsed.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(parsed.timeline[0].conflict_ids?.every((id) => parsed.conflicts.some((conflict) => conflict.id === id))).toBe(
      true
    );
    expect(parsed.scenes[0].conflict_ids.every((id) => parsed.conflicts.some((conflict) => conflict.id === id))).toBe(
      true
    );
  });
});
