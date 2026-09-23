// ============================================================
// LOGIN DE STAFF (index.html #pantalla-admin) — enganche listo,
// autenticación real pendiente de crear el proyecto de Firebase.
// ============================================================
// Hoy esto NO autentica de verdad: no hay proyecto de Firebase creado
// todavía (ver CLAUDE.md, sección 11, y Claude outputs/preparacion-login-firebase.md).
// Este archivo deja armado el enganche con el formulario para que, cuando
// el proyecto exista, activar el login real sea reemplazar la función
// iniciarSesionStaff de acá abajo por la llamada a Firebase Auth — no hace
// falta tocar el HTML ni el CSS de nuevo.
//
// Pasos para activarlo:
//   1. Crear el proyecto en Firebase y activar "Email/contraseña" en Authentication.
//   2. Completar JAVASCRIPT/firebase-config.js con las claves del proyecto.
//   3. Sumar el SDK de Firebase (Auth) y esta etiqueta a index.html con
//      type="module", e importar acá signInWithEmailAndPassword.
//   4. Crear, por cada persona del staff, su usuario en Authentication (con
//      su email) y un documento en la colección "usuarios" de Firestore
//      con su rol (staff / coordinador).

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

    // Reemplazar esta función cuando exista el proyecto de Firebase, por ejemplo:
    //   const cred = await signInWithEmailAndPassword(auth, email, password);
    //   const rolDoc = await getDoc(doc(db, 'usuarios', cred.user.uid));
    //   // guardar el rol (rolDoc.data().rol) y redirigir a admin.html
    // Hoy, sin Firebase, siempre devuelve este error para dejar claro que el
    // acceso todavía no está activado (no hay backend real detrás del botón).
    function iniciarSesionStaff(email, password) {
        return Promise.reject(new Error('El acceso todavía no está activado. Falta conectar el proyecto de Firebase (ver CLAUDE.md, sección 11).'));
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
            .catch((error) => {
                mostrarError(error.message || 'No se pudo iniciar sesión.');
            })
            .finally(() => {
                boton.disabled = false;
                boton.textContent = 'Iniciar Sesión';
            });
    });
});
