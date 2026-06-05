import type { Chapter } from "./types";

const CHAPTER_PATTERN =
  /^(?:#{1,3}\s*)?(?:(第\s*[零一二三四五六七八九十百千万两\d]+\s*[章节回])|(?:chapter\s+\d+)|(?:CHAPTER\s+\d+))(?:[\s:：\-—]+(.+))?$/i;

function normalizeTitle(line: string, fallback: string) {
  const clean = line.replace(/^#{1,3}\s*/, "").trim();
  return clean || fallback;
}

function chapterId(index: number) {
  return `ch_${String(index + 1).padStart(3, "0")}`;
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
