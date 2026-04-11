export interface Provider {
  name: string;
  isAvailable(): boolean;
}

export abstract class BaseProvider implements Provider {
  abstract name: string;

  isAvailable(): boolean {
    return true;
  }
}

export interface SearchQuery {
  title?: string;
  artist?: string;
  album?: string;
}

export interface ProviderResult<T> {
  data: T;
  source: string;
  confidence: number;
}
