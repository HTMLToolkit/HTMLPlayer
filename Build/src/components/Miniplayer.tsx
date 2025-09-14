// Miniplayer.tsx
import { type PlayerState } from "../hooks/musicPlayerHook";
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';

interface MiniplayerControls {
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  playerState: {
    currentSong: PlayerState['currentSong'];
    isPlaying: boolean;
  };
}

let pipWindow: Window | null = null;

// Helper function to create Lucide icon SVGs
const createIconSVG = (iconName: string) => {
  const icons: Record<string, string> = {
    skipBack: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19,20 9,12 19,4"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>`,
    play: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 19,12 5,21"></polygon></svg>`,
    pause: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    skipForward: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,4 15,12 5,20"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`
  };
  return icons[iconName] || '';
};

/**
 * Toggles the Picture-in-Picture miniplayer window.
 * If a PiP window is already open, it will be closed.
 * Otherwise, a new PiP window will be opened with player controls.
 */
export const toggleMiniplayer = async (controls: MiniplayerControls) => {
  if (!controls.playerState.currentSong) {
    console.error('No song is currently playing');
    return;
  }

  try {
    if (pipWindow) {
      (pipWindow as Window & { close: () => void }).close();
      pipWindow = null;
      return;
    }

    // @ts-ignore
    if (!window.documentPictureInPicture) {
      console.error('Document Picture-in-Picture not supported');
      return;
    }

    // @ts-ignore
    const newPipWindow = await window.documentPictureInPicture.requestWindow({
      width: 320,
      height: 180,
    });
    pipWindow = newPipWindow;

    // Inject global CSS
    const globalStyleSheet = newPipWindow.document.createElement('link');
    globalStyleSheet.rel = 'stylesheet';
    globalStyleSheet.href = '/src/global.css';
    newPipWindow.document.head.appendChild(globalStyleSheet);

    // Inject theme CSS (default to Blue)
    const themeStyleSheet = newPipWindow.document.createElement('link');
    themeStyleSheet.rel = 'stylesheet';
    themeStyleSheet.href = '/src/themes/Blue/Blue.theme.css';
    newPipWindow.document.head.appendChild(themeStyleSheet);

    // Create root element for React
    const root = newPipWindow.document.createElement('div');
    newPipWindow.document.body.appendChild(root);

    // Render the React component into the PiP window using createRoot
    const rootElement = createRoot(root);
    rootElement.render(<MiniplayerContent controls={controls} />);

    newPipWindow.addEventListener('pagehide', () => {
      pipWindow = null;
    });
  } catch (err) {
    console.error('PiP failed:', err);
    pipWindow = null;
  }
};

interface MiniplayerProps {
  controls: MiniplayerControls;
}

const MiniplayerContent: React.FC<MiniplayerProps> = ({ controls }) => {
  const { playerState, togglePlayPause, playNext, playPrevious } = controls;
  const { currentSong, isPlaying } = playerState;

  useEffect(() => {
    const updatePlayButton = () => {
      const playBtn = document.getElementById('playBtn');
      if (playBtn) {
        playBtn.innerHTML = createIconSVG(isPlaying ? 'pause' : 'play');
        playBtn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
      }
    };

    const observer = new MutationObserver(() => updatePlayButton());
    observer.observe(document.body, { subtree: true, childList: true });

    return () => {
      observer.disconnect();
    };
  }, [isPlaying]);

  if (!currentSong) {
    return <div>No song is currently playing</div>;
  }

  return (
    <div className="miniplayer">
      <img src={currentSong.albumArt || ''} alt="Album Art" className="albumArt" />
      <div className="songInfo">
        <div className="songTitle">{currentSong.title}</div>
        <div className="artist">{currentSong.artist}</div>
      </div>
      <div className="controls">
        <button id="prevBtn" title="Previous track" onClick={playPrevious}>
          <span dangerouslySetInnerHTML={{ __html: createIconSVG('skipBack') }} />
        </button>
        <button
          id="playBtn"
          className="playBtn"
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlayPause}
        >
          <span dangerouslySetInnerHTML={{ __html: createIconSVG(isPlaying ? 'pause' : 'play') }} />
        </button>
        <button id="nextBtn" title="Next track" onClick={playNext}>
          <span dangerouslySetInnerHTML={{ __html: createIconSVG('skipForward') }} />
        </button>
      </div>
    </div>
  );
};

// Extend the type declaration to include the close method
interface Window {
  documentPictureInPicture?: {
    requestWindow: (options: { width: number; height: number }) => Promise<Window & { close: () => void }>;
  };
}