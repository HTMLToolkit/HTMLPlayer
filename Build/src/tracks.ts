import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';
import { fileOpen } from 'browser-fs-access';
import { StoreApi, UseBoundStore } from 'zustand';
import { AppState } from './main';
import { saveTrack, loadTracks } from './storage';
import type { Track } from './main';
declare const jsmediatags: any;

let tracks: Track[] = [];
let bulkDeleteTracks = false;
let selectedTracks = new Set<string>();

function readTags(file: File): Promise<{ title?: string; art?: string }> {
  return new Promise((resolve, reject) => {
    jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const result: { title?: string; art?: string } = {};
        if (tag.tags.title) {
          result.title = tag.tags.title;
        }
        if (tag.tags.picture) {
          const { data, format } = tag.tags.picture;
          let base64String = '';
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          result.art = `data:${format};base64,${btoa(base64String)}`;
        }
        resolve(result);
      },
      onError: (error: unknown) => reject(error),
    });
  });
}

export function initTracks(store: UseBoundStore<StoreApi<AppState>>) {
  const tracksEl = document.getElementById('trackList') as HTMLElement;
  const addingPopup = document.getElementById('addingPopup') as HTMLElement;

  const renderTracks = async () => {
    tracks = await loadTracks();
    tracksEl.innerHTML = `<ul id="tracks">${tracks.map((track, index) => `
      <li draggable="true" data-index="${index}" data-id="${track.id}" class="${store.getState().currentTrack?.url === track.url ? 'active' : ''}">
        ${bulkDeleteTracks ? `<input type="checkbox" class="track-checkbox" ${selectedTracks.has(track.id) ? 'checked' : ''}>` : ''}
        <img src="${track.art || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMzMzMiIC8+PHBhdGggZD0iTTE2IDE2aDgiIHN0cm9rZT0iI2YxZjFmMSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiAvPjwvc3ZnPg=='}" loading="lazy">
        <span class="track-info">${DOMPurify.sanitize(track.name)}</span>
        <div class="rating-container">
          <button class="rating-btn" title="Like" data-rating="1">
            <svg viewBox="0 0 24 24" style="fill: ${track.rating === 1 ? '#2196F3' : '#f1f1f1'}">
              <polygon points="12,17.27 18.18,21 16.54,13.97 22,9.24 14.81,8.63 12,2 9.19,8.63 2,9.24 7.46,13.97 5.82,21"/>
            </svg>
          </button>
          <button class="rating-btn" title="Dislike" data-rating="-1">
            <svg viewBox="0 0 24 24" style="fill: ${track.rating === -1 ? '#e53935' : '#f1f1f1'}">
              <polygon points="12,6.73 5.82,3 7.46,10.03 2,14.76 9.19,15.37 12,22 14.81,15.37 22,14.76 16.54,10.03 18.18,3"/>
            </svg>
          </button>
        </div>
        ${!bulkDeleteTracks ? '<button class="delete-track">×</button>' : ''}
      </li>
    `).join('')}</ul>`;

    // Add event listeners
    const trackItems = tracksEl.querySelectorAll('li');
    trackItems.forEach(li => {
      // Play on click
      li.addEventListener('click', () => {
        if (!bulkDeleteTracks) {
          const track = tracks[parseInt(li.dataset.index || '-1')];
          if (track) {
            store.getState().setCurrentTrack(track);
            store.getState().setIsPlaying(true);
          }
        }
      });

      // Drag and drop
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', li.dataset.index || '');
      });
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '-1');
        const targetIndex = parseInt(li.dataset.index || '-1');
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          tracks.splice(targetIndex, 0, tracks.splice(draggedIndex, 1)[0]);
          renderTracks();
        }
      });

      // Rating buttons
      li.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const trackId = li.dataset.id;
          const rating = parseInt((btn as HTMLElement).dataset.rating || '0');
          if (trackId) {
            const track = tracks.find(t => t.id === trackId);
            if (track) {
              track.rating = track.rating === rating ? 0 : rating;
              await saveTrack(track);
              await renderTracks();
            }
          }
        });
      });

      // Delete button
      const deleteBtn = li.querySelector('.delete-track');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const trackId = li.dataset.id;
          if (trackId && confirm('Delete this track?')) {
            const index = tracks.findIndex(t => t.id === trackId);
            if (index !== -1) {
              await saveTrack({ ...tracks[index], deleted: true });
              tracks.splice(index, 1);
              await renderTracks();
            }
          }
        });
      }

      // Bulk delete checkbox
      const checkbox = li.querySelector('.track-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          const trackId = li.dataset.id;
          if (trackId) {
            if (checkbox.checked) {
              selectedTracks.add(trackId);
            } else {
              selectedTracks.delete(trackId);
            }
          }
        });
      }
    });
  };

  // File upload handler
  document.getElementById('uploadBtn')?.addEventListener('click', async () => {
    const files = await fileOpen({ mimeTypes: ['audio/*'], multiple: true });
    addingPopup.classList.remove('hidden');

    for (const file of files) {
      const id = uuidv4();
      const url = URL.createObjectURL(file);

      try {
        const tags = await readTags(file);
        await saveTrack({ 
          id, 
          url, 
          name: tags.title || file.name,
          art: tags.art
        });
      } catch (error) {
        console.warn('Failed to read metadata, falling back to file name:', error);
        await saveTrack({ id, url, name: file.name });
      }
    }

    await renderTracks();
    addingPopup.classList.add('hidden');
  });

  // Toggle bulk delete mode
  document.getElementById('toggleTrackBulk')?.addEventListener('click', () => {
    bulkDeleteTracks = !bulkDeleteTracks;
    selectedTracks.clear();
    renderTracks();
  });

  // Delete selected tracks
  document.getElementById('deleteSelectedTracks')?.addEventListener('click', async () => {
    if (selectedTracks.size === 0) {
      alert('No tracks selected.');
      return;
    }
    if (confirm('Delete selected tracks?')) {
      const trackIds = Array.from(selectedTracks);
      await Promise.all(trackIds.map(id => {
        const track = tracks.find(t => t.id === id);
        if (track) {
          return saveTrack({ ...track, deleted: true });
        }
        return Promise.resolve();
      }));
      tracks = tracks.filter(track => !trackIds.includes(track.id));
      selectedTracks.clear();
      await renderTracks();
    }
  });

  // Subscribe to store changes to update active track highlighting
  const unsubscribe = store.subscribe((state) => {
    const trackItems = tracksEl.querySelectorAll('li');
    trackItems.forEach(li => {
      const track = tracks[parseInt(li.dataset.index || '-1')];
      if (track) {
        li.classList.toggle('active', state.currentTrack?.url === track.url);
      }
    });
  });

  // Helper: process directory handle and add audio files
  async function processDirectoryHandle(dirHandle: any) {
    addingPopup.classList.remove('hidden');
    let count = 0;
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && (entry.name.endsWith('.mp3') || entry.name.endsWith('.ogg') || entry.name.endsWith('.m4a'))) {
        const file = await entry.getFile();
        const id = uuidv4();
        const url = URL.createObjectURL(file);
        try {
          const tags = await readTags(file);
          await saveTrack({ 
            id, 
            url, 
            name: tags.title || file.name,
            art: tags.art
          });
        } catch (error) {
          await saveTrack({ id, url, name: file.name });
        }
        count++;
        addingPopup.textContent = `Adding... ${count} entries`;
      }
    }
    await renderTracks();
    addingPopup.classList.add('hidden');
  }

  // Listen for the custom event from main.ts
  window.addEventListener('music-directory-selected', async (e: any) => {
    if (e.detail) {
      await processDirectoryHandle(e.detail);
    }
  });

  // Initial render
  renderTracks();
}
