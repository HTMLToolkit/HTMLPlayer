# HTMLPlayer v2

A React and TypeScript powered music player with many extra features and an amazing UI.

## Todo

- [ ] 🔺 Make top bar of MainContent separate and floating and  persistent and not a part of the Song Lists
- [ ] Pitch/Tempo Control (settings)
- [ ] slow down/speed up tracks without changing pitch (DJ style 😎)
- [ ] Now Playing Screen (fullscreen, minimal UI)
- [ ] Compact Mode for tiny screens or embedded view.
- [ ] Animated album art transitions, like fade/zoom between songs.
- [ ] increase size of album art
- [ ] responsive design for mobile/smaller devices
- [ ] Gapless playback (settings)
- [ ] Crossfade options (settings)
- [ ] ReplayGain/volume normalization (maybe)
- [ ] Smart shuffle
- [ ] Smart playlists (maybe)
- [ ] scrobbling (settings)
- [ ] Export/import playlists
- [ ] Miniplayer, which can either show the album art or a visualizer as the background
- [ ] Dynamic theming based on album art colors.  (settings)
- [ ] Visualizer → audio-reactive backgrounds
- [ ] Drag-and-drop reordering
- [ ] Auto-fetch album art from MusicBrainz/Discogs if missing. 
- [ ] metadata editing.
- [ ] Duplicate file detection (not just by title but checksum). 
- [ ] Session restore (settings)
- [ ] Keyboard shortcuts (settings, duh)
- [ ] add system right click menu
- [ ] fix the lyrics popup not having the correct scrolling
- [ ] fix some themes's visibility issues
- [ ] Themes
    - [ ] picture backgrounds
- [ ] maybe research way to have smooth zoom in and out, maybe override browser handler, check if someone did this already
- [ ] Synced lyrics using id3v2 embedded lyrics
- [ ] 🔼 I'll need to add some sort of quick guide and help menu or something to HTMLPlayer.
- [ ] add folders for playlists.
- [ ] ⬆️ a Whisper based, fully in browser,  
- [ ] **Keyboard Navigation**

  **Issue**: The player lacks keyboard shortcuts for accessibility and convenience.

  **Improvement**: Add keyboard controls (e.g., space for play/pause, arrow keys for next/prev).
- [ ] **Prevent Duplicate Track Additions**

  **Issue**: Tracks with the same name can be added multiple times.

  **Improvement**: Let user skip or continue when they have duplicate tracks.
- [ ] **Sort Tracks**

  **Issue**: Tracks cannot be sorted (e.g., by name, rating).

  **Improvement**: Add sorting options.
- [ ] **Add showDirectoryPicker API and ponyfil**

  **Issue**: `showDirectoryPicker` missing but is not supported in all browsers (e.g., Safari).

  **Improvement**: Fallback to file input for unsupported browsers.

  **Implementation**:

  ```javascript
  document.getElementById("uploadBtn").onclick = async () => {
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        if (
          (await dirHandle.requestPermission({ mode: "read" })) === "granted"
        ) {
          saveSetting("musicDirectory", dirHandle);
          await processDirectoryWithPopups(dirHandle);
        }
      } catch (error) {
        console.error("Directory selection failed:", error);
        document.getElementById("fileInput").click();
      }
    } else {
      alert("Directory picker not supported. Please select files manually.");
      document.getElementById("fileInput").click();
    }
  };
  ```
- [ ] **Equalizer Settings**

  **Issue**: No audio customization options.

  **Improvement**: Add a equalizer using the Web Audio API or an external library.
- [ ] 🔼 (when HTMLPlayer is almost ready) add HTMLPlayer Store (below)

### HTMLPlayer Store

- [ ] a basic store for Themes, Icons, and Visualizers
- [ ] maybe some paid stuff
    - [ ] if paid stuff, then a backend is definitely needed
        - [ ] cloudflare worker to fetch stuff from something and some form of auth
            - [ ] maybe a personal link
- [ ] IndexedDB as storage for all three
- [ ] combination sets of icons and visualizers

#### UI

- [ ] a similar UI style to HTMLPlayer for sure
    - [ ] but maybe more white themed
    - [ ] image here
    - [ ] hovering on a photo:
        - [ ] image here
        - [ ] clicking/tapping on name (ex NellowTCS) causes artist page to open

#### Dev Details

- [ ] need good API if I want this (not the current visualizer stuff 🫣)

##### Icons

- [ ] in each file that uses icons, have, instead of lucide-react, have one file with a bunch of references

  ```json
  {
    "settingsIcon": "lucide-react.Gear",
    %% etc... %%
  }
  ```
- [ ] like i18n
- [ ] to be easily configurable and/or swappable
- [ ] can also link to images

##### Themes

- [ ] picture backgrounds
- [ ] have some preinstalled themes for sure

## Done:

