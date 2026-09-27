// FIREBASE SIMULADO, SOLO PARA EL BANCO DE PRUEBAS (nunca va a la web real).
// Reemplaza a JAVASCRIPT/firebase-sdk.js en la copia de prueba del sitio: misma
// interfaz (cargarFirebase / cargarFirestore) y el subconjunto del SDK que usa
// la web. Los datos se guardan en localStorage['fakefs'] para sobrevivir a las
// recargas entre admin.html e index.html (localStorage.clear() los borra).
// Rechaza lo mismo que Firestore real (undefined, arrays anidados, documentos
// de más de 1 MB, updateDoc sobre un documento inexistente) y aplica las mismas
// reglas por rol que firestore.rules.
// Sesión y rol: localStorage['fake_rol'] = 'coordinador' (por defecto) | 'staff';
// localStorage['fake_sesion'] = 'no' para simular que no hay sesión.

const CLAVE = 'fakefs';
let store = JSON.parse(localStorage.getItem(CLAVE) || '{}');
const guardarStore = () => localStorage.setItem(CLAVE, JSON.stringify(store));
// Cada operación parte del estado guardado (como el servidor real): si otro iframe escribió recién,
// su cambio no se pierde. Los iframes del mismo origen comparten hilo, así que leer-aplicar-guardar es atómico.
const refrescar = () => { store = JSON.parse(localStorage.getItem(CLAVE) || '{}'); };

const rolFake = () => localStorage.getItem('fake_rol') || 'coordinador';
const haySesion = () => localStorage.getItem('fake_sesion') !== 'no';
const USUARIO = { uid: 'u-prueba', email: 'prueba@ejemplo.com' };

function error(code, msg) {
    const e = new Error(msg || code);
    e.code = code;
    return e;
}

// ---------------- Reglas (espejo de firestore.rules) ----------------
const PUBLICAS = ['equipos', 'partidos', 'sanciones', 'noticias', 'albumes', 'sponsors', 'notificaciones', 'crucesPlayoffs', 'config'];
const DE_STAFF = ['equiposPrivado', 'tesoreriaPartidos', 'tesoreriaInscripciones', 'configStaff', 'avisosStaff'];
const DE_COORDINADOR = ['egresos', 'configCoordinador'];

function permitido(accion, col, id) {
    const rol = haySesion() ? rolFake() : null;
    const staff = rol === 'staff' || rol === 'coordinador';
    const coord = rol === 'coordinador';
    if (col === 'usuarios') return accion === 'read' && !!rol && id === USUARIO.uid;
    if (PUBLICAS.includes(col)) return accion === 'read' || staff;
    if (DE_STAFF.includes(col)) return staff;
    if (col === 'privado' && id === 'claves') return (accion === 'read' || accion === 'create') && staff;
    if (DE_COORDINADOR.includes(col)) return coord;
    if (col === 'cajaMovimientos') return accion === 'create' ? staff : coord;
    return false;
}

function exigir(accion, col, id) {
    if (!permitido(accion, col, id)) {
        throw error('permission-denied', `Regla simulada: ${accion} en ${col}/${id || '*'} denegado para ${haySesion() ? rolFake() : 'visitante'}`);
    }
}

// ---------------- Validaciones de Firestore ----------------
const SENTINELA = '__sentinelaFake';

// permitirSentinelas: solo para el valor de un campo de primer nivel en updateDoc.
function validarValor(v, ruta, dentroDeArray, permitirSentinelas) {
    if (v === undefined) throw error('invalid-argument', `Valor undefined en ${ruta}`);
    if (v && typeof v === 'object' && v[SENTINELA]) {
        if (!permitirSentinelas) throw error('invalid-argument', `${v[SENTINELA]} fuera de updateDoc en ${ruta}`);
        (v.valores || []).forEach((x, i) => validarValor(x, `${ruta}<${i}>`, true, false));
        return;
    }
    if (Array.isArray(v)) {
        if (dentroDeArray) throw error('invalid-argument', `Array anidado en ${ruta}`);
        v.forEach((x, i) => validarValor(x, `${ruta}[${i}]`, true, false));
        return;
    }
    if (v && typeof v === 'object') {
        Object.entries(v).forEach(([k, x]) => {
            if (k === '') throw error('invalid-argument', `Nombre de campo vacío en ${ruta}`);
            validarValor(x, `${ruta}.${k}`, false, false);
        });
    }
}

function validarId(id) {
    if (!id || id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) {
        throw error('invalid-argument', `Id de documento inválido: "${id}"`);
    }
}

function validarTamano(col, id, datos) {
    const bytes = new Blob([JSON.stringify(datos)]).size;
    if (bytes > 1048487) throw error('invalid-argument', `${col}/${id} pesa ${bytes} bytes (tope 1 MB)`);
}

const copia = x => JSON.parse(JSON.stringify(x));

// ---------------- Escucha en vivo (onSnapshot) ----------------
// Los cambios de esta misma página avisan enseguida (como el SDK real con las escrituras
// locales); los de otra página del banco (otro iframe) llegan por el evento 'storage'.
const METADATOS = { fromCache: false, hasPendingWrites: false };
const oyentes = [];

function snapshotDe(ref) {
    if (ref.id !== undefined) {
        const d = (store[ref.col] || {})[ref.id];
        return { id: ref.id, metadata: METADATOS, exists: () => d !== undefined, data: () => (d === undefined ? undefined : copia(d)) };
    }
    const docs = Object.entries(store[ref.col] || {}).map(([id, d]) => ({ id, data: () => copia(d), metadata: METADATOS }));
    return { docs, size: docs.length, metadata: METADATOS };
}

