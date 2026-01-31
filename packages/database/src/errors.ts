export type ErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN";

export class ScoreBrawlError extends Error {
  code: ErrorCode;
  cause?: Error;

  constructor({ code, message, cause }: { code: ErrorCode; message: string; cause?: Error }) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}
