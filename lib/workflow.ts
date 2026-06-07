export type WorkflowStepId = "input" | "chapters" | "result";

export type WorkflowProgress = {
  started: boolean;
  inputSaved: boolean;
  chaptersSaved: boolean;
  hasResult: boolean;
  activeStep?: WorkflowStepId;
};

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  description: string;
  available: boolean;
  active: boolean;
};

export function getWorkflowSteps(progress: WorkflowProgress): WorkflowStep[] {
  return [
    {
      id: "input",
      label: "项目输入",
      description: "填写项目信息、导入小说文本。",
      available: progress.started,
      active: progress.activeStep === "input"
    },
    {
      id: "chapters",
      label: "章节解析",
      description: "识别章节边界，必要时手动调整。",
      available: progress.started && progress.inputSaved,
      active: progress.activeStep === "chapters"
    },
    {
      id: "result",
      label: "改编结果",
      description: "校验、修复并导出结构化 YAML。",
      available: progress.started && progress.inputSaved && progress.chaptersSaved && progress.hasResult,
      active: progress.activeStep === "result"
    }
  ];
}
