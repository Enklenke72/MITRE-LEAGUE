// ============================================================
// ACCESO A admin.html — sesión de Firebase Auth + rol desde Firestore
// ============================================================
// El panel arranca tapado (body.auth-pendiente) hasta confirmar que hay
// sesión y que el usuario tiene un documento en usuarios/{uid} con
// rol "coordinador" o "staff". Sin sesión vuelve al login de index.html.
// Con el rol confirmado se cargan los datos del torneo y recién ahí arranca
// admin.js (evento 'liga:datos-listos').

import { cargarFirebase, cargarFirestore } from './firebase-sdk.js';
import { cargarDatosLiga, activarGuardado } from './datos-firestore.js';

const CLASE_POR_ROL = { coordinador: 'rol-admin', staff: 'rol-staff' };
const NOMBRE_ROL = { coordinador: 'Coordinador', staff: 'Staff' };

const elMensaje = document.getElementById('auth-gate-mensaje');
const btnReintentar = document.getElementById('auth-gate-reintentar');
const btnSalirGate = document.getElementById('auth-gate-salir');
const btnSalirHeader = document.getElementById('btn-cerrar-sesion');
const elUsuario = document.getElementById('staff-sesion-usuario');
const avisoCambios = document.getElementById('aviso-cambios-ajenos');

function mostrarAvisoCambiosAjenos() {
    avisoCambios.hidden = false;
}

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

let panelIniciado = false;

async function verificarRol(usuario) {
    let datos;
    try {
        const { db, fsSdk } = await cargarFirestore();
        const snap = await fsSdk.getDoc(fsSdk.doc(db, 'usuarios', usuario.uid));
        datos = snap.exists() ? snap.data() : null;
    } catch (error) {
        if (error.code === 'permission-denied') {
            bloquear('No se pudo leer tu rol: permiso denegado. Revisá las reglas de seguridad de Firestore.', 'salir');
        } else {
            bloquear('No se pudo verificar tu rol. Revisá tu conexión y reintentá.', 'reintentar');
        }
        return;
    }

    const clase = datos && CLASE_POR_ROL[datos.rol];
    if (!clase) {
        bloquear(`Tu cuenta (${usuario.email}) todavía no tiene un rol asignado. Pedile al coordinador que te habilite.`, 'salir');
        return;
    }
    if (panelIniciado) return;

    elMensaje.textContent = 'Cargando datos del torneo...';
    try {
        await cargarDatosLiga(datos.rol, mostrarAvisoCambiosAjenos);
    } catch (error) {
        console.error('[Acceso] No se pudieron cargar los datos:', error);
        bloquear(error.code === 'permission-denied'
            ? 'No se pudieron cargar los datos: permiso denegado. Revisá las reglas de seguridad de Firestore.'
            : 'No se pudieron cargar los datos del torneo. Revisá tu conexión y reintentá.', 'reintentar');
        return;
    }

    panelIniciado = true;
    document.body.classList.remove('rol-admin', 'rol-staff');
    document.body.classList.add(clase);
    elUsuario.textContent = `${datos.nombre || usuario.email} · ${NOMBRE_ROL[datos.rol]}`;
    activarGuardado();
    document.dispatchEvent(new Event('liga:datos-listos'));
    document.body.classList.remove('auth-pendiente');
}

btnReintentar.addEventListener('click', () => window.location.reload());
document.getElementById('btn-actualizar-cambios').addEventListener('click', () => window.location.reload());
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
