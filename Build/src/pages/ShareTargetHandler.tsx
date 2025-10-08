import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useShareTargetHandler(importAudioFiles: (files: File[]) => Promise<void>) {
  const { t } = useTranslation();

  useEffect(() => {
    // Only run on /upload route
    if (window.location.pathname !== "/upload") return;
    (async () => {
      try {
        const form = document.querySelector("form");
        let files: File[] = [];
        let title = "";
        let text = "";
        let url = "";
        if (form) {
          const formData = new FormData(form);
          title = (formData.get("title") as string) || "";
          text = (formData.get("text") as string) || "";
          url = (formData.get("url") as string) || "";
          for (const entry of formData.entries()) {
            const value = entry[1];
            if (value instanceof File && value.type.startsWith("audio/")) {
              files.push(value);
            }
          }
        }
        // Optionally toast extra params
        // if (title || text || url) {
        //   toast.info(`${title} ${text} ${url}`.trim());
        // }
        if (files.length > 0) {
          await importAudioFiles(files);
          toast.success(t("filePicker.successImport", { count: files.length }));
        } else {
          toast.error(t("filePicker.failedImport", { count: 0 }));
        }
      } catch (e) {
        toast.error(t("filePicker.failedImport", { count: 0 }));
      }
    })();
  }, [importAudioFiles, t]);
}
