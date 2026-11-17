export {
  BUSINESS_DB_BACKUP_DIRNAME,
  BUSINESS_DB_DIRNAME,
  BUSINESS_DB_FILENAME,
  CORE_TABLES,
  SCHEMA_VERSION_CURRENT,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
  UUID_ID_CHECK_SQL,
} from "./constants.ts";
export type { CoreTableName } from "./constants.ts";

export { createBusinessId, isUuid } from "./uuid.ts";

export { assertBusinessDbPath, resolveBusinessDbPath } from "./paths.ts";
export type { ResolveDataDirOptions } from "./paths.ts";

export { BUILTIN_MIGRATIONS, migrationV1, migrationV2, migrationV3 } from "./migrations.ts";
export type { Migration } from "./migrations.ts";

export {
  MigrationError,
  getSchemaVersion,
  migrateBusinessDatabase,
  openBusinessDatabase,
} from "./migrate.ts";
export type {
  BusinessDatabase,
  MigrateDatabaseOptions,
  MigrationResult,
} from "./migrate.ts";
