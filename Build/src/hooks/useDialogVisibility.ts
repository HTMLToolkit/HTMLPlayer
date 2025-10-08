import { useState, useEffect } from "react";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";

export function useDialogVisibility(dialogKey: string) {
  const [shouldShow, setShouldShow] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dialogKey) {
      musicIndexedDbHelper.shouldShowDialog(dialogKey).then((show) => {
        setShouldShow(show);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [dialogKey]);

  return { shouldShow, isLoading };
}