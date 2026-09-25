import { useEffect, useRef } from "react";
import {
  handleShareCache,
  handleShareTarget,
  type ShareTargetResult,
} from "../platform/integrations/shareTarget";

export function useShareTarget(
  onShareReceived: (result: ShareTargetResult) => void,
) {
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;

    async function processShare() {
      const cacheResult = await handleShareCache();
      if (cacheResult) {
        hasProcessedRef.current = true;
        onShareReceived(cacheResult);
        return;
      }

      const result = handleShareTarget();
      if (result && result.type !== "none") {
        hasProcessedRef.current = true;
        onShareReceived(result);

        const url = new URL(window.location.href);
        ["title", "text", "url"].forEach((p) => url.searchParams.delete(p));
        window.history.replaceState({}, "", url.toString());
      }
    }

    processShare();
  }, [onShareReceived]);
}
