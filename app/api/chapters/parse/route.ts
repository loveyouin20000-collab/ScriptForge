import { NextResponse } from "next/server";
import { OpenAiCompatibleProvider } from "@/lib/ai/openaiProvider";
import { hasRemoteConfig } from "@/lib/ai/provider";
import { parseChaptersWithProvider } from "@/lib/chapterSplitter";
import type { ProviderConfig } from "@/lib/types";

export const runtime = "nodejs";

type ChapterParseInput = {
  text?: string;
  provider?: ProviderConfig;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChapterParseInput;
    if (!body.text?.trim()) {
      throw new Error("请先输入小说文本");
    }

    const provider = hasRemoteConfig(body.provider) ? new OpenAiCompatibleProvider(body.provider ?? {}) : null;
    const chapters = await parseChaptersWithProvider(body.text, provider);

    return NextResponse.json({ chapters });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "章节解析失败"
      },
      { status: 400 }
    );
  }
}
