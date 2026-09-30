// Registra el Service Worker (sw.js, en la raíz) para que el celular ofrezca
// instalar la web como app. Lo usan index.html y admin.html.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch((error) => console.warn('No se pudo registrar el Service Worker:', error));
    });
}
