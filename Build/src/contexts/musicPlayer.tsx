import { createContext, useContext, ReactNode, useState, useEffect, useMemo } from "react";
import { useMusicPlayer } from "../hooks/useMusicPlayer";

type MusicPlayerContextType = ReturnType<typeof useMusicPlayer>;

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export const MusicPlayerProvider = ({ children }: { children: ReactNode }) => {
  console.log("MusicPlayerProvider: Rendering");

  const musicPlayer = useMusicPlayer();

  // Memoize the context value to prevent unnecessary rerenders of consumers
  const contextValue = useMemo(() => musicPlayer, [
    musicPlayer.playerSettings, 
    musicPlayer.songCache,
    musicPlayer.audioPlayback,
    musicPlayer.musicLibrary,
  ]);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log("MusicPlayerProvider: Setting ready state");
    setIsReady(true);
  }, []);

  if (!isReady) {
    console.log("MusicPlayerProvider: Not ready, returning null");
    return null;
  }

  return (
    <MusicPlayerContext.Provider value={contextValue}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayerContext = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayerContext must be used within a MusicPlayerProvider");
  }
  return context;
};