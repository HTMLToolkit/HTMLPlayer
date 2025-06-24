import React, { useState } from "react";
import { Search, Trash2, Plus, ThumbsUp, ThumbsDown, MoreHorizontal, Heart, Filter, Info, Share, User, Music } from "lucide-react";
import { pickAudioFiles, extractAudioMetadata, createAudioUrl, generateUniqueId } from "../helpers/filePickerHelper";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./Dialog";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "./DropdownMenu";
import { Song } from "../helpers/musicPlayerHook";
import styles from "./MainContent.module.css";

type MainContentProps = {
  musicPlayerHook: ReturnType<typeof import("../helpers/musicPlayerHook").useMusicPlayer>;
};

export const MainContent = ({ musicPlayerHook }: MainContentProps) => {
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [ratings, setRatings] = useState<Record<string, 'thumbs-up' | 'thumbs-down' | 'none'>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showSongInfo, setShowSongInfo] = useState(false);
  const [selectedSongInfo, setSelectedSongInfo] = useState<Song | null>(null);

  const {
    playerState,
    library,
    playSong,
    addSong,
    removeSong,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    createPlaylist
  } = musicPlayerHook;

  // Get songs to display (from current playlist, favorites, or all songs)
  let songsToDisplay = playerState.currentPlaylist ? playerState.currentPlaylist.songs : library.songs;
  
  // Filter to show only favorites if enabled
  if (showFavoritesOnly) {
    songsToDisplay = getFavoriteSongs();
  }

  // Filter songs based on search
  const filteredSongs = songsToDisplay.filter((song: Song) =>
    song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
  );

  const handleSongSearch = (query: string) => {
    setSongSearchQuery(query);
  };

  const handleSongClick = (song: Song) => {
    playSong(song, playerState.currentPlaylist || undefined);
  };

  const handleRating = (songId: string, rating: 'thumbs-up' | 'thumbs-down') => {
    const currentRating = ratings[songId];
    const newRating = currentRating === rating ? 'none' : rating;
    setRatings(prev => ({ ...prev, [songId]: newRating }));
  };

  const handleToggleFavorite = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasAdded = toggleFavorite(songId);
    
    // Show toast notification
    const song = library.songs.find(s => s.id === songId);
    if (song) {
      if (wasAdded) {
        toast.success(`Added "${song.title}" to favorites`);
      } else {
        toast.success(`Removed "${song.title}" from favorites`);
      }
    }
  };

  const handleToggleFavoritesFilter = () => {
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  const handleDeleteSong = () => {
    if (filteredSongs.length === 0) {
      toast.error("No songs to delete");
      return;
    }
    
    const songToDelete = filteredSongs[0]; // Delete first song as example
    setSongToDelete(songToDelete);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (songToDelete) {
      removeSong(songToDelete.id);
      toast.success(`Deleted "${songToDelete.title}"`);
      setShowDeleteConfirm(false);
      setSongToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setSongToDelete(null);
  };

  const handleAddMusic = async () => {
    try {
      toast.info("Select audio files to import...");
      const audioFiles = await pickAudioFiles();
      
      if (audioFiles.length === 0) {
        return;
      }

      toast.loading(`Processing ${audioFiles.length} file(s)...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const audioFile of audioFiles) {
        try {
          console.log(`Processing file: ${audioFile.name}`);
          
          const metadata = await extractAudioMetadata(audioFile.file);
          const audioUrl = createAudioUrl(audioFile.file);
          
          const song: Song = {
            id: generateUniqueId(),
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album || "Unknown Album",
            duration: metadata.duration,
            url: audioUrl
          };
          
          addSong(song);
          
          successCount++;
          console.log(`Successfully processed: ${song.title}`);
          
        } catch (error) {
          console.error(`Failed to process ${audioFile.name}:`, error);
          errorCount++;
        }
      }
      
      toast.dismiss();
      
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} song(s)`);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} file(s)`);
      }
      
    } catch (error) {
      console.error('File picker error:', error);
      toast.dismiss();
      toast.error('Failed to open file picker');
    }
  };

  const handleMoreOptionsAction = (song: Song, action: string) => {
    switch (action) {
      case 'favorite':
        const wasAdded = toggleFavorite(song.id);
        toast.success(wasAdded ? `Added "${song.title}" to favorites` : `Removed "${song.title}" from favorites`);
        break;
      case 'info':
        setSelectedSongInfo(song);
        setShowSongInfo(true);
        break;
      case 'share':
        handleShareSong(song);
        break;
      case 'addToPlaylist':
        handleAddToPlaylist(song);
        break;
      case 'goToArtist':
        handleGoToArtist(song);
        break;
      case 'goToAlbum':
        handleGoToAlbum(song);
        break;
    }
  };

  const handleShareSong = async (song: Song) => {
    const shareData = {
      title: `${song.title} - ${song.artist}`,
      text: `Listen to "${song.title}" by ${song.artist}`,
      url: window.location.href
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Song shared successfully');
      } else {
        // Fallback: copy to clipboard
        const shareText = `🎵 ${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        toast.success('Song info copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      try {
        await navigator.clipboard.writeText(`${song.title} by ${song.artist}`);
        toast.success('Song info copied to clipboard');
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
        toast.error('Failed to share or copy song info');
      }
    }
  };

  const handleAddToPlaylist = (song: Song) => {
    if (library.playlists.length === 0) {
      const defaultPlaylist = createPlaylist('My Playlist', [song]);
      toast.success(`Created new playlist "${defaultPlaylist.name}" and added "${song.title}"`);
      return;
    }
    
    const firstPlaylist = library.playlists[0];
    const isAlreadyInPlaylist = firstPlaylist.songs.some(s => s.id === song.id);
    
    if (isAlreadyInPlaylist) {
      toast.info(`"${song.title}" is already in playlist "${firstPlaylist.name}"`);
    } else {
      toast.success(`Added "${song.title}" to playlist "${firstPlaylist.name}"`);
    }
  };

  const handleGoToArtist = (song: Song) => {
    console.log(`Navigating to artist page for: ${song.artist}`);
    toast.info(`Artist page for "${song.artist}" (placeholder)`);
  };

  const handleGoToAlbum = (song: Song) => {
    console.log(`Navigating to album page for: ${song.album}`);
    toast.info(`Album page for "${song.album}" (placeholder)`);
  };

  const formatDuration = (seconds: number) => {
    const roundedSeconds = Math.round(seconds);
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.mainContent}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          HTMLPlayer
        </h1>
        <div className={styles.actions}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={16} />
            <Input 
              placeholder="Search songs..." 
              className={styles.searchInput}
              value={songSearchQuery}
              onChange={(e: any) => handleSongSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon-md" 
            className={`${styles.actionButton} ${showFavoritesOnly ? styles.active : ''}`}
            onClick={handleToggleFavoritesFilter}
            title={showFavoritesOnly ? "Show all songs" : "Show favorites only"}
          >
            <Filter size={16} />
          </Button>
          <Button 
            variant="outline" 
            size="icon-md" 
            className={styles.actionButton}
            onClick={handleDeleteSong}
            title="Delete first song"
          >
            <Trash2 size={16} />
          </Button>
          <Button 
            variant="outline" 
            size="icon-md" 
            className={styles.actionButton}
            onClick={handleAddMusic}
            title="Add music files"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <div className={styles.songList}>
        <div className={styles.songListHeader}>
          <span className={styles.columnHeader}>Song</span>
          <span className={styles.columnHeader}>Artist</span>
          <span className={styles.columnHeader}>Actions</span>
        </div>
        
        {filteredSongs.map((song: Song) => (
          <div 
            key={song.id} 
            className={`${styles.songItem} ${playerState.currentSong?.id === song.id ? styles.currentSong : ''}`}
            onClick={() => handleSongClick(song)}
          >
            <div className={styles.songInfo}>
              <div className={styles.albumArt}></div>
              <div className={styles.songDetails}>
                <div className={styles.songTitle}>{song.title}</div>
                <div className={styles.songArtist}>
                  {song.artist} • {formatDuration(song.duration)}
                </div>
              </div>
            </div>
            <div className={styles.artistName}>{song.artist}</div>
            <div className={styles.songActions} onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className={`${styles.songActionButton} ${isFavorited(song.id) ? styles.favorited : ''}`}
                onClick={(e: any) => handleToggleFavorite(song.id, e)}
                title={isFavorited(song.id) ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart size={14} fill={isFavorited(song.id) ? "currentColor" : "none"} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className={`${styles.songActionButton} ${ratings[song.id] === 'thumbs-up' ? styles.active : ''}`}
                onClick={() => handleRating(song.id, 'thumbs-up')}
                title="Thumbs up"
              >
                <ThumbsUp size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className={`${styles.songActionButton} ${ratings[song.id] === 'thumbs-down' ? styles.active : ''}`}
                onClick={() => handleRating(song.id, 'thumbs-down')}
                title="Thumbs down"
              >
                <ThumbsDown size={14} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className={styles.songActionButton}
                    title="More options"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8}>
                  <DropdownMenuItem onClick={() => handleMoreOptionsAction(song, 'addToPlaylist')}>
                    <Plus size={14} style={{ marginRight: 8 }} />
                    Add to playlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleMoreOptionsAction(song, 'info')}>
                    <Info size={14} style={{ marginRight: 8 }} />
                    Song info
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoreOptionsAction(song, 'share')}>
                    <Share size={14} style={{ marginRight: 8 }} />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleMoreOptionsAction(song, 'goToArtist')}>
                    <User size={14} style={{ marginRight: 8 }} />
                    Go to artist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoreOptionsAction(song, 'goToAlbum')}>
                    <Music size={14} style={{ marginRight: 8 }} />
                    Go to album
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        
        {filteredSongs.length === 0 && (
          <div className={styles.noResults}>
            {songSearchQuery ? "No songs found" : showFavoritesOnly ? "No favorite songs" : "No songs in this playlist"}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Song</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{songToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Song Info Modal */}
      <Dialog open={showSongInfo} onOpenChange={setShowSongInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Song Information</DialogTitle>
          </DialogHeader>
          {selectedSongInfo && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div>
                <strong>Title:</strong> {selectedSongInfo.title}
              </div>
              <div>
                <strong>Artist:</strong> {selectedSongInfo.artist}
              </div>
              <div>
                <strong>Album:</strong> {selectedSongInfo.album}
              </div>
              <div>
                <strong>Duration:</strong> {formatDuration(selectedSongInfo.duration)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSongInfo(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};