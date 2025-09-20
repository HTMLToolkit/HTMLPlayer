/**
 * Crossfade Helper - Manages smooth audio transitions between songs
 * Uses Web Audio API for precise volume control and timing
 */

export interface CrossfadeOptions {
  duration: number; // Duration in seconds
  curve?: "linear" | "exponential"; // Fade curve type
}

export interface AudioSource {
  element: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
}

export class CrossfadeManager {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private currentSource: AudioSource | null = null;
  private nextSource: AudioSource | null = null;
  private crossfadeInProgress = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGainNode = audioContext.createGain();
    this.masterGainNode.connect(audioContext.destination);
  }

  /**
   * Create an audio source with gain control
   */
  createAudioSource(audioElement: HTMLAudioElement): AudioSource {
    const sourceNode = this.audioContext.createMediaElementSource(audioElement);
    const gainNode = this.audioContext.createGain();

    sourceNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    return {
      element: audioElement,
      gainNode,
      sourceNode,
    };
  }

  /**
   * Set the current playing source
   */
  setCurrentSource(source: AudioSource) {
    this.currentSource = source;
    // Make sure current source is at full volume
    this.currentSource.gainNode.gain.value = 1;
  }

  /**
   * Prepare the next source for crossfading
   */
  prepareNextSource(source: AudioSource) {
    this.nextSource = source;
    // Start with zero volume for next source
    this.nextSource.gainNode.gain.value = 0;
  }

  /**
   * Start crossfade from current to next source
   */
  async startCrossfade(options: CrossfadeOptions): Promise<void> {
    if (!this.currentSource || !this.nextSource || this.crossfadeInProgress) {
      console.log("CrossfadeManager: Cannot start crossfade:", {
        currentSource: !!this.currentSource,
        nextSource: !!this.nextSource,
        crossfadeInProgress: this.crossfadeInProgress,
      });
      return;
    }

    this.crossfadeInProgress = true;
    const { duration, curve = "exponential" } = options;
    const currentTime = this.audioContext.currentTime;

    try {
      // Start playing the next source
      await this.nextSource.element.play();

      // Set up the crossfade curves
      if (curve === "exponential") {
        // Exponential crossfade (more natural sounding)
        this.currentSource.gainNode.gain.setValueAtTime(1, currentTime);
        this.currentSource.gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration
        );

        this.nextSource.gainNode.gain.setValueAtTime(0.001, currentTime);
        this.nextSource.gainNode.gain.exponentialRampToValueAtTime(
          1,
          currentTime + duration
        );
      } else {
        // Linear crossfade
        this.currentSource.gainNode.gain.setValueAtTime(1, currentTime);
        this.currentSource.gainNode.gain.linearRampToValueAtTime(
          0,
          currentTime + duration
        );

        this.nextSource.gainNode.gain.setValueAtTime(0, currentTime);
        this.nextSource.gainNode.gain.linearRampToValueAtTime(
          1,
          currentTime + duration
        );
      }

      // Wait for crossfade to complete
      setTimeout(() => {
        console.log("CrossfadeManager: Crossfade completed");
        this.completeCrossfade();
      }, duration * 1000);
    } catch (error) {
      console.error("CrossfadeManager: Crossfade failed:", error);
      this.crossfadeInProgress = false;
      throw error;
    }
  }

  /**
   * Complete the crossfade transition
   */
  private completeCrossfade() {
    if (this.currentSource) {
      // Stop and cleanup the previous source
      this.currentSource.element.pause();
      this.currentSource.element.currentTime = 0;
    }

    // Move next source to current
    this.currentSource = this.nextSource;
    this.nextSource = null;
    this.crossfadeInProgress = false;
  }

  /**
   * Cancel an ongoing crossfade
   */
  cancelCrossfade() {
    if (!this.crossfadeInProgress) return;

    // Cancel all scheduled changes
    this.currentSource?.gainNode.gain.cancelScheduledValues(
      this.audioContext.currentTime
    );
    this.nextSource?.gainNode.gain.cancelScheduledValues(
      this.audioContext.currentTime
    );

    // Reset volumes
    if (this.currentSource) {
      this.currentSource.gainNode.gain.value = 1;
    }
    if (this.nextSource) {
      this.nextSource.gainNode.gain.value = 0;
      this.nextSource.element.pause();
      this.nextSource.element.currentTime = 0;
    }

    this.crossfadeInProgress = false;
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number) {
    this.masterGainNode.gain.value = volume;
  }

  /**
   * Check if crossfade is currently active
   */
  isCrossfading(): boolean {
    return this.crossfadeInProgress;
  }

  /**
   * Get the currently active audio element
   */
  getCurrentAudioElement(): HTMLAudioElement | null {
    return this.currentSource?.element || null;
  }

  /**
   * Disconnect and cleanup resources
   */
  destroy() {
    this.cancelCrossfade();
    this.currentSource = null;
    this.nextSource = null;
    this.masterGainNode.disconnect();
  }
}
