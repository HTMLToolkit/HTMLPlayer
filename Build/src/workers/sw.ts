import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

const handler = createHandlerBoundToURL('index.html'); 
const navigationRoute = new NavigationRoute(handler, {
    allowlist: [/^\/beta\/HTMLPlayer\//], 
});
registerRoute(navigationRoute);

registerRoute(
    ({ url, request }) => {
        return url.pathname === '/beta/HTMLPlayer/' && request.method === 'POST';
    },
    async ({ event }) => {
        const formData = await event.request.formData();
        const file = formData.get('audio');

        if (file) {
            const cache = await caches.open('incoming-shares');
            await cache.put('/shared-file', new Response(file));
        }

        // Use self.location.origin to force a stable absolute URL
        const redirectUrl = new URL('/beta/HTMLPlayer/?share-received=true', self.location.origin);
        return Response.redirect(redirectUrl.href, 303);
    },
    'POST'
);
