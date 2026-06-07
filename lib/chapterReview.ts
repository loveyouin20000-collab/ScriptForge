import { toYaml } from "@/lib/yaml";
import type { Chapter, ScriptYaml } from "@/lib/types";

export type ChapterReviewItem = {
  chapter: Chapter;
  yaml: string;
};

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function buildChapterReviewItems(script: ScriptYaml, chapters: Chapter[]): ChapterReviewItem[] {
  return chapters.map((chapter) => {
    const sourceChapter = ensureArray(script.source?.chapters).find((item) => item.id === chapter.id);
    const chapterScenes = ensureArray(script.scenes).filter((scene) =>
      ensureArray(scene.source?.chapters).includes(chapter.id)
    );
    const chapterTimeline = ensureArray(script.timeline).filter((item) => item.chapter_id === chapter.id);
    const chapterTimelineOrders = new Set(chapterTimeline.map((item) => item.order));
    const sceneConflictIds = new Set(chapterScenes.flatMap((scene) => ensureArray(scene.conflict_ids)));
    const chapterConflicts = ensureArray(script.conflicts).filter(
      (conflict) =>
        ensureArray(conflict.source_chapters).includes(chapter.id) ||
        ensureArray(conflict.related_timeline).some((order) => chapterTimelineOrders.has(order)) ||
        sceneConflictIds.has(conflict.id)
    );

    return {
      chapter,
      yaml: toYaml({
        source: sourceChapter ? { chapters: [sourceChapter] } : { chapters: [] },
        timeline: chapterTimeline,
        conflicts: chapterConflicts,
        scenes: chapterScenes
      })
    };
  });
}
