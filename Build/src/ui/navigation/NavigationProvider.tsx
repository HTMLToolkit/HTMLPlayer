import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { NavigationView } from "../../types/custom-events";

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
  goBack: () => void;
}

const initialState: NavigationState = { view: "home" };

const NavigationContext = createContext<NavigationContextValue | null>(null);

const HISTORY_LIMIT = 50;

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>(initialState);
  const [history, setHistory] = useState<NavigationState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const navigate = useCallback(
    (newState: NavigationState) => {
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
    },
    [historyIndex],
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

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [historyIndex, history]);

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
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

export function useNavigationState(): NavigationState {
  return useNavigation().state;
}
