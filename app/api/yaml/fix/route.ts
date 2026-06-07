import { NextResponse } from "next/server";
import { validateScriptYaml } from "@/lib/schema";
import type { Character, Conflict, Location, Scene, ScriptLine, ScriptYaml, TimelineItem } from "@/lib/types";
import { fromYaml, toYaml } from "@/lib/yaml";

export const runtime = "nodejs";

function ensureArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function paddedId(prefix: string, index: number) {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function locationTypeFrom(value: string | undefined): Location["type"] {
  return value === "interior" || value === "exterior" || value === "mixed" || value === "unknown" ? value : "unknown";
}

function repairObject(input: Partial<ScriptYaml>): ScriptYaml {
  const sourceChapters = ensureArray(input.source?.chapters);
  const chapters = sourceChapters.map((chapter, index) => ({
    id: chapter.id || paddedId("ch", index),
    title: chapter.title || `Chapter ${index + 1}`,
    summary: chapter.summary || "Pending chapter summary"
  }));
  const firstChapter = chapters[0]?.id || "ch_001";

  const characters: Character[] = ensureArray(input.characters).map((character, index) => ({
    id: character.id || paddedId("char", index),
    name: character.name || `Character ${index + 1}`,
    role: character.role || "unknown",
    description: character.description || "Pending character description",
    motivation: character.motivation || "Pending motivation",
    relationships: ensureArray(character.relationships)
  }));
  const firstCharacter = characters[0]?.id || "char_001";

  const locations: Location[] = ensureArray(input.locations).map((location, index) => ({
    id: location.id || paddedId("loc", index),
    name: location.name || `Location ${index + 1}`,
    type: locationTypeFrom(location.type),
    description: location.description || "Pending location description"
  }));
  const firstLocation = locations[0]?.id || "loc_001";

  const repairedChapters = chapters.length
    ? chapters
    : [
        {
          id: firstChapter,
          title: "Chapter 1",
          summary: "Pending chapter summary"
        }
      ];
  const chapterIds = new Set(repairedChapters.map((chapter) => chapter.id));
  const characterIds = new Set(
    (characters.length
      ? characters
      : [
          {
            id: firstCharacter,
            name: "Character 1",
            role: "protagonist",
            description: "Pending character description",
            motivation: "Pending motivation",
            relationships: []
          }
        ]
    ).map((character) => character.id)
  );

  const rawTimeline = ensureArray(input.timeline).map((item, index) => ({
    order: item.order || index + 1,
    chapter_id: chapterIds.has(item.chapter_id) ? item.chapter_id : firstChapter,
    event: item.event || "Pending event",
    time: item.time || "Pending time",
    scene_id: item.scene_id,
    conflict_ids: ensureArray(item.conflict_ids),
    impact: item.impact || "Pending impact"
  }));
  const timeline: TimelineItem[] = rawTimeline.length
    ? rawTimeline
    : [
        {
          order: 1,
          chapter_id: firstChapter,
          event: "Pending event",
          time: "Pending time",
          conflict_ids: []
        }
      ];
  const timelineOrders = new Set(timeline.map((item) => item.order));
  const firstTimelineOrder = timeline[0]?.order ?? 1;

  const conflicts: Conflict[] = ensureArray(input.conflicts).map((conflict, index) => {
    const parties = ensureArray(conflict.parties).filter((id) => characterIds.has(id));
    const source_chapters = ensureArray(conflict.source_chapters).filter((id) => chapterIds.has(id));
    const related_timeline = ensureArray(conflict.related_timeline).filter((order) => timelineOrders.has(order));
    return {
      id: conflict.id || paddedId("conflict", index),
      title: conflict.title || `Conflict ${index + 1}`,
      type: conflict.type || "external",
      description: conflict.description || "Pending conflict description",
      parties: parties.length ? parties : [firstCharacter],
      stakes: conflict.stakes || "Pending stakes",
      status: conflict.status || "active",
      source_chapters: source_chapters.length ? source_chapters : [firstChapter],
      related_timeline: related_timeline.length ? related_timeline : [firstTimelineOrder]
    };
  });

  const repairedConflicts = conflicts.length
    ? conflicts
    : [
        {
          id: "conflict_001",
          title: "Primary conflict",
          type: "external",
          description: "Pending primary conflict description",
          parties: [firstCharacter],
          stakes: "Pending stakes",
          status: "active",
          source_chapters: [firstChapter],
          related_timeline: [firstTimelineOrder]
        }
      ];
  const conflictIds = new Set(repairedConflicts.map((conflict) => conflict.id));
  const firstConflict = repairedConflicts[0]?.id || "conflict_001";

  const repairedTimeline = timeline.map((item) => {
    const validConflictIds = ensureArray(item.conflict_ids).filter((id) => conflictIds.has(id));
    return {
      ...item,
      conflict_ids: validConflictIds.length ? validConflictIds : [firstConflict]
    };
  });

  const repairedCharacters: Character[] = characters.length
    ? characters
    : [
        {
          id: firstCharacter,
          name: "Character 1",
          role: "protagonist",
          description: "Pending character description",
          motivation: "Pending motivation",
          relationships: []
        }
      ];

  const repairedLocations: Location[] = locations.length
    ? locations
    : [
        {
          id: firstLocation,
          name: "Main location",
          type: "unknown",
          description: "Pending location description"
        }
      ];
  const locationIds = new Set(repairedLocations.map((location) => location.id));

  const scenes: Scene[] = ensureArray(input.scenes).map((scene, index) => {
    const validSceneCharacters = ensureArray(scene.characters).filter((id) => characterIds.has(id));
    const validSceneConflicts = ensureArray(scene.conflict_ids).filter((id) => conflictIds.has(id));
    return {
      id: scene.id || paddedId("scene", index),
      title: scene.title || `Scene ${index + 1}`,
      source: {
        chapters: ensureArray(scene.source?.chapters).filter((id) => chapterIds.has(id)),
        original_range: scene.source?.original_range || firstChapter
      },
      setting: {
        location: scene.setting?.location && locationIds.has(scene.setting.location) ? scene.setting.location : firstLocation,
        time: scene.setting?.time || "Pending time",
        atmosphere: scene.setting?.atmosphere || "Pending atmosphere"
      },
      characters: validSceneCharacters.length ? validSceneCharacters : [firstCharacter],
      conflict_ids: validSceneConflicts.length ? validSceneConflicts : [firstConflict],
      purpose: scene.purpose || "Pending scene purpose",
      beats: ensureArray(scene.beats).length ? scene.beats : ["Pending beat"],
      script: ensureArray(scene.script).map((line): ScriptLine => {
        if (line.type === "dialogue") {
          return {
            type: "dialogue",
            character: characterIds.has(line.character) && line.character ? line.character : firstCharacter,
            content: line.content || "Pending dialogue"
          };
        }
        return {
          type: line.type === "transition" ? "transition" : "action",
          content: line.content || "Pending action"
        };
      }),
      notes: {
        adaptation_strategy: scene.notes?.adaptation_strategy || "Preserve core source events and complete structured fields."
      }
    };
  });

  const repairedScenes = scenes.map((scene) => ({
    ...scene,
    source: {
      ...scene.source,
      chapters: scene.source.chapters.length ? scene.source.chapters : [firstChapter]
    },
    script: scene.script.length
      ? scene.script
      : [
          {
            type: "action" as const,
            content: "Pending action"
          }
        ]
  }));

  return {
    metadata: {
      title: input.metadata?.title || "Untitled adaptation script",
      author: input.metadata?.author || "Original author",
      generated_by: input.metadata?.generated_by || "ScriptForge Repair",
      version: input.metadata?.version || "1.0",
      style: input.metadata?.style || "screen drama"
    },
    source: {
      chapter_count: repairedChapters.length || 1,
      chapters: repairedChapters
    },
    characters: repairedCharacters,
    locations: repairedLocations,
    timeline: repairedTimeline,
    conflicts: repairedConflicts,
    scenes: repairedScenes
  };
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
        error: error instanceof Error ? error.message : "Repair failed"
      },
      { status: 400 }
    );
  }
}
