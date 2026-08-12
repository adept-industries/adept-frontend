import type { components } from "./generated/schema.js";

export type FieldViolation = components["schemas"]["FieldError"];
export type ApiProblem = components["schemas"]["ProblemDetail"];

export function isApiProblem(value: unknown): value is ApiProblem {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    typeof (value as Record<string, unknown>).code === "string" &&
    typeof (value as Record<string, unknown>).status === "number"
  );
}

export class ApiError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.detail);
    this.name = "ApiError";
    this.problem = problem;
  }
}

export function problemFromError(error: unknown): ApiProblem | null {
  if (error instanceof ApiError) return error.problem;
  return isApiProblem(error) ? error : null;
}

export function localProblem(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance = "/api",
): ApiProblem {
  return {
    type: `https://adept.local/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    detail,
    instance,
    code,
    traceId: "local",
  };
}
