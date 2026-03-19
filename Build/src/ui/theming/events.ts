export type ThemingEvent =
  | "palettechange"
  | "paletteerror"
  | "iconchange"
  | "iconerror"
  | "wallpaperchange"
  | "wallpapererror"
  | "modechange"
  | "modeerror"
  | "themechange"
  | "themeerror";

export type ThemingEventMap = {
  palettechange: { palette: string };
  paletteerror: { error: string };
  iconchange: { iconSet: string };
  iconerror: { error: string };
  wallpaperchange: { wallpaper: string };
  wallpapererror: { error: string };
  modechange: { mode: ThemeMode };
  modeerror: { error: string };
  themechange: null;
  themeerror: { error: string };
};

export type ThemeMode = "light" | "dark" | "auto";

type EventCallback<T> = (data: T) => void;

export class ThemingEvents {
  private listeners: Map<ThemingEvent, Set<EventCallback<unknown>>> = new Map();

  on<E extends ThemingEvent>(event: E, callback: EventCallback<ThemingEventMap[E]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  off<E extends ThemingEvent>(event: E, callback: EventCallback<ThemingEventMap[E]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<E extends ThemingEvent>(event: E, data: ThemingEventMap[E]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  once<E extends ThemingEvent>(event: E, callback: EventCallback<ThemingEventMap[E]>): void {
    const wrapper: EventCallback<ThemingEventMap[E]> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  removeAllListeners(event?: ThemingEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: ThemingEvent): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
