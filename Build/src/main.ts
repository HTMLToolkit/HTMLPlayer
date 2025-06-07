import { create } from 'zustand';
import { initPlayer } from './player';
import { initSettings } from './settings';
import { initPlaylists } from './playlists';
import { initTracks } from './tracks';
import { initUI } from './ui';
import { VisualizerManager } from './visualizerManager';
import VisualizerControls from './visualizerControls';

export interface AppState {
  currentTrack: string | null;
  isPlaying: boolean;
  theme: string;
  setCurrentTrack: (track: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setTheme: (theme: string) => void;
  visualizer?: VisualizerManager | null;
}

const useStore = create<AppState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  theme: 'default',
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setTheme: (theme) => set({ theme }),
}));

// Enhanced visualizer wrapper to work with Howl.js
class HowlVisualizerAdapter {
  private visualizerManager: VisualizerManager | null = null;
  private howlInstance: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private canvasContainer: HTMLElement;

  // New callback that app sets to be notified when visualizerManager is ready
  public onVisualizerManagerReady?: (manager: VisualizerManager) => void;

  constructor(canvasContainer: HTMLElement) {
    this.canvasContainer = canvasContainer;
    this.setupCanvasContainer(canvasContainer);
  }

  private setupCanvasContainer(container: HTMLElement) {
    if (!container.style.position) {
      container.style.position = 'relative';
    }
    // Ensure container has a visible height or else canvas won't show
    if (!container.style.height) {
      container.style.height = '200px'; // default height
    }
  }

  public setHowlInstance(howl: any) {
    this.howlInstance = howl;

    // Wait until the Howl sound is playing (audio element ready)
    if (this.howlInstance) {
      this.howlInstance.once('play', () => {
        this.setupVisualizerConnection();
      });

      // If already playing, setup immediately
      if (this.howlInstance.playing()) {
        this.setupVisualizerConnection();
      }
    }
  }

  public setupVisualizerConnection() {
    if (!this.howlInstance) return;

    try {
      const audioElement = this.getAudioElementFromHowl();

      if (audioElement) {
        if (!this.visualizerManager) {
          this.visualizerManager = new VisualizerManager(audioElement, this.canvasContainer);
          this.visualizerManager.initialize();

          // Start with a default visualizer, e.g., 'oscilloscope'
          this.visualizerManager.addVisualizer('oscilloscope');

          // Notify that visualizerManager is ready
          if (this.onVisualizerManagerReady) {
            this.onVisualizerManagerReady(this.visualizerManager);
          }
        }
      } else {
        console.warn('Audio element from Howl not ready yet');
      }
    } catch (error) {
      console.error('Error setting up visualizer connection:', error);
    }
  }

  private getAudioElementFromHowl(): HTMLAudioElement | null {
    try {
      if (this.howlInstance && this.howlInstance._sounds && this.howlInstance._sounds[0]) {
        return this.howlInstance._sounds[0]._node || null;
      }
    } catch (error) {
      console.error('Error accessing audio element from Howl:', error);
    }
    return null;
  }

  public setVisualizerType(type: string) {
    if (this.visualizerManager) {
      this.visualizerManager.addVisualizer(type);
    } else {
      console.warn('Visualizer manager not initialized yet');
    }
  }

  public updateSettings(settings: any) {
    console.log('Updating visualizer settings:', settings);
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.visualizerManager?.analyser || null;
  }

  public getAudioContext(): AudioContext | null {
    return this.visualizerManager?.audioContext || null;
  }

  public destroy() {
    if (this.visualizerManager) {
      this.visualizerManager.destroy();
      this.visualizerManager = null;
    }
  }
}

async function initApp() {
  // Initialize other components first
  initUI(useStore);
  initSettings(useStore);
  initPlaylists(useStore);
  initTracks(useStore);

  // Initialize player
  const playerInstance = initPlayer(useStore);

  // Initialize visualizer adapter
  const visualizerContainer = document.getElementById('visualizer-container');

  if (visualizerContainer && playerInstance) {
    const visualizerAdapter = new HowlVisualizerAdapter(visualizerContainer);

    // Connect the visualizer adapter to the player
    if (typeof playerInstance.setVisualizerInstance === 'function') {
      playerInstance.setVisualizerInstance(visualizerAdapter);
      console.log('Visualizer adapter connected to audio player');
    }

    // Wait for visualizerManager before setting up controls
    visualizerAdapter.onVisualizerManagerReady = (manager) => {
      console.log('VisualizerManager ready, setting up controls');
      setupVisualizerControls(visualizerAdapter);
    };

    // Do NOT call setupVisualizerControls immediately here
  }

  setupAddMusicButton();

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      const playPauseBtn = document.getElementById('playPauseBtn');
      if (playPauseBtn) {
        playPauseBtn.click();
      }
    }
  });

  // Handle window resize for visualizer
  window.addEventListener('resize', () => {
    if (visualizerContainer) {
      const canvas = visualizerContainer.querySelector('canvas');
      if (canvas) {
        canvas.width = visualizerContainer.clientWidth;
        canvas.height = visualizerContainer.clientHeight;
      }
    }
  });
}

function setupVisualizerControls(visualizerAdapter: HowlVisualizerAdapter) {
  const container = document.getElementById('visualizer-controls');
  const canvasContainer = document.getElementById('visualizer-container');

  if (!container || !canvasContainer) {
    console.warn('VisualizerControls container not found');
    return;
  }

  const visualizerManager = visualizerAdapter['visualizerManager'];
  if (!visualizerManager) {
    console.warn('VisualizerManager not initialized in adapter');
    return;
  }

  const controls = new VisualizerControls({
    container,
    visualizerManager,
    onTypeChange: (type) => visualizerAdapter.setVisualizerType(type as string),
    onSettingsChange: (key, value) => {
      visualizerAdapter.updateSettings({ [key]: value });
    },
  });
}

// Directory picker + file input fallback for Add Music
function setupAddMusicButton() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener('click', async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const event = new CustomEvent('music-directory-selected', { detail: dirHandle });
        window.dispatchEvent(event);
      } catch (e) {
        fileInput.click();
      }
    } else {
      console.warn('Directory picker not supported, falling back to file input');
      fileInput.setAttribute('multiple', 'true');
      fileInput.setAttribute('accept', 'audio/*');
      fileInput.click();
    }
  });
}

// Initialize the app
initApp();
