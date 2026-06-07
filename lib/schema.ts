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

const storyStructureSchema = z.object({
  premise: z.string().min(1),
  genre: z.string().min(1),
  logline: z.string().min(1),
  theme: z.string().min(1),
  main_conflict: z.string().min(1),
  dramatic_question: z.string().min(1),
  acts: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        purpose: z.string().min(1),
        source_chapters: z.array(z.string().min(1)).min(1),
        key_events: z.array(z.string().min(1)).min(1)
      })
    )
    .min(1),
  conflicts: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["external", "internal", "relationship", "social", "mystery"]),
      description: z.string().min(1),
      characters: z.array(z.string().min(1)).min(1),
      source_chapters: z.array(z.string().min(1)).min(1),
      status: z.enum(["active", "resolved", "latent"])
    })
  ),
  turning_points: z.array(
    z.object({
      id: z.string().min(1),
      source_chapter: z.string().min(1),
      event: z.string().min(1),
      impact: z.string().min(1)
    })
  ),
  character_arcs: z.array(
    z.object({
      character: z.string().min(1),
      start_state: z.string().min(1),
      desire: z.string().min(1),
      obstacle: z.string().min(1),
      end_state: z.string().min(1)
    })
  )
});

const storyboardShotSchema = z.object({
  id: z.string().min(1),
  scene_id: z.string().min(1),
  source_script_index: z.number().int().min(0),
  description: z.string().min(1),
  camera: z.string().min(1),
  framing: z.string().min(1),
  movement: z.string().min(1),
  duration_seconds: z.number().positive(),
  visual_style: z.string().min(1),
  characters: z.array(z.string().min(1)),
  location: z.string().min(1)
});

const videoPromptSchema = z.object({
  id: z.string().min(1),
  shot_id: z.string().min(1),
  positive: z.string().min(1),
  negative: z.string().min(1),
  model_notes: z.string().min(1),
  duration_seconds: z.number().positive(),
  aspect_ratio: z.string().min(1)
});

