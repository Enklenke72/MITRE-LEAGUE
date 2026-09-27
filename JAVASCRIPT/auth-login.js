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
    const btnVerPassword = document.getElementById('btn-ver-password');

    const ICONO_OJO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const ICONO_OJO_TACHADO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7a10.4 10.4 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

    // Mostrar/ocultar la contraseña con el ojito: no manda nada al servidor, solo cambia el
    // type del input. Útil en el celular, donde un error de tipeo no se ve con los puntitos.
    if (btnVerPassword && inputPassword) {
        btnVerPassword.addEventListener('click', () => {
            const mostrando = inputPassword.type === 'text';
            inputPassword.type = mostrando ? 'password' : 'text';
            btnVerPassword.classList.toggle('mostrando', !mostrando);
            btnVerPassword.setAttribute('aria-pressed', String(!mostrando));
            btnVerPassword.setAttribute('aria-label', mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña');
            btnVerPassword.innerHTML = mostrando ? ICONO_OJO : ICONO_OJO_TACHADO;
        });
    }

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
                window.location.href = '/staff';
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
