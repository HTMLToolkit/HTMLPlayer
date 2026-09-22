import type {
  Track,
  Playlist,
  QueueState,
  QueueCursor,
  PlayHistory,
} from "../types";

export type ShuffleMode = "random" | "smart";

export interface WeightedRandomizer {
  getWeightedRandomTrack(trackIds: string[]): string | null;
}

type Direction = "next" | "previous";

/**
 * Owns the play queue around a discriminated cursor.
 */
export class QueueManager {
  private state: QueueState = {
    tracks: [],
    cursor: { kind: "empty" },
    shuffled: false,
    shuffleOrder: [],
  };

  private history: Map<string, PlayHistory> = new Map();
  private maxHistorySize = 1000;
  private weightedRandomizer: WeightedRandomizer | null = null;
  private shuffleMode: ShuffleMode = "random";

  setWeightedRandomizer(randomizer: WeightedRandomizer | null): void {
    this.weightedRandomizer = randomizer;
  }

  getShuffleMode(): ShuffleMode {
    return this.shuffleMode;
  }

  setShuffleMode(mode: ShuffleMode): void {
    this.shuffleMode = mode;
  }

  setPlaylist(playlist: Playlist | null, preserveCurrent = true): void {
    if (!playlist) {
      this.state = {
        tracks: [],
        cursor: { kind: "empty" },
        shuffled: this.state.shuffled,
        shuffleOrder: [],
      };
      return;
    }

    const tracks = [...playlist.songs];
    const currentTrack = preserveCurrent ? this.getCurrentTrack() : null;
    const newIndex = currentTrack
      ? tracks.findIndex((t) => t.id === currentTrack.id)
      : -1;

    this.state.tracks = tracks;
    this.state.shuffleOrder = this.generateShuffleOrder(
      tracks.length,
      newIndex >= 0 ? newIndex : null,
    );
    this.setCursor(
      newIndex >= 0 ? { kind: "active", index: newIndex } : { kind: "empty" },
    );
  }

  getCursor(): QueueCursor {
    return this.state.cursor;
  }

  setCursor(cursor: QueueCursor): void {
    switch (cursor.kind) {
      case "empty":
        this.state.cursor = { kind: "empty" };
        break;
      case "active":
        if (cursor.index >= 0 && cursor.index < this.state.tracks.length) {
          this.state.cursor = { kind: "active", index: cursor.index };
        } else {
          this.state.cursor = { kind: "empty" };
        }
        break;
    }
  }

  /**
   * Move the cursor to an index unconditionally. Negative or out-of-bounds
   * indices (including the old `-1` sentinel) collapse to the empty state.
   */
  jumpToIndex(index: number | null): void {
    this.setCursor(
      index === null ? { kind: "empty" } : { kind: "active", index },
    );
  }

  peekNextCursor(_smartShuffle: boolean): QueueCursor {
    return this.peekAdjacentCursor("next");
  }

  peekPreviousCursor(_smartShuffle: boolean): QueueCursor {
    return this.peekAdjacentCursor("previous");
  }

  getCurrentTrack(): Track | null {
    const cursor = this.state.cursor;
    switch (cursor.kind) {
      case "empty":
        return null;
      case "active":
        return this.state.tracks[cursor.index] ?? null;
    }
  }

  getCurrentIndex(): number | null {
    const cursor = this.state.cursor;
    switch (cursor.kind) {
      case "empty":
        return null;
      case "active":
        return cursor.index;
    }
  }

  getNextIndex(smartShuffle: boolean): number | null {
    const cursor = this.peekNextCursor(smartShuffle);
    return cursor.kind === "active" ? cursor.index : null;
  }

