import { DeniedToolError, UnauthorizedToolError, ValidationError } from "./errors.js";
import { roleAllows } from "./roles.js";

const ALWAYS_DENIED = new Set([
  "merge_main",
  "push_main",
  "merge_own_pr",
  "production_release",
  "read_production_secrets",
  "delete_production_data",
  "access_real_user_books",
  "bypass_payment_or_license",
]);

export function buildToolCatalog(toolsConfig) {
  const allowed = toolsConfig?.allowed ?? [];
  const denied = toolsConfig?.denied ?? [];
  const aliases = toolsConfig?.aliases ?? {};

  if (!Array.isArray(allowed) || !Array.isArray(denied)) {
    throw new ValidationError("tools.json must declare allowed and denied arrays");
  }

  const allowedIds = new Set(allowed.map((tool) => tool.id));
  const deniedIds = new Set(denied.map((tool) => tool.id));

  for (const id of ALWAYS_DENIED) {
    if (!deniedIds.has(id)) {
      throw new ValidationError(`tools.json must explicitly deny ${id}`);
    }
    if (allowedIds.has(id)) {
      throw new ValidationError(`Denied tool ${id} must not also appear on the allowlist`);
    }
  }

  const reasons = new Map(denied.map((tool) => [tool.id, tool.reason ?? "Denied by policy"]));
  const aliasMap = new Map(Object.entries(aliases));

  return Object.freeze({
    allowedIds: Object.freeze(allowedIds),
    deniedIds: Object.freeze(deniedIds),
    reasons: Object.freeze(reasons),
    aliases: Object.freeze(aliasMap),
    allowed: Object.freeze(allowed),
    denied: Object.freeze(denied),
  });
}

export function canonicalizeTool(catalog, tool) {
  if (tool == null || String(tool).trim() === "") {
    throw new DeniedToolError("(empty)", "Tool name is required");
  }
  const raw = String(tool);
  return catalog.aliases.get(raw) ?? raw;
}

export function isDeniedTool(catalog, tool) {
  const canonical = canonicalizeTool(catalog, tool);
  return catalog.deniedIds.has(canonical);
}

export function assertToolAllowed(catalog, roles, role, tool) {
  const canonical = canonicalizeTool(catalog, tool);

  if (catalog.deniedIds.has(canonical)) {
    throw new DeniedToolError(canonical, catalog.reasons.get(canonical));
  }

  if (!catalog.allowedIds.has(canonical)) {
    throw new DeniedToolError(canonical, "Unknown tools are rejected by fail-closed policy");
  }

  if (!roleAllows(roles, role, canonical)) {
    throw new UnauthorizedToolError(role, canonical);
  }

  return canonical;
}
