import { toYaml } from "@/lib/yaml";
import type { Chapter, ScriptYaml } from "@/lib/types";

export type ChapterReviewItem = {
  chapter: Chapter;
  yaml: string;
};

export function buildChapterReviewItems(script: ScriptYaml, chapters: Chapter[]): ChapterReviewItem[] {
  return chapters.map((chapter) => {
    const sourceChapter = script.source.chapters.find((item) => item.id === chapter.id);
    const chapterScenes = script.scenes.filter((scene) => scene.source.chapters.includes(chapter.id));
    const chapterTimeline = script.timeline.filter((item) => item.chapter_id === chapter.id);
    const chapterTimelineOrders = new Set(chapterTimeline.map((item) => item.order));
    const sceneConflictIds = new Set(chapterScenes.flatMap((scene) => scene.conflict_ids));
    const chapterConflicts = script.conflicts.filter(
      (conflict) =>
        conflict.source_chapters.includes(chapter.id) ||
        conflict.related_timeline.some((order) => chapterTimelineOrders.has(order)) ||
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
