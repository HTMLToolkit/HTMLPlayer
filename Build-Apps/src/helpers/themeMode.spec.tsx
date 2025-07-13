import {
  switchToDarkMode,
  switchToLightMode,
  switchToAutoMode,
  getCurrentThemeMode,
} from "./themeMode";

// Custom mock MediaQueryList that simulates matchMedia behavior
function createMediaQueryList(initialMatches: boolean, query = "(prefers-color-scheme: dark)") {
  let currentMatches = initialMatches;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();

  const mql: Partial<MediaQueryList> = {
    get matches() {
      return currentMatches;
    },
    media: query,
    onchange: null,
    addEventListener(event: any, listener: EventListener) {
      if (event === "change") listeners.add(listener as EventListener);
    },
    removeEventListener(event: any, listener: EventListener) {
      if (event === "change") listeners.delete(listener as EventListener);
    },
    addListener(listener: EventListener) {
      listeners.add(listener);
    },
    removeListener(listener: EventListener) {
      listeners.delete(listener);
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners) {
        listener(event);
      }
      return true;
    },
  };

  return Object.assign(mql, {
    setMatches(newMatches: boolean) {
      if (newMatches !== currentMatches) {
        currentMatches = newMatches;
        const event = { matches: newMatches, media: query } as MediaQueryListEvent;
        mql.onchange?.(event);
        mql.dispatchEvent(event);
      }
    },
  }) as MediaQueryList & { setMatches: (matches: boolean) => void };
}

describe("themeMode helper", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeAll(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  beforeEach(() => {
    document.body.className = "";
  });

  it("should add the 'dark' class when switching to dark mode", () => {
    switchToDarkMode();
    expect(document.body.classList.contains("dark")).toBe(true);
  });

  it("should remove the 'dark' class when switching to light mode", () => {
    document.body.classList.add("dark");
    switchToLightMode();
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  it("should apply dark mode automatically when user prefers dark", () => {
    window.matchMedia = () => createMediaQueryList(true);
    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(true);
  });

  it("should apply light mode automatically when user does not prefer dark", () => {
    document.body.classList.add("dark");
    window.matchMedia = () => createMediaQueryList(false);
    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  it("should update theme when system preference changes in auto mode upon re-calling switchToAutoMode", () => {
    window.matchMedia = () => createMediaQueryList(false);
    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(false);

    window.matchMedia = () => createMediaQueryList(true);
    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(true);

    window.matchMedia = () => createMediaQueryList(false);
    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  it("should update theme when media query change event is triggered", () => {
    const mql = createMediaQueryList(false);
    window.matchMedia = () => mql;

    switchToAutoMode();
    expect(document.body.classList.contains("dark")).toBe(false);

    mql.setMatches(true);
    expect(document.body.classList.contains("dark")).toBe(true);

    mql.setMatches(false);
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  it("getCurrentThemeMode should return 'dark' when dark mode is set manually", () => {
    switchToDarkMode();
    expect(getCurrentThemeMode()).toBe("dark");
  });

  it("getCurrentThemeMode should return 'light' when light mode is set manually", () => {
    switchToLightMode();
    expect(getCurrentThemeMode()).toBe("light");
  });

  it("getCurrentThemeMode should return 'auto' when auto mode is enabled", () => {
    window.matchMedia = () => createMediaQueryList(true);
    switchToAutoMode();
    expect(getCurrentThemeMode()).toBe("auto");
  });
});
