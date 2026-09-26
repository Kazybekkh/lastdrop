export class GrokError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrokError";
  }
}
