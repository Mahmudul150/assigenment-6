export class AppError extends Error {
  public statusCode: number;
  public errors: { field?: string; message: string }[];

  constructor(statusCode: number, message: string, errors: { field?: string; message: string }[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}
