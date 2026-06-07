export type Chapter = {
  id: string;
  title: string;
  text: string;
  summary?: string;
  main_characters?: string[];
  locations?: string[];
  key_events?: string[];
  emotional_tone?: string;
};

export type Character = {
  id: string;
  name: string;
  role: string;
  description: string;
  motivation?: string;
  relationships?: Array<{
    target: string;
    relation: string;
  }>;
};

export type Location = {
  id: string;
  name: string;
  type: "interior" | "exterior" | "mixed" | "unknown";
  description: string;
};

export type TimelineItem = {
  order: number;
  chapter_id: string;
  event: string;
  time?: string;
  scene_id?: string;
  conflict_ids?: string[];
  impact?: string;
};

export type Conflict = {
  id: string;
  title: string;
  type: string;
  description: string;
  parties: string[];
  stakes: string;
  status: string;
  source_chapters: string[];
  related_timeline: number[];
};

export type StoryAct = {
  id: string;
  name: string;
  purpose: string;
  source_chapters: string[];
  key_events: string[];
};

export type StoryConflict = {
  id: string;
  type: "external" | "internal" | "relationship" | "social" | "mystery";
  description: string;
  characters: string[];
  source_chapters: string[];
  status: "active" | "resolved" | "latent";
};

export type TurningPoint = {
  id: string;
  source_chapter: string;
  event: string;
  impact: string;
};

export type CharacterArc = {
  character: string;
  start_state: string;
  desire: string;
  obstacle: string;
  end_state: string;
};

export type StoryStructure = {
  premise: string;
  genre: string;
  logline: string;
  theme: string;
  main_conflict: string;
  dramatic_question: string;
  acts: StoryAct[];
  conflicts: StoryConflict[];
  turning_points: TurningPoint[];
  character_arcs: CharacterArc[];
};

export type ScriptLine =
  | {
      type: "action" | "transition";
      content: string;
    }
  | {
      type: "dialogue";
      character: string;
      content: string;
    };

export type Scene = {
  id: string;
  title: string;
  source: {
    chapters: string[];
    original_range?: string;
  };
  setting: {
    location: string;
    time: string;
    atmosphere: string;
  };
  characters: string[];
  conflict_ids: string[];
  purpose: string;
  beats: string[];
  script: ScriptLine[];
  notes?: {
    adaptation_strategy?: string;
  };
  feedback?: string[];
  revision_status?: "draft" | "needs_review" | "approved";
};

export type StoryboardShot = {
  id: string;
  scene_id: string;
  source_script_index: number;
  description: string;
  camera: string;
  framing: string;
  movement: string;
  duration_seconds: number;
  visual_style: string;
  characters: string[];
  location: string;
};

export type Storyboard = {
  shots: StoryboardShot[];
};

export type VideoPrompt = {
  id: string;
  shot_id: string;
  positive: string;
  negative: string;
  model_notes: string;
  duration_seconds: number;
  aspect_ratio: string;
};

export type VideoTaskStatus = "queued" | "running" | "succeeded" | "failed";

export type VideoTask = {
  id: string;
  prompt_id: string;
  provider: "mock" | "custom_http";
  status: VideoTaskStatus;
  request: {
    prompt: string;
    negative_prompt?: string;
    duration_seconds: number;
    aspect_ratio: string;
  };
  result_url?: string;
  thumbnail_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

export type RevisionScope = {
  type: "scene" | "shot" | "prompt" | "video_task";
  id: string;
};

export type RevisionLogItem = {
  id: string;
  scope: RevisionScope;
  feedback: string;
  action: string;
  created_at: string;
};

export type ScriptYaml = {
  metadata: {
    title: string;
    author: string;
    generated_by: string;
    version: string;
    style?: string;
  };
  source: {
    chapter_count: number;
    chapters: Array<Pick<Chapter, "id" | "title" | "summary">>;
  };
  characters: Character[];
  locations: Location[];
  timeline: TimelineItem[];
  conflicts: Conflict[];
  story_structure?: StoryStructure;
  scenes: Scene[];
  storyboard?: Storyboard;
  video_prompts?: VideoPrompt[];
  video_tasks?: VideoTask[];
  revision_log?: RevisionLogItem[];
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ProviderConfig = {
  vendor?: "mock" | "openai" | "deepseek" | "tongyi" | "custom";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

export type ManagedProviderConfig = {
  vendor: Exclude<ProviderConfig["vendor"], "mock" | undefined>;
  label: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
};

export type PipelineInput = {
  title: string;
  author: string;
  text: string;
  chapters?: Chapter[];
  provider?: ProviderConfig;
};
