export type WorkflowStepId = "input" | "chapters" | "result";
export type WorkflowDisplayStepId =
  | WorkflowStepId
  | "script"
  | "storyboard"
  | "video"
  | "prompts"
  | "revision"
  | "yaml";

export type WorkflowProgress = {
  started: boolean;
  inputSaved: boolean;
  chaptersSaved: boolean;
  hasResult: boolean;
  activeStep?: WorkflowDisplayStepId;
};

export type WorkflowStep = {
  id: WorkflowDisplayStepId;
  order: number;
  label: string;
  description: string;
  available: boolean;
  active: boolean;
};

export function getWorkflowSteps(progress: WorkflowProgress): WorkflowStep[] {
  const resultAvailable = progress.started && progress.inputSaved && progress.chaptersSaved && progress.hasResult;
  return [
    {
      id: "input",
      order: 1,
      label: "项目输入",
      description: "填写项目信息、导入小说文本。",
      available: progress.started,
      active: progress.activeStep === "input"
    },
    {
      id: "chapters",
      order: 2,
      label: "章节解析",
      description: "识别章节边界，必要时手动调整。",
      available: progress.started && progress.inputSaved,
      active: progress.activeStep === "chapters"
    },
    {
      id: "result",
      order: 3,
      label: "改编结果",
      description: "校验、修复并导出结构化 YAML。",
      available: resultAvailable,
      active: progress.activeStep === "result"
    },
    {
      id: "script",
      order: 4,
      label: "剧本编辑",
      description: "字段级编辑标题、场景和剧本行。",
      available: resultAvailable,
      active: progress.activeStep === "script"
    },
    {
      id: "storyboard",
      order: 5,
      label: "分镜",
      description: "生成并编辑 shot 层级分镜 YAML。",
      available: resultAvailable,
      active: progress.activeStep === "storyboard"
    },
    {
      id: "prompts",
      order: 6,
      label: "Prompt",
      description: "生成并编辑视频模型提示词。",
      available: resultAvailable,
      active: progress.activeStep === "prompts"
    },
    {
      id: "video",
      order: 7,
      label: "视频任务",
      description: "提交 mock 视频任务并刷新结果。",
      available: resultAvailable,
      active: progress.activeStep === "video"
    },
    {
      id: "revision",
      order: 8,
      label: "反馈回写",
      description: "按 scene、shot、prompt 或任务局部回写。",
      available: resultAvailable,
      active: progress.activeStep === "revision"
    },
    {
      id: "yaml",
      order: 9,
      label: "YAML",
      description: "高级结构编辑、校验、修复和导出。",
      available: resultAvailable,
      active: progress.activeStep === "yaml"
    }
  ];
}

export function getCurrentWorkflowSteps(progress: WorkflowProgress): WorkflowStep[] {
  const steps = getWorkflowSteps(progress);
  const active = steps.find((step) => step.active && step.available);
  if (active) return [active];

  const lastAvailable = [...steps].reverse().find((step) => step.available);
  return lastAvailable ? [lastAvailable] : [];
}

export function canAdvanceWorkflowStep({
  activeStep,
  inputSaved,
  chaptersSaved,
  hasYaml,
  allChaptersConfirmed,
  resultSaved,
  savedStep
}: {
  activeStep: WorkflowDisplayStepId;
  inputSaved?: boolean;
  chaptersSaved?: boolean;
  hasYaml: boolean;
  allChaptersConfirmed: boolean;
  resultSaved: boolean;
  savedStep?: WorkflowDisplayStepId | "";
}) {
  if (activeStep === "yaml") return false;
  if (activeStep === "input") return Boolean(inputSaved);
  if (activeStep === "chapters") return Boolean(chaptersSaved);
  return hasYaml && allChaptersConfirmed && resultSaved && savedStep === activeStep;
}

export type WorkflowForwardAction = "advance" | "complete";

export function getWorkflowForwardAction(activeStep: WorkflowDisplayStepId): WorkflowForwardAction {
  return activeStep === "yaml" ? "complete" : "advance";
}

export function getWorkflowCompletion({
  started,
  activeStep,
  completed = false
}: {
  started: boolean;
  activeStep?: WorkflowDisplayStepId;
  completed?: boolean;
}) {
  if (completed) return 100;
  if (!started) return 8;

  const steps = getWorkflowSteps({
    started: true,
    inputSaved: true,
    chaptersSaved: true,
    hasResult: true,
    activeStep
  });
  const activeOrder = steps.find((step) => step.id === activeStep)?.order ?? 1;

  return Math.min(99, Math.round((activeOrder / steps.length) * 100));
}
