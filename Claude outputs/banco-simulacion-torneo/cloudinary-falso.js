// Reemplaza JAVASCRIPT/cloudinary-config.js en la copia de prueba: simula la subida a Cloudinary sin salir a internet.
// Cada subida queda anotada en localStorage 'fakecloudinary' ({url, bytes, formato, preset, nube, dataURL}).
// localStorage.fake_cloudinary_falla = 'red' simula que no hay conexión; 'rechazo', que Cloudinary rechaza la subida.
// Las URLs devueltas apuntan a res.cloudinary.com: correr Edge con
// --host-resolver-rules="MAP res.cloudinary.com ~NOTFOUND, MAP api.cloudinary.com ~NOTFOUND"
// o cada imagen frena la corrida casi un minuto.
const CLOUDINARY_CONFIG = { cloudName: 'nube-de-prueba', uploadPreset: 'preset-de-prueba' };

(function () {
    const fetchReal = window.fetch.bind(window);
    window.fetch = async function (destino, opciones) {
        const m = /^https:\/\/api\.cloudinary\.com\/v1_1\/([^/]+)\/image\/upload$/.exec(String(destino));
        if (!m) return fetchReal(destino, opciones);
        const falla = localStorage.getItem('fake_cloudinary_falla');
        if (falla === 'red') throw new TypeError('Failed to fetch');
        if (falla === 'rechazo') {
            return new Response(JSON.stringify({ error: { message: 'Upload preset not found' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const archivo = String(opciones.body.get('file'));
        const coma = archivo.indexOf(',');
        const subidas = JSON.parse(localStorage.getItem('fakecloudinary') || '[]');
        const url = `https://res.cloudinary.com/${m[1]}/image/upload/v1/mitre-league/foto-${subidas.length + 1}.jpg`;
        const bytes = Math.round((archivo.length - coma - 1) * 0.75);
        subidas.push({ url, bytes, formato: archivo.slice(5, archivo.indexOf(';')), preset: opciones.body.get('upload_preset'), nube: m[1], dataURL: archivo });
        localStorage.setItem('fakecloudinary', JSON.stringify(subidas));
        return new Response(JSON.stringify({ secure_url: url, bytes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
})();
