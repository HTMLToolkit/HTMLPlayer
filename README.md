# HTMLPlayer

---

<!-- markdownlint-disable MD003 -->
<!-- markdownlint-disable MD051 -->
[![All Contributors](https://img.shields.io/github/all-contributors/HTMLToolkit/HTMLPlayer?color=ee8449&style=flat-square)](#contributors)

---

![Alt](https://repobeats.axiom.co/api/embed/29883a69034cdc74979defb46de1f9a1de895288.svg "Repobeats analytics image")

---

<!-- markdownlint-disable MD033 -->
<a href="https://htmltoolkit.github.io/HTMLPlayer">
  <picture>
    <source srcset="https://chromeos.dev/badges/en/dark.svg" media="(prefers-color-scheme: dark)">
    <img src="https://chromeos.dev/badges/en/primary.svg" alt="Add to Chromebook"/>
  </picture>
</a>

## Overview

This is an HTML5 audio player that supports playlists, ID3 tag parsing for album and track art, and custom playlist art. It uses IndexedDB for persistence and the File API to get your music, allowing users to manage their music library locally. The player is designed with a clean and modern interface, featuring drag-and-drop reordering, rating buttons, and an 'Add Music' button for adding individual files (on Safari) or selecting directories.

## Features

- **Playlists**: Create, edit, and delete playlists. Each playlist can have its own artwork.
- **Tracks**: Add, delete, and reorder tracks within playlists. Tracks can be added by selecting individual files or entire directories.
- **ID3 Tag Support**: Reads and displays track names and artwork from audio files' ID3 tags.
- **Bulk Operations**: Bulk delete playlists and tracks with checkboxes.
- **Rating System**: Like or dislike tracks with rating buttons.
- **Shuffle and Repeat**: Shuffle and repeat playback options.
- **Volume Control**: Adjust volume with a slider.
- **Progress Bar**: Seek through the track with a progress bar.
- **Directory Selection**: Use the new `showDirectoryPicker` API to select and process entire directories of music files and use the normal 'File API' when it isn't supported.
- **Responsive Design**: Adapts to different screen sizes.

## Technologies Used

- **HTML5**: Structure and content.
- **CSS**: Styling and responsiveness.
- **JavaScript**: Application logic, IndexedDB, and audio controls.
- **IndexedDB**: For storing playlists, tracks, and settings.
- **jsmediatags**: A JavaScript library for reading ID3 tags from audio files.

## Setup

1. Open the GitHub Pages in your browser or download the Release for better offline usage
2. (only if you're offline) Open `HTMLPlayer.html` in a browser that supports the `showDirectoryPicker` API (e.g., recent versions of Chrome) and/or the `File API` (literally almost every browser). The offline version can be bookmarked and can use favicons, and the favicon is included in the zip.
3. Start adding music and creating playlists!

## Usage

- **Add Music**: Click the "Add Music" button to either select individual files or an entire directory of music.
- **Create Playlist**: Enter a name in the "New Playlist Name" field and click "Add Playlist".
- **Edit Playlist**: Click on a playlist name to view and edit its tracks.
- **Delete Playlist**: Click the "×" button next to a playlist name or use the bulk delete controls.
- **Add Track**: Select music files or directories as described above.
- **Delete Track**: Click the "×" button next to a track or use the bulk delete controls.
- **Reorder Tracks**: Drag and drop tracks within a playlist to reorder them.
- **Like/Dislike Tracks**: Use the rating buttons to like or dislike tracks.
- **Shuffle and Repeat**: Toggle shuffle and repeat playback with the respective buttons.
- **Volume Control**: Adjust the volume with the slider.
- **Seek Track**: Click and drag the progress bar to seek through the track.

## Gallery

| Desktop                                        | Desktop (with Custom Theme)                     | Desktop (Lyrics and Visualizer)                 | Desktop (Settings)                                   |
|------------------------------------------------|------------------------------------------------|------------------------------------------------|------------------------------------------------------|
| <img width="1858" height="927" alt="Screenshot 2025-10-09 1 35 11 PM" src="https://github.com/user-attachments/assets/fbea828f-8a9a-4065-90dd-54f327cbb95d" /> | <img width="1858" height="927" alt="Screenshot 2025-10-09 1 35 01 PM" src="https://github.com/user-attachments/assets/3772db50-28a3-41a8-b9ef-a93368f63af4" /> | <img width="1858" height="920" alt="Screenshot 2025-10-09 1 36 29 PM" src="https://github.com/user-attachments/assets/1b3360a3-8339-443f-85d2-38a0856928af" /> | <img width="1858" height="920" alt="image" src="https://github.com/user-attachments/assets/c68be0af-aa12-4737-b217-f8dbb29246d6" />
 |

| Mobile                                         | Mobile (with Custom Theme)                      | Mobile (Lyrics and Visualizer)                  | Mobile (Settings)                                     |
|------------------------------------------------|------------------------------------------------|------------------------------------------------|------------------------------------------------------|
| <img width="621" height="927" alt="Screenshot 2025-10-09 1 35 40 PM" src="https://github.com/user-attachments/assets/77e77be4-189a-41b3-88bf-ff4d70c2f466" /> | <img width="621" height="927" alt="Screenshot 2025-10-09 1 35 53 PM" src="https://github.com/user-attachments/assets/c5504243-8994-49b8-9246-807e6b8b78b9" /> | <img width="621" height="927" alt="Screenshot 2025-10-09 1 36 04 PM" src="https://github.com/user-attachments/assets/43dbe04c-0db8-49ec-b1ab-7caaf7258cdc" /> | <img width="623" height="927" alt="image" src="https://github.com/user-attachments/assets/26975e12-22a1-4e5a-93f8-31a4d8c806bd" />
 |

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TrickiyALT"><img src="https://avatars.githubusercontent.com/u/195377855?v=4?s=100" width="100px;" alt="Trickiy"/><br /><sub><b>Trickiy</b></sub></a><br /><a href="#ideas-TrickiyALT" title="Ideas, Planning, & Feedback">🤔</a> <a href="#bug-TrickiyALT" title="Bug reports">🐛</a> <a href="#design-TrickiyALT" title="Design">🎨</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Chromebook, ChromeOS, and the ChromeOS logo are trademarks of Google LLC.
