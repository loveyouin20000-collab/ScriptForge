import type { VideoTask } from "../types";
import type { VideoProvider, VideoTaskRequest, VideoTaskResult } from "./provider";

type StoredTask = {
  task: VideoTask;
  reads: number;
};

const MOCK_VIDEO_TASK_STORE = Symbol.for("scriptforge.mockVideoTasks");

type MockVideoGlobal = typeof globalThis & {
  [MOCK_VIDEO_TASK_STORE]?: Map<string, StoredTask>;
};

function nowIso() {
  return new Date().toISOString();
}

function taskId(index: number) {
  return `video_task_${String(index).padStart(3, "0")}`;
}

export class MockVideoProvider implements VideoProvider {
  private tasks: Map<string, StoredTask>;

  constructor() {
    const globalStore = globalThis as MockVideoGlobal;
    globalStore[MOCK_VIDEO_TASK_STORE] ??= new Map<string, StoredTask>();
    this.tasks = globalStore[MOCK_VIDEO_TASK_STORE];
  }

  async submit(request: VideoTaskRequest): Promise<VideoTaskResult> {
    const id = taskId(this.tasks.size + 1);
    const createdAt = nowIso();
    const task: VideoTask = {
      id,
      prompt_id: request.prompt_id,
      provider: "mock",
      status: "queued",
      request: {
        prompt: request.prompt,
        negative_prompt: request.negative_prompt,
        duration_seconds: request.duration_seconds,
        aspect_ratio: request.aspect_ratio
      },
      created_at: createdAt,
      updated_at: createdAt
    };

    this.tasks.set(id, { task, reads: 0 });
    return task;
  }

  async getTask(id: string): Promise<VideoTaskResult | null> {
    const stored = this.tasks.get(id);
    if (!stored) return null;

    stored.reads += 1;
    const updatedAt = nowIso();
    if (stored.reads === 1) {
      stored.task = {
        ...stored.task,
        status: "running",
        updated_at: updatedAt
      };
    } else {
      stored.task = {
        ...stored.task,
        status: "succeeded",
        result_url: `mock-video://${stored.task.id}.mp4`,
        thumbnail_url: `mock-video://${stored.task.id}.jpg`,
        updated_at: updatedAt
      };
    }

    this.tasks.set(id, stored);
    return stored.task;
  }
}

export const defaultMockVideoProvider = new MockVideoProvider();
