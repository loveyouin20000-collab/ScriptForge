import { NextResponse } from "next/server";
import { validateScriptYaml } from "@/lib/schema";
import { generateStoryboard } from "@/lib/storyboard";
import type { ScriptYaml } from "@/lib/types";
import { fromYaml, toYaml } from "@/lib/yaml";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { yaml: string };
    const parsed = fromYaml(body.yaml) as ScriptYaml;
    const inputValidation = validateScriptYaml(parsed);
    if (!inputValidation.valid || !inputValidation.data) {
      return NextResponse.json(inputValidation, { status: 400 });
    }

    const script = generateStoryboard(inputValidation.data);
    const validation = validateScriptYaml(script);
    return NextResponse.json({
      script,
      yaml: toYaml(script),
      validation
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "分镜生成失败"
      },
      { status: 400 }
    );
  }
}
