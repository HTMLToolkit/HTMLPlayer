# Bugs

- [ ] Songs speed up sometimes on the next song automatically
- [ ] Pressing next, play, pause anywhere has a delay sometimes
- [ ] Memory issue and resulting crash when having a lot (300+) of songs on ChromeOS. The app should behave mostly the same no matter the amount of songs stored
  - suspect 2 reasons:
    - The IndexedDB is way too big to load in the larger it is, causing it to crash
    - The smart caching is broken

- [ ] The app is using 400 MB RAM by default, but it should use more like 200 MB
- [ ] The music files take up double the space they should?!
- [ ] Gapless and crossfade are just broken, they just are
- [ ] Loading a custom iconset tanks performance
- [ ] fix drag and drop of songs not triggering sometimes
- [ ] fix that help menu
- [ ] fix the UI of the 'Repeat Once' button
- [ ] the lyrics don't show embedded/USLT/SYLT lyrics properly
- [ ] Fix share_target
- [ ] fix some themes' visibility issues
- [ ] Speed up and fix song uploading being slow and a RAM hog (lagging)
- [ ] Fix visualizer overlay covering title, and top actions

- [ ] some missed text that's supposed to be in i18n
  - Run `npm run i18n-check` or `node i18n-izer.cjs -I "visualizers"  --ignore-console`

  - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
  - [X] **Priority 2**: Status messages and user notifications
    - [X] Processing status messages ("Processing X/Y songs...")
  - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)
    - [ ] Success notifications (cache operations, theme applications)
    - [ ] File picker warnings (unsupported formats, skipped files)
