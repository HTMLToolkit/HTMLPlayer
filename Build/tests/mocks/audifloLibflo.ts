const initFlo = async (): Promise<void> => undefined;

interface FloInfoResult {
  sample_rate?: number;
  channels?: number;
  bit_depth?: number;
  duration_secs?: number;
  total_samples?: bigint;
}

interface FloTags {
  title?: string;
  artist?: string;
  album?: string;
}

interface FloCoverArt {
  mime_type: string;
  data: Uint8Array;
}

export function decode(_audioData: Uint8Array): Float32Array {
  return new Float32Array(0);
}

export function info(_audioData: Uint8Array): FloInfoResult {
  return {};
}

export function get_metadata(_audioData: Uint8Array): FloTags | null {
  return null;
}

export function get_cover_art(_audioData: Uint8Array): FloCoverArt | null {
  return null;
}

export class WasmStreamingDecoder {
  feed(_data: Uint8Array): boolean {
    return true;
  }
  get_info(): FloInfoResult | null {
    return null;
  }
  has_error(): boolean {
    return false;
  }
  next_frame(): Float32Array | null {
    return null;
  }
  free(): void {}
}

export default initFlo;