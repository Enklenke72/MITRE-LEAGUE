// ============================================================
// LOGIN DE STAFF (index.html #pantalla-admin) — Firebase Auth real.
// ============================================================
// Acá solo se valida email/contraseña; el rol lo lee admin.html al entrar
// (JAVASCRIPT/auth-admin.js). El SDK se baja recién al tocar "Iniciar Sesión".

import { cargarFirebase } from "./firebase-sdk.js";

function mensajeError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'El email no tiene un formato válido.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Email o contraseña incorrectos.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos. Probá de nuevo en unos minutos.';
        case 'auth/network-request-failed':
            return 'No hay conexión. Revisá tu internet e intentá de nuevo.';
        default:
            return 'No se pudo iniciar sesión. Probá de nuevo.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login-staff');
    if (!form) return; // esta página no tiene el login (por ejemplo admin.html)

    const inputEmail = document.getElementById('login-email');
    const inputPassword = document.getElementById('login-password');
    const boton = form.querySelector('.btn-submit-admin');
    const elError = document.getElementById('login-staff-error');

    function mostrarError(mensaje) {
        if (!elError) return;
        elError.textContent = mensaje;
        elError.classList.add('visible');
    }

    function ocultarError() {
        if (!elError) return;
        elError.textContent = '';
        elError.classList.remove('visible');
    }

    function iniciarSesionStaff(email, password) {
        return cargarFirebase().then(({ auth, authSdk }) =>
            authSdk.signInWithEmailAndPassword(auth, email, password));
    }

    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        ocultarError();

        const email = inputEmail.value.trim();
        const password = inputPassword.value;
        if (!email || !password) {
            mostrarError('Completá tu email y tu contraseña.');
            return;
        }

        boton.disabled = true;
        boton.textContent = 'Ingresando...';

        iniciarSesionStaff(email, password)
            .then(() => {
                window.location.href = 'admin.html';
            })
            .catch((error) => {
                mostrarError(mensajeError(error));
            })
            .finally(() => {
                boton.disabled = false;
                boton.textContent = 'Iniciar Sesión';
            });
    });
});
