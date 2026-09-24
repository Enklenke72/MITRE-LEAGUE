// ============================================================
// CONFIGURACIÓN DE FIREBASE — proyecto "mitre-league" (creado 24/09/2026)
// ============================================================
// El proyecto ya existe (Auth con Email/contraseña, Firestore Standard en
// southamerica-east1, Storage en plan Blaze). Estas claves no son secretas
// (van igual en el navegador); lo que protege los datos son las Security
// Rules, que todavía no están escritas.
//
// Esta web no usa npm ni bundler (ver CLAUDE.md, sección 8): el snippet que
// muestra la consola de Firebase asume `import "firebase/app"` vía npm, algo
// que un <script type="module"> del navegador no puede resolver solo. Acá
// hay que importar el SDK modular desde el CDN de Firebase
// (https://www.gstatic.com/firebasejs/.../firebase-app.js) en vez de esa
// ruta corta. Ese cableado todavía no está hecho (ver sección 11.3).

const firebaseConfig = {
    apiKey: "AIzaSyAd1enyYzTsetAv6UMgbAoc8v5MeGVURzc",
    authDomain: "mitre-league.firebaseapp.com",
    projectId: "mitre-league",
    storageBucket: "mitre-league.firebasestorage.app",
    messagingSenderId: "1046538157868",
    appId: "1:1046538157868:web:a241b659b0102c30dbf689"
};

export { firebaseConfig };
