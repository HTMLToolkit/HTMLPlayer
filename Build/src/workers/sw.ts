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

            // Keep track of already cached files during this session
            const existingKeys = new Set(
                (await cache.keys()).map((key) => key.url.split("/").pop())
            );

            const files = [];
            for (const [value] of formData.entries()) {
                if (value instanceof File) {
                    const uniqueKey = `shared-file-${value.name}`;
                    if (!existingKeys.has(uniqueKey)) {
                        // Only cache if it's not already cached
                        await cache.put(uniqueKey, new Response(value, {
                            headers: { "x-file-name": value.name },
                        }));
                        files.push(uniqueKey);
                    }
                }
            }

            const redirectUrl = new URL(
                `/beta/HTMLPlayer/?share-received=true&files=${files.length}`,
                self.location.origin
            );
            return Response.redirect(redirectUrl.href, 303);
        } catch (e) {
            return new Response("Failed to process file share", { status: 400 });
        }
    },
    "POST"
);
