// ============================================================
// CAPA DE DATOS: Firestore <-> almacen (claves liga_*)
// ============================================================
// Cada clave liga_* vive en Firestore según ESQUEMA:
//   lista   → una colección, un documento por elemento (id = elemento.id);
//             _pos guarda el orden que tenía en el array.
//   mapa    → una colección, un documento {valor} por clave del objeto.
//   config  → un documento {valor} con el texto tal cual lo guarda el panel.
//   equipos → "equipos" (equipo + datos públicos de cada jugador) y
//             "equiposPrivado" (DNI, ficha médica y contactos: solo staff).
// Al guardar se compara contra el último estado conocido y se escribe solo
// lo que cambió, documento por documento: dos personas cargando cosas
// distintas a la vez no se pisan (antes se reescribía el array entero).
// El DNI de un jugador nunca llega a una colección pública: en jugadores,
// asistencia, tarjetas y sanciones va un código (HMAC del DNI con una sal que
// solo lee el staff). El panel lo vuelve a traducir a DNI al cargar, así que
// admin.js sigue viendo DNIs; la web pública solo compara códigos entre sí.

import { cargarFirestore } from './firebase-sdk.js';

const NIVEL = { publico: 0, staff: 1, coordinador: 2 };
const CAMPOS_PUBLICOS_JUGADOR = ['nombre', 'dorsal', 'instagram', 'foto', 'goles', 'amarillas', 'rojas'];
const CAMPOS_DNI_PARTIDO = ['asistentesLocal', 'asistentesVisitante', 'amarillasLocal', 'rojasLocal', 'amarillasVisitante', 'rojasVisitante'];
const PATRON_CODIGO = /^j[A-Za-z0-9_-]{16}$/;

// nivel = quién puede leerla. escribeStaff: el staff solo agrega (la Caja registra cada pago que marca).
// conjuntos: arrays sin repetidos que se fusionan con arrayUnion/arrayRemove (dos planilleros tildando a la vez).
const ESQUEMA = [
    { clave: 'liga_cicloSuperior', tipo: 'equipos', ciclo: 'superior', nivel: 'publico' },
    { clave: 'liga_cicloBasico', tipo: 'equipos', ciclo: 'basico', nivel: 'publico' },
    { clave: 'liga_partidos', tipo: 'lista', col: 'partidos', nivel: 'publico', dnis: CAMPOS_DNI_PARTIDO, conjuntos: ['asistentesLocal', 'asistentesVisitante'] },
    { clave: 'liga_sanciones', tipo: 'lista', col: 'sanciones', nivel: 'publico', dnis: ['jugadorId'] },
    { clave: 'liga_noticias', tipo: 'lista', col: 'noticias', nivel: 'publico' },
    { clave: 'liga_fotos_albumes', tipo: 'lista', col: 'albumes', nivel: 'publico' },
    { clave: 'liga_sponsors', tipo: 'lista', col: 'sponsors', nivel: 'publico' },
    { clave: 'liga_notificaciones', tipo: 'lista', col: 'notificaciones', nivel: 'publico' },
    { clave: 'liga_cruces_playoffs', tipo: 'lista', col: 'crucesPlayoffs', nivel: 'publico' },
    { clave: 'liga_grupos', tipo: 'config', col: 'config', id: 'grupos', nivel: 'publico' },
    { clave: 'liga_formato_torneo', tipo: 'config', col: 'config', id: 'formato', nivel: 'publico' },
    { clave: 'liga_playoffs_config', tipo: 'config', col: 'config', id: 'playoffs', nivel: 'publico' },
    { clave: 'liga_playoffs_publicados', tipo: 'config', col: 'config', id: 'playoffsPublicados', nivel: 'publico' },
    { clave: 'liga_avisos_staff', tipo: 'lista', col: 'avisosStaff', nivel: 'staff' },
    { clave: 'liga_tesoreria_partidos_v2', tipo: 'mapa', col: 'tesoreriaPartidos', nivel: 'staff' },
    { clave: 'liga_tesoreria_inscripciones', tipo: 'mapa', col: 'tesoreriaInscripciones', nivel: 'staff' },
    { clave: 'liga_valor_inscripcion', tipo: 'config', col: 'configStaff', id: 'valorInscripcion', nivel: 'staff' },
    { clave: 'liga_egresos', tipo: 'lista', col: 'egresos', nivel: 'coordinador' },
    { clave: 'liga_caja_movimientos', tipo: 'lista', col: 'cajaMovimientos', nivel: 'coordinador', escribeStaff: true },
    { clave: 'liga_calculadora_arancel', tipo: 'config', col: 'configCoordinador', id: 'calculadoraArancel', nivel: 'coordinador' }
];