const videoTaskSchema = z.object({
  id: z.string().min(1),
  prompt_id: z.string().min(1),
  provider: z.enum(["mock", "custom_http"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  request: z.object({
    prompt: z.string().min(1),
    negative_prompt: z.string().optional(),
    duration_seconds: z.number().positive(),
    aspect_ratio: z.string().min(1)
  }),
  result_url: z.string().min(1).optional(),
  thumbnail_url: z.string().min(1).optional(),
  error: z.string().optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1)
});

const revisionScopeSchema = z.object({
  type: z.enum(["scene", "shot", "prompt", "video_task"]),
  id: z.string().min(1)
});

const revisionLogSchema = z.object({
  id: z.string().min(1),
  scope: revisionScopeSchema,
  feedback: z.string().min(1),
  action: z.string().min(1),
  created_at: z.string().min(1)
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
      scene_id: z.string().min(1).optional(),
      conflict_ids: z.array(z.string().min(1)).optional(),
      impact: z.string().optional()
    })
  ),
  conflicts: z.array(conflictSchema),
  story_structure: storyStructureSchema.optional(),
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
        .optional(),
      feedback: z.array(z.string().min(1)).optional(),
      revision_status: z.enum(["draft", "needs_review", "approved"]).optional()
    })
  ),
  storyboard: z.object({ shots: z.array(storyboardShotSchema) }).optional(),
  video_prompts: z.array(videoPromptSchema).optional(),
  video_tasks: z.array(videoTaskSchema).optional(),
  revision_log: z.array(revisionLogSchema).optional()
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
  const sceneIds = new Set(data.scenes.map((scene) => scene.id));
  const shotIds = new Set(data.storyboard?.shots.map((shot) => shot.id) ?? []);
  const promptIds = new Set(data.video_prompts?.map((prompt) => prompt.id) ?? []);

  data.timeline.forEach((item, index) => {
    if (!chapterIds.has(item.chapter_id)) {
      issues.push({
        path: `timeline.${index}.chapter_id`,
        message: `引用了不存在的章节 ${item.chapter_id}`
      });
    }

    if (item.scene_id && !sceneIds.has(item.scene_id)) {
      issues.push({
        path: `timeline.${index}.scene_id`,
        message: `引用了不存在的场景 ${item.scene_id}`
      });
    }

    item.conflict_ids?.forEach((conflictId, conflictIndex) => {
      if (!conflictIds.has(conflictId)) {
        issues.push({
          path: `timeline.${index}.conflict_ids.${conflictIndex}`,
          message: `引用了不存在的冲突 ${conflictId}`
        });
      }
    });
  });

  data.conflicts.forEach((conflict, conflictIndex) => {
    conflict.parties.forEach((characterId, characterIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `conflicts.${conflictIndex}.parties.${characterIndex}`,
          message: `引用了不存在的人物 ${characterId}`
        });
      }
    });

    conflict.source_chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `conflicts.${conflictIndex}.source_chapters.${chapterIndex}`,
          message: `引用了不存在的章节 ${chapterId}`
        });
      }
    });

    conflict.related_timeline.forEach((order, timelineIndex) => {
      if (!timelineOrders.has(order)) {
        issues.push({
          path: `conflicts.${conflictIndex}.related_timeline.${timelineIndex}`,
          message: `引用了不存在的时间线顺序 ${order}`
        });
      }
    });
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

  data.story_structure?.acts.forEach((act, actIndex) => {
    act.source_chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `story_structure.acts.${actIndex}.source_chapters.${chapterIndex}`,
          message: `引用了不存在的章节 ${chapterId}`
        });
      }
    });
  });

  data.story_structure?.conflicts.forEach((conflict, conflictIndex) => {
    conflict.characters.forEach((characterId, characterIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `story_structure.conflicts.${conflictIndex}.characters.${characterIndex}`,
          message: `引用了不存在的人物 ${characterId}`
        });
      }
    });

    conflict.source_chapters.forEach((chapterId, chapterIndex) => {
      if (!chapterIds.has(chapterId)) {
        issues.push({
          path: `story_structure.conflicts.${conflictIndex}.source_chapters.${chapterIndex}`,
          message: `引用了不存在的章节 ${chapterId}`
        });
      }
    });
  });

  data.story_structure?.turning_points.forEach((turningPoint, turningPointIndex) => {
    if (!chapterIds.has(turningPoint.source_chapter)) {
      issues.push({
        path: `story_structure.turning_points.${turningPointIndex}.source_chapter`,
        message: `引用了不存在的章节 ${turningPoint.source_chapter}`
      });
    }
  });

  data.story_structure?.character_arcs.forEach((arc, arcIndex) => {
    if (!characterIds.has(arc.character)) {
      issues.push({
        path: `story_structure.character_arcs.${arcIndex}.character`,
        message: `引用了不存在的人物 ${arc.character}`
      });
    }
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

    scene.conflict_ids.forEach((conflictId, conflictIndex) => {
      if (!conflictIds.has(conflictId)) {
        issues.push({
          path: `scenes.${sceneIndex}.conflict_ids.${conflictIndex}`,
          message: `引用了不存在的冲突 ${conflictId}`
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

  data.storyboard?.shots.forEach((shot, shotIndex) => {
    if (!sceneIds.has(shot.scene_id)) {
      issues.push({
        path: `storyboard.shots.${shotIndex}.scene_id`,
        message: `引用了不存在的场景 ${shot.scene_id}`
      });
    }

    shot.characters.forEach((characterId, characterIndex) => {
      if (!characterIds.has(characterId)) {
        issues.push({
          path: `storyboard.shots.${shotIndex}.characters.${characterIndex}`,
          message: `引用了不存在的人物 ${characterId}`
        });
      }
    });

    if (!locationIds.has(shot.location)) {
      issues.push({
        path: `storyboard.shots.${shotIndex}.location`,
        message: `引用了不存在的地点 ${shot.location}`
      });
    }
  });

  data.video_prompts?.forEach((prompt, promptIndex) => {
    if (!shotIds.has(prompt.shot_id)) {
      issues.push({
        path: `video_prompts.${promptIndex}.shot_id`,
        message: `引用了不存在的镜头 ${prompt.shot_id}`
      });
    }
  });

  data.video_tasks?.forEach((task, taskIndex) => {
    if (!promptIds.has(task.prompt_id)) {
      issues.push({
        path: `video_tasks.${taskIndex}.prompt_id`,
        message: `引用了不存在的视频 Prompt ${task.prompt_id}`
      });
    }
  });

  data.revision_log?.forEach((revision, revisionIndex) => {
    const scopeExists =
      (revision.scope.type === "scene" && sceneIds.has(revision.scope.id)) ||
      (revision.scope.type === "shot" && shotIds.has(revision.scope.id)) ||
      (revision.scope.type === "prompt" && promptIds.has(revision.scope.id)) ||
      (revision.scope.type === "video_task" && data.video_tasks?.some((task) => task.id === revision.scope.id));

    if (!scopeExists) {
      issues.push({
        path: `revision_log.${revisionIndex}.scope.id`,
        message: `引用了不存在的反馈目标 ${revision.scope.id}`
      });
    }
  });

  return {
    valid: issues.length === 0,
    data,
    issues
  };
}
