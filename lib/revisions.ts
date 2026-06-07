import { validateScriptYaml } from "./schema";
import type { RevisionScope, ScriptYaml, ValidationIssue } from "./types";

export type RevisionInput = {
  scope: RevisionScope;
  feedback: string;
};

export type RevisionResult = {
  script: ScriptYaml;
  diffSummary: string;
  validation: {
    valid: boolean;
    data?: ScriptYaml;
    issues: ValidationIssue[];
  };
};

function revisionId(length: number) {
  return `revision_${String(length + 1).padStart(3, "0")}`;
}

function createRevision(script: ScriptYaml, input: RevisionInput, action: string) {
  return {
    id: revisionId(script.revision_log?.length ?? 0),
    scope: input.scope,
    feedback: input.feedback,
    action,
    created_at: new Date().toISOString()
  };
}

export function applyRevision(script: ScriptYaml, input: RevisionInput): RevisionResult {
  const next: ScriptYaml = {
    ...script,
    scenes: script.scenes.map((scene) => ({ ...scene })),
    storyboard: script.storyboard
      ? {
          shots: script.storyboard.shots.map((shot) => ({ ...shot }))
        }
      : undefined,
    video_prompts: script.video_prompts?.map((prompt) => ({ ...prompt })),
    video_tasks: script.video_tasks?.map((task) => ({ ...task })),
    revision_log: [...(script.revision_log ?? [])]
  };

  let action = "recorded_feedback";
  let diffSummary = "已记录反馈。";

  if (input.scope.type === "scene") {
    next.scenes = next.scenes.map((scene) =>
      scene.id === input.scope.id
        ? {
            ...scene,
            feedback: [...(scene.feedback ?? []), input.feedback],
            revision_status: "needs_review"
          }
        : scene
    );
    action = "updated_scene_feedback";
    diffSummary = `已把反馈写入场景 ${input.scope.id}。`;
  }

  if (input.scope.type === "shot" && next.storyboard) {
    next.storyboard = {
      shots: next.storyboard.shots.map((shot) =>
        shot.id === input.scope.id
          ? {
              ...shot,
              description: `${shot.description} 作者反馈：${input.feedback}`
            }
          : shot
      )
    };
    action = "updated_shot";
    diffSummary = `已更新镜头 ${input.scope.id} 的描述。`;
  }

  if (input.scope.type === "prompt" && next.video_prompts) {
    next.video_prompts = next.video_prompts.map((prompt) =>
      prompt.id === input.scope.id
        ? {
            ...prompt,
            model_notes: `${prompt.model_notes} 作者反馈：${input.feedback}`
          }
        : prompt
    );
    action = "updated_prompt";
    diffSummary = `已更新 Prompt ${input.scope.id} 的模型备注。`;
  }

  if (input.scope.type === "video_task" && next.video_tasks) {
    next.video_tasks = next.video_tasks.map((task) =>
      task.id === input.scope.id
        ? {
            ...task,
            error: task.error ? `${task.error}；作者反馈：${input.feedback}` : `作者反馈：${input.feedback}`,
            updated_at: new Date().toISOString()
          }
        : task
    );
    action = "updated_video_task_note";
    diffSummary = `已把反馈记录到视频任务 ${input.scope.id}。`;
  }

  next.revision_log = [createRevision(script, input, action), ...(next.revision_log ?? [])];

  return {
    script: next,
    diffSummary,
    validation: validateScriptYaml(next)
  };
}
