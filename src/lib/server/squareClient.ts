import "server-only";
import { SquareClient, SquareEnvironment } from "square";

/** One client per request — the SDK is cheap to construct and this avoids holding a shared
 *  instance across serverless invocations. Environment is driven by the same
 *  NEXT_PUBLIC_SQUARE_ENVIRONMENT the client reads to pick the Web Payments SDK script URL —
 *  it isn't a secret, so one var instead of two kept in sync (see .env.example). */
export function createSquareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set.");
  const environment =
    process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
  return new SquareClient({ token, environment });
}

export function squareLocationId(): string {
  const id = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  if (!id) throw new Error("NEXT_PUBLIC_SQUARE_LOCATION_ID is not set.");
  return id;
}
