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

    return {
      chapter,
      yaml: toYaml({
        source: sourceChapter ? { chapters: [sourceChapter] } : { chapters: [] },
        timeline: chapterTimeline,
        scenes: chapterScenes
      })
    };
  });
}
