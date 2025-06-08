import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { initPlayer } from './player';
import { initSettings } from './settings';
import { initPlaylists } from './playlists';
import { initTracks } from './tracks';
import { initUI } from './ui';
import { VisualizerManager } from './visualizerManager';
import VisualizerControls from './visualizerControls';

// Enhanced type definitions
export interface Track {
  id: string;
  name: string;
  url: string;
  duration?: number;
  artist?: string;
  album?: string;
  rating?: number;
  art?: string; // Base64 encoded image
  deleted?: boolean; // Soft delete flag
}

export interface AppState {
  // Core state
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  
  // UI state
  theme: 'default' | 'dark' | 'light';
  isLoading: boolean;
  error: string | null;
  
  // Visualizer state
  visualizer: VisualizerManager | null;
  visualizerType: string;
  isVisualizerEnabled: boolean;
  
  // Actions
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setTheme: (theme: 'default' | 'dark' | 'light') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVisualizer: (visualizer: VisualizerManager | null) => void;
  setVisualizerType: (type: string) => void;
  setVisualizerEnabled: (enabled: boolean) => void;
}

// Enhanced store with persistence and dev tools
const useStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentTrack: null,
        isPlaying: false,
        volume: 0.8,
        currentTime: 0,
        duration: 0,
        theme: 'default',
        isLoading: false,
        error: null,
        visualizer: null,
        visualizerType: 'oscilloscope',
        isVisualizerEnabled: true,
        
        // Actions
        setCurrentTrack: (track) => set({ currentTrack: track, error: null }),
        setIsPlaying: (playing) => set({ isPlaying: playing }),
        setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
        setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
        setDuration: (duration) => set({ duration: Math.max(0, duration) }),
        setTheme: (theme) => set({ theme }),
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        setVisualizer: (visualizer) => set({ visualizer }),
        setVisualizerType: (type) => set({ visualizerType: type }),
        setVisualizerEnabled: (enabled) => set({ isVisualizerEnabled: enabled }),
      }),
      {
        name: 'music-player-storage',
        partialize: (state) => ({
          theme: state.theme,
          volume: state.volume,
          visualizerType: state.visualizerType,
          isVisualizerEnabled: state.isVisualizerEnabled,
        }),
      }
    ),
    { name: 'MusicPlayerStore' }
  )
);

// Enhanced visualizer adapter with better error handling and lifecycle management
class HowlVisualizerAdapter {
  private visualizerManager: VisualizerManager | null = null;
  private howlInstance: any = null;
  private canvasContainer: HTMLElement;
  private isDestroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  
  // Callbacks
  public onVisualizerManagerReady?: (manager: VisualizerManager) => void;
  public onError?: (error: Error) => void;

  constructor(canvasContainer: HTMLElement) {
    this.canvasContainer = canvasContainer;
    this.setupCanvasContainer();
    this.setupResizeObserver();
  }

