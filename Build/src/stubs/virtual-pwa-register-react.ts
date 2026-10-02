import { useCallback, useState } from "react";

export function useRegisterSW() {
  const state = useState(false);

  const updateServiceWorker = useCallback(async (reloadPage?: boolean) => {
    if (reloadPage) {
      window.location.reload();
    }
  }, []);

  return {
    needRefresh: state,
    offlineReady: state,
    updateServiceWorker,
  };
}
