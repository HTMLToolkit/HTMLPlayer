const SHARE_HANDLED_KEY = "last-shared-files";

export interface ShareTargetResult {
  files: File[];
  title?: string;
  text?: string;
  url?: string;
  type: "files" | "search" | "none";
}

function getHandledShares(): Set<string> {
  try {
    return new Set(
      JSON.parse(sessionStorage.getItem(SHARE_HANDLED_KEY) || "[]"),
    );
  } catch {
    return new Set();
  }
}

export function markHandledShares(files: File[]) {
  const handled = getHandledShares();
  files.forEach((f) => handled.add(`${f.name}:${f.size}`));
  sessionStorage.setItem(
    SHARE_HANDLED_KEY,
    JSON.stringify(Array.from(handled)),
  );
}

export function clearHandledShares() {
  sessionStorage.removeItem(SHARE_HANDLED_KEY);
}

export function handleShareTarget(): ShareTargetResult | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const title = urlParams.get("title") || undefined;
  const text = urlParams.get("text") || undefined;
  const url = urlParams.get("url") || undefined;

  if (title || text) {
    return { files: [], title, text, url, type: "search" };
  }

  return null;
}

export async function handleShareCache(): Promise<ShareTargetResult | null> {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("share-received") !== "true") return null;

  try {
    const cache = await caches.open("incoming-shares");
    const files: File[] = [];
    let i = 0;

    while (true) {
      const key = i === 0 ? "/shared-file" : `/shared-file-${i}`;
      const response = await cache.match(key);
      if (!response) break;

      const blob = await response.blob();
      const filenameRaw = response.headers.get("x-file-name");
      const filename = filenameRaw
        ? decodeURIComponent(filenameRaw)
        : `shared-audio${i ? "-" + i : ""}.mp3`;
      files.push(new File([blob], filename, { type: blob.type }));
      await cache.delete(key);
      i++;
    }

    if (files.length === 0) return null;

    const handled = getHandledShares();
    const newFiles = files.filter((f) => !handled.has(`${f.name}:${f.size}`));
    if (newFiles.length === 0) return null;

    markHandledShares(newFiles);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("share-received");
    window.history.replaceState({}, "", cleanUrl.toString());

    return { files: newFiles, type: "files" };
  } catch (e) {
    console.error("Failed to retrieve shared file from cache", e);
    return null;
  }
}