- [x] use CSS vars <u>everywhere</u>
- [x] A visualizerLoader.tsx with `import.glob...` for preinstalled visualizers
- [x] **Theme Support**

  **Issue**: Only a dark theme is provided.

  **Improvement**: Add different themes using different styles.css files.
    - [x] have some preinstalled themes for sure
    - [x] system for theme switching.
    - [x] Red
    - [x] Orange
    - [x] Yellow
    - [x] Green (Verdant)
    - [x] Blue (default) (ofc it's done)
    - [x] Purple and Pink in one(Twilight)
    - [x] Purple and Orange (Lumenis)
    - [x] Grey, Black, and White in one (Monochrome)
- [x] I forgot to uncache and recache the smart song caching after the next song, as currently, 4 songs are played, but the next song shows a `Failed to load resource: net::ERR_FILE_NOT_FOUND` error as it never is loaded in.
- [x] And I think that the album art is messed up by either the format, or that the title is in a diff language
- [x] ⏫ I originally, (in [v1](https://htmltoolkit.github.io/HTMLPlayer/)) just added a checkbox to the songs and you could select as many as you wanted. Reimplement this for v2.
- [x] 🔼 A "select all" button would solve the folder issue altogether as well
- [x] 🔽 I should probably add a hours counter for time
- [x] ⏫ HTMLPlayer batch upload is wayyyy too slow right now, so I'll have to test to find the sweet spot
- [x] Deleting or adding songs doesn't update the UI
- [x] window.confirm doesn't work in PWAs, so replace with custom dialog.
- [x] **Lyrics Display**

  **Issue**: No support for displaying lyrics.

  **Improvement**: Add a lyrics panel that fetches lyrics from lyrics.ovh or metadata.

  **Implementation**:

  ```html
  <div id="lyricsPanel" style="display: none; padding: 10px;"></div>
  ```

  ```javascript
  async function fetchLyrics(trackName) {
    try {
      const response = await fetch(
        `https://api.lyrics.ovh/v1/artist/${trackName}`
      );
      const data = await response.json();
      document.getElementById("lyricsPanel").textContent =
        data.lyrics || "No lyrics found";
      document.getElementById("lyricsPanel").style.display = "block";
    } catch (error) {
      console.error("Lyrics fetch error:", error);
    }
  }
  ```
- [x] **Optimize IndexedDB Transactions**

  **Issue**: Multiple simultaneous IndexedDB transactions can degrade performance.

  **Improvement**: Batch operations (e.g., saving multiple tracks) into a single transaction where possible.
- [x] **Cache DOM Queries**

  **Issue**: Repeated `document.getElementById` calls are inefficient.

  **Improvement**: Cache DOM elements in variables at initialization.
- [x] **Visual Feedback for Loading States**

  **Issue**: The "Adding..." and "Processing..." popups are basic and may not clearly indicate progress.

  **Improvement**: Add a progress bar or spinner to the popups for better feedback.
- [x] **Improved Playlist Creation UX**

  **Issue**: Users can create a playlist with an empty name or a duplicate name without clear feedback.

  **Improvement**: Add validation and feedback for playlist creation.
- [x] **ARIA Attributes**

  **Issue**: The interface lacks ARIA attributes for screen reader compatibility.

  **Improvement**: Add ARIA labels and roles to interactive elements.
- [x] **Focus Management**

  **Issue**: Keyboard focus is not clearly managed for interactive elements.

  **Improvement**: Ensure focus states are visible and logical tab order is maintained.
- [x] **Logging for Debugging**

  **Issue**: Debugging is difficult without structured logging.

  **Improvement**: Implement a logging system for development.
- [x] **Use Constants for Repeated Values**

  **Issue**: Hardcoded values (e.g., colors, sizes) are repeated throughout CSS and JS.

  **Improvement**: Define CSS custom properties and JS constants.
- [x] **Comprehensive Error Handling**

  **Issue**: Errors (e.g., database failures, file access issues) are minimally handled.

  **Improvement**: Add robust error handling with user feedback.
- [x] **Test Audio Format Support**

  **Issue**: Some browsers may not support certain audio formats (e.g., OGG).

  **Improvement**: Check format support and notify users.

  **Implementation**:

  ```javascript
  function isAudioFormatSupported(format) {
    const audio = document.createElement("audio");
    return !!audio.canPlayType(format);
  }
  document.getElementById("fileInput").onchange = (e) => {
    const supportedFormats = ["audio/mp3", "audio/ogg", "audio/m4a"];
    Array.from(e.target.files).forEach((file) => {
      const format = `audio/${file.name.split(".").pop().toLowerCase()}`;
      if (
        !supportedFormats.includes(format) ||
        !isAudioFormatSupported(format)
      ) {
        alert(`Unsupported audio format: ${file.name}`);
        return;
      }
      // Proceed with file processing
    });
  };
  ```
- [x] **Debounce Rapid Clicks on Controls**

      **Issue**: Rapid clicks on buttons like play/pause, next, or previous can cause unintended behavior or race conditions.

      **Improvement**: Add a debounce mechanism to prevent multiple rapid clicks.
- [x] **Lazy Load Playlist Art**

  **Issue**: Loading all playlist images at once can slow down rendering, especially with many playlists or large images.

  **Improvement**: Use the `loading="lazy"` attribute for playlist and track images to defer offscreen image loading.
- [x] **Handle Missing Track Files**

  **Issue**: If a track file is missing or inaccessible, the player may fail silently.

  **Improvement**: Add error handling for file access.
- [x] **Adaptive Progress Bar**

  **Issue**: Progress bar width is not optimal for very wide screens.

  **Improvement**: Cap the maximum width more dynamically.