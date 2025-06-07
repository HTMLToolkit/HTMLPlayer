import { VisualizerManager } from './visualizerManager';

// Updated types to match the new visualizer system
export type VisualizerType = 'oscilloscope' | 'spectrum' | 'bars' | 'waveform';

export interface VisualizerSettings {
  type: VisualizerType;
  height: number;
  sensitivity: number;
  smoothing: number;
  barCount: number;
  particleCount: number;
  waveColor: string;
  progressColor: string;
  backgroundColor: string;
}

interface VisualizerTypeInfo {
  id: VisualizerType;
  name: string;
  icon: string;
  description: string;
}

interface VisualizerControlsOptions {
  container: HTMLElement;
  visualizerManager: VisualizerManager;
  currentType?: VisualizerType;
  onTypeChange?: (type: VisualizerType) => void;
  onSettingsChange?: <K extends keyof VisualizerSettings>(setting: K, value: VisualizerSettings[K]) => void;
}

class VisualizerControls {
  private container: HTMLElement;
  private visualizerManager: VisualizerManager;
  private currentType: VisualizerType;
  private onTypeChange?: (type: VisualizerType) => void;
  private onSettingsChange?: <K extends keyof VisualizerSettings>(setting: K, value: VisualizerSettings[K]) => void;
  private showSettings: boolean = false;
  private settings: VisualizerSettings;

  private readonly visualizerTypes: VisualizerTypeInfo[] = [
    { id: 'waveform', name: 'Waveform', icon: '〰️', description: 'Audio waveform visualization' },
    { id: 'oscilloscope', name: 'Oscilloscope', icon: '📺', description: 'Time-domain waveform display' },
    { id: 'spectrum', name: 'Spectrum', icon: '📊', description: 'Colorful frequency spectrum' },
    { id: 'bars', name: 'Frequency Bars', icon: '📈', description: 'Gradient frequency bars' }
  ] as const;

  constructor(options: VisualizerControlsOptions) {
    this.container = options.container;
    this.visualizerManager = options.visualizerManager;
    this.currentType = options.currentType || 'waveform';
    this.onTypeChange = options.onTypeChange;
    this.onSettingsChange = options.onSettingsChange;
    
    this.settings = {
      type: this.currentType,
      height: 200,
      sensitivity: 1.0,
      smoothing: 0.8,
      barCount: 64,
      particleCount: 100,
      waveColor: '#4a9eff',
      progressColor: '#006EE6',
      backgroundColor: '#000000'
    };

    this.init();
  }

