# Todo

## HTMLPlayer v2

- [ ] Open Search should open a global search modal overlay, similar to Spotlight Search

- [X?] making a homepage of sorts instead of directly songlist, so that it doesn't feel like you can't remove songs from all songs (even though like the name suggests, it's *All* Songs, and so you can't)

- [X] Add TS/TSX support and wallpapers for interactivity
  - [X] Start with built-in wallpapers using TS/TSX components, loaded via a wallpaper loader (similar to themeLoader)
  - [ ] Use sandboxed iframe with postMessage for API access to HTMLPlayer internals (playback state, settings, etc.)
  - [ ] Eventually have an NPM module (@htmlplayer/api) (using above postmessage system and validation/abstraction) for external wallpaper development, allowing user-created interactive wallpapers

- [ ] Add showDirectoryPicker API and ponyfil
  - but `showDirectoryPicker` is not supported in all browsers (e.g., Safari).

- [ ] platform-specific files
  - For example: split storage into:
    - Storage.web.ts
    - Storage.web.webkit.ts (for showDirectoryPicker)
    - Storage.desktop.ts
    - Storage.desktop.webkit.ts

  - with dynamic loader (use import.meta.glob to auto-discover)
    - detect platform + engine
    - load the correct file
    - maybe add helper like getPlatformFlavor() -> "desktop.webkit" etc

  - <https://github.com/LZS911/vite-plugin-conditional-compile>

- [ ] a queue
  - like a line of records behind album art?
  - smooth animation

