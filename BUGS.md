# Bugs

- [ ] fix responsive design for mobile/smaller devices
- [ ] fix some themes's visibility issues
- [x] some missed text that's supposed to be in i18n
    - `npm run i18n-check` or `node i18n-izer.js -I "visualizers"`

    - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
    - [ ] **Priority 2**: Status messages and user notifications
        - [ ] Processing status messages ("Processing X/Y songs...")
        - [ ] Success notifications (cache operations, theme applications)
        - [ ] File picker warnings (unsupported formats, skipped files)
    - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)