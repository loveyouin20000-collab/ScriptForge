import { z } from "zod";
import type { ScriptYaml, ValidationIssue } from "./types";

const relationshipSchema = z.object({
  target: z.string().min(1),
  relation: z.string().min(1)
});

const conflictSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  parties: z.array(z.string().min(1)),
  stakes: z.string().min(1),
  status: z.string().min(1),
  source_chapters: z.array(z.string().min(1)),
  related_timeline: z.array(z.number().int().min(1))
});

export const scriptYamlSchema = z.object({
  metadata: z.object({
    title: z.string().min(1),
    author: z.string().min(1),
    generated_by: z.string().min(1),
    version: z.string().min(1),
    style: z.string().optional()
  }),
  source: z.object({
    chapter_count: z.number().int().min(1),
    chapters: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        summary: z.string().min(1).optional()
      })
    )
  }),
  characters: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
      description: z.string().min(1),
      motivation: z.string().optional(),
      relationships: z.array(relationshipSchema).optional()
    })
  ),
  locations: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(["interior", "exterior", "mixed", "unknown"]),
      description: z.string().min(1)
    })
  ),
  timeline: z.array(
    z.object({
      order: z.number().int().min(1),
      chapter_id: z.string().min(1),
      event: z.string().min(1),
      time: z.string().optional(),
      scene_id: z.string().optional(),
      conflict_ids: z.array(z.string().min(1)).optional(),
      impact: z.string().optional()
    })
  ),
  conflicts: z.array(conflictSchema),
  scenes: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      source: z.object({
        chapters: z.array(z.string().min(1)).min(1),
        original_range: z.string().optional()
      }),
      setting: z.object({
        location: z.string().min(1),
        time: z.string().min(1),
        atmosphere: z.string().min(1)
      }),
      characters: z.array(z.string().min(1)).min(1),
      conflict_ids: z.array(z.string().min(1)),
      purpose: z.string().min(1),
      beats: z.array(z.string().min(1)).min(1),
      script: z.array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("action"),
            content: z.string().min(1)
          }),
          z.object({
            type: z.literal("transition"),
            content: z.string().min(1)
          }),
          z.object({
            type: z.literal("dialogue"),
            character: z.string().min(1),
            content: z.string().min(1)
          })
        ])
      ),
      notes: z
        .object({
          adaptation_strategy: z.string().optional()
        })
        .optional()
    })
  )
});

function zodPath(path: Array<string | number>) {
  return path.length ? path.join(".") : "root";
}

export function validateScriptYaml(input: unknown): {
  valid: boolean;
  data?: ScriptYaml;
  issues: ValidationIssue[];
} {
  const parsed = scriptYamlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        path: zodPath(issue.path),
        message: issue.message
      }))
    };
  }

  const data = parsed.data;
  const issues: ValidationIssue[] = [];
  const chapterIds = new Set(data.source.chapters.map((chapter) => chapter.id));
  const characterIds = new Set(data.characters.map((character) => character.id));
  const locationIds = new Set(data.locations.map((location) => location.id));
  const timelineOrders = new Set(data.timeline.map((item) => item.order));
  const conflictIds = new Set(data.conflicts.map((conflict) => conflict.id));

  data.timeline.forEach((item, index) => {
    if (!chapterIds.has(item.chapter_id)) {
      issues.push({
        path: `timeline.${index}.chapter_id`,
        message: `References missing chapter ${item.chapter_id}`
      });
    }

    item.conflict_ids?.forEach((conflictId, conflictIndex) => {
      if (!conflictIds.has(conflictId)) {
        issues.push({
          path: `timeline.${index}.conflict_ids.${conflictIndex}`,
          message: `References missing conflict ${conflictId}`
        });
      }
    });
  });

  data.characters.forEach((character, index) => {
    character.relationships?.forEach((relationship, relationIndex) => {
      if (!characterIds.has(relationship.target)) {
        issues.push({
          path: `characters.${index}.relationships.${relationIndex}.target`,
          message: `References missing character ${relationship.target}`
        });
      }
    });
  });

  data.conflicts.forEach((conflict, conflictIndex) => {
    conflict.parties.forEach((characterId, partyIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `conflicts.${conflictIndex}.parties.${partyIndex}`,
          message: `References missing character ${characterId}`
        });
      }
    });

    conflict.source_chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `conflicts.${conflictIndex}.source_chapters.${chapterIndex}`,
          message: `References missing chapter ${chapterId}`
        });
      }
    });

    conflict.related_timeline.forEach((order, orderIndex) => {
      if (!timelineOrders.has(order)) {
        issues.push({
          path: `conflicts.${conflictIndex}.related_timeline.${orderIndex}`,
          message: `References missing timeline order ${order}`
        });
      }
    });
  });

  data.scenes.forEach((scene, sceneIndex) => {
    if (!locationIds.has(scene.setting.location)) {
      issues.push({
        path: `scenes.${sceneIndex}.setting.location`,
        message: `References missing location ${scene.setting.location}`
      });
    }

    scene.source.chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `scenes.${sceneIndex}.source.chapters.${chapterIndex}`,
          message: `References missing chapter ${chapterId}`
        });
      }
    });

    scene.characters.forEach((characterId, characterIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `scenes.${sceneIndex}.characters.${characterIndex}`,
          message: `References missing character ${characterId}`
        });
      }
    });

    scene.conflict_ids.forEach((conflictId, conflictIndex) => {
      if (!conflictIds.has(conflictId)) {
        issues.push({
          path: `scenes.${sceneIndex}.conflict_ids.${conflictIndex}`,
          message: `References missing conflict ${conflictId}`
        });
      }
    });

    scene.script.forEach((line, lineIndex) => {
      if (line.type === "dialogue" && !characterIds.has(line.character)) {
        issues.push({
          path: `scenes.${sceneIndex}.script.${lineIndex}.character`,
          message: `References missing character ${line.character}`
        });
      }
    });
  });

  return {
    valid: issues.length === 0,
    data,
    issues
  };
}
