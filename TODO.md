# Todo

## HTMLPlayer v2

- [ ] make PWA top bar dynamic
  - <https://css-tricks.com/meta-theme-color-and-trickery>
  
- [ ] add and use uppy
  - <https://github.com/transloadit/uppy?tab=readme-ov-file>
  - <https://uppy.io/docs/react/>

- [ ] Add and use i18n
  - <https://medium.com/@tahnyybelguith/comprehensive-guide-to-i18n-internationalization-in-web-applications-d82abbd378af>

- [ ] Crossfade options (settings)

- [ ] Pitch/Tempo Control (settings)

- [ ] slow down/speed up tracks without changing pitch (DJ style 😎)

- [ ] Gapless playback (settings)

- [ ] Smart shuffle

- [ ] Export/import playlists

- [ ] Miniplayer, which can either show the album art or a visualizer as the background
  - <https://developer.chrome.com/blog/automatic-picture-in-picture-media-playback>
  - SUPER USEFUL: <https://googlechrome.github.io/samples/media-session/audio.html>

- [ ] Dynamic theming based on album art colors.  (settings)

- [ ] Session restore (settings)

- [ ] Keyboard shortcuts (settings, duh)

- [ ] picture backgrounds in themes

- [ ] Synced lyrics using id3v2 embedded lyrics (music-metadata has tons of stuff for this)

- [ ] Check out what music-metadata can do, and maybe implement those things

- [ ] 🔼 I'll need to add some sort of quick guide and help menu or something to HTMLPlayer.

- [ ] add folders for playlists.

- [ ] ⬆️ a Whisper based, fully in browser, Live Lyrics thing

- [ ] Sort Tracks with drag-and-drop reordering

    **Issue**: Tracks cannot be sorted (e.g., by name, rating).
    **Improvement**: Add sorting options.

## Either now or future versions

- [ ] add htmlplayer to system right click menu

- [ ] Animated album art transitions, like fade/zoom between songs.

- [ ] Auto-fetch album art from MusicBrainz/Discogs if missing.

- [ ] metadata editing.

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

## Future (probably)

- [ ] Now Playing Screen (fullscreen, minimal UI)

- [ ] Compact Mode for tiny screens or embedded view.

- [ ] ReplayGain/volume normalization (maybe)

- [ ] Smart playlists (maybe)

- [ ] scrobbling (settings)

- [ ] Visualizer → audio-reactive backgrounds (basically picture background theme but actually visualizer and not theme)

- [ ] Duplicate file detection (not just by title but checksum as well).

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
  - example:
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

## Done

- [X] JSMediaTags wasn't awaited and so race conditions could happen

- [X] JSMediaTags wasn't the best as it's for mp3 (afaik) only, and music-metadata has embed lyrics support.

- [X] fix the lyrics popup not having the correct scrolling

- [X] 🔺 Make top bar of MainContent separate and floating and  persistent and not a part of the Song Lists

- [X] have some preinstalled themes for sure

- [X] make song name in player controls scroll and/or maybe wrap

- [X] increase size of album art

- [X] ~~ maybe research way to have smooth zoom in and out, maybe override browser handler, check if someone did this already ~~ impossible without reimplementing zoom in JS, which I don't want to do

- [X] use CSS vars everywhere

- [X] A visualizerLoader.tsx with `import.glob...` for preinstalled visualizers

- [X] Themes
  - [X] have some preinstalled themes for sure
  - [X] system for theme switching.
  - [X] Red
  - [X] Orange
  - [X] Yellow
  - [X] Green (Verdant)
  - [X] Blue (default) (ofc it's done)
  - [X] Purple and Pink in one(Twilight)
  - [X] Purple and Orange (Lumenis)
  - [X] Grey, Black, and White in one (Monochrome)

- [X] I forgot to uncache and recache the smart song caching after the next song, as currently, 4 songs are played, but the next song shows a `Failed to load resource: net::ERR_FILE_NOT_FOUND` error as it never is loaded in.

- [X] And I think that the album art is messed up by either the format, or that the title is in a diff language

- [X] ⏫ I originally, (in [v1](https://htmltoolkit.github.io/HTMLPlayer/)) just added a checkbox to the songs and you could select as many as you wanted. Reimplement this for v2.

- [X] 🔼 A "select all" button would solve the folder issue altogether as well

- [X] 🔽 I should probably add a hours counter for time

- [X] ⏫ HTMLPlayer batch upload is wayyyy too slow right now, so I'll have to test to find the sweet spot

- [X] Deleting or adding songs doesn't update the UI

- [X] window.confirm doesn't work in PWAs, so replace with custom dialog.

- [X] **Lyrics Display**
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

- [X] **Optimize IndexedDB Transactions**
    **Issue**: Multiple simultaneous IndexedDB transactions can degrade performance.
    **Improvement**: Batch operations (e.g., saving multiple tracks) into a single transaction where possible.

- [X] **Cache DOM Queries**
    **Issue**: Repeated `document.getElementById` calls are inefficient.
    **Improvement**: Cache DOM elements in variables at initialization.

- [X] **Visual Feedback for Loading States**
    **Issue**: The "Adding..." and "Processing..." popups are basic and may not clearly indicate progress.
    **Improvement**: Add a progress bar or spinner to the popups for better feedback.

- [X] **Improved Playlist Creation UX**
    **Issue**: Users can create a playlist with an empty name or a duplicate name without clear feedback.
    **Improvement**: Add validation and feedback for playlist creation.

- [X] **ARIA Attributes**
    **Issue**: The interface lacks ARIA attributes for screen reader compatibility.
    **Improvement**: Add ARIA labels and roles to interactive elements.

- [X] **Focus Management**
    **Issue**: Keyboard focus is not clearly managed for interactive elements.
    **Improvement**: Ensure focus states are visible and logical tab order is maintained.

- [X] **Logging for Debugging**
    **Issue**: Debugging is difficult without structured logging.
    **Improvement**: Implement a logging system for development.

- [X] **Use Constants for Repeated Values**
    **Issue**: Hardcoded values (e.g., colors, sizes) are repeated throughout CSS and JS.
    **Improvement**: Define CSS custom properties and JS constants.

- [X] **Comprehensive Error Handling**
    **Issue**: Errors (e.g., database failures, file access issues) are minimally handled.
    **Improvement**: Add robust error handling with user feedback.

- [X] **Test Audio Format Support**
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

  - [X] **Debounce Rapid Clicks on Controls**
      **Issue**: Rapid clicks on buttons like play/pause, next, or previous can cause unintended behavior or race conditions.
      **Improvement**: Add a debounce mechanism to prevent multiple rapid clicks.

  - [X] **Lazy Load Playlist Art**
      **Issue**: Loading all playlist images at once can slow down rendering, especially with many playlists or large images.
      **Improvement**: Use the `loading="lazy"` attribute for playlist and track images to defer offscreen image loading.

  - [X] **Handle Missing Track Files**
      **Issue**: If a track file is missing or inaccessible, the player may fail silently.
      **Improvement**: Add error handling for file access.

  - [X] **Adaptive Progress Bar**
      **Issue**: Progress bar width is not optimal for very wide screens.
      **Improvement**: Cap the maximum width more dynamically.
