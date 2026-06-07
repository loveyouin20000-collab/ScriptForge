import { generateStoryboard } from "./storyboard";
import type { ScriptYaml, StoryboardShot, VideoPrompt } from "./types";

function namesFor(script: ScriptYaml, ids: string[]) {
  return ids
    .map((id) => script.characters.find((character) => character.id === id)?.name ?? id)
    .filter(Boolean)
    .join("、");
}

function promptForShot(script: ScriptYaml, shot: StoryboardShot): VideoPrompt {
  const scene = script.scenes.find((item) => item.id === shot.scene_id);
  const location = script.locations.find((item) => item.id === shot.location);
  const characters = namesFor(script, shot.characters);
  const positiveParts = [
    scene?.title,
    shot.description,
    location?.name ?? shot.location,
    characters ? `角色：${characters}` : "",
    `镜头：${shot.camera}，${shot.framing}，${shot.movement}`,
    `视觉风格：${shot.visual_style}`
  ].filter(Boolean);

  return {
    id: `prompt_${shot.id}`,
    shot_id: shot.id,
    positive: positiveParts.join("；"),
    negative: "低清晰度，画面畸变，字幕，水印，错位手指，多余人物，闪烁，过曝",
    model_notes: "保持角色外观连续，动作克制，镜头语言服务剧情信息，不添加无关情节。",
    duration_seconds: shot.duration_seconds,
    aspect_ratio: "16:9"
  };
}

export function generateVideoPrompts(script: ScriptYaml): ScriptYaml {
  const scriptWithStoryboard = script.storyboard?.shots.length ? script : generateStoryboard(script);
  const shots = scriptWithStoryboard.storyboard?.shots ?? [];

  return {
    ...scriptWithStoryboard,
    video_prompts: shots.map((shot) => promptForShot(scriptWithStoryboard, shot))
  };
}
