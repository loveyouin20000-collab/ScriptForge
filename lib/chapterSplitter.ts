import type { Chapter } from "./types";
import type { AiProvider } from "./ai/provider";

const CHAPTER_PATTERN =
  /^(?:#{1,3}\s*)?(?:(第\s*[零一二三四五六七八九十百千万两\d]+\s*[章节回])|(?:chapter\s+\d+)|(?:CHAPTER\s+\d+))(?:[\s:：\-—]+(.+))?$/i;

function normalizeTitle(line: string, fallback: string) {
  const clean = line.replace(/^#{1,3}\s*/, "").trim();
  return clean || fallback;
}

function chapterId(index: number) {
  return `ch_${String(index + 1).padStart(3, "0")}`;
}

function normalizeChapters(chapters: Array<Partial<Chapter>>): Chapter[] {
  return chapters
    .filter((chapter) => typeof chapter.title === "string" && typeof chapter.text === "string")
    .map((chapter, index) => ({
      id: chapter.id || chapterId(index),
      title: chapter.title?.trim() || `第${index + 1}章`,
      text: chapter.text?.trim() || chapter.title?.trim() || `第${index + 1}章`
    }));
}

export function splitChapters(text: string): Chapter[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const markers: Array<{ lineIndex: number; title: string }> = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (CHAPTER_PATTERN.test(trimmed)) {
      markers.push({
        lineIndex: index,
        title: normalizeTitle(trimmed, `第${markers.length + 1}章`)
      });
    }
  });

  if (markers.length === 0) {
    const blocks = normalized
      .split(/\n\s*[-=]{3,}\s*\n|\n\s*---chapter---\s*\n/i)
      .map((block) => block.trim())
      .filter(Boolean);

    if (blocks.length > 1) {
      return blocks.map((block, index) => ({
        id: chapterId(index),
        title: `第${index + 1}章`,
        text: block
      }));
    }

    return [
      {
        id: "ch_001",
        title: "未识别章节",
        text: normalized
      }
    ];
  }

  return markers.map((marker, index) => {
    const next = markers[index + 1]?.lineIndex ?? lines.length;
    const body = lines
      .slice(marker.lineIndex + 1, next)
      .join("\n")
      .trim();

    return {
      id: chapterId(index),
      title: marker.title,
      text: body || marker.title
    };
  });
}

export function chaptersFromManualText(text: string): Chapter[] {
  return text
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const [first, ...rest] = block.split("\n");
      const firstLine = first.trim();
      const hasTitle = firstLine.length < 80;
      return {
        id: chapterId(index),
        title: hasTitle ? firstLine : `第${index + 1}章`,
        text: (hasTitle ? rest.join("\n") : block).trim() || block
      };
    });
}

export async function parseChaptersWithProvider(text: string, provider?: AiProvider | null): Promise<Chapter[]> {
  if (!provider) return splitChapters(text);

  const response = await provider.generateJson<{ chapters: Array<Partial<Chapter>> }>({
    schemaName: "chapter_split",
    system: "你是小说改编流水线中的章节边界识别器。",
    prompt: `请将以下小说正文拆分为章节，输出 JSON：{"chapters":[{"title":"章节标题","text":"章节正文"}]}。如果原文没有明确章节标题，请根据情节自然分段，但不要改写原文内容。\n小说正文：\n${text}`
  });
  const chapters = normalizeChapters(response.chapters ?? []);
  return chapters.length ? chapters : splitChapters(text);
}
