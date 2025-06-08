import DOMPurify from 'dompurify';
import { StoreApi, UseBoundStore } from 'zustand';
import { AppState } from './main';
import { saveSettings, loadSettings, getAudioCacheSize, clearAudioCache } from './storage';

// Types
interface Settings {
  theme: string;
  visualizerStyle: 'particles' | 'waveform' | 'bars';
  cacheEnabled: boolean;
}

interface ThemeOption {
  value: string;
  label: string;
  description?: string;
}

interface VisualizerOption {
  value: Settings['visualizerStyle'];
  label: string;
  description?: string;
}

// Constants
const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'default',
  visualizerStyle: 'particles',
  cacheEnabled: true
} as const;

const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  { value: 'default', label: 'Default', description: 'Classic theme' },
  { value: 'dark', label: 'Dark', description: 'Dark mode for low-light environments' },
  { value: 'light', label: 'Light', description: 'Clean light theme' },
  { value: 'blue', label: 'Blue', description: 'Cool blue accent theme' },
  { value: 'red', label: 'Red', description: 'Vibrant red accent theme' }
] as const;

const VISUALIZER_OPTIONS: ReadonlyArray<VisualizerOption> = [
  { value: 'particles', label: 'Particles', description: 'Dynamic floating particles' },
  { value: 'waveform', label: 'Waveform', description: 'Classic audio waveform display' },
  { value: 'bars', label: 'Bars', description: 'Frequency bars visualization' }
] as const;

// Utility functions
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedValue = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
  return `${formattedValue} ${sizes[i]}`;
};

const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Custom errors
class SettingsError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'SettingsError';
  }
}

class ElementNotFoundError extends Error {
  constructor(elementId: string) {
    super(`Element with id '${elementId}' not found`);
    this.name = 'ElementNotFoundError';
  }
}

// Settings validation
class SettingsValidator {
  static validateSettings(settings: any): Settings {
    const validated: Settings = { ...DEFAULT_SETTINGS };
    
    if (!settings || typeof settings !== 'object') {
      return validated;
    }

    // Validate theme
    if (typeof settings.theme === 'string' && settings.theme.trim()) {
      validated.theme = settings.theme.trim();
    }
    
    // Validate visualizerStyle
    if (typeof settings.visualizerStyle === 'string' && 
        VISUALIZER_OPTIONS.some(opt => opt.value === settings.visualizerStyle)) {
      validated.visualizerStyle = settings.visualizerStyle;
    }
    
    // Validate cacheEnabled
    if (typeof settings.cacheEnabled === 'boolean') {
      validated.cacheEnabled = settings.cacheEnabled;
    }
    
    return validated;
  }

  static validateTheme(theme: string): boolean {
    return typeof theme === 'string' && theme.trim().length > 0;
  }

  static validateVisualizerStyle(style: string): style is Settings['visualizerStyle'] {
    return VISUALIZER_OPTIONS.some(opt => opt.value === style);
  }
}

// Enhanced Settings Manager
class SettingsManager {
  private settingsCache?: Settings;
  private readonly debouncedSave = debounce(this.saveSettingsInternal.bind(this), 300);

  constructor(private store: UseBoundStore<StoreApi<AppState>>) {}

  async getSettings(): Promise<Settings> {
    if (this.settingsCache) {
      return this.settingsCache;
    }

    try {
      const loadedSettings = await loadSettings();
      this.settingsCache = SettingsValidator.validateSettings(loadedSettings);
      return this.settingsCache;
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      this.settingsCache = { ...DEFAULT_SETTINGS };
      return this.settingsCache;
    }
  }

  private async saveSettingsInternal(settings: Settings): Promise<void> {
    try {
      await saveSettings(settings);
      this.settingsCache = settings;
    } catch (error) {
      throw new SettingsError('Failed to save settings', error instanceof Error ? error : undefined);
    }
  }

  async updateTheme(theme: string): Promise<void> {
    if (!SettingsValidator.validateTheme(theme)) {
      throw new SettingsError('Invalid theme value');
    }

    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, theme };
    
