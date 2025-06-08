import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';
import { fileOpen } from 'browser-fs-access';
import { StoreApi, UseBoundStore } from 'zustand';
import { AppState } from './main';
import { savePlaylist, loadPlaylists } from './storage';

interface Playlist {
  id: string;
  name: string;
  art?: string;
}

interface PlaylistElements {
  playlistsEl: HTMLElement;
  modal: HTMLElement;
  input: HTMLInputElement;
  saveBtn: HTMLElement;
  cancelBtn: HTMLElement;
  addPlaylistBtn: HTMLElement | null;
  setPlaylistArtBtn: HTMLElement | null;
}

class PlaylistManager {
  private store: UseBoundStore<StoreApi<AppState>>;
  private elements: PlaylistElements;
  private selectedPlaylistId: string | null = null;
  private objectUrls: Set<string> = new Set();

  constructor(store: UseBoundStore<StoreApi<AppState>>) {
    this.store = store;
    this.elements = this.getElements();
    this.setupEventListeners();
    this.renderPlaylists();
  }

  private getElements(): PlaylistElements {
    const getElement = (id: string) => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Required element with id '${id}' not found`);
      }
      return element;
    };

    return {
      playlistsEl: getElement('playlistNames'),
      modal: getElement('playlistNameModal'),
      input: getElement('playlistNameInput') as HTMLInputElement,
      saveBtn: getElement('savePlaylistNameBtn'),
      cancelBtn: getElement('cancelPlaylistNameBtn'),
      addPlaylistBtn: document.getElementById('addPlaylist'),
      setPlaylistArtBtn: document.getElementById('setPlaylistArt'),
    };
  }

  private setupEventListeners(): void {
    // Modal controls
    this.elements.addPlaylistBtn?.addEventListener('click', () => this.showModal());
    this.elements.saveBtn.addEventListener('click', () => this.handleSavePlaylist());
    this.elements.cancelBtn.addEventListener('click', () => this.hideModal());
    
    // Keyboard navigation for modal
    this.elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSavePlaylist();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hideModal();
      }
    });

    // Modal backdrop click to close
    this.elements.modal.addEventListener('click', (e) => {
      if (e.target === this.elements.modal) {
        this.hideModal();
      }
    });

    // Playlist art upload
    this.elements.setPlaylistArtBtn?.addEventListener('click', () => this.handleSetPlaylistArt());

    // Playlist selection
    this.elements.playlistsEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const playlistItem = target.closest('[data-playlist-id]') as HTMLElement;
      if (playlistItem) {
        this.selectPlaylist(playlistItem.dataset.playlistId!);
      }
    });
  }

  private async renderPlaylists(): Promise<void> {
    try {
      const playlists = await loadPlaylists();
      
      // Clean up old object URLs
      this.objectUrls.forEach(url => URL.revokeObjectURL(url));
      this.objectUrls.clear();

      if (playlists.length === 0) {
        this.elements.playlistsEl.innerHTML = '<li class="empty-state">No playlists yet. Create your first playlist!</li>';
        return;
      }

      this.elements.playlistsEl.innerHTML = playlists
        .map((playlist) => this.createPlaylistHTML(playlist))
        .join('');

    } catch (error) {
      console.error('Error rendering playlists:', error);
      this.elements.playlistsEl.innerHTML = '<li class="error-state">Error loading playlists</li>';
    }
  }

  private createPlaylistHTML(playlist: Playlist): string {
    const sanitizedName = DOMPurify.sanitize(playlist.name);
    const isSelected = this.selectedPlaylistId === playlist.id;
    const selectedClass = isSelected ? 'selected' : '';
    
    const artHTML = playlist.art 
      ? `<img src="${playlist.art}" alt="Cover art for ${sanitizedName}" loading="lazy" class="playlist-art">` 
      : '<div class="playlist-art-placeholder" aria-hidden="true">♪</div>';

    return `
      <li class="playlist-item ${selectedClass}" 
          data-playlist-id="${playlist.id}"
          role="button"
          tabindex="0"
          aria-label="Select playlist ${sanitizedName}">
        <span class="playlist-name">${sanitizedName}</span>
        ${artHTML}
      </li>
    `;
  }

  private showModal(): void {
    this.elements.modal.classList.remove('hidden');
    this.elements.modal.setAttribute('aria-hidden', 'false');
    this.elements.input.value = '';
    
    // Focus with slight delay to ensure modal is visible
    setTimeout(() => {
      this.elements.input.focus();
    }, 100);
  }

  private hideModal(): void {
    this.elements.modal.classList.add('hidden');
    this.elements.modal.setAttribute('aria-hidden', 'true');
  }

  private async handleSavePlaylist(): Promise<void> {
    const name = this.elements.input.value.trim();
    
    if (!name) {
      this.showInputError('Playlist name cannot be empty');
      return;
    }

    if (name.length > 100) {
      this.showInputError('Playlist name is too long (max 100 characters)');
      return;
    }

    try {
      // Check for duplicate names
      const existingPlaylists = await loadPlaylists();
      if (existingPlaylists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        this.showInputError('A playlist with this name already exists');
        return;
      }

      const sanitizedName = DOMPurify.sanitize(name);
      const newPlaylist: Playlist = {
        id: uuidv4(),
        name: sanitizedName
      };

      await savePlaylist(newPlaylist);
      await this.renderPlaylists();
      this.hideModal();
      
      // Select the newly created playlist
      this.selectPlaylist(newPlaylist.id);
      
      console.log('Playlist created successfully:', sanitizedName);
    } catch (error) {
      console.error('Error saving playlist:', error);
      this.showInputError('Failed to save playlist. Please try again.');
    }
  }

  private showInputError(message: string): void {
    // Remove existing error
    const existingError = this.elements.modal.querySelector('.error-message');
    existingError?.remove();

    // Add new error message
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    errorEl.setAttribute('role', 'alert');
    
    this.elements.input.parentNode?.insertBefore(errorEl, this.elements.input.nextSibling);
    this.elements.input.focus();
    
    // Auto-remove error after 5 seconds
    setTimeout(() => errorEl.remove(), 5000);
  }

  private async handleSetPlaylistArt(): Promise<void> {
    if (!this.selectedPlaylistId) {
      alert('Please select a playlist first');
      return;
    }

    try {
      const file = await fileOpen({ 
        mimeTypes: ['image/*'],
        description: 'Select playlist cover art'
      });

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file is too large (max 5MB)');
        return;
      }

      const url = URL.createObjectURL(file);
      this.objectUrls.add(url);

      // TODO: Update playlist art for selected playlist
      // This would typically involve:
      // 1. Loading the selected playlist
      // 2. Updating its art property
      // 3. Saving it back to storage
      // 4. Re-rendering the playlists

      console.log('Playlist art set for:', this.selectedPlaylistId);
      await this.renderPlaylists();
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error setting playlist art:', error);
        alert('Failed to set playlist art. Please try again.');
      }
    }
  }

  private selectPlaylist(playlistId: string): void {
    this.selectedPlaylistId = playlistId;
    
    // Update visual selection
    this.elements.playlistsEl.querySelectorAll('.playlist-item').forEach(item => {
      item.classList.remove('selected');
      if (item.getAttribute('data-playlist-id') === playlistId) {
        item.classList.add('selected');
      }
    });

    // Update store or perform other selection logic
    console.log('Selected playlist:', playlistId);
  }

  // Cleanup method to be called when component unmounts
  public cleanup(): void {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
  }
}

// Main initialization function
export function initPlaylists(store: UseBoundStore<StoreApi<AppState>>): PlaylistManager {
  try {
    return new PlaylistManager(store);
  } catch (error) {
    console.error('Failed to initialize playlist manager:', error);
    throw error;
  }
}