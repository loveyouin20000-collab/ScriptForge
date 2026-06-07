export type ProjectDraft = {
  title: string;
  author: string;
  text: string;
};

export type ProjectDraftsByAccount = Record<string, ProjectDraft>;

function isProjectDraft(value: unknown): value is ProjectDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ProjectDraft).title === "string" &&
    typeof (value as ProjectDraft).author === "string" &&
    typeof (value as ProjectDraft).text === "string"
  );
}

export function parseProjectDrafts(rawValue: string | null): ProjectDraftsByAccount {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<ProjectDraftsByAccount>((drafts, [accountId, value]) => {
      if (!isProjectDraft(value)) return drafts;
      return {
        ...drafts,
        [accountId]: value
      };
    }, {});
  } catch {
    return {};
  }
}

export function serializeProjectDrafts(drafts: ProjectDraftsByAccount) {
  return JSON.stringify(drafts);
}

export function getProjectDraft(drafts: ProjectDraftsByAccount, accountId: string, defaultDraft: ProjectDraft) {
  return drafts[accountId] ?? defaultDraft;
}

export function updateProjectDraft(
  drafts: ProjectDraftsByAccount,
  accountId: string,
  draft: ProjectDraft
): ProjectDraftsByAccount {
  return {
    ...drafts,
    [accountId]: draft
  };
}
