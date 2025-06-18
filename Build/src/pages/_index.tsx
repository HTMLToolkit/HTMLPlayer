"use client";

import React, { useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Sidebar } from "../components/Sidebar";
import { MainContent } from "../components/MainContent";
import { Player } from "../components/Player";
import { useMusicPlayer } from "../helpers/musicPlayerHook";
import styles from "./_index.module.css";



export default function IndexPage() {
  const musicPlayerHook = useMusicPlayer();

  return (
    <>
      <Helmet>
        <title>HTMLPlayer - Music Streaming Interface</title>
        <meta name="description" content="A modern music player interface with playlists, song management, and playback controls." />
      </Helmet>
      <div className={styles.container}>
        <Sidebar 
          musicPlayerHook={musicPlayerHook} 
        />
        <div className={styles.mainSection}>
          <MainContent musicPlayerHook={musicPlayerHook} />
          <Player musicPlayerHook={musicPlayerHook} />
        </div>
      </div>
    </>
  );
}