function notificar(cols) {
    oyentes.filter(o => cols.includes(o.ref.col)).forEach(o => setTimeout(() => o.siguiente(snapshotDe(o.ref)), 0));
}

window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE && e.key !== null) return;
    const antes = store;
    store = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    const cols = new Set([...Object.keys(antes), ...Object.keys(store)]);
    notificar([...cols].filter(c => JSON.stringify(antes[c]) !== JSON.stringify(store[c])));
});

// ---------------- API de Firestore ----------------
const fsSdk = {
    doc: (db, col, id) => ({ col, id: String(id) }),
    collection: (db, col) => ({ col }),
    deleteField: () => ({ [SENTINELA]: 'deleteField' }),
    arrayUnion: (...valores) => ({ [SENTINELA]: 'arrayUnion', valores }),
    arrayRemove: (...valores) => ({ [SENTINELA]: 'arrayRemove', valores }),

    getDoc(ref) {
        return Promise.resolve().then(() => {
            refrescar();
            exigir('read', ref.col, ref.id);
            if (ref.col === 'usuarios') {
                const datos = { rol: rolFake(), nombre: 'Prueba ' + rolFake() };
                return { id: ref.id, exists: () => true, data: () => datos };
            }
            const d = (store[ref.col] || {})[ref.id];
            return { id: ref.id, exists: () => d !== undefined, data: () => (d === undefined ? undefined : copia(d)) };
        });
    },

    getDocs(ref) {
        return Promise.resolve().then(() => {
            refrescar();
            exigir('read', ref.col);
            const docs = Object.entries(store[ref.col] || {}).map(([id, d]) => ({ id, data: () => copia(d) }));
            return { docs, size: docs.length };
        });
    },

    onSnapshot(ref, ...args) {
        const [siguiente, alFallar] = typeof args[0] === 'function' ? args : args.slice(1);
        try {
            exigir('read', ref.col, ref.id);
        } catch (e) {
            setTimeout(() => alFallar && alFallar(e), 0);
            return () => {};
        }
        const oyente = { ref, siguiente };
        oyentes.push(oyente);
        setTimeout(() => siguiente(snapshotDe(ref)), 0);
        return () => { const i = oyentes.indexOf(oyente); if (i >= 0) oyentes.splice(i, 1); };
    },

    setDoc(ref, datos) {
        return Promise.resolve().then(() => {
            refrescar();
            validarId(ref.id);
            const existe = !!(store[ref.col] && store[ref.col][ref.id] !== undefined);
            exigir(existe ? 'update' : 'create', ref.col, ref.id);
            validarValor(datos, `${ref.col}/${ref.id}`, false, false);
            validarTamano(ref.col, ref.id, datos);
            (store[ref.col] = store[ref.col] || {})[ref.id] = copia(datos);
            guardarStore();
            notificar([ref.col]);
        });
    },

    updateDoc(ref, cambios) {
        return Promise.resolve().then(() => {
            refrescar();
            const actual = (store[ref.col] || {})[ref.id];
            exigir('update', ref.col, ref.id);
            if (actual === undefined) throw error('not-found', `updateDoc sobre ${ref.col}/${ref.id} que no existe`);
            Object.entries(cambios).forEach(([k, v]) => validarValor(v, `${ref.col}/${ref.id}.${k}`, false, true));
            const nuevo = copia(actual);
            Object.entries(cambios).forEach(([k, v]) => {
                if (k.includes('.')) throw error('invalid-argument', `El banco no simula rutas con punto: ${k}`);
                if (v && v[SENTINELA] === 'deleteField') delete nuevo[k];
                else if (v && v[SENTINELA] === 'arrayUnion') {
                    const base = Array.isArray(nuevo[k]) ? nuevo[k] : [];
                    v.valores.forEach(x => { if (!base.some(y => JSON.stringify(y) === JSON.stringify(x))) base.push(copia(x)); });
                    nuevo[k] = base;
                } else if (v && v[SENTINELA] === 'arrayRemove') {
                    const base = Array.isArray(nuevo[k]) ? nuevo[k] : [];
                    nuevo[k] = base.filter(y => !v.valores.some(x => JSON.stringify(x) === JSON.stringify(y)));
                } else nuevo[k] = copia(v);
            });
            validarTamano(ref.col, ref.id, nuevo);
            store[ref.col][ref.id] = nuevo;
            guardarStore();
            notificar([ref.col]);
        });
    },

    deleteDoc(ref) {
        return Promise.resolve().then(() => {
            refrescar();
            exigir('delete', ref.col, ref.id);
            if (store[ref.col]) delete store[ref.col][ref.id];
            guardarStore();
            notificar([ref.col]);
        });
    }
};

// ---------------- Auth ----------------
let oyente = null;
const authSdk = {
    onAuthStateChanged(auth, cb) {
        oyente = cb;
        setTimeout(() => cb(haySesion() ? USUARIO : null), 10);
        return () => {};
    },
    signOut() {
        localStorage.setItem('fake_sesion', 'no');
        setTimeout(() => oyente && oyente(null), 0);
        return Promise.resolve();
    },
    signInWithEmailAndPassword(auth, email, password) {
        if (password !== 'buena') return Promise.reject(error('auth/invalid-credential'));
        localStorage.removeItem('fake_sesion');
        return Promise.resolve({ user: USUARIO });
    }
};

export function cargarFirebase() {
    return Promise.resolve({ app: {}, auth: {}, authSdk });
}

export function cargarFirestore() {
    return Promise.resolve({ db: {}, fsSdk });
}
