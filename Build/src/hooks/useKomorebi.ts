import { useEffect, useRef, useState, useCallback } from "react";
import { KomorebiEngine } from "../core/engine/engine";
import type { IAudioBackend } from "../platform/audio";
import { HTMLAudioBackend } from "../platform/audio/backends/HTMLBackend";
import type { Track, Playlist, EngineState, EngineSettings, QueueState } from "../core/engine/types";
import type { EngineEventMap } from "../core/engine/types";

const DEFAULT_SETTINGS: EngineSettings = {
  volume: 1,
  crossfade: 0,
  crossfadeBeforeGapless: 3000,
  autoPlayNext: true,
  tempo: 1,
  pitch: 0,
  gaplessPlayback: true,
  smartShuffle: false,
  repeat: "off",
  defaultShuffle: false,
  defaultRepeat: "off",
};

const DEFAULT_QUEUE: QueueState = {
  tracks: [],
  currentIndex: -1,
  shuffled: false,
  shuffleOrder: [],
};

function createInitialState(): EngineState {
  return {
    state: "idle",
    currentTrack: null,
    currentPlaylist: null,
    queue: DEFAULT_QUEUE,
    settings: DEFAULT_SETTINGS,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playHistory: new Map(),
    error: null,
  };
}

export interface UseKomorebiOptions {
  autoPlay?: boolean;
  crossfade?: {
    enabled: boolean;
    duration: number;
    shape: "none" | "linear" | "equalpower";
  };
  gapless?: {
    enabled: boolean;
  };
  smartShuffle?: boolean;
}

export interface UseKomorebiReturn {
  state: EngineState;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  
  load: (track: Track, playlist?: Playlist) => void;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  
  setPlaylist: (playlist: Playlist) => void;
  getQueue: () => Track[];
  
  engine: KomorebiEngine;
}

export function useKomorebi(options: UseKomorebiOptions = {}): UseKomorebiReturn {
  const engineRef = useRef<KomorebiEngine | null>(null);
  const [state, setState] = useState<EngineState>(createInitialState);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbacksRef = useRef<{
    statechange: ((data: EngineEventMap["statechange"]) => void) | null;
    trackchange: ((data: EngineEventMap["trackchange"]) => void) | null;
    timeupdate: ((data: EngineEventMap["timeupdate"]) => void) | null;
    durationchange: ((data: EngineEventMap["durationchange"]) => void) | null;
    ended: ((data: EngineEventMap["ended"]) => void) | null;
    error: ((data: EngineEventMap["error"]) => void) | null;
    loading: ((data: EngineEventMap["loading"]) => void) | null;
    ready: ((data: EngineEventMap["ready"]) => void) | null;
  }>({
    statechange: null,
    trackchange: null,
    timeupdate: null,
    durationchange: null,
    ended: null,
    error: null,
    loading: null,
    ready: null,
  });

  useEffect(() => {
    const backend: IAudioBackend = new HTMLAudioBackend();
    const engine = new KomorebiEngine({
      crossfade: options.crossfade ?? { enabled: false, duration: 0, shape: "linear" },
      gapless: options.gapless ?? { enabled: true },
      smartShuffle: options.smartShuffle ?? true,
      autoPlayNext: options.autoPlay ?? false,
    });
    
    engine.setBackend(backend);
    engineRef.current = engine;

    callbacksRef.current.statechange = () => {
      setState(engine.getState());
    };
    callbacksRef.current.trackchange = (e) => {
      setCurrentTrack(e.to);
    };
    callbacksRef.current.timeupdate = (e) => {
      setCurrentTime(e.currentTime);
    };
    callbacksRef.current.durationchange = (e) => {
      setDuration(e.duration);
    };
    callbacksRef.current.ended = async () => {
      if (state.settings.autoPlayNext) {
        await engine.next();
      }
    };
    callbacksRef.current.error = (e) => {
      setError(e.error.message);
    };
    callbacksRef.current.loading = () => {
      setIsLoading(true);
    };
    callbacksRef.current.ready = () => {
      setIsLoading(false);
    };

    engine.on("statechange", callbacksRef.current.statechange);
    engine.on("trackchange", callbacksRef.current.trackchange);
    engine.on("timeupdate", callbacksRef.current.timeupdate);
    engine.on("durationchange", callbacksRef.current.durationchange);
    engine.on("ended", callbacksRef.current.ended);
    engine.on("error", callbacksRef.current.error);
    engine.on("loading", callbacksRef.current.loading);
    engine.on("ready", callbacksRef.current.ready);

    setState(engine.getState());

    return () => {
      if (callbacksRef.current.statechange) engine.off("statechange", callbacksRef.current.statechange);
      if (callbacksRef.current.trackchange) engine.off("trackchange", callbacksRef.current.trackchange);
      if (callbacksRef.current.timeupdate) engine.off("timeupdate", callbacksRef.current.timeupdate);
      if (callbacksRef.current.durationchange) engine.off("durationchange", callbacksRef.current.durationchange);
      if (callbacksRef.current.ended) engine.off("ended", callbacksRef.current.ended);
      if (callbacksRef.current.error) engine.off("error", callbacksRef.current.error);
      if (callbacksRef.current.loading) engine.off("loading", callbacksRef.current.loading);
      if (callbacksRef.current.ready) engine.off("ready", callbacksRef.current.ready);
      backend.dispose();
    };
  }, []);

  const play = useCallback(async () => {
    await engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const load = useCallback((track: Track, playlist?: Playlist) => {
    setError(null);
    engineRef.current?.load(track, playlist);
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const next = useCallback(async () => {
    await engineRef.current?.next();
  }, []);

  const previous = useCallback(async () => {
    await engineRef.current?.previous();
  }, []);

  const setVolume = useCallback((volume: number) => {
    engineRef.current?.setVolume(volume);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setTempo(rate);
  }, []);

  const setPlaylist = useCallback((playlist: Playlist) => {
    engineRef.current?.setPlaylist(playlist);
  }, []);

  const getQueue = useCallback(() => {
    return engineRef.current?.getQueue().getTracks() ?? [];
  }, []);

  const isPlaying = state.state === "playing";

  return {
    state,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume: state.settings.volume,
    isLoading,
    error,
    load,
    play,
    pause,
    stop,
    seek,
    next,
    previous,
    setVolume,
    setPlaybackRate,
    setPlaylist,
    getQueue,
    engine: engineRef.current!,
  };
}

export default useKomorebi;
