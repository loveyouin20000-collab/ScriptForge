import { NextResponse } from "next/server";
import { validateScriptYaml } from "@/lib/schema";
import { fromYaml } from "@/lib/yaml";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { yaml: string };
    const parsed = fromYaml(body.yaml);
    const validation = validateScriptYaml(parsed);
    return NextResponse.json(validation);
  } catch (error) {
    return NextResponse.json({
      valid: false,
      issues: [
        {
          path: "yaml",
          message: error instanceof Error ? error.message : "YAML 解析失败"
        }
      ]
    });
  }
}
