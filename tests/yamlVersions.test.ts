import { describe, expect, it } from "vitest";
import {
  addYamlVersion,
  createYamlVersion,
  deleteYamlVersion,
  parseYamlVersions,
  serializeYamlVersions,
  updateYamlVersionContent
} from "@/lib/yamlVersions";

describe("yaml version history", () => {
  it("creates a restorable YAML snapshot", () => {
    const version = createYamlVersion({
      yaml: "metadata:\n  title: 雨夜旧案",
      projectTitle: "雨夜旧案",
      valid: true,
      issueCount: 0,
      createdAt: "2026-06-06T10:00:00.000Z"
    });

    expect(version).toMatchObject({
      createdAt: "2026-06-06T10:00:00.000Z",
      projectTitle: "雨夜旧案",
      yaml: "metadata:\n  title: 雨夜旧案",
      valid: true,
      issueCount: 0,
      size: 23
    });
    expect(version.id).toContain("2026-06-06T10:00:00.000Z");
  });

  it("keeps newest versions first and respects the limit", () => {
    const versions = ["a", "b", "c"].map((yaml, index) =>
      createYamlVersion({
        yaml,
        projectTitle: "项目",
        valid: true,
        issueCount: 0,
        createdAt: `2026-06-06T10:0${index}:00.000Z`
      })
    );

    expect(addYamlVersion([versions[0], versions[1]], versions[2], 2)).toEqual([versions[2], versions[0]]);
  });

  it("serializes and ignores corrupted stored history", () => {
    const version = createYamlVersion({
      yaml: "source: {}",
      projectTitle: "",
      valid: false,
      issueCount: 2,
      createdAt: "2026-06-06T10:00:00.000Z"
    });

    expect(parseYamlVersions(serializeYamlVersions([version]))).toEqual([version]);
    expect(parseYamlVersions("{broken")).toEqual([]);
  });

  it("updates saved YAML content for an existing version", () => {
    const version = createYamlVersion({
      yaml: "source: {}",
      projectTitle: "项目",
      valid: true,
      issueCount: 0,
      createdAt: "2026-06-06T10:00:00.000Z"
    });

    expect(updateYamlVersionContent([version], version.id, "metadata: {}")).toEqual([
      {
        ...version,
        yaml: "metadata: {}",
        size: 12
      }
    ]);
  });

  it("deletes a saved YAML version by id", () => {
    const versions = ["a", "b"].map((yaml, index) =>
      createYamlVersion({
        yaml,
        projectTitle: "项目",
        valid: true,
        issueCount: 0,
        createdAt: `2026-06-06T10:0${index}:00.000Z`
      })
    );

    expect(deleteYamlVersion(versions, versions[0].id)).toEqual([versions[1]]);
  });
});