let fs = null;
let rolActual = 'publico';
let claveHmac = null;
const codigoPorDni = new Map();
const dniPorCodigo = new Map();
// Último estado conocido de cada colección, tal como está en Firestore (con códigos, no DNIs).
const cache = new Map();
let colaEscritura = Promise.resolve();

function memoria(nombre) {
    if (!cache.has(nombre)) cache.set(nombre, new Map());
    return cache.get(nombre);
}

function puedeLeer(def) {
    return NIVEL[def.nivel] <= NIVEL[rolActual];
}

function puedeEscribir(def) {
    return rolActual !== 'publico' && (puedeLeer(def) || !!def.escribeStaff);
}

// ------------------------------------------------------------
// Códigos de DNI
// ------------------------------------------------------------
function base64url(bytes) {
    let s = '';
    bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function soloDigitos(dni) {
    return String(dni).replace(/\D/g, '') || String(dni);
}

async function prepararClaveDni() {
    const { db, fsSdk } = fs;
    const ref = fsSdk.doc(db, 'privado', 'claves');
    let snap = await fsSdk.getDoc(ref);
    if (!snap.exists()) {
        try {
            await fsSdk.setDoc(ref, { salDni: base64url(crypto.getRandomValues(new Uint8Array(32))) });
        } catch (error) {
            console.warn('[Datos] La sal ya la había creado otra sesión:', error);
        }
        snap = await fsSdk.getDoc(ref);
    }
    claveHmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(snap.data().salDni),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function codigoDe(dni) {
    if (dni === null || dni === undefined || dni === '') return dni;
    if (PATRON_CODIGO.test(String(dni))) return String(dni);
    const base = soloDigitos(dni);
    if (!codigoPorDni.has(base)) {
        const firma = await crypto.subtle.sign('HMAC', claveHmac, new TextEncoder().encode(base));
        codigoPorDni.set(base, 'j' + base64url(new Uint8Array(firma)).slice(0, 16));
    }
    return codigoPorDni.get(base);
}

function dniDe(valor) {
    return dniPorCodigo.has(valor) ? dniPorCodigo.get(valor) : valor;
}

async function codificarDnis(def, obj) {
    if (!def.dnis) return obj;
    const copia = { ...obj };
    for (const campo of def.dnis) {
        const v = copia[campo];
        if (Array.isArray(v)) copia[campo] = await Promise.all(v.map(codigoDe));
        else if (v !== undefined && v !== null && v !== '') copia[campo] = await codigoDe(v);
    }
    return copia;
}

function decodificarDnis(def, obj) {
    if (!def.dnis || rolActual === 'publico') return obj;
    const copia = { ...obj };
    def.dnis.forEach(campo => {
        const v = copia[campo];
        if (Array.isArray(v)) copia[campo] = v.map(dniDe);
        else if (v !== undefined && v !== null && v !== '') copia[campo] = dniDe(v);
    });
    return copia;
}

// ------------------------------------------------------------
// Lectura en tiempo real: Firestore → almacen
// ------------------------------------------------------------
// Cada colección se escucha con onSnapshot: la primera respuesta es la carga inicial
// (sin leer dos veces) y las siguientes traen lo que cambió.
// Web pública: cada cambio se vuelca al almacen y se avisa con 'liga:datos-actualizados'.
// Panel: los cambios NO se vuelcan solos. admin.js tiene su propia copia en memoria y,
// si quedara desfasada del último estado conocido, un guardado podría deshacer lo que
// cargó otra persona; solo se avisa (alCambiarAjeno) para actualizar cuando convenga.
const ESPERA_SERVIDOR_MS = 4000;

// Compara sin importar el orden de las claves (Firestore las devuelve ordenadas).
function textoEstable(v) {
    if (Array.isArray(v)) return '[' + v.map(textoEstable).join(',') + ']';
    if (v && typeof v === 'object') {
        return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + textoEstable(v[k])).join(',') + '}';
    }
    return JSON.stringify(v);
}

function ordenarPorPos(docs) {
    return docs
        .map(d => ({ id: d.id, datos: d.data() }))
        .sort((a, b) => (a.datos._pos || 0) - (b.datos._pos || 0));
}

function referenciaDe(def) {
    const { db, fsSdk } = fs;
    return def.tipo === 'config' ? fsSdk.doc(db, def.col, def.id) : fsSdk.collection(db, def.col);
}

// Resuelve con la primera respuesta; las siguientes van a alCambiar. Con esperarServidor
// (panel) no se conforma con la copia guardada en el dispositivo, que puede estar vieja,
// salvo que el servidor no conteste a tiempo (sin señal).
function escuchar(ref, alCambiar, esperarServidor) {
    return new Promise((resolve, reject) => {
        let resuelta = false;
        let vencido = false;
        let ultima = null;
        const listo = snap => { resuelta = true; resolve(snap); };
        const plazo = esperarServidor ? setTimeout(() => {
            vencido = true;
            if (!resuelta && ultima) listo(ultima);
        }, ESPERA_SERVIDOR_MS) : null;

        fs.fsSdk.onSnapshot(ref, { includeMetadataChanges: !!esperarServidor }, snap => {
            if (resuelta) { alCambiar(snap); return; }
            ultima = snap;
            if (!esperarServidor || vencido || !snap.metadata.fromCache) {
                clearTimeout(plazo);
                listo(snap);
            }
        }, error => {
            if (!resuelta) {
                resuelta = true;
                clearTimeout(plazo);
                reject(error);
            } else {
                console.error('[Datos] Se cortó la actualización en vivo:', error);
            }
        });
    });
}

function aplicarEquipos(defs, docsPub, docsPriv) {
    const privados = new Map();
    const memPriv = new Map();
    cache.set('equiposPrivado', memPriv);
    (docsPriv || []).forEach(d => {
        const jugadores = d.data().jugadores || {};
        privados.set(d.id, jugadores);
        memPriv.set(d.id, textoEstable({ jugadores }));
        Object.entries(jugadores).forEach(([codigo, j]) => {
            dniPorCodigo.set(codigo, j.dni);
            if (j.dni) codigoPorDni.set(soloDigitos(j.dni), codigo);
        });
    });

    const mem = new Map();
    cache.set('equipos', mem);
    const filas = ordenarPorPos(docsPub);
    filas.forEach(f => {
        const { _pos, ...datos } = f.datos;
        mem.set(f.id, { datos, pos: _pos || 0 });
    });

    defs.forEach(def => {
        const equipos = filas.filter(f => f.datos.ciclo === def.ciclo).map(f => {
            const { _pos, ciclo, jugadores = [], ...campos } = f.datos;
            const privEquipo = privados.get(f.id) || {};
            return {
                ...campos,
                jugadores: rolActual === 'publico' ? jugadores : jugadores.map(j => {
                    const p = privEquipo[j.dni];
                    if (!p) return j;
                    const { dni, ...resto } = j;
                    return { ...resto, ...p };
                })
            };
        });
        almacen.cargar(def.clave, JSON.stringify(equipos));
    });
}

function aplicarLista(def, snap) {
    const mem = new Map();
    cache.set(def.col, mem);
    const lista = ordenarPorPos(snap.docs).map(f => {
        const { _pos, ...datos } = f.datos;
        mem.set(f.id, { datos, pos: _pos || 0 });
        return decodificarDnis(def, datos);
    });
    almacen.cargar(def.clave, JSON.stringify(lista));
}

function aplicarMapa(def, snap) {
    const mem = new Map();
    cache.set(def.col, mem);
    const obj = {};
    snap.docs.forEach(d => {
        const valor = d.data().valor;
        obj[decodeURIComponent(d.id)] = valor;
        mem.set(d.id, textoEstable(valor));
    });
    almacen.cargar(def.clave, JSON.stringify(obj));
}

function aplicarConfig(def, snap) {
    if (!snap.exists()) return;
    const valor = snap.data().valor;
    memoria('config').set(def.col + '/' + def.id, valor);
    almacen.cargar(def.clave, valor);
}

function aplicar(def, snap) {
    if (def.tipo === 'lista') aplicarLista(def, snap);
    else if (def.tipo === 'mapa') aplicarMapa(def, snap);
    else aplicarConfig(def, snap);
}

// ¿La respuesta trae algo distinto de lo que este panel conoce? Sus propias escrituras coinciden
// con el último estado conocido (se actualiza al guardar), así que no disparan el aviso.
function difiereDeLoConocido(nombre, def, snap) {
    if (def && def.tipo === 'config') {
        return (snap.exists() ? snap.data().valor : undefined) !== memoria('config').get(def.col + '/' + def.id);
    }
    const mem = memoria(nombre);
    const esTexto = nombre === 'equiposPrivado' || (def && def.tipo === 'mapa');
    const textoDoc = nombre === 'equiposPrivado' ? d => textoEstable({ jugadores: d.data().jugadores || {} })
        : esTexto ? d => textoEstable(d.data().valor)
        : d => textoEstable(d.data());
    const textoConocido = esTexto ? v => v : v => textoEstable({ ...v.datos, _pos: v.pos });
    if (snap.docs.length !== mem.size) return true;
    return snap.docs.some(d => !mem.has(d.id) || textoConocido(mem.get(d.id)) !== textoDoc(d));
}

let clavesActualizadas = new Set();
let temporizadorAviso = null;
function avisarActualizacion(claves) {
    claves.forEach(c => clavesActualizadas.add(c));
    clearTimeout(temporizadorAviso);
    // Un guardado del panel puede tocar varios documentos seguidos: se avisa una sola vez.
    temporizadorAviso = setTimeout(() => {
        const detalle = [...clavesActualizadas];
        clavesActualizadas = new Set();
        document.dispatchEvent(new CustomEvent('liga:datos-actualizados', { detail: { claves: detalle } }));
    }, 300);
}

// rol: 'publico' (index.html), 'staff' o 'coordinador' (admin.html, ya logueado).
// alCambiarAjeno: solo en el panel, se llama cuando otra persona cargó algo.
export async function cargarDatosLiga(rol, alCambiarAjeno) {
    rolActual = rol;
    fs = await cargarFirestore();
    if (rol !== 'publico') await prepararClaveDni();

    const defs = ESQUEMA.filter(puedeLeer);
    const defsEquipos = defs.filter(d => d.tipo === 'equipos');
    const otras = defs.filter(d => d.tipo !== 'equipos');
    const esPanel = rol !== 'publico';
    // Última respuesta de cada escucha: si algo cambia mientras se termina la carga inicial,
    // la carga usa lo más nuevo en vez de pisarlo con la respuesta anterior.
    const vigente = {};
    let cargaHecha = false;
    const docsPrivados = () => (vigente.equiposPrivado ? vigente.equiposPrivado.docs : null);

    const alCambiar = (clave, col, def) => snap => {
        vigente[clave] = snap;
        if (!cargaHecha) return;
        if (esPanel) {
            if (alCambiarAjeno && difiereDeLoConocido(col, def, snap)) alCambiarAjeno();
        } else if (def) {
            aplicar(def, snap);
            avisarActualizacion([def.clave]);
        } else {
            aplicarEquipos(defsEquipos, vigente.equipos.docs, docsPrivados());
            avisarActualizacion(defsEquipos.map(d => d.clave));
        }
    };

    const escucha = (clave, ref, col, def) => escuchar(ref, alCambiar(clave, col, def), esPanel)
        .then(snap => { if (!vigente[clave]) vigente[clave] = snap; });

    const { db, fsSdk } = fs;
    await Promise.all([
        escucha('equipos', fsSdk.collection(db, 'equipos'), 'equipos', null),
        esPanel ? escucha('equiposPrivado', fsSdk.collection(db, 'equiposPrivado'), 'equiposPrivado', null) : null,
        ...otras.map(def => escucha(def.clave, referenciaDe(def), def.col, def))
    ]);
    // Los equipos primero: de equiposPrivado sale la traducción código → DNI que usan partidos y sanciones.
    aplicarEquipos(defsEquipos, vigente.equipos.docs, docsPrivados());
    otras.forEach(def => aplicar(def, vigente[def.clave]));
    cargaHecha = true;
}

// ------------------------------------------------------------
// Escritura: almacen → Firestore (solo lo que cambió)
// ------------------------------------------------------------
// ids = ids de esta clave que ya existen en Firestore. elementos = [{id, datos}] en el orden del array.
function planColeccion(col, mem, ids, elementos, conjuntos, ops) {
    const { fsSdk } = fs;
    const orden = elementos.map(e => e.id);

    let reordenar = false;
    let ultima = -Infinity;
    for (const id of orden) {
        if (!ids.has(id)) continue;
        if (mem.get(id).pos <= ultima) { reordenar = true; break; }
        ultima = mem.get(id).pos;
    }
    const pos = new Map();
    orden.forEach((id, i) => {
        if (reordenar) { pos.set(id, i * 1000); return; }
        if (ids.has(id)) { pos.set(id, mem.get(id).pos); return; }
        const anterior = i > 0 ? pos.get(orden[i - 1]) : undefined;
        let siguiente;
        for (let j = i + 1; j < orden.length; j++) {
            if (ids.has(orden[j])) { siguiente = mem.get(orden[j]).pos; break; }
        }
        if (anterior === undefined) pos.set(id, siguiente === undefined ? 0 : siguiente - 1000);
        else pos.set(id, siguiente === undefined ? anterior + 1000 : (anterior + siguiente) / 2);
    });

    elementos.forEach(({ id, datos }) => {
        const p = pos.get(id);
        // Lo que va a quedar en Firestore: coincide con datos salvo el orden de los conjuntos.
        const esperado = { ...datos };
        if (!ids.has(id)) {
            ops.push({ tipo: 'set', col, id, datos: { ...datos, _pos: p } });
        } else {
            const antes = mem.get(id);
            const cambios = {};
            const quitar = {};
            new Set([...Object.keys(antes.datos), ...Object.keys(datos)]).forEach(k => {
                const a = antes.datos[k];
                const n = datos[k];
                if (textoEstable(a) === textoEstable(n)) return;
                if (!(k in datos)) { cambios[k] = fsSdk.deleteField(); return; }
                if (conjuntos.includes(k) && Array.isArray(a) && Array.isArray(n)) {
                    const setA = new Set(a);
                    const setN = new Set(n);
                    const sacados = a.filter(x => !setN.has(x));
                    const puestos = n.filter(x => !setA.has(x));
                    if (sacados.length) quitar[k] = fsSdk.arrayRemove(...sacados);
                    if (puestos.length) cambios[k] = fsSdk.arrayUnion(...puestos);
                    // arrayRemove saca y arrayUnion agrega al final: así queda el array en el servidor.
                    esperado[k] = a.filter(x => setN.has(x)).concat(puestos);
                    return;
                }
                cambios[k] = n;
            });
            if (p !== antes.pos) cambios._pos = p;
            if (Object.keys(quitar).length) ops.push({ tipo: 'update', col, id, datos: quitar });
            if (Object.keys(cambios).length) ops.push({ tipo: 'update', col, id, datos: cambios });
        }
        mem.set(id, { datos: esperado, pos: p });
    });

    ids.forEach(id => {
        if (pos.has(id)) return;
        ops.push({ tipo: 'delete', col, id });
        mem.delete(id);
    });
}

function elementosConId(lista, clave) {
    const vistos = new Set();
    return lista.filter(e => {
        if (!e || e.id === undefined || e.id === null) {
            console.warn(`[Datos] ${clave}: elemento sin id, no se guarda.`, e);
            return false;
        }
        const id = String(e.id);
        if (vistos.has(id)) console.warn(`[Datos] ${clave}: id repetido ${id}, queda el último.`);
        vistos.add(id);
        return true;
    });
}

async function planLista(def, lista, ops) {
    const mem = memoria(def.col);
    const elementos = [];
    for (const e of elementosConId(lista, def.clave)) {
        elementos.push({ id: String(e.id), datos: await codificarDnis(def, e) });
    }
    planColeccion(def.col, mem, new Set(mem.keys()), elementos, def.conjuntos || [], ops);
}

async function planEquipos(def, lista, ops) {
    const mem = memoria('equipos');
    const memPriv = memoria('equiposPrivado');
    const ids = new Set([...mem].filter(([, e]) => e.datos.ciclo === def.ciclo).map(([id]) => id));

    const elementos = [];
    for (const eq of elementosConId(lista, def.clave)) {
        const id = String(eq.id);
        const { jugadores = [], ...campos } = eq;
        const publicos = [];
        const privados = {};
        for (let i = 0; i < jugadores.length; i++) {
            const j = jugadores[i];
            const codigo = j.dni ? await codigoDe(j.dni) : 'sd' + i;
            const pub = { dni: codigo };
            const priv = {};
            Object.entries(j).forEach(([k, v]) => {
                if (k === 'dni') priv.dni = v;
                else if (CAMPOS_PUBLICOS_JUGADOR.includes(k)) pub[k] = v;
                else priv[k] = v;
            });
            publicos.push(pub);
            privados[codigo] = priv;
            if (j.dni) dniPorCodigo.set(codigo, j.dni);
        }
        elementos.push({ id, datos: { ...campos, ciclo: def.ciclo, jugadores: publicos } });

        const textoPriv = textoEstable({ jugadores: privados });
        if (memPriv.get(id) !== textoPriv) {
            ops.push({ tipo: 'set', col: 'equiposPrivado', id, datos: { jugadores: privados } });
            memPriv.set(id, textoPriv);
        }
    }

    const nuevos = new Set(elementos.map(e => e.id));
    planColeccion('equipos', mem, ids, elementos, [], ops);
    ids.forEach(id => {
        if (nuevos.has(id)) return;
        ops.push({ tipo: 'delete', col: 'equiposPrivado', id });
        memPriv.delete(id);
    });
}

function planMapa(def, obj, ops) {
    const mem = memoria(def.col);
    const vigentes = new Set();
    Object.entries(obj).forEach(([k, v]) => {
        const id = encodeURIComponent(k);
        vigentes.add(id);
        const texto = textoEstable(v);
        if (mem.get(id) === texto) return;
        ops.push({ tipo: 'set', col: def.col, id, datos: { valor: v } });
        mem.set(id, texto);
    });
    [...mem.keys()].forEach(id => {
        if (vigentes.has(id)) return;
        ops.push({ tipo: 'delete', col: def.col, id });
        mem.delete(id);
    });
}

function planConfig(def, valor, ops) {
    const mem = memoria('config');
    const k = def.col + '/' + def.id;
    if (mem.get(k) === valor) return;
    ops.push({ tipo: 'set', col: def.col, id: def.id, datos: { valor } });
    mem.set(k, valor);
}

let ultimoAviso = 0;
function avisarError(error) {
    console.error('[Datos] No se pudo guardar en Firestore:', error);
    if (Date.now() - ultimoAviso < 15000) return;
    ultimoAviso = Date.now();
    alert('No se pudo guardar un cambio en el servidor' + (error && error.code ? ` (${error.code})` : '') +
        '.\n\nRecargá la página para ver los datos actuales antes de seguir cargando.');
}

// Cada escritura es independiente: si una falla (por ejemplo, otro borró ese partido), no arrastra a las demás.
// No se espera la confirmación del servidor: sin señal quedan en cola y Firestore las manda al volver.
function enviar(ops) {
    const { db, fsSdk } = fs;
    ops.forEach(op => {
        const ref = fsSdk.doc(db, op.col, op.id);
        const promesa = op.tipo === 'set' ? fsSdk.setDoc(ref, op.datos)
            : op.tipo === 'update' ? fsSdk.updateDoc(ref, op.datos)
            : fsSdk.deleteDoc(ref);
        promesa.catch(avisarError);
    });
}

async function guardar(def, valor) {
    const ops = [];
    if (def.tipo === 'equipos') await planEquipos(def, JSON.parse(valor) || [], ops);
    else if (def.tipo === 'lista') await planLista(def, JSON.parse(valor) || [], ops);
    else if (def.tipo === 'mapa') planMapa(def, JSON.parse(valor) || {}, ops);
    else planConfig(def, valor, ops);
    enviar(ops);
}

export function activarGuardado() {
    let enPreparacion = 0;
    almacen.alGuardar((clave, valor) => {
        const def = ESQUEMA.find(d => d.clave === clave);
        if (!def) {
            console.warn(`[Datos] ${clave} no está en el esquema: no se guarda en Firestore.`);
            return;
        }
        if (!puedeEscribir(def)) return;
        enPreparacion++;
        colaEscritura = colaEscritura.then(() => guardar(def, valor)).catch(avisarError).finally(() => { enPreparacion--; });
    });
    // Antes localStorage guardaba al instante; ahora preparar un cambio lleva unos milisegundos.
    window.addEventListener('beforeunload', (evento) => {
        if (enPreparacion > 0) {
            evento.preventDefault();
            evento.returnValue = '';
        }
    });
}
