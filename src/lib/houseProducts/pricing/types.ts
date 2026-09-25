export interface QuoteError {
  error: string;
}

export function isQuoteError<T>(result: T | QuoteError): result is QuoteError {
  return typeof result === "object" && result !== null && "error" in result;
}
