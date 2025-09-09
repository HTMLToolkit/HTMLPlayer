import { Component, ErrorInfo, ReactNode } from "react";
import { useMusicPlayer } from "../hooks/useMusicPlayer";

interface ErrorBoundaryProps {
  children: ReactNode;
  musicPlayer?: ReturnType<typeof useMusicPlayer>;
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
      audioPlaybackState: this.props.musicPlayer?.audioPlayback?.playerState,
      musicLibraryState: this.props.musicPlayer?.musicLibrary?.library,
      playerSettingsState: this.props.musicPlayer?.playerSettings?.settings,
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