import { useState, useEffect, useRef } from "react";
import { albumArtStorage } from "../platform/storage";

const pendingLoads = new Map<string, Promise<string | null>>();

export function useAlbumArt(
  songId: string | undefined,
  hasAlbumArt: boolean = false,
): string | undefined {
  const [albumArt, setAlbumArt] = useState<string | undefined>(() =>
    songId ? albumArtStorage.get(songId) : undefined,
  );

  useEffect(() => {
    if (!songId || !hasAlbumArt) {
      setAlbumArt(undefined);
      return;
    }

    const cached = albumArtStorage.get(songId);
    if (cached) {
      setAlbumArt(cached);
      return;
    }

    if (pendingLoads.has(songId)) {
      pendingLoads.get(songId)!.then((art) => {
        if (art) setAlbumArt(art);
      });
      return;
    }

    const loadPromise = albumArtStorage.load(songId);
    pendingLoads.set(songId, loadPromise);

    loadPromise.then((art) => {
      if (art) setAlbumArt(art);
    }).finally(() => {
      pendingLoads.delete(songId);
    });
  }, [songId, hasAlbumArt]);

  return albumArt;
}

export function useAlbumArtBatch(
  songs: Array<{ id: string; hasAlbumArt?: boolean }>,
): Map<string, string> {
  const [albumArts, setAlbumArts] = useState<Map<string, string>>(new Map());
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    if (songs.length === 0) return;

    const toLoad = songs.filter(
      (song) => song.hasAlbumArt && !albumArtStorage.has(song.id) && !loadedRef.current.has(song.id),
    );

    if (toLoad.length === 0) {
      const cached = new Map<string, string>();
      for (const song of songs) {
        const art = albumArtStorage.get(song.id);
        if (art) cached.set(song.id, art);
      }
      if (cached.size > 0) setAlbumArts(cached);
      return;
    }

    toLoad.forEach((song) => loadedRef.current.add(song.id));
    albumArtStorage.loadBatch(toLoad.map((s) => s.id)).then((loaded) => {
      const allArts = new Map<string, string>();
      for (const song of songs) {
        const art = albumArtStorage.get(song.id);
        if (art) allArts.set(song.id, art);
      }
      setAlbumArts(allArts);
    });
  }, [songs]);

  return albumArts;
}

