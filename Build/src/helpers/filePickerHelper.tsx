import parse from 'id3-parser';
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
  albumArt?: string;
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
  // Read file as ArrayBuffer for id3-parser
  let id3Tags: any = null;
  let albumArt: string | undefined = undefined;
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    // id3-parser expects a Buffer, which is available in Node.js, but in browser we use Uint8Array
    id3Tags = await parse(new Uint8Array(arrayBuffer));
    
    // Extract album art if available
    if (id3Tags && id3Tags.image) {
      const { data, format } = id3Tags.image;
      if (data) {
        // Convert image data to base64
        let base64String = '';
        for (let i = 0; i < data.length; i++) {
          base64String += String.fromCharCode(data[i]);
        }
        albumArt = `data:${format};base64,${btoa(base64String)}`;
      }
    }
  } catch (e) {
    // ignore, fallback to filename
    console.warn('Failed to parse ID3 tags:', e);
  }

  // Fallbacks
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  let title = fileName;
  let artist = 'Unknown Artist';
  let album = 'Unknown Album';

  if (id3Tags) {
    if (id3Tags.artist && typeof id3Tags.artist === 'string') artist = id3Tags.artist;
    if (id3Tags.title && typeof id3Tags.title === 'string') title = id3Tags.title;
    if (id3Tags.album && typeof id3Tags.album === 'string') album = id3Tags.album;
  } else if (fileName.includes(' - ')) {
    // Try to parse filename patterns like "Artist - Title" or "Title - Artist"
    const parts = fileName.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts[1].trim();
    }
  }

  // Get duration using Audio element
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  const duration = await new Promise<number>((resolve) => {
    audio.onloadedmetadata = () => {
      resolve(audio.duration || 0);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });

  return { title, artist, album, duration, albumArt };
}

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}