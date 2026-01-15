import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

// Handle SPA navigation requests
const handler = createHandlerBoundToURL("index.html");
const navigationRoute = new NavigationRoute(handler, {
  allowlist: [/^\/beta\/HTMLPlayer\//],
});
registerRoute(navigationRoute);

// Handle POST requests for file sharing
registerRoute(
  ({ url, request }) => {
    return url.pathname === "/beta/HTMLPlayer/" && request.method === "POST";
  },
  async ({ event }) => {
    try {
      const formData = await event.request.formData();
      const cache = await caches.open("incoming-shares");

      // Process all files in the form data
      const files = [];
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          files.push({ file: value, key });
          await cache.put(
            `/shared-file-${value.name}`,
            new Response(value, {
              headers: {
                "x-file-name": value.name,
                "content-type": value.type,
              },
            }),
          );
        }
      }

      // Redirect to the app with an indicator for file sharing
      const redirectUrl = new URL(
        `/beta/HTMLPlayer/?share-received=true&files=${files.length}`,
        self.location.origin,
      );
      return Response.redirect(redirectUrl.href, 303);
    } catch (e) {
      // Always return a response even on error
      return new Response("Failed to process file share", { status: 400 });
    }
  },
  "POST",
);
