# Bugs

- [ ] The app is using 400 MB RAM by default, but it should use more like 200 MB
  - now 290 MB

- [ ] Loading a custom iconset tanks performance
- [ ] Gapless and crossfade are just broken, they just are
- [ ] fix drag and drop of songs not triggering sometimes
- [ ] fix that help menu
- [ ] fix the UI of the 'Repeat Once' button
- [ ] Fix share_target
- [ ] fix some themes' visibility issues
- [?] Speed up and fix song uploading being slow and a RAM hog (lagging)
  - fixed ram hog partially by only processing 1 at a time sequentially, but need to speed up
  - better system now

- [ ] some missed text that's supposed to be in i18n
  - Run `npm run i18n-check` or `node i18n-izer.cjs -I "visualizers"  --ignore-console`

  - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
  - [X] **Priority 2**: Status messages and user notifications
    - [X] Processing status messages ("Processing X/Y songs...")
  - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)
    - [ ] Success notifications (cache operations, theme applications)
    - [ ] File picker warnings (unsupported formats, skipped files)
