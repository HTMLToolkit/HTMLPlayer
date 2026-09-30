import { isPlainObject } from "../core/engine/validators";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function sanitizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter(isString) : [];
}

export const SCHEMA_VERSION = 1;

export interface VersionedEnvelope<T> {
  schemaVersion: number;
  value: T;
}

export function withSchemaVersion<T>(value: T): VersionedEnvelope<T> {
  return { schemaVersion: SCHEMA_VERSION, value };
}

export function unwrapVersioned<T>(
  envelope: unknown,
  sanitize: (value: unknown) => T,
  fallback: T,
): T {
  if (!isPlainObject(envelope)) return fallback;
  if (envelope.schemaVersion !== SCHEMA_VERSION) return fallback;
  return sanitize(envelope.value);
}

export function serializeVersioned<T>(value: T): string {
  return JSON.stringify(withSchemaVersion(value));
}

export function deserializeVersionedJson(
  raw: string | null,
): VersionedEnvelope<unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    return { schemaVersion: parsed.schemaVersion, value: parsed.value };
  } catch {
    return null;
  }
}
