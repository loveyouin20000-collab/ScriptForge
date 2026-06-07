import type { VideoTask } from "../types";

export type VideoTaskRequest = {
  prompt_id: string;
  prompt: string;
  negative_prompt?: string;
  duration_seconds: number;
  aspect_ratio: string;
};

export type VideoTaskResult = VideoTask;

export interface VideoProvider {
  submit(request: VideoTaskRequest): Promise<VideoTaskResult>;
  getTask(id: string): Promise<VideoTaskResult | null>;
}
