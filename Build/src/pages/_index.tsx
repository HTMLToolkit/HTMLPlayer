"use client";

import React, { useEffect } from "react";
import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { useMusicPlayer } from "../helpers/musicPlayerHook";
import styles from "./_index.module.css";

export default function IndexPage() {
  const musicPlayerHook = useMusicPlayer();

  useEffect(() => {
    // Set the document title
    document.title = "HTMLPlayer - Music Streaming Interface";

    // Set the meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "A modern music player interface with playlists, song management, and playback controls.");
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = "A modern music player interface with playlists, song management, and playback controls.";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className={styles.container}>
      <Sidebar musicPlayerHook={musicPlayerHook} />
      <div className={styles.mainSection}>
        <MainContent musicPlayerHook={musicPlayerHook} />
        <Player musicPlayerHook={musicPlayerHook} />
      </div>
    </div>
  );
}