    try {
      // Update UI immediately for responsiveness
      this.store.getState().setTheme(theme as AppState['theme']);
      
      // Save with debouncing
      await this.debouncedSave(newSettings);
    } catch (error) {
      // Revert UI change if save failed
      this.store.getState().setTheme(currentSettings.theme as AppState['theme']);
      throw error;
    }
  }

  async updateVisualizerStyle(visualizerStyle: string): Promise<void> {
    if (!SettingsValidator.validateVisualizerStyle(visualizerStyle)) {
      throw new SettingsError('Invalid visualizer style');
    }

    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, visualizerStyle };
    
    try {
      await this.debouncedSave(newSettings);
      // Trigger visualizer update if method exists
      const state = this.store.getState();
      if ('setVisualizerStyle' in state && typeof state.setVisualizerStyle === 'function') {
        state.setVisualizerStyle(visualizerStyle);
      }
    } catch (error) {
      throw new SettingsError('Failed to update visualizer style', error instanceof Error ? error : undefined);
    }
  }

  async updateCacheEnabled(cacheEnabled: boolean): Promise<void> {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, cacheEnabled };
    
    try {
      await this.saveSettingsInternal(newSettings);
      
      if (!cacheEnabled) {
        await this.clearCache();
      }
    } catch (error) {
      throw new SettingsError('Failed to update cache setting', error instanceof Error ? error : undefined);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await clearAudioCache();
    } catch (error) {
      throw new SettingsError('Failed to clear cache', error instanceof Error ? error : undefined);
    }
  }

  // Clear the cache when settings are reset
  invalidateCache(): void {
    this.settingsCache = undefined;
  }
}

// Enhanced Settings Modal
class SettingsModal {
  private readonly modal: HTMLElement;
  private readonly content: HTMLElement;
  private readonly closeBtn: HTMLElement;
  private lastActiveElement: HTMLElement | null = null;
  private isOpen = false;
  private currentSettings?: Settings;
  private resizeObserver?: ResizeObserver;

  constructor(
    private readonly store: UseBoundStore<StoreApi<AppState>>,
    private readonly settingsManager: SettingsManager
  ) {
    this.modal = this.getRequiredElement('settingsModal');
    this.content = this.getRequiredElement('settingsContent');
    this.closeBtn = this.getRequiredElement('closeSettings');
    
    this.initializeEventListeners();
    this.setupResizeObserver();
  }

