import { Component, ErrorInfo, ReactNode } from "react";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useMusicLibrary } from "../hooks/useMusicLibrary";
import { usePlayerSettings } from "../hooks/usePlayerSettings";

interface ErrorBoundaryProps {
  children: ReactNode;
  audioPlayback?: ReturnType<typeof useAudioPlayback>;
  musicLibrary?: ReturnType<typeof useMusicLibrary>;
  playerSettings?: ReturnType<typeof usePlayerSettings>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Error caught in ErrorBoundary:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      audioPlaybackState: this.props.audioPlayback?.playerState,
      musicLibraryState: this.props.musicLibrary?.library,
      playerSettingsState: this.props.playerSettings?.settings,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red" }}>
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.message}</p>
          <pre>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}