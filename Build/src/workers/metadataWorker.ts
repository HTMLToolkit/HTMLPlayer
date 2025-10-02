import { parseBlob, selectCover } from "music-metadata";

// Constants for missing metadata (will be translated in main thread)
const UNKNOWN_ARTIST = "__UNKNOWN_ARTIST__";
const UNKNOWN_ALBUM = "__UNKNOWN_ALBUM__";

// Worker receives file and processes metadata
self.onmessage = async (event: MessageEvent) => {
  const { file, fileName } = event.data;

  try {
    const metadata = await parseBlob(file, { skipCovers: false, duration: true });

    let albumArt: string | undefined = undefined;
    const cover = selectCover(metadata.common.picture);
    if (cover && cover.data && cover.data.length > 0) {
      try {
        const uint8Array = new Uint8Array(cover.data);
        const blob = new Blob([uint8Array], { type: cover.format });

        albumArt = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read album art'));
          reader.readAsDataURL(blob);
        });
      } catch (artError) {
        console.warn("Failed to process album art:", artError);
      }
    }

    const result = {
      title: (metadata.common.title && typeof metadata.common.title === "string")
        ? metadata.common.title
        : fileName.replace(/\.[^/.]+$/, ""),
      artist: (metadata.common.artist && typeof metadata.common.artist === "string")
        ? metadata.common.artist
        : UNKNOWN_ARTIST,
      album: (metadata.common.album && typeof metadata.common.album === "string")
        ? metadata.common.album
        : UNKNOWN_ALBUM,
      duration: metadata.format.duration ?? 0,
    };

    self.postMessage({ metadata: result, albumArt });
  } catch (e) {
    self.postMessage({ error: `Failed to process metadata for ${fileName}: ${e}` });
  }
};