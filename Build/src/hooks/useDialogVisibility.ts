import { useState, useEffect } from "react";
import { dialogStorage } from "../platform/storage";

export function useDialogVisibility(dialogKey: string) {
  const [shouldShow, setShouldShow] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dialogKey) {
      dialogStorage.shouldShow(dialogKey).then((show) => {
        setShouldShow(show);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [dialogKey]);

  return { shouldShow, isLoading };
}
