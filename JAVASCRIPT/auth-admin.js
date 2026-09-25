// ============================================================
// ACCESO A admin.html — sesión de Firebase Auth + rol desde Firestore
// ============================================================
// El panel arranca tapado (body.auth-pendiente) hasta confirmar que hay
// sesión y que el usuario tiene un documento en usuarios/{uid} con
// rol "coordinador" o "staff". Sin sesión vuelve al login de index.html.
// Ojo: mientras los datos sigan en localStorage esto no protege los datos
// en sí (viven en el navegador); protege la entrada al panel.

import { cargarFirebase, cargarFirestore } from './firebase-sdk.js';

const CLASE_POR_ROL = { coordinador: 'rol-admin', staff: 'rol-staff' };
const NOMBRE_ROL = { coordinador: 'Coordinador', staff: 'Staff' };

const elMensaje = document.getElementById('auth-gate-mensaje');
const btnReintentar = document.getElementById('auth-gate-reintentar');
const btnSalirGate = document.getElementById('auth-gate-salir');
const btnSalirHeader = document.getElementById('btn-cerrar-sesion');
const elUsuario = document.getElementById('staff-sesion-usuario');

function bloquear(mensaje, accion) {
    document.body.classList.add('auth-pendiente');
    elMensaje.textContent = mensaje;
    btnReintentar.hidden = accion !== 'reintentar';
    btnSalirGate.hidden = accion !== 'salir';
}

function cerrarSesion() {
    cargarFirebase()
        .then(({ auth, authSdk }) => authSdk.signOut(auth))
        .catch(() => window.location.replace('index.html#pantalla-admin'));
}

async function verificarRol(usuario) {
    try {
        const { db, fsSdk } = await cargarFirestore();
        const snap = await fsSdk.getDoc(fsSdk.doc(db, 'usuarios', usuario.uid));
        const datos = snap.exists() ? snap.data() : null;
        const clase = datos && CLASE_POR_ROL[datos.rol];
        if (!clase) {
            bloquear(`Tu cuenta (${usuario.email}) todavía no tiene un rol asignado. Pedile al coordinador que te habilite.`, 'salir');
            return;
        }
        document.body.classList.remove('rol-admin', 'rol-staff');
        document.body.classList.add(clase);
        elUsuario.textContent = `${datos.nombre || usuario.email} · ${NOMBRE_ROL[datos.rol]}`;
        document.body.classList.remove('auth-pendiente');
    } catch (error) {
        if (error.code === 'permission-denied') {
            bloquear('No se pudo leer tu rol: permiso denegado. Revisá las reglas de seguridad de Firestore.', 'salir');
        } else {
            bloquear('No se pudo verificar tu rol. Revisá tu conexión y reintentá.', 'reintentar');
        }
    }
}

btnReintentar.addEventListener('click', () => window.location.reload());
btnSalirGate.addEventListener('click', cerrarSesion);
btnSalirHeader.addEventListener('click', cerrarSesion);

cargarFirebase()
    .then(({ auth, authSdk }) => {
        authSdk.onAuthStateChanged(auth, (usuario) => {
            if (!usuario) {
                window.location.replace('index.html#pantalla-admin');
                return;
            }
            verificarRol(usuario);
        });
    })
    .catch(() => bloquear('No se pudo conectar para verificar tu acceso. Revisá tu conexión y reintentá.', 'reintentar'));
