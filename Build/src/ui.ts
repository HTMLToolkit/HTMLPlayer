import { StoreApi, UseBoundStore } from 'zustand';
import { AppState } from './main';
import { debounce } from 'lodash';
import VisualizerControls from './visualizerControls';

export function initUI(store: UseBoundStore<StoreApi<AppState>>) {
  // Cache DOM elements
  const elements = {
    playPause: document.getElementById('playPauseBtn') as HTMLElement,
    progress: document.getElementById('progress') as HTMLInputElement,
    // Add other elements
  };

  // Theme switching
  store.subscribe((state) => {
    document.documentElement.setAttribute('data-theme', state.theme);
  });

  // Initialize visualizer controls
  const container = document.getElementById('visualizer-controls')!;
  const visualizerModal = document.getElementById('visualizer-controls-modal')!;
  const openVisualizerBtn = document.getElementById('openVisualizerControls');
  const visualizerInstance = store.getState().visualizer;

  // Create controls instance with callbacks to update visualizer
  const controls = new VisualizerControls({
    container,
    currentType: 'oscilloscope', // Use a valid type from spectrogramTypes
    visualizerManager: visualizerInstance!,
    onTypeChange: (type) => {
      visualizerInstance?.addVisualizer(type as string); // Trust VisualizerType union
    },
    onSettingsChange: (setting, value) => {
      visualizerInstance?.updateSettings({ [setting]: value });
    },
  });

  // Handle modal opening
  openVisualizerBtn?.addEventListener('click', () => {
    visualizerModal.classList.remove('hidden');
  });
}