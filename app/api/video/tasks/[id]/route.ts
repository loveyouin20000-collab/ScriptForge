import { NextResponse } from "next/server";
import { defaultMockVideoProvider } from "@/lib/video/mockProvider";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await defaultMockVideoProvider.getTask(id);
  if (!task) {
    return NextResponse.json({ error: "视频任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ task });
}
