export type SavedYamlVersion = {
  id: string;
  createdAt: string;
  projectTitle: string;
  yaml: string;
  valid: boolean;
  issueCount: number;
  size: number;
};

export const YAML_VERSION_LIMIT = 10;

type CreateYamlVersionInput = {
  yaml: string;
  projectTitle: string;
  valid: boolean;
  issueCount: number;
  createdAt?: string;
};

function hashYaml(yaml: string) {
  let hash = 0;
  for (let index = 0; index < yaml.length; index += 1) {
    hash = (hash * 31 + yaml.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function createYamlVersion(input: CreateYamlVersionInput): SavedYamlVersion {
  const createdAt = input.createdAt ?? new Date().toISOString();

  return {
    id: `${createdAt}-${hashYaml(input.yaml)}`,
    createdAt,
    projectTitle: input.projectTitle.trim() || "未命名项目",
    yaml: input.yaml,
    valid: input.valid,
    issueCount: input.issueCount,
    size: input.yaml.length
  };
}

export function addYamlVersion(
  currentVersions: SavedYamlVersion[],
  version: SavedYamlVersion,
  limit = YAML_VERSION_LIMIT
) {
  return [version, ...currentVersions.filter((item) => item.id !== version.id)].slice(0, limit);
}

export function updateYamlVersionContent(
  currentVersions: SavedYamlVersion[],
  versionId: string,
  yaml: string
) {
  return currentVersions.map((version) => {
    if (version.id !== versionId) return version;

    return {
      ...version,
      yaml,
      size: yaml.length
    };
  });
}

export function deleteYamlVersion(currentVersions: SavedYamlVersion[], versionId: string) {
  return currentVersions.filter((version) => version.id !== versionId);
}

export function serializeYamlVersions(versions: SavedYamlVersion[]) {
  return JSON.stringify(versions);
}

export function parseYamlVersions(rawValue: string | null): SavedYamlVersion[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedYamlVersion => {
      return (
        typeof item?.id === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.projectTitle === "string" &&
        typeof item.yaml === "string" &&
        typeof item.valid === "boolean" &&
        typeof item.issueCount === "number" &&
        typeof item.size === "number"
      );
    });
  } catch {
    return [];
  }
}
