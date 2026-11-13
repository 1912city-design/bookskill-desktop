import fs from "node:fs";
import path from "node:path";
import type { ReaderAnnotation } from "./types.ts";

const BOOK_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ANNOTATIONS_FILENAME = "annotations.json";

export type AnnotationStore = {
  readonly dataDir: string;
  load(bookId: string): ReaderAnnotation[];
  save(annotation: ReaderAnnotation, now?: Date): ReaderAnnotation[];
  pathFor(bookId: string): string;
};

export function assertSafeBookId(bookId: string): void {
  if (!BOOK_ID_RE.test(bookId)) {
    throw new Error("无效的书籍编号。");
  }
}

export function annotationsFilePath(dataDir: string, bookId: string): string {
  assertSafeBookId(bookId);
  const resolvedDataDir = path.resolve(dataDir);
  const filePath = path.resolve(resolvedDataDir, "library", bookId, ANNOTATIONS_FILENAME);
  const libraryRoot = path.resolve(resolvedDataDir, "library") + path.sep;
  if (filePath !== path.join(libraryRoot, bookId, ANNOTATIONS_FILENAME) && !filePath.startsWith(libraryRoot)) {
    throw new Error("批注路径必须位于 BookSkill 数据目录内。");
  }
  return filePath;
}

export function loadAnnotations(dataDir: string, bookId: string): ReaderAnnotation[] {
  const filePath = annotationsFilePath(dataDir, bookId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    annotations?: unknown;
  };
  if (!Array.isArray(raw.annotations)) {
    return [];
  }
  return raw.annotations.filter(isReaderAnnotation);
}

export function saveAnnotation(
  dataDir: string,
  annotation: ReaderAnnotation,
  now: Date = new Date(),
): ReaderAnnotation[] {
  if (annotation.bookId !== annotation.bookId.trim() || !annotation.id) {
    throw new Error("批注缺少编号。");
  }
  assertSafeBookId(annotation.bookId);
  const filePath = annotationsFilePath(dataDir, annotation.bookId);
  const existing = loadAnnotations(dataDir, annotation.bookId);
  const next = [...existing.filter((entry) => entry.id !== annotation.id), annotation];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    bookId: annotation.bookId,
    updatedAt: now.toISOString(),
    annotations: next,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return next;
}

/**
 * A stateless store pointed at one BookSkill data directory.
 * A new store on the same path always reads from disk (re-open).
 */
export function createAnnotationStore(dataDir: string): AnnotationStore {
  const resolved = path.resolve(dataDir);
  return {
    dataDir: resolved,
    load(bookId: string): ReaderAnnotation[] {
      return loadAnnotations(resolved, bookId);
    },
    save(annotation: ReaderAnnotation, now?: Date): ReaderAnnotation[] {
      return saveAnnotation(resolved, annotation, now);
    },
    pathFor(bookId: string): string {
      return annotationsFilePath(resolved, bookId);
    },
  };
}

function isReaderAnnotation(value: unknown): value is ReaderAnnotation {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Partial<ReaderAnnotation>;
  return (
    typeof row.id === "string" &&
    typeof row.bookId === "string" &&
    row.kind === "excerpt" &&
    typeof row.text === "string" &&
    typeof row.note === "string" &&
    typeof row.confirmed === "boolean" &&
    typeof row.createdAt === "string" &&
    (row.chunkId === null || typeof row.chunkId === "string") &&
    (row.paragraphId === null || typeof row.paragraphId === "string") &&
    (row.chapter === null || typeof row.chapter === "string") &&
    (row.page === null || typeof row.page === "number")
  );
}
