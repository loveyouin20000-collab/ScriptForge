import { OpenAiCompatibleProvider } from "./ai/openaiProvider";
import { hasRemoteConfig, type AiProvider } from "./ai/provider";
import { splitChapters } from "./chapterSplitter";
import { validateScriptYaml } from "./schema";
import type {
  Chapter,
  Character,
  Conflict,
  Location,
  PipelineInput,
  Scene,
  ScriptYaml,
  TimelineItem
} from "./types";
import { toYaml } from "./yaml";

type ChapterAnalysis = Required<
  Pick<Chapter, "summary" | "main_characters" | "locations" | "key_events" | "emotional_tone">
>;

type GlobalStory = {
  characters: Character[];
  locations: Location[];
  timeline: TimelineItem[];
  conflicts: Conflict[];
  theme: string;
};

type SceneCandidate = {
  source_chapter: string;
  title: string;
  location: string;
  time: string;
  characters: string[];
  conflict_ids: string[];
  dramatic_function: string;
  beats: string[];
};

function sentenceFrom(text: string, max = 80) {
  return text.replace(/\s+/g, " ").trim().slice(0, max) || "Chapter focuses on character choices and conflict.";
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function idFrom(prefix: string, index: number) {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function pickNames(text: string, fallbackPrefix: string) {
  const matches = text.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const blocked = new Set(["小说", "本章", "时间", "地方", "夜晚", "清晨", "城市"]);
  const names = unique(matches.filter((name) => !blocked.has(name))).slice(0, 4);
  return names.length ? names : [`${fallbackPrefix}主角`, `${fallbackPrefix}对手`];
}

function mockChapterAnalysis(chapter: Chapter, index: number): ChapterAnalysis {
  const names = pickNames(chapter.text, `第${index + 1}章`);
  const locationKeywords = ["咖啡馆", "老城区", "车站", "公寓", "雨夜", "医院", "学校"];
  const locations = locationKeywords.filter((item) => chapter.text.includes(item));
  return {
    summary: `${chapter.title}: ${sentenceFrom(chapter.text, 120)}`,
    main_characters: names.slice(0, 3),
    locations: locations.length ? locations.slice(0, 3) : ["主要场景"],
    key_events: [
      `${names[0]}面对新的线索`,
      `${names[1] ?? names[0]}推动冲突升级`,
      "章节结尾留下下一步悬念"
    ],
    emotional_tone: chapter.text.includes("雨") ? "悬疑、压抑" : "紧张、克制"
  };
}

function buildMockGlobalStory(chapters: Chapter[]): GlobalStory {
  const names = unique(chapters.flatMap((chapter) => chapter.main_characters ?? [])).slice(0, 5);
  const locationNames = unique(chapters.flatMap((chapter) => chapter.locations ?? [])).slice(0, 5);
  const characters: Character[] = names.map((name, index) => ({
    id: idFrom("char", index),
    name,
    role: index === 0 ? "protagonist" : index === 1 ? "supporting" : "secondary",
    description: `${name} is an important character whose choices shape the scenes.`,
    motivation: index === 0 ? "Find the truth and confirm their own position." : "Protect a secret or stance.",
    relationships:
      index > 0
        ? [
            {
              target: "char_001",
              relation: "Has a key relationship with the protagonist."
            }
          ]
        : []
  }));

  const locations: Location[] = locationNames.map((name, index) => ({
    id: idFrom("loc", index),
    name,
    type: name.includes("雨") ? "exterior" : "unknown",
    description: `${name} carries important actions and emotional atmosphere.`
  }));

  const timeline: TimelineItem[] = chapters.flatMap((chapter, chapterIndex) =>
    (chapter.key_events ?? []).map((event, eventIndex) => ({
      order: chapterIndex * 10 + eventIndex + 1,
      chapter_id: chapter.id,
      event,
      time: chapterIndex === 0 ? "opening" : "later",
      conflict_ids: [idFrom("conflict", chapterIndex)],
      impact: eventIndex === 1 ? "Conflict escalates." : "Story moves forward."
    }))
  );

  const conflicts: Conflict[] = chapters.map((chapter, index) => ({
    id: idFrom("conflict", index),
    title: chapter.key_events?.[1] ?? `${chapter.title} conflict`,
    type: index === 0 ? "external" : "mixed",
    description: chapter.key_events?.[1] ?? "Characters clash around the key clue.",
    parties: characters.slice(0, Math.min(2, characters.length)).map((character) => character.id),
    stakes: "The key clue may be lost and the character relationship may change.",
    status: index === chapters.length - 1 ? "escalating" : "active",
    source_chapters: [chapter.id],
    related_timeline: timeline.filter((item) => item.chapter_id === chapter.id).map((item) => item.order)
  }));

  return {
    characters,
    locations: locations.length
      ? locations
      : [
          {
            id: "loc_001",
            name: "主要场景",
            type: "unknown",
            description: "The main location where story events happen."
          }
        ],
    timeline,
    conflicts,
    theme: "Characters seek truth under pressure and turn inner monologue into playable action."
  };
}

function buildMockSceneCandidates(chapters: Chapter[], global: GlobalStory): SceneCandidate[] {
  return chapters.map((chapter, index) => ({
    source_chapter: chapter.id,
    title: `${chapter.title.replace(/^第.+?[章节回]\s*/, "") || `场景${index + 1}`}改编场`,
    location: global.locations[index % global.locations.length]?.id ?? "loc_001",
    time: index === 0 ? "night" : "continuous time",
    characters: global.characters.slice(0, Math.min(2 + index, global.characters.length)).map((item) => item.id),
    conflict_ids: [global.conflicts[index % global.conflicts.length]?.id ?? "conflict_001"],
    dramatic_function: index === 0 ? "Establish suspense and relationships." : "Advance the main line and deepen conflict.",
    beats: [
      chapter.key_events?.[0] ?? "Characters enter the scene.",
      chapter.key_events?.[1] ?? "A key clue appears.",
      chapter.key_events?.[2] ?? "Conflict leaves suspense."
    ]
  }));
}

function buildMockScene(candidate: SceneCandidate, index: number, global: GlobalStory): Scene {
  const firstCharacter = candidate.characters[0] ?? global.characters[0]?.id ?? "char_001";
  const secondCharacter = candidate.characters[1] ?? firstCharacter;
  const conflict = global.conflicts.find((item) => item.id === candidate.conflict_ids[0]);
  return {
    id: idFrom("scene", index),
    title: candidate.title,
    source: {
      chapters: [candidate.source_chapter],
      original_range: `${candidate.source_chapter} main plot`
    },
    setting: {
      location: candidate.location,
      time: candidate.time,
      atmosphere: index === 0 ? "suspenseful, oppressive" : "tense, restrained"
    },
    characters: candidate.characters,
    conflict_ids: candidate.conflict_ids,
    purpose: candidate.dramatic_function,
    beats: candidate.beats,
    script: [
      {
        type: "action",
        content: `The scene unfolds at ${candidate.time}; characters enter conflict around "${conflict?.title ?? "the key clue"}".`
      },
      {
        type: "dialogue",
        character: firstCharacter,
        content: "We cannot delay this any longer."
      },
      {
        type: "dialogue",
        character: secondCharacter,
        content: "You have only seen part of it."
      },
      {
        type: "action",
        content: "After a short silence, the new clue pushes their relationship into a tighter position."
      }
    ],
    notes: {
      adaptation_strategy: "Keep the core chapter event and compress inner description into action, pauses, and dialogue."
    }
  };
}

function providerFrom(input: PipelineInput): AiProvider | null {
  return hasRemoteConfig(input.provider) ? new OpenAiCompatibleProvider(input.provider ?? {}) : null;
}

async function analyzeChapter(provider: AiProvider | null, chapter: Chapter, index: number) {
  if (!provider) return mockChapterAnalysis(chapter, index);
  return provider.generateJson<ChapterAnalysis>({
    schemaName: "chapter_analysis",
    system: "You are the chapter understanding module in a novel-to-script adaptation pipeline.",
    prompt: `Analyze the chapter and output JSON with summary, main_characters, locations, key_events, emotional_tone.\nChapter title: ${chapter.title}\nChapter text: ${chapter.text}`
  });
}

async function buildGlobalStory(provider: AiProvider | null, chapters: Chapter[]) {
  if (!provider) return buildMockGlobalStory(chapters);
  return provider.generateJson<GlobalStory>({
    schemaName: "global_story",
    system: "You are the global story modeling module in a novel-to-script adaptation pipeline.",
    prompt: `Based on chapter summaries, generate JSON with characters, locations, timeline, conflicts, and theme.
Use character ids like char_001, location ids like loc_001, and conflict ids like conflict_001.
timeline items may include conflict_ids. conflicts must include id, title, type, description, parties, stakes, status, source_chapters, related_timeline.
All parties must reference character ids. source_chapters must reference chapter ids. related_timeline must reference timeline order numbers.
Do not output main_conflict; conflicts is the first-class conflict model.
Chapters:
${JSON.stringify(chapters, null, 2)}`
  });
}

async function buildSceneCandidates(provider: AiProvider | null, chapters: Chapter[], global: GlobalStory) {
  if (!provider) return buildMockSceneCandidates(chapters, global);
  const response = await provider.generateJson<{ items: SceneCandidate[] }>({
    schemaName: "scene_candidates",
    system: "You are the scene breakdown module in a novel-to-script adaptation pipeline.",
    prompt: `Break each chapter into script scene candidates and output {"items": [...]}.
Each item must include source_chapter, title, location, time, characters, conflict_ids, dramatic_function, beats.
characters, location, and conflict_ids must reference existing ids from the global story.
Chapters:
${JSON.stringify(chapters, null, 2)}
Global story:
${JSON.stringify(global, null, 2)}`
  });
  return response.items;
}

async function buildScene(
  provider: AiProvider | null,
  candidate: SceneCandidate,
  index: number,
  global: GlobalStory
) {
  if (!provider) return buildMockScene(candidate, index, global);
  return provider.generateJson<Scene>({
    schemaName: "script_scene",
    system: "You adapt novel scene candidates into structured script scenes.",
    prompt: `Rewrite the scene candidate as a structured Scene JSON.
The Scene must include id, title, source, setting, characters, conflict_ids, purpose, beats, script, and optional notes.
script only allows action, dialogue, and transition. dialogue.character must reference a character id.
conflict_ids must reference existing conflict ids.
Candidate:
${JSON.stringify(candidate, null, 2)}
Global story:
${JSON.stringify(global, null, 2)}`
  });
}

export async function runPipeline(input: PipelineInput) {
  const provider = providerFrom(input);
  const sourceChapters = input.chapters?.length ? input.chapters : splitChapters(input.text);
  const chapters = sourceChapters.length ? sourceChapters : splitChapters(input.text);

  if (chapters.length < 1) {
    throw new Error("Please enter novel text first.");
  }

  const analyzedChapters = await Promise.all(
    chapters.map(async (chapter, index) => ({
      ...chapter,
      ...(await analyzeChapter(provider, chapter, index))
    }))
  );

  const global = await buildGlobalStory(provider, analyzedChapters);
  const candidates = await buildSceneCandidates(provider, analyzedChapters, global);
  const scenes = await Promise.all(candidates.map((candidate, index) => buildScene(provider, candidate, index, global)));

  const script: ScriptYaml = {
    metadata: {
      title: input.title || "Untitled adaptation script",
      author: input.author || "Original author",
      generated_by: provider ? "ScriptForge AI" : "ScriptForge Mock Pipeline",
      version: "1.0",
      style: "screen drama"
    },
    source: {
      chapter_count: analyzedChapters.length,
      chapters: analyzedChapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary
      }))
    },
    characters: global.characters,
    locations: global.locations,
    timeline: global.timeline,
    conflicts: global.conflicts,
    scenes
  };

  const validation = validateScriptYaml(script);
  return {
    script,
    yaml: toYaml(script),
    chapters: analyzedChapters,
    global,
    validation
  };
}
