# HTMLPlayer

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

## Screenshots
<img width="1238" alt="Screenshot 2025-04-19 at 12 06 27 PM" src="https://github.com/user-attachments/assets/98e91ec0-3ce4-4613-8d6d-593d66412bd0" />
<img width="279" alt="Screenshot 2025-04-19 at 12 06 54 PM" src="https://github.com/user-attachments/assets/f363fadd-4055-463d-a855-04901539ba70" />

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