- [ ] Share links (client-side)
  - Encode metadata in query/hash (`?artist=NellowTCS&title=Dashback`)
  - Prompt user to load local file if no `songFile` URL
    - `songFile` is for the future, so that I can have a simple way to share song files directly (files staying in a simple Cloudflare worker's KV or Durable Objects for 10-30 min or more probs (max like 2 days though))  
  - Export/import JSON playlists via sharing as well but url encoding limits are troublesome
  - Add "Copy Share Link" button to hide messy encoding

- [ ] Dynamic theming based on album art colors.
  - CSS backgrounds can be images, and album art is images

- [ ] Animated album art transitions, like fade/zoom/warp album art between songs.

- [ ] 🔼 I'll need to add some sort of quick guide and help menu or something to HTMLPlayer. (extensive and interactive ig)

- [ ] 🔼 custom theme builder with options for custom picture backgrounds

### Metadata

- [ ] More places to fetch lyrics from:
  - use [all2mp3](https://github.com/AllToMP3/alltomp3/blob/master/index.js) as reference
  - KSoft Lyrics API (<https://docs.ksoft.si/api/lyrics-api>)
  - Paroles (<http://paroles.net/>)
  - LyricsMania (<https://www.lyricsmania.com/>)
  - SweetsLyrics (<http://www.sweetslyrics.com>)
  - Spotify?? (requires api key though)

- [ ] Auto-fetch album art from MusicBrainz/Discogs if missing.
  - <https://github.com/Borewit/musicbrainz-api>

- [ ] metadata editor that saves to IndexedDB, or downloads file
  - <https://github.com/CharlesWiltgen/taglib-wasm> <- so underrated :O
  - ID3Editor (mine)

- [ ] Duplicate file detection (not just by title but checksum as well).

### LocalDataDB (workshop name)

- Basically all your data (which songs played, how much, etc. ) but local, and gets smarter the more you use HTMLPlayer

- [ ] PointPerSong: All songs are assigned a value, which is increased by inverse play count (to prevent overplaying), similarity to current song, time of day, season even if relevant, etc. and decreased by opposites. This is essentially like an weighted scoring system for which song to play next.
  - **freshness**
  - powers shuffle algorithm (will replace both Smart Shuffle and Shuffle)
  - [ ] Make a choose for me/auto start/something button so that htmlplayer auto chooses what to play first, and use a REALLY good algorithm using PointPerSong so that it's **perfect** every **single** time
    - Instead of picking the absolute highest score (which can be too predictable), use a Weighted Random Algorithm like Vose's Alias Method for peak
  - [ ] Play more/less often dropdown in SongActionsDropdown that manually influences PointPerSong

- [ ] a similar to Spotify Wrapped thing using this

## Either now or future versions

- [ ] Add subsonic API support

- [ ] 🔼 a Whisper based, fully in browser, Live Lyrics thing

- [ ] 🔼 (when HTMLPlayer is almost ready) add HTMLPlayer Store (below)

### HTMLPlayer Store

- [ ] a basic store for Themes, Icons, and Visualizers

- [ ] maybe some paid stuff
  - if paid stuff, then a backend is definitely needed
    - cloudflare worker to fetch stuff from something and some form of auth
      - maybe a personal link

- [ ] IndexedDB as storage for all three

- [ ] combination sets of icons and visualizers

#### UI

- [ ] a similar UI style to HTMLPlayer for sure
  - but maybe more white themed
  - clicking/tapping on name (ex NellowTCS) causes artist page to open

#### Dev Details

- [ ] need good APIs if I want this (not the current visualizer stuff 🫣)

## Future (most likely)

- [ ] Check out what music-metadata can do, and maybe implement those things
  - [ ] Custom Metadata Parsing (AKA ACAPlayer (lol aka aca)): access nonstandard or raw tags embedded in audio files
  - [ ] ReplayGain / Loudness Info: normalize or adjust playback volume based on track metadata
  - [ ] MusicBrainz Tags + ReplayGain using `music-metadata`: read MusicBrainz identifiers and volume normalization metadata

- [ ] Now Playing Screen (fullscreen, minimal UI)

- [ ] Compact Mode for tiny screens or embedded view.

- [ ] ReplayGain/volume normalization (maybe)

- [ ] Smart playlists (maybe)

- [ ] scrobbling using Last.fm or other services
  - maybe even a htmlplayer one :D

- [ ] Discord Integration
  - Implemented and theoretically works but requires Discord approval for Rich Presence API (via server) access. Need to submit Discord app for verification to enable it.
    - Asked Discord currently, they understandably said no.

- [ ] Equalizer Settings
    Issue: No audio customization options.
    Improvement: Add a equalizer using the Web Audio API or an external library.

## Done

### v2.0.0

- [X] A versioning system, linked with `send-beta-build.yml` and the `links.json` but different file, supporting both git commits (for beta/dev stuff) and github latest releases for normal people use
  - maybe this isn't needed (note to self, read *all* of the docs first): <https://vite-pwa-org.netlify.app/frameworks/react.html#react>
  - to migrate?: <https://vite-pwa-org.netlify.app/guide/unregister-service-worker.html#custom-selfdestroying-service-worker>
    - shouldn't clear cache handle this? ¯\_(ツ)_/¯

- [X] Make loading of songs, playlists, etc on load more staggered so that page doesn't freeze
  - Added staggered loading with configurable batch sizes

- [X] Add more to about menu

- [X] Loading a custom iconset tanks performance
  - Stabilized loadIcon reference with useRef pattern to prevent re-creation
  - Added cache key tracking to skip redundant fetches when icon set changes
  - Wrapped Icon component with React.memo to prevent unnecessary re-renders
  - Removed state updates from inside loadIcon callback

- [X] Gapless and crossfade are just broken, they just are
  - Fixed race condition: added crossfadeInitiatedRef guard to prevent multiple triggers from timeupdate
  - Fixed event listener cleanup: track and remove ended handler on cancelCrossfade
  - Fixed handleEnded during crossfade: properly defer to crossfade manager
  - Removed duplicate ended listener from nextAudio element
  - Fixed memory leak: revoke blob URLs after crossfade swap
  - Widened gapless trigger threshold from 50ms to 150ms with setTimeout for precision
  - Added AudioContext resume check before starting crossfade
  - Use crossfadeManager.getActiveElement() to determine current element after swap

- [X] Load all cover art more lazily and delayed for same reason as above
  - Added loading="lazy" and decoding="async" to album art images

- [X] fix drag and drop of songs not triggering sometimes

- [X] Fix share_target so that it supports both importing songs if music files supported by filePickerHelper (as a "polyfill" for file_handlers) and searching/sharing songs if text
  - Share target already supports both files and text/search queries

- [X] Fix sharing so that it just doesn't copy URL
  - Removed URL from share data for both songs and playlists

- [X] Make dragging songs not select song details in song list but also make sure we can select that stuff (prevent conflicts)

- [X] Slide out settings menu on close

- [X] Prevent/recover from Failed to play song so that HTMLPlayer and system don't get unsynced
  - (`The play() request was interrupted by a new load request. https://goo.gl/LdLk22`)

- [X] fix the UI of the 'Repeat Once' button

- [X] Can't move playlist to root unless I have another playlist in root

- [X] Center `Empty folder...`

- [X] Show SYLT first if both USLT and SYLT are available

- [X] fix visualizer missing left padding

- [X] prevent esc from closing lyrics overlay

- [X] In Home, show `1 Song` rather than `1 Songs`

- [X] On mobile, the Persistent Dropdowns are loaded inside the top bar, when they should be overlays

- [X] Visualizer -> audio-reactive backgrounds (basically picture background theme but actually visualizer and not theme) (can easily pipe through background-image or background via image) (aka visualizer as background?)

- [X] Speed up and fix song uploading being slow and a RAM hog (lagging)
  - fixed ram hog partially by only processing 1 at a time sequentially, but need to speed up
  - better system now
  - much faster now :D

- [X] theme Sonner toasts

- [X] make default visualizer Ocean Wave

- [X] Make settings UI much better and not just a list of *every single* settings option

- [X] the lyrics don't show embedded/USLT/SYLT lyrics properly

- [X] Fix visualizer overlay covering title, and top actions

- [X] the file_handler doesn't wait for our library to load so it adds before the songs are loaded and the song is lost

- [X] Disable Eruda by default

- [X] Memory issue and resulting crash when having a lot (300+) of songs on ChromeOS. The app should behave mostly the same no matter the amount of songs stored
  - suspect 2 reasons:
    - The IndexedDB is way too big to load in the larger it is, causing it to crash (edit: nope)
    - The smart caching is broken (<- edit: it was this and also caused below bug)
      - [X] The music files take up double the space they should?!

- [X] Pressing next, play, pause anywhere has a delay sometimes

- [X] Increase pitch range from -48 to 48

- [X] Songs speed up sometimes on the next song automatically

- [X] Clean up and improve Lyrics component

- [X] Fix Embedded Lyrics "not being saved" but they actually are

- [X] Fix repeated CacheManager erraneous logs

- [X] Speed up and fix song uploading being slow and a RAM hog (lagging)

- [X] fix some themes's visibility issues

- [X] Fix file_handler

- [X] Add more things to PWA manifest

- [X] Fix loading screen

- [X] Fix Icon Themes causing lag

- [X] Add `Don't show again? [ ]` to all modals

- [X] add htmlplayer to system right click menu (file_handler)

- [X] Design a custom icon abstraction layer inspired by i18n
  - [X] Must be easily configurable and swappable
  - [X] Must support icon libraries, images, and local SVGs
  - [X] Plan a theme registry file (`themename.icons.ts`) and a generic `<Icon>` component

- [X] Switch artist and album in SongList

- [X] combine buttons and options that do similar things

- [X] add responsive design for mobile/smaller devices

- [X] long text can break the UI (+ also cause scrolling horizontally) but I can reuse the scroll thing from song titles (maybe modularize that into a new component: ScrollText.tsx?)

- [X] Check out what music-metadata can do, and maybe implement those things
  - [X] Encoding & Format Details (for song info modal): get bitrate, duration, codec, sample rate, channels, and bit depth for each track
  - [X] Gapless Playback Info: use pre/post-silence info for seamless playback between tracks

- [X] Synced lyrics using id3v2 embedded lyrics (music-metadata has tons of stuff for this)
  - add support for SYLT and USLT and LRC

- [X] slow down/speed up tracks without changing pitch (DJ style 😎)
  - ~~[PitchShift](https://tonejs.github.io/docs/15.1.22/classes/PitchShift.html)~~
    - used custom approach instead

- [X] add Update HTMLPlayer button in settings.tsx that clears page cache (but not local storage or indexeddb) and clears i18n cache

- [X] replace white screen on load with cool "Loading HTMLPlayer..." thing

- [X] Make all 3-dot menus also open on right click

- [X] drag songs to playlists to move to playlist

- [X] Sort Tracks with drag-and-drop reordering
    Issue: Tracks cannot be sorted (e.g., by name, rating).
    Improvement: Add sorting options.

- [X] add folders for playlists.

- [X] make miniplayer `enterpictureinpicture` trigger be conditional so that init doesn't fail on Safari or other browsers that don't support that API

- [X] add eslint

- [X] replace artist column with album as artist already is there below song

- [X] fix some crossfade and gapless edge cases

- [X] Crossfade options

- [X] Gapless playback

- [X] Smart shuffle

- [X] Export/import playlists

- [X] animated themes (example)

- [X] picture backgrounds in themes (example)

- [X] Session restore

- [X] Keyboard shortcuts (settings, duh)

- [X] remove repeated names for the same thing in i18n

- [X] Miniplayer, which can either show the album art or a visualizer as the background
  - <https://developer.chrome.com/blog/automatic-picture-in-picture-media-playback>
  - SUPER USEFUL: <https://googlechrome.github.io/samples/media-session/audio.html>

- [X] add and use uppy
  - <https://github.com/transloadit/uppy?tab=readme-ov-file>
  - <https://uppy.io/docs/react/>

- [X] sanitize song title using DOMPurify

- [X] set default tempo to prevent crash

- [X] add sha to eruda import for safety.

- [X] use fontsource rather than network loading

- [X] Tempo Control

- [X] make PWA top bar dynamic
  - <https://css-tricks.com/meta-theme-color-and-trickery>
  
- [X] Use @web-scrobbler/metadata-filter for much better lyrics fetching

- [X] Add and use i18n
  - <https://medium.com/@tahnyybelguith/comprehensive-guide-to-i18n-internationalization-in-web-applications-d82abbd378af>

- [X] JSMediaTags wasn't awaited and so race conditions could happen

- [X] JSMediaTags wasn't the best as it's for mp3 (afaik) only, and music-metadata has embed lyrics support.

- [X] fix the lyrics popup not having the correct scrolling

- [X] Make top bar of MainContent separate and floating and  persistent and not a part of the Song Lists

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
  - more that i'm not listing

- [X] I forgot to uncache and recache the smart song caching after the next song, as currently, 4 songs are played, but the next song shows a `Failed to load resource: net::ERR_FILE_NOT_FOUND` error as it never is loaded in.

- [X] Smart Caching Algo: basically only the next and prev 2-4 songs are cached and the rest are dynamically fetched and cleared every song change

- [X] And I think that the album art is messed up by either the format, or that the title is in a diff language

- [X] ⏫ I originally, (in [v1](https://htmltoolkit.github.io/HTMLPlayer/)) just added a checkbox to the songs and you could select as many as you wanted. Reimplement this for v2.

- [X] 🔼 A "select all" button would solve the folder issue altogether as well

- [X] 🔽 I should probably add a hours counter for time

- [X] ⏫ HTMLPlayer batch upload is wayyyy too slow right now, so I'll have to test to find the sweet spot

- [X] Deleting or adding songs doesn't update the UI

- [X] window.confirm doesn't work in PWAs, so replace with custom dialog.

- [X] Lyrics Display
    Issue: No support for displaying lyrics.
    Improvement: Add a lyrics panel that fetches lyrics from lyrics.ovh or metadata.

- [X] Optimize IndexedDB Transactions
    Issue: Multiple simultaneous IndexedDB transactions can degrade performance.
    Improvement: Batch operations (e.g., saving multiple tracks) into a single transaction where possible.

- [X] Cache DOM Queries
    Issue: Repeated `document.getElementById` calls are inefficient.
    Improvement: Cache DOM elements in variables at initialization.

- [X] Visual Feedback for Loading States
    Issue: The "Adding..." and "Processing..." popups are basic and may not clearly indicate progress.
    Improvement: Add a progress bar or spinner to the popups for better feedback.

- [X] Improved Playlist Creation UX
    Issue: Users can create a playlist with an empty name or a duplicate name without clear feedback.
    Improvement: Add validation and feedback for playlist creation.

- [X] ARIA Attributes
    Issue: The interface lacks ARIA attributes for screen reader compatibility.
    Improvement: Add ARIA labels and roles to interactive elements.

- [X] Focus Management
    Issue: Keyboard focus is not clearly managed for interactive elements.
    Improvement: Ensure focus states are visible and logical tab order is maintained.

- [X] Logging for Debugging
    Issue: Debugging is difficult without structured logging.
    Improvement: Implement a logging system for development.

- [X] Use Constants for Repeated Values
    Issue: Hardcoded values (e.g., colors, sizes) are repeated throughout CSS and JS.
    Improvement: Define CSS custom properties and JS constants.

- [X] Comprehensive Error Handling
    Issue: Errors (e.g., database failures, file access issues) are minimally handled.
    Improvement: Add robust error handling with user feedback.

- [X] Test Audio Format Support
    Issue: Some browsers may not support certain audio formats (e.g., OGG).
    Improvement: Check format support and notify users.

- [X] Debounce Rapid Clicks on Controls
    Issue: Rapid clicks on buttons like play/pause, next, or previous can cause unintended behavior or race conditions.
    Improvement: Add a debounce mechanism to prevent multiple rapid clicks.

- [X] Lazy Load Playlist Art
    Issue: Loading all playlist images at once can slow down rendering, especially with many playlists or large images.
    Improvement: Use the `loading="lazy"` attribute for playlist and track images to defer offscreen image loading.

- [X] Handle Missing Track Files
    Issue: If a track file is missing or inaccessible, the player may fail silently.
    Improvement: Add error handling for file access.

- [X] Adaptive Progress Bar
    Issue: Progress bar width is not optimal for very wide screens.
    Improvement: Cap the maximum width more dynamically.
