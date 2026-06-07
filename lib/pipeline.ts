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

export type GlobalStory = {
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

type SceneNormalizationRefs = {
  chapterIds: string[];
  characterIds: string[];
  conflictIds: string[];
  locationIds: string[];
};

type StoryConflictType = StoryStructure["conflicts"][number]["type"];

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
  const actionNameMatches = Array.from(
    text.matchAll(/([\u4e00-\u9fa5]{2,3})(?=在|和|把|却|提醒|收到|出现|找到|决定|独自|看见|拿给|沉默|发现|追查|重启|进入|离开)/g)
  ).map((match) => match[1]);
  const matches = actionNameMatches.length ? actionNameMatches : text.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const blocked = new Set([
    "第一章",
    "第二章",
    "第三章",
    "第四章",
    "第五章",
    "咖啡馆",
    "老城区",
    "短信",
    "旧案",
    "证人",
    "线索",
    "真相",
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

function mockTurningEvent(chapter: Chapter, names: string[]) {
  const leadName = names[0] ?? "主角";
  const allyName = names.find((name) => name !== leadName) ?? leadName;
  const chapterText = `${chapter.title} ${chapter.text}`;

  if (/证人|消失/.test(chapterText)) return "关键证人消失，调查阻力浮出水面";
  if (/旧案|重启/.test(chapterText)) return `${leadName}与${allyName}决定重启旧案调查`;
  if (/短信|陌生/.test(chapterText)) return `${leadName}收到神秘短信，旧案线索被重新点燃`;
  if (/真相|线索/.test(chapterText)) return `${leadName}抓住关键线索，距离真相更近一步`;
  return `${chapter.title}结尾出现新的行动压力`;
}

function inferConflictType(text: string): StoryConflictType {
  if (/内心|恐惧|犹豫|愧疚|选择/.test(text)) return "internal";
  if (/父亲|旧爱|朋友|关系|信任|背叛/.test(text)) return "relationship";
  if (/短信|旧案|证人|真相|线索|失踪|神秘|调查/.test(text)) return "mystery";
  if (/组织|家族|公司|制度|舆论/.test(text)) return "social";
  return "external";
}

function normalizeStoryConflictType(type: string): StoryConflictType {
  if (type === "internal" || type === "relationship" || type === "social" || type === "mystery") return type;
  return "external";
}

function normalizeStoryConflictStatus(status: unknown): StoryStructure["conflicts"][number]["status"] {
  if (status === "resolved" || status === "latent") return status;
  return "active";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function numberList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
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
      mockTurningEvent(chapter, names)
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
    const conflictType = inferConflictType(`${chapter.title} ${chapter.text} ${title}`);
    return {
      id: idFrom("conflict", index),
      title,
      type: conflictType,
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

export function normalizeGlobalStory(input: unknown, chapters: Chapter[]): GlobalStory {
  const source = asRecord(input);
  const chapterIds = chapters.map((chapter) => chapter.id);
  const fallbackChapterId = chapterIds[0] ?? "ch_001";
  const rawCharacters = Array.isArray(source.characters) ? source.characters : [];
  const fallbackNames = unique(chapters.flatMap((chapter) => chapter.main_characters ?? [])).slice(0, 2);
  const characters: Character[] = (rawCharacters.length ? rawCharacters : fallbackNames).map((item, index) => {
    const character = asRecord(item);
    const name = typeof item === "string" ? item : stringValue(character.name, `角色${index + 1}`);
    return {
      id: stringValue(character.id, idFrom("char", index)),
      name,
      role: stringValue(character.role, index === 0 ? "protagonist" : "supporting"),
      description: stringValue(character.description, `${name}是推动故事冲突的重要人物。`),
      motivation: typeof character.motivation === "string" ? character.motivation : undefined,
      relationships: Array.isArray(character.relationships) ? (character.relationships as Character["relationships"]) : []
    };
  });
  const normalizedCharacters = characters.length
    ? characters
    : [
        {
          id: "char_001",
          name: "主角",
          role: "protagonist",
          description: "推动故事主线的人物。"
        }
      ];
  const characterIds = normalizedCharacters.map((character) => character.id);

  const rawLocations = Array.isArray(source.locations) ? source.locations : unique(chapters.flatMap((chapter) => chapter.locations ?? []));
  const locations: Location[] = (rawLocations.length ? rawLocations : ["主要场景"]).map((item, index) => {
    const location = asRecord(item);
    const name = typeof item === "string" ? item : stringValue(location.name, `场景${index + 1}`);
    const type = location.type === "interior" || location.type === "exterior" || location.type === "mixed" ? location.type : "unknown";
    return {
      id: stringValue(location.id, idFrom("loc", index)),
      name,
      type,
      description: stringValue(location.description, `${name}承载故事中的关键行动与情绪氛围。`)
    };
  });

  const rawConflicts = Array.isArray(source.conflicts) && source.conflicts.length ? source.conflicts : chapters;
  const conflictIds = rawConflicts.map((item, index) => stringValue(asRecord(item).id, idFrom("conflict", index)));
  const rawTimeline = Array.isArray(source.timeline) && source.timeline.length ? source.timeline : chapters;
  const timeline: TimelineItem[] = rawTimeline.map((item, index) => {
    const event = asRecord(item);
    const chapter = chapters[index % Math.max(chapters.length, 1)];
    const order = typeof event.order === "number" && Number.isFinite(event.order) ? event.order : index + 1;
    return {
      order,
      chapter_id: chapterIds.includes(String(event.chapter_id)) ? String(event.chapter_id) : chapter?.id ?? fallbackChapterId,
      event: stringValue(event.event, chapter?.key_events?.[0] ?? chapter?.title ?? "关键事件推进"),
      time: typeof event.time === "string" ? event.time : index === 0 ? "开端" : "随后",
      scene_id: typeof event.scene_id === "string" ? event.scene_id : undefined,
      conflict_ids: existingList(event.conflict_ids, conflictIds, [conflictIds[index % conflictIds.length] ?? "conflict_001"]),
      impact: typeof event.impact === "string" ? event.impact : "推动剧情继续发展"
    };
  });
  const timelineOrders = timeline.map((item) => item.order);

  const conflicts: Conflict[] = rawConflicts.map((item, index) => {
    const conflict = asRecord(item);
    const chapter = chapters[index % Math.max(chapters.length, 1)];
    const rawText = typeof item === "string" ? item : "";
    const description = stringValue(conflict.description, rawText || chapter?.key_events?.[0] || `${chapter?.title ?? "故事"}核心冲突`);
    const title = stringValue(conflict.title, description);
    const sourceChapters = existingList(conflict.source_chapters, chapterIds, [chapter?.id ?? fallbackChapterId]);
    const relatedTimeline = numberList(conflict.related_timeline).filter((order) => timelineOrders.includes(order));

    return {
      id: stringValue(conflict.id, idFrom("conflict", index)),
      title,
      type: stringValue(conflict.type, inferConflictType(`${title} ${description}`)),
      description,
      parties: existingList(conflict.parties, characterIds, [characterIds[0] ?? "char_001"]),
      stakes: stringValue(conflict.stakes, "如果冲突无法解决，关键线索和人物关系都会继续失控。"),
      status: stringValue(conflict.status, "active"),
      source_chapters: sourceChapters,
      related_timeline: relatedTimeline.length ? relatedTimeline : [timelineOrders[index % timelineOrders.length] ?? 1]
    };
  });

  return {
    characters: normalizedCharacters,
    locations,
    timeline,
    conflicts,
    theme: stringValue(source.theme, "人物在压力中寻找真相，并将内心独白转化为可表演的行动。")
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
          type: normalizeStoryConflictType(conflict.type),
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

export function normalizeStoryStructure(input: unknown, chapters: Chapter[], global: GlobalStory): StoryStructure {
  const source = asRecord(input);
  const fallback = buildMockStoryStructure(chapters, global);
  const chapterIds = chapters.map((chapter) => chapter.id);
  const characterIds = global.characters.map((character) => character.id);
  const primaryCharacters = characterIds.slice(0, 2).length ? characterIds.slice(0, 2) : ["char_001"];
  const rawActs = Array.isArray(source.acts) && source.acts.length ? source.acts : fallback.acts;
  const rawConflicts = Array.isArray(source.conflicts) && source.conflicts.length ? source.conflicts : fallback.conflicts;
  const rawTurningPoints =
    Array.isArray(source.turning_points) && source.turning_points.length ? source.turning_points : fallback.turning_points;
  const rawCharacterArcs =
    Array.isArray(source.character_arcs) && source.character_arcs.length ? source.character_arcs : fallback.character_arcs;

  const acts = rawActs.map((item, index) => {
    const act = asRecord(item);
    const chapter = chapters[index % Math.max(chapters.length, 1)];
    const fallbackAct = fallback.acts[index] ?? fallback.acts[0];
    return {
      id: stringValue(act.id, idFrom("act", index)),
      name: stringValue(act.name, typeof item === "string" ? item : fallbackAct?.name ?? (index === 0 ? "开端" : "发展")),
      purpose: stringValue(act.purpose, fallbackAct?.purpose ?? "推进线索、升级冲突并改变人物处境"),
      source_chapters: existingList(act.source_chapters, chapterIds, [chapter?.id ?? chapterIds[0] ?? "ch_001"]),
      key_events: stringList(act.key_events).length
        ? stringList(act.key_events)
        : chapter?.key_events?.length
          ? chapter.key_events
          : fallbackAct?.key_events ?? [`${chapter?.title ?? "章节"}推动主线发展`]
    };
  });

  const conflicts = rawConflicts.map((item, index) => {
    const conflict = asRecord(item);
    const globalConflict = global.conflicts[index] ?? global.conflicts[0];
    const rawText = typeof item === "string" ? item : "";
    const description = stringValue(conflict.description, rawText || globalConflict?.description || "主角追查真相时遭遇阻力。");
    return {
      id: stringValue(conflict.id, globalConflict?.id ?? idFrom("conflict", index)),
      type: normalizeStoryConflictType(stringValue(conflict.type, inferConflictType(description))),
      description,
      characters: existingList(conflict.characters, characterIds, globalConflict?.parties?.length ? globalConflict.parties : primaryCharacters),
      source_chapters: existingList(conflict.source_chapters, chapterIds, globalConflict?.source_chapters?.length ? globalConflict.source_chapters : chapterIds),
      status: normalizeStoryConflictStatus(conflict.status)
    };
  });

  const turning_points = rawTurningPoints.map((item, index) => {
    const point = asRecord(item);
    const chapter = chapters[index % Math.max(chapters.length, 1)];
    const fallbackPoint = fallback.turning_points[index] ?? fallback.turning_points[0];
    return {
      id: stringValue(point.id, idFrom("tp", index)),
      source_chapter: chapterIds.includes(String(point.source_chapter))
        ? String(point.source_chapter)
        : chapter?.id ?? fallbackPoint?.source_chapter ?? chapterIds[0] ?? "ch_001",
      event: stringValue(point.event, typeof item === "string" ? item : chapter?.key_events?.[0] ?? fallbackPoint?.event ?? "关键事件出现"),
      impact: stringValue(point.impact, fallbackPoint?.impact ?? "人物目标、关系或局势因此发生变化。")
    };
  });

  const character_arcs = rawCharacterArcs.map((item, index) => {
    const arc = asRecord(item);
    const fallbackArc = fallback.character_arcs[index] ?? fallback.character_arcs[0];
    const character =
      typeof item === "string" && characterIds.includes(item)
        ? item
        : characterIds.includes(String(arc.character))
          ? String(arc.character)
          : fallbackArc?.character ?? characterIds[index % Math.max(characterIds.length, 1)] ?? "char_001";
    return {
      character,
      start_state: stringValue(arc.start_state, fallbackArc?.start_state ?? "被动面对异常事件"),
      desire: stringValue(arc.desire, fallbackArc?.desire ?? "查清真相并重新掌握选择权"),
      obstacle: stringValue(arc.obstacle, fallbackArc?.obstacle ?? "外部阻力与被遮蔽的信息持续干扰判断"),
      end_state: stringValue(arc.end_state, fallbackArc?.end_state ?? "主动推进调查并承担后果")
    };
  });

  return {
    premise: stringValue(source.premise, fallback.premise),
    genre: stringValue(source.genre, fallback.genre),
    logline: stringValue(source.logline, fallback.logline),
    theme: stringValue(source.theme, fallback.theme),
    main_conflict: stringValue(source.main_conflict, fallback.main_conflict),
    dramatic_question: stringValue(source.dramatic_question, fallback.dramatic_question),
    acts,
    conflicts,
    turning_points,
    character_arcs
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

function existingList(values: unknown, allowed: string[], fallback: string[]) {
  if (!Array.isArray(values)) return fallback;
  const cleaned = values.filter((value): value is string => typeof value === "string" && allowed.includes(value));
  return cleaned.length ? cleaned : fallback;
}

export function normalizeScene(input: unknown, index: number, refs: SceneNormalizationRefs): Scene {
  const scene = input && typeof input === "object" ? (input as Partial<Scene>) : {};
  const fallbackChapter = refs.chapterIds[0] ?? "ch_001";
  const fallbackCharacter = refs.characterIds[0] ?? "char_001";
  const fallbackConflict = refs.conflictIds[0] ?? "conflict_001";
  const fallbackLocation = refs.locationIds[0] ?? "loc_001";
  const setting = scene.setting && typeof scene.setting === "object" ? scene.setting : undefined;
  const source = scene.source && typeof scene.source === "object" ? scene.source : undefined;
  const scriptLines = Array.isArray(scene.script) ? scene.script : [];
  const script = scriptLines
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      if (line.type === "dialogue") {
        return {
          type: "dialogue" as const,
          character:
            typeof line.character === "string" && refs.characterIds.includes(line.character)
              ? line.character
              : fallbackCharacter,
          content: typeof line.content === "string" && line.content.trim() ? line.content : "待补充对白"
        };
      }
      return {
        type: line.type === "transition" ? ("transition" as const) : ("action" as const),
        content: typeof line.content === "string" && line.content.trim() ? line.content : "待补充动作"
      };
    })
    .filter((line): line is Scene["script"][number] => Boolean(line));

  return {
    id: typeof scene.id === "string" && scene.id.trim() ? scene.id : idFrom("scene", index),
    title: typeof scene.title === "string" && scene.title.trim() ? scene.title : `场景${index + 1}`,
    source: {
      chapters: existingList(source?.chapters, refs.chapterIds, [fallbackChapter]),
      original_range: source?.original_range
    },
    setting: {
      location:
        typeof setting?.location === "string" && refs.locationIds.includes(setting.location)
          ? setting.location
          : fallbackLocation,
      time: typeof setting?.time === "string" && setting.time.trim() ? setting.time : "连续时间",
      atmosphere:
        typeof setting?.atmosphere === "string" && setting.atmosphere.trim() ? setting.atmosphere : "紧张、克制"
    },
    characters: existingList(scene.characters, refs.characterIds, [fallbackCharacter]),
    conflict_ids: existingList(scene.conflict_ids, refs.conflictIds, [fallbackConflict]),
    purpose: typeof scene.purpose === "string" && scene.purpose.trim() ? scene.purpose : "推进剧情并明确人物目标",
    beats:
      Array.isArray(scene.beats) && scene.beats.some((beat) => typeof beat === "string" && beat.trim())
        ? scene.beats.filter((beat): beat is string => typeof beat === "string" && beat.trim().length > 0)
        : ["人物进入场景", "关键线索出现"],
    script: script.length
      ? script
      : [
          {
            type: "action",
            content: "人物进入场景，新的线索推动剧情继续发展。"
          }
        ],
    notes: scene.notes
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
  const response = await provider.generateJson<GlobalStory>({
    schemaName: "global_story",
    system: "你是小说改编流水线中的全局故事建模器。",
    prompt: `基于章节摘要生成 characters, locations, timeline, conflicts, theme。人物 id 使用 char_001 格式，地点 id 使用 loc_001 格式，冲突 id 使用 conflict_001 格式。timeline 可用 conflict_ids 引用 conflicts，conflicts.related_timeline 必须引用 timeline.order。\n${JSON.stringify(
      chapters,
      null,
      2
    )}`
  });
  return normalizeGlobalStory(response, chapters);
}

async function buildStoryStructure(provider: AiProvider | null, chapters: Chapter[], global: GlobalStory) {
  if (!provider) return buildMockStoryStructure(chapters, global);
  const response = await provider.generateJson<StoryStructure>({
    schemaName: "story_structure",
    system: "你是小说改编流水线中的独立剧情结构建模器。",
    prompt: `基于章节摘要和全局故事，输出稳定的 story_structure JSON。字段必须包含 premise, genre, logline, theme, main_conflict, dramatic_question, acts, conflicts, turning_points, character_arcs。source_chapters 和 source_chapter 只能引用已有章节 id，characters 和 character_arcs.character 只能引用已有人物 id。\n章节：${JSON.stringify(
      chapters,
      null,
      2
    )}\n全局故事：${JSON.stringify(global, null, 2)}`
  });
  return normalizeStoryStructure(response, chapters, global);
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
  const rawScenes = await Promise.all(candidates.map((candidate, index) => buildScene(provider, candidate, index, global)));
  const scenes = rawScenes.map((scene, index) =>
    normalizeScene(scene, index, {
      chapterIds: analyzedChapters.map((chapter) => chapter.id),
      characterIds: global.characters.map((character) => character.id),
      conflictIds: global.conflicts.map((conflict) => conflict.id),
      locationIds: global.locations.map((location) => location.id)
    })
  );

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
