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
  StoryStructure,
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
  return text.replace(/\s+/g, " ").trim().slice(0, max) || "本章围绕主要人物的选择与冲突展开。";
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function idFrom(prefix: string, index: number) {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function pickNames(text: string, fallbackPrefix: string) {
  const matches = text.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const blocked = new Set([
    "第一章",
    "第二章",
    "第三章",
    "第四章",
    "第五章",
    "小说",
    "本章",
    "时候",
    "地方",
    "夜晚",
    "清晨",
    "城市"
  ]);
  return unique(matches.filter((name) => !blocked.has(name))).slice(0, 4).length
    ? unique(matches.filter((name) => !blocked.has(name))).slice(0, 4)
    : [`${fallbackPrefix}主角`, `${fallbackPrefix}对手`];
}

function mockChapterAnalysis(chapter: Chapter, index: number): ChapterAnalysis {
  const names = pickNames(chapter.text, `第${index + 1}章`);
  const locationKeywords = ["咖啡馆", "老城区", "车站", "公寓", "雨夜", "医院", "学校"];
  const locations = locationKeywords.filter((item) => chapter.text.includes(item));
  return {
    summary: `${chapter.title}：${sentenceFrom(chapter.text, 120)}`,
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
  const locations = unique(chapters.flatMap((chapter) => chapter.locations ?? [])).slice(0, 5);
  const characters: Character[] = names.map((name, index) => ({
    id: idFrom("char", index),
    name,
    role: index === 0 ? "protagonist" : index === 1 ? "supporting" : "secondary",
    description: `${name}是推动故事冲突的重要人物，行为与选择影响场景走向。`,
    motivation: index === 0 ? "寻找真相并完成自我确认" : "守住自己的秘密或立场",
    relationships:
      index > 0
        ? [
            {
              target: "char_001",
              relation: "与主角存在关键关系"
            }
          ]
        : []
  }));

  const mappedLocations: Location[] = locations.map((name, index) => ({
    id: idFrom("loc", index),
    name,
    type: name.includes("雨") ? "exterior" : "unknown",
    description: `${name}承载故事中的关键行动与情绪氛围。`
  }));

  const timeline: TimelineItem[] = chapters.flatMap((chapter, chapterIndex) =>
    (chapter.key_events ?? []).map((event, eventIndex) => ({
      order: chapterIndex * 10 + eventIndex + 1,
      chapter_id: chapter.id,
      event,
      time: chapterIndex === 0 ? "开端" : "随后",
      conflict_ids: [idFrom("conflict", chapterIndex)],
      impact: eventIndex === 1 ? "推动冲突升级" : "补充冲突背景"
    }))
  );

  const conflicts: Conflict[] = chapters.map((chapter, index) => {
    const relatedTimeline = timeline.filter((item) => item.chapter_id === chapter.id).map((item) => item.order);
    const title = chapter.key_events?.[1] ?? chapter.key_events?.[0] ?? `${chapter.title}核心冲突`;
    const parties = characters.slice(0, Math.min(2, characters.length)).map((character) => character.id);
    return {
      id: idFrom("conflict", index),
      title,
      type: "external",
      description: `${chapter.title}中，人物围绕“${title}”形成推动剧情前进的冲突。`,
      parties: parties.length ? parties : ["char_001"],
      stakes: "如果冲突无法解决，关键线索和人物关系都会继续失控。",
      status: index === chapters.length - 1 ? "escalating" : "active",
      source_chapters: [chapter.id],
      related_timeline: relatedTimeline.length ? relatedTimeline : [timeline[0]?.order ?? 1]
    };
  });

  return {
    characters,
    locations: mappedLocations.length
      ? mappedLocations
      : [
          {
            id: "loc_001",
            name: "主要场景",
            type: "unknown",
            description: "故事主要事件发生的综合场景。"
          }
        ],
    timeline,
    conflicts,
    theme: "人物在压力中寻找真相，并将内心独白转化为可表演的行动。",
  };
}

function buildMockSceneCandidates(chapters: Chapter[], global: GlobalStory): SceneCandidate[] {
  return chapters.map((chapter, index) => {
    const conflict = global.conflicts[index % global.conflicts.length];
    return {
      source_chapter: chapter.id,
      title: `${chapter.title.replace(/^第.+?[章节回]\s*/, "") || `场景${index + 1}`}改编场`,
      location: global.locations[index % global.locations.length]?.id ?? "loc_001",
      time: index === 0 ? "夜晚" : "连续时间",
      characters: global.characters.slice(0, Math.min(2 + index, global.characters.length)).map((item) => item.id),
      conflict_ids: conflict ? [conflict.id] : [],
      dramatic_function: index === 0 ? "建立悬念和人物关系" : "推进主线并加深冲突",
      beats: [
        chapter.key_events?.[0] ?? "人物进入场景",
        chapter.key_events?.[1] ?? "关键线索出现",
        chapter.key_events?.[2] ?? "冲突留下悬念"
      ]
    };
  });
}

function buildMockStoryStructure(chapters: Chapter[], global: GlobalStory): StoryStructure {
  const chapterIds = chapters.map((chapter) => chapter.id);
  const primaryCharacters = global.characters.slice(0, Math.min(2, global.characters.length)).map((item) => item.id);
  const mainCharacter = global.characters[0]?.id;
  const mainConflict = global.conflicts[0]?.description ?? global.conflicts[0]?.title ?? "主角的目标与隐藏真相之间持续发生冲突。";
  return {
    premise: chapters[0]?.summary ?? "主角被关键事件推入一段必须面对真相的旅程。",
    genre: "悬疑剧情",
    logline: `${global.characters[0]?.name ?? "主角"}围绕关键线索追查真相，并在冲突升级中完成选择。`,
    theme: global.theme,
    main_conflict: mainConflict,
    dramatic_question: "主角能否突破阻力，找到隐藏在事件背后的真正答案？",
    acts: chapters.map((chapter, index) => ({
      id: idFrom("act", index),
      name: index === 0 ? "开端" : index === chapters.length - 1 ? "高潮与转折" : "发展",
      purpose: index === 0 ? "建立人物目标和核心悬念" : "推进线索、升级冲突并改变人物处境",
      source_chapters: [chapter.id],
      key_events: chapter.key_events?.length ? chapter.key_events : [`${chapter.title}推动主线发展`]
    })),
    conflicts: global.conflicts.length
      ? global.conflicts.map((conflict) => ({
          id: conflict.id,
          type: conflict.type === "internal" ? "internal" : "external",
          description: conflict.description,
          characters: conflict.parties.length ? conflict.parties : primaryCharacters,
          source_chapters: conflict.source_chapters.length ? conflict.source_chapters : chapterIds,
          status: conflict.status === "resolved" ? "resolved" : "active"
        }))
      : [
          {
            id: "conflict_001",
            type: "external",
            description: mainConflict,
            characters: primaryCharacters.length ? primaryCharacters : global.characters.slice(0, 1).map((item) => item.id),
            source_chapters: chapterIds,
            status: "active"
          }
        ],
    turning_points: chapters.map((chapter, index) => ({
      id: idFrom("tp", index),
      source_chapter: chapter.id,
      event: chapter.key_events?.[chapter.key_events.length - 1] ?? `${chapter.title}留下新的变化`,
      impact: index === 0 ? "主角被迫进入主线行动。" : "人物目标、关系或局势因此发生变化。"
    })),
    character_arcs: mainCharacter
      ? [
          {
            character: mainCharacter,
            start_state: "被动面对异常事件",
            desire: "查清真相并重新掌握选择权",
            obstacle: "外部阻力与被遮蔽的信息持续干扰判断",
            end_state: "主动推进调查并承担后果"
          }
        ]
      : []
  };
}

function buildMockScene(candidate: SceneCandidate, index: number, global: GlobalStory): Scene {
  const firstCharacter = candidate.characters[0] ?? global.characters[0]?.id ?? "char_001";
  const secondCharacter = candidate.characters[1] ?? firstCharacter;
  const conflictText =
    candidate.conflict_ids
      .map((id) => global.conflicts.find((conflict) => conflict.id === id)?.title)
      .filter(Boolean)
      .join("、") || "关键线索";
  return {
    id: idFrom("scene", index),
    title: candidate.title,
    source: {
      chapters: [candidate.source_chapter],
      original_range: `${candidate.source_chapter} 主要情节`
    },
    setting: {
      location: candidate.location,
      time: candidate.time,
      atmosphere: index === 0 ? "悬疑、压抑" : "紧张、克制"
    },
    characters: candidate.characters,
    conflict_ids: candidate.conflict_ids,
    purpose: candidate.dramatic_function,
    beats: candidate.beats,
    script: [
      {
        type: "action",
        content: `场景在${candidate.time}展开，人物围绕“${conflictText}”进入对峙。`
      },
      {
        type: "dialogue",
        character: firstCharacter,
        content: "这件事不能再拖下去了。"
      },
      {
        type: "dialogue",
        character: secondCharacter,
        content: "你看到的只是其中一部分。"
      },
      {
        type: "action",
        content: "短暂沉默后，新的线索把两人的关系推向更紧张的位置。"
      }
    ],
    notes: {
      adaptation_strategy: "保留原文章节的核心事件，将心理描写压缩为行动、停顿和对白。"
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
    system: "你是小说改编流水线中的章节理解器。",
    prompt: `请分析以下章节，输出 JSON：summary, main_characters, locations, key_events, emotional_tone。\n章节标题：${chapter.title}\n章节正文：${chapter.text}`
  });
}

async function buildGlobalStory(provider: AiProvider | null, chapters: Chapter[]) {
  if (!provider) return buildMockGlobalStory(chapters);
  return provider.generateJson<GlobalStory>({
    schemaName: "global_story",
    system: "你是小说改编流水线中的全局故事建模器。",
    prompt: `基于章节摘要生成 characters, locations, timeline, conflicts, theme。人物 id 使用 char_001 格式，地点 id 使用 loc_001 格式，冲突 id 使用 conflict_001 格式。timeline 可用 conflict_ids 引用 conflicts，conflicts.related_timeline 必须引用 timeline.order。\n${JSON.stringify(
      chapters,
      null,
      2
    )}`
  });
}

async function buildStoryStructure(provider: AiProvider | null, chapters: Chapter[], global: GlobalStory) {
  if (!provider) return buildMockStoryStructure(chapters, global);
  return provider.generateJson<StoryStructure>({
    schemaName: "story_structure",
    system: "你是小说改编流水线中的独立剧情结构建模器。",
    prompt: `基于章节摘要和全局故事，输出稳定的 story_structure JSON。字段必须包含 premise, genre, logline, theme, main_conflict, dramatic_question, acts, conflicts, turning_points, character_arcs。source_chapters 和 source_chapter 只能引用已有章节 id，characters 和 character_arcs.character 只能引用已有人物 id。\n章节：${JSON.stringify(
      chapters,
      null,
      2
    )}\n全局故事：${JSON.stringify(global, null, 2)}`
  });
}

async function buildSceneCandidates(
  provider: AiProvider | null,
  chapters: Chapter[],
  global: GlobalStory,
  storyStructure: StoryStructure
) {
  if (!provider) return buildMockSceneCandidates(chapters, global);
  const response = await provider.generateJson<{ items: SceneCandidate[] }>({
    schemaName: "scene_candidates",
    system: "你是小说改编流水线中的场景拆分器。",
    prompt: `请把每章拆分为剧本场景候选，输出 {"items": [...]}。角色、地点和 conflict_ids 必须引用已有 id。\n章节：${JSON.stringify(
      chapters,
      null,
      2
    )}\n全局故事：${JSON.stringify(global, null, 2)}\n剧情结构：${JSON.stringify(storyStructure, null, 2)}`
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
    system: "你是小说到影视剧本的改编器。",
    prompt: `请把场景候选改写为结构化剧本 Scene JSON，必须包含 conflict_ids。script 只允许 action/dialogue/transition，dialogue.character 必须引用人物 id。\n候选：${JSON.stringify(
      candidate,
      null,
      2
    )}\n全局故事：${JSON.stringify(global, null, 2)}`
  });
}

export async function runPipeline(input: PipelineInput) {
  const provider = providerFrom(input);
  const sourceChapters = input.chapters?.length ? input.chapters : splitChapters(input.text);
  const chapters = sourceChapters.length ? sourceChapters : splitChapters(input.text);

  if (chapters.length < 1) {
    throw new Error("请先输入小说文本");
  }

  const analyzedChapters = await Promise.all(
    chapters.map(async (chapter, index) => ({
      ...chapter,
      ...(await analyzeChapter(provider, chapter, index))
    }))
  );

  const global = await buildGlobalStory(provider, analyzedChapters);
  const storyStructure = await buildStoryStructure(provider, analyzedChapters, global);
  const candidates = await buildSceneCandidates(provider, analyzedChapters, global, storyStructure);
  const scenes = await Promise.all(candidates.map((candidate, index) => buildScene(provider, candidate, index, global)));

  const script: ScriptYaml = {
    metadata: {
      title: input.title || "未命名小说改编剧本",
      author: input.author || "原作者",
      generated_by: provider ? "ScriptForge AI" : "ScriptForge Mock Pipeline",
      version: "1.0",
      style: "影视剧"
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
    story_structure: storyStructure,
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
