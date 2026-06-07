import { describe, expect, it } from "vitest";
import { actionErrorMessage, validationErrorMessage } from "@/lib/apiErrors";

describe("API error messages", () => {
  it("formats validation issues into an actionable message", () => {
    expect(
      validationErrorMessage([
        { path: "storyboard.shots.0.scene_id", message: "引用不存在" },
        { path: "video_prompts.0.shot_id", message: "引用不存在" }
      ])
    ).toBe("YAML 校验未通过：storyboard.shots.0.scene_id 引用不存在；video_prompts.0.shot_id 引用不存在");
  });

  it("extracts validation issues when an API response has no error field", () => {
    expect(
      actionErrorMessage(
        {
          valid: false,
          issues: [{ path: "scenes.0.characters.0", message: "角色不存在" }]
        },
        "操作失败"
      )
    ).toBe("YAML 校验未通过：scenes.0.characters.0 角色不存在");
  });
});
