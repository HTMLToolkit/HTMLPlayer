export interface Integration {
  name: string;
  initialize(): Promise<void>;
  dispose(): void;
  isAvailable(): boolean;
}

export abstract class BaseIntegration implements Integration {
  abstract name: string;
  protected initialized = false;
  protected disposed = false;

  abstract initialize(): Promise<void>;
  abstract dispose(): void;

  isAvailable(): boolean {
    return this.initialized && !this.disposed;
  }

  protected setInitialized(value: boolean): void {
    this.initialized = value;
  }

  protected isDisposed(): boolean {
    return this.disposed;
  }
}
