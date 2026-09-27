// Carga perezosa y compartida del SDK de Firebase (CDN, sin npm).
// Se usa import() dinámico y no import estático: un import estático de un
// <script type="module"> demora el DOMContentLoaded de la página hasta que
// responde el CDN.

import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
let promesaApp = null;
let promesaAuth = null;
let promesaFirestore = null;

// La web pública solo lee datos: no necesita bajar el módulo de login (Auth).
function cargarApp() {
    if (!promesaApp) {
        promesaApp = import(SDK + 'firebase-app.js')
            .then(appSdk => appSdk.initializeApp(firebaseConfig))
            .catch((error) => {
                promesaApp = null;
                throw error;
            });
    }
    return promesaApp;
}

export function cargarFirebase() {
    if (!promesaAuth) {
        promesaAuth = Promise.all([
            cargarApp(),
            import(SDK + 'firebase-auth.js')
        ]).then(([app, authSdk]) => {
            return { app, auth: authSdk.getAuth(app), authSdk };
        }).catch((error) => {
            promesaAuth = null;
            error.code = 'auth/network-request-failed';
            throw error;
        });
    }
    return promesaAuth;
}

// Con caché persistente: la lista de buena fe se usa en la cancha con mala señal.
// Lo ya leído (rol, datos del torneo) se sirve sin red y los cambios quedan en
// cola hasta que vuelve la señal.
export function cargarFirestore() {
    if (!promesaFirestore) {
        promesaFirestore = Promise.all([
            cargarApp(),
            import(SDK + 'firebase-firestore.js')
        ]).then(([app, fsSdk]) => ({
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
