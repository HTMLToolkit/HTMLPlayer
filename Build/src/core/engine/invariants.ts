/**
 * Fails loudly when an assumption that the code treats as impossible is
 * violated at runtime. Used to convert silent degeneracy into a crash with a
 * message, never for expected, recoverable conditions.
 */

export function assertInvariant(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}

export function assertNever(value: never): never {
  throw new Error(`Invariant violation: unexpected value ${String(value)}`);
}