  private init(): void {
    this.render();
    this.attachEventListeners();
    // Initialize with current type
    if (this.visualizerManager) {
      this.visualizerManager.addVisualizer(this.currentType);
    } else {
      console.warn('Visualizer manager not initialized yet');
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="visualizer-controls bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4" style="position: relative;">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-semibold">Audio Visualizer</h3>
          <div class="flex items-center gap-1">
            <button id="settings-toggle" class="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white">
              ⚙️
            </button>
            <button id="closeVisualizerControls" class="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        <!-- Visualizer Type Selection -->
        <div class="visualizer-types grid grid-cols-2 md:grid-cols-2 gap-2">
          ${this.renderVisualizerTypes()}
        </div>

        <!-- Settings Panel -->
        <div id="settings-panel" class="settings-panel border-t border-gray-700 pt-4 space-y-4" style="display: ${this.showSettings ? 'block' : 'none'}">
          <h4 class="text-white font-medium">Visualizer Settings</h4>
          
          <!-- Sensitivity -->
          <div class="space-y-2">
            <label class="text-gray-300 text-sm">Sensitivity: <span id="sensitivity-value">${this.settings.sensitivity}</span></label>
            <input id="sensitivity-slider" type="range" min="0.1" max="3.0" step="0.1" value="${this.settings.sensitivity}" class="w-full accent-blue-500">
          </div>

          <!-- Smoothing -->
          <div class="space-y-2">
            <label class="text-gray-300 text-sm">Smoothing: <span id="smoothing-value">${this.settings.smoothing}</span></label>
            <input id="smoothing-slider" type="range" min="0" max="1" step="0.1" value="${this.settings.smoothing}" class="w-full accent-blue-500">
          </div>

          <!-- Bar Count (only for spectrum and bars types) -->
          <div id="bar-count-container" class="space-y-2" style="display: ${this.shouldShowBarCount() ? 'block' : 'none'}">
            <label class="text-gray-300 text-sm">Bar Count: <span id="bar-count-value">${this.settings.barCount}</span></label>
            <input id="bar-count-slider" type="range" min="16" max="128" step="8" value="${this.settings.barCount}" class="w-full accent-blue-500">
          </div>

          <!-- Color Controls -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-gray-300 text-sm">Primary Color</label>
              <input id="wave-color" type="color" value="${this.settings.waveColor}" class="w-full h-8 rounded border border-gray-600">
            </div>
            
            <div class="space-y-2">
              <label class="text-gray-300 text-sm">Secondary Color</label>
              <input id="progress-color" type="color" value="${this.settings.progressColor}" class="w-full h-8 rounded border border-gray-600">
            </div>
            
            <div class="space-y-2">
              <label class="text-gray-300 text-sm">Background</label>
              <input id="background-color" type="color" value="${this.settings.backgroundColor}" class="w-full h-8 rounded border border-gray-600">
            </div>
          </div>

          <!-- Preset Themes -->
          <div class="space-y-2">
            <label class="text-gray-300 text-sm">Preset Themes</label>
            <div class="grid grid-cols-2 gap-2">
              <button data-theme="ocean" class="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors">Ocean Blue</button>
              <button data-theme="crimson" class="p-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors">Crimson</button>
              <button data-theme="teal" class="p-2 bg-teal-600 hover:bg-teal-700 rounded text-white text-sm transition-colors">Teal Dream</button>
              <button data-theme="golden" class="p-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm transition-colors">Golden</button>
            </div>
          </div>

          <!-- Canvas Controls -->
          <div class="space-y-2">
            <label class="text-gray-300 text-sm">Canvas Height: <span id="height-value">${this.settings.height}px</span></label>
            <input id="height-slider" type="range" min="100" max="400" step="20" value="${this.settings.height}" class="w-full accent-blue-500">
          </div>
        </div>

        <!-- Usage Instructions -->
        <div class="bg-gray-800 border border-gray-600 rounded-lg p-3">
          <h5 class="text-gray-300 font-medium mb-2">Visualizer Types:</h5>
          <div class="text-xs text-gray-400 space-y-1">
            <p><strong>Waveform:</strong> Cyan audio waveform with fade effect</p>
            <p><strong>Oscilloscope:</strong> Green time-domain oscilloscope display</p>
            <p><strong>Spectrum:</strong> Colorful frequency spectrum with dynamic colors</p>
            <p><strong>Frequency Bars:</strong> Gradient bars showing frequency distribution</p>
          </div>
        </div>
      </div>
    `;
  }

  private renderVisualizerTypes(): string {
    return this.visualizerTypes.map(({ id, name, icon, description }) => `
      <button data-type="${id}" class="visualizer-type-btn p-3 rounded-lg border transition-all duration-200 text-left ${
        this.currentType === id
          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
          : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
      }">
        <div class="flex items-center space-x-2 mb-1">
          <span class="text-base">${icon}</span>
          <span class="font-medium text-sm">${name}</span>
        </div>
        <p class="text-xs opacity-75">${description}</p>
      </button>
    `).join('');
  }

  private shouldShowBarCount(): boolean {
    return ['spectrum', 'bars'].includes(this.currentType);
  }

  private attachEventListeners(): void {
    // Settings toggle
    const settingsToggle = this.container.querySelector('#settings-toggle') as HTMLButtonElement;
    settingsToggle?.addEventListener('click', () => this.toggleSettings());

    // Visualizer type buttons
    const typeButtons = this.container.querySelectorAll('.visualizer-type-btn') as NodeListOf<HTMLButtonElement>;
    typeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        if (type) this.handleTypeChange(type as VisualizerType);
      });
    });

    // Settings sliders
    this.attachSliderListener('sensitivity-slider', 'sensitivity', (value) => parseFloat(value));
    this.attachSliderListener('smoothing-slider', 'smoothing', (value) => parseFloat(value));
    this.attachSliderListener('bar-count-slider', 'barCount', (value) => parseInt(value));
    this.attachSliderListener('height-slider', 'height', (value) => parseInt(value));

    // Color inputs
    this.attachColorListener('wave-color', 'waveColor');
    this.attachColorListener('progress-color', 'progressColor');
    this.attachColorListener('background-color', 'backgroundColor');

    // Theme buttons
    const themeButtons = this.container.querySelectorAll('[data-theme]') as NodeListOf<HTMLButtonElement>;
    themeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        if (theme) this.applyTheme(theme);
      });
    });

    // Close button logic
    const closeBtn = this.container.querySelector('#closeVisualizerControls') as HTMLButtonElement;
    const modal = document.getElementById('visualizer-controls-modal');
    
    closeBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    // Handle click outside modal to close
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });

    // Handle window resize for canvas
    window.addEventListener('resize', () => {
      this.visualizerManager.resizeCanvas();
    });
  }

  private attachSliderListener<K extends keyof VisualizerSettings>(
    sliderId: string, 
    settingKey: K, 
    parser: (value: string) => VisualizerSettings[K]
  ): void {
    const slider = this.container.querySelector(`#${sliderId}`) as HTMLInputElement;
    const valueSpan = this.container.querySelector(`#${sliderId.replace('-slider', '-value')}`) as HTMLSpanElement;
    
    slider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parser(target.value);
      if (value == null) return; // Ignore invalid values
      this.handleSettingChange(settingKey, value);
      if (valueSpan) {
        valueSpan.textContent = settingKey === 'height' ? `${value}px` : value.toString();
      }
      
      // Apply height changes immediately to canvas container
      if (settingKey === 'height') {
        this.visualizerManager.canvasContainer.style.height = `${value}px`;
        this.visualizerManager.resizeCanvas();
      }
    });
  }

  private attachColorListener<K extends keyof VisualizerSettings>(colorId: string, settingKey: K): void {
    const colorInput = this.container.querySelector(`#${colorId}`) as HTMLInputElement;
    colorInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.handleSettingChange(settingKey, target.value as VisualizerSettings[K]);
    });
  }

  private toggleSettings(): void {
    this.showSettings = !this.showSettings;
    const settingsPanel = this.container.querySelector('#settings-panel') as HTMLElement;
    if (settingsPanel) {
      settingsPanel.style.display = this.showSettings ? 'block' : 'none';
    }
  }

  private handleTypeChange(type: VisualizerType): void {
    // Remove current visualizer
    if (this.currentType) {
      this.visualizerManager.removeVisualizer(this.currentType);
    }
    
    // Update current type
    this.currentType = type;
    this.settings.type = type;
    
    // Add new visualizer
    if (this.visualizerManager) {
      this.visualizerManager.addVisualizer(type);
    } else {
      console.warn('Visualizer manager not initialized yet');
    }
    
    // Notify callback
    this.onTypeChange?.(type);
    
    // Update UI
    this.updateVisualizerTypeButtons();
    this.updateConditionalSettings();
  }

  private handleSettingChange<K extends keyof VisualizerSettings>(key: K, value: VisualizerSettings[K]): void {
    this.settings[key] = value;
    this.onSettingsChange?.(key, value);
  }

  private updateVisualizerTypeButtons(): void {
    const typeButtons = this.container.querySelectorAll('.visualizer-type-btn') as NodeListOf<HTMLButtonElement>;
    typeButtons.forEach(button => {
      const type = button.dataset.type;
      if (type === this.currentType) {
        button.className = 'visualizer-type-btn p-3 rounded-lg border transition-all duration-200 text-left border-blue-500 bg-blue-500/20 text-blue-300';
      } else {
        button.className = 'visualizer-type-btn p-3 rounded-lg border transition-all duration-200 text-left border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700';
      }
    });
  }

  private updateConditionalSettings(): void {
    const barCountContainer = this.container.querySelector('#bar-count-container') as HTMLElement;

    if (barCountContainer) {
      barCountContainer.style.display = this.shouldShowBarCount() ? 'block' : 'none';
    }
  }

  private applyTheme(themeName: string): void {
    const themes: Record<string, Partial<VisualizerSettings>> = {
      ocean: { waveColor: '#4a9eff', progressColor: '#006EE6', backgroundColor: '#000000' },
      crimson: { waveColor: '#ff6b6b', progressColor: '#ff5252', backgroundColor: '#1a1a1a' },
      teal: { waveColor: '#4ecdc4', progressColor: '#26d0ce', backgroundColor: '#0d1421' },
      golden: { waveColor: '#ffd93d', progressColor: '#ffb300', backgroundColor: '#2c1810' }
    };

    const theme = themes[themeName];
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        this.handleSettingChange(key as keyof VisualizerSettings, value as any);
      });
      this.updateColorInputs(theme);
    }
  }

  private updateColorInputs(theme: Partial<VisualizerSettings>): void {
    const waveColorInput = this.container.querySelector('#wave-color') as HTMLInputElement;
    const progressColorInput = this.container.querySelector('#progress-color') as HTMLInputElement;
    const backgroundColorInput = this.container.querySelector('#background-color') as HTMLInputElement;

    if (waveColorInput && theme.waveColor) waveColorInput.value = theme.waveColor;
    if (progressColorInput && theme.progressColor) progressColorInput.value = theme.progressColor;
    if (backgroundColorInput && theme.backgroundColor) backgroundColorInput.value = theme.backgroundColor;
  }

  // Public methods
  public getCurrentType(): VisualizerType {
    return this.currentType;
  }

  public getSettings(): VisualizerSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<VisualizerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.render();
    this.attachEventListeners();
  }

  public setCurrentType(type: VisualizerType): void {
    if (this.visualizerTypes.some(t => t.id === type)) {
      this.handleTypeChange(type);
    }
  }

  public updateAudioSource(audioSource: HTMLAudioElement | any): void {
    this.visualizerManager.updateAudioSource(audioSource);
  }

  public destroy(): void {
    this.visualizerManager.destroy();
    this.container.innerHTML = '';
  }
}

// Usage example:
/*
const audioElement = document.getElementById('audio') as HTMLAudioElement;
const canvasContainer = document.getElementById('visualizer-canvas');
const controlsContainer = document.getElementById('visualizer-controls');

const visualizerManager = new VisualizerManager(audioElement, canvasContainer!);

const controls = new VisualizerControls({
  container: controlsContainer!,
  visualizerManager: visualizerManager,
  currentType: 'waveform',
  onTypeChange: (type) => {
    console.log('Visualizer type changed to:', type);
  },
  onSettingsChange: (setting, value) => {
    console.log('Setting changed:', setting, '=', value);
  }
});
*/

export default VisualizerControls;