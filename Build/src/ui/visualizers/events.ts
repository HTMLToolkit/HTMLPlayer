export type VisualizerEvent = "change" | "load" | "error";

export type VisualizerEventMap = {
  change: { key: string };
  load: { key: string };
  error: { error: string };
};

type EventCallback<T> = (data: T) => void;

export class VisualizerEvents {
  private listeners: Map<VisualizerEvent, Set<EventCallback<unknown>>> = new Map();

  on<E extends VisualizerEvent>(event: E, callback: EventCallback<VisualizerEventMap[E]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<E extends VisualizerEvent>(event: E, callback: EventCallback<VisualizerEventMap[E]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<E extends VisualizerEvent>(event: E, data: VisualizerEventMap[E]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }
}
