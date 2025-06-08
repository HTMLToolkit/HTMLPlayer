import { debounce } from 'lodash-es';
import { StoreApi, UseBoundStore } from 'zustand';
import { AppState } from './main';
import { 
  savePlaybackPosition, 
  loadPlaybackPosition, 
  loadTracks,
  getAudioBlobUrl,
  revokeAudioBlobUrl
} from './storage';
import type { Track } from './main';

// Enhanced type definitions
interface HowlInstance {
  src: (sources: string[]) => HowlInstance;
  html5: (html5: boolean) => HowlInstance;
  format: (formats: string[]) => HowlInstance;
  preload: (preload: boolean) => HowlInstance;
  onload: (callback: () => void) => HowlInstance;
  onloaderror: (callback: (id: number, error: any) => void) => HowlInstance;
  onplay: (callback: () => void) => HowlInstance;
  onpause: (callback: () => void) => HowlInstance;
  onend: (callback: () => void) => HowlInstance;
  onstop: (callback: () => void) => HowlInstance;
  play: (id?: number) => number;
  pause: (id?: number) => HowlInstance;
  stop: (id?: number) => HowlInstance;
  seek: (seek?: number, id?: number) => number | HowlInstance;
  duration: (id?: number) => number;
  playing: (id?: number) => boolean;
  unload: () => void;
  _sounds?: Array<{ _node?: HTMLAudioElement }>;
}

declare global {
  interface Window {
    Howl: new (options: any) => HowlInstance;
    Howler?: any | {
      ctx?: AudioContext;
    };
  }
}

interface PlayerUIElements {
  progress: HTMLInputElement | null;
  currentTime: HTMLElement | null;
  duration: HTMLElement | null;
  playIcon: HTMLElement | null;
  pauseIcon: HTMLElement | null;
}

interface PlayerStateChanges {
  isShuffleMode?: boolean;
  isRepeatMode?: boolean;
  volume?: number;
}

// Enhanced state management with better encapsulation
class PlayerState {
  private _isShuffleMode = false;
  private _isRepeatMode = false;
  private _volume = 1.0;
  private readonly stateChangeCallbacks = new Set<(state: PlayerStateChanges) => void>();

  get isShuffleMode(): boolean { return this._isShuffleMode; }
  get isRepeatMode(): boolean { return this._isRepeatMode; }
  get volume(): number { return this._volume; }

  // Observer pattern for state changes
  subscribe(callback: (state: PlayerStateChanges) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  private notifyStateChange(changes: PlayerStateChanges): void {
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(changes);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }

  toggleShuffle(): boolean {
    this._isShuffleMode = !this._isShuffleMode;
    this.updateButtonState('shuffleBtn', this._isShuffleMode);
    this.notifyStateChange({ isShuffleMode: this._isShuffleMode });
    return this._isShuffleMode;
  }

  toggleRepeat(): boolean {
    this._isRepeatMode = !this._isRepeatMode;
    this.updateButtonState('repeatBtn', this._isRepeatMode);
    this.notifyStateChange({ isRepeatMode: this._isRepeatMode });
    return this._isRepeatMode;
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.notifyStateChange({ volume: this._volume });
  }

  private updateButtonState(buttonId: string, isActive: boolean): void {
    try {
      const btn = document.getElementById(buttonId);
      btn?.classList.toggle('active', isActive);
    } catch (error) {
      console.error(`Error updating button state for ${buttonId}:`, error);
    }
  }
}

// Enhanced UI management with better error handling and performance
class PlayerUI {
  private elements: PlayerUIElements = {
    progress: null,
    currentTime: null,
    duration: null,
    playIcon: null,
    pauseIcon: null
  };

  private readonly animationFrameId: number | null = null;
  private lastProgressUpdate = 0;
  private readonly PROGRESS_UPDATE_THROTTLE = 100; // ms

  constructor() {
    this.refreshElements();
  }

  private refreshElements(): void {
    try {
      this.elements = {
        progress: document.getElementById('progress') as HTMLInputElement,
        currentTime: document.getElementById('currentTime') as HTMLElement,
        duration: document.getElementById('duration') as HTMLElement,
        playIcon: document.getElementById('playIcon') as HTMLElement,
        pauseIcon: document.getElementById('pauseIcon') as HTMLElement,
      };
    } catch (error) {
      console.error('Error refreshing UI elements:', error);
    }
  }

