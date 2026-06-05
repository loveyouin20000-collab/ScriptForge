import type { ScriptYaml } from "./types";

export function scriptToMarkdown(script: ScriptYaml) {
  const lines: string[] = [];
  lines.push(`# ${script.metadata.title}`);
  lines.push("");
  lines.push(`作者：${script.metadata.author}`);
  lines.push(`版本：${script.metadata.version}`);
  lines.push("");
  lines.push("## 人物表");
  script.characters.forEach((character) => {
    lines.push(`- **${character.name}**（${character.role}）：${character.description}`);
  });
  lines.push("");
  lines.push("## 场景");
  script.scenes.forEach((scene) => {
    lines.push(`### ${scene.title}`);
    lines.push("");
    lines.push(`地点：${scene.setting.location}`);
    lines.push(`时间：${scene.setting.time}`);
    lines.push(`氛围：${scene.setting.atmosphere}`);
    lines.push(`功能：${scene.purpose}`);
    lines.push("");
    scene.script.forEach((line) => {
      if (line.type === "dialogue") {
        const character = script.characters.find((item) => item.id === line.character);
        lines.push(`**${character?.name ?? line.character}**：${line.content}`);
      } else if (line.type === "transition") {
        lines.push(`> 转场：${line.content}`);
      } else {
        lines.push(line.content);
      }
      lines.push("");
    });
  });
  return lines.join("\n");
}
