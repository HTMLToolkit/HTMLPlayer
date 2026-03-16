import type { Track, Playlist, QueueState, PlayHistory } from "../types";

export class QueueManager {
  private state: QueueState = {
    tracks: [],
    currentIndex: -1,
    shuffled: false,
    shuffleOrder: [],
  };

  private history: Map<string, PlayHistory> = new Map();
  private maxHistorySize = 1000;

  setPlaylist(playlist: Playlist | null, preserveCurrent = true): void {
    if (!playlist) {
      this.state = {
        tracks: [],
        currentIndex: -1,
        shuffled: this.state.shuffled,
        shuffleOrder: [],
      };
      return;
    }

    const tracks = [...playlist.songs];
    const currentTrack = preserveCurrent ? this.getCurrentTrack() : null;
    const newIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;

    this.state.tracks = tracks;
    this.state.shuffleOrder = this.generateShuffleOrder(tracks.length, newIndex);
    this.state.currentIndex = newIndex >= 0 ? newIndex : -1;
  }

  getCurrentTrack(): Track | null {
    if (this.state.currentIndex < 0 || this.state.currentIndex >= this.state.tracks.length) {
      return null;
    }
    return this.state.tracks[this.state.currentIndex];
  }

  getCurrentIndex(): number {
    return this.state.currentIndex;
  }

  setCurrentIndex(index: number): void {
    if (index >= 0 && index < this.state.tracks.length) {
      this.state.currentIndex = index;
    }
  }

  getTracks(): Track[] {
    return [...this.state.tracks];
  }

  getPlayOrder(): number[] {
    if (!this.state.shuffled) {
      return this.state.tracks.map((_, i) => i);
    }
    return [...this.state.shuffleOrder];
  }

  getNextIndex(smartShuffle: boolean): number {
    const order = this.getPlayOrder();
    const currentPos = order.indexOf(this.state.currentIndex);

    if (currentPos === -1) {
      return order.length > 0 ? order[0] : -1;
    }

    const nextPos = currentPos + 1;
    if (nextPos >= order.length) {
      return order.length > 0 ? order[0] : -1;
    }

    return order[nextPos];
  }

  getPreviousIndex(smartShuffle: boolean): number {
    const order = this.getPlayOrder();
    const currentPos = order.indexOf(this.state.currentIndex);

    if (currentPos === -1) {
      return order.length > 0 ? order[order.length - 1] : -1;
    }

    const prevPos = currentPos - 1;
    if (prevPos < 0) {
      return order.length > 0 ? order[order.length - 1] : -1;
    }

    return order[prevPos];
  }

  getNextTrack(smartShuffle: boolean): Track | null {
    const nextIndex = this.getNextIndex(smartShuffle);
    if (nextIndex < 0 || nextIndex >= this.state.tracks.length) {
      return null;
    }
    return this.state.tracks[nextIndex];
  }

  getPreviousTrack(smartShuffle: boolean): Track | null {
    const prevIndex = this.getPreviousIndex(smartShuffle);
    if (prevIndex < 0 || prevIndex >= this.state.tracks.length) {
      return null;
    }
    return this.state.tracks[prevIndex];
  }

  shuffle(preserveCurrent = true): void {
    this.state.shuffled = true;
    this.state.shuffleOrder = this.generateShuffleOrder(
      this.state.tracks.length,
      preserveCurrent ? this.state.currentIndex : -1
    );
  }

  unshuffle(): void {
    this.state.shuffled = false;
    this.state.shuffleOrder = [];
  }

  isShuffled(): boolean {
    return this.state.shuffled;
  }

  private generateShuffleOrder(length: number, preserveIndex: number): number[] {
    if (length === 0) return [];

    const indices = Array.from({ length }, (_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    if (preserveIndex >= 0 && preserveIndex < length) {
      const currentInShuffle = indices.indexOf(preserveIndex);
      if (currentInShuffle > 0) {
        [indices[0], indices[currentInShuffle]] = [indices[currentInShuffle], indices[0]];
      }
    }

    return indices;
  }

  updateHistory(trackId: string): void {
    const existing = this.history.get(trackId);
    if (existing) {
      existing.lastPlayed = Date.now();
      existing.playCount += 1;
    } else {
      this.history.set(trackId, {
        trackId,
        lastPlayed: Date.now(),
        playCount: 1,
      });
    }

    if (this.history.size > this.maxHistorySize) {
      const sorted = Array.from(this.history.values())
        .sort((a, b) => a.lastPlayed - b.lastPlayed);
      const toRemove = sorted.slice(0, this.history.size - this.maxHistorySize);
      toRemove.forEach((h) => this.history.delete(h.trackId));
    }
  }

  getPlayHistory(trackId: string): PlayHistory | undefined {
    return this.history.get(trackId);
  }

  getAllHistory(): Map<string, PlayHistory> {
    return new Map(this.history);
  }

  getState(): QueueState {
    return { ...this.state, tracks: [...this.state.tracks] };
  }

  setState(state: Partial<QueueState>): void {
    Object.assign(this.state, state);
  }

  addTrack(track: Track): void {
    this.state.tracks.push(track);
    if (this.state.shuffled) {
      const newIndex = this.state.tracks.length - 1;
      this.state.shuffleOrder.push(newIndex);
      const insertPos = Math.floor(Math.random() * (this.state.shuffleOrder.length - 1)) + 1;
      this.state.shuffleOrder.splice(insertPos, 0, newIndex);
    }
  }

  removeTrack(trackId: string): void {
    const index = this.state.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return;

    this.state.tracks.splice(index, 1);

    if (this.state.currentIndex > index) {
      this.state.currentIndex--;
    }

    if (this.state.shuffled) {
      this.state.shuffleOrder = this.state.shuffleOrder
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    }
  }

  clear(): void {
    this.state.tracks = [];
    this.state.currentIndex = -1;
    this.state.shuffleOrder = [];
  }
}