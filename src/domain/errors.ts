export class BusinessError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 422, code = "BUSINESS_RULE") {
    super(message);
    this.name = "BusinessError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