  getPreviousIndex(smartShuffle: boolean): number | null {
    const cursor = this.peekPreviousCursor(smartShuffle);
    return cursor.kind === "active" ? cursor.index : null;
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

  getNextTrack(smartShuffle: boolean): Track | null {
    return this.trackForCursor(this.peekNextCursor(smartShuffle));
  }

  getPreviousTrack(smartShuffle: boolean): Track | null {
    return this.trackForCursor(this.peekPreviousCursor(smartShuffle));
  }

  shuffle(preserveCurrent = true): void {
    this.state.shuffled = true;
    const preserveIndex =
      preserveCurrent && this.state.cursor.kind === "active"
        ? this.state.cursor.index
        : null;

    if (this.shuffleMode === "smart" && this.weightedRandomizer) {
      this.state.shuffleOrder = this.generateSmartShuffleOrder(
        this.state.tracks.length,
        preserveIndex,
      );
    } else {
      this.state.shuffleOrder = this.generateShuffleOrder(
        this.state.tracks.length,
        preserveIndex,
      );
    }
  }

  private generateSmartShuffleOrder(
    length: number,
    preserveIndex: number | null,
  ): number[] {
    if (length === 0) return [];

    const randomizer = this.weightedRandomizer;
    if (!randomizer) {
      return this.generateShuffleOrder(length, preserveIndex);
    }

    const trackIds = this.state.tracks.map((t) => t.id);
    const selectedIds: string[] = [];
    const availableIndices = Array.from({ length }, (_, i) => i);

    while (availableIndices.length > 0) {
      const availableTrackIds = availableIndices.map((i) => trackIds[i]);
      const selectedId = randomizer.getWeightedRandomTrack(availableTrackIds);

      if (!selectedId) break;

      const selectedIndex = trackIds.indexOf(selectedId);
      if (selectedIndex === -1) break;

      const actualIndex = availableIndices.indexOf(selectedIndex);
      if (actualIndex === -1) break;

      selectedIds.push(selectedId);
      availableIndices.splice(actualIndex, 1);
    }

    if (preserveIndex !== null && preserveIndex < length) {
      const preserveId = trackIds[preserveIndex];
      const idxInSelected = selectedIds.indexOf(preserveId);
      if (idxInSelected > 0) {
        selectedIds.splice(idxInSelected, 1);
        selectedIds.unshift(preserveId);
      }
    }

    return selectedIds
      .map((id) => trackIds.indexOf(id))
      .filter((i) => i >= 0);
  }

  unshuffle(): void {
    this.state.shuffled = false;
    this.state.shuffleOrder = [];
  }

  isShuffled(): boolean {
    return this.state.shuffled;
  }

  private generateShuffleOrder(
    length: number,
    preserveIndex: number | null,
  ): number[] {
    if (length === 0) return [];

    const indices = Array.from({ length }, (_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    if (preserveIndex !== null && preserveIndex < length) {
      const currentInShuffle = indices.indexOf(preserveIndex);
      if (currentInShuffle > 0) {
        [indices[0], indices[currentInShuffle]] = [
          indices[currentInShuffle],
          indices[0],
        ];
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
      const sorted = Array.from(this.history.values()).sort(
        (a, b) => a.lastPlayed - b.lastPlayed,
      );
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
    const { cursor, tracks, ...rest } = state;
    if (tracks !== undefined) {
      this.state.tracks = [...tracks];
    }
    if (cursor !== undefined) {
      this.setCursor(cursor);
    }
    Object.assign(this.state, rest);
  }

  addTrack(track: Track): void {
    this.state.tracks.push(track);
    if (this.state.shuffled) {
      const newIndex = this.state.tracks.length - 1;
      this.state.shuffleOrder.push(newIndex);
      const insertPos =
        Math.floor(Math.random() * (this.state.shuffleOrder.length - 1)) + 1;
      this.state.shuffleOrder.splice(insertPos, 0, newIndex);
    }
  }

  removeTrack(trackId: string): void {
    const index = this.state.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return;

    this.state.tracks.splice(index, 1);

    switch (this.state.cursor.kind) {
      case "empty":
        break;
      case "active": {
        const { index: cursorIndex } = this.state.cursor;
        if (cursorIndex > index) {
          this.state.cursor = { kind: "active", index: cursorIndex - 1 };
        } else if (cursorIndex === index) {
          // The removed slot now holds the former next track. If the removed
          // track was last, the slot is gone entirely and the queue is empty.
          if (cursorIndex >= this.state.tracks.length) {
            this.state.cursor = { kind: "empty" };
          }
        }
        break;
      }
    }

    if (this.state.shuffled) {
      this.state.shuffleOrder = this.state.shuffleOrder
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    }
  }

  clear(): void {
    this.state.tracks = [];
    this.state.cursor = { kind: "empty" };
    this.state.shuffleOrder = [];
  }

  private trackForCursor(cursor: QueueCursor): Track | null {
    switch (cursor.kind) {
      case "empty":
        return null;
      case "active":
        return this.state.tracks[cursor.index] ?? null;
    }
  }

  private peekAdjacentCursor(direction: Direction): QueueCursor {
    const order = this.getPlayOrder();
    if (order.length === 0) return { kind: "empty" };

    const last = order.length - 1;

    switch (this.state.cursor.kind) {
      case "empty":
        return direction === "next"
          ? { kind: "active", index: order[0] }
          : { kind: "active", index: order[last] };
      case "active": {
        const currentPos = order.indexOf(this.state.cursor.index);
        if (currentPos === -1) {
          return direction === "next"
            ? { kind: "active", index: order[0] }
            : { kind: "active", index: order[last] };
        }
        const adjacentPos = direction === "next" ? currentPos + 1 : currentPos - 1;
        const wrappedPos =
          adjacentPos < 0 ? last : adjacentPos > last ? 0 : adjacentPos;
        return { kind: "active", index: order[wrappedPos] };
      }
    }
  }
}