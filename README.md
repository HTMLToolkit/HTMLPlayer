# HTMLPlayer v2

A React and TypeScript powered music player with many extra features and an amazing UI.

## Todo
### HTMLPlayer Tasks
- [ ] ⏫ HTMLPlayer batch upload is wayyyy too slow right now, so I'll have to test to find the sweet spot
- [ ] 🔼 I'll need to add some sort of quick guide or something to HTMLPlayer.
- [ ] And currently playlists are kinda like the folders currently, though I do plan to add folders for playlists.
- [ ] ⏫ I originally, (in [v1](https://htmltoolkit.github.io/HTMLPlayer/)) just added a checkbox to the songs and you could select as many as you wanted. Reimplement this for v2.
- [ ] 🔼 A "select all" button would solve the folder issue altogether as well
- [ ] 🔽 I should probably add a hours counter for time
- [ ] 🔼 (when HTMLPlayer is almost ready) add HTMLPlayer Store (below)

### Store
- [ ] a basic store for Themes, Icons, and Visualizers
- [ ] maybe some paid stuff
  - [ ] if paid stuff, then a backend is definitely needed
    - [ ] cloudflare worker to fetch stuff from something and some form of auth
      - [ ] maybe a personal link

#### UI
- [ ] a similar UI style to HTMLPlayer for sure
  - [ ] but maybe more white themed
  - [ ] image here
  - [ ] hovering on a photo:
    - [ ] image here
    - [ ] clicking/tapping on name (ex NellowTCS) causes artist page to open

#### Dev Details
- [ ] need good API or SDK if I want this (not the current visualizer stuff 🫣)
  - ##### Icons
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
  - ##### Themes
    - [ ] use CSS vars <u>everywhere</u>
    - [ ] have some preinstalled themes for sure
      - [ ] colors: Red, Orange, Yellow, Green, Blue (default), Purple, Pink, Grey, Black, maybe a custom one?
      - [ ] picture backgrounds
  - ##### Visualizers
    - [X] A visualizerLoader.tsx with `import.glob...` for preinstalled visualizers
- [ ] IndexedDB as storage for all three
- [ ] themes
- [ ] idk
