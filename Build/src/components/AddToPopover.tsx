import { useState } from "react";
import { Music, Heart, Search, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "./Dialog";
import modalStyles from "./Dialog.module.css";
import { useTranslation } from "react-i18next";

interface AddToPopoverProps {
  songs: Song[]; // Support single or multiple songs
  library: MusicLibrary;
  onCreatePlaylist: (name: string, songs: Song[]) => Playlist;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onAddToFavorites?: (songId: string) => void;
  isFavorited?: (songId: string) => boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddToPopover = ({
  songs,
  library,
  onCreatePlaylist,
  onAddToPlaylist,
  onAddToFavorites,
  isFavorited,
  open,
  onOpenChange,
}: AddToPopoverProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const getAllPlaylists = (items: (Playlist | PlaylistFolder)[]): Playlist[] => {
    const result: Playlist[] = [];
    for (const item of items) {
      if ('children' in item) {
        result.push(...getAllPlaylists(item.children));
      } else if ('songs' in item) {
        result.push(item);
      }
    }
    return result;
  };

  const allPlaylists = getAllPlaylists(library.playlists).filter(
    (p) => p.id !== "all-songs"
  );

  const filteredPlaylists = searchQuery
    ? allPlaylists.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPlaylists;

  const handleAddToPlaylist = (playlist: Playlist) => {
    let addedCount = 0;
    let skippedCount = 0;

    songs.forEach((song) => {
      const isAlreadyInPlaylist = playlist.songs.some((s) => s.id === song.id);
      if (isAlreadyInPlaylist) {
        skippedCount++;
      } else {
        onAddToPlaylist(playlist.id, song.id);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast.success(
        songs.length === 1
          ? t("addedToPlaylist", { song: songs[0].title, playlist: playlist.name })
          : t("playlist.addedToExisting", { count: addedCount })
      );
    }
    if (skippedCount > 0) {
      toast.info(
        songs.length === 1
          ? t("songAlreadyInPlaylist", { song: songs[0].title, playlist: playlist.name })
          : t("playlist.someAlreadyInPlaylist", { count: skippedCount })
      );
    }

    onOpenChange(false);
    setSearchQuery("");
  };

  const handleCreateNewPlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error(t("playlist.enterPlaylistName"));
      return;
    }

    const newPlaylist = onCreatePlaylist(newPlaylistName, songs);
    toast.success(
      songs.length === 1
        ? t("createdNewPlaylistAddedSong", { playlist: newPlaylist.name, song: songs[0].title })
        : t("playlist.created", { name: newPlaylist.name, count: songs.length })
    );

    setNewPlaylistName("");
    setIsCreatingNew(false);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleAddToFavorites = () => {
    if (!onAddToFavorites) {
      return;
    }

    let addedCount = 0;
    let alreadyFavCount = 0;

    songs.forEach((song) => {
      if (isFavorited && isFavorited(song.id)) {
        alreadyFavCount++;
      } else {
        onAddToFavorites(song.id);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast.success(
        songs.length === 1
          ? t("favorites.added", { title: songs[0].title })
          : t("favorites.addedMultiple", { count: addedCount })
      );
    }
    if (alreadyFavCount > 0 && songs.length > 1) {
      toast.info(t("favorites.someAlreadyAdded", { count: alreadyFavCount }));
    }

    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery("");
    setIsCreatingNew(false);
    setNewPlaylistName("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.addTo")}</DialogTitle>
          <DialogDescription>
            {songs.length === 1
              ? t("choosePlaylistOrCreate", { song: songs[0].title })
              : t("choosePlaylistOrCreateMultiple", { count: songs.length })}
          </DialogDescription>
        </DialogHeader>

        {isCreatingNew ? (
          <div className={modalStyles.spaceY4}>
            <Input
              placeholder={t("playlist.enterPlaylistName")}
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateNewPlaylist();
                }
              }}
              autoFocus
            />
            <div className={`${modalStyles.flex} ${modalStyles.gap2}`}>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewPlaylistName("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreateNewPlaylist}>
                {t("playlist.createPlaylist")}
              </Button>
            </div>
          </div>
        ) : (
          <div className={modalStyles.spaceY4}>
            {/* Quick Actions */}
            {onAddToFavorites && (
              <div className={modalStyles.spaceY2}>
                <Button
                  variant="outline"
                  className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                  onClick={handleAddToFavorites}
                >
                  <Heart size={16} className="mr-2" />
                  {t("favorites.addToFavorites")}
                </Button>
                <Button
                  variant="outline"
                  className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                  onClick={() => setIsCreatingNew(true)}
                >
                  <PlusCircle size={16} className="mr-2" />
                  {t("playlist.createNewPlaylist")}
                </Button>
              </div>
            )}

            {!onAddToFavorites && (
              <Button
                variant="outline"
                className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                onClick={() => setIsCreatingNew(true)}
              >
                <PlusCircle size={16} className="mr-2" />
                {t("playlist.createNewPlaylist")}
              </Button>
            )}

            {/* Separator */}
            {allPlaylists.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", margin: "var(--spacing-2) 0" }} />
            )}

            {/* Search and Playlist List */}
            {allPlaylists.length > 0 && (
              <>
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: "var(--spacing-3)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--muted-foreground)",
                      pointerEvents: "none",
                    }}
                  />
                  <Input
                    placeholder={t("playlist.searchPlaylists")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: "calc(var(--spacing-3) + 16px + var(--spacing-2))" }}
                  />
                </div>

                <div
                  className={modalStyles.spaceY2}
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                    paddingRight: "var(--spacing-2)",
                  }}
                >
                  {filteredPlaylists.length > 0 ? (
                    filteredPlaylists.map((playlist) => (
                      <Button
                        key={playlist.id}
                        variant="outline"
                        className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                        onClick={() => handleAddToPlaylist(playlist)}
                      >
                        <Music size={16} className="mr-2" />
                        {playlist.name}
                      </Button>
                    ))
                  ) : (
                    <p className={modalStyles.muted}>
                      {t("search.noPlaylistsFound")}
                    </p>
                  )}
                </div>
              </>
            )}

            {allPlaylists.length === 0 && (
              <p className={modalStyles.muted}>
                {t("playlist.noPlaylists")}
              </p>
            )}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
