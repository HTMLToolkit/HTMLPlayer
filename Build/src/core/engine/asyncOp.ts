/**
 * Cancellation token for a single logical async operation.
 */
export class AsyncOp {
  private generation = 0;

  /** Start a new op and return the generation that now represents it. */
  next(): number {
    return ++this.generation;
  }

  /** True when `generation` is the generation of the most recent next(). */
  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  /** Read the current generation without beginning a new op. */
  peek(): number {
    return this.generation;
  }

  /** Invalidate every in-flight op without starting a new one. */
  invalidate(): void {
    this.generation++;
  }
}
