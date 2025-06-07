// TypeScript VisualizerManager for Audio Visualization

import { spectrogramTypes } from './visualizers';

interface HowlInstance {
  play(): void;
  _sounds?: Array<{
    _node?: HTMLAudioElement;
  }>;
}

declare global {
  interface Window {
    Howler?: any | {
      ctx?: AudioContext;
    };
  }
}

// Enhanced VisualizerManager that can work with both HTML audio elements and Howl.js
export class VisualizerManager {
  public audioSource: HTMLAudioElement | HowlInstance;
  public canvasContainer: HTMLElement;
  public audioContext: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  public activeVisualizer: string | null = null;
  public canvas: HTMLCanvasElement | null = null;
  public context: CanvasRenderingContext2D | null = null;
  public animationFrame: number | null = null;
  public isHowlSource: boolean = false;

  constructor(audioSource: HTMLAudioElement | HowlInstance, canvasContainer: HTMLElement) {
    this.audioSource = audioSource;
    this.canvasContainer = canvasContainer;
  }

  initialize(): void {
    if (!this.audioContext) {
      // Check if we're working with Howl.js or HTML audio element
      this.isHowlSource = this.audioSource && typeof this.audioSource.play === 'function' && 
        ('_sounds' in this.audioSource);
      
      if (this.isHowlSource) {
        this.initializeWithHowl();
      } else {
        this.initializeWithAudioElement();
      }
    }
  }

  initializeWithHowl(): void {
    try {
      // Use Howler's audio context if available
      this.audioContext = window.Howler?.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!this.audioContext) {
        throw new Error('AudioContext could not be created');
      }
      this.analyser = this.audioContext.createAnalyser();
      
      // Get the underlying HTML audio element from Howl
      const audioElement = this.getAudioElementFromHowl();
      if (audioElement) {
        const source = this.audioContext.createMediaElementSource(audioElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.analyser.fftSize = 2048;
        console.log('Visualizer initialized with Howl.js audio source');
      } else {
        throw new Error('Could not access audio element from Howl instance');
      }
    } catch (error) {
      console.error('Error initializing visualizer with Howl:', error);
    }
  }

  initializeWithAudioElement(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaElementSource(this.audioSource as HTMLAudioElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.analyser.fftSize = 2048;
      console.log('Visualizer initialized with HTML audio element');
    } catch (error) {
      console.error('Error initializing visualizer with audio element:', error);
    }
  }

  getAudioElementFromHowl(): HTMLAudioElement | null {
    try {
      const howlSource = this.audioSource as HowlInstance;
      if (howlSource && howlSource._sounds && howlSource._sounds[0]) {
        return howlSource._sounds[0]._node || null;
      }
    } catch (error) {
      console.error('Error accessing audio element from Howl:', error);
    }
    return null;
  }

  createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasContainer.clientWidth;
    canvas.height = this.canvasContainer.clientHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    this.canvasContainer.appendChild(canvas);
    return canvas;
  }

  addVisualizer(type: string): void {
    if (!spectrogramTypes[type]) {
      console.warn(`Visualizer type '${type}' not found`);
      return;
    }

    this.initialize();
    
    // Remove existing visualizer if any
    if (this.activeVisualizer) {
      this.removeVisualizer(this.activeVisualizer);
    }

    // Create new canvas if needed
    if (!this.canvas) {
      this.canvas = this.createCanvas();
      this.context = this.canvas.getContext('2d');
    }

    this.activeVisualizer = type;
    if (!this.animationFrame) this.startAnimation();
    
    console.log(`Visualizer '${type}' activated`);
  }

  removeVisualizer(type: string): void {
    if (this.activeVisualizer !== type) return;
    
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.context = null;
    }

    this.activeVisualizer = null;
    this.stopAnimation();
    
    console.log(`Visualizer '${type}' removed`);
  }

  startAnimation(): void {
    if (!this.analyser) {
      console.warn('Analyser not initialized, cannot start animation');
      return;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const timeDataArray = new Uint8Array(bufferLength);
    const freqDataArray = new Uint8Array(bufferLength);
    const dataType = this.activeVisualizer === 'oscilloscope' || this.activeVisualizer === 'waveform' ? 'time' : 'frequency';

    const animate = (): void => {
      this.animationFrame = requestAnimationFrame(animate);
      
      if (!this.activeVisualizer || !this.canvas || !this.context) {
        return;
      }

      const visualizer = spectrogramTypes[this.activeVisualizer];
      if (visualizer && visualizer.draw) {
        try {
          // Get the appropriate data array based on visualizer type
          if (this.activeVisualizer === 'oscilloscope' || this.activeVisualizer === 'waveform') {
            this.analyser!.getByteTimeDomainData(timeDataArray);
            visualizer.draw(this.analyser!, this.canvas, this.context, bufferLength, timeDataArray, dataType, this.currentSettings);
          } else {
            this.analyser!.getByteFrequencyData(freqDataArray);
            visualizer.draw(this.analyser!, this.canvas, this.context, bufferLength, freqDataArray, dataType);
          }
        } catch (error) {
          console.error('Error in visualizer draw function:', error);
        }
      }
    };
    
    animate();
  }

  stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  resizeCanvas(): void {
    if (this.canvas) {
      this.canvas.width = this.canvasContainer.clientWidth;
      this.canvas.height = this.canvasContainer.clientHeight;
    }
  }

  // Method to update the audio source (useful when tracks change)
  updateAudioSource(newAudioSource: HTMLAudioElement | HowlInstance): void {
    this.audioSource = newAudioSource;
    
    // Re-initialize if we have an active visualizer
    if (this.activeVisualizer) {
      const currentType = this.activeVisualizer;
      this.removeVisualizer(currentType);
      this.audioContext = null; // Force re-initialization
      this.addVisualizer(currentType);
    }
  }

  // Get list of available visualizer types
  getAvailableVisualizers(): string[] {
    return Object.keys(spectrogramTypes);
  }

  private currentSettings: Record<string, any> = {};

  public updateSettings(settings: Record<string, any>): void {
    this.currentSettings = { ...this.currentSettings, ...settings };
    console.log('Updated settings:', this.currentSettings);
  }


  destroy(): void {
    this.stopAnimation();
    
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.context = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    this.activeVisualizer = null;
    console.log('VisualizerManager destroyed');
  }
}