  private getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new ElementNotFoundError(id);
    }
    return element;
  }

  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.isOpen) {
          this.adjustModalPosition();
        }
      });
      this.resizeObserver.observe(this.modal);
    }
  }

  private adjustModalPosition(): void {
    // Ensure modal stays within viewport
    const rect = this.modal.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    if (rect.height > viewportHeight * 0.9) {
      this.modal.style.maxHeight = `${viewportHeight * 0.9}px`;
      this.modal.style.overflowY = 'auto';
    }
  }

  private initializeEventListeners(): void {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', () => this.show());

    // Close button
    this.closeBtn.addEventListener('click', () => this.hide());

    // Keyboard event handlers
    this.modal.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape':
        this.hide();
        break;
      case 'Tab':
        this.trapFocus(e);
        break;
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusableQuery = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
    const focusableElements = this.modal.querySelectorAll(focusableQuery);
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (!firstFocusable || !lastFocusable) return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  async show(): Promise<void> {
    if (this.isOpen) return;
    
    try {
      this.lastActiveElement = document.activeElement as HTMLElement;
      this.modal.classList.remove('hidden');
      this.modal.setAttribute('aria-hidden', 'false');
      this.isOpen = true;
      
      // Render content
      await this.render();
      
      // Focus management
      this.focusFirstElement();
      
      // Adjust position
      this.adjustModalPosition();
      
      // Announce to screen readers
      this.announceToScreenReader('Settings dialog opened');
      
    } catch (error) {
      console.error('Failed to show settings modal:', error);
      this.showErrorState();
    }
  }

  hide(): void {
    if (!this.isOpen) return;
    
    this.modal.classList.add('hidden');
    this.modal.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    
    // Restore focus
    if (this.lastActiveElement) {
      this.lastActiveElement.focus();
    }
    
    // Announce to screen readers
    this.announceToScreenReader('Settings dialog closed');
  }

  private focusFirstElement(): void {
    const firstFocusable = this.modal.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    ) as HTMLElement;
    
    if (firstFocusable) {
      // Small delay to ensure rendering is complete
      requestAnimationFrame(() => {
        firstFocusable.focus();
      });
    }
  }

  private announceToScreenReader(message: string): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  async render(): Promise<void> {
    try {
      const [settings, cacheSize] = await Promise.all([
        this.settingsManager.getSettings(),
        getAudioCacheSize()
      ]);
      
      this.currentSettings = settings;
      const formattedSize = formatBytes(cacheSize);

      this.content.innerHTML = DOMPurify.sanitize(
        this.generateSettingsHTML(settings, formattedSize)
      );
      
      this.attachEventListeners();
    } catch (error) {
      console.error('Error rendering settings:', error);
      this.showErrorState();
    }
  }

  private showErrorState(): void {
    this.content.innerHTML = DOMPurify.sanitize(`
      <div class="error-state max-w-md mx-auto p-8 text-center" role="alert">
        <div class="mb-4">
          <svg class="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Unable to Load Settings</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">There was an error loading your settings. Please try refreshing the page.</p>
        <button type="button" onclick="location.reload()" class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors">
          Refresh Page
        </button>
      </div>
    `);
  }

  private generateSettingsHTML(settings: Settings, cacheSize: string): string {
    return `
      <div class="settings-section max-w-2xl mx-auto p-6 pb-12 space-y-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" border-radius: 10px 5% / 20px 25em 30px 35em;" role="tabpanel" aria-labelledby="settings-title">
        <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 id="settings-title" class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Customize your experience</p>
        </div>
        
        <!-- Theme Setting -->
        <div class="setting-group space-y-3">
          <label for="themeSelect" class="block">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a4 4 0 004 4h4V5z"/>
              </svg>
              <span class="font-medium text-gray-900 dark:text-white">Theme</span>
            </div>
            <select id="themeSelect" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" aria-describedby="theme-description">
              ${THEME_OPTIONS.map(option => 
                `<option value="${option.value}" ${settings.theme === option.value ? 'selected' : ''}>
                  ${option.label}
                </option>`
              ).join('')}
            </select>
          </label>
          <small id="theme-description" class="text-sm text-gray-600 dark:text-gray-400">
            Choose your preferred color theme for the interface
          </small>
        </div>

        <!-- Visualizer Setting -->
        <div class="setting-group space-y-3">
          <label for="visualizerSelect" class="block">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
              <span class="font-medium text-gray-900 dark:text-white">Visualizer Style</span>
            </div>
            <select id="visualizerSelect" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" aria-describedby="visualizer-description">
              ${VISUALIZER_OPTIONS.map(option => 
                `<option value="${option.value}" ${settings.visualizerStyle === option.value ? 'selected' : ''}>
                  ${option.label}
                </option>`
              ).join('')}
            </select>
          </label>
          <small id="visualizer-description" class="text-sm text-gray-600 dark:text-gray-400">
            Select how audio is visualized during playback
          </small>
        </div>

        <!-- Cache Management Section -->
        <div class="cache-section setting-group space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Audio Cache Management</h3>
          </div>
          
          <div class="cache-info space-y-4">
            <!-- Cache Status -->
            <div class="cache-status flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Current cache size:</span>
              <span class="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">${cacheSize}</span>
            </div>
            
            <!-- Cache Toggle -->
            <div class="cache-controls space-y-2">
              <label class="checkbox-label flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">
                <input type="checkbox" id="cacheEnabled" ${settings.cacheEnabled ? 'checked' : ''} 
                       class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                       aria-describedby="cache-description">
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Enable audio caching</span>
                  <small id="cache-description" class="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Store audio files locally to improve loading performance
                  </small>
                </div>
              </label>
            </div>
            
            <!-- Cache Actions -->
            <div class="cache-actions space-y-2">
              <button id="clearCache" class="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:ring-4 focus:ring-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30 dark:focus:ring-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                      type="button" 
                      aria-describedby="clear-cache-description"
                      ${cacheSize === '0 B' ? 'disabled' : ''}>
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  Clear Cache
                </div>
              </button>
              <small id="clear-cache-description" class="block text-xs text-gray-600 dark:text-gray-400 text-center">
                Remove all cached audio files to free up storage space
              </small>
            </div>
          </div>
        </div>

        <!-- Settings Actions -->
        <div class="settings-actions pt-4 border-t border-gray-200 dark:border-gray-700">
          <button id="resetSettings" class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700 transition-colors" type="button">
            <div class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Reset to Defaults
            </div>
          </button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    if (!this.currentSettings) return;

    // Theme selection
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    themeSelect?.addEventListener('change', this.handleThemeChange.bind(this));

    // Visualizer selection
    const visualizerSelect = document.getElementById('visualizerSelect') as HTMLSelectElement;
    visualizerSelect?.addEventListener('change', this.handleVisualizerChange.bind(this));

    // Cache enabled toggle
    const cacheEnabledCheckbox = document.getElementById('cacheEnabled') as HTMLInputElement;
    cacheEnabledCheckbox?.addEventListener('change', this.handleCacheToggle.bind(this));

    // Clear cache button
    const clearCacheBtn = document.getElementById('clearCache') as HTMLButtonElement;
    clearCacheBtn?.addEventListener('click', this.handleClearCache.bind(this));

    // Reset settings button
    const resetBtn = document.getElementById('resetSettings') as HTMLButtonElement;
    resetBtn?.addEventListener('click', this.handleResetSettings.bind(this));
  }

  private async handleThemeChange(e: Event): Promise<void> {
    const target = e.target as HTMLSelectElement;
    try {
      await this.settingsManager.updateTheme(target.value);
      this.announceToScreenReader(`Theme changed to ${target.selectedOptions[0].text}`);
    } catch (error) {
      console.error('Failed to update theme:', error);
      this.showTemporaryError('Failed to update theme');
    }
  }

  private async handleVisualizerChange(e: Event): Promise<void> {
    const target = e.target as HTMLSelectElement;
    try {
      await this.settingsManager.updateVisualizerStyle(target.value);
      this.announceToScreenReader(`Visualizer changed to ${target.selectedOptions[0].text}`);
    } catch (error) {
      console.error('Failed to update visualizer:', error);
      this.showTemporaryError('Failed to update visualizer style');
    }
  }

  private async handleCacheToggle(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    try {
      await this.settingsManager.updateCacheEnabled(target.checked);
      this.announceToScreenReader(`Audio caching ${target.checked ? 'enabled' : 'disabled'}`);
      
      // Refresh to show updated cache size
      setTimeout(() => this.render(), 100);
    } catch (error) {
      console.error('Failed to update cache setting:', error);
      this.showTemporaryError('Failed to update cache setting');
      // Revert checkbox state
      target.checked = !target.checked;
    }
  }

  private async handleClearCache(): Promise<void> {
    const clearBtn = document.getElementById('clearCache') as HTMLButtonElement;
    const originalText = clearBtn.textContent;
    
    try {
      clearBtn.textContent = 'Clearing...';
      clearBtn.disabled = true;
      
      await this.settingsManager.clearCache();
      this.announceToScreenReader('Audio cache cleared successfully');
      
      // Refresh to show updated cache size
      await this.render();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.showTemporaryError('Failed to clear cache');
      
      // Restore button state
      clearBtn.textContent = originalText;
      clearBtn.disabled = false;
    }
  }

  private async handleResetSettings(): Promise<void> {
    if (!confirm('Are you sure you want to reset all settings to their default values?')) {
      return;
    }

    try {
      this.settingsManager.invalidateCache();
      await this.settingsManager.updateTheme(DEFAULT_SETTINGS.theme);
      await this.settingsManager.updateVisualizerStyle(DEFAULT_SETTINGS.visualizerStyle);
      await this.settingsManager.updateCacheEnabled(DEFAULT_SETTINGS.cacheEnabled);
      
      this.announceToScreenReader('Settings reset to defaults');
      await this.render();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showTemporaryError('Failed to reset settings');
    }
  }

  private showTemporaryError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'temporary-error fixed top-4 right-4 z-50 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg shadow-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 animate-slide-in';
    errorDiv.setAttribute('role', 'alert');
    
    errorDiv.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="font-medium">${message}</span>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Add exit animation and remove
    setTimeout(() => {
      errorDiv.classList.add('animate-slide-out');
      setTimeout(() => errorDiv.remove(), 300);
    }, 4700);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    if (this.isOpen) {
      this.hide();
    }
  }
}

// Enhanced initialization function
export function initSettings(store: UseBoundStore<StoreApi<AppState>>) {
  try {
    const settingsManager = new SettingsManager(store);
    const modal = new SettingsModal(store, settingsManager);

    // Subscribe to theme changes with error handling
    const unsubscribe = store.subscribe((state) => {
      try {
        document.documentElement.setAttribute('data-theme', state.theme || DEFAULT_SETTINGS.theme);
      } catch (error) {
        console.error('Error applying theme:', error);
      }
    });

    // Apply initial theme
    const initialState = store.getState();
    if (initialState.theme) {
      document.documentElement.setAttribute('data-theme', initialState.theme);
    }

    // Return cleanup function
    return () => {
      unsubscribe();
      modal.destroy();
    };
  } catch (error) {
    console.error('Error initializing settings:', error);
    
    // Return no-op cleanup function even on error
    return () => {};
  }
}