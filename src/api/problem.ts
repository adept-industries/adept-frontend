/**
 * Typed representation of an RFC 9457 / application/problem+json response
 * returned by the Adept API on every error path.
 */
export interface FieldViolation {
  field: string;
  message: string;
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
  fieldErrors?: FieldViolation[];
}

export function isApiProblem(value: unknown): value is ApiProblem {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    typeof (value as Record<string, unknown>).code === "string"
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
