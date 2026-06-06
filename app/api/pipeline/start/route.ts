import { NextResponse } from "next/server";
import { scriptToMarkdown } from "@/lib/markdown";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PipelineInput;
    const result = await runPipeline(body);
    return NextResponse.json({
      ...result,
      markdown: scriptToMarkdown(result.script)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成失败"
      },
      { status: 400 }
    );
  }
}
