import { useCallback, useState } from "react";

// This is a no-op fallback implementation used for build targets where the
// PWA plugin is not enabled (e.g. the desktop / tauri build).
//
// We keep the same API surface as `virtual:pwa-register/react` so code can
// remain unchanged, but it will not register a service worker.
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
