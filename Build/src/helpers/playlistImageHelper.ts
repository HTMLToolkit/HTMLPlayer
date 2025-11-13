export const generatePlaylistImage = async (songs: Song[]): Promise<string> => {
  // Create a canvas element
  const canvas = document.createElement("canvas");
  canvas.width = 80; // Same size as album art
  canvas.height = 80;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  // Get up to 4 unique album arts
  const uniqueAlbumArts = Array.from(
    new Set(songs.filter((song) => song.albumArt).map((song) => song.albumArt)),
  ).slice(0, 4);

  // If no album arts, return empty string
  if (uniqueAlbumArts.length === 0) return "";

  // Load all images first
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    const images = await Promise.all(
      uniqueAlbumArts.map((art) => loadImage(art!)),
    );

    // Clear the canvas
    ctx.fillStyle = "#1E3A8A"; // Default background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw images based on count
    switch (images.length) {
      case 1:
        // Single image takes up the whole space
        ctx.drawImage(images[0], 0, 0, 80, 80);
        break;

      case 2:
        // Two images side by side
        ctx.drawImage(images[0], 0, 0, 40, 80);
        ctx.drawImage(images[1], 40, 0, 40, 80);
        break;

      case 3:
        // One on top, two on bottom
        ctx.drawImage(images[0], 0, 0, 80, 40);
        ctx.drawImage(images[1], 0, 40, 40, 40);
        ctx.drawImage(images[2], 40, 40, 40, 40);
        break;

      case 4:
        // 2x2 grid
        ctx.drawImage(images[0], 0, 0, 40, 40);
        ctx.drawImage(images[1], 40, 0, 40, 40);
        ctx.drawImage(images[2], 0, 40, 40, 40);
        ctx.drawImage(images[3], 40, 40, 40, 40);
        break;
    }

    // Add a slight overlay to make it cohesive
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, 80, 80);

    return canvas.toDataURL("image/jpeg", 0.8);
  } catch (error) {
    console.error("Failed to generate playlist image:", error);
    return "";
  }
};
