export type AudioFile = {
  file: File;
  name: string;
  size: number;
  type: string;
};

export type AudioMetadata = {
  title: string;
  artist: string;
  album: string;
  duration: number;
};

export function pickAudioFiles(): Promise<AudioFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      
      if (!files || files.length === 0) {
        resolve([]);
        return;
      }
      
      const audioFiles: AudioFile[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate audio file type
        if (!file.type.startsWith('audio/')) {
          console.warn(`Skipping non-audio file: ${file.name}`);
          continue;
        }
        
        audioFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type
        });
      }
      
      resolve(audioFiles);
    };
    
    input.onerror = () => {
      reject(new Error('File selection failed'));
    };
    
    input.oncancel = () => {
      resolve([]);
    };
    
    input.click();
  });
}

export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.onloadedmetadata = () => {
      // Extract metadata from filename as fallback
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      let title = fileName;
      let artist = 'Unknown Artist';
      let album = 'Unknown Album';
      
      // Try to parse filename patterns like "Artist - Title" or "Title - Artist"
      if (fileName.includes(' - ')) {
        const parts = fileName.split(' - ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts[1].trim();
        }
      }
      
      const metadata: AudioMetadata = {
        title,
        artist,
        album,
        duration: audio.duration || 0
      };
      
      URL.revokeObjectURL(url);
      resolve(metadata);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load audio metadata for ${file.name}`));
    };
    
    audio.src = url;
  });
}

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}