import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { NavigationView } from "../../types/custom-events";
import { throwError } from "../../helpers/logger";
import { prefersReducedMotion } from "../../helpers/reducedMotion";
import {
  selectCurrentPlaylist,
  selectCurrentTrack,
  useKomorebiStore,
} from "../../store";

export type View = NavigationView;

export interface NavigationState {
  view: View;
  artist?: string;
  album?: string;
  playlistId?: string;
  searchQuery?: string;
}

export interface NavigationContextValue {
  state: NavigationState;
  navigate: (state: NavigationState) => void;
  goHome: () => void;
  goToSongs: () => void;
  goToArtist: (artist: string) => void;
  goToAlbum: (album: string) => void;
  goToPlaylist: (playlistId: string) => void;
  goToSearch: (query?: string) => void;
  goToFavorites: () => void;
  goToCurrentArtist: () => void;
  goToCurrentAlbum: () => void;
  goToCurrentPlaylist: () => void;
  goBack: () => void;
}

const initialState: NavigationState = { view: "home" };

const NavigationContext = createContext<NavigationContextValue | null>(null);

const HISTORY_LIMIT = 50;

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>(initialState);
  const [history, setHistory] = useState<NavigationState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const transitionEpoch = useRef(0);

  const runWithViewTransition = useCallback(
    (direction: "forward" | "back", update: () => void) => {
      const root =
        typeof document !== "undefined" ? document.documentElement : null;
      const canTransition =
        root &&
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotion();
      if (!canTransition) {
        update();
        return;
      }
      const epoch = ++transitionEpoch.current;
      root.dataset.vtDirection = direction;
      const transition = document.startViewTransition(update);
      transition.finished
        .catch(() => {})
        .finally(() => {
          if (transitionEpoch.current === epoch) {
            delete root.dataset.vtDirection;
          }
        });
    },
    [],
  );

  const navigate = useCallback(
    (newState: NavigationState) => {
      runWithViewTransition("forward", () => {
        setState(newState);
        setHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(newState);
          if (newHistory.length > HISTORY_LIMIT) {
            newHistory.shift();
          }
          return newHistory;
        });
        setHistoryIndex((prev) => Math.min(prev + 1, HISTORY_LIMIT - 1));
      });
    },
    [historyIndex, runWithViewTransition],
  );

  const goHome = useCallback(() => navigate({ view: "home" }), [navigate]);
  const goToSongs = useCallback(() => navigate({ view: "songs" }), [navigate]);
  const goToArtist = useCallback(
    (artist: string) => navigate({ view: "artist", artist }),
    [navigate],
  );
  const goToAlbum = useCallback(
    (album: string) => navigate({ view: "album", album }),
    [navigate],
  );
  const goToPlaylist = useCallback(
    (playlistId: string) => navigate({ view: "playlist", playlistId }),
    [navigate],
  );
  const goToSearch = useCallback(
    (query?: string) => navigate({ view: "search", searchQuery: query }),
    [navigate],
  );
  const goToFavorites = useCallback(
    () => navigate({ view: "favorites" }),
    [navigate],
  );

  const goToCurrentArtist = useCallback(() => {
    const store = useKomorebiStore.getState();
    const track = selectCurrentTrack(store);
    if (track?.artist) {
      navigate({ view: "artist", artist: track.artist });
    }
  }, [navigate]);

  const goToCurrentAlbum = useCallback(() => {
    const store = useKomorebiStore.getState();
    const track = selectCurrentTrack(store);
    if (track?.album) {
      navigate({ view: "album", album: track.album });
    }
  }, [navigate]);

  const goToCurrentPlaylist = useCallback(() => {
    const store = useKomorebiStore.getState();
    const playlist = selectCurrentPlaylist(store);
    if (playlist) {
      navigate({ view: "playlist", playlistId: playlist.id });
    }
  }, [navigate]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previous = history[newIndex];
      runWithViewTransition("back", () => {
        setHistoryIndex(newIndex);
        if (previous) setState(previous);
      });
    }
  }, [historyIndex, history, runWithViewTransition]);

  return (
    <NavigationContext.Provider
      value={{
        state,
        navigate,
        goHome,
        goToSongs,
        goToArtist,
        goToAlbum,
        goToPlaylist,
        goToSearch,
        goToFavorites,
        goToCurrentArtist,
        goToCurrentAlbum,
        goToCurrentPlaylist,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    return throwError("useNavigation must be used within NavigationProvider");
  }
  return context;
}

export function useNavigationState(): NavigationState {
  return useNavigation().state;
}