  private setupCanvasContainer(): void {
    try {
      if (!this.canvasContainer.style.position) {
        this.canvasContainer.style.position = 'relative';
      }
      if (!this.canvasContainer.style.height) {
        this.canvasContainer.style.height = '200px';
      }
      // Add some visual feedback
      this.canvasContainer.style.backgroundColor = this.canvasContainer.style.backgroundColor || '#1a1a1a';
      this.canvasContainer.style.borderRadius = '8px';
    } catch (error) {
      console.error('Error setting up canvas container:', error);
      this.onError?.(new Error('Failed to setup canvas container'));
    }
  }

  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(
        this.debounce(() => {
          this.handleResize();
        }, 100)
      );
      this.resizeObserver.observe(this.canvasContainer);
    }
  }

  private debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  private handleResize(): void {
    if (this.isDestroyed || !this.visualizerManager) return;
    
    try {
      const canvas = this.canvasContainer.querySelector('canvas');
      if (canvas) {
        const { clientWidth, clientHeight } = this.canvasContainer;
        canvas.width = clientWidth;
        canvas.height = clientHeight;
      }
    } catch (error) {
      console.error('Error handling resize:', error);
    }
  }

  public async setHowlInstance(howl: any): Promise<void> {
    if (this.isDestroyed) return;
    
    this.howlInstance = howl;

    if (!this.howlInstance) {
      console.warn('Invalid Howl instance provided');
      return;
    }

    try {
      // Set up event listeners
      this.howlInstance.once('play', () => {
        if (!this.isDestroyed) {
          this.setupVisualizerConnection();
        }
      });

      this.howlInstance.on('playerror', (id: number, error: any) => {
        console.error('Howl player error:', error);
        this.onError?.(new Error(`Audio playback error: ${error}`));
      });

      // If already playing, setup immediately
      if (this.howlInstance.playing()) {
        await this.setupVisualizerConnection();
      }
    } catch (error) {
      console.error('Error setting up Howl instance:', error);
      this.onError?.(error as Error);
    }
  }

  public async setupVisualizerConnection(): Promise<void> {
    if (this.isDestroyed || !this.howlInstance) return;

    try {
      const audioElement = await this.getAudioElementFromHowl();

      if (audioElement && !this.visualizerManager) {
        this.visualizerManager = new VisualizerManager(audioElement, this.canvasContainer);
        await this.visualizerManager.initialize();

        // Get current visualizer type from store
        const { visualizerType, isVisualizerEnabled } = useStore.getState();
        
        if (isVisualizerEnabled) {
          this.visualizerManager.addVisualizer(visualizerType);
        }

        // Update store with visualizer instance
        useStore.getState().setVisualizer(this.visualizerManager);

        // Notify that visualizerManager is ready
        this.onVisualizerManagerReady?.(this.visualizerManager);
        
        console.log('Visualizer connection established successfully');
      }
    } catch (error) {
      console.error('Error setting up visualizer connection:', error);
      this.onError?.(error as Error);
    }
  }

  private async getAudioElementFromHowl(): Promise<HTMLAudioElement | null> {
    return new Promise((resolve) => {
      try {
        const checkAudioElement = () => {
          if (this.howlInstance?._sounds?.[0]?._node) {
            resolve(this.howlInstance._sounds[0]._node);
          } else {
            setTimeout(checkAudioElement, 50);
          }
        };
        
        checkAudioElement();
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      } catch (error) {
        console.error('Error accessing audio element from Howl:', error);
        resolve(null);
      }
    });
  }

  public setVisualizerType(type: string): void {
    if (this.isDestroyed) return;
    
    try {
      if (this.visualizerManager) {
        this.visualizerManager.addVisualizer(type);
        useStore.getState().setVisualizerType(type);
      } else {
        console.warn('Visualizer manager not initialized yet, queuing type change');
        useStore.getState().setVisualizerType(type);
      }
    } catch (error) {
      console.error('Error setting visualizer type:', error);
      this.onError?.(error as Error);
    }
  }

  public updateSettings(settings: Record<string, any>): void {
    if (this.isDestroyed) return;
    
    try {
      console.log('Updating visualizer settings:', settings);
      // TODO: Implement settings update logic
    } catch (error) {
      console.error('Error updating visualizer settings:', error);
    }
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.visualizerManager?.analyser || null;
  }

  public getAudioContext(): AudioContext | null {
    return this.visualizerManager?.audioContext || null;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    try {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      
      if (this.visualizerManager) {
        this.visualizerManager.destroy();
        this.visualizerManager = null;
      }
      
      useStore.getState().setVisualizer(null);
      console.log('Visualizer adapter destroyed successfully');
    } catch (error) {
      console.error('Error destroying visualizer adapter:', error);
    }
  }
}

// Enhanced initialization with better error handling
async function initApp(): Promise<void> {
  try {
    useStore.getState().setLoading(true);
    useStore.getState().setError(null);

    // Initialize components in sequence
    console.log('Initializing app components...');
    
    initUI(useStore);
    initSettings(useStore);
    initPlaylists(useStore);
    initTracks(useStore);

    // Initialize player with error handling
    const playerInstance = initPlayer(useStore);
    if (!playerInstance) {
      throw new Error('Failed to initialize audio player');
    }

    // Initialize visualizer
    await initializeVisualizer(playerInstance);
    
    // Setup additional features
    setupAddMusicButton();
    setupKeyboardControls();
    setupThemeSystem();
    
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    useStore.getState().setError(`Failed to initialize app: ${error}`);
  } finally {
    useStore.getState().setLoading(false);
  }
}

async function initializeVisualizer(playerInstance: any): Promise<void> {
  const visualizerContainer = document.getElementById('visualizer-container');

  if (!visualizerContainer) {
    console.warn('Visualizer container not found');
    return;
  }

  try {
    const visualizerAdapter = new HowlVisualizerAdapter(visualizerContainer);
    
    // Error handling
    visualizerAdapter.onError = (error) => {
      console.error('Visualizer error:', error);
      useStore.getState().setError(`Visualizer error: ${error.message}`);
    };

    // Connect to player
    if (typeof playerInstance.setVisualizerInstance === 'function') {
      playerInstance.setVisualizerInstance(visualizerAdapter);
      console.log('Visualizer adapter connected to audio player');
    } else {
      console.warn('Player does not support visualizer integration');
    }

    // Setup controls when ready
    visualizerAdapter.onVisualizerManagerReady = (manager) => {
      console.log('VisualizerManager ready, setting up controls');
      setupVisualizerControls(visualizerAdapter);
    };

  } catch (error) {
    console.error('Error initializing visualizer:', error);
    useStore.getState().setError(`Failed to initialize visualizer: ${error}`);
  }
}