  updateProgress(position: number, duration: number): void {
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THROTTLE) {
      return; // Throttle updates
    }
    this.lastProgressUpdate = now;

    requestAnimationFrame(() => {
      try {
        if (!this.elements.progress || !this.isValidNumber(position) || !this.isValidNumber(duration) || duration <= 0) {
          return;
        }

        const progressPercentage = Math.min(100, Math.max(0, (position / duration) * 100));
        this.elements.progress.value = progressPercentage.toString();

        if (this.elements.currentTime) {
          this.elements.currentTime.textContent = this.formatTime(position);
        }
        if (this.elements.duration) {
          this.elements.duration.textContent = this.formatTime(duration);
        }
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    });
  }

  updatePlayState(isPlaying: boolean): void {
    try {
      if (!this.elements.playIcon || !this.elements.pauseIcon) {
        this.refreshElements();
      }

      if (this.elements.playIcon && this.elements.pauseIcon) {
        this.elements.playIcon.style.display = isPlaying ? 'none' : '';
        this.elements.pauseIcon.style.display = isPlaying ? '' : 'none';
      }
    } catch (error) {
      console.error('Error updating play state:', error);
    }
  }

  getProgressValue(): number {
    try {
      if (!this.elements.progress) {
        this.refreshElements();
      }
      return this.elements.progress ? parseFloat(this.elements.progress.value) || 0 : 0;
    } catch (error) {
      console.error('Error getting progress value:', error);
      return 0;
    }
  }

