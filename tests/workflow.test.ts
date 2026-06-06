import { describe, expect, it } from "vitest";
import { getWorkflowSteps } from "@/lib/workflow";

describe("getWorkflowSteps", () => {
  it("orders the editing flow as project input, chapter parsing, and adaptation result", () => {
    const steps = getWorkflowSteps({
      started: true,
      inputSaved: true,
      chaptersSaved: true,
      hasResult: true
    });

    expect(steps.map((step) => step.id)).toEqual(["input", "chapters", "result"]);
    expect(steps.map((step) => step.label)).toEqual(["项目输入", "章节解析", "改编结果"]);
    expect(steps.every((step) => step.available)).toBe(true);
  });

  it("locks later steps until the previous module is saved", () => {
    expect(
      getWorkflowSteps({
        started: false,
        inputSaved: false,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([false, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: false,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, true, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: true,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, true, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: true,
        hasResult: true
      }).map((step) => step.available)
    ).toEqual([true, true, true]);
  });

  it("marks the active step without making steps behave like navigation controls", () => {
    const steps = getWorkflowSteps({
      started: true,
      inputSaved: true,
      chaptersSaved: false,
      hasResult: false,
      activeStep: "chapters"
    });

    expect(steps.map((step) => [step.id, step.active])).toEqual([
      ["input", false],
      ["chapters", true],
      ["result", false]
    ]);
  });
});
