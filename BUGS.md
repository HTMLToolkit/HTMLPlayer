# Bugs

- [ ] when the visualizer is open, something UI bugs out and transparency and it flickers sometimes
- [ ] switching from Home to All Songs and vice versa has a white flash
- [ ] use a proper equalizer component from the web or NPM that works with redux rather than that thing as it's... not a equalizer
- [ ] so like keeping track of state when user repeatedly does actions (like for example switching songs fast) does nothing and like weirds out state (the eternal problem with this appppppp ugh)
- [ ] Crossfade doesn't work

---

- [ ] Add tour to inline

- [ ] Either comment out or implement missing features:
  - [ ] Compact mode
  - [ ] Show Lyrics
  - [ ] Show Album Art
- [ ] Lessen delays while reordering

- [ ] Use List Virtualization for song list so that having larger libraries doesn't cause lag on all songs
  - in short, loading only visible songs and not showing rest, but smartly loading the top and bottom (for ex. predictively loading on scrolling)

- [ ] Allow drag and drop to playlist from Home view

- [ ] Fix Help menu
  - [ ] On Home menu, when pressing Help, use different help guide
  - [X] Disable keyboard shortcuts while in help menu to prevent conflict

- [ ] Fix top bar on mobile

- [ ] The app is using 400 MB RAM by default, but it should use more like 200 MB
  - now 290 MB
  - around 320-330 MB when playing a song

- [ ] fix some themes' visibility issues
  - light mode mostly fixed, re-check all

- [ ] some missed text that's supposed to be in i18n
  - Run `npm run i18n-check` or `node i18n-izer.cjs -I "visualizers"  --ignore-console`

  - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
  - [X] **Priority 2**: Status messages and user notifications
    - [X] Processing status messages ("Processing X/Y songs...")
  - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)
    - [ ] Success notifications (cache operations, theme applications)
    - [ ] File picker warnings (unsupported formats, skipped files)
