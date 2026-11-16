/** Directory under the BookSkill data dir that holds the business database. */
export const BUSINESS_DB_DIRNAME = "db";

/** Canonical business database filename. */
export const BUSINESS_DB_FILENAME = "bookskill.sqlite";

/** Backup files written before applying pending migrations. */
export const BUSINESS_DB_BACKUP_DIRNAME = "backups";

/** First schema version: contract section 3.1 core tables. */
export const SCHEMA_VERSION_V1 = 1;

/**
 * Current schema version.
 * V2 is a real follow-on migration (adds source_chunks.ordinal), not an empty jump.
 */
export const SCHEMA_VERSION_V2 = 2;

/** V3: append-only knowledge card revision history (VER-001). */
export const SCHEMA_VERSION_V3 = 3;

export const SCHEMA_VERSION_CURRENT = SCHEMA_VERSION_V3;

/**
 * Contract section 3.1 business objects.
 * schema_migrations is a runner table, not a business object.
 */
export const CORE_TABLES = [
  "books",
  "source_chunks",
  "annotations",
  "knowledge_cards",
  "knowledge_card_revisions",
  "knowledge_sources",
  "knowledge_relations",
  "skills",
  "skill_versions",
  "skill_sources",
  "conversations",
  "conversation_turns",
  "conversation_skill_bindings",
  "evidence_refs",
  "skill_runs",
  "feedback",
] as const;

export type CoreTableName = (typeof CORE_TABLES)[number];

/** SQL CHECK that a TEXT primary key looks like a UUID. */
/** SQLite GLOB here uses [^] for character-class negation, not Unix-style [!]. */
export const UUID_ID_CHECK_SQL = `(
  length(id) = 36
  AND id GLOB '????????-????-????-????-????????????'
  AND id NOT GLOB '*[^0-9A-Fa-f-]*'
)`;
