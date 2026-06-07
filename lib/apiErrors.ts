import type { ValidationIssue } from "./types";

type ValidationPayload = {
  error?: unknown;
  issues?: unknown;
};

function isValidationIssue(value: unknown): value is ValidationIssue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ValidationIssue).path === "string" &&
    typeof (value as ValidationIssue).message === "string"
  );
}

export function validationErrorMessage(issues: ValidationIssue[]) {
  const detail = issues.map((issue) => `${issue.path} ${issue.message}`).join("；");
  return detail ? `YAML 校验未通过：${detail}` : "YAML 校验未通过";
}

export function actionErrorMessage(payload: ValidationPayload, fallback: string) {
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (Array.isArray(payload.issues)) {
    const issues = payload.issues.filter(isValidationIssue);
    if (issues.length) return validationErrorMessage(issues);
  }
  return fallback;
}
