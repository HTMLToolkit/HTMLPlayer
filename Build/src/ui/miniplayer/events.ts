export type MiniplayerEvent = "open" | "close" | "error";

export type MiniplayerEventMap = {
  open: { window: Window };
  close: null;
  error: { error: string };
};

type EventCallback<T> = (data: T) => void;

export class MiniplayerEvents {
  private listeners: Map<MiniplayerEvent, Set<EventCallback<unknown>>> = new Map();

  on<E extends MiniplayerEvent>(event: E, callback: EventCallback<MiniplayerEventMap[E]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<E extends MiniplayerEvent>(event: E, callback: EventCallback<MiniplayerEventMap[E]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<E extends MiniplayerEvent>(event: E, data: MiniplayerEventMap[E]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }
}
