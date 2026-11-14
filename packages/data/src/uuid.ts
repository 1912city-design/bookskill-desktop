import { randomUUID } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generate a UUID v4 for use as a business primary key. */
export function createBusinessId(): string {
  return randomUUID();
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
