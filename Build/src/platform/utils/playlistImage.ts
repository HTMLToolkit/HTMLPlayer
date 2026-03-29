import type { Track } from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("playlistImage");

export async function generatePlaylistImage(songs: Track[]): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const uniqueArts = [
    ...new Set(songs.filter((s) => s.albumArt).map((s) => s.albumArt)),
  ].slice(0, 4);

  if (uniqueArts.length === 0) return "";

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  try {
    const images = await Promise.all(uniqueArts.map((art) => loadImage(art!)));
    ctx.fillStyle = "#1E3A8A";
    ctx.fillRect(0, 0, 80, 80);

    const positions: [number, number, number, number][] =
      images.length === 1
        ? [[0, 0, 80, 80]]
        : images.length === 2
          ? [
              [0, 0, 40, 80],
              [40, 0, 40, 80],
            ]
          : images.length === 3
            ? [
                [0, 0, 80, 40],
                [0, 40, 40, 40],
                [40, 40, 40, 40],
              ]
            : [
                [0, 0, 40, 40],
                [40, 0, 40, 40],
                [0, 40, 40, 40],
                [40, 40, 40, 40],
              ];

    images.forEach((img, i) => ctx.drawImage(img, ...positions[i]));
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, 80, 80);

    const result = canvas.toDataURL("image/jpeg", 0.7);
    canvas.width = 0;
    canvas.height = 0;
    return result;
  } catch (error) {
    logger.error("Failed to generate playlist image:", { error: String(error) });
    canvas.width = 0;
    canvas.height = 0;
    return "";
  }
}
