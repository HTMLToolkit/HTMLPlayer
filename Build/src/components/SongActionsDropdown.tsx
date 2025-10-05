import { useState, Fragment } from "react";
import { toast } from "sonner";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import modalStyles from "./Dialog.module.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { AddToPopover } from "./AddToPopover";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";

interface SongActionsDropdownProps {
  song: Song;
  library: MusicLibrary;
  onCreatePlaylist: (name: string, songs: Song[]) => Playlist;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onAddToFavorites?: (songId: string) => void;
  isFavorited?: (songId: string) => boolean;
  onRemoveSong: (songId: string) => void;
  onPlaySong: (song: Song, playlist?: Playlist) => void;
  size?: number;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const SongActionsDropdown = ({
  song,
  library,
  onCreatePlaylist,
  onAddToPlaylist,
  onAddToFavorites,
  isFavorited,
  onRemoveSong,
  size = 16,
  className = "",
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: SongActionsDropdownProps) => {
  const { t } = useTranslation();
  const [showAddToPopover, setShowAddToPopover] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  // Use external state if provided, otherwise use internal state
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const formatTime = (seconds: number) => {
    const roundedSeconds = Math.round(seconds);
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBitrate = (bitrate?: number) => {
    if (typeof bitrate !== "number" || !Number.isFinite(bitrate) || bitrate <= 0) return null;
    const kbps = Math.round(bitrate / 1000);
    return t("songInfo.kbps", { value: kbps.toLocaleString() });
  };

  const formatSampleRate = (sampleRate?: number) => {
    if (typeof sampleRate !== "number" || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
    const khzValue = sampleRate / 1000;
    const formatted = khzValue >= 100
      ? khzValue.toFixed(0)
      : khzValue >= 10
        ? khzValue.toFixed(1)
        : khzValue.toFixed(2);
    return t("songInfo.khz", { value: formatted });
  };

  const formatChannels = (channels?: number) => {
    if (typeof channels !== "number" || !Number.isFinite(channels) || channels <= 0) return null;
    if (channels === 1) return t("songInfo.channelMono");
    if (channels === 2) return t("songInfo.channelStereo");
    return t("songInfo.channelCount", { count: channels });
  };

  const formatBitDepth = (bitDepth?: number) => {
    if (typeof bitDepth !== "number" || !Number.isFinite(bitDepth) || bitDepth <= 0) return null;
    return t("songInfo.bitDepthValue", { value: bitDepth });
  };

  const formatCodec = (codec?: string) => {
    return codec?.trim() || null;
  };

  const formatLossless = (lossless?: boolean) => {
    if (typeof lossless !== "boolean") return null;
    return lossless ? t("songInfo.yes") : t("songInfo.no");
  };

  const sampleRateForGapless = song.encoding?.sampleRate;

  const formatGaplessSamples = (samples?: number) => {
    if (typeof samples !== "number" || !Number.isFinite(samples) || samples <= 0) return null;
    const formattedSamples = t("songInfo.samples", { count: Math.round(samples), defaultValue: `${Math.round(samples).toLocaleString()} samples` });
    if (typeof sampleRateForGapless === "number" && Number.isFinite(sampleRateForGapless) && sampleRateForGapless > 0) {
      const milliseconds = (samples / sampleRateForGapless) * 1000;
      const precision = milliseconds >= 100 ? 0 : milliseconds >= 10 ? 1 : 2;
      const formattedMs = (Math.round(milliseconds * Math.pow(10, precision)) / Math.pow(10, precision)).toFixed(precision);
      return `${formattedSamples} (${t("songInfo.ms", { value: formattedMs })})`;
    }
    return formattedSamples;
  };

  const primaryEntries = [
    { label: t("songInfo.title"), value: song.title },
    { label: t("common.artist"), value: song.artist },
    { label: t("common.album"), value: song.album },
    { label: t("common.duration"), value: formatTime(song.duration) },
  ];

  const codecValue = formatCodec(song.encoding?.codec) ?? t("songInfo.notAvailable");
  const bitrateValue = formatBitrate(song.encoding?.bitrate) ?? t("songInfo.notAvailable");
  const sampleRateValue = formatSampleRate(song.encoding?.sampleRate) ?? t("songInfo.notAvailable");
  const channelValue = formatChannels(song.encoding?.channels) ?? t("songInfo.notAvailable");
  const bitDepthValue = formatBitDepth(song.encoding?.bitsPerSample) ?? t("songInfo.notAvailable");

  const encodingEntries = [
    { label: t("songInfo.codec"), value: codecValue },
    { label: t("songInfo.bitrate"), value: bitrateValue },
    { label: t("songInfo.sampleRate"), value: sampleRateValue },
    { label: t("songInfo.channels"), value: channelValue },
    { label: t("songInfo.bitDepth"), value: bitDepthValue },
  ];

  if (song.encoding?.container?.trim()) {
    encodingEntries.push({ label: t("songInfo.container"), value: song.encoding.container.trim() });
  }
  if (song.encoding?.profile?.trim()) {
    encodingEntries.push({ label: t("songInfo.profile"), value: song.encoding.profile.trim() });
  }
  const losslessValue = formatLossless(song.encoding?.lossless);
  if (losslessValue) {
    encodingEntries.push({ label: t("songInfo.lossless"), value: losslessValue });
  }

  const gaplessEntries = [
    { label: t("songInfo.encoderDelay"), value: formatGaplessSamples(song.gapless?.encoderDelay) },
    { label: t("songInfo.encoderPadding"), value: formatGaplessSamples(song.gapless?.encoderPadding) },
  ].filter((entry) => Boolean(entry.value)) as Array<{ label: string; value: string }>;

  const renderDetails = (entries: Array<{ label: string; value: string }>) => (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: "var(--spacing-6)",
        rowGap: "var(--spacing-2)",
      }}
    >
      {entries.map(({ label, value }) => (
        <Fragment key={`${label}-${value}`}>
          <dt style={{ fontWeight: 600 }}>{label}</dt>
          <dd style={{ margin: 0, textAlign: "right", color: "var(--muted-foreground)" }}>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );

  const handleShowSongInfo = () => setShowInfoDialog(true);

  const handleShare = async () => {
    const shareData = {
      title: `${song.title} - ${song.artist}`,
      text: t("listenToSong", { song: song.title, artist: song.artist }),
      url: window.location.href,
    };

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        toast.success(t("songShared"));
      } else {
        const shareText = `🎵 ${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        toast.success(t("songInfoCopied"));
      }
    } catch (error) {
      console.error("Failed to share:", error);
      try {
        await navigator.clipboard.writeText(`${song.title} by ${song.artist}`);
        toast.success(t("songInfoCopied"));
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);
        toast.error(t("songShareFailed"));
      }
    }
  };

  const handleGoToArtist = () => {
    window.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { view: "artist", value: song.artist },
      })
    );
  };

  const handleGoToAlbum = () => {
    window.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { view: "album", value: song.album },
      })
    );
  };

  const handleDeleteSong = () => setShowDeleteDialog(true);

  const handleConfirmDelete = () => {
    onRemoveSong(song.id);
    toast.success(t("deletedFromLibrary", { song: song.title }));
    setShowDeleteDialog(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          title={t("moreOptions")}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="moreHorizontal" size={size} decorative />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem onClick={() => setShowAddToPopover(true)}>
          <Icon name="plus" size={size} style={{ marginRight: 8 }} decorative />
          {t("playlist.addTo")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShowSongInfo}>
          <Icon name="info" size={size} style={{ marginRight: 8 }} decorative />
          {t("songInfo.songInfoTitle")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShare}>
          <Icon name="share" size={size} style={{ marginRight: 8 }} decorative />
          {t("share")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoToArtist}>
          <Icon name="user" size={size} style={{ marginRight: 8 }} decorative />
          {t("goToArtist")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGoToAlbum}>
          <Icon name="music" size={size} style={{ marginRight: 8 }} decorative />
          {t("goToAlbum")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDeleteSong}
          className={modalStyles.delete}
        >
          <Icon name="trash2" size={size} style={{ marginRight: 8 }} decorative />
          {t("deleteFromLibrary")}
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Add To Popover */}
      <AddToPopover
        songs={[song]}
        library={library}
        onCreatePlaylist={onCreatePlaylist}
        onAddToPlaylist={onAddToPlaylist}
        onAddToFavorites={onAddToFavorites}
        isFavorited={isFavorited}
        open={showAddToPopover}
        onOpenChange={setShowAddToPopover}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSong")}</DialogTitle>
            <DialogDescription>
              {t("deleteSongConfirmation", { song: song.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Song Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("songInformation")}</DialogTitle>
            <DialogDescription>{t("songInformationDescription")}</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
            {song.albumArt && (
              <img
                src={song.albumArt}
                alt={song.album}
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  borderRadius: "var(--radius-2)",
                }}
              />
            )}
            <div className={modalStyles.spaceY4} style={{ flex: 1 }}>
              <div>
                {renderDetails(primaryEntries)}
              </div>
              <div>
                <h4 style={{ margin: 0, marginBottom: "var(--spacing-2)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                  {t("songInfo.encodingDetails")}
                </h4>
                {renderDetails(encodingEntries)}
              </div>
              {gaplessEntries.length > 0 && (
                <div>
                  <h4 style={{ margin: 0, marginBottom: "var(--spacing-2)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                    {t("songInfo.gapless")}
                  </h4>
                  {renderDetails(gaplessEntries)}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoDialog(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};
