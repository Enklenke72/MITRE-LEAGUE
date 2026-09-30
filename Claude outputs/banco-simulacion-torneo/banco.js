// Banco de pruebas: simula un torneo completo manejando admin.html y verifica index.html.
const salida = [];
let fallas = 0, pases = 0;
const out = s => salida.push(s);
function check(cond, msg, det) {
    if (cond) pases++; else fallas++;
    out((cond ? 'PASS ' : 'FAIL ') + msg + (det !== undefined ? '  → ' + JSON.stringify(det) : ''));
}
const alertas = [], confirms = [];
let respuestaConfirm = true, prints = 0;
const marco = document.getElementById('marco');
const esperar = ms => new Promise(r => setTimeout(r, ms));
const D = () => marco.contentDocument;
const W = () => marco.contentWindow;
// Desde la migración a Firestore (26/09/2026) los datos ya no están en localStorage: se leen del
// almacén de la página cargada (en admin.html, con DNIs; en index.html, la vista pública con códigos).
// Para correrlo, JAVASCRIPT/firebase-sdk.js de la copia de prueba se reemplaza por firebase-sdk-falso.js.
const LS = k => { const a = W() && W().almacen; return a ? JSON.parse(a.getItem(k)) : null; };
const docsFS = col => Object.keys((JSON.parse(localStorage.getItem('fakefs') || '{}'))[col] || {}).length;
// Desde el 27/09/2026 los goles no se guardan en el jugador: se cuentan desde los partidos (cada goleador lleva el DNI).
const golesDe = (nombreEquipo, dni) => (LS('liga_partidos') || []).filter(p => p.jugado).reduce((total, p) =>
    total + [['local', 'goleadoresLocal'], ['visitante', 'goleadoresVisitante']].reduce((suma, [lado, campo]) =>
        suma + (p[lado] === nombreEquipo ? (p[campo] || []).filter(g => g.id === dni).reduce((s, g) => s + g.cantidad, 0) : 0), 0), 0);
const ultimaAlerta = () => alertas[alertas.length - 1] || '';
// Desde el 29/09/2026 las fotos se suben a Cloudinary: en la copia de prueba JAVASCRIPT/cloudinary-config.js se reemplaza
// por cloudinary-falso.js, que anota cada subida en localStorage 'fakecloudinary' (ver ese archivo para correr Edge).
const subidaDe = url => JSON.parse(localStorage.getItem('fakecloudinary') || '[]').find(s => s.url === url);
const cantidadSubidas = () => JSON.parse(localStorage.getItem('fakecloudinary') || '[]').length;
const esUrlNube = v => /^https:\/\/res\.cloudinary\.com\/nube-de-prueba\//.test(String(v || ''));

