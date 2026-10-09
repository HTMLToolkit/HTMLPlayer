import {
  MetadataFilter,
  createYouTubeFilter,
  createSpotifyFilter,
  createAmazonFilter,
  createTidalFilter,
  createRemasteredFilter,
} from "@web-scrobbler/metadata-filter";

const removeExtraSuffixes = (text: string) =>
  text
    .replace(/ - Topic$/i, "")
    .replace(/\s*\[.*?\]$/i, "")
    .trim();

const removeArtistFromTitle = (artistName: string) => (text: string) => {
  if (!artistName) return text;
  const escapedArtist = artistName.replace(/[.*+?^${}()|[\]\\]/g, "");
  const regex = new RegExp(`^${escapedArtist}\\s*[-:|]?\\s*`, "i");
  return text.replace(regex, "").trim();
};

export const createMasterFilter = (artistName: string) =>
  new MetadataFilter({})
    .extend(createYouTubeFilter())
    .extend(createSpotifyFilter())
    .extend(createAmazonFilter())
    .extend(createTidalFilter())
    .extend(createRemasteredFilter())
    .extend(
      new MetadataFilter({
        artist: removeExtraSuffixes,
        track: [removeExtraSuffixes, removeArtistFromTitle(artistName)],
      }),
    );

export const cleanMetadata = (artist: string, title: string) => {
  const masterFilter = createMasterFilter(artist);

  const cleanedArtist = masterFilter.canFilterField("artist")
    ? masterFilter.filterField("artist", artist)
    : artist;

  const cleanedTitle = masterFilter.canFilterField("track")
    ? masterFilter.filterField("track", title)
    : title;

  return { artist: cleanedArtist, title: cleanedTitle };
};
