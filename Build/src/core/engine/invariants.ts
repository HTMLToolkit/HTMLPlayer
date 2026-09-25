
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
