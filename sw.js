// Service Worker mínimo: el navegador lo exige para ofrecer "Instalar" la web.
// Solo guarda el esqueleto de index.html (HTML, CSS, JS y fuentes) y siempre va
// primero a la red: la copia guardada se usa únicamente si no hay conexión, así
// nunca se muestra una versión vieja. No toca los datos del torneo (Firestore y
// el SDK de Firebase van a otros dominios) ni los archivos propios del panel.
const CACHE = 'mitre-league-shell-v1';
const SHELL = [
    './',
    'index.html',
    'estilo.css',
    'JAVASCRIPT/data.js',
    'JAVASCRIPT/almacen.js',
    'JAVASCRIPT/playoffs.js',
    'JAVASCRIPT/main.js',
    'JAVASCRIPT/auth-login.js',
    'JAVASCRIPT/datos-publicos.js',
    'JAVASCRIPT/datos-firestore.js',
    'JAVASCRIPT/firebase-sdk.js',
    'JAVASCRIPT/firebase-config.js',
    'JAVASCRIPT/registro-sw.js',
    'Recursos/Fuente/Michroma/Michroma-Regular.ttf',
    'Recursos/Fuente/Oswald/Oswald-VariableFont_wght.ttf'
].map((ruta) => new URL(ruta, self.registration.scope).href);

self.addEventListener('install', (event) => {
    // allSettled: si un archivo falla, el resto se guarda igual y el SW se instala.
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => Promise.allSettled(SHELL.map((url) =>
                fetch(url, { cache: 'reload' }).then((resp) => resp.ok && cache.put(url, resp)))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(claves
                .filter((clave) => clave.startsWith('mitre-league-') && clave !== CACHE)
                .map((clave) => caches.delete(clave))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const pedido = event.request;
    if (pedido.method !== 'GET') return;
    const url = new URL(pedido.url);
    const clave = url.origin + url.pathname;
    if (!SHELL.includes(clave)) return;

    event.respondWith(
        fetch(pedido)
            .then((resp) => {
                if (resp.ok && resp.type === 'basic') {
                    const copia = resp.clone();
                    caches.open(CACHE).then((cache) => cache.put(clave, copia));
                }
                return resp;
            })
            .catch(() => caches.match(clave).then((guardada) => guardada || Response.error()))
    );
});
