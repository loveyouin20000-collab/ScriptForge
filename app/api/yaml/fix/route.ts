import { NextResponse } from "next/server";
import { validateScriptYaml } from "@/lib/schema";
import type { ScriptYaml } from "@/lib/types";
import { fromYaml, toYaml } from "@/lib/yaml";

export const runtime = "nodejs";

function ensureArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function repairObject(input: Partial<ScriptYaml>): ScriptYaml {
  const characters = ensureArray(input.characters).map((character, index) => ({
    id: character.id || `char_${String(index + 1).padStart(3, "0")}`,
    name: character.name || `人物${index + 1}`,
    role: character.role || "unknown",
    description: character.description || "待补充人物描述",
    motivation: character.motivation || "待补充动机",
    relationships: ensureArray(character.relationships)
  }));

  const locations = ensureArray(input.locations).map((location, index) => ({
    id: location.id || `loc_${String(index + 1).padStart(3, "0")}`,
    name: location.name || `地点${index + 1}`,
    type: location.type || "unknown",
    description: location.description || "待补充地点描述"
  }));

  const chapters = ensureArray(input.source?.chapters).map((chapter, index) => ({
    id: chapter.id || `ch_${String(index + 1).padStart(3, "0")}`,
    title: chapter.title || `第${index + 1}章`,
    summary: chapter.summary || "待补充章节摘要"
  }));

  const firstCharacter = characters[0]?.id || "char_001";
  const firstLocation = locations[0]?.id || "loc_001";
  const firstChapter = chapters[0]?.id || "ch_001";

  const repaired: ScriptYaml = {
    metadata: {
      title: input.metadata?.title || "未命名小说改编剧本",
      author: input.metadata?.author || "原作者",
      generated_by: input.metadata?.generated_by || "ScriptForge Repair",
      version: input.metadata?.version || "1.0",
      style: input.metadata?.style || "影视剧"
    },
    source: {
      chapter_count: chapters.length || 1,
      chapters: chapters.length
        ? chapters
        : [
            {
              id: firstChapter,
              title: "第1章",
              summary: "待补充章节摘要"
            }
          ]
    },
    characters: characters.length
      ? characters
      : [
          {
            id: firstCharacter,
            name: "人物1",
            role: "protagonist",
            description: "待补充人物描述",
            motivation: "待补充动机",
            relationships: []
          }
        ],
    locations: locations.length
      ? locations
      : [
          {
            id: firstLocation,
            name: "主要场景",
            type: "unknown",
            description: "待补充地点描述"
          }
        ],
    timeline: ensureArray(input.timeline).map((item, index) => ({
      order: item.order || index + 1,
      chapter_id: chapters.some((chapter) => chapter.id === item.chapter_id) ? item.chapter_id : firstChapter,
      event: item.event || "待补充事件",
      time: item.time || "待补充时间"
    })),
    scenes: ensureArray(input.scenes).map((scene, index) => ({
      id: scene.id || `scene_${String(index + 1).padStart(3, "0")}`,
      title: scene.title || `场景${index + 1}`,
      source: {
        chapters: ensureArray(scene.source?.chapters).filter((id) => chapters.some((chapter) => chapter.id === id)),
        original_range: scene.source?.original_range || firstChapter
      },
      setting: {
        location: locations.some((location) => location.id === scene.setting?.location)
          ? scene.setting.location
          : firstLocation,
        time: scene.setting?.time || "待补充时间",
        atmosphere: scene.setting?.atmosphere || "待补充氛围"
      },
      characters: ensureArray(scene.characters).filter((id) => characters.some((character) => character.id === id)),
      purpose: scene.purpose || "待补充场景功能",
      beats: ensureArray(scene.beats).length ? scene.beats : ["待补充节拍"],
      script: ensureArray(scene.script).map((line) => {
        if (line.type === "dialogue") {
          return {
            type: "dialogue",
            character:
              characters.some((character) => character.id === line.character) && line.character
                ? line.character
                : firstCharacter,
            content: line.content || "待补充对白"
          };
        }
        return {
          type: line.type === "transition" ? "transition" : "action",
          content: line.content || "待补充动作"
        };
      }),
      notes: {
        adaptation_strategy: scene.notes?.adaptation_strategy || "保留原文核心事件，补齐结构化字段。"
      }
    }))
  };

  repaired.scenes = repaired.scenes.map((scene) => ({
    ...scene,
    source: {
      ...scene.source,
      chapters: scene.source.chapters.length ? scene.source.chapters : [firstChapter]
    },
    characters: scene.characters.length ? scene.characters : [firstCharacter],
    script: scene.script.length
      ? scene.script
      : [
          {
            type: "action",
            content: "待补充剧本动作。"
          }
        ]
  }));

  if (!repaired.timeline.length) {
    repaired.timeline = [
      {
        order: 1,
        chapter_id: firstChapter,
        event: "待补充事件",
        time: "待补充时间"
      }
    ];
  }

  return repaired;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { yaml: string };
    const parsed = fromYaml(body.yaml) as Partial<ScriptYaml>;
    const repaired = repairObject(parsed);
    const validation = validateScriptYaml(repaired);
    return NextResponse.json({
      yaml: toYaml(repaired),
      validation
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "修复失败"
      },
      { status: 400 }
    );
  }
}
