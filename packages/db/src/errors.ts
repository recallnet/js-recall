export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParsingError";
    Error.captureStackTrace(this, this.constructor);
  }
}
