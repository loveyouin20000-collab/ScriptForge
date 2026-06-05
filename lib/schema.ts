import { z } from "zod";
import type { ScriptYaml, ValidationIssue } from "./types";

const relationshipSchema = z.object({
  target: z.string().min(1),
  relation: z.string().min(1)
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
      time: z.string().optional()
    })
  ),
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

  data.timeline.forEach((item, index) => {
    if (!chapterIds.has(item.chapter_id)) {
      issues.push({
        path: `timeline.${index}.chapter_id`,
        message: `引用了不存在的章节 ${item.chapter_id}`
      });
    }
  });

  data.characters.forEach((character, index) => {
    character.relationships?.forEach((relationship, relationIndex) => {
      if (!characterIds.has(relationship.target)) {
        issues.push({
          path: `characters.${index}.relationships.${relationIndex}.target`,
          message: `引用了不存在的人物 ${relationship.target}`
        });
      }
    });
  });

  data.scenes.forEach((scene, sceneIndex) => {
    if (!locationIds.has(scene.setting.location)) {
      issues.push({
        path: `scenes.${sceneIndex}.setting.location`,
        message: `引用了不存在的地点 ${scene.setting.location}`
      });
    }

    scene.source.chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `scenes.${sceneIndex}.source.chapters.${chapterIndex}`,
          message: `引用了不存在的章节 ${chapterId}`
        });
      }
    });

    scene.characters.forEach((characterId, characterIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `scenes.${sceneIndex}.characters.${characterIndex}`,
          message: `引用了不存在的人物 ${characterId}`
        });
      }
    });

    scene.script.forEach((line, lineIndex) => {
      if (line.type === "dialogue" && !characterIds.has(line.character)) {
        issues.push({
          path: `scenes.${sceneIndex}.script.${lineIndex}.character`,
          message: `对白引用了不存在的人物 ${line.character}`
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
