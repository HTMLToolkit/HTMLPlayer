export class AsyncOp {
  private generation = 0;

  next(): number {
    return ++this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  peek(): number {
    return this.generation;
  }

  invalidate(): void {
    this.generation++;
  }
}