function setupVisualizerControls(visualizerAdapter: HowlVisualizerAdapter): void {
  const container = document.getElementById('visualizer-controls');
  const canvasContainer = document.getElementById('visualizer-container');

  if (!container || !canvasContainer) {
    console.warn('Visualizer controls container not found');
    return;
  }

  try {
    const visualizerManager = (visualizerAdapter as any).visualizerManager;
    if (!visualizerManager) {
      console.warn('VisualizerManager not initialized in adapter');
      return;
    }

    const controls = new VisualizerControls({
      container,
      visualizerManager,
      onTypeChange: (type) => {
        visualizerAdapter.setVisualizerType(type as string);
      },
      onSettingsChange: (key, value) => {
        visualizerAdapter.updateSettings({ [key]: value });
      },
    });

    console.log('Visualizer controls initialized successfully');
  } catch (error) {
    console.error('Error setting up visualizer controls:', error);
  }
}

function setupKeyboardControls(): void {
  const keyboardHandler = (e: KeyboardEvent) => {
    // Only handle shortcuts when not typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        document.getElementById('playPauseBtn')?.click();
        break;
      case 'ArrowRight':
        if (e.ctrlKey) {
          e.preventDefault();
          // Skip forward
          document.getElementById('nextBtn')?.click();
        }
        break;
      case 'ArrowLeft':
        if (e.ctrlKey) {
          e.preventDefault();
          // Skip backward
          document.getElementById('prevBtn')?.click();
        }
        break;
      case 'ArrowUp':
        if (e.ctrlKey) {
          e.preventDefault();
          // Volume up
          const { volume, setVolume } = useStore.getState();
          setVolume(Math.min(1, volume + 0.1));
        }
        break;
      case 'ArrowDown':
        if (e.ctrlKey) {
          e.preventDefault();
          // Volume down
          const { volume, setVolume } = useStore.getState();
          setVolume(Math.max(0, volume - 0.1));
        }
        break;
    }
  };

  document.addEventListener('keydown', keyboardHandler);
  
  // Add cleanup handler for removing the event listener
  cleanupHandlers.push(() => {
    document.removeEventListener('keydown', keyboardHandler);
  });
}

function setupThemeSystem(): void {
  const { theme } = useStore.getState();
  
  // Apply initial theme
  document.documentElement.setAttribute('data-theme', theme);
  
  // Listen for theme changes
  useStore.subscribe((state) => {
    document.documentElement.setAttribute('data-theme', state.theme);
  });
}

function setupAddMusicButton(): void {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;

  if (!uploadBtn || !fileInput) {
    console.warn('Upload button or file input not found');
    return;
  }

  const handleDirectoryUpload = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'read',
        });
        
        const event = new CustomEvent('music-directory-selected', { 
          detail: dirHandle 
        });
        window.dispatchEvent(event);
      } else {
        // Fallback to file input
        fileInput.setAttribute('multiple', 'true');
        fileInput.setAttribute('accept', 'audio/*,.mp3,.wav,.ogg,.m4a,.flac');
        fileInput.click();
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error selecting music directory:', error);
        useStore.getState().setError('Failed to select music directory');
      }
      // Fallback to file input
      fileInput.click();
    }
  };

  uploadBtn.addEventListener('click', handleDirectoryUpload);
  
  // Handle file input change
  fileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      const event = new CustomEvent('music-files-selected', { 
        detail: Array.from(files) 
      });
      window.dispatchEvent(event);
    }
  });
}

// Global cleanup handlers
const cleanupHandlers: (() => void)[] = [];

// Enhanced cleanup function for app teardown
function destroyApp(): void {
  try {
    // Run all cleanup handlers
    cleanupHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Error in cleanup handler:', error);
      }
    });
    
    // Clear cleanup handlers
    cleanupHandlers.length = 0;
    
    // Destroy visualizer
    const { visualizer } = useStore.getState();
    if (visualizer) {
      visualizer.destroy();
    }
    
    console.log('App destroyed successfully');
  } catch (error) {
    console.error('Error destroying app:', error);
  }
}

// Initialize the app
initApp().catch((error) => {
  console.error('Failed to initialize app:', error);
  useStore.getState().setError(`App initialization failed: ${error.message}`);
});

// Export for cleanup
export { destroyApp, useStore };