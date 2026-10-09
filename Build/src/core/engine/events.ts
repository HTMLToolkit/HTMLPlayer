import type { EngineEvent, EngineEventMap } from "./types";

type EventCallback<T> = (data: T) => void;

type ListenerErrorHandler = (event: EngineEvent, error: unknown) => void;

const defaultErrorHandler: ListenerErrorHandler = (event, error) => {
  console.error(`[events] listener for "${event}" threw:`, error);
};

export class KomorebiEvents {
  private listeners: Map<EngineEvent, Set<EventCallback<unknown>>> = new Map();
  private readonly onListenerError: ListenerErrorHandler;

  constructor(onListenerError: ListenerErrorHandler = defaultErrorHandler) {
    this.onListenerError = onListenerError;
  }

  on<E extends EngineEvent>(
    event: E,
    callback: EventCallback<EngineEventMap[E]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<E extends EngineEvent>(
    event: E,
    callback: EventCallback<EngineEventMap[E]>,
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<E extends EngineEvent>(event: E, data: EngineEventMap[E]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        this.onListenerError(event, error);
      }
    });
  }

  once<E extends EngineEvent>(
    event: E,
    callback: EventCallback<EngineEventMap[E]>,
  ): void {
    const wrapper: EventCallback<EngineEventMap[E]> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  removeAllListeners(event?: EngineEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: EngineEvent): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
