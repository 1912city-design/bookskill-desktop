const SECRET_KEY_RE =
  /^(?:.*(?:api[_-]?key|access[_-]?key|secret|password|passwd|token|authorization|private[_-]?key|credential|auth).*)/i;

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bghp_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

const KEY_VALUE_RE =
  /((?:api[_-]?key|access[_-]?key|secret|password|passwd|token|authorization)\s*[:=]\s*)(["']?)([^\s"',]+)(["']?)/gi;

export const REDACTED = "[REDACTED]";

function redactString(value) {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, REDACTED);
  }
  KEY_VALUE_RE.lastIndex = 0;
  out = out.replace(KEY_VALUE_RE, (_, prefix, q1 = "", _val, q2 = "") => {
    return `${prefix}${q1}${REDACTED}${q2}`;
  });
  return out;
}

export function redact(value) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      code: value.code,
      message: redactString(String(value.message)),
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEY_RE.test(key) ? REDACTED : redact(item);
    }
    return out;
  }
  return redactString(String(value));
}

export function containsPlaintextSecret(haystack, secrets) {
  const text = typeof haystack === "string" ? haystack : JSON.stringify(haystack);
  return secrets.some((secret) => secret && text.includes(secret));
}