// Borrar la base con un panel abierto es un cambio externo real (como borrar desde la consola) y le muestra el aviso:
// se descarga la página antes de vaciar el Firestore simulado.
async function vaciarFirestore() {
    await new Promise(res => { marco.onload = () => res(); marco.src = 'about:blank'; });
    localStorage.clear();
}
let avisosFalsos = 0; // con una sola persona cargando, el aviso "otra persona cargó cambios" nunca debería aparecer
async function cargar(url) {
    await esperar(150); // que terminen de salir las escrituras de la página anterior
    const aviso = D() && D().getElementById('aviso-cambios-ajenos');
    if (aviso && !aviso.hidden) avisosFalsos++;
    await new Promise(res => {
        marco.onload = () => {
            const w = marco.contentWindow;
            w.alert = m => alertas.push(String(m));
            w.confirm = m => { confirms.push(String(m)); return respuestaConfirm; };
            w.print = () => { prints++; };
            w.scrollTo = () => {};
            w.onerror = (m, s, l) => out('JS ERROR ' + m + ' @' + s + ':' + l);
            res();
        };
        marco.src = url;
    });
    // main.js / admin.js arrancan recién cuando llegan los datos ('liga:datos-listos').
    const esAdmin = /admin\.html/.test(url);
    for (let i = 0; i < 400; i++) {
        const d = D();
        const listo = esAdmin
            ? d.body && !d.body.classList.contains('auth-pendiente')
            : ((d.getElementById('contenedor-lista-notificaciones') || {}).innerHTML || '').trim() !== '';
        if (listo) break;
        if (i === 399) out('  (la página ' + url + ' no terminó de cargar los datos: ' + ((d.getElementById('auth-gate-mensaje') || {}).textContent || '') + ')');
        await esperar(25);
    }
    await esperar(30);
}
function el(id) { const e = D().getElementById(id); if (!e) out('NO EXISTE #' + id); return e; }
function setv(id, val, evento = true) {
    const e = el(id); if (!e) return;
    e.value = val;
    if (evento) { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
}
async function enviar(formId) {
    const f = el(formId);
    if (!f.checkValidity()) {
        const inval = [...f.elements].filter(x => !x.checkValidity()).map(x => x.id || x.className);
        out('  (form ' + formId + ' inválido para el navegador: ' + inval.join(',') + ')');
    }
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    for (let i = 0; i < 400 && [...f.querySelectorAll('button')].some(b => b.textContent === 'Subiendo foto...'); i++) await esperar(10);
    await esperar(2);
}
async function tab(target) { const b = D().querySelector(`.staff-tab-btn[data-target="${target}"]`); if (b) b.click(); await esperar(2); }

// ---------------- Datos del torneo ----------------
const SUP = { A: ['4to 1ra', '5to 2da', '6to 3ra', '7mo 1ra'], B: ['4to 2da', '5to 3ra', '6to 1ra', '7mo 2da'], C: ['4to 3ra', '5to 1ra', '6to 2da', '7mo 3ra'] };
const BAS = { A: ['1ro 1ra', '2do 2da', '3ro 1ra', '3ro 2da'] };
const NOMBRES = ['Tomás', 'Mateo', 'Benjamín', 'Thiago', 'Santino', 'Joaquín', 'Lautaro', 'Valentín', 'Bautista', 'Franco', 'Lucas', 'Nicolás', 'Ignacio', 'Facundo', 'Agustín', 'Gonzalo', 'Máximo', 'Ramiro', 'Julián', 'Bruno'];
const APELLIDOS = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina'];
let k = 0;
const planteles = {}; // nombreEquipo -> [{nombre,dni,dorsal,ficha}]
function armarPlantel(equipo, dorsales) {
    planteles[equipo] = dorsales.map(d => {
        k++;
        return { nombre: `${NOMBRES[k % 20]} ${APELLIDOS[(k * 7) % 20]}`, dni: String(45000000 + k * 137), dorsal: d, ficha: k % 3 !== 0 ? 'si' : 'no', conFamiliar: k % 4 === 0 };
    });
}
Object.values(SUP).flat().forEach(e => armarPlantel(e, e === '4to 1ra' ? [0, 5, 7, 9, 10, 99] : [1, 5, 7, 9, 10, 11]));
Object.values(BAS).flat().forEach(e => armarPlantel(e, [2, 4, 6, 8, 10]));
const jug = (equipo, dorsal) => planteles[equipo].find(j => j.dorsal === dorsal);

// Modelo esperado
const esperado = { goles: {}, pj: {}, amarillas: {}, rojas: {} };
const suma = (m, dni, n = 1) => { m[dni] = (m[dni] || 0) + n; };

// ---------------- Fase 0: arranque "limpio" con la semilla real de data.js ----------------
async function fase0() {
    out('\n=== FASE 0: arranque limpio con la semilla real (data.js sin tocar) ===');
    await vaciarFirestore();
    await cargar('admin.html?semilla=1');
    const partidosAlCargar = (LS('liga_partidos') || []).length;
    check(partidosAlCargar === 0, 'Abrir admin con localStorage vacío NO debería guardar los partidos del torneo anterior', { partidosGuardados: partidosAlCargar });
    await tab('sec-planteles');
    el('btn-sub-plantel-admin').click();
    setv('nuevo-equipo-ciclo', 'superior');
    setv('nuevo-equipo-nombre', 'Equipo Nuevo');
    setv('nuevo-equipo-grupo', 'A');
    await enviar('form-nuevo-equipo');
    const eqs = LS('liga_cicloSuperior') || [];
    check(eqs.length === 1, 'Crear el primer equipo del torneo nuevo debería dejar 1 solo equipo guardado', { equiposGuardados: eqs.length, ejemplos: eqs.slice(0, 3).map(e => e.nombre) });
    await vaciarFirestore();
    await cargar('index.html?semilla=1');
    const filas = D().querySelectorAll('.tbody-sup tr').length;
    out('  info: web pública con localStorage vacío y semilla real muestra ' + filas + ' filas en la tabla del Grupo A (equipos del torneo anterior).');
    await vaciarFirestore();
}

// ---------------- Fase 1: grupos, equipos y jugadores ----------------
async function fase1() {
    out('\n=== FASE 1: grupos, equipos y jugadores (data.js vaciado, como pide 11.1 punto 8) ===');
    await cargar('admin.html');
    await tab('sec-planteles');
    el('btn-sub-plantel-admin').click();
    respuestaConfirm = true;
    // Grupos: Superior A,B,C ; Básico A
    setv('gestor-grupos-ciclo', 'superior');
    for (const g of ['D', 'E']) { const b = D().querySelector(`.btn-borrar-grupo-item[data-grupo="${g}"]`); if (b) b.click(); await esperar(1); }
    setv('gestor-grupos-ciclo', 'basico');
    { const b = D().querySelector('.btn-borrar-grupo-item[data-grupo="B"]'); if (b) b.click(); }
    const grupos = LS('liga_grupos');
    check(JSON.stringify(grupos) === JSON.stringify({ superior: ['A', 'B', 'C'], basico: ['A'] }), 'Gestor de grupos deja Superior A-B-C y Básico A', grupos);

    // Equipos
    for (const [ciclo, estructura] of [['superior', SUP], ['basico', BAS]]) {
        for (const [grupo, equipos] of Object.entries(estructura)) {
            for (const nombre of equipos) {
                setv('nuevo-equipo-ciclo', ciclo);
                setv('nuevo-equipo-nombre', nombre);
                setv('nuevo-equipo-grupo', grupo);
                await enviar('form-nuevo-equipo');
                await esperar(3); // ids = Date.now()
            }
        }
    }
    const sup = LS('liga_cicloSuperior'), bas = LS('liga_cicloBasico');
    check(sup.length === 12 && bas.length === 4, 'Se crearon 12 equipos Superior y 4 Básico', { sup: sup.length, bas: bas.length });
    check(new Set([...sup, ...bas].map(e => e.id)).size === 16, 'Ids de equipo únicos');
    check(sup.every(e => SUP[e.grupo] && SUP[e.grupo].includes(e.nombre)), 'Cada equipo quedó en su grupo');
    setv('nuevo-equipo-ciclo', 'superior'); setv('nuevo-equipo-nombre', '4to 1RA '); setv('nuevo-equipo-grupo', 'A');
    await enviar('form-nuevo-equipo');
    check(/Ya existe/.test(ultimaAlerta()) && LS('liga_cicloSuperior').length === 12, 'Nombre de equipo repetido (mayúsculas/espacios) se rechaza', ultimaAlerta());

    // Jugadores
    el('btn-sub-plantel-jugadores').click();
    for (const [ciclo, estructura] of [['superior', SUP], ['basico', BAS]]) {
        setv('plantel-ciclo', ciclo);
        for (const nombre of Object.values(estructura).flat()) {
            setv('plantel-equipo-select', nombre);
            for (const j of planteles[nombre]) {
                setv('jugador-nombre', j.nombre, false);
                setv('jugador-dni', j.dni, false);
                setv('jugador-dorsal', String(j.dorsal), false);
                setv('jugador-instagram', j.dorsal === 10 ? 'ig_' + j.dni.slice(-4) : '', false);
                setv('jugador-ficha-medica', j.ficha, false);
                if (j.conFamiliar) {
                    setv('jugador-nacimiento', '2008-05-14', false);
                    setv('jugador-celular', '11 5555-' + j.dni.slice(-4), false);
                    setv('jugador-familiar-nombre', 'Madre de ' + j.nombre, false);
                    setv('jugador-familiar-parentesco', 'Madre', false);
                    setv('jugador-familiar-tel', '11 4444-' + j.dni.slice(-4), false);
                    setv('jugador-concurrir', 'Hospital Municipal', false);
                    setv('jugador-medico', 'Dra. Pérez', false);
                }
                await enviar('form-jugador');
            }
        }
    }
    const todos = [...LS('liga_cicloSuperior'), ...LS('liga_cicloBasico')];
    const totalJug = todos.reduce((a, e) => a + e.jugadores.length, 0);
    check(totalJug === 12 * 6 + 4 * 5, 'Se cargaron 92 jugadores', totalJug);
    const j0 = todos.find(e => e.nombre === '4to 1ra').jugadores.find(j => j.dorsal === 0);
    check(!!j0, 'Jugador con dorsal 0 guardado como número 0', j0 && j0.dorsal);
    const conFam = todos.flatMap(e => e.jugadores).filter(j => j.familiarTel);
    check(conFam.length > 0 && conFam.every(j => j.familiarNombre && j.concurrir), 'Fichas de emergencia guardadas', conFam.length);

    // Validaciones
    setv('plantel-ciclo', 'superior'); setv('plantel-equipo-select', '5to 2da');
    const antes = JSON.stringify(LS('liga_cicloSuperior'));
    setv('jugador-nombre', 'Repetido Dorsal', false); setv('jugador-dni', '30111222', false); setv('jugador-dorsal', '5', false);
    await enviar('form-jugador');
    check(/ya lo tiene otro jugador/.test(ultimaAlerta()), 'Dorsal repetido en el equipo se rechaza', ultimaAlerta());
    {   // Justo después de un rechazo, tocar OK/Debe de la ficha de un jugador de la tabla
        const jx = jug('5to 2da', 7);
        const antesF = LS('liga_cicloSuperior').find(e => e.nombre === '5to 2da').jugadores.find(j => j.dni === jx.dni).fichaMedica;
        D().querySelector(`.btn-toggle-ficha[data-dni="${jx.dni}"]`).click();
        const despF = LS('liga_cicloSuperior').find(e => e.nombre === '5to 2da').jugadores.find(j => j.dni === jx.dni).fichaMedica;
        check(antesF !== despF, 'Tras un alta rechazada, el botón OK/Debe de ficha de la tabla sigue guardando', { antes: antesF, despues: despF });
        if (antesF !== despF) D().querySelector(`.btn-toggle-ficha[data-dni="${jx.dni}"]`).click();
        else setv('plantel-equipo-select', '5to 2da');
    }
    setv('jugador-nombre', 'Sin Dorsal', false); setv('jugador-dni', '30111223', false); setv('jugador-dorsal', '', false);
    await enviar('form-jugador');
    check(/obligatorio/.test(ultimaAlerta()), 'Dorsal vacío se rechaza', ultimaAlerta());
    setv('jugador-nombre', 'Dorsal 100', false); setv('jugador-dni', '30111224', false); setv('jugador-dorsal', '100', false);
    await enviar('form-jugador');
    check(/0 a 99/.test(ultimaAlerta()), 'Dorsal 100 se rechaza', ultimaAlerta());
    setv('jugador-nombre', 'Sin DNI', false); setv('jugador-dni', '', false); setv('jugador-dorsal', '44', false);
    await enviar('form-jugador');
    const sinDni = LS('liga_cicloSuperior').find(e => e.nombre === '5to 2da').jugadores.find(j => j.nombre === 'Sin DNI');
    check(!sinDni || el('jugador-dni').required, 'Jugador sin DNI se rechaza (formulario de Planteles; el navegador lo frena si el campo es required)', { alerta: ultimaAlerta(), guardadoSinValidarJS: !!sinDni, required: el('jugador-dni').required });
    if (sinDni) { // limpiar para no contaminar
        const s = LS('liga_cicloSuperior'); const e = s.find(x => x.nombre === '5to 2da'); e.jugadores = e.jugadores.filter(j => j.nombre !== 'Sin DNI'); W().almacen.setItem('liga_cicloSuperior', JSON.stringify(s));
        await cargar('admin.html'); await tab('sec-planteles'); setv('plantel-ciclo', 'superior'); setv('plantel-equipo-select', '5to 2da');
    }
    // DNI con puntos de otro equipo, traslado cancelado y aceptado
    const victima = jug('7mo 3ra', 11);
    const dniConPuntos = victima.dni.slice(0, 2) + '.' + victima.dni.slice(2, 5) + '.' + victima.dni.slice(5);
    setv('plantel-equipo-select', '7mo 2da');
    respuestaConfirm = false;
    setv('jugador-nombre', victima.nombre, false); setv('jugador-dni', dniConPuntos, false); setv('jugador-dorsal', '33', false);
    await enviar('form-jugador');
    const c1 = LS('liga_cicloSuperior');
    check(/todavía no jugó/.test(confirms[confirms.length - 1] || '') && c1.find(e => e.nombre === '7mo 3ra').jugadores.some(j => j.dni === victima.dni), 'DNI de otro equipo (escrito con puntos) pide confirmar traslado y al cancelar no mueve nada', confirms[confirms.length - 1]);
    respuestaConfirm = true;
    setv('jugador-nombre', victima.nombre, false); setv('jugador-dni', victima.dni, false); setv('jugador-dorsal', '33', false);
    await enviar('form-jugador');
    const c2 = LS('liga_cicloSuperior');
    const movido = c2.find(e => e.nombre === '7mo 2da').jugadores.find(j => j.dni === victima.dni);
    check(movido && movido.dorsal === 33 && !c2.find(e => e.nombre === '7mo 3ra').jugadores.some(j => j.dni === victima.dni), 'Traslado aceptado: sale de 7mo 3ra y entra a 7mo 2da con #33', movido && { dorsal: movido.dorsal, ficha: movido.fichaMedica });
    planteles['7mo 3ra'] = planteles['7mo 3ra'].filter(j => j !== victima);
    planteles['7mo 2da'].push({ ...victima, dorsal: 33 });
    // vuelve a 7mo 3ra no: queda en 7mo 2da.

    // Editar jugador con dorsal 0 (bug candidato)
    setv('plantel-equipo-select', '4to 1ra');
    await esperar(2);
    const filaCero = [...D().querySelectorAll('#tabla-jugadores-body tr')].find(tr => tr.textContent.includes(jug('4to 1ra', 0).nombre));
    check(filaCero && filaCero.cells[0].textContent.trim() === '#0', 'Tabla de Planteles muestra #0 para el dorsal 0', filaCero && filaCero.cells[0].textContent.trim());
    const btnEd = D().querySelector(`.btn-editar-jugador[data-dni="${jug('4to 1ra', 0).dni}"]`);
    btnEd.click();
    check(el('jugador-dorsal').value === '0', 'Al editar un jugador con dorsal 0 el campo muestra 0', el('jugador-dorsal').value);
    setv('jugador-instagram', 'arquero_cero', false);
    const nAl = alertas.length;
    await enviar('form-jugador');
    const tras = LS('liga_cicloSuperior').find(e => e.nombre === '4to 1ra').jugadores.find(j => j.dni === jug('4to 1ra', 0).dni);
    check(tras.instagram === 'arquero_cero' && tras.dorsal === 0, 'Editar jugador #0 (solo cambiar Instagram) se guarda sin error', { alerta: alertas.slice(nAl), instagram: tras.instagram, dorsal: tras.dorsal });
    if (tras.instagram !== 'arquero_cero') { el('btn-cancelar-edicion-jugador').click(); }

    // Ficha médica: toggle desde Planteles
    const btnFicha = D().querySelector(`.btn-toggle-ficha[data-dni="${jug('4to 1ra', 5).dni}"]`);
    const fichaAntes = jug('4to 1ra', 5).ficha;
    btnFicha.click();
    const fichaDesp = LS('liga_cicloSuperior').find(e => e.nombre === '4to 1ra').jugadores.find(j => j.dni === jug('4to 1ra', 5).dni).fichaMedica;
    check(fichaDesp !== fichaAntes, 'Botón OK/Debe de ficha en Planteles alterna la ficha', { antes: fichaAntes, despues: fichaDesp });
    jug('4to 1ra', 5).ficha = fichaDesp;
    // Modal SOS
    const sos = D().querySelector(`.btn-ver-emergencia[data-dni="${jug('4to 1ra', 0).dni}"]`); sos.click();
    const sosTxt = el('emergencia-modal-body').textContent;
    check(sosTxt.includes('(#0)'), 'Modal de emergencia (SOS) muestra el dorsal 0', (sosTxt.match(/\(#[^)]*\)/) || [''])[0]);
    el('btn-cerrar-modal-emergencia').click();
}

// ---------------- Fase 2: fixture ----------------
const RR = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
const CANCHAS = ['Cancha 1', 'Cancha 2', 'Cancha 3'];
async function crearPartido(fecha, ciclo, grupo, local, visita, idx) {
    setv('partido-fecha', String(fecha));
    setv('partido-ciclo', ciclo);
    if (fecha < 100) setv('partido-grupo-select', grupo);
    setv('partido-local', local, false); setv('partido-visitante', visita, false);
    setv('goles-local', '', false); setv('goles-visitante', '', false);
    setv('partido-dia', `2026-10-${String(3 + fecha * 7).padStart(2, '0')}`, false);
    const hc = el('partido-horario-confirmar'); hc.checked = (fecha === 3 && idx === 0); hc.dispatchEvent(new Event('change'));
    if (!hc.checked) setv('partido-horario', ['14:20', '15:10', '16:00'][idx % 3], false);
    setv('partido-cancha', CANCHAS[idx % 3], false);
    setv('partido-arbitro-nombre', 'Árbitro ' + (idx + 1), false);
    setv('partido-arancel-monto', '30000', false);
    await enviar('form-partido');
    await esperar(3);
}
async function fase2() {
    out('\n=== FASE 2: fixture (3 fechas, 3 grupos Superior + 1 Básico, sin resultados) ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    for (let f = 1; f <= 3; f++) {
        let idx = 0;
        for (const [ciclo, estructura] of [['superior', SUP], ['basico', BAS]]) {
            for (const [grupo, eq] of Object.entries(estructura)) {
                for (const [a, b] of RR[f - 1]) await crearPartido(f, ciclo, grupo, eq[a], eq[b], idx++);
            }
        }
    }
    const ps = LS('liga_partidos');
    check(ps.length === 24, 'Se crearon 24 partidos', ps.length);
    check(ps.every(p => !p.jugado && p.localId && p.visitanteId && p.dia && p.arancelExigido === 30000), 'Todos pendientes, con ids de equipo, día y arancel', ps.filter(p => !p.localId).length);
    const aConf = ps.filter(p => p.horario === '');
    check(aConf.length >= 1, 'Partido con "horario a confirmar" guarda horario vacío', aConf.length);
    check(new Set(ps.map(p => p.id)).size === 24, 'Ids de partido únicos');
    // No se puede jugar contra sí mismo
    setv('partido-fecha', '1'); setv('partido-ciclo', 'superior'); setv('partido-grupo-select', 'A');
    setv('partido-local', '4to 1ra', false); setv('partido-visitante', '4to 1ra', false);
    await enviar('form-partido');
    check(/sí mismo/.test(ultimaAlerta()) && LS('liga_partidos').length === 24, 'Equipo contra sí mismo se rechaza', ultimaAlerta());
}


let bugEditarGrupo = 0;
function editarPartido(p) {
    D().querySelector(`.btn-editar-partido[data-id="${p.id}"]`).click();
    if (el('partido-local').value !== p.local || el('partido-visitante').value !== p.visitante) {
        bugEditarGrupo++;
        if (p.fecha < 100) el('partido-grupo-select').dispatchEvent(new Event('change'));
        setv('partido-local', p.local, false); setv('partido-visitante', p.visitante, false);
    }
}
const P = (fecha, local, visita) => LS('liga_partidos').find(p => p.fecha === fecha && p.local === local && p.visitante === visita);

// ---------------- Tesorería / lista de buena fe ----------------
async function abrirTeso(fecha) {
    await tab('sec-tesoreria');
    el('btn-sub-teso-partidos').click();
    setv('filtro-tesoreria-fecha', String(fecha));
    await esperar(2);
}
function cajaEquipo(pid, lado) { return D().querySelector(`.bf-detalle[data-key*="_${pid}_${lado}_"]`)?.closest('.teso-team-box'); }
async function tildar(pid, lado, dnis) {
    for (const dni of dnis) {
        const chk = D().querySelector(`.bf-chk-asist[data-pid="${pid}"][data-lado="${lado}"][data-jid="${dni}"]`);
        if (!chk) { out('  no encontré checkbox ' + pid + ' ' + lado + ' ' + dni); continue; }
        if (!chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true })); await esperar(1); }
    }
}
async function pagar(pid, lado, clase, monto) {
    const caja = cajaEquipo(pid, lado);
    const inp = caja && caja.querySelector('.' + clase);
    if (!inp) { out('  no encontré input ' + clase + ' ' + pid + lado); return; }
    inp.value = String(monto); inp.dispatchEvent(new Event('change', { bubbles: true })); await esperar(1);
}
async function asistencia(pid, lado, valor) {
    const sel = cajaEquipo(pid, lado).querySelector('.in-p-asist');
    sel.value = valor; sel.dispatchEvent(new Event('change', { bubbles: true })); await esperar(1);
}

// Resultados planificados (fecha regular): [fecha, local, visita, gl, gv, dorsalesL, dorsalesV, amarL, rojL, amarV, rojV]
const RESULTADOS = [];
function planificar() {
    let s = 7;
    const rnd = n => { s = (s * 9301 + 49297) % 233280; return Math.floor(s / 233280 * n); };
    for (let f = 1; f <= 3; f++) {
        for (const [ciclo, estructura] of [['superior', SUP], ['basico', BAS]]) {
            for (const eq of Object.values(estructura)) {
                for (const [a, b] of RR[f - 1]) {
                    const L = eq[a], V = eq[b];
                    const gl = rnd(4), gv = rnd(4);
                    const dl = Array.from({ length: gl }, () => planteles[L][rnd(planteles[L].length)].dorsal);
                    const dv = Array.from({ length: gv }, () => planteles[V][rnd(planteles[V].length)].dorsal);
                    RESULTADOS.push({ fecha: f, ciclo, L, V, gl, gv, dl, dv, amL: [], roL: [], amV: [], roV: [] });
                }
            }
        }
    }
    // Casos especiales
    const r1 = RESULTADOS.find(r => r.fecha === 1 && r.L === '4to 1ra');
    r1.gl = 3; r1.gv = 1; r1.dl = [0, 0, 5]; r1.dv = [9]; r1.amL = [5, 5]; r1.roV = [9]; r1.amV = [7];
    const r2 = RESULTADOS.find(r => r.fecha === 1 && r.L === '4to 2da');
    r2.gl = 2; r2.gv = 1; r2.dl = [7, 9]; r2.dv = [10]; // luego se edita a 3-1
    const r3 = RESULTADOS.find(r => r.fecha === 2 && r.L === '5to 1ra'); // 5to 1ra vs 7mo 3ra: ausencia -> 3-0 auto
    r3.auto = true; r3.gl = 3; r3.gv = 0; r3.dl = []; r3.dv = [];
    const r4 = RESULTADOS.find(r => r.fecha === 2 && r.L === '4to 3ra');
    r4.fantasma = true; r4.gl = 2; r4.gv = 2; r4.dl = [5, 88]; r4.dv = [1, 7]; // 88 no existe
}

async function cargarResultado(r, dlTxt, dvTxt) {
    const p = P(r.fecha, r.L, r.V);
    editarPartido(p);
    setv('goles-local', String(r.gl), false); setv('goles-visitante', String(r.gv), false);
    setv('dorsales-goles-local', dlTxt !== undefined ? dlTxt : r.dl.join(', '), false);
    setv('dorsales-goles-visitante', dvTxt !== undefined ? dvTxt : r.dv.join(', '), false);
    setv('dorsales-amarillas-local', r.amL.join(', '), false); setv('dorsales-rojas-local', r.roL.join(', '), false);
    setv('dorsales-amarillas-visitante', r.amV.join(', '), false); setv('dorsales-rojas-visitante', r.roV.join(', '), false);
    await enviar('form-partido');
}
function registrarEsperado(r, tildadosL, tildadosV) {
    if (!r.auto) {
        tildadosL.forEach(d => suma(esperado.pj, d)); tildadosV.forEach(d => suma(esperado.pj, d));
    }
    r.dl.forEach(d => { const j = jug(r.L, d); if (j) suma(esperado.goles, j.dni); });
    r.dv.forEach(d => { const j = jug(r.V, d); if (j) suma(esperado.goles, j.dni); });
    r.amL.forEach(d => suma(esperado.amarillas, jug(r.L, d).dni)); r.roL.forEach(d => suma(esperado.rojas, jug(r.L, d).dni));
    r.amV.forEach(d => suma(esperado.amarillas, jug(r.V, d).dni)); r.roV.forEach(d => suma(esperado.rojas, jug(r.V, d).dni));
}

async function jugarFecha(f) {
    out(`\n=== FECHA ${f}: lista de buena fe + pagos + carga de resultados ===`);
    await cargar('admin.html');
    await abrirTeso(f);
    const delaFecha = RESULTADOS.filter(r => r.fecha === f);
    const tildes = {};
    for (const r of delaFecha) {
        const p = P(f, r.L, r.V);
        if (r.auto) continue;
        let tl = planteles[r.L].slice(0, 5).map(j => j.dni);
        let tv = planteles[r.V].slice(0, 5).map(j => j.dni);
        if (f === 3 && r.V === '5to 3ra') tv = tv.slice(0, 3);
        if (f === 3 && r.L === '5to 3ra') tl = tl.slice(0, 3);
        await tildar(p.id, 'local', tl);
        await tildar(p.id, 'visita', tv);
        tildes[p.id] = [tl, tv];
    }
    // Pagos
    for (const r of delaFecha) {
        const p = P(f, r.L, r.V);
        for (const [lado, eq] of [['local', r.L], ['visita', r.V]]) {
            let monto = 30000, clase = 'in-p-ef';
            if (r.auto && eq === '7mo 3ra') continue; // ausente, no paga
            if (f === 1 && eq === '4to 1ra') monto = 40000;
            if (f === 2 && eq === '4to 1ra') monto = 20000;
            if (f === 2 && eq === '6to 2da') { monto = 20000; clase = 'in-p-tr'; }
            await pagar(p.id, lado, clase, monto);
        }
    }
    if (f === 2) {
        const r3 = delaFecha.find(r => r.auto);
        const p = P(2, r3.L, r3.V);
        await asistencia(p.id, 'visita', 'sin_aviso');
        await asistencia(p.id, 'local', 'presente');
    }
    // Verificaciones en Tesorería de la fecha
    const teso = LS('liga_tesoreria_partidos_v2');
    const presentesAuto = delaFecha.filter(r => !r.auto).every(r => {
        const p = P(f, r.L, r.V);
        return Object.entries(teso).filter(([kk]) => kk.includes(`_${p.id}_`)).every(([, v]) => v.asistencia === 'presente' && v.asistenciaAuto);
    });
    check(presentesAuto, `F${f}: tildar jugadores marca solo al equipo "Se presentó"`);

    // Carga de resultados
    await tab('sec-jornada');
    for (const r of delaFecha) {
        if (r.auto) continue;
        const [tl, tv] = tildes[P(f, r.L, r.V).id];
        await cargarResultado(r);
        registrarEsperado(r, tl, tv);
    }
    if (f === 2) registrarEsperado(delaFecha.find(r => r.auto), [], []);
    const ps = LS('liga_partidos').filter(p => p.fecha === f);
    check(ps.every(p => p.jugado), `F${f}: todos los partidos quedaron jugados`, ps.filter(p => !p.jugado).map(p => p.local + '-' + p.visitante));
    const malGoles = delaFecha.filter(r => {
        const p = P(f, r.L, r.V);
        return p.golesLocal !== r.gl || p.golesVisitante !== r.gv;
    });
    check(malGoles.length === 0, `F${f}: marcadores guardados como se cargaron`, malGoles.map(r => r.L));
}

async function fase3extra() {
    out('\n=== CASOS ESPECIALES DE CARGA ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    // F1: 4to 1ra vs 5to 2da
    const pA = P(1, '4to 1ra', '5to 2da');
    check(JSON.stringify(pA.goleadoresLocal) === JSON.stringify([{ nombre: `${jug('4to 1ra', 0).nombre} (#0)`, cantidad: 2, id: jug('4to 1ra', 0).dni }, { nombre: `${jug('4to 1ra', 5).nombre} (#5)`, cantidad: 1, id: jug('4to 1ra', 5).dni }]), 'Goleadores con dorsal 0 repetido se agrupan: "(#0)" x2 y "(#5)" x1', pA.goleadoresLocal);
    check(pA.amarillasLocal.length === 2 && pA.amarillasLocal.every(d => d === jug('4to 1ra', 5).dni), 'Dos amarillas al mismo dorsal = dos entradas con su DNI', pA.amarillasLocal);
    check(pA.rojasVisitante[0] === jug('5to 2da', 9).dni, 'Roja guardada con el DNI del jugador', pA.rojasVisitante);
    // Editar sin tocar los campos: tienen que venir rellenos
    editarPartido(pA);
    check(el('dorsales-goles-local').value === '0, 0, 5' && el('dorsales-amarillas-local').value === '5, 5' && el('dorsales-rojas-visitante').value === '9', 'Al editar, goleadores y tarjetas se rellenan', { gol: el('dorsales-goles-local').value, am: el('dorsales-amarillas-local').value, roja: el('dorsales-rojas-visitante').value });
    await enviar('form-partido');
    const golesJ0 = golesDe('4to 1ra', jug('4to 1ra', 0).dni);
    check(golesJ0 === 2, 'Guardar la edición sin cambios no duplica ni borra goles del #0', golesJ0);

    // Editar resultado 2-1 -> 3-1
    const pB = P(1, '4to 2da', '5to 3ra');
    editarPartido(pB);
    setv('goles-local', '3', false); setv('dorsales-goles-local', '7, 7, 9', false);
    await enviar('form-partido');
    const r2 = RESULTADOS.find(r => r.fecha === 1 && r.L === '4to 2da');
    suma(esperado.goles, jug('4to 2da', 7).dni, 1); r2.gl = 3; r2.dl = [7, 7, 9];
    const eq42 = LS('liga_cicloSuperior').find(e => e.nombre === '4to 2da');
    check(golesDe('4to 2da', jug('4to 2da', 7).dni) === esperado.goles[jug('4to 2da', 7).dni] && P(1, '4to 2da', '5to 3ra').golesLocal === 3, 'Editar 2-1 → 3-1 con un goleador más: goles correctos', { g7: golesDe('4to 2da', jug('4to 2da', 7).dni), esperado: esperado.goles[jug('4to 2da', 7).dni] });

    // Dorsal inexistente en goleadores (F2 4to 3ra vs 6to 2da con "5, 88")
    const pC = P(2, '4to 3ra', '6to 2da');
    const sumaGoleadores = (pC.goleadoresLocal || []).reduce((a, g) => a + g.cantidad, 0);
    check(pC.jugado && pC.golesLocal === 2 && pC.golesVisitante === 2 && sumaGoleadores === 1 && (pC.goleadoresVisitante || []).length === 2,
        'Gol con dorsal inexistente (88): el resto del resultado se guarda igual que antes',
        { jugado: pC.jugado, marcador: [pC.golesLocal, pC.golesVisitante], goleadoresLocal: pC.goleadoresLocal, goleadoresVisitante: pC.goleadoresVisitante });
    const avisos = LS('liga_avisos_staff') || [];
    const avisoDorsal = avisos.filter(a => a.tipo === 'dorsal_invalido_gol');
    check(avisoDorsal.length === 1, 'Se registró un único aviso interno por el dorsal inexistente', avisos.map(a => a.tipo));
    const det = avisoDorsal[0] ? avisoDorsal[0].detalle : '';
    check(/#88/.test(det) && /4to 3ra/.test(det) && /FECHA 2/i.test(det) && /6to 2da/.test(det),
        'El aviso trae dorsal, equipo, fecha y rival correctos', det);
    await tab('sec-avisos-staff');
    const panelAvisos = el('lista-avisos-staff');
    check(panelAvisos && /#88/.test(panelAvisos.textContent) && panelAvisos.querySelectorAll('.btn-borrar-aviso-staff').length === 1,
        'La pestaña "Avisos Internos" muestra el aviso con su botón Eliminar', panelAvisos && panelAvisos.textContent.replace(/\s+/g, ' ').trim().slice(0, 140));
    respuestaConfirm = false;
    el('btn-vaciar-avisos-staff').click();
    check((LS('liga_avisos_staff') || []).length === 1, 'Cancelar "Vaciar Historial" no borra los avisos');
    respuestaConfirm = true;
    el('btn-vaciar-avisos-staff').click();
    await esperar(2);
    check((LS('liga_avisos_staff') || []).length === 0 && /No hay avisos pendientes/.test(el('lista-avisos-staff').textContent),
        '"Vaciar Historial" borra los avisos internos', el('lista-avisos-staff').textContent.trim().slice(0, 50));
    await tab('sec-jornada');

    // Tarjeta con dorsal inexistente
    const pD = P(3, '4to 1ra', '7mo 1ra');
    const antes = JSON.stringify(pD);
    editarPartido(pD);
    setv('dorsales-amarillas-local', '77', false);
    await enviar('form-partido');
    check(/número 77/.test(ultimaAlerta()) && JSON.stringify(P(3, '4to 1ra', '7mo 1ra')) === antes, 'Tarjeta con dorsal inexistente se rechaza y no guarda nada', ultimaAlerta());
    // (el formulario queda en modo edición: cancelar)
    setv('dorsales-amarillas-local', '', false);
    await enviar('form-partido');
    check(JSON.stringify(P(3, '4to 1ra', '7mo 1ra').goleadoresLocal) === JSON.stringify(JSON.parse(antes).goleadoresLocal), 'Re-guardar el partido deja los goleadores iguales');
}

async function tesoreriaChecks() {
    out('\n=== TESORERÍA: Art. 17 Bis, saldo a favor, deuda, suspensiones y planillas ===');
    await cargar('admin.html');
    const pAuto = P(2, '5to 1ra', '7mo 3ra');
    check(pAuto.jugado && pAuto.resultadoAuto && pAuto.golesLocal === 3 && pAuto.golesVisitante === 0, 'Ausencia sin aviso + rival pagó 100% → 3-0 automático', { jugado: pAuto.jugado, auto: pAuto.resultadoAuto, g: [pAuto.golesLocal, pAuto.golesVisitante] });
    let sanc = LS('liga_sanciones').filter(s => s.origenAuto);
    check(sanc.length === 1 && sanc[0].equipo === '7mo 3ra' && sanc[0].puntosRestados === 2 && !sanc[0].levantada, 'Sanción automática −2 al ausente que no pagó el 50%', sanc.map(s => [s.equipo, s.puntosRestados, s.levantada]));

    await abrirTeso(2);
    const cajaAus = cajaEquipo(pAuto.id, 'visita');
    check(/-2 PTS/.test(cajaAus.textContent), 'Tarjeta del ausente muestra chip −2 PTS');
    // Paga 15000 (50%) → se levanta
    await pagar(pAuto.id, 'visita', 'in-p-ef', 15000);
    sanc = LS('liga_sanciones').filter(s => s.origenAuto);
    check(sanc.length === 1 && sanc[0].levantada && sanc[0].puntosRestados === 0 && sanc[0].fechaLevantada, 'Pagó el 50% → quita levantada con fecha', sanc[0]);
    // Saldo a favor 4to 1ra
    const p1 = P(1, '4to 1ra', '5to 2da'), p2 = P(2, '4to 1ra', '6to 3ra');
    const c2 = cajaEquipo(p2.id, 'local');
    check(/Saldo a favor aplicado: -\$10[.,]000/.test(c2.textContent) && /CANCELADO/.test(c2.textContent), 'Saldo a favor de F1 ($10.000) se aplica en F2 y queda cancelado', c2.querySelector('.teso-nota')?.textContent);
    // Deuda 6to 2da arrastrada a F3
    await abrirTeso(3);
    const p3 = P(3, '5to 1ra', '6to 2da');
    const c3 = cajaEquipo(p3.id, 'visita');
    check(/Arrastra deuda de \$10[.,]000 \(F2\)/.test(c3.textContent), '6to 2da pagó $20.000 en F2 → F3 muestra "Arrastra deuda $10.000 (F2)"', (c3.textContent.match(/Arrastra[^)]*\)/) || ['nada'])[0]);

    const cabeceras = [...D().querySelectorAll('.teso-match-header')].map(h => h.textContent.replace(/\s+/g, ' '));
    check(cabeceras.some(t => /A confirmar/i.test(t)) && !cabeceras.some(t => /14:20 hs/.test(t) && /Cancha 1/.test(t) && false), 'Tesorería F3: el partido sin horario dice "A confirmar"', cabeceras.filter(t => /confirmar|14:20/i.test(t)).slice(0, 2));
    // Mínimo de 4: 5to 3ra tildó 3 en F3
    const p5 = P(3, '5to 3ra', '6to 1ra');
    const c5 = cajaEquipo(p5.id, 'local');
    check(/Faltan 1 para poder jugar/.test(c5.querySelector('.bf-aviso-min').textContent), 'Con 3 tildados aparece "Faltan 1 para poder jugar (mínimo 4)"', c5.querySelector('.bf-aviso-min').textContent);

    // Tribunal: suspensión 2 fechas al #9 de 5to 2da (roja en F1)
    await tab('sec-tribunal');
    setv('sancion-acta-num', '1', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', '5to 2da');
    setv('sancion-jugador-id', jug('5to 2da', 9).dni, false);
    setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '2', false);
    setv('sancion-motivo', 'Roja directa por juego brusco (F1).', false);
    await enviar('form-sancion');
    // Quita de puntos manual a 6to 1ra
    setv('sancion-acta-num', '2', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', '6to 1ra');
    setv('sancion-jugador-id', '', false);
    setv('sancion-tipo', 'Quita de Puntos', false); setv('sancion-puntos', '1', false);
    setv('sancion-motivo', 'Art. 8: deuda sin cancelar (acordado con el capitán).', false);
    await enviar('form-sancion');
    // Advertencia sin jugador
    setv('sancion-acta-num', '3', false); setv('sancion-ciclo', 'basico'); setv('sancion-equipo', '2do 2da');
    setv('sancion-tipo', 'Advertencia / Acta', false); setv('sancion-puntos', '0', false);
    setv('sancion-motivo', 'Hinchada con pirotecnia.', false);
    await enviar('form-sancion');
    const sm = LS('liga_sanciones');
    const susp = sm.find(s => s.tipo === 'Sanción Disciplinaria');
    check(susp && susp.jugadorId === jug('5to 2da', 9).dni && susp.jugador.includes('#9'), 'Suspensión guardada con jugadorId (DNI) y "Nombre (#9)"', susp && { jugador: susp.jugador, acta: susp.acta, tipoActa: typeof susp.acta });

    // Lista de buena fe: suspendido en F2 y F3, no en F1
    const conSusp = async f => {
        await abrirTeso(f);
        const r = RESULTADOS.find(x => x.fecha === f && (x.L === '5to 2da' || x.V === '5to 2da'));
        const p = P(f, r.L, r.V);
        const lado = r.L === '5to 2da' ? 'local' : 'visita';
        const fila = D().querySelector(`.bf-chk-asist[data-pid="${p.id}"][data-lado="${lado}"][data-jid="${jug('5to 2da', 9).dni}"]`)?.closest('.bf-fila');
        return fila;
    };
    const f1 = await conSusp(1), f2 = await conSusp(2), f3 = await conSusp(3);
    check(f1 && !f1.querySelector('.bf-tag-susp'), 'F1 (fecha del acta): no figura suspendido');
    check(f2 && /SUSPENDIDO · Acta 1 · 2 fechas/.test(f2.textContent), 'F2: figura "SUSPENDIDO · Acta 1 · 2 fechas"', f2 && f2.querySelector('.bf-tag-susp')?.textContent);
    check(f3 && /SUSPENDIDO/.test(f3.textContent), 'F3: sigue suspendido (2da fecha)');
    // El #9 quedó tildado en F2 y F3 desde antes de la sanción → fila roja
    check(f3 && f3.classList.contains('bf-fila-alerta'), 'Suspendido que ya estaba tildado → fila en rojo');
    // Regla nueva (23/09/2026): destildar a un suspendido se puede; volver a tildarlo no.
    await abrirTeso(2);
    const pSusp = P(2, '5to 2da', '7mo 1ra');
    const chkSusp = () => D().querySelector(`.bf-chk-asist[data-pid="${pSusp.id}"][data-lado="local"][data-jid="${jug('5to 2da', 9).dni}"]`);
    const c0 = chkSusp();
    check(c0 && c0.checked, 'F2: el suspendido figura tildado de antes (el acta se cargó después)');
    c0.checked = false; c0.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(2);
    check(!(P(2, '5to 2da', '7mo 1ra').asistentesLocal || []).includes(jug('5to 2da', 9).dni), 'Destildar a un jugador suspendido sigue permitido');
    esperado.pj[jug('5to 2da', 9).dni] = (esperado.pj[jug('5to 2da', 9).dni] || 1) - 1;
    const nAlertas = alertas.length;
    const c1 = chkSusp();
    c1.checked = true; c1.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(2);
    const guardadoTrasIntento = (P(2, '5to 2da', '7mo 1ra').asistentesLocal || []).includes(jug('5to 2da', 9).dni);
    check(!guardadoTrasIntento && !chkSusp().checked && alertas.length > nAlertas && /suspendido/i.test(ultimaAlerta()),
        'Tildar a un suspendido se bloquea: se destilda solo, avisa y no se guarda', { alerta: ultimaAlerta(), guardado: guardadoTrasIntento });
    const otro = jug('5to 2da', 10);
    const chkOtro = D().querySelector(`.bf-chk-asist[data-pid="${pSusp.id}"][data-lado="local"][data-jid="${otro.dni}"]`);
    const estabaOtro = chkOtro.checked;
    chkOtro.checked = !estabaOtro; chkOtro.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(2);
    check((P(2, '5to 2da', '7mo 1ra').asistentesLocal || []).includes(otro.dni) !== estabaOtro, 'Un jugador no suspendido se sigue tildando normal');
    chkOtro.checked = estabaOtro; chkOtro.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(2);
    // Planilla impresa F2
    await abrirTeso(2);
    el('btn-imprimir-planillas').click();
    const vista = D().getElementById('vista-imprimible');
    const hojas = vista ? vista.querySelectorAll('.plan-hoja').length : 0;
    check(hojas === 8 && prints > 0, 'Imprimir planillas F2 genera 8 hojas (una por partido)', { hojas, prints });
    check(vista && /SUSPENDIDO · Acta 1/.test(vista.textContent), 'Planilla impresa marca al suspendido en la celda Firma');
    const tabla0 = vista.querySelector('.plan-tabla');
    check(tabla0 && tabla0.querySelectorAll('tbody tr').length === 10 && !/Goles|RESULTADO/.test(vista.textContent), 'Planilla: 10 filas por equipo, sin columna Goles ni RESULTADO');
    const planilla41 = [...vista.querySelectorAll('.plan-tabla')].find(t => t.textContent.includes('Equipo: 4to 1ra'));
    const filaCero = planilla41 && [...planilla41.querySelectorAll('tbody tr')].find(tr => tr.textContent.includes(jug('4to 1ra', 0).nombre));
    check(filaCero && filaCero.cells[2].textContent === '0', 'Planilla impresa muestra el N° 0', filaCero && filaCero.cells[2].textContent);

    // Alta en cancha (F3, 7mo 3ra que quedó con 5 jugadores)
    await abrirTeso(3);
    const pAlta = P(3, '4to 3ra', '7mo 3ra');
    const cajaAlta = cajaEquipo(pAlta.id, 'visita').querySelector('.bf-alta-campos');
    cajaAlta.querySelector('.bf-alta-nombre').value = 'Refuerzo Cancha';
    cajaAlta.querySelector('.bf-alta-dni').value = '47999111';
    cajaAlta.querySelector('.bf-alta-dorsal').value = '0';
    cajaAlta.querySelector('.bf-alta-guardar').click();
    await esperar(2);
    const e73 = LS('liga_cicloSuperior').find(e => e.nombre === '7mo 3ra');
    const nuevo = e73.jugadores.find(j => j.dni === '47999111');
    const pAltaDesp = P(3, '4to 3ra', '7mo 3ra');
    check(nuevo && nuevo.dorsal === 0 && nuevo.fichaMedica === 'no' && pAltaDesp.asistentesVisitante.includes('47999111'), 'Alta en cancha con #0: queda en el plantel, ficha pendiente y tildado', nuevo && { dorsal: nuevo.dorsal, ficha: nuevo.fichaMedica });
    planteles['7mo 3ra'].push({ nombre: 'Refuerzo Cancha', dni: '47999111', dorsal: 0, ficha: 'no' });
    suma(esperado.pj, '47999111');
    // Alta en cancha con DNI de alguien que ya jugó en otro equipo
    const cajaAlta2 = cajaEquipo(pAlta.id, 'visita').querySelector('.bf-alta-campos');
    cajaAlta2.querySelector('.bf-alta-nombre').value = 'Colado';
    cajaAlta2.querySelector('.bf-alta-dni').value = jug('4to 1ra', 7).dni;
    cajaAlta2.querySelector('.bf-alta-dorsal').value = '45';
    cajaAlta2.querySelector('.bf-alta-guardar').click();
    await esperar(2);
    check(/ya jugó con ese equipo/.test(ultimaAlerta()), 'Alta en cancha con DNI de un jugador que ya jugó en otro equipo se rechaza', ultimaAlerta());
    // Ficha desde la lista de buena fe
    const btnF = cajaEquipo(pAlta.id, 'visita').querySelector(`.bf-btn-ficha[data-jid="47999111"]`);
    btnF.click();
    const fichaNuevo = LS('liga_cicloSuperior').find(e => e.nombre === '7mo 3ra').jugadores.find(j => j.dni === '47999111').fichaMedica;
    check(fichaNuevo === 'si', 'Botón FALTA→OK de la lista de buena fe guarda la ficha', fichaNuevo);

    // Caja por fecha y balance (modo admin)
    const caja = LS('liga_caja_movimientos') || [];
    const totalCaja = caja.reduce((a, m) => a + m.monto, 0);
    const teso = LS('liga_tesoreria_partidos_v2');
    const totalTeso = Object.values(teso).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
    check(totalCaja === totalTeso, 'Caja por Fecha: suma de movimientos = suma de pagos cargados', { totalCaja, totalTeso });
    const totalPartidos = el('txt-total-partidos')?.textContent;
    out('  info: Tesorería > total recaudado en partidos (tarjeta del Coordinador) = ' + totalPartidos + ' | esperado $' + totalTeso.toLocaleString());

    // Rol staff (sale de usuarios/{uid}; en el banco, de localStorage.fake_rol): oculta totales y no lee lo del coordinador
    localStorage.setItem('fake_rol', 'staff');
    await cargar('admin.html');
    const soloAdmin = [...D().querySelectorAll('.solo-admin')];
    check(soloAdmin.length > 0 && soloAdmin.every(x => getComputedStyle(x).display === 'none'), 'Rol Staff oculta todos los .solo-admin', soloAdmin.length);
    // Desde el 29/09/2026 las inscripciones y su valor por jugador son solo del Coordinador.
    check(LS('liga_egresos') === null && LS('liga_caja_movimientos') === null && LS('liga_tesoreria_inscripciones') === null && LS('liga_valor_inscripcion') === null && LS('liga_tesoreria_partidos_v2') !== null && LS('liga_cicloSuperior')[0].jugadores[0].dni && /^\d/.test(String(LS('liga_cicloSuperior')[0].jugadores[0].dni)),
        'Rol Staff: carga los pagos por partido y DNIs reales, pero no egresos, Caja por Fecha ni inscripciones', { egresos: LS('liga_egresos'), caja: LS('liga_caja_movimientos'), insc: LS('liga_tesoreria_inscripciones'), valorInsc: LS('liga_valor_inscripcion'), dni: LS('liga_cicloSuperior')[0].jugadores[0].dni });
    localStorage.removeItem('fake_rol');
    await cargar('admin.html');
    await tab('sec-tesoreria');

    // Avisos + noticia
    await tab('sec-alertas');
    setv('alerta-titulo', 'Fecha 4 suspendida por lluvia', false); setv('alerta-texto', 'Se reprograma para el sábado siguiente.', false); setv('alerta-tipo', 'urgente', false);
    await enviar('form-alerta-admin');
    check((LS('liga_notificaciones') || []).length === 1, 'Aviso publicado', (LS('liga_notificaciones') || []).length);
}

// ---------------- Standings esperados ----------------
function standings(ciclo) {
    const est = ciclo === 'superior' ? SUP : BAS;
    const t = {};
    Object.entries(est).forEach(([g, eqs]) => eqs.forEach(n => t[n] = { n, g, pj: 0, gf: 0, gc: 0, pts: 0 }));
    RESULTADOS.filter(r => r.ciclo === ciclo).forEach(r => {
        const a = t[r.L], b = t[r.V];
        a.pj++; b.pj++; a.gf += r.gl; a.gc += r.gv; b.gf += r.gv; b.gc += r.gl;
        if (r.gl > r.gv) a.pts += 3; else if (r.gl < r.gv) b.pts += 3; else { a.pts++; b.pts++; }
    });
    if (ciclo === 'superior') t['6to 1ra'].pts -= 1;
    Object.values(t).forEach(x => x.dif = x.gf - x.gc);
    const orden = arr => [...arr].sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
    const porGrupo = {};
    Object.keys(est).forEach(g => porGrupo[g] = orden(Object.values(t).filter(x => x.g === g)));
    return { t, porGrupo, orden };
}

// ---------------- Playoffs ----------------
async function cargarPlayoff(fecha, ciclo, local, visita, gl, gv, pl, pv, dl = '', dv = '') {
    setv('partido-fecha', String(fecha));
    setv('partido-ciclo', ciclo);
    const sel = el('partido-cruce-playoff-select');
    const opt = [...sel.options].find(o => o.value === `${local}|${visita}`);
    if (!opt) out(`  no aparece el cruce ${local} vs ${visita} en el selector de ${fecha}: ` + [...sel.options].map(o => o.value).join(' ; '));
    else { sel.value = opt.value; sel.dispatchEvent(new Event('change')); }
    setv('goles-local', String(gl), false); setv('goles-visitante', String(gv), false);
    setv('penales-local', pl === null ? '' : String(pl), false); setv('penales-visitante', pv === null ? '' : String(pv), false);
    setv('dorsales-goles-local', dl, false); setv('dorsales-goles-visitante', dv, false);
    ['dorsales-amarillas-local', 'dorsales-rojas-local', 'dorsales-amarillas-visitante', 'dorsales-rojas-visitante'].forEach(i => setv(i, '', false));
    await enviar('form-partido');
    await esperar(3);
}
async function armarCruce(ciclo, ronda, slot, a, b) {
    setv('playoff-ciclo-select', ciclo); setv('playoff-ronda-select', ronda); setv('playoff-slot-select', String(slot));
    setv('playoff-equipo-1', a, false); setv('playoff-equipo-2', b, false);
    await enviar('form-armar-playoff');
    await esperar(3);
}
let campeonSup, campeonBas, crucesPublico = [];
async function playoffs() {
    out('\n=== PLAYOFFS ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    el('btn-sub-jornada-playoffs').click();
    setv('config-bracket-ciclo', 'superior'); setv('config-bracket-ronda-inicial', 'cuartos', false); setv('config-bracket-slots', '4', false);
    await enviar('form-config-bracket');
    setv('config-bracket-ciclo', 'basico'); setv('config-bracket-ronda-inicial', 'semis', false); setv('config-bracket-slots', '2', false);
    await enviar('form-config-bracket');
    check(JSON.stringify(LS('liga_playoffs_config')) === JSON.stringify({ superior: { rondaInicial: 'cuartos', slots: 4 }, basico: { rondaInicial: 'semis', slots: 2 } }), 'Config del bracket guardada', LS('liga_playoffs_config'));
    setv('playoff-ciclo-select', 'basico');
    const rondasSel = [...el('playoff-ronda-select').options].map(o => o.value);
    setv('playoff-ciclo-select', 'superior');
    check(JSON.stringify(rondasSel) === JSON.stringify(['semis', 'final']), 'Armador muestra solo las rondas vigentes del ciclo elegido', rondasSel);

    const S = standings('superior').porGrupo;
    const cruces = [[S.A[0].n, S.B[1].n], [S.C[0].n, S.A[1].n], [S.B[0].n, S.C[1].n], [S.A[2].n, S.B[2].n]];
    crucesPublico = cruces;
    for (let i = 0; i < 4; i++) await armarCruce('superior', 'cuartos', i + 1, cruces[i][0], cruces[i][1]);
    const B = standings('basico').porGrupo.A;
    await armarCruce('basico', 'semis', 1, B[0].n, B[3].n);
    await armarCruce('basico', 'semis', 2, B[1].n, B[2].n);
    check((LS('liga_cruces_playoffs') || []).length === 6, 'Se armaron 6 cruces', (LS('liga_cruces_playoffs') || []).length);
    // Sobrescribir llave ocupada: cancelar
    respuestaConfirm = false;
    await armarCruce('superior', 'cuartos', 1, cruces[3][0], cruces[3][1]);
    respuestaConfirm = true;
    const c1 = LS('liga_cruces_playoffs').find(c => c.ronda === 'cuartos' && c.slot === 1);
    check(c1.local === cruces[0][0], 'Pisar una llave ocupada pide confirmación y al cancelar no cambia');

    el('btn-sub-jornada-partidos').click();
    const w = [];
    // Cuartos
    await cargarPlayoff(104, 'superior', cruces[0][0], cruces[0][1], 2, 0, null, null, '5, 7', ''); w[1] = cruces[0][0];
    await cargarPlayoff(104, 'superior', cruces[1][0], cruces[1][1], 1, 1, null, null, '', ''); // empate sin penales
    let semi1 = LS('liga_cruces_playoffs').find(c => c.ciclo === 'superior' && c.ronda === 'semis' && c.slot === 1);
    check(semi1 && semi1.local === w[1] && !semi1.visitante, 'Ganador de Llave 1 avanza a Semis Llave 1 (local); el empate sin penales no avanza a nadie', semi1);
    // Corregir con penales
    const pEmp = LS('liga_partidos').find(p => p.fecha === 104 && p.local === cruces[1][0]);
    editarPartido(pEmp);
    check(D().getElementById('row-penales-partido').style.display !== 'none', 'Al editar un partido de playoff se ven los penales');
    setv('penales-local', '3', false); setv('penales-visitante', '4', false);
    await enviar('form-partido'); w[2] = cruces[1][1];
    await cargarPlayoff(104, 'superior', cruces[2][0], cruces[2][1], 0, 1, null, null, '', ''); w[3] = cruces[2][1];
    await cargarPlayoff(104, 'superior', cruces[3][0], cruces[3][1], 3, 2, null, null, '', ''); w[4] = cruces[3][0];
    const cr = LS('liga_cruces_playoffs');
    semi1 = cr.find(c => c.ciclo === 'superior' && c.ronda === 'semis' && c.slot === 1);
    const semi2 = cr.find(c => c.ciclo === 'superior' && c.ronda === 'semis' && c.slot === 2);
    check(semi1 && semi1.local === w[1] && semi1.visitante === w[2], 'Semis Llave 1 = G1 vs G2 (G2 ganó por penales)', semi1);
    check(semi2 && semi2.local === w[3] && semi2.visitante === w[4], 'Semis Llave 2 = G3 vs G4', semi2);
    // Semis
    await cargarPlayoff(102, 'superior', w[1], w[2], 2, 1, null, null);
    await cargarPlayoff(102, 'superior', w[3], w[4], 0, 0, 5, 4);
    const fin = LS('liga_cruces_playoffs').find(c => c.ciclo === 'superior' && c.ronda === 'final');
    check(fin && fin.local === w[1] && fin.visitante === w[3], 'Final Superior armada sola', fin);
    await cargarPlayoff(100, 'superior', w[1], w[3], 1, 2, null, null);
    campeonSup = w[3];
    // Básico
    await cargarPlayoff(102, 'basico', B[0].n, B[3].n, 4, 1, null, null);
    await cargarPlayoff(102, 'basico', B[1].n, B[2].n, 2, 3, null, null);
    const finB = LS('liga_cruces_playoffs').find(c => c.ciclo === 'basico' && c.ronda === 'final');
    check(finB && finB.local === B[0].n && finB.visitante === B[2].n, 'Final Básico armada sola', finB);
    await cargarPlayoff(100, 'basico', B[0].n, B[2].n, 2, 2, 5, 3);
    campeonBas = B[0].n;
    const po = LS('liga_partidos').filter(p => p.esPlayoff);
    check(po.length === 10 && po.every(p => p.jugado && p.grupo === 'Playoffs'), '10 partidos de playoff jugados', po.length);
    // Publicar
    el('btn-sub-jornada-playoffs').click();
    el('btn-toggle-publicar-playoffs').click();
    check(W().almacen.getItem('liga_playoffs_publicados') === 'true', 'Playoffs publicados');
    // Orden de fechas en el cronograma y en Tesorería
    const opts = [...el('filtro-fecha-cronograma-admin').options].map(o => o.textContent);
    check(opts.indexOf('Cuartos de Final') < opts.indexOf('Gran Final'), 'Filtro de fechas del cronograma en orden cronológico (Cuartos antes que la Final)', opts);
    await abrirTeso('todas');
    const fases = [...D().querySelectorAll('.teso-match-header > span:first-child strong')].map(s => s.textContent).filter((v, i, a) => a.indexOf(v) === i);
    check(fases.indexOf('CUARTOS DE FINAL') < fases.indexOf('GRAN FINAL'), 'Tesorería lista las fases en orden cronológico', fases);
    // Goles de playoff suman al goleador
    const eqW1 = cruces[0][0];
    suma(esperado.goles, jug(eqW1, 5).dni); suma(esperado.goles, jug(eqW1, 7).dni);
}

// ---------------- Web pública ----------------
async function publica() {
    out('\n=== WEB PÚBLICA (index.html) ===');
    await cargar('index.html');
    const errores = salida.filter(s => s.startsWith('JS ERROR')).length;
    // Tablas
    const S = standings('superior');
    for (const g of ['A', 'B', 'C']) {
        D().querySelector(`.tabs-sup .tab-btn[data-grupo-val="${g}"]`).click();
        const filas = [...D().querySelectorAll('.tbody-sup tr')].map(tr => ({ n: tr.querySelector('.td-team-name').textContent.trim(), pts: +tr.querySelector('.td-pts-total').textContent, pj: +tr.cells[2].textContent, clase: tr.className }));
        const esp = S.porGrupo[g].map(x => ({ n: x.n, pts: x.pts, pj: x.pj }));
        check(JSON.stringify(filas.map(f => [f.n, f.pts, f.pj])) === JSON.stringify(esp.map(x => [x.n, x.pts, x.pj])), `Tabla Grupo ${g}: orden, PTS y PJ correctos (PTS→DIF→GF, quita manual y 3-0 incluidos)`, { web: filas.map(f => `${f.n} ${f.pts}pts ${f.pj}pj`), esperado: esp.map(x => `${x.n} ${x.pts}pts ${x.pj}pj`) });
        check(filas.slice(0, 3).every(f => f.clase === 'row-leader'), `Grupo ${g}: top 3 resaltado`);
    }
    const cuartos = ['A', 'B', 'C'].map(g => S.porGrupo[g][3]);
    const mejor4 = S.orden(cuartos)[0];
    D().querySelector(`.tabs-sup .tab-btn[data-grupo-val="${mejor4.g}"]`).click();
    const fila4 = [...D().querySelectorAll('.tbody-sup tr')][3];
    check(fila4 && fila4.className === 'row-mejor4to' && fila4.textContent.includes(mejor4.n), 'Mejor 4° resaltado en su grupo', { esperado: mejor4.n, grupo: mejor4.g });
    const B = standings('basico').porGrupo.A;
    const filasB = [...D().querySelectorAll('.tbody-bas tr')].map(tr => tr.querySelector('.td-team-name').textContent.trim() + ' ' + tr.querySelector('.td-pts-total').textContent);
    check(JSON.stringify(filasB) === JSON.stringify(B.map(x => x.n + ' ' + x.pts)), 'Tabla Básico correcta', { web: filasB, esperado: B.map(x => x.n + ' ' + x.pts) });

    // Goleadores
    const todosJug = Object.entries(planteles).filter(([e]) => Object.values(SUP).flat().includes(e)).flatMap(([e, js]) => js.map(j => ({ ...j, e })));
    const top = todosJug.map(j => ({ n: j.nombre, e: j.e, g: esperado.goles[j.dni] || 0 })).filter(x => x.g > 0).sort((a, b) => b.g - a.g);
    const tbodyG = [...D().querySelectorAll('#tbody-goleadores tr')].map(tr => ({ n: tr.cells[1].textContent.trim(), e: tr.cells[2].textContent.trim(), g: +tr.cells[3].textContent }));
    const maxEsp = top[0] ? top[0].g : 0;
    check(tbodyG.length > 0 && tbodyG[0].g === maxEsp, 'Goleadores Superior: el máximo coincide con lo cargado', { web: tbodyG.slice(0, 3), esperadoMax: maxEsp, candidatos: top.filter(x => x.g === maxEsp).map(x => x.n) });
    const malG = tbodyG.filter(t => { const x = top.find(y => y.n === t.n && y.e === t.e); return !x || x.g !== t.g; });
    check(malG.length === 0, 'Cada goleador del top 10 tiene la cantidad esperada', malG);

    // Modal de equipo: PJ, goles, tarjetas, dorsal 0
    const revisarModal = (equipo) => {
        const celda = [...D().querySelectorAll('.td-team-name')].find(c => c.textContent.trim() === equipo);
        const grupo = Object.entries(SUP).find(([, eqs]) => eqs.includes(equipo))?.[0];
        if (!celda && grupo) D().querySelector(`.tabs-sup .tab-btn[data-grupo-val="${grupo}"]`).click();
        const c2 = [...D().querySelectorAll('.td-team-name')].find(c => c.textContent.trim() === equipo);
        c2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const filas = [...D().querySelectorAll('#modal-equipo-tbody-jugadores tr')].map(tr => ({ dorsal: tr.cells[1].textContent.trim(), n: tr.cells[2].textContent.trim(), pj: +tr.cells[3].textContent, g: +tr.cells[4].textContent, am: +tr.cells[5].textContent, ro: +tr.cells[6].textContent }));
        const mal = [];
        planteles[equipo].forEach(j => {
            const f = filas.find(x => x.n === j.nombre);
            const e = { pj: esperado.pj[j.dni] || 0, g: esperado.goles[j.dni] || 0, am: esperado.amarillas[j.dni] || 0, ro: esperado.rojas[j.dni] || 0 };
            if (!f || f.pj !== e.pj || f.g !== e.g || f.am !== e.am || f.ro !== e.ro) mal.push({ jugador: j.nombre, web: f && { pj: f.pj, g: f.g, am: f.am, ro: f.ro }, esperado: e });
        });
        return { filas, mal };
    };
    for (const eq of ['4to 1ra', '5to 2da', '4to 2da', '5to 1ra', '7mo 3ra', '7mo 2da']) {
        const { filas, mal } = revisarModal(eq);
        check(mal.length === 0, `Modal ${eq}: PJ / goles / amarillas / rojas por jugador`, mal);
        if (eq === '4to 1ra') {
            const cero = filas.find(f => f.n === jug('4to 1ra', 0).nombre);
            check(cero && cero.dorsal === '#0', 'Modal público muestra el dorsal #0', cero && cero.dorsal);
        }
        if (eq === '5to 1ra') {
            const txtPartidos = D().getElementById('modal-equipo-lista-partidos').textContent;
            check(/3 - 0/.test(txtPartidos), 'Modal 5to 1ra muestra el 3-0 automático');
        }
        if (eq === '7mo 3ra') {
            const txtPartidos = D().getElementById('modal-equipo-lista-partidos').innerHTML;
            check(/Quita levantada/.test(txtPartidos), 'Modal 7mo 3ra: banner "Quita levantada" en la F2');
        }
        if (eq === '4to 1ra') {
            const cards = [...D().querySelectorAll('#modal-equipo-lista-partidos .match-card-desplegable')];
            const titulos = cards.map(c => c.querySelector('.col-center span').textContent.trim());
            out('  info: fechas en el modal de 4to 1ra: ' + titulos.join(' | '));
            const c1 = cards[0];
            c1.click();
            const abierto = !c1.querySelector('.match-details-drawer').classList.contains('seccion-oculta');
            const txt = c1.querySelector('.match-details-drawer').textContent;
            check(abierto && txt.includes(jug('4to 1ra', 0).nombre + ' (#0)') && /x2/.test(txt) && !/\(2\)/.test(txt), 'Desplegable del modal (F1): goleadores con el formato nuevo "(#0) x2"', txt.replace(/\s+/g, ' ').trim());
            const drw = c1.querySelector('.match-details-drawer');
            const am = [...drw.querySelectorAll('.tarjeta-amarilla')].map(x => x.parentElement.textContent.replace(/\s+/g, ' ').trim());
            const ro = [...drw.querySelectorAll('.tarjeta-roja')].map(x => x.parentElement.textContent.replace(/\s+/g, ' ').trim());
            check(am.some(t => t.includes(jug('4to 1ra', 5).nombre + ' (#5)') && /x2/.test(t)) && am.some(t => t.includes(jug('5to 2da', 7).nombre)) && ro.some(t => t.includes(jug('5to 2da', 9).nombre + ' (#9)')), 'Desplegable del modal muestra las tarjetas del partido (2 amarillas #5, amarilla #7 rival, roja #9 rival)', { am, ro });
            const esperadoOrden = ['FECHA 1', 'FECHA 2', 'FECHA 3'];
            check(titulos.slice(0, 3).join('|') === esperadoOrden.join('|') && titulos.slice(3).every(t => !/10[0-8]/.test(t)) && titulos.indexOf(titulos.find(t => /CUARTOS/i.test(t))) < titulos.indexOf(titulos.find(t => /SEMI/i.test(t))), 'Modal: playoffs en orden y con nombre de ronda', titulos);
        }
        D().getElementById('modal-equipo').classList.add('seccion-oculta');
    }

    // Fixture (pantalla de partidos)
    const navFix = D().querySelector('.nav-item[href="#pantalla-fixture"]'); navFix.click();
    await esperar(5);
    const activaInicial = D().querySelector('.btn-fecha-select.active');
    check(activaInicial && activaInicial.dataset.fecha === '3', 'Fixture abre en la última fecha de grupos con resultados (Fecha 3)', activaInicial && activaInicial.textContent);
    for (const f of [1, 2, 3]) {
        const btn = D().querySelector(`.btn-fecha-select[data-fecha="${f}"]`); btn.click();
        const cards = [...D().querySelectorAll('#contenedor-partidos-fecha .match-card-desplegable')];
        check(cards.length === 8, `Fixture Fecha ${f}: 8 partidos`, cards.length);
        const malos = [];
        RESULTADOS.filter(r => r.fecha === f).forEach(r => {
            const card = cards.find(c => c.querySelector('.col-local .team-name').textContent === r.L && c.querySelector('.col-visita .team-name').textContent === r.V);
            if (!card) { malos.push(r.L + ' no encontrado'); return; }
            card.click();
            const score = card.querySelector('.score-main')?.textContent;
            const cols = card.querySelectorAll('.split-col');
            const cuenta = el => !el ? -1 : [...el.querySelectorAll('div')].filter(d => !d.querySelector('.tarjeta-ico')).reduce((a, d) => { const m = d.textContent.match(/x(\d+)\s*$/); const esGol = /\(#\d+\)/.test(d.textContent); return a + (esGol ? (m ? +m[1] : 1) : 0); }, 0);
            const gl = r.dl.filter(d => jug(r.L, d)).length, gv = r.dv.filter(d => jug(r.V, d)).length;
            if (score !== `${r.gl} - ${r.gv}` || cuenta(cols[0]) !== gl || cuenta(cols[1]) !== gv || card.querySelector('.match-details-drawer').classList.contains('seccion-oculta'))
                malos.push({ p: r.L + ' vs ' + r.V, score, golesEnDesplegable: [cuenta(cols[0]), cuenta(cols[1])], esperado: [gl, gv] });
        });
        check(malos.length === 0, `Fixture Fecha ${f}: marcador y goleadores en cada desplegable`, malos);
    }
    const botonesFecha = [...D().querySelectorAll('.btn-fecha-select')].map(b => b.dataset.fecha + ':' + b.textContent.trim());
    check(botonesFecha.join(' | ') === '1:Fecha 1 | 2:Fecha 2 | 3:Fecha 3 | 104:Cuartos | 102:Semifinal | 100:Final', 'Fixture público: botones de las 3 fechas y de las rondas de playoff con sus nombres', botonesFecha);
    // Partidos de playoff en el fixture
    const btnCuartos = D().querySelector('.btn-fecha-select[data-fecha="104"]');
    btnCuartos.click();
    await esperar(3);
    const cardsPO = [...D().querySelectorAll('#contenedor-partidos-fecha .match-card-desplegable')];
    const sepPO = [...D().querySelectorAll('#contenedor-partidos-fecha div')].map(x => x.textContent.trim()).filter(t => /SUPERIOR|CUARTOS/i.test(t) && t.length < 40);
    const cardC1 = cardsPO.find(c => c.querySelector('.col-local .team-name').textContent === crucesPublico[0][0]);
    if (cardC1) cardC1.click();
    const golesC1 = cardC1 ? [...cardC1.querySelectorAll('.split-col.col-left div')].filter(d => !d.querySelector('.tarjeta-ico')).length : -1;
    check(cardsPO.length === 4 && sepPO.some(t => /Superior — CUARTOS/i.test(t)) && golesC1 === 2, 'Fixture: los Cuartos muestran sus 4 partidos, el título "Superior — CUARTOS" y sus goleadores', { partidos: cardsPO.length, titulos: sepPO.slice(0, 3), goleadoresLlave1: golesC1 });
    const btnFinal = D().querySelector('.btn-fecha-select[data-fecha="100"]');
    btnFinal.click();
    await esperar(3);
    const cardsFinal = [...D().querySelectorAll('#contenedor-partidos-fecha .match-card-desplegable')];
    check(cardsFinal.length === 2, 'Fixture: la Final muestra las dos finales (Superior y Básico)', cardsFinal.length);
    out('  info: playoffs en el fixture público: sin decidir (no se cuenta como falla).');
    const ultimos = D().querySelector('#pantalla-fixture h2')?.textContent;
    out('  info: "Últimos partidos" muestra: ' + (ultimos || '').replace(/\s+/g, ' '));

    check(!/SE ACERCA LA FINAL/i.test(D().body.textContent), 'El hero ya no trae la noticia fija "SE ACERCA LA FINAL"');
    check(D().querySelectorAll('#galeria-fotos-grid .foto-card').length === 0 && /Todavía no hay álbumes/.test((D().getElementById('galeria-fotos-grid')||{textContent:''}).textContent) && docsFS('albumes') === 0, 'Álbumes: sin semilla del torneo anterior, cartel de vacío y la web pública no escribe nada en Firestore', { guardados: docsFS('albumes'), texto: (D().getElementById('galeria-fotos-grid')||{textContent:''}).textContent.trim().slice(0,40) });
    // Tribunal
    const sanciones = LS('liga_sanciones');
    D().getElementById('btn-toggle-tribunal').click();
    const botonesActa = [...D().querySelectorAll('#selector-fechas-tribunal .tab-btn')].map(b => b.textContent);
    check(new Set(botonesActa).size === botonesActa.length, 'Tribunal público: sin botones de acta duplicados', botonesActa);
    const detalle = D().getElementById('contenido-acta-detalle');
    const btnActa1 = [...D().querySelectorAll('#selector-fechas-tribunal .tab-btn')].find(b => b.textContent === 'Acta N° 1');
    btnActa1 && btnActa1.click();
    check(/2 fechas de suspensión/.test(detalle.textContent), 'Tribunal Acta 1: "2 fechas de suspensión" del #9', detalle.textContent.replace(/\s+/g, ' ').slice(0, 200));
    const btnActa2 = [...D().querySelectorAll('#selector-fechas-tribunal .tab-btn')].filter(b => b.textContent === 'Acta N° 2');
    btnActa2.forEach(b => b.click());
    out('  info: actas en el Tribunal: ' + botonesActa.join(', ') + ' | tipos de acta guardados: ' + sanciones.map(s => typeof s.acta + ':' + s.acta).join(', '));

    // Playoffs públicos
    const tp = D().getElementById('toggle-titulo-playoffs'); tp && tp.click();
    await esperar(3);
    const champ = D().querySelector('.champion-box h3')?.textContent.trim();
    check(champ === campeonSup, 'Bracket Superior: campeón correcto', { web: champ, esperado: campeonSup });
    const rondasPub = [...D().querySelectorAll('#bracket-main .round-title')].map(x => x.textContent);
    check(JSON.stringify(rondasPub) === JSON.stringify(['CUARTOS', 'SEMIS', 'FINAL']), 'Bracket Superior arranca en Cuartos', rondasPub);
    const btnOct = D().querySelector('.btn-ronda-nav[data-ronda-target="octavos"]');
    const activa = D().querySelector('.btn-ronda-nav.active');
    check(btnOct && btnOct.offsetParent === null && activa && activa.dataset.rondaTarget === 'cuartos', 'Bracket: botón Octavos oculto y la pestaña activa es Cuartos', { octavosVisible: btnOct && btnOct.offsetParent !== null, activa: activa && activa.dataset.rondaTarget });
    const penales = D().querySelectorAll('#bracket-main .score-penal').length;
    check(penales === 4, 'Bracket muestra los penales de los 2 partidos definidos por penales', penales);
    const aDefinir = [...D().querySelectorAll('#bracket-main .bracket-match')].filter(b => /A definir/.test(b.textContent)).length;
    check(aDefinir === 0, 'Bracket completo sin casilleros "A definir"', aDefinir);
    const btnBas = D().querySelector('.btn-playoff-ciclo[data-ciclo-playoff="basico"]'); btnBas && btnBas.click();
    const champB = D().querySelector('.champion-box h3')?.textContent.trim();
    check(champB === campeonBas, 'Bracket Básico: campeón correcto (final por penales)', { web: champB, esperado: campeonBas });

    // Avisos
    const avisos = D().getElementById('contenedor-lista-notificaciones')?.textContent || '';
    check(/Fecha 4 suspendida por lluvia/.test(avisos), 'Campanita muestra el aviso publicado');
    check(!/Fechas reprogramadas/.test(avisos), 'La campanita no mezcla los avisos de ejemplo cuando ya hay avisos reales', avisos.replace(/\s+/g, ' ').slice(0, 160));

    // Búsqueda
    const inp = D().getElementById('global-search-input');
    inp.value = '7mo 3'; inp.dispatchEvent(new Event('input'));
    const res = [...D().querySelectorAll('.search-result-item .search-item-name')].map(x => x.textContent);
    check(res.includes('7mo 3ra'), 'Buscador encuentra "7mo 3ra"', res);
    const errDesp = salida.filter(s => s.startsWith('JS ERROR')).length;
    check(errDesp === 0, 'Sin errores de JavaScript en toda la simulación', errDesp);
}


// ---------------- Sponsors (alta, ubicación, edición, orden, baja) ----------------

// Espera a que la compresión termine (la vista previa recibe el dataURL). Con tiempo virtual un setTimeout fijo no alcanza.
// Con --virtual-time-budget el reloj de la página corre más rápido que la compresión real de la imagen: margen amplio.
async function esperarPreview(idPreview, intentos = 2000) {
    for (let i = 0; i < intentos; i++) {
        const prev = D().getElementById(idPreview);
        if (prev && String(prev.src || '').indexOf('data:image/') === 0) return true;
        await esperar(50);
    }
    out('  (no se cargó la vista previa ' + idPreview + ')');
    return false;
}

let pesoLogoOriginal = 0;
// Logo "de verdad": una imagen grande y ruidosa (PNG de varios MB), como la que mandaría un sponsor.
function subirLogo(input) {
    return new Promise(res => {
        const w = W();
        const canvas = w.document.createElement('canvas');
        canvas.width = 2400; canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(2400, 1600);
        for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = (i * 7) % 255; img.data[i + 1] = (i * 13) % 255; img.data[i + 2] = (i * 29) % 255; img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        ctx.fillStyle = '#ff9900'; ctx.fillRect(100, 100, 900, 700);
        canvas.toBlob(blob => {
            pesoLogoOriginal = blob.size;
            const archivo = new w.File([blob], 'logo-grande.png', { type: 'image/png' });
            const dt = new w.DataTransfer();
            dt.items.add(archivo);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(res, 50);
        }, 'image/png');
    });
}
function medirImagen(dataURL) {
    return new Promise(res => {
        const im = new (W().Image)();
        im.onload = () => res({ ancho: im.width, alto: im.height });
        im.onerror = () => res({ ancho: -1, alto: -1 });
        im.src = dataURL;
    });
}
async function altaSponsor(sp) {
    setv('sponsor-nombre', sp.nombre, false);
    setv('sponsor-categoria', sp.categoria, false);
    setv('sponsor-descripcion', sp.descripcion, false);
    setv('sponsor-beneficio', sp.beneficio, false);
    setv('sponsor-color-fondo', sp.color, false);
    setv('sponsor-instagram', sp.instagram || '', false);
    setv('sponsor-telefono', sp.telefono || '', false);
    setv('sponsor-link', sp.link || '', false);
    setv('sponsor-ubicacion', sp.ubicacion || '', false);
    if (sp.conLogo) { await subirLogo(el('sponsor-logo-file')); await esperarPreview('sponsor-logo-preview'); }
    await enviar('form-sponsor-admin');
    await esperar(3);
}
const SPONSORS = [
    { nombre: 'Kiosco El Gol', categoria: 'Sponsor Oficial', descripcion: 'Bebidas y snacks para las dos canchas.', beneficio: '10% de descuento presentando el carnet.', color: '#112233', instagram: '@kioscoelgol', telefono: '221 555-0001', link: 'https://kioscoelgol.com', ubicacion: 'https://maps.google.com/?q=kiosco+el+gol', conLogo: true },
    { nombre: 'Panadería La Mitre', categoria: 'Colaborador', descripcion: 'Facturas para el staff cada fecha.', beneficio: 'Docena de facturas al equipo campeón.', color: '#884400', telefono: '221 555-0002', ubicacion: 'Av. Mitre 1234, Berazategui' },
    { nombre: 'Radio Local FM', categoria: 'Media Partner', descripcion: 'Transmite la final.', beneficio: 'Menciones al aire.', color: '#005544', instagram: '@radiolocalfm' }
];
async function sponsors() {
    out('\n=== SPONSORS: alta con logo, ubicación, edición, orden y baja ===');
    await cargar('admin.html');
    await tab('sec-prensa');
    check(/Todavía no hay sponsors/.test(el('lista-sponsors-admin').textContent), 'Admin arranca sin sponsors (semilla vacía)', el('lista-sponsors-admin').textContent.trim().slice(0, 60));
    for (const sp of SPONSORS) await altaSponsor(sp);
    const guardados = LS('liga_sponsors') || [];
    const porNombre = n => guardados.find(s => s.nombre === n);
    check(guardados.length === 3, 'Se guardaron los 3 sponsors', guardados.map(s => s.nombre));
    const a = porNombre('Kiosco El Gol'), b = porNombre('Panadería La Mitre'), c = porNombre('Radio Local FM');
    check(a && a.ubicacion === 'https://maps.google.com/?q=kiosco+el+gol' && b.ubicacion === 'Av. Mitre 1234, Berazategui' && !c.ubicacion, 'Ubicación guardada: link, texto y vacía', { a: a && a.ubicacion, b: b && b.ubicacion, c: c && c.ubicacion });
    check(a && a.categoria === 'Sponsor Oficial' && a.colorFondo === '#112233' && a.instagram === 'kioscoelgol' && a.telefono === '221 555-0001' && a.link === 'https://kioscoelgol.com' && a.beneficio.indexOf('10%') >= 0, 'Sponsor completo: categoría, color, Instagram (sin @), teléfono, link y beneficio', a);
    const subLogo = a && subidaDe(a.logo);
    const medidas = subLogo ? await medirImagen(subLogo.dataURL) : { ancho: -1, alto: -1 };
    check(a && esUrlNube(a.logo) && !!subLogo && subLogo.preset === 'preset-de-prueba', 'El logo va a Cloudinary (con el preset configurado) y el sponsor guarda solo la URL', a && String(a.logo).slice(0, 70));
    check(subLogo && subLogo.formato === 'image/jpeg' && subLogo.bytes < pesoLogoOriginal / 4 && subLogo.bytes < 300 * 1024,
        'Logo grande: se sube comprimido (JPEG, mucho más liviano que el original)',
        { originalKB: Math.round(pesoLogoOriginal / 1024), subidoKB: subLogo && Math.round(subLogo.bytes / 1024), formato: subLogo && subLogo.formato });
    check(medidas.ancho <= 500 && medidas.alto <= 500 && medidas.ancho > 0 && medidas.alto > 0,
        'El logo se redimensiona a 500 px de lado máximo y sigue siendo una imagen válida', medidas);
    check(b && b.logo === 'Recursos/logo pelota fut.svg', 'Sponsor sin logo usa el logo por defecto', b && b.logo);
    check(guardados.map(s => s.orden).join(',') === '0,1,2', 'Orden asignado por alta (0, 1, 2)', guardados.map(s => s.nombre + ':' + s.orden));

    D().querySelector('.btn-sponsor-editar[data-id="' + a.id + '"]').click();
    check(el('sponsor-ubicacion').value === a.ubicacion && el('sponsor-instagram').value === 'kioscoelgol' && el('sponsor-color-fondo').value === '#112233', 'Al editar se precargan ubicación, Instagram y color', { ubicacion: el('sponsor-ubicacion').value, ig: el('sponsor-instagram').value });
    setv('sponsor-descripcion', 'Bebidas, snacks y hielo para las dos canchas.', false);
    setv('sponsor-ubicacion', 'https://maps.google.com/?q=kiosco+nuevo', false);
    await enviar('form-sponsor-admin');
    const a2 = (LS('liga_sponsors') || []).find(s => s.id === a.id);
    check(a2 && a2.descripcion.indexOf('hielo') >= 0 && /kiosco\+nuevo$/.test(a2.ubicacion) && a2.logo === a.logo && a2.orden === 0 && (LS('liga_sponsors') || []).length === 3, 'Editar guarda los cambios, conserva el logo y el orden, y no duplica', a2 && { desc: a2.descripcion, ubi: a2.ubicacion, orden: a2.orden });

    D().querySelector('.btn-sponsor-bajar[data-id="' + a.id + '"]').click();
    await esperar(2);
    const ord1 = (LS('liga_sponsors') || []).slice().sort((x, y) => x.orden - y.orden).map(s => s.nombre);
    check(ord1[0] === 'Panadería La Mitre' && ord1[1] === 'Kiosco El Gol', 'Botón Bajar reordena el sponsor', ord1);
    D().querySelector('.btn-sponsor-subir[data-id="' + a.id + '"]').click();
    await esperar(2);
    const ord2 = (LS('liga_sponsors') || []).slice().sort((x, y) => x.orden - y.orden).map(s => s.nombre);
    check(ord2[0] === 'Kiosco El Gol', 'Botón Subir lo devuelve al primer lugar', ord2);

    await cargar('index.html');
    const tarjetas = [...D().querySelectorAll('#sponsors-track .sponsor-card-full')];
    check(tarjetas.length === 3, 'Carrusel público muestra los 3 sponsors', tarjetas.length);
    const tarjetaDe = n => tarjetas.find(t => t.querySelector('h4').textContent.trim() === n);
    const tA = tarjetaDe('Kiosco El Gol'), tB = tarjetaDe('Panadería La Mitre'), tC = tarjetaDe('Radio Local FM');
    const ubiA = tA && tA.querySelector('.sponsor-ubicacion'), ubiB = tB && tB.querySelector('.sponsor-ubicacion'), ubiC = tC && tC.querySelector('.sponsor-ubicacion');
    check(ubiA && ubiA.tagName === 'A' && ubiA.getAttribute('href') === 'https://maps.google.com/?q=kiosco+nuevo' && ubiA.target === '_blank', 'Ubicación que arranca con http se muestra como link que abre en otra pestaña', ubiA && { tag: ubiA.tagName, href: ubiA.getAttribute('href') });
    check(ubiB && ubiB.tagName === 'SPAN' && ubiB.textContent.indexOf('Av. Mitre 1234') >= 0, 'Ubicación de texto se muestra sin link', ubiB && { tag: ubiB.tagName, txt: ubiB.textContent.trim() });
    check(!ubiC, 'Sponsor sin ubicación no muestra nada', ubiC && ubiC.outerHTML);
    const contactos = t => [...t.querySelectorAll('.sponsor-contacto-link')].filter(x => !x.classList.contains('sponsor-ubicacion')).map(x => x.textContent.trim());
    check(JSON.stringify(contactos(tA)) === JSON.stringify(['@kioscoelgol', '221 555-0001']), 'Con Instagram y teléfono se muestran los dos', contactos(tA));
    check(JSON.stringify(contactos(tB)) === JSON.stringify(['221 555-0002']), 'Sin Instagram se muestra el teléfono', contactos(tB));
    check(tA.getAttribute('style').indexOf('112233') >= 0 && !!tA.querySelector('.sponsor-badge') && tA.querySelector('.sponsor-badge').textContent === 'Sponsor Oficial', 'Color de fondo y categoría en la tarjeta pública', tA.getAttribute('style'));
    const logoPub = tA.querySelector('.sponsor-logo');
    check(logoPub && logoPub.getAttribute('src') === a.logo, 'La tarjeta del carrusel muestra el logo desde Cloudinary', logoPub && logoPub.getAttribute('src'));
    const ben = tA.querySelector('.beneficio-secreto');
    check(ben && ben.textContent.indexOf('10%') >= 0 && ben.querySelector('a') && ben.querySelector('a').getAttribute('href') === 'https://kioscoelgol.com', 'Beneficio y "Más información" con el link del sponsor', ben && ben.textContent.replace(/\s+/g, ' ').trim().slice(0, 60));

    await cargar('admin.html');
    await tab('sec-prensa');
    respuestaConfirm = false;
    D().querySelector('.btn-sponsor-borrar[data-id="' + b.id + '"]').click();
    check((LS('liga_sponsors') || []).length === 3, 'Cancelar la eliminación no borra el sponsor');
    respuestaConfirm = true;
    D().querySelector('.btn-sponsor-borrar[data-id="' + c.id + '"]').click();
    await esperar(2);
    const quedan = LS('liga_sponsors') || [];
    check(quedan.length === 2 && !quedan.some(s => s.id === c.id), 'Eliminar saca el sponsor de la lista', quedan.map(s => s.nombre));
    await cargar('index.html');
    const tarjetas2 = [...D().querySelectorAll('#sponsors-track .sponsor-card-full')].map(t => t.querySelector('h4').textContent.trim());
    check(tarjetas2.length === 2 && tarjetas2.indexOf('Radio Local FM') === -1, 'El sponsor eliminado desaparece del carrusel público', tarjetas2);
}


// ---------------- Prensa (noticias y álbumes), egresos, balance, campanita y responsive ----------------
function subirImagen(input, ancho, alto, espera) {
    return new Promise(res => {
        const w = W();
        const canvas = w.document.createElement('canvas');
        canvas.width = ancho; canvas.height = alto;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(ancho, alto);
        for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = (i * 11) % 255; img.data[i + 1] = (i * 17) % 255; img.data[i + 2] = (i * 23) % 255; img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        canvas.toBlob(blob => {
            pesoUltimaImagen = blob.size;
            const archivo = new w.File([blob], 'foto.png', { type: 'image/png' });
            const dt = new w.DataTransfer();
            dt.items.add(archivo);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(res, espera || 50);
        }, 'image/png');
    });
}
let pesoUltimaImagen = 0;

async function fotoJugador() {
    out('\n=== FOTO DE JUGADOR: se sube a Cloudinary y se conserva al editar ===');
    await cargar('admin.html');
    await tab('sec-planteles');
    el('btn-sub-plantel-jugadores').click();
    setv('plantel-ciclo', 'superior'); setv('plantel-equipo-select', '4to 1ra');
    const j = jug('4to 1ra', 9);
    const fichaDe = () => (LS('liga_cicloSuperior') || []).find(e => e.nombre === '4to 1ra').jugadores.find(x => x.dni === j.dni);
    D().querySelector(`.btn-editar-jugador[data-dni="${j.dni}"]`).click();
    await subirImagen(el('jugador-foto-file'), 900, 1200);
    await esperarPreview('jugador-foto-preview');
    await enviar('form-jugador');
    const f1 = fichaDe();
    const sub = f1 && subidaDe(f1.foto);
    const medidas = sub ? await medirImagen(sub.dataURL) : { ancho: -1, alto: -1 };
    check(f1 && esUrlNube(f1.foto) && sub && sub.formato === 'image/jpeg' && Math.max(medidas.ancho, medidas.alto) === 250, 'Foto de jugador: se sube a Cloudinary achicada a 250 px y la ficha guarda la URL', { foto: f1 && String(f1.foto).slice(0, 70), medidas });
    const subidasAntes = cantidadSubidas();
    D().querySelector(`.btn-editar-jugador[data-dni="${j.dni}"]`).click();
    check(el('jugador-foto').value === '' && el('jugador-foto-preview').getAttribute('src') === (f1 && f1.foto), 'Al editar, la foto ya subida aparece en la vista previa y no en el campo de texto', { campo: el('jugador-foto').value, preview: el('jugador-foto-preview').getAttribute('src') });
    setv('jugador-instagram', 'foto_nueva_ig', false);
    await enviar('form-jugador');
    const f2 = fichaDe();
    check(f2 && f1 && f2.foto === f1.foto && f2.instagram === 'foto_nueva_ig' && cantidadSubidas() === subidasAntes, 'Guardar la ficha otra vez conserva la foto sin volver a subirla', { mismaFoto: !!(f2 && f1 && f2.foto === f1.foto), subidasNuevas: cantidadSubidas() - subidasAntes });
    await cargar('index.html');
    const publico = ((LS('liga_cicloSuperior') || []).find(e => e.nombre === '4to 1ra') || { jugadores: [] }).jugadores.find(x => x.nombre === j.nombre);
    check(publico && f1 && publico.foto === f1.foto, 'La web pública recibe la URL de la foto del jugador', publico && String(publico.foto).slice(0, 70));
    check(!/data:image/.test(localStorage.getItem('fakefs') || ''), 'Ninguna imagen quedó guardada dentro de Firestore: solo URLs');
}

async function resumenPublico() {
    out('\n=== RESUMEN PARA LA WEB PÚBLICA (torneo completo cargado) ===');
    await cargar('admin.html');
    await esperar(11000);
    await cargar('index.html');
    const fsd = JSON.parse(localStorage.getItem('fakefs') || '{}');
    const documentos = ['equipos', 'partidos', 'sanciones', 'noticias', 'albumes', 'sponsors', 'notificaciones', 'crucesPlayoffs', 'config'].reduce((t, c) => t + Object.keys(fsd[c] || {}).length, 0);
    check(W().__lecturasIniciales === 4, 'Abrir la web lee 4 documentos en vez de uno por cada partido, equipo, sanción, etc.', { lecturas: W().__lecturasIniciales, documentosPublicos: documentos });
    const pesos = Object.fromEntries(Object.entries(fsd.resumen || {}).map(([k, v]) => [k, v.datos ? Math.round(v.datos.length / 1024) + ' KB' : 'demasiado grande']));
    check(Object.keys(pesos).length === 4 && Object.values(fsd.resumen).every(v => v.datos), 'Las 4 secciones del resumen están publicadas y ninguna pasa el tope', pesos);
}

async function prensa() {
    out('\n=== PRENSA: noticias con foto, álbumes y galería ===');
    await cargar('admin.html');
    await tab('sec-prensa');
    // Noticia sin foto: se rechaza
    setv('noticia-titulo', 'Sin foto', false); setv('noticia-texto', 'prueba', false);
    await enviar('form-noticia-admin');
    check(/Falta la foto/.test(ultimaAlerta()) && (LS('liga_noticias') || []).length === 0, 'Noticia sin foto se rechaza', ultimaAlerta());
    // Noticia 1: foto subida como archivo
    setv('noticia-titulo', 'ARRANCÓ EL CLAUSURA', false);
    setv('noticia-texto', 'Se jugó la primera fecha con las dos canchas llenas.', false);
    setv('noticia-link-url', 'https://instagram.com/mitreleague', false);
    setv('noticia-link-texto', 'VER FOTOS', false);
    await subirImagen(el('noticia-foto-file'), 1800, 1200);
    await esperarPreview('noticia-foto-preview');
    const pesoOriginalNoticia = pesoUltimaImagen;
    const botonNoticia = el('form-noticia-admin').querySelector('button[type="submit"]');
    localStorage.setItem('fake_cloudinary_falla', 'red');
    await enviar('form-noticia-admin');
    check(/No se pudo subir la foto: no hay conexión/.test(ultimaAlerta()) && (LS('liga_noticias') || []).length === 0 && !botonNoticia.disabled && /PUBLICAR NOTICIA/.test(botonNoticia.textContent),
        'Sin conexión con Cloudinary: avisa, no guarda la noticia y el botón vuelve a quedar habilitado', { alerta: ultimaAlerta(), boton: botonNoticia.textContent });
    localStorage.setItem('fake_cloudinary_falla', 'rechazo');
    await enviar('form-noticia-admin');
    check(/Upload preset not found/.test(ultimaAlerta()) && (LS('liga_noticias') || []).length === 0, 'Si Cloudinary rechaza la subida (por ejemplo, preset mal escrito) muestra su mensaje y no guarda', ultimaAlerta());
    localStorage.removeItem('fake_cloudinary_falla');
    await enviar('form-noticia-admin');
    // Noticia 2: foto por ruta de texto
    setv('noticia-titulo', 'GOLEADA EN EL GRUPO B', false);
    setv('noticia-texto', 'El 4to 2da se llevó el clásico.', false);
    setv('noticia-foto', 'Recursos/Fotos/DSC05325.JPG', false);
    await enviar('form-noticia-admin');
    const noticias = LS('liga_noticias') || [];
    check(noticias.length === 2, 'Se guardaron las 2 noticias', noticias.map(n => n.titulo));
    const n1 = noticias[0] || {}, n2 = noticias[1] || {};
    const subN1 = subidaDe(n1.foto);
    check(esUrlNube(n1.foto) && subN1 && subN1.formato === 'image/jpeg' && subN1.bytes < pesoOriginalNoticia / 3, 'Reintentar después de la falla funciona: la foto va comprimida (JPEG) a Cloudinary y la noticia guarda solo la URL',
        { originalKB: Math.round(pesoOriginalNoticia / 1024), subidaKB: subN1 && Math.round(subN1.bytes / 1024), foto: String(n1.foto).slice(0, 70) });
    check(n2 && n2.foto === 'Recursos/Fotos/DSC05325.JPG' && n1.linkUrl === 'https://instagram.com/mitreleague' && n1.linkTexto === 'VER FOTOS', 'Noticia por ruta de texto y link guardados', { foto: n2.foto, link: n1.linkUrl, texto: n1.linkTexto });
    check(D().getElementById('lista-noticias-admin').querySelectorAll('button').length >= 2, 'El panel lista las noticias con su botón');

    // Álbumes: uno con portada subida y otro por ruta
    setv('foto-album-titulo', 'Fecha 1 — Cancha 1', false);
    await subirImagen(el('foto-album-portada-file'), 1600, 1000);
    await esperarPreview('foto-album-portada-preview');
    const pesoOriginalAlbum = pesoUltimaImagen;
    setv('foto-album-link', 'https://drive.google.com/album1', false);
    await enviar('form-fotos-admin');
    setv('foto-album-titulo', 'Fecha 2 — Cancha 2', false);
    setv('foto-album-portada', 'Recursos/Fotos/DSC05325.JPG', false);
    setv('foto-album-link', 'https://drive.google.com/album2', false);
    await enviar('form-fotos-admin');
    const albumes = LS('liga_fotos_albumes') || [];
    check(albumes.length === 2, 'Se guardaron los 2 álbumes', albumes.map(a => a.titulo));
    const subAlb = albumes[0] && subidaDe(albumes[0].portada);
    check(albumes[0] && esUrlNube(albumes[0].portada) && subAlb && subAlb.bytes < pesoOriginalAlbum / 3, 'La portada subida va comprimida a Cloudinary y el álbum guarda la URL', { originalKB: Math.round(pesoOriginalAlbum / 1024), subidaKB: subAlb && Math.round(subAlb.bytes / 1024) });
    check(albumes[1] && albumes[1].portada === 'Recursos/Fotos/DSC05325.JPG', 'Álbum con portada por ruta de texto', albumes[1] && albumes[1].portada);
    setv('foto-album-titulo', 'Sin portada', false);
    await enviar('form-fotos-admin');
    check(/Falta la foto de portada/.test(ultimaAlerta()) && (LS('liga_fotos_albumes') || []).length === 2, 'Álbum sin portada se rechaza', ultimaAlerta());

    // Web pública: hero y galería
    await cargar('index.html');
    const tarjetasHero = [...D().querySelectorAll('.hero-card-3d')];
    const dots = [...D().querySelectorAll('.hero-dot-3d')];
    check(tarjetasHero.length === 2 && dots.length === 2, 'Hero: una tarjeta y un puntito por noticia (sin tarjetas fantasma)', { tarjetas: tarjetasHero.length, puntos: dots.length });
    const titulosHero = tarjetasHero.map(t => t.querySelector('h2').textContent.trim());
    check(titulosHero.includes('ARRANCÓ EL CLAUSURA') && titulosHero.includes('GOLEADA EN EL GRUPO B'), 'Hero muestra las noticias cargadas', titulosHero);
    const fondo = tarjetasHero[0].querySelector('.hero-card-bg').getAttribute('style');
    check(/res\.cloudinary\.com\/nube-de-prueba/.test(fondo), 'La foto subida (URL de Cloudinary) es el fondo de la tarjeta del hero', fondo.slice(0, 160));
    const btnNext = D().getElementById('next-hero');
    check(btnNext && !btnNext.hidden, 'Con 2 noticias, las flechas del hero quedan visibles');
    btnNext.click();
    await esperar(3);
    const centro = D().querySelector('.hero-card-3d.hero-center');
    check(centro && centro.querySelector('h2').textContent.trim() === titulosHero[1], 'La flecha del hero pasa a la noticia siguiente', centro && centro.querySelector('h2').textContent.trim());
    // Modal de noticia ampliada
    D().querySelector('.hero-card-3d.hero-center').click();
    await esperar(3);
    const modalN = D().getElementById('modal-noticia');
    const abiertoN = modalN && !modalN.classList.contains('seccion-oculta');
    check(abiertoN && D().getElementById('modal-noticia-titulo').textContent.includes(titulosHero[1]), 'Clic en la tarjeta abre el modal de la noticia', D().getElementById('modal-noticia-titulo').textContent);
    check(D().getElementById('modal-noticia-texto').textContent.length > 10 && D().getElementById('modal-noticia-img').src.length > 10, 'El modal trae texto y foto');
    const linkModal = D().querySelector('#modal-noticia-link-container a');
    D().querySelector('.close-modal-noticia').click();
    check(modalN.classList.contains('seccion-oculta'), 'El modal de la noticia se cierra');
    // Galería
    const nav = D().querySelector('.nav-item[href="#pantalla-fotos"]');
    if (nav) nav.click();
    await esperar(3);
    const tarjetasFoto = [...D().querySelectorAll('#galeria-fotos-grid .foto-card')];
    check(tarjetasFoto.length === 2, 'Galería pública muestra los 2 álbumes', tarjetasFoto.length);
    const titulosAlb = tarjetasFoto.map(t => t.querySelector('h4').textContent.trim());
    const portadas = tarjetasFoto.map(t => t.querySelector('.foto-bg').getAttribute('style'));
    check(titulosAlb.includes('Fecha 1 — Cancha 1') && portadas.some(x => /res\.cloudinary\.com\/nube-de-prueba/.test(x)) && portadas.some(x => /DSC05325/.test(x)), 'Los álbumes muestran su portada (subida y por ruta)', titulosAlb);
    check(tarjetasFoto.every(t => /drive\.google\.com/.test(t.getAttribute('href'))), 'Cada álbum enlaza a su link', tarjetasFoto.map(t => t.getAttribute('href')));
}

async function finanzas() {
    out('\n=== TESORERÍA: egresos y balance general ===');
    await cargar('admin.html');
    await tab('sec-tesoreria');
    el('btn-sub-teso-partidos').click();
    const teso = LS('liga_tesoreria_partidos_v2') || {};
    const insc = LS('liga_tesoreria_inscripciones') || {};
    const totalPartidos = Object.values(teso).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
    const totalInsc = Object.values(insc).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
    setv('egreso-concepto', 'varios', false);
    setv('egreso-detalle', 'Pelotas y pecheras (corralón)', false);
    setv('egreso-monto', '85000', false);
    setv('egreso-medio', 'efectivo', false);
    await enviar('form-egreso');
    setv('egreso-concepto', 'arbitros', false);
    setv('egreso-detalle', 'Terna Fecha 3', false);
    setv('egreso-monto', '40000', false);
    await enviar('form-egreso');
    const egresos = LS('liga_egresos') || [];
    check(egresos.length === 2 && egresos.reduce((a, e) => a + e.monto, 0) === 125000 && egresos.every(e => e.concepto && e.detalle), 'Se cargaron los 2 egresos ($125.000) con concepto y detalle', egresos.map(e => e.concepto + '/' + e.detalle + ':' + e.monto));
    check(/Pelotas y pecheras/.test(el('lista-egresos-admin').textContent) && /Terna Fecha 3/.test(el('lista-egresos-admin').textContent), 'El panel lista los dos egresos', el('lista-egresos-admin').textContent.replace(/\s+/g,' ').trim().slice(0,110));
    const num = t => Number(String(t).replace(/[^0-9-]/g, ''));
    const balance = {
        insc: num(el('txt-total-inscripciones').textContent),
        partidos: num(el('txt-total-partidos').textContent),
        egresos: num(el('txt-total-egresos').textContent),
        neto: num(el('txt-saldo-neto').textContent)
    };
    check(balance.partidos === totalPartidos && balance.insc === totalInsc && Math.abs(balance.egresos) === 125000 && balance.neto === totalInsc + totalPartidos - 125000,
        'Balance general: inscripciones + partidos - egresos = saldo neto', { balance, esperado: { insc: totalInsc, partidos: totalPartidos, egresos: 125000, neto: totalInsc + totalPartidos - 125000 } });
    // Borrar un egreso
    const btnBorrarEgreso = D().querySelector('#lista-egresos-admin button');
    if (btnBorrarEgreso) { respuestaConfirm = true; btnBorrarEgreso.click(); await esperar(2); }
    const egresos2 = LS('liga_egresos') || [];
    check(egresos2.length === 1, 'Se puede eliminar un egreso', egresos2.map(e => e.concepto));
    const balance2 = num(el('txt-total-egresos').textContent);
    check(Math.abs(balance2) === egresos2.reduce((a, e) => a + e.monto, 0), 'El balance se actualiza al borrar un egreso', { enPantalla: balance2, guardado: egresos2.reduce((a, e) => a + e.monto, 0) });
}

async function campanita() {
    out('\n=== CAMPANITA PÚBLICA: marcar leídos y limpiar ===');
    await cargar('admin.html');
    await tab('sec-alertas');
    setv('alerta-titulo', 'Segundo aviso de prueba', false); setv('alerta-texto', 'Texto del segundo aviso.', false); setv('alerta-tipo', 'normal', false);
    await enviar('form-alerta-admin');
    check((LS('liga_notificaciones') || []).length === 2, 'Hay 2 avisos publicados', (LS('liga_notificaciones') || []).length);
    await cargar('index.html');
    const btnCamp = D().getElementById('btn-notificaciones-header') || D().getElementById('btn-notificaciones');
    if (btnCamp) btnCamp.click();
    await esperar(2);
    const lista = D().getElementById('contenedor-lista-notificaciones');
    check(lista && lista.querySelectorAll('.notif-item, div').length > 0 && /Segundo aviso/.test(lista.textContent), 'La campanita muestra los avisos', lista && lista.textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
    const badge = D().getElementById('badge-notificacion');
    const badgeVisible = badge ? getComputedStyle(badge).display !== 'none' : false;
    const btnLeido = D().getElementById('btn-marcar-leido');
    if (btnLeido) btnLeido.click();
    await esperar(2);
    // Desde la migración, "leído" y "limpiar" quedan solo en el dispositivo del visitante: los avisos compartidos no cambian.
    const itemsLeidos = [...lista.querySelectorAll('.notif-item')];
    check(itemsLeidos.length === 2 && itemsLeidos.every(n => n.classList.contains('leida')) && !D().getElementById('badge-notificacion').classList.contains('activo'),
        '"Marcar leídos" marca todos como leídos y apaga el puntito', { badgeAntes: badgeVisible, clases: itemsLeidos.map(n => n.className) });
    check((LS('liga_notificaciones') || []).length === 2 && docsFS('notificaciones') === 2, '"Marcar leídos" no toca los avisos compartidos', docsFS('notificaciones'));
    const btnLimpiar = D().getElementById('btn-limpiar-notifs');
    if (btnLimpiar) btnLimpiar.click();
    await esperar(2);
    check(lista.querySelectorAll('.notif-item').length === 0 && docsFS('notificaciones') === 2, '"Limpiar" vacía la campanita de este dispositivo sin borrar los avisos', docsFS('notificaciones'));
    await cargar('index.html');
    check(D().getElementById('contenedor-lista-notificaciones').querySelectorAll('.notif-item').length === 0, 'Lo limpiado sigue oculto al recargar la web');
    check(/No hay|sin avisos|Sin notificaciones/i.test(D().getElementById('contenedor-lista-notificaciones').textContent), 'La campanita vacía muestra su cartel', D().getElementById('contenedor-lista-notificaciones').textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
    // El admin vuelve a publicar y el historial del panel se vacía con su propio botón
    await cargar('admin.html');
    await tab('sec-alertas');
    setv('alerta-titulo', 'Aviso para vaciar', false); setv('alerta-texto', 'prueba', false);
    await enviar('form-alerta-admin');
    const avisosAntes = (LS('liga_notificaciones') || []).length;
    respuestaConfirm = false;
    el('btn-vaciar-alertas-admin').click();
    check(avisosAntes === 3 && (LS('liga_notificaciones') || []).length === avisosAntes, 'Cancelar "Vaciar Historial" del panel no borra', avisosAntes);
    respuestaConfirm = true;
    el('btn-vaciar-alertas-admin').click();
    await esperar(200);
    check((LS('liga_notificaciones') || []).length === 0 && docsFS('notificaciones') === 0, '"Vaciar Historial" del panel borra los avisos (también en Firestore)', docsFS('notificaciones'));
}

async function responsive780() {
    out('\n=== RESPONSIVE 769–799 px (franja nunca revisada) ===');
    const anchoOriginal = marco.style.width;
    marco.style.width = '780px';
    await cargar('index.html');
    await esperar(5);
    const medir = (etiqueta) => {
        const d = D();
        const w = d.documentElement.clientWidth;
        const desbordes = [...d.querySelectorAll('body *')]
            .filter(e => getComputedStyle(e).display !== 'none')
            .map(e => ({ e, r: e.getBoundingClientRect() }))
            .filter(x => x.r.right > w + 2 && x.r.width > 0 && x.r.height > 0 && !/hero|sponsor/i.test(x.e.className || ''))
            .map(x => (x.e.id ? '#' + x.e.id : x.e.tagName + '.' + [...x.e.classList].join('.')) + ' right=' + Math.round(x.r.right));
        return { etiqueta, ancho: w, scroll: d.documentElement.scrollWidth, desbordes: [...new Set(desbordes)].slice(0, 6) };
    };
    const home = medir('home');
    check(home.scroll <= home.ancho + 2, 'A 780 px la portada no desborda a lo ancho', home);
    D().querySelector('.nav-item[href="#pantalla-tablas"]').click();
    await esperar(3);
    const tablas = medir('tablas');
    check(tablas.scroll <= tablas.ancho + 2, 'A 780 px la pantalla de Posiciones no desborda', tablas);
    const filas = D().querySelectorAll('.tbody-sup tr').length;
    const ptsVisible = D().querySelector('.tbody-sup .td-pts-total');
    check(filas > 0 && ptsVisible && ptsVisible.getBoundingClientRect().right <= D().documentElement.clientWidth + 2, 'A 780 px la columna PTS entra en pantalla', { filas, right: ptsVisible && Math.round(ptsVisible.getBoundingClientRect().right) });
    D().querySelector('.nav-item[href="#pantalla-fixture"]').click();
    await esperar(3);
    const fix = medir('fixture');
    check(fix.scroll <= fix.ancho + 2, 'A 780 px la pantalla de Partidos no desborda', fix);
    const tp = D().getElementById('toggle-titulo-playoffs');
    D().querySelector('.nav-item[href="#pantalla-tablas"]').click();
    await esperar(2);
    if (tp) tp.click();
    await esperar(3);
    const po = medir('playoffs');
    check(po.scroll <= po.ancho + 2, 'A 780 px el bracket no desborda la página (scrollea dentro de su caja)', po);
    marco.style.width = anchoOriginal;
}


// ---------------- Suspensión contada por fechas realmente jugadas ----------------
async function suspensionPorFechasJugadas() {
    out('\n=== SUSPENSIÓN: sólo descuenta la fecha que se jugó (regla nueva del 23/09/2026) ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    const EQ = '7mo 1ra';
    const rivales = { 4: '4to 1ra', 5: '5to 2da', 6: '6to 3ra', 7: '4to 1ra' };
    for (const f of [4, 5, 6, 7]) await crearPartido(f, 'superior', 'A', EQ, rivales[f], 0);
    const creados = [4, 5, 6, 7].every(f => !!P(f, EQ, rivales[f]));
    check(creados, 'Se cargaron los partidos de las fechas 4 a 7 de ' + EQ);
    // Fecha 4 jugada (es la fecha del acta)
    const jugarFechaDe = async (f, gl, gv) => {
        const partido = P(f, EQ, rivales[f]);
        editarPartido(partido);
        setv('goles-local', String(gl), false); setv('goles-visitante', String(gv), false);
        setv('dorsales-goles-local', '', false); setv('dorsales-goles-visitante', '', false);
        await enviar('form-partido');
        await esperar(2);
    };
    await jugarFechaDe(4, 1, 0);
    // Acta en la Fecha 4, 2 fechas de suspensión
    await tab('sec-tribunal');
    const suspendido = jug(EQ, 1);
    setv('sancion-acta-num', '4', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', EQ);
    setv('sancion-jugador-id', suspendido.dni, false);
    setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '2', false);
    setv('sancion-motivo', 'Roja en la Fecha 4.', false);
    await enviar('form-sancion');
    const sancionCargada = (LS('liga_sanciones') || []).find(x => x.jugadorId === suspendido.dni && x.acta === '4');
    check(!!sancionCargada, 'Acta 4 cargada con 2 fechas de suspensión', sancionCargada && { acta: sancionCargada.acta, fechas: sancionCargada.puntosRestados });

    const marcaSusp = async f => {
        await abrirTeso(f);
        const partido = P(f, EQ, rivales[f]);
        const fila = D().querySelector(`.bf-chk-asist[data-pid="${partido.id}"][data-lado="local"][data-jid="${suspendido.dni}"]`);
        const contenedor = fila && fila.closest('.bf-fila');
        return { susp: !!(contenedor && contenedor.querySelector('.bf-tag-susp')), texto: contenedor ? contenedor.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : 'sin fila' };
    };
    const f4 = await marcaSusp(4), f5 = await marcaSusp(5), f6 = await marcaSusp(6), f7 = await marcaSusp(7);
    check(!f4.susp, 'Fecha 4 (la del acta): todavía no está suspendido', f4);
    check(f5.susp, 'Fecha 5: suspendido (primera fecha de la sanción)', f5);
    check(f6.susp, 'Fecha 6: sigue suspendido porque la Fecha 5 NO se jugó', f6);
    check(f7.susp, 'Fecha 7: sigue suspendido (ninguna fecha se jugó todavía)', f7);
    // Se juega la Fecha 5: cuenta 1 sola fecha cumplida
    await tab('sec-jornada');
    await jugarFechaDe(5, 2, 2);
    const f6b = await marcaSusp(6), f7b = await marcaSusp(7);
    check(f6b.susp, 'Con la Fecha 5 jugada: en la Fecha 6 sigue suspendido (lleva 1 de 2)', f6b);
    check(f7b.susp, 'Con la Fecha 5 jugada: en la Fecha 7 sigue suspendido', f7b);
    // Se juega la Fecha 6: cumple las 2
    await tab('sec-jornada');
    await jugarFechaDe(6, 0, 1);
    const f7c = await marcaSusp(7);
    check(!f7c.susp, 'Con las Fechas 5 y 6 jugadas: en la Fecha 7 queda libre', f7c);
    const chkF7 = D().querySelector(`.bf-chk-asist[data-pid="${P(7, EQ, rivales[7]).id}"][data-lado="local"][data-jid="${suspendido.dni}"]`);
    if (chkF7) { chkF7.checked = true; chkF7.dispatchEvent(new Event('change', { bubbles: true })); await esperar(2); }
    check((P(7, EQ, rivales[7]).asistentesLocal || []).includes(suspendido.dni), 'Cumplida la suspensión, se lo puede volver a tildar en la lista');
}

// ---------------- Tabla Única (Bombos) ----------------
async function tablaUnica() {
    out('\n=== TABLA ÚNICA (Bombos) ===');
    await cargar('admin.html');
    await tab('sec-planteles');
    el('btn-sub-plantel-admin').click();
    setv('mover-equipo-ciclo', 'superior');
    for (const eq of SUP.C) {
        setv('mover-equipo-select', eq, false);
        setv('mover-equipo-nuevo-grupo', 'Unico', false);
        el('btn-mover-equipo').click();
        await esperar(2);
    }
    const movidos = (LS('liga_cicloSuperior') || []).filter(e => e.grupo === 'Unico').map(e => e.nombre);
    check(movidos.length === 4, 'Los 4 equipos del Grupo C pasaron a Tabla Única', movidos);
    // Sin activar el formato, la web pública NO debe mostrar la pestaña
    await cargar('index.html');
    const antes = [...D().querySelectorAll('.tabs-sup .tab-btn')].map(b => b.textContent.trim());
    check(!antes.includes('Tabla Única'), 'Mover equipos solo no activa la pestaña: hace falta el toggle', antes);
    await cargar('admin.html');
    await tab('sec-planteles');
    el('btn-sub-plantel-admin').click();
    setv('formato-torneo-superior', 'unico', false);
    el('btn-guardar-formato-torneo').click();
    await esperar(2);
    check((LS('liga_formato_torneo') || {}).superior === 'unico', 'Formato del torneo guardado como Tabla Única', LS('liga_formato_torneo'));
    await cargar('index.html');
    const botones = [...D().querySelectorAll('.tabs-sup .tab-btn')].map(b => b.textContent.trim());
    check(botones.includes('Tabla Única'), 'La web pública muestra la pestaña "Tabla Única"', botones);
    [...D().querySelectorAll('.tabs-sup .tab-btn')].find(b => b.textContent.trim() === 'Tabla Única').click();
    await esperar(2);
    const filas = [...D().querySelectorAll('.tbody-sup tr')];
    const nombres = filas.map(tr => tr.querySelector('.td-team-name').textContent.trim());
    check(filas.length === 4 && nombres.every(n => SUP.C.includes(n)), 'La Tabla Única lista a los equipos movidos', nombres);
    const clases = filas.map(tr => tr.querySelector('td').className);
    check(clases.every(c => c === 'td-pos-bombo1'), 'Los 4 primeros quedan marcados como Bombo 1', clases);
    const titulo = D().querySelector('.group-name-sup').textContent.trim();
    const subtitulo = D().querySelector('.group-name-sup').nextElementSibling;
    check(titulo === 'TABLA ÚNICA' && /Bombo 1/.test(subtitulo.textContent), 'Título y subtítulo de Bombos', { titulo, subtitulo: subtitulo.textContent.trim().slice(0, 60) });
    const pts = filas.map(tr => Number(tr.querySelector('.td-pts-total').textContent));
    check(pts.join(',') === [...pts].sort((a, b) => b - a).join(','), 'La Tabla Única queda ordenada por puntos', pts);
}


// ---------------- Regla del 3-0 automático en las suspensiones (23/09/2026) ----------------
// Dos equipos con la MISMA sanción (acta 4, 2 fechas) y resultados opuestos en la misma fecha:
// uno gana 3-0 estando presente (esa fecha le cuenta) y el otro pierde 3-0 por no presentarse (no le cuenta).
async function suspension30() {
    out('\n=== SUSPENSIÓN Y 3-0 AUTOMÁTICO: sólo cuenta la fecha si el equipo se presentó ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    const X = '4to 2da';        // se presenta y gana 3-0
    const Y = '6to 1ra';        // no se presenta y pierde 3-0
    const rivalX = '5to 3ra';
    const rivalY = '7mo 2da';
    await crearPartido(5, 'superior', 'B', X, rivalX, 0);
    await crearPartido(5, 'superior', 'B', Y, rivalY, 1);
    await crearPartido(6, 'superior', 'B', X, Y, 2);
    await crearPartido(7, 'superior', 'B', X, rivalY, 0);
    await crearPartido(7, 'superior', 'B', Y, rivalX, 1);
    check(!!P(5, X, rivalX) && !!P(5, Y, rivalY) && !!P(6, X, Y) && !!P(7, X, rivalY) && !!P(7, Y, rivalX), 'Se cargaron los partidos del escenario (fechas 5, 6 y 7 del Grupo B)');

    // Sanciones iguales para los dos: acta en la Fecha 4, 2 fechas
    await tab('sec-tribunal');
    const jugX = jug(X, 5), jugY = jug(Y, 5);
    for (const [equipo, jugador] of [[X, jugX], [Y, jugY]]) {
        setv('sancion-acta-num', '4', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', equipo);
        setv('sancion-jugador-id', jugador.dni, false);
        setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '2', false);
        setv('sancion-motivo', `Roja en la Fecha 4 (${equipo}).`, false);
        await enviar('form-sancion');
    }
    const sanciones = (LS('liga_sanciones') || []).filter(x => x.acta === '4' && x.tipo === 'Sanción Disciplinaria');
    check(sanciones.length >= 2, 'Las dos sanciones quedaron cargadas con 2 fechas', sanciones.map(x => x.equipo + ':' + x.puntosRestados));

    const marca = async (fecha, equipo, rival, lado, jugador) => {
        await abrirTeso(fecha);
        const partido = P(fecha, equipo, rival);
        const chk = D().querySelector(`.bf-chk-asist[data-pid="${partido.id}"][data-lado="${lado}"][data-jid="${jugador.dni}"]`);
        const fila = chk && chk.closest('.bf-fila');
        return !!(fila && fila.querySelector('.bf-tag-susp'));
    };

    // Fecha 5: el rival de X no se presenta (X gana 3-0) y Y no se presenta (pierde 3-0)
    await abrirTeso(5);
    const p5X = P(5, X, rivalX), p5Y = P(5, Y, rivalY);
    await asistencia(p5X.id, 'visita', 'sin_aviso');
    await asistencia(p5X.id, 'local', 'presente');
    await pagar(p5X.id, 'local', 'in-p-ef', 30000);
    await asistencia(p5Y.id, 'local', 'sin_aviso');
    await asistencia(p5Y.id, 'visita', 'presente');
    await pagar(p5Y.id, 'visita', 'in-p-ef', 30000);
    const p5Xd = P(5, X, rivalX), p5Yd = P(5, Y, rivalY);
    check(p5Xd.jugado && p5Xd.resultadoAuto && p5Xd.golesLocal === 3 && p5Xd.golesVisitante === 0, `Fecha 5: ${X} gana 3-0 automático estando presente`, { goles: [p5Xd.golesLocal, p5Xd.golesVisitante], auto: p5Xd.resultadoAuto });
    check(p5Yd.jugado && p5Yd.resultadoAuto && p5Yd.golesLocal === 0 && p5Yd.golesVisitante === 3, `Fecha 5: ${Y} pierde 3-0 automático por no presentarse`, { goles: [p5Yd.golesLocal, p5Yd.golesVisitante], auto: p5Yd.resultadoAuto });

    check(await marca(5, X, rivalX, 'local', jugX), 'Fecha 5: el jugador de ' + X + ' está suspendido (primera fecha)');
    check(await marca(5, Y, rivalY, 'local', jugY), 'Fecha 5: el jugador de ' + Y + ' está suspendido (primera fecha)');
    check(await marca(6, X, Y, 'local', jugX), 'Fecha 6: ' + X + ' lleva 1 de 2 cumplidas (el 3-0 a favor contó) y sigue suspendido');
    check(await marca(6, X, Y, 'visita', jugY), 'Fecha 6: ' + Y + ' lleva 0 de 2 (el 3-0 en contra NO contó) y sigue suspendido');

    // Fecha 6: partido normal, los dos presentes (asistencia sin registrar = cuenta igual)
    await tab('sec-jornada');
    editarPartido(P(6, X, Y));
    setv('goles-local', '1', false); setv('goles-visitante', '1', false);
    setv('dorsales-goles-local', '', false); setv('dorsales-goles-visitante', '', false);
    await enviar('form-partido');
    await esperar(2);
    check(P(6, X, Y).jugado && !P(6, X, Y).resultadoAuto, 'Fecha 6: partido normal jugado 1-1');

    // Fecha 7: X cumplió las 2 (3-0 a favor + normal). Y sólo cumplió 1 (la del 3-0 en contra no cuenta).
    const x7 = await marca(7, X, rivalY, 'local', jugX);
    const y7 = await marca(7, Y, rivalX, 'local', jugY);
    check(!x7, 'Fecha 7: ' + X + ' queda LIBRE — el 3-0 ganado estando presente sí descontó fecha');
    check(y7, 'Fecha 7: ' + Y + ' sigue SUSPENDIDO — el 3-0 perdido por ausencia no descontó fecha');
    const chk7 = D().querySelector(`.bf-chk-asist[data-pid="${P(7, Y, rivalX).id}"][data-lado="local"][data-jid="${jugY.dni}"]`);
    if (chk7) { chk7.checked = true; chk7.dispatchEvent(new Event('change', { bubbles: true })); await esperar(2); }
    check(!(P(7, Y, rivalX).asistentesLocal || []).includes(jugY.dni) && /suspendido/i.test(ultimaAlerta()), 'Fecha 7: al de ' + Y + ' todavía no se lo puede tildar', ultimaAlerta());
    const chk7x = D().querySelector(`.bf-chk-asist[data-pid="${P(7, X, rivalY).id}"][data-lado="local"][data-jid="${jugX.dni}"]`);
    if (chk7x) { chk7x.checked = true; chk7x.dispatchEvent(new Event('change', { bubbles: true })); await esperar(2); }
    check((P(7, X, rivalY).asistentesLocal || []).includes(jugX.dni), 'Fecha 7: al de ' + X + ', ya libre, se lo puede tildar');
}

// ---------------- Casos borde al final ----------------
async function bordes() {
    out('\n=== CASOS BORDE (al final, para no alterar lo anterior) ===');
    await cargar('admin.html');
    // 0) Inscripciones
    await tab('sec-tesoreria');
    el('btn-sub-teso-inscripciones').click();
    setv('monto-inscripcion-individual', '3500');
    // Desde el 24/09/2026 Inscripciones son tarjetas (.teso-insc-card), no filas de tabla.
    const cardInsc = () => [...D().querySelectorAll('#contenedor-tesoreria-inscripciones .teso-insc-card')].find(c => c.dataset.nombre === '4to 1ra');
    const card1 = cardInsc();
    check(card1 && card1.dataset.exigido === '21000', 'Inscripciones: 6 jugadores x $3.500 = $21.000', card1 && card1.dataset.exigido);
    if (card1) { const inpInsc = card1.querySelector('.in-insc-ef'); inpInsc.value = '21000'; inpInsc.dispatchEvent(new Event('change', { bubbles: true })); }
    await esperar(2);
    const card2 = cardInsc();
    check(card2 && /AL DÍA/.test(card2.textContent) && (LS('liga_caja_movimientos') || []).some(m => m.concepto === 'Inscripción' && m.monto === 21000), 'Inscripción pagada: AL DÍA y movimiento en la Caja', card2 && card2.textContent.replace(/\s+/g, ' ').trim());

    // 0b) Planteles: ir a otra pestaña, volver y dar de baja / tocar ficha sin que se redibuje la tabla
    await tab('sec-planteles');
    el('btn-sub-plantel-jugadores').click();
    setv('plantel-ciclo', 'basico'); setv('plantel-equipo-select', '3ro 2da');
    await tab('sec-jornada');
    setv('partido-fecha', '2'); // cualquier acción que relea los equipos
    await tab('sec-planteles');
    const jb = jug('3ro 2da', 10);
    respuestaConfirm = true;
    D().querySelector(`.btn-borrar-jugador[data-dni="${jb.dni}"]`).click();
    const sigue = LS('liga_cicloBasico').find(e => e.nombre === '3ro 2da').jugadores.some(j => j.dni === jb.dni);
    check(!sigue, 'Baja de jugador después de pasar por otra pestaña: se borra de verdad', { alerta: ultimaAlerta(), sigueGuardado: sigue });

    await tab('sec-planteles');
    el('btn-sub-plantel-jugadores').click();
    // 1) Cambiar el dorsal de un goleador y volver a guardar su partido
    setv('plantel-ciclo', 'superior'); setv('plantel-equipo-select', '4to 2da');
    const j7 = jug('4to 2da', 7);
    D().querySelector(`.btn-editar-jugador[data-dni="${j7.dni}"]`).click();
    setv('jugador-dorsal', '17', false);
    await enviar('form-jugador');
    await tab('sec-jornada');
    const pB = P(1, '4to 2da', '5to 3ra');
    editarPartido(pB);
    const campo = el('dorsales-goles-local').value;
    await enviar('form-partido');
    const pB2 = P(1, '4to 2da', '5to 3ra');
    const golesJ = golesDe('4to 2da', j7.dni);
    const suma2 = pB2.goleadoresLocal.reduce((a, g) => a + g.cantidad, 0);
    check(suma2 === 3, 'Cambiar el dorsal de un goleador (7→17) y re-guardar su partido conserva los 3 goles del partido', { campoRelleno: campo, goleadoresGuardados: pB2.goleadoresLocal, golesDelJugador: golesJ });

    // 2) Corregir el DNI de un jugador que ya jugó
    await tab('sec-planteles');
    setv('plantel-equipo-select', '4to 1ra');
    const j9 = jug('4to 1ra', 9);
    const pjAntes = LS('liga_partidos').filter(p => (p.asistentesLocal || []).includes(j9.dni) || (p.asistentesVisitante || []).includes(j9.dni)).length;
    D().querySelector(`.btn-editar-jugador[data-dni="${j9.dni}"]`).click();
    setv('jugador-dni', j9.dni + '1', false);
    await enviar('form-jugador');
    const pjDesp = LS('liga_partidos').filter(p => (p.asistentesLocal || []).includes(j9.dni + '1') || (p.asistentesVisitante || []).includes(j9.dni + '1')).length;
    check(pjDesp === pjAntes, 'Corregir el DNI de un jugador que ya jugó conserva sus asistencias (PJ)', { antes: pjAntes, despues: pjDesp });

    // 3) Borrar un partido jugado de playoffs no deja el bracket inconsistente (solo informativo)
    // 4) Sanción con cantidad vacía
    await tab('sec-tribunal');
    setv('sancion-acta-num', '3', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', '4to 3ra');
    setv('sancion-tipo', 'Quita de Puntos', false); setv('sancion-puntos', '', false); setv('sancion-motivo', 'prueba vacía', false);
    await enviar('form-sancion');
    const sv = LS('liga_sanciones').find(s => s.motivo === 'prueba vacía');
    out('  info: alerta al guardar Quita sin cantidad: ' + ultimaAlerta());
    setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '', false); setv('sancion-motivo', 'susp vacía', false);
    await enviar('form-sancion');
    const sv2 = LS('liga_sanciones').find(s => s.motivo === 'susp vacía');
    check(!sv2, 'Suspensión sin cantidad de fechas se rechaza', { alerta: ultimaAlerta(), guardada: !!sv2 });
    setv('sancion-tipo', 'Quita de Puntos', false); setv('sancion-puntos', '0', false); setv('sancion-motivo', 'quita cero', false);
    await enviar('form-sancion');
    check(!LS('liga_sanciones').find(s => s.motivo === 'quita cero'), 'Quita de Puntos con cantidad 0 se rechaza', ultimaAlerta());
    setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '0', false); setv('sancion-motivo', 'susp cero', false);
    await enviar('form-sancion');
    check(!LS('liga_sanciones').find(s => s.motivo === 'susp cero'), 'Suspensión con 0 fechas se rechaza', ultimaAlerta());
    setv('sancion-tipo', 'Advertencia / Acta', false); setv('sancion-puntos', '0', false); setv('sancion-motivo', 'advertencia cero', false);
    await enviar('form-sancion');
    check(!!LS('liga_sanciones').find(s => s.motivo === 'advertencia cero'), 'Advertencia / Acta con 0 sigue aceptándose', ultimaAlerta());
    check(!sv || Number.isFinite(sv.puntosRestados), 'Quita de puntos con cantidad vacía no guarda NaN (rompería la tabla)', sv && sv.puntosRestados);
    if (sv) { await cargar('index.html'); D().querySelector('.tabs-sup .tab-btn[data-grupo-val="C"]').click(); const t = [...D().querySelectorAll('.tbody-sup tr')].map(tr => tr.querySelector('.td-team-name').textContent + ' ' + tr.querySelector('.td-pts-total').textContent); out('  info: tabla Grupo C con esa sanción: ' + t.join(' | ')); }
}

// ---------------- Beneficios de inscripción, egresos por fecha y Recaudación por Fecha (29/09/2026) ----------------
async function beneficiosYRecaudacion() {
    out('\n=== TESORERÍA: beneficios de inscripción, egresos por fecha, Recaudación por Fecha y rol Staff ===');
    const num = t => Number(String(t).replace(/[^0-9-]/g, ''));
    // Monto que sigue a una etiqueta en un texto ("Falta $12.000" → 12000). Sin signo.
    const montoTras = (txt, etiqueta) => { const m = String(txt).replace(/\s+/g, ' ').match(new RegExp(etiqueta + '\\s*-?\\$([\\d.,]+)')); return m ? num(m[1]) : null; };
    const cambiar = async (campo, v) => { campo.value = v; campo.dispatchEvent(new Event('change', { bubbles: true })); await esperar(2); };
    const insc = () => LS('liga_tesoreria_inscripciones') || {};
    const movs = () => LS('liga_caja_movimientos') || [];
    const ord = f => { const n = Number(f); return n >= 100 ? 1000 + (200 - n) : n; };
    const abrirInscripciones = async () => {
        await tab('sec-tesoreria');
        el('btn-sub-teso-inscripciones').click();
        setv('filtro-inscripciones-ciclo', 'superior');
        await esperar(2);
    };
    const cards = () => [...D().querySelectorAll('#contenedor-tesoreria-inscripciones .teso-insc-card')];
    const card = n => cards().find(c => c.dataset.nombre === n);

    await cargar('admin.html');
    await abrirInscripciones();
    const valor = Number(el('monto-inscripcion-individual').value) || 3000;
    const [nomA, nomB, nomC] = cards().filter(c => Number(c.dataset.cant) > 0 && c.dataset.nombre !== '4to 1ra').map(c => c.dataset.nombre);
    const brutoA = Number(card(nomA).dataset.cant) * valor, brutoB = Number(card(nomB).dataset.cant) * valor;
    const totalInsc = () => num(el('txt-total-inscripciones').textContent);

    // 1) Exento después de haber pagado: no queda deuda negativa sino "A favor", y lo bonificado no suma
    await cambiar(card(nomA).querySelector('.in-insc-ef'), String(brutoA));
    const cA = card(nomA);
    const claveA = cA.dataset.eq;
    const inscAntes = totalInsc(), movsAntes = movs().length;
    await cambiar(cA.querySelector('.in-insc-benef-tipo'), 'exento');
    await cambiar(cA.querySelector('.in-insc-benef-motivo'), 'Campeones 2025');
    const entradaA = insc()[claveA] || {};
    check(entradaA.beneficio && entradaA.beneficio.tipo === 'exento' && entradaA.beneficio.porcentaje === 100 && entradaA.beneficio.motivo === 'Campeones 2025' && entradaA.ef === brutoA && (entradaA.tr || 0) === 0,
        'Beneficio exento: queda en la entrada del equipo (misma clave) sin tocar ef/tr', { clave: claveA, entrada: entradaA });
    const textoA = cA.textContent.replace(/\s+/g, ' ');
    check(card(nomA) === cA && cA.dataset.exigido === '0' && /EXENTO · Campeones 2025/.test(textoA) && montoTras(textoA, 'Bonificado:') === brutoA && montoTras(textoA, 'A favor') === brutoA && !/Falta/.test(textoA),
        'Exento después de pagar: exigido $0, se ve el motivo, bonificado aparte y "A favor" (no deuda negativa)', textoA.slice(0, 260));
    check(movs().length === movsAntes && totalInsc() === inscAntes, 'Cambiar un beneficio no es un movimiento de Caja ni cambia la recaudación', { movsAntes, movsDespues: movs().length, inscAntes, inscDespues: totalInsc() });

    // 2) Descuento: exigido = bruto × (1 − %), el foco no se pierde al cargar el pago
    const cB = card(nomB);
    await cambiar(cB.querySelector('.in-insc-benef-tipo'), 'descuento');
    check(cB.querySelector('.in-insc-benef-pct').value === '50' && !cB.querySelector('.teso-insc-fila-pct').hidden && Number(cB.dataset.exigido) === Math.round(brutoB * 0.5),
        'Al elegir descuento arranca en 50% y el exigido se recalcula en la misma tarjeta', { pct: cB.querySelector('.in-insc-benef-pct').value, exigido: cB.dataset.exigido, bruto: brutoB });
    await cambiar(cB.querySelector('.in-insc-benef-pct'), '40');
    await cambiar(cB.querySelector('.in-insc-benef-motivo'), 'Subcampeones 2025');
    const exigB = Math.round(brutoB * 0.6);
    const textoB = cB.textContent.replace(/\s+/g, ' ');
    check(Number(cB.dataset.exigido) === exigB && montoTras(textoB, 'Falta') === exigB && montoTras(textoB, 'Bonificado:') === brutoB - exigB && /40% DE DESCUENTO · Subcampeones 2025/.test(textoB) && insc()[cB.dataset.eq].beneficio.porcentaje === 40,
        'Descuento del 40%: exigido = jugadores × valor × 0,6, bonificado aparte y motivo visible', { exigido: cB.dataset.exigido, esperado: exigB, texto: textoB.slice(0, 260) });
    const inpB = cB.querySelector('.in-insc-tr');
    inpB.focus();
    const inscAntesB = totalInsc(), movsAntesB = movs().length;
    await cambiar(inpB, String(exigB));
    const ultMov = movs()[movs().length - 1] || {};
    check(D().activeElement === inpB && inpB.isConnected && card(nomB) === cB, 'Con beneficio, cargar un monto no redibuja la lista: el foco sigue en el campo', { activo: D().activeElement && D().activeElement.className });
    check(/AL DÍA/.test(cB.textContent) && totalInsc() === inscAntesB + exigB && movs().length === movsAntesB + 1 && ultMov.monto === exigB && ultMov.medio === 'Transferencia' && ultMov.concepto === 'Inscripción',
        'Pago con descuento: AL DÍA, suma solo lo pagado y registra el movimiento en la Caja', { insc: totalInsc(), esperado: inscAntesB + exigB, ultMov });
    const bonifEsperado = brutoA + (brutoB - exigB);
    const cobradoInsc = Object.values(insc()).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
    check(montoTras(el('txt-bonificado-inscripciones').textContent, 'Bonificado:') === bonifEsperado && totalInsc() === cobradoInsc,
        'Balance Central: la recaudación de inscripciones es solo lo cobrado y lo bonificado se muestra aparte', { enPantalla: el('txt-bonificado-inscripciones').textContent, bonifEsperado, recaudacion: totalInsc(), cobradoInsc });

    // 3) Volver a "Sin beneficio"
    const cC = card(nomC);
    await cambiar(cC.querySelector('.in-insc-benef-tipo'), 'exento');
    await cambiar(cC.querySelector('.in-insc-benef-tipo'), '');
    check((insc()[cC.dataset.eq] || {}).beneficio === null && Number(cC.dataset.exigido) === Number(cC.dataset.cant) * valor && cC.querySelector('.teso-insc-fila-motivo').hidden,
        'Volver a "Sin beneficio" deja beneficio en null y el exigido completo', insc()[cC.dataset.eq]);

    // 4) Persistencia: al volver a abrir el panel el beneficio sigue
    await cargar('admin.html');
    await abrirInscripciones();
    const fsInsc = (JSON.parse(localStorage.getItem('fakefs') || '{}').tesoreriaInscripciones || {})[claveA];
    check(card(nomA).dataset.exigido === '0' && card(nomA).querySelector('.in-insc-benef-tipo').value === 'exento' && /EXENTO · Campeones 2025/.test(card(nomA).textContent) && card(nomB).querySelector('.in-insc-benef-pct').value === '40'
        && fsInsc && JSON.stringify(fsInsc).includes('Campeones 2025'),
        'El beneficio queda guardado en Firestore y se ve igual al volver a abrir el panel', fsInsc);

    // 5) Egresos con fecha
    await tab('sec-tesoreria');
    const opsEg = [...el('egreso-fecha').options].map(o => o.value);
    const opsPart = [...el('partido-fecha').options].map(o => o.value);
    const etiqueta108 = ([...el('egreso-fecha').options].find(o => o.value === '108') || {}).textContent;
    check(opsEg[0] === '' && el('egreso-fecha').value === '' && JSON.stringify(opsEg.slice(1)) === JSON.stringify(opsPart) && etiqueta108 === '8VOS DE FINAL',
        'Cargar Egreso: "General del torneo" por defecto y las mismas fechas que Carga de Partidos (playoffs con su nombre)', { opsEg, etiqueta108 });
    const altaEgreso = async (concepto, detalle, monto, fecha) => {
        setv('egreso-concepto', concepto, false); setv('egreso-detalle', detalle, false); setv('egreso-monto', String(monto), false); setv('egreso-medio', 'efectivo', false); setv('egreso-fecha', fecha, false);
        await enviar('form-egreso');
    };
    await altaEgreso('canchas', 'Canchas Fecha 1', 30000, '1');
    check(el('egreso-fecha').value === '', 'Después de cargar un egreso el selector vuelve a "General del torneo"', el('egreso-fecha').value);
    await altaEgreso('arbitros', 'Terna 8vos', 12000, '108');
    await altaEgreso('varios', 'Trofeos y medallas', 50000, '');
    const eg = LS('liga_egresos') || [];
    const egDe = d => eg.find(e => e.detalle === d) || {};
    check(egDe('Canchas Fecha 1').fecha === '1' && egDe('Terna 8vos').fecha === '108' && !egDe('Trofeos y medallas').fecha,
        'Cada egreso guarda su fecha ("1", "108") o vacía si es general', eg.map(e => e.detalle + ':' + JSON.stringify(e.fecha)));
    const filaEgreso = d => [...D().querySelectorAll('#lista-egresos-admin .match-card')].find(x => x.textContent.includes(d));
    check(/FECHA 1/.test(filaEgreso('Canchas Fecha 1').textContent) && /8VOS DE FINAL/.test(filaEgreso('Terna 8vos').textContent) && /GENERAL DEL TORNEO/.test(filaEgreso('Trofeos y medallas').textContent),
        'La lista de egresos muestra a qué fecha corresponde cada uno', [...D().querySelectorAll('#lista-egresos-admin .match-card')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));

    // 6) Recaudación por Fecha contra una cuenta hecha a mano
    const recaudar = async () => { el('btn-sub-teso-recaudacion').click(); await esperar(2); };
    const cuentaAMano = () => {
        const partidos = LS('liga_partidos') || [], teso = LS('liga_tesoreria_partidos_v2') || {}, egresos = LS('liga_egresos') || [];
        const porFecha = {};
        const fila = f => porFecha[f] || (porFecha[f] = { aranceles: 0, egresos: 0 });
        const contadas = new Set();
        partidos.filter(p => p.local && p.visitante).forEach(p => {
            fila(String(p.fecha));
            Object.keys(teso).filter(k => k.startsWith(`F${p.fecha}_${p.id}_`)).forEach(k => { if (contadas.has(k)) return; contadas.add(k); fila(String(p.fecha)).aranceles += (teso[k].ef || 0) + (teso[k].tr || 0); });
        });
        egresos.filter(e => e.fecha).forEach(e => { fila(String(e.fecha)).egresos += e.monto; });
        const totTeso = Object.values(teso).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
        const totInsc = Object.values(LS('liga_tesoreria_inscripciones') || {}).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
        const totEgresos = egresos.reduce((a, e) => a + e.monto, 0);
        const generales = egresos.filter(e => !e.fecha).reduce((a, e) => a + e.monto, 0);
        return { porFecha, totTeso, totInsc, totEgresos, generales, sinPartido: totTeso - Object.values(porFecha).reduce((a, r) => a + r.aranceles, 0), neto: totTeso + totInsc - totEgresos };
    };
    await recaudar();
    const mano = cuentaAMano();
    const tarjetasR = [...D().querySelectorAll('#contenedor-recaudacion-fecha .teso-recaud-card')];
    const pantalla = Object.fromEntries(tarjetasR.map(t => [t.dataset.fecha, { aranceles: montoTras(t.textContent, 'Aranceles cobrados'), egresos: montoTras(t.textContent, 'Egresos de la fecha'), neto: montoTras(t.textContent, 'Neto de la fecha'), titulo: t.querySelector('.teso-team-name').textContent }]));
    const ordenPantalla = tarjetasR.map(t => t.dataset.fecha);
    const ordenEsperado = Object.keys(mano.porFecha).sort((a, b) => ord(a) - ord(b));
    check(JSON.stringify(ordenPantalla) === JSON.stringify(ordenEsperado) && ordenPantalla.includes('108') && pantalla['108'].titulo === '8VOS DE FINAL',
        'Recaudación por Fecha: una tarjeta por fecha con partidos o egresos, en orden cronológico y con el nombre de la ronda', ordenPantalla);
    const netoNegativo = f => /Neto de la fecha\s*-\$/.test(tarjetasR.find(t => t.dataset.fecha === f).textContent);
    check(ordenEsperado.every(f => pantalla[f] && pantalla[f].aranceles === mano.porFecha[f].aranceles && pantalla[f].egresos === mano.porFecha[f].egresos
        && pantalla[f].neto === Math.abs(mano.porFecha[f].aranceles - mano.porFecha[f].egresos) && netoNegativo(f) === (mano.porFecha[f].aranceles < mano.porFecha[f].egresos)),
        'Cada fecha muestra aranceles cobrados, egresos de la fecha y neto como la cuenta a mano', { pantalla, mano: mano.porFecha });
    const cajaTotal = () => D().querySelector('#contenedor-recaudacion-fecha .teso-recaud-total').textContent;
    const netoRecaud = () => num(el('txt-recaud-neto-total').textContent), netoBalance = () => num(el('txt-saldo-neto').textContent);
    check(netoRecaud() === mano.neto && netoBalance() === mano.neto && mano.sinPartido === 0,
        'Neto total de Recaudación por Fecha = Saldo Caja Neto del Balance = cuenta a mano', { netoRecaud: netoRecaud(), netoBalance: netoBalance(), aMano: mano.neto, aranceles: mano.totTeso, inscripciones: mano.totInsc, egresos: mano.totEgresos });
    check(montoTras(cajaTotal(), 'Aranceles de todas las fechas') === mano.totTeso && montoTras(cajaTotal(), 'Inscripciones cobradas') === mano.totInsc && montoTras(cajaTotal(), 'Egresos generales del torneo') === mano.generales
        && montoTras(cajaTotal(), 'Egresos por fecha') === mano.totEgresos - mano.generales && montoTras(cajaTotal(), 'Bonificado en inscripciones \\(informativo, no suma\\)') === bonifEsperado,
        'Total del torneo: aranceles + inscripciones − egresos por fecha − generales, y el bonificado aparte (no suma)', cajaTotal().replace(/\s+/g, ' ').trim());

    // 7) Un partido con pagos no se puede borrar (29/09/2026: antes se borraba y la plata quedaba suelta).
    //    Con el pago en $0 sí se borra, sin dejar entradas de Tesorería.
    await tab('sec-jornada');
    await crearPartido(7, 'superior', 'C', '4to 3ra', '5to 1ra', 1);
    const pBorrar = P(7, '4to 3ra', '5to 1ra');
    await abrirTeso(7);
    await pagar(pBorrar.id, 'local', 'in-p-ef', 7000);
    const borrarPartido = async () => {
        await tab('sec-jornada');
        setv('filtro-fecha-cronograma-admin', '7');
        const btnBorrar = D().querySelector(`.btn-borrar-partido[data-id="${pBorrar.id}"]`);
        if (btnBorrar) { respuestaConfirm = true; btnBorrar.click(); await esperar(3); }
    };
    await borrarPartido();
    await tab('sec-tesoreria');
    await recaudar();
    const mano2 = cuentaAMano();
    check(!!P(7, '4to 3ra', '5to 1ra') && /No se puede eliminar este partido/.test(ultimaAlerta()) && /4to 3ra: \$7[.,]000 \(FECHA 7\)/.test(ultimaAlerta()) && mano2.sinPartido === 0
        && netoRecaud() === netoBalance() && netoRecaud() === mano2.neto,
        'Borrar un partido con pagos se bloquea con un aviso (equipo, monto y qué hacer); el neto total sigue igual al Balance', { alerta: ultimaAlerta(), sinPartido: mano2.sinPartido, netoRecaud: netoRecaud(), netoBalance: netoBalance(), aMano: mano2.neto });
    await abrirTeso(7);
    await pagar(pBorrar.id, 'local', 'in-p-ef', 0);
    await borrarPartido();
    await tab('sec-tesoreria');
    await recaudar();
    const mano3 = cuentaAMano();
    const restos = Object.keys(LS('liga_tesoreria_partidos_v2') || {}).filter(k => k.split('_')[1] === String(pBorrar.id));
    check(!P(7, '4to 3ra', '5to 1ra') && restos.length === 0 && mano3.sinPartido === 0 && netoRecaud() === netoBalance() && netoRecaud() === mano3.neto,
        'Con el pago puesto en $0 el partido se borra y no deja entradas de Tesorería; el neto sigue igual al Balance', { restos, netoRecaud: netoRecaud(), netoBalance: netoBalance(), aMano: mano3.neto });

    // 8) A 390 px las tarjetas nuevas no desbordan
    const anchoOriginal = marco.style.width;
    marco.style.width = '390px';
    await cargar('admin.html');
    await abrirInscripciones();
    cards().forEach(c => { c.querySelector('.teso-insc-benef').open = true; });
    const desbordes = selector => {
        const w = D().documentElement.clientWidth;
        return [...D().querySelectorAll(selector + ' *')].filter(e => getComputedStyle(e).display !== 'none')
            .map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width > 0 && x.r.right > w + 1)
            .map(x => (x.e.id ? '#' + x.e.id : x.e.tagName + '.' + [...x.e.classList].join('.')) + ' right=' + Math.round(x.r.right)).slice(0, 6);
    };
    const dInsc = desbordes('#contenedor-tesoreria-inscripciones');
    await recaudar();
    const dRec = desbordes('#contenedor-recaudacion-fecha');
    const dEg = desbordes('#form-egreso');
    check(dInsc.length === 0 && dRec.length === 0 && dEg.length === 0, 'A 390 px no desbordan las tarjetas de Inscripciones (con beneficio abierto), la Recaudación por Fecha ni el formulario de egresos',
        { ancho: D().documentElement.clientWidth, dInsc, dRec, dEg, scrollPagina: D().documentElement.scrollWidth });
    marco.style.width = anchoOriginal;

    // 9) Rol Staff: no ve nada de esto y puede cargar un pago de partido sin errores de guardado
    localStorage.setItem('fake_rol', 'staff');
    const inscFsAntes = JSON.stringify((JSON.parse(localStorage.getItem('fakefs') || '{}')).tesoreriaInscripciones || {});
    const erroresAntes = salida.filter(s => /^JS ERROR/.test(s)).length;
    const alertasAntes = alertas.length;
    await cargar('admin.html');
    await tab('sec-tesoreria');
    const oculto = id => { const e = D().getElementById(id); return !!e && getComputedStyle(e).display === 'none'; };
    check(['btn-sub-teso-inscripciones', 'sub-vista-teso-inscripciones', 'btn-sub-teso-recaudacion', 'sub-vista-teso-recaudacion'].every(oculto) && getComputedStyle(el('form-egreso').closest('section')).display === 'none'
        && el('btn-sub-teso-partidos').classList.contains('active') && !oculto('sub-vista-teso-partidos'),
        'Rol Staff: no ve Inscripciones, Recaudación por Fecha ni egresos; queda en Aranceles por Partido', ['btn-sub-teso-inscripciones', 'sub-vista-teso-inscripciones', 'btn-sub-teso-recaudacion', 'sub-vista-teso-recaudacion'].map(id => id + ':' + oculto(id)));
    const pStaff = (LS('liga_partidos') || []).find(p => p.fecha === 1 && p.local && p.visitante);
    await abrirTeso(1);
    const inpStaff = cajaEquipo(pStaff.id, 'local').querySelector('.in-p-tr');
    const trAntes = Number(inpStaff.value) || 0;
    await pagar(pStaff.id, 'local', 'in-p-tr', trAntes + 1000);
    el('btn-sub-teso-partidos').click();
    await esperar(300);
    await cargar('admin.html');
    const claveStaff = Object.keys(LS('liga_tesoreria_partidos_v2') || {}).find(k => k.startsWith(`F1_${pStaff.id}_local_`));
    const trGuardado = ((LS('liga_tesoreria_partidos_v2') || {})[claveStaff] || {}).tr || 0;
    const alertasNuevas = alertas.slice(alertasAntes);
    check(trGuardado === trAntes + 1000 && !alertasNuevas.some(a => /No se pudo guardar/.test(a)) && salida.filter(s => /^JS ERROR/.test(s)).length === erroresAntes
        && JSON.stringify((JSON.parse(localStorage.getItem('fakefs') || '{}')).tesoreriaInscripciones || {}) === inscFsAntes,
        'Rol Staff: carga un pago de partido y se guarda, sin carteles de error, sin errores de JS y sin tocar las inscripciones', { trAntes, trGuardado, alertasNuevas });
    localStorage.removeItem('fake_rol');
}

// ---------------- Pagos que siguen al partido y fechas de grupos configurables (29/09/2026) ----------------
async function partidosYFechas() {
    out('\n=== PARTIDOS EDITADOS O BORRADOS: la plata de Tesorería nunca queda suelta ===');
    const num = t => Number(String(t).replace(/[^0-9-]/g, ''));
    const teso = () => LS('liga_tesoreria_partidos_v2') || {};
    const fsTeso = () => Object.keys((JSON.parse(localStorage.getItem('fakefs') || '{}')).tesoreriaPartidos || {}).map(decodeURIComponent);
    const fsSanciones = () => Object.values((JSON.parse(localStorage.getItem('fakefs') || '{}')).sanciones || {});
    const clavesDe = pid => Object.keys(teso()).filter(k => k.split('_')[1] === String(pid)).sort();
    const idEq = nombre => [...LS('liga_cicloSuperior'), ...LS('liga_cicloBasico')].find(e => e.nombre === nombre).id;
    const autoDe = pid => (LS('liga_sanciones') || []).filter(s => s.origenAuto && String(s.claveTeso || '').split('_')[1] === String(pid));
    const porId = id => (LS('liga_partidos') || []).find(p => p.id === id);
    const netos = async () => {
        await tab('sec-tesoreria');
        el('btn-sub-teso-recaudacion').click(); await esperar(2);
        const total = Object.values(teso()).reduce((a, v) => a + (v.ef || 0) + (v.tr || 0), 0);
        return { recaud: num(el('txt-recaud-neto-total').textContent), balance: num(el('txt-saldo-neto').textContent), totalTeso: total };
    };
    const cierra = n => n.recaud === n.balance;
    const editar = async (p, cambios) => {
        await tab('sec-jornada');
        setv('filtro-fecha-cronograma-admin', 'todas');
        editarPartido(p);
        if (cambios.fecha !== undefined) setv('partido-fecha', String(cambios.fecha));
        setv('partido-local', cambios.local || p.local, false);
        setv('partido-visitante', cambios.visitante || p.visitante, false);
        if (cambios.horario) setv('partido-horario', cambios.horario, false);
        await enviar('form-partido');
        await esperar(200); // que las escrituras lleguen al Firestore simulado
    };

    await cargar('admin.html');
    await tab('sec-jornada');
    const [A, B, C, E] = SUP.A; // 4to 1ra, 5to 2da, 6to 3ra, 7mo 1ra
    await crearPartido(4, 'superior', 'A', A, B, 0);
    await crearPartido(4, 'superior', 'A', C, E, 1);
    await crearPartido(6, 'superior', 'A', A, C, 2);
    const pM = P(4, A, B), pS = P(4, C, E), pD = P(6, A, C);
    await abrirTeso(4);
    await pagar(pM.id, 'local', 'in-p-ef', 10000);
    await pagar(pM.id, 'visita', 'in-p-tr', 5000);
    await tildar(pM.id, 'local', [jug(A, 5).dni]);
    await asistencia(pS.id, 'local', 'presente');
    await pagar(pS.id, 'local', 'in-p-ef', 30000);
    await asistencia(pS.id, 'visita', 'sin_aviso');
    const n0 = await netos();
    check(clavesDe(pM.id).join() === [`F4_${pM.id}_local_eq${idEq(A)}`, `F4_${pM.id}_visita_eq${idEq(B)}`].sort().join() && autoDe(pS.id).length === 1 && porId(pS.id).resultadoAuto && cierra(n0),
        'Preparación: pagos en un partido de la Fecha 4 y una ausencia con sanción automática y 3-0 en otro', { claves: clavesDe(pM.id), sanciones: autoDe(pS.id).length, n0 });

    // 1) Cambiar el horario: las claves no cambian y nada se mueve
    await editar(porId(pM.id), { horario: '18:00' });
    check(porId(pM.id).horario === '18:00' && teso()[`F4_${pM.id}_local_eq${idEq(A)}`].ef === 10000 && teso()[`F4_${pM.id}_visita_eq${idEq(B)}`].tr === 5000,
        'Cambiar el horario de un partido con pagos: se guarda y los pagos siguen en su lugar', clavesDe(pM.id));

    // 2) Cambiar la fecha: la entrada de cada equipo se muda a la clave nueva
    await editar(porId(pM.id), { fecha: 5 });
    const tM5 = teso();
    const n1 = await netos();
    check(porId(pM.id).fecha === 5 && clavesDe(pM.id).every(k => k.startsWith('F5_')) && clavesDe(pM.id).length === 2
        && tM5[`F5_${pM.id}_local_eq${idEq(A)}`].ef === 10000 && tM5[`F5_${pM.id}_local_eq${idEq(A)}`].asistencia === 'presente' && tM5[`F5_${pM.id}_visita_eq${idEq(B)}`].tr === 5000
        && fsTeso().filter(k => k.split('_')[1] === String(pM.id)).every(k => k.startsWith('F5_')) && cierra(n1) && n1.totalTeso === n0.totalTeso,
        'Cambiar la fecha (4→5): pagos y asistencia se mudan a la clave nueva, en Firestore no queda la vieja y el neto sigue cerrando', { claves: clavesDe(pM.id), n1 });

    // 3) Invertir local y visitante: cada equipo se lleva lo suyo
    await editar(porId(pM.id), { local: B, visitante: A });
    const tSw = teso();
    const pSw = porId(pM.id);
    const n2 = await netos();
    check(pSw.local === B && pSw.visitante === A && tSw[`F5_${pM.id}_local_eq${idEq(B)}`] && tSw[`F5_${pM.id}_local_eq${idEq(B)}`].tr === 5000
        && tSw[`F5_${pM.id}_visita_eq${idEq(A)}`] && tSw[`F5_${pM.id}_visita_eq${idEq(A)}`].ef === 10000 && tSw[`F5_${pM.id}_visita_eq${idEq(A)}`].asistencia === 'presente'
        && clavesDe(pM.id).length === 2 && cierra(n2) && n2.totalTeso === n0.totalTeso,
        'Invertir local y visitante: los pagos y la asistencia siguen a cada equipo (buscado por id, no por lado)', { claves: clavesDe(pM.id), n2 });
    const dniTildado = jug(A, 5).dni;
    check(!(pSw.asistentesLocal || []).includes(dniTildado) && (pSw.asistentesVisitante || []).includes(dniTildado),
        'Invertir local y visitante: el jugador tildado de ' + A + ' pasa a la lista del lado visitante (su equipo)', { local: pSw.asistentesLocal, visitante: pSw.asistentesVisitante });

    // 4) Sacar del partido a un equipo con plata: se bloquea y no cambia nada
    const antesBloqueo = JSON.stringify({ p: porId(pM.id), t: clavesDe(pM.id).map(k => [k, teso()[k]]) });
    await editar(porId(pM.id), { visitante: E });
    const alertaSacar = ultimaAlerta();
    check(/No se guardó el cambio/.test(alertaSacar) && new RegExp(`${A}: \\$10[.,]000 \\(FECHA 5\\)`).test(alertaSacar) && /poné esos pagos en \$0/.test(alertaSacar)
        && JSON.stringify({ p: porId(pM.id), t: clavesDe(pM.id).map(k => [k, teso()[k]]) }) === antesBloqueo,
        'Cambiar un equipo que tiene plata cargada: se bloquea con el aviso (equipo, monto, fecha, qué hacer) y ni el partido ni los pagos cambian', alertaSacar);

    // 5) Con su pago en $0 el cambio pasa; su asistencia se descarta y la devolución queda en la Caja
    await abrirTeso(5);
    await pagar(pM.id, 'visita', 'in-p-ef', 0);
    const movDevol = (LS('liga_caja_movimientos') || []).slice(-1)[0] || {};
    await editar(porId(pM.id), { visitante: E });
    const n3 = await netos();
    check(porId(pM.id).visitante === E && !clavesDe(pM.id).some(k => k.endsWith('_eq' + idEq(A))) && clavesDe(pM.id).length === 1 && movDevol.monto === -10000 && cierra(n3),
        'Con el pago en $0 el equipo se puede cambiar: su entrada (asistencia incluida) se descarta y la devolución de $10.000 quedó en la Caja', { claves: clavesDe(pM.id), movDevol, n3 });

    // 6) Borrar con plata: bloqueado. En $0: se borra sin dejar entradas.
    const borrar = async id => {
        await tab('sec-jornada');
        setv('filtro-fecha-cronograma-admin', 'todas');
        const b = D().querySelector(`.btn-borrar-partido[data-id="${id}"]`);
        if (b) { b.click(); await esperar(200); }
    };
    await borrar(pM.id);
    check(!!porId(pM.id) && /No se puede eliminar este partido/.test(ultimaAlerta()) && new RegExp(`${B}: \\$5[.,]000`).test(ultimaAlerta()) && teso()[`F5_${pM.id}_local_eq${idEq(B)}`].tr === 5000,
        'Borrar un partido con plata: bloqueado con aviso, el partido y el pago siguen', ultimaAlerta());
    await abrirTeso(5);
    await pagar(pM.id, 'local', 'in-p-tr', 0);
    await borrar(pM.id);
    const n4 = await netos();
    check(!porId(pM.id) && clavesDe(pM.id).length === 0 && !fsTeso().some(k => k.split('_')[1] === String(pM.id)) && cierra(n4),
        'Borrar un partido sin plata: se borra y no quedan entradas de Tesorería (ni en Firestore)', { claves: clavesDe(pM.id), n4 });

    // 7) Sanción automática al mudar: una sola, con la clave nueva, y sigue igual si ya estaba levantada
    const sAntes = autoDe(pS.id)[0];
    await editar(porId(pS.id), { fecha: 5 });
    const sF5 = autoDe(pS.id);
    check(sF5.length === 1 && sF5[0].claveTeso === `F5_${pS.id}_visita_eq${idEq(E)}` && sF5[0].id !== sAntes.id && Number(sF5[0].acta) === 5 && /^Fecha 5/.test(sF5[0].motivo) && !sF5[0].levantada
        && !(LS('liga_sanciones') || []).some(s => s.claveTeso === sAntes.claveTeso) && fsSanciones().filter(s => String(s.claveTeso || '').split('_')[1] === String(pS.id)).length === 1
        && porId(pS.id).resultadoAuto && porId(pS.id).golesLocal === 3,
        'Mudar un partido con sanción automática (Art. 17 Bis): queda una sola, con la clave, el acta y el motivo de la Fecha 5, sin huérfana ni duplicada', sF5.map(s => ({ id: s.id, clave: s.claveTeso, acta: s.acta, motivo: s.motivo })));
    await abrirTeso(5);
    await pagar(pS.id, 'visita', 'in-p-ef', 15000);
    const levantada = autoDe(pS.id)[0] || {};
    await editar(porId(pS.id), { local: E, visitante: C });
    const sSw = autoDe(pS.id);
    const pSsw = porId(pS.id);
    check(levantada.levantada && sSw.length === 1 && sSw[0].levantada && sSw[0].fechaLevantada === levantada.fechaLevantada && sSw[0].claveTeso === `F5_${pS.id}_local_eq${idEq(E)}`
        && pSsw.resultadoAuto && pSsw.golesLocal === 0 && pSsw.golesVisitante === 3 && teso()[`F5_${pS.id}_local_eq${idEq(E)}`].ef === 15000,
        'Invertir local y visitante con la quita ya levantada: sigue levantada (misma fecha), una sola, y el 3-0 automático se da vuelta con los equipos', { sanciones: sSw.map(s => s.claveTeso + ' levantada=' + s.levantada), goles: [pSsw.golesLocal, pSsw.golesVisitante] });

    // 8) Sanción automática descartada a mano: la marca viaja con el partido y no se vuelve a crear
    await abrirTeso(6);
    await asistencia(pD.id, 'visita', 'sin_aviso');
    const sD = autoDe(pD.id)[0];
    await tab('sec-tribunal');
    const bSanc = sD && D().querySelector(`.btn-borrar-sancion[data-id="${sD.id}"]`);
    if (bSanc) { bSanc.click(); await esperar(3); }
    await editar(porId(pD.id), { fecha: 7 });
    const tD = teso()[`F7_${pD.id}_visita_eq${idEq(C)}`] || {};
    check(!!sD && tD.sancionDescartada === true && tD.asistencia === 'sin_aviso' && autoDe(pD.id).length === 0 && !teso()[`F6_${pD.id}_visita_eq${idEq(C)}`],
        'Sanción automática borrada a mano y partido mudado (6→7): la marca "descartada" viaja con el equipo y no se vuelve a crear', { tD, auto: autoDe(pD.id).length });

    // 9) Pagos sueltos de antes del arreglo: detalle en Recaudación por Fecha
    const conSueltos = { ...teso(), [`F3_999_local_eq${idEq(A)}`]: { ef: 4000, tr: 0 }, 'F2_998_visita_equipo viejo': { ef: 0, tr: 2500 } };
    W().almacen.setItem('liga_tesoreria_partidos_v2', JSON.stringify(conSueltos));
    await esperar(300);
    await cargar('admin.html');
    const n5 = await netos();
    const caja = D().querySelector('#contenedor-recaudacion-fecha .teso-recaud-total');
    const filas = [...caja.querySelectorAll('.teso-recaud-suelto')].map(f => f.textContent.replace(/\s+/g, ' ').trim());
    check(/\$6[.,]500 cargados en partidos que ya no existen/.test(caja.textContent) && filas.length === 2
        && filas.some(f => new RegExp(`^${A} · FECHA 3\\s*\\$4[.,]000$`).test(f)) && filas.some(f => /^F2_998_visita_equipo viejo · FECHA 2\s*\$2[.,]500$/.test(f)) && cierra(n5),
        'Pagos sueltos de antes: la nota lista equipo (o la clave si no hay equipo), fecha y monto de cada uno, y el neto sigue igual al Balance', { filas, n5 });
    const sinSueltos = teso(); delete sinSueltos[`F3_999_local_eq${idEq(A)}`]; delete sinSueltos['F2_998_visita_equipo viejo'];
    W().almacen.setItem('liga_tesoreria_partidos_v2', JSON.stringify(sinSueltos));
    await esperar(300);

    out('\n=== FECHAS DE FASE DE GRUPOS CONFIGURABLES POR CICLO ===');
    await cargar('admin.html');
    await tab('sec-jornada');
    const opciones = id => [...el(id).options].map(o => o.value);
    const PO = ['108', '104', '102', '100'];
    const rango = n => Array.from({ length: n }, (_, i) => String(i + 1));
    setv('partido-ciclo', 'superior');
    check(LS('liga_fechas_grupos') === null && el('fechas-grupos-superior').value === '7' && el('fechas-grupos-basico').value === '7'
        && JSON.stringify(opciones('partido-fecha')) === JSON.stringify([...rango(7), ...PO]),
        'Sin configurar: 7 fechas por ciclo (campos en 7 y Fecha 1 a 7 más los playoffs)', opciones('partido-fecha'));
    setv('fechas-grupos-superior', '10', false); setv('fechas-grupos-basico', '5', false);
    el('btn-guardar-fechas-grupos').click(); await esperar(300);
    const fsConfig = (JSON.parse(localStorage.getItem('fakefs') || '{}').config || {}).fechasGrupos;
    check(JSON.stringify(LS('liga_fechas_grupos')) === '{"superior":10,"basico":5}' && fsConfig && JSON.stringify(fsConfig).includes('10') && /guardadas: Superior 10, Básico 5\.$/.test(ultimaAlerta()),
        'Guardar Superior 10 / Básico 5: queda en liga_fechas_grupos (config/fechasGrupos en Firestore)', { valor: LS('liga_fechas_grupos'), fsConfig, alerta: ultimaAlerta() });
    setv('partido-ciclo', 'superior');
    const opSup = opciones('partido-fecha');
    setv('partido-ciclo', 'basico');
    const opBas = opciones('partido-fecha');
    const opEg = opciones('egreso-fecha');
    const etiquetaEg10 = ([...el('egreso-fecha').options].find(o => o.value === '10') || {}).textContent;
    check(JSON.stringify(opSup) === JSON.stringify([...rango(10), ...PO]) && JSON.stringify(opBas) === JSON.stringify([...rango(5), ...PO])
        && JSON.stringify(opEg) === JSON.stringify(['', ...rango(10), ...PO]) && etiquetaEg10 === 'FECHA 10',
        'Superior ofrece Fecha 1-10, Básico 1-5 (más playoffs) y los egresos 1-10 (el máximo) más playoffs y "General"', { opSup, opBas, opEg });
    setv('partido-ciclo', 'basico'); setv('partido-fecha', '5');
    setv('partido-ciclo', 'superior');
    check(el('partido-fecha').value === '5', 'Cambiar de ciclo conserva la fecha elegida si existe en los dos', el('partido-fecha').value);
    setv('partido-fecha', '9'); setv('partido-ciclo', 'basico');
    check(el('partido-fecha').value === '5', 'Pasar de Superior (Fecha 9) a Básico (5 fechas) cae en la Fecha 5', el('partido-fecha').value);

    // Partido en la Fecha 9 con resultado: aparece en el fixture público
    setv('partido-ciclo', 'superior');
    setv('goles-local', '', false);
    await crearPartido(9, 'superior', 'A', A, E, 0);
    const p9 = P(9, A, E);
    editarPartido(p9);
    check(el('partido-fecha').value === '9', 'Editar el partido de la Fecha 9: el selector muestra la Fecha 9', el('partido-fecha').value);
    setv('goles-local', '2', false); setv('goles-visitante', '1', false);
    await enviar('form-partido'); await esperar(3);
    check(porId(p9.id).fecha === 9 && porId(p9.id).jugado, 'Partido de la Fecha 9 guardado con resultado 2-1', porId(p9.id));
    await cargar('index.html');
    const btn9 = D().querySelector('#botones-fecha-fixture .btn-fecha-select[data-fecha="9"]');
    if (btn9) { btn9.click(); await esperar(5); }
    const textoFixture = (D().getElementById('contenedor-partidos-fecha') || {}).textContent || '';
    check(!!btn9 && btn9.textContent.trim() === 'Fecha 9' && textoFixture.includes(A) && textoFixture.includes(E),
        'Web pública: el fixture tiene el botón "Fecha 9" y muestra ese partido', { boton: btn9 && btn9.textContent });

    // Bajar Superior a 8 con partidos en la Fecha 9: avisa y no borra nada
    await cargar('admin.html');
    await tab('sec-jornada');
    setv('fechas-grupos-superior', '8', false);
    el('btn-guardar-fechas-grupos').click(); await esperar(300);
    setv('partido-ciclo', 'superior');
    check(/Ojo:/.test(ultimaAlerta()) && /Ciclo Superior: ya hay partidos en la Fecha 9/.test(ultimaAlerta()) && /No se borró nada/.test(ultimaAlerta())
        && !!porId(p9.id) && JSON.stringify(opciones('partido-fecha')) === JSON.stringify([...rango(9), ...PO]) && LS('liga_fechas_grupos').superior === 8,
        'Bajar Superior a 8 con un partido en la Fecha 9: avisa, guarda, no borra nada y la Fecha 9 sigue en el selector', { alerta: ultimaAlerta(), opciones: opciones('partido-fecha') });
    setv('fechas-grupos-superior', '0', false);
    el('btn-guardar-fechas-grupos').click(); await esperar(50);
    check(/entre 1 y 30/.test(ultimaAlerta()) && LS('liga_fechas_grupos').superior === 8, 'Un valor fuera de 1-30 se rechaza', ultimaAlerta());

    // A 390 px los campos nuevos no desbordan
    const anchoOriginal = marco.style.width;
    marco.style.width = '390px';
    await cargar('admin.html');
    await tab('sec-jornada');
    const seccion = el('btn-guardar-fechas-grupos').closest('section');
    const w = D().documentElement.clientWidth;
    const desb = [seccion, ...seccion.querySelectorAll('*')].map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width > 0 && x.r.right > w + 1)
        .map(x => (x.e.id ? '#' + x.e.id : x.e.tagName) + ' right=' + Math.round(x.r.right));
    check(desb.length === 0, 'A 390 px la sección "Fechas de Fase de Grupos" no desborda', { ancho: w, desb, scrollWidthPagina: D().body.scrollWidth });
    marco.style.width = anchoOriginal;

    // Dejar la configuración como estaba (7/7) y sacar el partido de prueba
    await cargar('admin.html');
    await borrar(p9.id);
    setv('fechas-grupos-superior', '7', false); setv('fechas-grupos-basico', '7', false);
    el('btn-guardar-fechas-grupos').click(); await esperar(300);
    check(!porId(p9.id) && JSON.stringify(LS('liga_fechas_grupos')) === '{"superior":7,"basico":7}', 'Limpieza: partido de la Fecha 9 borrado y configuración de vuelta en 7/7');
}

// ---------------- Editar partidos: invertir local y visitante, y conservar los equipos (29/09/2026) ----------------
async function invertirYConservarEquipos() {
    out('\n=== EDITAR UN PARTIDO: invertir local y visitante, y conservar los equipos al cambiar fecha o grupo ===');
    const [A, B, C, E] = SUP.A; // 4to 1ra, 5to 2da, 6to 3ra, 7mo 1ra
    const porId = id => (LS('liga_partidos') || []).find(p => p.id === id);
    const fsPartido = id => ((JSON.parse(localStorage.getItem('fakefs') || '{}')).partidos || {})[String(id)] || {};
    const ordenado = a => (a || []).slice().sort().join();
    const dnis = (eq, ds) => ds.map(d => jug(eq, d).dni).sort().join();
    const statsWeb = async equipos => {
        await cargar('index.html');
        const res = {};
        for (const equipo of equipos) {
            D().querySelector('.tabs-sup .tab-btn[data-grupo-val="A"]').click();
            const celda = [...D().querySelectorAll('.td-team-name')].find(c => c.textContent.trim() === equipo);
            celda.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            [...D().querySelectorAll('#modal-equipo-tbody-jugadores tr')].forEach(tr => {
                res[equipo + ' | ' + tr.cells[2].textContent.trim()] = [3, 4, 5, 6].map(i => +tr.cells[i].textContent).join('/');
            });
            D().getElementById('modal-equipo').classList.add('seccion-oculta');
        }
        return res;
    };
    const editarDeNuevo = async id => {
        await tab('sec-jornada');
        setv('filtro-fecha-cronograma-admin', 'todas');
        editarPartido(porId(id));
    };

    // Preparación: B 3-1 E en la Fecha 6, con lista de buena fe, goleadores y tarjetas en los dos lados
    await cargar('admin.html');
    await tab('sec-jornada');
    await crearPartido(6, 'superior', 'A', B, E, 0);
    const pI = P(6, B, E);
    // Un jugador suspendido por las fases anteriores no se puede tildar: se eligen 4 que no lo estén.
    const suspendidos = (LS('liga_sanciones') || []).filter(s => s.tipo === 'Sanción Disciplinaria').map(s => String(s.jugadorId));
    const libres = eq => [1, 5, 7, 9, 10, 11].filter(d => !suspendidos.includes(jug(eq, d).dni)).slice(0, 4);
    const tildB = libres(B), tildE = libres(E);
    const dnisOrig = dnis;
    const dnisTild = eq => dnisOrig(eq, eq === B ? tildB : tildE);
    await abrirTeso(6);
    await tildar(pI.id, 'local', tildB.map(d => jug(B, d).dni));
    await tildar(pI.id, 'visita', tildE.map(d => jug(E, d).dni));
    await editarDeNuevo(pI.id);
    setv('goles-local', '3', false); setv('goles-visitante', '1', false);
    setv('dorsales-goles-local', '5, 5, 7', false); setv('dorsales-goles-visitante', '9', false);
    setv('dorsales-amarillas-local', '1', false); setv('dorsales-rojas-visitante', '5', false);
    await enviar('form-partido'); await esperar(300);
    const base = porId(pI.id);
    check(base.jugado && base.golesLocal === 3 && ordenado(base.asistentesLocal) === dnisTild(B) && ordenado(base.asistentesVisitante) === dnisTild(E)
        && base.goleadoresLocal.reduce((a, g) => a + g.cantidad, 0) === 3 && base.rojasVisitante.join() === jug(E, 5).dni,
        'Preparación: ' + B + ' 3-1 ' + E + ' con 4 tildados por lado, goleadores y tarjetas', { goles: [base.golesLocal, base.golesVisitante] });
    const fsAntes = fsPartido(pI.id);
    const statsAntes = await statsWeb([B, E]);

    // 1) Invertir desde el formulario: elegir de Local al que era Visitante
    await cargar('admin.html');
    await editarDeNuevo(pI.id);
    const sl = el('partido-local');
    sl.dispatchEvent(new Event('focus'));
    sl.value = E; sl.dispatchEvent(new Event('change', { bubbles: true }));
    const form = {
        visitante: el('partido-visitante').value, gl: el('goles-local').value, gv: el('goles-visitante').value,
        dl: el('dorsales-goles-local').value, dv: el('dorsales-goles-visitante').value,
        al: el('dorsales-amarillas-local').value, av: el('dorsales-amarillas-visitante').value, rl: el('dorsales-rojas-local').value, rv: el('dorsales-rojas-visitante').value
    };
    check(form.visitante === B && form.gl === '1' && form.gv === '3' && form.dl === '9' && form.dv === '5, 5, 7' && form.al === '' && form.av === '1' && form.rl === '5' && form.rv === '',
        'Formulario: elegir de Local al que era Visitante los intercambia, y el marcador, los goleadores y las tarjetas se van con cada equipo', form);
    await enviar('form-partido'); await esperar(300);
    const sw = porId(pI.id);
    const golesDeLado = (lista, eq, d) => (lista || []).filter(g => g.id === jug(eq, d).dni).reduce((a, g) => a + g.cantidad, 0);
    check(sw.local === E && sw.visitante === B && sw.golesLocal === 1 && sw.golesVisitante === 3
        && ordenado(sw.asistentesLocal) === dnisTild(E) && ordenado(sw.asistentesVisitante) === dnisTild(B)
        && golesDeLado(sw.goleadoresLocal, E, 9) === 1 && golesDeLado(sw.goleadoresVisitante, B, 5) === 2 && golesDeLado(sw.goleadoresVisitante, B, 7) === 1
        && sw.amarillasVisitante.join() === jug(B, 1).dni && sw.rojasLocal.join() === jug(E, 5).dni && sw.amarillasLocal.length === 0 && sw.rojasVisitante.length === 0,
        'Guardado invertido: marcador 1-3 (el de cada equipo) y lista de buena fe, goleadores y tarjetas del lado de su equipo',
        { goles: [sw.golesLocal, sw.golesVisitante], goleadoresLocal: sw.goleadoresLocal, goleadoresVisitante: sw.goleadoresVisitante, amarillas: [sw.amarillasLocal, sw.amarillasVisitante], rojas: [sw.rojasLocal, sw.rojasVisitante] });
    const fsDesp = fsPartido(pI.id);
    check((fsDesp.asistentesLocal || []).length === 4 && ordenado(fsDesp.asistentesLocal) === ordenado(fsAntes.asistentesVisitante) && ordenado(fsDesp.asistentesVisitante) === ordenado(fsAntes.asistentesLocal),
        'En Firestore las listas de buena fe (con códigos) también quedaron intercambiadas', { antes: [fsAntes.asistentesLocal, fsAntes.asistentesVisitante], despues: [fsDesp.asistentesLocal, fsDesp.asistentesVisitante] });
    const statsDesp = await statsWeb([B, E]);
    const cambiados = Object.keys(statsAntes).filter(k => statsAntes[k] !== statsDesp[k]);
    check(Object.keys(statsAntes).length === 12 && statsAntes[B + ' | ' + jug(B, 5).nombre].split('/')[1] !== '0' && cambiados.length === 0 && Object.keys(statsDesp).length === 12,
        'Web pública: PJ, goles y tarjetas de los 12 jugadores de los dos equipos quedan iguales después de invertir', { cambiados: cambiados.map(k => k + ': ' + statsAntes[k] + ' → ' + statsDesp[k]), ejemplo: statsDesp[B + ' | ' + jug(B, 5).nombre] });

    // 2) Invertir de vuelta cambiando los dos equipos a mano (sin pasar por el intercambio del formulario)
    await cargar('admin.html');
    await editarDeNuevo(pI.id);
    setv('partido-local', B, false); setv('partido-visitante', E, false);
    await enviar('form-partido'); await esperar(300);
    const back = porId(pI.id);
    check(back.local === B && back.golesLocal === 3 && back.golesVisitante === 1 && ordenado(back.asistentesLocal) === dnisTild(B)
        && golesDeLado(back.goleadoresLocal, B, 5) === 2 && back.amarillasLocal.join() === jug(B, 1).dni && back.rojasVisitante.join() === jug(E, 5).dni,
        'Invertir eligiendo los dos equipos a mano: al guardar, los campos igual se van con su equipo (vuelve a 3-1 con todo en su lado)', { goles: [back.golesLocal, back.golesVisitante] });

    // 3) Playoffs: invertir un partido jugado no toca el bracket ni el ganador
    const pPo = (LS('liga_partidos') || []).find(p => p.esPlayoff && p.jugado && p.ronda !== 'final' && p.golesLocal !== p.golesVisitante);
    if (pPo) {
        const crucesAntes = JSON.stringify(LS('liga_cruces_playoffs'));
        const confirmsAntes = confirms.length;
        await editarDeNuevo(pPo.id);
        setv('partido-local', pPo.visitante, false); setv('partido-visitante', pPo.local, false);
        await enviar('form-partido'); await esperar(300);
        const q = porId(pPo.id);
        check(q.local === pPo.visitante && q.visitante === pPo.local && q.golesLocal === pPo.golesVisitante && q.golesVisitante === pPo.golesLocal
            && q.penalesLocal === pPo.penalesVisitante && q.penalesVisitante === pPo.penalesLocal && JSON.stringify(LS('liga_cruces_playoffs')) === crucesAntes && confirms.length === confirmsAntes,
            'Playoffs: invertir un partido jugado conserva el marcador y los penales de cada equipo, y el bracket no cambia', { antes: [pPo.local, pPo.golesLocal, pPo.golesVisitante, pPo.visitante], despues: [q.local, q.golesLocal, q.golesVisitante, q.visitante] });
    } else {
        out('  (no encontré un partido de playoffs jugado para invertir)');
    }

    // 4) Editando: cambiar la fecha conserva los equipos; un grupo donde no están los deja vacíos
    await cargar('admin.html');
    await editarDeNuevo(pI.id);
    setv('partido-fecha', '7');
    const conservaFecha = { local: el('partido-local').value, visitante: el('partido-visitante').value };
    check(conservaFecha.local === B && conservaFecha.visitante === E, 'Editando: cambiar la Fecha conserva Local y Visitante (antes volvían a los dos primeros del grupo)', conservaFecha);
    setv('partido-grupo-select', 'B');
    const vacios = { local: el('partido-local').value, visitante: el('partido-visitante').value, primera: el('partido-local').options[0].textContent };
    await enviar('form-partido'); await esperar(50);
    check(vacios.local === '' && vacios.visitante === '' && vacios.primera === '-- Elegí el equipo --' && /Elegí el equipo local y el visitante/.test(ultimaAlerta())
        && porId(pI.id).fecha === 6 && porId(pI.id).local === B,
        'Editando: pasar a un grupo donde no están deja los dos lados en "-- Elegí el equipo --" y no deja guardar sin elegirlos', { vacios, alerta: ultimaAlerta() });
    setv('partido-grupo-select', 'A');
    const vuelven = { local: el('partido-local').value, visitante: el('partido-visitante').value };
    check(vuelven.local === B && vuelven.visitante === E, 'Editando: volver al grupo del partido recupera sus equipos', vuelven);
    setv('partido-fecha', '6');
    await enviar('form-partido'); await esperar(200);
    const final = porId(pI.id);
    check(final.fecha === 6 && final.local === B && final.visitante === E && final.golesLocal === 3 && ordenado(final.asistentesLocal) === dnisTild(B),
        'Después de pasear por otra fecha y otro grupo, el partido se guarda igual que estaba', { fecha: final.fecha, local: final.local, goles: [final.golesLocal, final.golesVisitante] });

    // 5) Partido nuevo: cambiar la fecha conserva la elección; un grupo donde no están pone los primeros, como siempre
    setv('partido-ciclo', 'superior'); setv('partido-fecha', '6'); setv('partido-grupo-select', 'A');
    setv('partido-local', C, false); setv('partido-visitante', E, false);
    setv('partido-fecha', '7');
    const nuevoConserva = { local: el('partido-local').value, visitante: el('partido-visitante').value };
    setv('partido-grupo-select', 'B');
    const nuevoDefault = { local: el('partido-local').value, visitante: el('partido-visitante').value };
    check(nuevoConserva.local === C && nuevoConserva.visitante === E && nuevoDefault.local === SUP.B[0] && nuevoDefault.visitante === SUP.B[1],
        'Partido nuevo: cambiar la Fecha conserva los equipos elegidos; en un grupo donde no están se proponen los dos primeros, como antes', { nuevoConserva, nuevoDefault });
}

// ---------------- Historial de cambios del staff para el Coordinador (30/09/2026) ----------------
// Va al final (antes de Tabla Única, que pasa Superior a formato único): agrega un partido, una sanción y un pago
// que ninguna fase anterior espera.
async function historialDeCambios() {
    out('\n=== HISTORIAL DE CAMBIOS: cada uno anota lo que carga, solo el Coordinador lo lee y lo vacía ===');
    const fsHist = () => Object.values((JSON.parse(localStorage.getItem('fakefs') || '{}')).historialCambios || {});
    // Visible de verdad (un botón dentro de una sección oculta conserva su propio display).
    const visible = e => !!e && e.getClientRects().length > 0;
    const tabHist = () => D().querySelector('.staff-tab-btn[data-target="sec-historial-cambios"]');
    const erroresJS = () => salida.filter(s => /^JS ERROR/.test(s)).length;
    const [A, B] = SUP.A; // 4to 1ra, 5to 2da
    const pesos = '\\$[\\d.,]+';
    const DNI_NUEVO = '47123456';
    // Resultado de una operación directa contra el Firestore simulado con el rol actual (como alguien que salta el panel).
    const intento = async fn => { try { await fn(); return 'permitido'; } catch (e) { return e.code || e.message; } };
    const { cargarFirestore } = await import('./JAVASCRIPT/firebase-sdk.js');
    const { db, fsSdk } = await cargarFirestore();
    const refHist = id => fsSdk.doc(db, 'historialCambios', id);

    // 1) Coordinador: el recorrido anterior quedó anotado con el nombre de quien lo hizo; "Vaciar Historial" lo borra
    localStorage.removeItem('fake_rol');
    await cargar('admin.html');
    const previas = fsHist();
    check(visible(tabHist()) && previas.length > 0 && previas.every(h => h.email === 'prueba@ejemplo.com' && h.autor === 'Prueba ' + h.rol && /^\d+-\d+$/.test(h.id) && h.timestamp > 0)
        && previas.some(h => h.rol === 'coordinador' && /^cargó el resultado de FECHA 1 \(Superior\): .+ \d+-\d+ .+$/.test(h.detalle))
        && previas.some(h => h.rol === 'coordinador' && new RegExp('^registró un pago de ' + pesos + ' de .+ \\(Arancel de Partido · FECHA \\d+, (efectivo|transferencia)\\)$').test(h.detalle))
        && previas.some(h => /^dio de alta a .+ \(#\d+\) en .+$/.test(h.detalle))
        && previas.some(h => /^emitió el Acta N° \d+ \(Superior\): suspensión de 2 fechas a 5to 2da — .+ \(#9\)$/.test(h.detalle))
        && previas.some(h => h.rol === 'staff' && /^registró un pago de /.test(h.detalle)),
        'Coordinador: ve la pestaña Historial y lo cargado en las fases anteriores quedó anotado (resultados, pagos, altas, Tribunal), firmado por quien lo hizo (también el pago que cargó el Staff)',
        { visible: visible(tabHist()), entradas: previas.length, porRol: previas.reduce((m, h) => (m[h.rol] = (m[h.rol] || 0) + 1, m), {}), ejemplos: previas.slice(0, 4).map(h => h.detalle) });
    await tab('sec-historial-cambios');
    check(visible(el('sec-historial-cambios')) && D().querySelectorAll('#lista-historial-cambios .historial-item').length === previas.length,
        'La pestaña muestra todas las entradas', { items: D().querySelectorAll('#lista-historial-cambios .historial-item').length, esperadas: previas.length });
    respuestaConfirm = true;
    const confirmsAntes = confirms.length;
    el('btn-vaciar-historial-cambios').click();
    await esperar(200);
    check(confirms.length === confirmsAntes + 1 && fsHist().length === 0 && /Todavía no hay cambios/.test(el('lista-historial-cambios').textContent),
        'Coordinador: "Vaciar Historial" pide confirmación y borra todas las entradas del servidor', { quedan: fsHist().length, confirm: confirms[confirms.length - 1] });
    const lecturaCoord = await intento(() => fsSdk.getDocs(fsSdk.collection(db, 'historialCambios')));
    check(lecturaCoord === 'permitido', 'Reglas: el Coordinador puede leer historialCambios', lecturaCoord);

    // 2) Staff: no recibe el historial ni ve la pestaña; carga resultado, pago, sanción, alta y baja
    localStorage.setItem('fake_rol', 'staff');
    const erroresAntes = erroresJS();
    const alertasAntes = alertas.length;
    await cargar('admin.html');
    if (tabHist()) tabHist().click();
    await esperar(2);
    check(LS('liga_historial_cambios') === null && !visible(tabHist()) && !visible(el('sec-historial-cambios')) && !visible(el('btn-vaciar-historial-cambios')),
        'Rol Staff: no descarga el historial y no ve la pestaña, la lista ni "Vaciar Historial" (ni forzando el clic en la pestaña)',
        { almacen: LS('liga_historial_cambios'), tab: visible(tabHist()), seccion: visible(el('sec-historial-cambios')), boton: visible(el('btn-vaciar-historial-cambios')) });

    await tab('sec-jornada');
    setv('partido-ciclo', 'superior');
    setv('partido-fecha', '4');
    setv('partido-grupo-select', 'A');
    setv('partido-local', A, false); setv('partido-visitante', B, false);
    setv('partido-dia', '2026-10-31', false);
    setv('partido-arancel-monto', '30000', false);
    setv('goles-local', '2', false); setv('goles-visitante', '1', false);
    setv('dorsales-goles-local', '5, 7', false); setv('dorsales-goles-visitante', '9', false);
    ['amarillas-local', 'rojas-local', 'amarillas-visitante', 'rojas-visitante'].forEach(c => setv('dorsales-' + c, '', false));
    await enviar('form-partido');
    const pNuevo = (LS('liga_partidos') || []).filter(p => p.fecha === 4 && p.local === A && p.visitante === B).sort((x, y) => y.id - x.id)[0];
    setv('filtro-fecha-cronograma-admin', 'todas');
    editarPartido(pNuevo);
    setv('goles-local', '3', false);
    setv('dorsales-goles-local', '5, 7, 9', false);
    await enviar('form-partido');

    await abrirTeso(4);
    const inpEf = cajaEquipo(pNuevo.id, 'local').querySelector('.in-p-ef');
    const efAntes = Number(inpEf.value) || 0;
    await pagar(pNuevo.id, 'local', 'in-p-ef', efAntes + 5000);

    await tab('sec-tribunal');
    setv('sancion-acta-num', '4', false); setv('sancion-ciclo', 'superior'); setv('sancion-equipo', B);
    setv('sancion-jugador-id', jug(B, 9).dni, false);
    setv('sancion-tipo', 'Sanción Disciplinaria', false); setv('sancion-puntos', '1', false);
    setv('sancion-motivo', 'Roja en la Fecha 4 (prueba del historial).', false);
    await enviar('form-sancion');

    await tab('sec-planteles');
    el('btn-sub-plantel-jugadores').click();
    setv('plantel-ciclo', 'superior'); setv('plantel-equipo-select', A);
    setv('jugador-nombre', 'Nuevo Historial', false); setv('jugador-dni', DNI_NUEVO, false); setv('jugador-dorsal', '42', false);
    setv('jugador-instagram', '', false);
    await enviar('form-jugador');
    respuestaConfirm = true;
    const btnBaja = D().querySelector(`.btn-borrar-jugador[data-dni="${DNI_NUEVO}"]`);
    if (btnBaja) btnBaja.click(); else out('  no encontré el botón de baja del jugador nuevo');
    await esperar(300);

    const deStaff = fsHist().filter(h => h.rol === 'staff');
    const esperadas = [
        /^cargó el resultado de FECHA 4 \(Superior\): 4to 1ra 2-1 5to 2da$/,
        /^cambió el resultado de FECHA 4 \(Superior\): 4to 1ra 3-1 5to 2da \(era 4to 1ra 2-1 5to 2da\)$/,
        new RegExp('^registró un pago de \\$5[.,]?000 de 4to 1ra \\(Arancel de Partido · FECHA 4, efectivo\\)$'),
        /^emitió el Acta N° 4 \(Superior\): suspensión de 1 fecha a 5to 2da — .+ \(#9\)$/,
        /^dio de alta a Nuevo Historial \(#42\) en 4to 1ra$/,
        /^dio de baja a Nuevo Historial \(#42\) de 4to 1ra$/
    ];
    const faltan = esperadas.filter(re => !deStaff.some(h => re.test(h.detalle))).map(String);
    check(faltan.length === 0 && deStaff.length === esperadas.length && deStaff.every(h => h.autor === 'Prueba staff' && h.email === 'prueba@ejemplo.com'),
        'Staff: resultado cargado y corregido, pago, sanción, alta y baja quedan como 6 entradas legibles firmadas "Prueba staff"', { faltan, entradas: deStaff.map(h => h.detalle) });
    const alertasNuevas = alertas.slice(alertasAntes);
    check(!alertasNuevas.some(a => /No se pudo guardar/.test(a)) && erroresJS() === erroresAntes,
        'Staff: anotar en el historial no genera errores de guardado (las reglas le dejan crear) ni errores de JS', alertasNuevas.filter(a => /No se pudo/.test(a)));
    check(!deStaff.some(h => h.detalle.includes(DNI_NUEVO) || h.detalle.includes(jug(B, 9).dni)), 'El historial no guarda DNIs en el texto', deStaff.map(h => h.detalle));

    // 3) Reglas con rol Staff, probadas directo contra el Firestore simulado (no alcanza con esconder la pestaña)
    const idAlguna = deStaff[0] && deStaff[0].id;
    const reglas = {
        leerColeccion: await intento(() => fsSdk.getDocs(fsSdk.collection(db, 'historialCambios'))),
        leerDocumento: await intento(() => fsSdk.getDoc(refHist(idAlguna))),
        escuchar: await new Promise(res => fsSdk.onSnapshot(fsSdk.collection(db, 'historialCambios'), () => res('permitido'), e => res(e.code))),
        borrar: await intento(() => fsSdk.deleteDoc(refHist(idAlguna))),
        editar: await intento(() => fsSdk.updateDoc(refHist(idAlguna), { detalle: 'no hizo nada' })),
        pisarConSet: await intento(() => fsSdk.setDoc(refHist(idAlguna), { ...deStaff[0], detalle: 'no hizo nada' })),
        firmarComoOtro: await intento(() => fsSdk.setDoc(refHist('falsa-1'), { id: 'falsa-1', tipo: 'pago', detalle: 'x', autor: 'Otro', email: 'otro@ejemplo.com', rol: 'coordinador', timestamp: 1 }))
    };
    check(Object.values(reglas).every(r => r === 'permission-denied') && fsHist().filter(h => h.rol === 'staff').length === esperadas.length && !fsHist().some(h => h.id === 'falsa-1'),
        'Reglas con rol Staff: no puede leer (colección, documento ni escucha), ni borrar, ni editar entradas, ni firmar una con otro email', reglas);
    const vaciarAntes = fsHist().length;
    const confirmsStaff = confirms.length;
    el('btn-vaciar-historial-cambios').click(); // oculto para el Staff: aun forzando el clic no hace nada
    await esperar(200);
    check(fsHist().length === vaciarAntes && confirms.length === confirmsStaff && !alertas.slice(alertasAntes).some(a => /No se pudo guardar/.test(a)),
        'Rol Staff: forzar el clic en "Vaciar Historial" no borra nada ni pide confirmación', { antes: vaciarAntes, despues: fsHist().length });

    // 4) Coordinador: ve lo del Staff (lo más nuevo arriba) y sus propios cambios de beneficio
    localStorage.removeItem('fake_rol');
    await cargar('admin.html');
    await tab('sec-historial-cambios');
    const items = [...D().querySelectorAll('#lista-historial-cambios .historial-item')];
    const textos = items.map(i => i.textContent.replace(/\s+/g, ' ').trim());
    check(items.length === esperadas.length && textos[0].startsWith('Prueba staff dio de baja a Nuevo Historial (#42) de 4to 1ra') && /· Staff · prueba@ejemplo\.com$/.test(textos[0])
        && textos[textos.length - 1].startsWith('Prueba staff cargó el resultado de FECHA 4'),
        'Coordinador: ve las 6 entradas del Staff con nombre, rol y email, la más nueva arriba', textos);
    const alertasCoord = alertas.length;
    await tab('sec-tesoreria');
    el('btn-sub-teso-inscripciones').click();
    setv('filtro-inscripciones-ciclo', 'superior');
    await esperar(2);
    // Un equipo sin beneficio (las fases anteriores le dieron uno a otros equipos).
    const sinBenef = [...D().querySelectorAll('#contenedor-tesoreria-inscripciones .teso-insc-card')].find(c => !c.querySelector('.in-insc-benef-tipo').value).dataset.nombre;
    const cardB = () => [...D().querySelectorAll('#contenedor-tesoreria-inscripciones .teso-insc-card')].find(c => c.dataset.nombre === sinBenef);
    const cambiarCampo = async (sel, v) => { const c = cardB().querySelector(sel); c.value = v; c.dispatchEvent(new Event('change', { bubbles: true })); await esperar(2); };
    await cambiarCampo('.in-insc-benef-tipo', 'descuento');
    await cambiarCampo('.in-insc-benef-pct', '40');
    await cambiarCampo('.in-insc-benef-motivo', 'Campeones 2025');
    await cambiarCampo('.in-insc-benef-tipo', '');
    await esperar(200);
    const deCoord = fsHist().filter(h => h.rol === 'coordinador').sort((x, y) => x.timestamp - y.timestamp).map(h => h.detalle);
    check(deCoord.length === 4 && deCoord[0] === `le puso a ${sinBenef} un descuento del 50% en la inscripción` && deCoord[1] === `le puso a ${sinBenef} un descuento del 40% en la inscripción`
        && deCoord[2] === `le puso a ${sinBenef} un descuento del 40% en la inscripción (motivo: Campeones 2025)` && deCoord[3] === `le sacó el beneficio de inscripción a ${sinBenef}`
        && fsHist().filter(h => h.rol === 'coordinador').every(h => h.autor === 'Prueba coordinador'),
        'Coordinador: cada cambio de beneficio queda anotado con su nombre (tipo, porcentaje, motivo y quitarlo)', deCoord);
    // El Coordinador agrega entradas a un historial que ya tiene las del Staff: no tiene que reescribir ninguna (las reglas no lo dejan).
    const posiciones = fsHist().map(h => h._pos);
    check(!alertas.slice(alertasCoord).some(a => /No se pudo guardar/.test(a)) && fsHist().every(h => h._pos === h.timestamp) && new Set(posiciones).size === posiciones.length,
        'Coordinador: agregar después de entradas del Staff no reescribe ninguna (cada entrada ordena por su hora) ni da errores de guardado', { alertas: alertas.slice(alertasCoord).filter(a => /No se pudo/.test(a)), posiciones });

    // 5) A 390 px la pestaña no desborda
    const anchoOriginal = marco.style.width;
    marco.style.width = '390px';
    await cargar('admin.html');
    await tab('sec-historial-cambios');
    const w = D().documentElement.clientWidth;
    const desbordes = [...D().querySelectorAll('#sec-historial-cambios *')].filter(e => getComputedStyle(e).display !== 'none')
        .map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width > 0 && x.r.right > w + 1)
        .map(x => (x.e.id ? '#' + x.e.id : x.e.tagName + '.' + [...x.e.classList].join('.')) + ' right=' + Math.round(x.r.right)).slice(0, 6);
    check(visible(el('sec-historial-cambios')) && D().querySelectorAll('#lista-historial-cambios .historial-item').length > 0 && desbordes.length === 0 && D().documentElement.scrollWidth <= w,
        'A 390 px la pestaña Historial de Cambios no desborda', { ancho: w, scrollPagina: D().documentElement.scrollWidth, desbordes });
    marco.style.width = anchoOriginal;
}

(async () => {
    try {
        planificar();
        await fase0();
        await fase1();
        await fase2();
        for (const f of [1, 2, 3]) await jugarFecha(f);
        await fase3extra();
        await tesoreriaChecks();
        await playoffs();
        await publica();
        await sponsors();
        await prensa();
        await fotoJugador();
        await finanzas();
        await campanita();
        await responsive780();
        await resumenPublico();
        localStorage.setItem('__snapshot', localStorage.getItem('fakefs') || '{}');
        await bordes();
        await suspensionPorFechasJugadas();
        await suspension30();
        await beneficiosYRecaudacion();
        await partidosYFechas();
        await invertirYConservarEquipos();
        await historialDeCambios();
        await tablaUnica();
    } catch (e) {
        out('EXCEPCION DEL BANCO: ' + e.message + '\n' + e.stack);
    }
    check(avisosFalsos === 0, 'Con una sola persona cargando, el panel nunca mostró el aviso de cambios ajenos', avisosFalsos);
    out('Veces que Editar partido dejó Local/Visitante vacíos (bug): ' + bugEditarGrupo);
    out(`\nRESUMEN: ${pases} PASS, ${fallas} FAIL. Alertas: ${alertas.length}. Confirms: ${confirms.length}.`);
    document.getElementById('res').textContent = salida.join('\n');
    document.title = 'LISTO';
})();