  private isValidNumber(value: number): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  private formatTime(seconds: number): string {
    if (!this.isValidNumber(seconds) || seconds < 0) return '0:00';
    
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// Enhanced track navigation with better shuffle algorithm
class TrackNavigator {
  private shuffleHistory: string[] = [];
  private readonly MAX_SHUFFLE_HISTORY = 50;

  constructor(private playerState: PlayerState) {}

  async getNextTrack(currentTrackUrl: string | null): Promise<string | null> {
    try {
      const tracks = await this.loadTracksWithCache();
      if (tracks.length === 0) return null;
      
      const currentIndex = tracks.findIndex(t => t.url === currentTrackUrl);
      
      if (this.playerState.isShuffleMode) {
        return this.getSmartRandomTrack(tracks, currentTrackUrl);
      }
      
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tracks.length;
      return tracks[nextIndex].url;
    } catch (error) {
      console.error('Error getting next track:', error);
      return null;
    }
  }

  async getPreviousTrack(currentTrackUrl: string | null): Promise<string | null> {
    try {
      const tracks = await this.loadTracksWithCache();
      if (tracks.length === 0) return null;
      
      const currentIndex = tracks.findIndex(t => t.url === currentTrackUrl);
      
      if (this.playerState.isShuffleMode) {
        // In shuffle mode, go back in shuffle history if available
        const lastTrack = this.shuffleHistory.pop();
        return lastTrack || this.getSmartRandomTrack(tracks, currentTrackUrl);
      }
      
      const prevIndex = currentIndex === -1 ? tracks.length - 1 : 
        (currentIndex - 1 + tracks.length) % tracks.length;
      return tracks[prevIndex].url;
    } catch (error) {
      console.error('Error getting previous track:', error);
      return null;
    }
  }

  private tracksCache: { tracks: Track[]; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  private async loadTracksWithCache(): Promise<Track[]> {
    const now = Date.now();
    if (this.tracksCache && (now - this.tracksCache.timestamp) < this.CACHE_DURATION) {
      return this.tracksCache.tracks;
    }

    const tracks = await loadTracks();
    this.tracksCache = { tracks, timestamp: now };
    return tracks;
  }

  private getSmartRandomTrack(tracks: Track[], excludeUrl: string | null): string {
    if (tracks.length <= 1) return tracks[0]?.url || '';
    
    // Filter out recently played tracks and current track
    const recentlyPlayed = new Set([excludeUrl, ...this.shuffleHistory.slice(-5)]);
    const availableTracks = tracks.filter(track => !recentlyPlayed.has(track.url));
    
    // If all tracks have been played recently, use all tracks except current
    const tracksToChooseFrom = availableTracks.length > 0 ? 
      availableTracks : 
      tracks.filter(track => track.url !== excludeUrl);
    
    if (tracksToChooseFrom.length === 0) return tracks[0]?.url || '';
    
    const randomIndex = Math.floor(Math.random() * tracksToChooseFrom.length);
    const selectedTrack = tracksToChooseFrom[randomIndex];
    
    // Add current track to shuffle history
    if (excludeUrl) {
      this.shuffleHistory.push(excludeUrl);
      if (this.shuffleHistory.length > this.MAX_SHUFFLE_HISTORY) {
        this.shuffleHistory.shift();
      }
    }
    
    return selectedTrack.url;
  }
}

// Enhanced main audio player with better error recovery and performance
class AudioPlayer {
  private howl: HowlInstance | null = null;
  private currentTrackUrl: string | null = null;
  private intervalId: number | null = null;
  private readonly ui = new PlayerUI();
  private readonly playerState = new PlayerState();
  private readonly navigator = new TrackNavigator(this.playerState);
  private isTransitioning = false;
  private isLoading = false;
  private unsubscribe: (() => void) | null = null;
  private visualizerInstance: any = null;
  private retryAttempts = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly eventListeners: Array<{ element: Element | Document; event: string; handler: EventListener }> = [];

  constructor(private store: UseBoundStore<StoreApi<AppState>>) {
    this.initializeEventListeners();
    this.subscribeToStore();
    this.setupStateSubscriptions();
  }

  private extractTitle(url: string): string {
    return url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled Track';
  }

  private setupStateSubscriptions(): void {
    this.playerState.subscribe((changes) => {
      if (changes.volume !== undefined && this.howl) {
        // Howl volume control would go here if supported
        console.log('Volume changed to:', changes.volume);
      }
    });
  }

  public setVisualizerInstance(visualizer: any): void {
    this.visualizerInstance = visualizer;
    console.log('Visualizer instance set in audio player');
    
    if (this.howl) {
      this.connectVisualizerToHowl();
    }
  }

  private connectVisualizerToHowl(): void {
    if (this.visualizerInstance && this.howl) {
      try {
        console.log('Connecting visualizer to Howl instance');
        this.visualizerInstance.setHowlInstance(this.howl);
      } catch (error) {
        console.error('Error connecting visualizer:', error);
      }
    }
  }

  private initializeEventListeners(): void {
    const eventMappings = [
      { id: 'playPauseBtn', handler: () => this.handlePlayPause() },
      { id: 'nextBtn', handler: () => this.handleNext() },
      { id: 'prevBtn', handler: () => this.handlePrevious() },
      { id: 'shuffleBtn', handler: () => this.playerState.toggleShuffle() },
      { id: 'repeatBtn', handler: () => this.playerState.toggleRepeat() },
    ];

    eventMappings.forEach(({ id, handler }) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('click', handler);
        this.eventListeners.push({ element, event: 'click', handler });
      }
    });

    // Progress bar with debounced input
    const progressEl = document.getElementById('progress');
    if (progressEl) {
      const debouncedHandler = debounce(() => this.handleProgressChange(), 100);
      progressEl.addEventListener('input', debouncedHandler);
      this.eventListeners.push({ element: progressEl, event: 'input', handler: debouncedHandler });
    }

    // Keyboard shortcuts
    const keyboardHandler: EventListener = (event) => {
      this.handleKeyboardShortcuts(event as KeyboardEvent);
    };
    document.addEventListener('keydown', keyboardHandler);
    this.eventListeners.push({ element: document, event: 'keydown', handler: keyboardHandler });
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Only handle shortcuts when not typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.handlePlayPause();
        break;
      case 'ArrowRight':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.handleNext();
        }
        break;
      case 'ArrowLeft':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.handlePrevious();
        }
        break;
    }
  }

  private async handlePlayPause(): Promise<void> {
    try {
      const currentTrack = this.store.getState().currentTrack;
      if (!currentTrack) {
        console.warn('No track selected');
        return;
      }

      if (!this.howl) {
        // Fix 1: Handle both string URL and Track object cases
        const trackUrl = typeof currentTrack === 'string' ? currentTrack : currentTrack.url;
        const track: Track = {
          id: trackUrl,
          url: trackUrl,
          name: this.extractTitle(trackUrl),
        };
        this.store.getState().setCurrentTrack(track);
        return;
      }

      if (!this.isTransitioning && !this.isLoading) {
        if (this.howl.playing()) {
          this.howl.pause();
        } else {
          this.howl.play();
        }
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
      await this.handlePlaybackError();
    }
  }

  private async handleNext(): Promise<void> {
    if (this.isTransitioning || this.isLoading) return;
    
    try {
      const nextTrackUrl = await this.navigator.getNextTrack(this.currentTrackUrl);
      if (nextTrackUrl) {
        const track: Track = {
          id: nextTrackUrl,
          url: nextTrackUrl,
          name: nextTrackUrl.split('/').pop() || 'Next Track',
        };
        this.store.getState().setCurrentTrack(track);
      }
    } catch (error) {
      console.error('Error handling next track:', error);
    }
  }

  private async handlePrevious(): Promise<void> {
    if (this.isTransitioning || this.isLoading) return;
    
    try {
      const prevTrackUrl = await this.navigator.getPreviousTrack(this.currentTrackUrl);
      if (prevTrackUrl) {
        const track: Track = {
          id: prevTrackUrl,
          url: prevTrackUrl,
          name: prevTrackUrl.split('/').pop() || 'Previous Track',
        };
        this.store.getState().setCurrentTrack(track);
      }
    } catch (error) {
      console.error('Error handling previous track:', error);
    }
  }

  private handleProgressChange(): void {
    if (!this.howl || this.isTransitioning || this.isLoading) return;

    try {
      const duration = this.howl.duration();
      if (!duration || duration <= 0) return;

      const seekPosition = (this.ui.getProgressValue() / 100) * duration;
      this.howl.seek(seekPosition);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  private readonly updateProgress = debounce(() => {
    if (!this.howl || !this.howl.playing() || this.isTransitioning || this.isLoading) {
      return;
    }

    try {
      const position = this.howl.seek();
      const duration = this.howl.duration();
      
      if (typeof position === 'number' && typeof duration === 'number' && duration > 0) {
        this.ui.updateProgress(position, duration);
        
        // Save position asynchronously without blocking
        savePlaybackPosition(this.currentTrackUrl, position).catch(error => {
          console.error('Error saving playback position:', error);
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }, 100);

  private async cleanupCurrentTrack(): Promise<void> {
    this.isTransitioning = true;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.howl) {
      try {
        this.howl.stop();
        this.howl.unload();
      } catch (error) {
        console.error('Error cleaning up howl:', error);
      }
      this.howl = null;
    }

    if (this.currentTrackUrl) {
      try {
        revokeAudioBlobUrl(this.currentTrackUrl);
      } catch (error) {
        console.error('Error revoking blob URL:', error);
      }
    }
  }

  private async loadNewTrack(trackUrl: string): Promise<void> {
    if (this.isLoading) {
      console.log('Already loading a track, skipping...');
      return;
    }

    this.isLoading = true;
    this.retryAttempts = 0;
    
    try {
      await this.attemptTrackLoad(trackUrl);
    } catch (error) {
      console.error('Failed to load track after all retry attempts:', error);
      await this.handleLoadError();
    }
  }

  private async attemptTrackLoad(trackUrl: string): Promise<void> {
    try {
      const blobUrl = await getAudioBlobUrl(trackUrl);
      const savedPosition = await loadPlaybackPosition(trackUrl);

      if (!window.Howl) {
        throw new Error('Howl.js not loaded');
      }

      return new Promise((resolve, reject) => {
        this.howl = new window.Howl({
          src: [blobUrl],
          html5: true,
          format: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
          preload: true,
          onload: () => {
            console.log('Track loaded successfully');
            this.isTransitioning = false;
            this.isLoading = false;
            this.retryAttempts = 0;
            
            this.connectVisualizerToHowl();
            
            if (savedPosition !== null && this.howl) {
              try {
                this.howl.seek(savedPosition);
              } catch (error) {
                console.error('Error seeking to saved position:', error);
              }
            }
            
            try {
              this.howl?.play();
              this.intervalId = window.setInterval(this.updateProgress, 100);
              resolve();
            } catch (error) {
              console.error('Error starting playback:', error);
              reject(error);
            }
          },
          onloaderror: (id: number, error: any) => {
            console.error('Error loading track:', error);
            reject(new Error(`Failed to load track: ${error}`));
          },
          onplay: () => {
            this.store.getState().setIsPlaying(true);
            this.ui.updatePlayState(true);
          },
          onpause: () => {
            this.store.getState().setIsPlaying(false);
            this.ui.updatePlayState(false);
          },
          onend: () => this.handleTrackEnd(),
          onstop: () => {
            this.store.getState().setIsPlaying(false);
            this.ui.updatePlayState(false);
          }
        });

        this.currentTrackUrl = trackUrl;
      });
    } catch (error) {
      if (this.retryAttempts < this.MAX_RETRY_ATTEMPTS) {
        this.retryAttempts++;
        console.log(`Retrying track load (attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryAttempts));
        return this.attemptTrackLoad(trackUrl);
      }
      throw error;
    }
  }

  private async handleLoadError(): Promise<void> {
    this.currentTrackUrl = null;
    this.howl = null;
    this.isTransitioning = false;
    this.isLoading = false;
    
    // Try to skip to next track on load error
    try {
      const nextTrackUrl = await this.navigator.getNextTrack(this.currentTrackUrl);
      if (nextTrackUrl) {
        const track: Track = {
          id: nextTrackUrl,
          url: nextTrackUrl,
          name: nextTrackUrl.split('/').pop() || 'Next Track',
        };
        this.store.getState().setCurrentTrack(track);
      }
    } catch (error) {
      console.error('Error recovering from load failure:', error);
    }
  }

  private async handlePlaybackError(): Promise<void> {
    console.log('Attempting to recover from playback error');
    try {
      await this.cleanupCurrentTrack();
      if (this.currentTrackUrl) {
        await this.loadNewTrack(this.currentTrackUrl);
      }
    } catch (error) {
      console.error('Error during playback recovery:', error);
    }
  }

  private async handleTrackEnd(): Promise<void> {
    try {
      if (this.playerState.isRepeatMode) {
        this.howl?.play();
      } else {
        const nextTrackUrl = await this.navigator.getNextTrack(this.currentTrackUrl);
        if (nextTrackUrl) {
          const track: Track = {
            id: nextTrackUrl,
            url: nextTrackUrl,
            name: nextTrackUrl.split('/').pop() || 'Next Track',
          };
          this.store.getState().setCurrentTrack(track);
        } else {
          this.store.getState().setCurrentTrack(null);
          this.store.getState().setIsPlaying(false);
        }
      }
    } catch (error) {
      console.error('Error handling track end:', error);
    }
  }

  private subscribeToStore(): void {
    this.unsubscribe = this.store.subscribe(async (state) => {
      const currentTrackUrl = typeof state.currentTrack === 'string' ? state.currentTrack : state.currentTrack?.url || null;
      
      if (currentTrackUrl !== this.currentTrackUrl) {
        console.log('Track changed from', this.currentTrackUrl, 'to', currentTrackUrl);
        
        if (this.isLoading) {
          console.log('Already loading, ignoring track change');
          return;
        }

        await this.cleanupCurrentTrack();
        
        if (currentTrackUrl) {
          await this.loadNewTrack(currentTrackUrl);
        } else {
          this.currentTrackUrl = null;
          this.isTransitioning = false;
          this.isLoading = false;
        }
      }
    });
  }

  // Public API methods
  public getHowlInstance(): HowlInstance | null {
    return this.howl;
  }

  public getAudioElement(): HTMLAudioElement | null {
    if (this.howl && this.howl._sounds && this.howl._sounds[0]) {
      return this.howl._sounds[0]._node || null;
    }
    return null;
  }

  public async setVolume(volume: number): Promise<void> {
    this.playerState.setVolume(volume);
    // Volume control implementation would depend on Howl.js API
  }

  public getCurrentTrack(): string | null {
    return this.currentTrackUrl;
  }

  public isPlaying(): boolean {
    return this.howl?.playing() || false;
  }

  public async destroy(): Promise<void> {
    // Cleanup event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.error('Error removing event listener:', error);
      }
    });
    this.eventListeners.length = 0;

    // Cleanup subscriptions
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Cleanup UI
    this.ui.destroy();

    // Cleanup audio
    await this.cleanupCurrentTrack();
    this.isLoading = false;
  }
}

// Factory function with enhanced initialization
export function initPlayer(store: UseBoundStore<StoreApi<AppState>>): AudioPlayer {
  // Ensure Howl.js is loaded
  if (typeof window !== 'undefined' && !window.Howl) {
    console.warn('Howl.js not detected. Make sure to load Howl.js before initializing the player.');
  }

  return new AudioPlayer(store);
}

// Export types for external usage
export type { Track, HowlInstance };
export { PlayerState, PlayerUI, TrackNavigator, AudioPlayer };