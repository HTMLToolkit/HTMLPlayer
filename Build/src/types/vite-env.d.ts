declare const __ENABLE_PWA_LOGIC__: boolean;
declare const __IS_SINGLE_FILE__: boolean;

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPicture {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  getWindow(): Window | null;
  readonly window: Window | null;
}

interface DocumentPictureInPictureEvent extends Event {
  readonly pipWindow: Window;
}

declare global {
  interface Document {
    pictureInPicture: DocumentPictureInPicture;
    addEventListener(
      type: "enterpictureinpicture",
      listener: (event: DocumentPictureInPictureEvent) => void,
    ): void;
    removeEventListener(
      type: "enterpictureinpicture",
      listener: (event: DocumentPictureInPictureEvent) => void,
    ): void;
  }

  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}
