import type { Scene, ScriptLine, ScriptYaml, StoryboardShot } from "./types";

function shotId(sceneId: string, index: number) {
  return `shot_${sceneId}_${String(index + 1).padStart(3, "0")}`;
}

function charactersForLine(line: ScriptLine, scene: Scene) {
  if (line.type === "dialogue") return [line.character];
  return scene.characters;
}

function descriptionForLine(line: ScriptLine, scene: Scene) {
  if (line.type === "dialogue") {
    return `${scene.title}：角色说出“${line.content}”。`;
  }
  if (line.type === "transition") {
    return `${scene.title}：转场，${line.content}`;
  }
  return `${scene.title}：${line.content}`;
}

function framingForLine(line: ScriptLine) {
  if (line.type === "dialogue") return "close-up";
  if (line.type === "transition") return "wide";
  return "medium";
}

function durationForLine(line: ScriptLine) {
  if (line.type === "dialogue") return 5;
  if (line.type === "transition") return 3;
  return 4;
}

export function generateStoryboard(script: ScriptYaml): ScriptYaml {
  const shots: StoryboardShot[] = script.scenes.flatMap((scene) =>
    scene.script.map((line, index) => ({
      id: shotId(scene.id, index),
      scene_id: scene.id,
      source_script_index: index,
      description: descriptionForLine(line, scene),
      camera: "static",
      framing: framingForLine(line),
      movement: index === 0 ? "slow push-in" : "subtle handheld",
      duration_seconds: durationForLine(line),
      visual_style: `${scene.setting.atmosphere}，影视短剧，低饱和，真实光影`,
      characters: charactersForLine(line, scene),
      location: scene.setting.location
    }))
  );

  return {
    ...script,
    storyboard: {
      shots
    }
  };
}
