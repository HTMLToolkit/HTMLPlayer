import type { Track } from "../../src/core/engine/types";

export function createMockTrack(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    duration: 180,
    url: `file:///${id}.mp3`,
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(
  rand: () => number,
  min: number,
  max: number,
): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}