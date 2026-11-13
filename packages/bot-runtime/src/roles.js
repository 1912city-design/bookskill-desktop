import { UnknownRoleError, ValidationError } from "./errors.js";

export const CONTRACT_ROLES = Object.freeze([
  "orchestrator",
  "product",
  "architect",
  "frontend_engineer",
  "backend_engineer",
  "ai_skill_engineer",
  "qa_security",
  "release_engineer",
]);

export function buildRoleCatalog(rolesConfig) {
  const list = rolesConfig?.roles;
  if (!Array.isArray(list) || list.length === 0) {
    throw new ValidationError("roles.json must contain a non-empty roles array");
  }

  const ids = list.map((role) => role.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new ValidationError("roles.json contains duplicate role ids");
  }

  const expected = CONTRACT_ROLES.join(",");
  const actual = [...unique].join(",");
  if (ids.length !== CONTRACT_ROLES.length || CONTRACT_ROLES.some((id, i) => ids[i] !== id && !unique.has(id))) {
    const missing = CONTRACT_ROLES.filter((id) => !unique.has(id));
    const extra = ids.filter((id) => !CONTRACT_ROLES.includes(id));
    if (missing.length || extra.length || unique.size !== CONTRACT_ROLES.length) {
      throw new ValidationError(
        `roles.json must contain exactly the 8 contract roles [${expected}]; got [${[...unique].join(",")}]`,
      );
    }
  }
  if (unique.size !== CONTRACT_ROLES.length || CONTRACT_ROLES.some((id) => !unique.has(id))) {
    throw new ValidationError(
      `roles.json must contain exactly the 8 contract roles [${expected}]; got [${actual}]`,
    );
  }

  const byId = new Map();
  for (const role of list) {
    if (!Array.isArray(role.allowedOperations) || !Array.isArray(role.forbiddenOperations)) {
      throw new ValidationError(`Role ${role.id} must declare allowedOperations and forbiddenOperations`);
    }
    byId.set(role.id, Object.freeze({
      ...role,
      allowedOperations: Object.freeze([...role.allowedOperations]),
      forbiddenOperations: Object.freeze([...role.forbiddenOperations]),
    }));
  }
  return Object.freeze({
    ids: Object.freeze([...CONTRACT_ROLES]),
    byId,
  });
}

export function assertKnownRole(catalog, role) {
  if (!catalog.byId.has(role)) {
    throw new UnknownRoleError(role);
  }
  return catalog.byId.get(role);
}

export function roleAllows(catalog, role, tool) {
  const def = assertKnownRole(catalog, role);
  if (def.forbiddenOperations.includes(tool)) return false;
  return def.allowedOperations.includes(tool);
}
