import type { VideoProvider, VideoTaskRequest, VideoTaskResult } from "./provider";

export type CustomHttpVideoProviderConfig = {
  baseUrl: string;
  apiKey?: string;
};

export class CustomHttpVideoProvider implements VideoProvider {
  constructor(private readonly config: CustomHttpVideoProviderConfig) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
    };
  }

  async submit(request: VideoTaskRequest): Promise<VideoTaskResult> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/tasks`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`视频任务提交失败：${response.status}`);
    }
    return (await response.json()) as VideoTaskResult;
  }

  async getTask(id: string): Promise<VideoTaskResult | null> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/tasks/${id}`, {
      headers: this.headers()
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`视频任务查询失败：${response.status}`);
    }
    return (await response.json()) as VideoTaskResult;
  }
}
