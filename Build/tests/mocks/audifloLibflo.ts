const initFlo = async (): Promise<void> => undefined;

interface FloInfoResult {
  artist?: string;
  album?: string;
  sample_rate?: number;
  channels?: number;
  bit_depth?: number;
}

export function decode(_audioData: Uint8Array): Float32Array {
  return new Float32Array(0);
}

export function info(_audioData: Uint8Array): FloInfoResult {
  return {};
}

export default initFlo;