import type { PlayerState } from "../types";

const VALID_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  idle: ["loading", "ready", "error"],
  loading: ["ready", "error", "loading", "idle"],
  ready: ["playing", "paused", "loading", "error", "idle"],
  playing: ["paused", "transitioning", "ready", "error", "loading", "idle"],
  paused: ["playing", "ready", "loading", "error", "idle"],
  transitioning: ["playing", "paused", "ready", "idle", "error", "loading"],
  error: ["loading", "ready", "idle"],
};

export class InvalidStateTransitionError extends Error {
  readonly from: PlayerState;
  readonly to: PlayerState;

  constructor(from: PlayerState, to: PlayerState) {
    super(`Transition from ${from} to ${to} is not allowed`);
    this.name = "InvalidStateTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class StateMachine {
  private state: PlayerState = "idle";
  private history: PlayerState[] = [];

  getState(): PlayerState {
    return this.state;
  }

  canTransition(to: PlayerState): boolean {
    return VALID_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: PlayerState, force = false): boolean {
    if (!force && !this.canTransition(to)) {
      throw new InvalidStateTransitionError(this.state, to);
    }
    this.history.push(this.state);
    if (this.history.length > 20) {
      this.history.shift();
    }
    this.state = to;
    return true;
  }

  isPlaying(): boolean {
    return this.state === "playing";
  }

  isPaused(): boolean {
    return this.state === "paused";
  }

  isIdle(): boolean {
    return this.state === "idle";
  }

  isLoading(): boolean {
    return this.state === "loading";
  }

  isReady(): boolean {
    return this.state === "ready";
  }

  isTransitioning(): boolean {
    return this.state === "transitioning";
  }

  hasError(): boolean {
    return this.state === "error";
  }

  getPreviousState(): PlayerState | null {
    return this.history.length > 0
      ? (this.history[this.history.length - 1] ?? null)
      : null;
  }

  getHistory(): PlayerState[] {
    return [...this.history];
  }

  reset(): void {
    this.state = "idle";
    this.history = [];
  }
}
