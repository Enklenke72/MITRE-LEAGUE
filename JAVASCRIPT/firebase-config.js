// ============================================================
// CONFIGURACIÓN DE FIREBASE — proyecto "mitre-league" (creado 24/09/2026)
// ============================================================
// El proyecto ya existe (Auth con Email/contraseña, Firestore Standard en
// southamerica-east1, plan gratuito Spark: sin Storage, las fotos van a
// Cloudinary). Estas claves no son secretas (van igual en el navegador); lo
// que protege los datos son las Security Rules (firestore.rules).
//
// Esta web no usa npm ni bundler (ver CLAUDE.md, sección 8): el SDK modular
// se importa desde el CDN de Firebase en firebase-sdk.js.

const firebaseConfig = {
    apiKey: "AIzaSyAd1enyYzTsetAv6UMgbAoc8v5MeGVURzc",
    authDomain: "mitre-league.firebaseapp.com",
    projectId: "mitre-league",
    storageBucket: "mitre-league.firebasestorage.app",
    messagingSenderId: "1046538157868",
    appId: "1:1046538157868:web:a241b659b0102c30dbf689"
};

export { firebaseConfig };
