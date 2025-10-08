const selectedFiles = document.getElementById('selected-files');

if ('launchQueue' in window && typeof window.launchQueue.setConsumer === 'function') {
  window.launchQueue.setConsumer(async (launchParams) => {
    if (launchParams.files && launchParams.files.length) {
      selectedFiles.innerHTML = '';
      const fragment = document.createDocumentFragment();
      for (const fileHandle of launchParams.files) {
        let file;
        // Chrome/Edge: launchParams.files is array of FileSystemFileHandle
        if (fileHandle.getFile) {
          file = await fileHandle.getFile();
        } else {
          // Fallback: may be File object
          file = fileHandle;
        }
        const url = URL.createObjectURL(file);
        const div = document.createElement('div');
        // For audio files
        if (file.type.startsWith('audio/')) {
          const audio = document.createElement('audio');
          audio.src = url;
          audio.controls = true;
          div.appendChild(audio);
        } else if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.style.maxWidth = '400px';
          div.appendChild(img);
        } else {
          const p = document.createElement('p');
          p.textContent = `Opened file: ${file.name}`;
          div.appendChild(p);
        }
        fragment.appendChild(div);
      }
      selectedFiles.appendChild(fragment);
    }
  });
} else {
  selectedFiles.textContent = 'File Handling API not supported in this browser.';
}
