import React, { useState } from "react";
import { Search, Menu, Settings, Info, Music, Heart, List, Plus, ChevronRight } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { Separator } from "./Separator";
import { Settings as SettingsComponent } from "./Settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./Dialog";
import { Song, Playlist } from "../helpers/musicPlayerHook";
import { toast } from "sonner";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  musicPlayerHook: ReturnType<typeof import("../helpers/musicPlayerHook").useMusicPlayer>;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

export const Sidebar = ({ musicPlayerHook, onCollapseChange }: SidebarProps) => {
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    library,
    playerState,
    playSong,
    addSong,
    createPlaylist,
    searchQuery,
    setSearchQuery,
    settings,
    updateSettings,
    getFavoriteSongs
  } = musicPlayerHook;

  // Filter playlists based on search
  const filteredPlaylists = library.playlists.filter((playlist: Playlist) =>
    playlist.name.toLowerCase().includes(playlistSearchQuery.toLowerCase())
  );

  const handlePlaylistSearch = (query: string) => {
    setPlaylistSearchQuery(query);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    if (playlist.songs.length > 0) {
      playSong(playlist.songs[0], playlist);
    }
  };

  const handleAbout = () => {
    setShowAbout(true);
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleMenuClick = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  };

  const handleSliverClick = () => {
    setIsCollapsed(false);
    onCollapseChange?.(false);
  };

  const handleAllSongsClick = () => {
    // Clear current playlist and show all songs
    const allSongs = library.songs;
    if (allSongs.length > 0) {
      const allSongsPlaylist: Playlist = {
        id: 'all-songs',
        name: 'All Songs',
        songs: allSongs
      };
      playSong(allSongs[0], allSongsPlaylist);
    }
  };

  const handleAddPlaylist = () => {
    setShowCreatePlaylist(true);
    setNewPlaylistName("");
  };

  const handleCreatePlaylistConfirm = () => {
    if (newPlaylistName && newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setShowCreatePlaylist(false);
      setNewPlaylistName("");
    }
  };

  const handleCreatePlaylistCancel = () => {
    setShowCreatePlaylist(false);
    setNewPlaylistName("");
  };

  const getPlaylistIcon = (playlistName: string) => {
    if (playlistName.toLowerCase().includes("favorite")) return <Heart size={16} />;
    if (playlistName.toLowerCase().includes("made")) return <List size={16} />;
    return <Music size={16} />;
  };

  if (isCollapsed) {
    return (
      <div className={styles.sidebarCollapsed} onClick={handleSliverClick}>
        <div className={styles.expandButton}>
          <ChevronRight size={16} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <Button 
          variant="ghost" 
          size="icon-sm" 
          className={styles.menuButton}
          onClick={handleMenuClick}
        >
          <Menu size={16} />
        </Button>
        <h2 className={styles.title}>Playlists</h2>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={16} />
          <Input 
            placeholder="Search playlists..." 
            className={styles.searchInput}
            value={playlistSearchQuery}
            onChange={(e) => handlePlaylistSearch(e.target.value)}
          />
        </div>
        <Button 
          className={styles.addPlaylistButton}
          onClick={handleAddPlaylist}
        >
          <Plus size={16} />
          Add Playlist
        </Button>
      </div>

      <div className={styles.playlistList}>
        {/* All Songs section */}
        <button 
          className={`${styles.playlistItem} ${styles.allSongsItem}`}
          onClick={handleAllSongsClick}
        >
          <Music size={16} />
          <span>All Songs</span>
          <span className={styles.songCount}>({library.songs.length})</span>
        </button>

        {/* Favorites section */}
        <button 
          className={`${styles.playlistItem} ${styles.favoritesItem}`}
          onClick={() => {
            const favoriteSongs = getFavoriteSongs();
            if (favoriteSongs.length > 0) {
              playSong(favoriteSongs[0], { id: 'favorites', name: 'Favorites', songs: favoriteSongs });
            }
          }}
        >
          <Heart size={16} />
          <span>Favorites</span>
          <span className={styles.songCount}>({library.favorites.length})</span>
        </button>
        
        {filteredPlaylists.map((playlist: Playlist) => (
          <button 
            key={playlist.id} 
            className={`${styles.playlistItem} ${playerState.currentPlaylist?.id === playlist.id ? styles.active : ''}`}
            onClick={() => handlePlaylistSelect(playlist)}
          >
            {getPlaylistIcon(playlist.name)}
            <span>{playlist.name}</span>
            <span className={styles.songCount}>({playlist.songs.length})</span>
          </button>
        ))}
        {filteredPlaylists.length === 0 && playlistSearchQuery && (
          <div className={styles.noResults}>No playlists found</div>
        )}
      </div>

      <div className={styles.footer}>
        <Separator />
        <Button 
          variant="ghost" 
          className={styles.footerButton}
          onClick={handleAbout}
        >
          <Info size={16} />
          About
        </Button>
        <SettingsComponent 
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </div>

      {/* About Modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>About HTMLPlayer</DialogTitle>
            <DialogDescription>
              HTMLPlayer v1.0 - A modern music streaming interface built with React
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAbout(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Playlist Modal */}
      <Dialog open={showCreatePlaylist} onOpenChange={setShowCreatePlaylist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
            <DialogDescription>
              Enter a name for your new playlist
            </DialogDescription>
          </DialogHeader>
          <div style={{ margin: "var(--spacing-4) 0" }}>
            <Input
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreatePlaylistConfirm();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreatePlaylistCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePlaylistConfirm}
              disabled={!newPlaylistName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};