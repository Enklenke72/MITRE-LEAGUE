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
const LS = k => JSON.parse(localStorage.getItem(k));
const ultimaAlerta = () => alertas[alertas.length - 1] || '';

function cargar(url) {
    return new Promise(res => {
        marco.onload = () => {
            const w = marco.contentWindow;
            w.alert = m => alertas.push(String(m));
            w.confirm = m => { confirms.push(String(m)); return respuestaConfirm; };
            w.print = () => { prints++; };
            w.scrollTo = () => {};
            w.onerror = (m, s, l) => out('JS ERROR ' + m + ' @' + s + ':' + l);
            setTimeout(res, 30);
        };
        marco.src = url;
    });
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
    localStorage.clear();
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
    localStorage.clear();
    await cargar('index.html?semilla=1');
    const filas = D().querySelectorAll('.tbody-sup tr').length;
    out('  info: web pública con localStorage vacío y semilla real muestra ' + filas + ' filas en la tabla del Grupo A (equipos del torneo anterior).');
    localStorage.clear();
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
        const s = LS('liga_cicloSuperior'); const e = s.find(x => x.nombre === '5to 2da'); e.jugadores = e.jugadores.filter(j => j.nombre !== 'Sin DNI'); localStorage.setItem('liga_cicloSuperior', JSON.stringify(s));
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
    check(JSON.stringify(pA.goleadoresLocal) === JSON.stringify([{ nombre: `${jug('4to 1ra', 0).nombre} (#0)`, cantidad: 2 }, { nombre: `${jug('4to 1ra', 5).nombre} (#5)`, cantidad: 1 }]), 'Goleadores con dorsal 0 repetido se agrupan: "(#0)" x2 y "(#5)" x1', pA.goleadoresLocal);
    check(pA.amarillasLocal.length === 2 && pA.amarillasLocal.every(d => d === jug('4to 1ra', 5).dni), 'Dos amarillas al mismo dorsal = dos entradas con su DNI', pA.amarillasLocal);
    check(pA.rojasVisitante[0] === jug('5to 2da', 9).dni, 'Roja guardada con el DNI del jugador', pA.rojasVisitante);
    // Editar sin tocar los campos: tienen que venir rellenos
    editarPartido(pA);
    check(el('dorsales-goles-local').value === '0, 0, 5' && el('dorsales-amarillas-local').value === '5, 5' && el('dorsales-rojas-visitante').value === '9', 'Al editar, goleadores y tarjetas se rellenan', { gol: el('dorsales-goles-local').value, am: el('dorsales-amarillas-local').value, roja: el('dorsales-rojas-visitante').value });
    await enviar('form-partido');
    const golesJ0 = LS('liga_cicloSuperior').find(e => e.nombre === '4to 1ra').jugadores.find(j => j.dorsal === 0).goles;
    check(golesJ0 === 2, 'Guardar la edición sin cambios no duplica ni borra goles del #0', golesJ0);

    // Editar resultado 2-1 -> 3-1
    const pB = P(1, '4to 2da', '5to 3ra');
    editarPartido(pB);
    setv('goles-local', '3', false); setv('dorsales-goles-local', '7, 7, 9', false);
    await enviar('form-partido');
    const r2 = RESULTADOS.find(r => r.fecha === 1 && r.L === '4to 2da');
    suma(esperado.goles, jug('4to 2da', 7).dni, 1); r2.gl = 3; r2.dl = [7, 7, 9];
    const eq42 = LS('liga_cicloSuperior').find(e => e.nombre === '4to 2da');
    check(eq42.jugadores.find(j => j.dorsal === 7).goles === esperado.goles[jug('4to 2da', 7).dni] && P(1, '4to 2da', '5to 3ra').golesLocal === 3, 'Editar 2-1 → 3-1 con un goleador más: contador correcto', { g7: eq42.jugadores.find(j => j.dorsal === 7).goles, esperado: esperado.goles[jug('4to 2da', 7).dni] });

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
    check(/#88/.test(det) && /4to 3ra/.test(det) && /Fecha 2/.test(det) && /6to 2da/.test(det),
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
    // El #9 fue tildado en F2 y F3 (staff se equivocó) → fila roja
    check(f3 && f3.classList.contains('bf-fila-alerta'), 'Suspendido y tildado → fila en rojo');
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

    // Rol staff oculta totales
    setv('selector-rol-usuario', 'staff');
    const oculto = getComputedStyle(D().querySelector('.solo-admin') || D().body).display === 'none';
    check(oculto, 'Rol Staff oculta elementos .solo-admin (cosmético)');
    setv('selector-rol-usuario', 'admin');

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
    check(localStorage.getItem('liga_playoffs_publicados') === 'true', 'Playoffs publicados');
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
            check(abierto && txt.includes(jug('4to 1ra', 0).nombre + ' (#0)') && /\(2\)/.test(txt), 'Desplegable del modal (F1) abre y muestra goleadores "(#0) (2)"', txt.replace(/\s+/g, ' ').trim());
            const drw = c1.querySelector('.match-details-drawer');
            const am = [...drw.querySelectorAll('.tarjeta-amarilla')].map(x => x.parentElement.textContent.replace(/\s+/g, ' ').trim());
            const ro = [...drw.querySelectorAll('.tarjeta-roja')].map(x => x.parentElement.textContent.replace(/\s+/g, ' ').trim());
            check(am.some(t => t.includes(jug('4to 1ra', 5).nombre + ' (#5)') && /\(2\)/.test(t)) && am.some(t => t.includes(jug('5to 2da', 7).nombre)) && ro.some(t => t.includes(jug('5to 2da', 9).nombre + ' (#9)')), 'Desplegable del modal muestra las tarjetas del partido (2 amarillas #5, amarilla #7 rival, roja #9 rival)', { am, ro });
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
            const cuenta = el => !el ? -1 : [...el.querySelectorAll('div')].filter(d => !d.querySelector('.tarjeta-ico')).reduce((a, d) => { const m = d.textContent.match(/\((\d+)\)\s*$/); const esGol = /\(#\d+\)/.test(d.textContent); return a + (esGol ? (m && !/\(#\d+\)\s*$/.test(d.textContent) ? +m[1] : 1) : 0); }, 0);
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
    check(D().querySelectorAll('#galeria-fotos-grid .foto-card').length === 0 && /Todavía no hay álbumes/.test((D().getElementById('galeria-fotos-grid')||{textContent:''}).textContent) && !localStorage.getItem('liga_fotos_albumes'), 'Álbumes: sin semilla del torneo anterior, cartel de vacío y la web pública no escribe la clave', { guardado: localStorage.getItem('liga_fotos_albumes'), texto: (D().getElementById('galeria-fotos-grid')||{textContent:''}).textContent.trim().slice(0,40) });
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
            setTimeout(res, 1500);
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
    if (sp.conLogo) await subirLogo(el('sponsor-logo-file'));
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
    const pesoGuardado = a ? Math.round(String(a.logo).length * 0.75) : 0;
    const medidas = a ? await medirImagen(a.logo) : { ancho: -1, alto: -1 };
    check(a && String(a.logo).indexOf('data:image/jpeg') === 0 && pesoGuardado < pesoLogoOriginal / 4 && pesoGuardado < 300 * 1024,
        'Logo grande subido se guarda comprimido (JPEG, mucho más liviano que el original)',
        { originalKB: Math.round(pesoLogoOriginal / 1024), guardadoKB: Math.round(pesoGuardado / 1024), formato: String(a.logo).slice(0, 15) });
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
    check(a2 && a2.descripcion.indexOf('hielo') >= 0 && /kiosco\+nuevo$/.test(a2.ubicacion) && String(a2.logo).indexOf('data:image/') === 0 && a2.orden === 0 && (LS('liga_sponsors') || []).length === 3, 'Editar guarda los cambios, conserva el logo y el orden, y no duplica', a2 && { desc: a2.descripcion, ubi: a2.ubicacion, orden: a2.orden });

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
    const medidasPub = await medirImagen(logoPub.src);
    check(String(logoPub.src).indexOf('data:image/jpeg') === 0 && medidasPub.ancho > 0, 'El logo comprimido se ve bien en la tarjeta del carrusel', medidasPub);
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

// ---------------- Casos borde al final ----------------
async function bordes() {
    out('\n=== CASOS BORDE (al final, para no alterar lo anterior) ===');
    await cargar('admin.html');
    // 0) Inscripciones
    await tab('sec-tesoreria');
    el('btn-sub-teso-inscripciones').click();
    setv('monto-inscripcion-individual', '3500');
    const filaInsc = [...D().querySelectorAll('#tbody-tesoreria-inscripciones tr')].find(tr => tr.cells[0].textContent === '4to 1ra');
    check(filaInsc && /\$21[.,]000/.test(filaInsc.cells[2].textContent), 'Inscripciones: 6 jugadores x $3.500 = $21.000', filaInsc && filaInsc.cells[2].textContent);
    const inpInsc = filaInsc.querySelector('.in-insc-ef'); inpInsc.value = '21000'; inpInsc.dispatchEvent(new Event('change'));
    const filaInsc2 = [...D().querySelectorAll('#tbody-tesoreria-inscripciones tr')].find(tr => tr.cells[0].textContent === '4to 1ra');
    check(/AL DÍA/.test(filaInsc2.cells[5].textContent) && (LS('liga_caja_movimientos') || []).some(m => m.concepto === 'Inscripción' && m.monto === 21000), 'Inscripción pagada: AL DÍA y movimiento en la Caja');

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
    const golesJ = LS('liga_cicloSuperior').find(e => e.nombre === '4to 2da').jugadores.find(j => j.dni === j7.dni).goles;
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
        localStorage.setItem('__snapshot', JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(x => x.startsWith('liga_')).map(x => [x, localStorage.getItem(x)]))));
        await bordes();
    } catch (e) {
        out('EXCEPCION DEL BANCO: ' + e.message + '\n' + e.stack);
    }
    out('Veces que Editar partido dejó Local/Visitante vacíos (bug): ' + bugEditarGrupo);
    out(`\nRESUMEN: ${pases} PASS, ${fallas} FAIL. Alertas: ${alertas.length}. Confirms: ${confirms.length}.`);
    document.getElementById('res').textContent = salida.join('\n');
    document.title = 'LISTO';
})();
