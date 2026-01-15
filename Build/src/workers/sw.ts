import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

const handler = createHandlerBoundToURL("index.html");
const navigationRoute = new NavigationRoute(handler, {
  allowlist: [/^\/beta\/HTMLPlayer\//],
});
registerRoute(navigationRoute);

registerRoute(
  ({ url, request }) => {
    return url.pathname === "/beta/HTMLPlayer/" && request.method === "POST";
  },
  async ({ event }) => {
    try {
      const formData = await event.request.formData();
      const files = formData.getAll("audio").filter(Boolean);
      if (files.length) {
        const cache = await caches.open("incoming-shares");
        for (let i = 0; i < files.length; ++i) {
          const key = i === 0 ? "/shared-file" : `/shared-file-${i}`;
          await cache.put(
            key,
            new Response(files[i], {
              headers: {
                "x-file-name": encodeURIComponent(
                  files[i].name || `shared-audio${i ? "-" + i : ""}.mp3`,
                ),
                "content-type": files[i].type || "application/octet-stream",
              },
            }),
          );
        }
      } else {
        // fallback for older/single share implementations
        const file = formData.get("audio");
        if (
          file &&
          typeof file === "object" &&
          "name" in file &&
          typeof file.name === "string"
        ) {
          const cache = await caches.open("incoming-shares");
          await cache.put(
            "/shared-file",
            new Response(file, {
              headers: {
                "x-file-name": encodeURIComponent(
                  file.name || "shared-audio.mp3",
                ),
                "content-type": file.type || "application/octet-stream",
              },
            }),
          );
        } else if (file) {
          const cache = await caches.open("incoming-shares");
          await cache.put(
            "/shared-file",
            new Response(file, {
              headers: {
                "x-file-name": "shared-audio.mp3",
                "content-type": file.type || "application/octet-stream",
              },
            }),
          );
        }
      }
      const redirectUrl = new URL(
        "/beta/HTMLPlayer/?share-received=true",
        self.location.origin,
      );
      return Response.redirect(redirectUrl.href, 303);
    } catch (e: any) {
      return new Response("Failed to process share: " + (e?.message || e), {
        status: 400,
      });
    }
  },
  "POST",
);
