export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "REQUEST_ERROR",
  ) {
    super(message);
  }
}
