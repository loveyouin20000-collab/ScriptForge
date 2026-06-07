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
});
