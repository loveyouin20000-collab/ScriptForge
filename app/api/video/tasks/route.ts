import { NextResponse } from "next/server";
import { validationErrorMessage } from "@/lib/apiErrors";
import { validateScriptYaml } from "@/lib/schema";
import type { ScriptYaml } from "@/lib/types";
import { defaultMockVideoProvider } from "@/lib/video/mockProvider";
import { generateVideoPrompts } from "@/lib/videoPrompts";
import { fromYaml, toYaml } from "@/lib/yaml";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { yaml: string; promptIds?: string[] };
    const parsed = fromYaml(body.yaml) as ScriptYaml;
    const inputValidation = validateScriptYaml(parsed);
    if (!inputValidation.valid || !inputValidation.data) {
      return NextResponse.json(
        {
          ...inputValidation,
          error: validationErrorMessage(inputValidation.issues)
        },
        { status: 400 }
      );
    }

    const scriptWithPrompts = inputValidation.data.video_prompts?.length
      ? inputValidation.data
      : generateVideoPrompts(inputValidation.data);
    const selectedPromptIds = new Set(body.promptIds ?? scriptWithPrompts.video_prompts?.map((prompt) => prompt.id) ?? []);
    const selectedPrompts = (scriptWithPrompts.video_prompts ?? []).filter((prompt) => selectedPromptIds.has(prompt.id));
    const tasks = await Promise.all(
      selectedPrompts.map((prompt) =>
        defaultMockVideoProvider.submit({
          prompt_id: prompt.id,
          prompt: prompt.positive,
          negative_prompt: prompt.negative,
          duration_seconds: prompt.duration_seconds,
          aspect_ratio: prompt.aspect_ratio
        })
      )
    );
    const script: ScriptYaml = {
      ...scriptWithPrompts,
      video_tasks: [...(scriptWithPrompts.video_tasks ?? []), ...tasks]
    };
    const validation = validateScriptYaml(script);

    return NextResponse.json({
      script,
      yaml: toYaml(script),
      validation
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "视频任务提交失败"
      },
      { status: 400 }
    );
  }
}
