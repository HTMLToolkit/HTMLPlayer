# Bugs

- [ ] Either comment out or implement missing features:
  - [ ] Compact mode
  - [ ] Show Lyrics
  - [ ] Show Album Art
  - [ ] Toggle Lyrics
  - [ ] Toggle Visualizer

- [ ] Show SYLT first if both USLT and SYLT are available

- [ ] fix visualizer missing left padding

- [ ] prevent esc from closing lyrics overlay

- [ ] Lessen delays while reordering

- [ ] Slide out settings menu on close

- [ ] Prevent/recover from Failed to play song so that HTMLPlayer and system don't get unsynced
  - (`The play() request was interrupted by a new load request. https://goo.gl/LdLk22`)

- [ ] Make loading of songs, playlists, etc on load more staggered so that page doesn't freeze

- [ ] Load all cover art more lazily and delayed for same reason as above

- [ ] Use List Virtualization for song list so that having larger libraries doesn't cause lag on all songs
  - in short, loading only visible songs and not showing rest, but smartly loading the top and botton (for ex. predictively loading on scrolling)

- [ ] Allow drag and drop to playlist from Home view

- [ ] In Home, show `1 Song` rather than `1 Songs`

- [ ] Fix Help menu
  - On Home menu, when pressing Help, use different help guide
  - Disable keyboard shortcuts while in help menu to prevent conflict

- [ ] On mobile, the Persistent Dropdowns are loaded inside the top bar, when they should be overlays

- [ ] Fix top bar on mobile

- [ ] Add more to about menu

- [ ] The app is using 400 MB RAM by default, but it should use more like 200 MB
  - now 290 MB
  - around 320-330 MB when playing a song

- [ ] Loading a custom iconset tanks performance

- [ ] Gapless and crossfade are just broken, they just are

- [ ] fix drag and drop of songs not triggering sometimes

- [ ] fix the UI of the 'Repeat Once' button

- [ ] Fix share_target so that it supports both importing songs (as a "polyfill" for file_handlers) and searching/sharing songs

- [ ] fix some themes' visibility issues
  - light mode mostly fixed, re-check all

- [ ] Fix sharing so that it just doesn't copy URL

- [ ] Can't move playlist to root unless I have another playlist in root

- [ ] Center `Empty folder...`

- [ ] Make dragging songs not select song details in song list but also make sure we can select that stuff (prevent conflicts)

- [ ] proper pitch manipulation
  - [PitchShift](https://tonejs.github.io/docs/15.1.22/classes/PitchShift.html)?

- [ ] some missed text that's supposed to be in i18n
  - Run `npm run i18n-check` or `node i18n-izer.cjs -I "visualizers"  --ignore-console`

  - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
  - [X] **Priority 2**: Status messages and user notifications
    - [X] Processing status messages ("Processing X/Y songs...")
  - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)
    - [ ] Success notifications (cache operations, theme applications)
    - [ ] File picker warnings (unsupported formats, skipped files)
