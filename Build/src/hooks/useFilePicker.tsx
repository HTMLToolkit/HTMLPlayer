import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import ReactDOM from "react-dom/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/components/primitives/Dialog";
import { ThemeProvider } from "../ui/theming";
import { processFiles, type AudioFile } from "../platform/utils/fileValidation";

export type { AudioFile };

export function setProcessingState(processing: boolean) {
  if (processing) {
    window.addEventListener("beforeunload", (e) => {
      e.preventDefault();
      e.returnValue = "";
    });
  } else {
    window.removeEventListener("beforeunload", () => {});
  }
}

export function pickAudioFiles(): Promise<AudioFile[]> {
  return new Promise((resolve) => {
    const ReactUppyWrapper = () => {
      const { t } = useTranslation();
      const [uppy] = useState(
        () =>
          new Uppy({
            autoProceed: false,
            restrictions: {
              maxNumberOfFiles: null,
              allowedFileTypes: [
                ".mp3",
                ".wav",
                ".m4a",
                ".flac",
                ".aif",
                ".aiff",
                ".ogg",
                ".flo",
                "audio/*",
              ],
            },
          }),
      );

      const [open, setOpen] = useState(true);
      const [theme, setTheme] = useState<"light" | "dark">(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );

      useEffect(() => {
        const observer = new MutationObserver(() => {
          setTheme(
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light",
          );
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
        return () => observer.disconnect();
      }, []);

      useEffect(() => {
        const audioFiles: AudioFile[] = [];

        const onFileAdded = (file: any) => {
          const processed = processFiles([file.data as File]);
          if (processed.length === 0) {
            uppy.removeFile(file.id);
          } else {
            audioFiles.push(...processed);
          }
        };

        const onComplete = () => {
          resolve(audioFiles);
          setOpen(false);
        };

        uppy.on("file-added", onFileAdded);
        uppy.on("complete", onComplete);

        return () => {
          uppy.off("file-added", onFileAdded);
          uppy.off("complete", onComplete);
          uppy.cancelAll();
        };
      }, [uppy]);

      return (
        <Dialog
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              uppy.cancelAll();
              resolve([]);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("filePicker.selectAudioFiles")}</DialogTitle>
            </DialogHeader>
            <div key={theme} data-uppy-theme={theme}>
              <Dashboard
                uppy={uppy}
                proudlyDisplayPoweredByUppy={true}
                hideUploadButton={false}
                hideCancelButton={true}
                hideProgressDetails={false}
                note={t("filePicker.onlyAudioFiles")}
              />
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(
      <ThemeProvider>
        <ReactUppyWrapper />
      </ThemeProvider>,
    );
  });
}
