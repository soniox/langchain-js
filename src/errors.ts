export class SonioxError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public cause?: Error,
  ) {
    super(message);
    this.name = "SonioxError";
  }
}

export class SonioxValidationError extends SonioxError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "SonioxValidationError";
  }
}

export class SonioxTimeoutError extends SonioxError {
  constructor(message: string) {
    super(message, "TIMEOUT_ERROR");
    this.name = "SonioxTimeoutError";
  }
}

export class SonioxAPIError extends SonioxError {
  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message, "API_ERROR", statusCode, cause);
    this.name = "SonioxAPIError";
  }
}
