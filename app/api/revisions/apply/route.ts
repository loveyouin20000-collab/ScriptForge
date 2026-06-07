import { NextResponse } from "next/server";
import { validationErrorMessage } from "@/lib/apiErrors";
import { applyRevision, type RevisionInput } from "@/lib/revisions";
import { validateScriptYaml } from "@/lib/schema";
import type { ScriptYaml } from "@/lib/types";
import { fromYaml, toYaml } from "@/lib/yaml";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { yaml: string } & RevisionInput;
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
    if (!body.feedback?.trim()) {
      return NextResponse.json({ error: "请填写反馈内容" }, { status: 400 });
    }

    const result = applyRevision(inputValidation.data, {
      scope: body.scope,
      feedback: body.feedback.trim()
    });

    return NextResponse.json({
      script: result.script,
      yaml: toYaml(result.script),
      diffSummary: result.diffSummary,
      validation: result.validation
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "反馈回写失败"
      },
      { status: 400 }
    );
  }
}
