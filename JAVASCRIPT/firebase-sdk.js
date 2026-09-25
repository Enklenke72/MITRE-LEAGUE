// Carga perezosa y compartida del SDK de Firebase (CDN, sin npm).
// Se usa import() dinámico y no import estático: un import estático de un
// <script type="module"> demora el DOMContentLoaded de la página hasta que
// responde el CDN, y main.js / admin.js arrancan recién en ese evento.

import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
let promesaAuth = null;
let promesaFirestore = null;

export function cargarFirebase() {
    if (!promesaAuth) {
        promesaAuth = Promise.all([
            import(SDK + 'firebase-app.js'),
            import(SDK + 'firebase-auth.js')
        ]).then(([appSdk, authSdk]) => {
            const app = appSdk.initializeApp(firebaseConfig);
            return { app, auth: authSdk.getAuth(app), authSdk };
        }).catch((error) => {
            promesaAuth = null;
            error.code = 'auth/network-request-failed';
            throw error;
        });
    }
    return promesaAuth;
}

// Con caché persistente: la lista de buena fe se usa en la cancha con mala señal,
// y así un documento ya leído (por ejemplo el rol del usuario) se sirve sin red.
export function cargarFirestore() {
    if (!promesaFirestore) {
        promesaFirestore = Promise.all([
            cargarFirebase(),
            import(SDK + 'firebase-firestore.js')
        ]).then(([{ app }, fsSdk]) => ({
            db: fsSdk.initializeFirestore(app, {
                localCache: fsSdk.persistentLocalCache({ tabManager: fsSdk.persistentMultipleTabManager() })
            }),
            fsSdk
        })).catch((error) => {
            promesaFirestore = null;
            throw error;
        });
    }
    return promesaFirestore;
}
