import type { ProviderConfig } from "../types";
import type { AiProvider, GenerateJsonRequest } from "./provider";

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export class OpenAiCompatibleProvider implements AiProvider {
  private config: Required<Pick<ProviderConfig, "credential" | "model">> & {
    baseUrl: string;
  };

  constructor(config: ProviderConfig) {
    if (!config.credential || !config.model) {
      throw new Error("Credential and model are required.");
    }

    this.config = {
      credential: config.credential,
      model: config.model,
      baseUrl: config.baseUrl || "https://api.openai.com/v1"
    };
  }

  async generateJson<T>(request: GenerateJsonRequest): Promise<T> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.credential}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${request.system}\nOutput JSON only. Do not output Markdown.`
          },
          {
            role: "user",
            content: request.prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI request failed: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI response was empty.");

    return JSON.parse(extractJson(content)) as T;
  }
}
