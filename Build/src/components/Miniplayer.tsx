// Miniplayer.tsx
import { useEffect, useRef, useState } from "react";
import styles from "./Miniplayer.module.css";
import { useMusicPlayer } from "../hooks/musicPlayerHook";
import { Play, Pause, X, PictureInPicture2 } from "lucide-react";

// Singleton handle for global PiP control
let miniplayerSingleton: { togglePiP: () => void } | null = null;
export const getMiniplayer = () => miniplayerSingleton;

export const Miniplayer = () => {
  const { playerState, togglePlayPause, isInitialized } = useMusicPlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>(0);
  const [isPiP, setIsPiP] = useState(false);

  // waveform drawing (continuous)
  useEffect(() => {
    if (!isInitialized || !playerState.analyserNode || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const analyser = playerState.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0ff";
      ctx.beginPath();

      let x = 0;
      const sliceWidth = canvas.width / bufferLength;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animationRef.current);
  }, [playerState.analyserNode, isInitialized]);

  // PiP video + album art
  useEffect(() => {
    if (!pipVideoRef.current) return;
    const video = pipVideoRef.current;

    // attach hidden video to DOM
    document.body.appendChild(video);
    video.style.position = "absolute";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.left = "-9999px";
    video.style.top = "-9999px";

    return () => {
      document.body.removeChild(video);
    };
  }, []);

  // update canvas stream whenever album art changes
  useEffect(() => {
    if (!pipVideoRef.current || !playerState.currentSong) return;
    const video = pipVideoRef.current;
    const img = new Image();
    img.src = playerState.currentSong.albumArt || "";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // capture canvas stream
      const stream = (canvas as any).captureStream(30); // 30fps
      video.srcObject = stream;
      video.muted = true;

      // play video silently
      video.play().catch((err) => console.error("PiP play error:", err));
    };
  }, [playerState.currentSong]);

  // PiP toggle
  const togglePiP = async () => {
    if (!pipVideoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await pipVideoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error("PiP failed:", err);
    }
  };

  // register singleton
  useEffect(() => {
    miniplayerSingleton = { togglePiP };
    return () => {
      miniplayerSingleton = null;
    };
  }, []);

  return (
    <div className={styles.miniplayer} style={{ display: "none" }}>
      <canvas ref={canvasRef} width={300} height={80} className={styles.canvas} />
      {playerState.currentSong?.albumArt && (
        <img src={playerState.currentSong.albumArt} alt="Album Art" className={styles.albumArt} />
      )}
      <div className={styles.controls}>
        <button onClick={togglePlayPause}>
          {playerState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button onClick={togglePiP}>
          {isPiP ? <X size={20} /> : <PictureInPicture2 size={20} />}
        </button>
      </div>
      <video ref={pipVideoRef} autoPlay muted />
    </div>
  );
};
