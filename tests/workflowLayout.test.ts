import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("workflow result layout", () => {
  it("shows chapter review and story structure only on the result overview step", () => {
    const overviewGuardIndex = pageSource.indexOf('workflowStep === "result" && resultSubView === "overview"');
    const chapterReviewIndex = pageSource.indexOf('className="panel chapterReviewPanel"');
    const storyStructureIndex = pageSource.indexOf("<StoryStructureSummary");

    expect(overviewGuardIndex).toBeGreaterThan(-1);
    expect(chapterReviewIndex).toBeGreaterThan(overviewGuardIndex);
    expect(storyStructureIndex).toBeGreaterThan(overviewGuardIndex);
  });

  it("offers restart choices after completing the YAML step", () => {
    expect(pageSource).toContain("完成项目");
    expect(pageSource).toContain("清空输入，开始新项目");
    expect(pageSource).toContain("保留输入，再跑一轮");
  });

  it("renders story structure character arcs with character names", () => {
    expect(pageSource).toContain("characterNameById");
    expect(pageSource).toContain("StoryStructureSummary storyStructure={result?.script.story_structure} characters={result?.script.characters");
  });

  it("uses namespaced story structure keys for model-generated lists", () => {
    expect(pageSource).toContain("storyStructure.acts.map((act, index)");
    expect(pageSource).toContain('key={`act-${act.id}-${index}`}');
    expect(pageSource).toContain("storyStructure.turning_points.map((point, index)");
    expect(pageSource).toContain('key={`turning-point-${point.id}-${index}`}');
    expect(pageSource).toContain("storyStructure.conflicts.map((conflict, index)");
    expect(pageSource).toContain('key={`story-conflict-${conflict.id}-${index}`}');
    expect(pageSource).toContain("storyStructure.character_arcs.map((arc, index)");
    expect(pageSource).toContain('key={`character-arc-${arc.character}-${index}`}');
  });

  it("allows abandoning an active workflow back to the start screen", () => {
    expect(pageSource).toContain("function abandonWorkflow()");
    expect(pageSource).toContain("function resetWorkflowState(");
    expect(pageSource).toContain("放弃改编");
    expect(pageSource).toContain('className="dangerButton abandonWorkflowButton"');
    expect(pageSource).toContain("onClick={() => abandonWorkflow()}");
  });
});
