import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createBusinessId } from "@bookskill/data";

export function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function newId(): string {
  return createBusinessId();
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export type ResolveEnvOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homedir?: string;
};

/** node:sqlite has no better-sqlite3-style db.transaction() helper. */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // The connection may already have rolled back.
    }
    throw error;
  }
}
