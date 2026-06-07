import { describe, expect, it } from "vitest";
import {
  getProjectDraft,
  parseProjectDrafts,
  serializeProjectDrafts,
  updateProjectDraft,
  type ProjectDraft
} from "@/lib/projectDrafts";

const defaultDraft: ProjectDraft = {
  title: "雨夜旧案",
  author: "原作者",
  text: "默认正文"
};

describe("project drafts", () => {
  it("keeps drafts isolated by account id", () => {
    const drafts = updateProjectDraft(
      updateProjectDraft({}, "admin", { ...defaultDraft, author: "管理员作者" }),
      "user",
      { ...defaultDraft, author: "普通用户作者" }
    );

    expect(getProjectDraft(drafts, "admin", defaultDraft).author).toBe("管理员作者");
    expect(getProjectDraft(drafts, "user", defaultDraft).author).toBe("普通用户作者");
  });

  it("serializes drafts and ignores corrupted stored values", () => {
    const drafts = updateProjectDraft({}, "user", { ...defaultDraft, title: "用户项目" });

    expect(parseProjectDrafts(serializeProjectDrafts(drafts))).toEqual(drafts);
    expect(parseProjectDrafts("{broken")).toEqual({});
  });

  it("falls back to the default draft for accounts without a saved project", () => {
    expect(getProjectDraft({}, "admin", defaultDraft)).toEqual(defaultDraft);
  });
});
