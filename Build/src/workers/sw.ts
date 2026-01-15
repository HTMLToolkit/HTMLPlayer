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
        try {
            const formData = await event.request.formData();
            const file = formData.get('audio');
            if (file) {
                const cache = await caches.open('incoming-shares');
                await cache.put('/shared-file', new Response(file));
            }
            const redirectUrl = new URL('/beta/HTMLPlayer/?share-received=true', self.location.origin);
            return Response.redirect(redirectUrl.href, 303);
        } catch (e) {
            // always return a response even on error
            return new Response('Failed to process share', { status: 400 });
        }
    },
    'POST'
);
