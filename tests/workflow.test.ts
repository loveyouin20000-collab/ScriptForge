import { describe, expect, it } from "vitest";
import { canAdvanceWorkflowStep, getCurrentWorkflowSteps, getWorkflowSteps } from "@/lib/workflow";

describe("getWorkflowSteps", () => {
  it("orders the editing and video flow from project input to yaml", () => {
    const steps = getWorkflowSteps({
      started: true,
      inputSaved: true,
      chaptersSaved: true,
      hasResult: true,
      activeStep: "video"
    });

    expect(steps.map((step) => step.id)).toEqual([
      "input",
      "chapters",
      "result",
      "script",
      "storyboard",
      "video",
      "prompts",
      "revision",
      "yaml"
    ]);
    expect(steps.map((step) => step.label)).toEqual([
      "项目输入",
      "章节解析",
      "改编结果",
      "剧本编辑",
      "分镜",
      "视频任务",
      "Prompt",
      "反馈回写",
      "YAML"
    ]);
    expect(steps.every((step) => step.available)).toBe(true);
    expect(steps.find((step) => step.id === "video")?.active).toBe(true);
    expect(steps.find((step) => step.id === "video")?.order).toBe(6);
  });

  it("locks later steps until the previous module is saved", () => {
    expect(
      getWorkflowSteps({
        started: false,
        inputSaved: false,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([false, false, false, false, false, false, false, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: false,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, false, false, false, false, false, false, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: false,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, true, false, false, false, false, false, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: true,
        hasResult: false
      }).map((step) => step.available)
    ).toEqual([true, true, false, false, false, false, false, false, false]);

    expect(
      getWorkflowSteps({
        started: true,
        inputSaved: true,
        chaptersSaved: true,
        hasResult: true
      }).map((step) => step.available)
    ).toEqual([true, true, true, true, true, true, true, true, true]);
  });

  it("marks the active step without making steps behave like navigation controls", () => {
    const steps = getWorkflowSteps({
      started: true,
      inputSaved: true,
      chaptersSaved: false,
      hasResult: false,
      activeStep: "chapters"
    });

    expect(steps.find((step) => step.id === "chapters")?.active).toBe(true);
    expect(steps.filter((step) => step.active)).toHaveLength(1);
  });

  it("exposes only the current step for the workflow panel", () => {
    const steps = getCurrentWorkflowSteps({
      started: true,
      inputSaved: true,
      chaptersSaved: true,
      hasResult: true,
      activeStep: "storyboard"
    });

    expect(steps.map((step) => step.id)).toEqual(["storyboard"]);
    expect(steps[0].order).toBe(5);
    expect(steps[0].label).toBe("分镜");
  });

  it("blocks result-chain next step until chapters are merged and yaml is saved", () => {
    expect(
      canAdvanceWorkflowStep({
        activeStep: "input",
        inputSaved: false,
        chaptersSaved: false,
        hasYaml: false,
        allChaptersConfirmed: false,
        resultSaved: false
      })
    ).toBe(false);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "input",
        inputSaved: true,
        chaptersSaved: false,
        hasYaml: false,
        allChaptersConfirmed: false,
        resultSaved: false
      })
    ).toBe(true);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "result",
        hasYaml: true,
        allChaptersConfirmed: false,
        resultSaved: false
      })
    ).toBe(false);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "script",
        hasYaml: true,
        allChaptersConfirmed: true,
        resultSaved: false
      })
    ).toBe(false);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "script",
        hasYaml: true,
        allChaptersConfirmed: true,
        resultSaved: true,
        savedStep: "result"
      })
    ).toBe(false);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "script",
        hasYaml: true,
        allChaptersConfirmed: true,
        resultSaved: true,
        savedStep: "script"
      })
    ).toBe(true);

    expect(
      canAdvanceWorkflowStep({
        activeStep: "yaml",
        hasYaml: true,
        allChaptersConfirmed: true,
        resultSaved: true,
        savedStep: "yaml"
      })
    ).toBe(false);
  });
});
