# Bugs

- [ ] fix some themes's visibility issues
- [ ] some missed text that's supposed to be in i18n
    - `npm run i18n-check` or `node i18n-izer.js -I "visualizers"  --ignore-console`

    - [X] **Priority 1**: User-visible UI text (buttons, labels, user-facing error messages)
    - [X] **Priority 2**: Status messages and user notifications
        - [X] Processing status messages ("Processing X/Y songs...")
    - [ ] **Priority 3**: Debug/console logs (maybe leave in English or something)
        - [ ] Success notifications (cache operations, theme applications)
        - [ ] File picker warnings (unsupported formats, skipped files)