/// <reference lib="dom" />

interface NavigateDetail {
  view: "artist" | "album";
  value: string;
}

// Define the custom event interface
interface NavigateCustomEvent extends CustomEvent<NavigateDetail> {}

// Augment the Window interface to include the custom event
interface Window {
  addEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean,
  ): void;
  removeEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean,
  ): void;
}

// Declare the custom event type for the 'navigate' event
interface WindowEventMap {
  navigate: NavigateCustomEvent;
}
