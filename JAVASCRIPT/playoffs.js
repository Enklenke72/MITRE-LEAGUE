// ============================================================
// PLAYOFFS.JS — Lógica pura y compartida del árbol de eliminación
// ============================================================
// Se carga como <script> plano (sin módulos) ANTES de main.js y admin.js,
// igual que data.js. No toca el DOM ni el almacén de datos salvo las
// funciones explícitas de config (que sí lo hacen, por conveniencia, ya que
// la config se usa desde ambos archivos).
//
// Principio de diseño: la cantidad de equipos que clasifican a playoffs
// cambia de torneo a torneo (un ciclo puede arrancar en Octavos con 8
// llaves, en Cuartos con 4, o directamente no correrse). Nada acá asume
// 16/8/4/2 equipos fijos — todo se deriva de la configuración que carga
// el staff en el panel (liga_playoffs_config) o, si no existe, de un
// default conservador que no rompe el comportamiento previo (Octavos/8).

const ORDEN_RONDAS = ['octavos', 'cuartos', 'semis', 'final'];

const CONFIG_PLAYOFFS_DEFAULT_RONDA = 'octavos';
const CONFIG_PLAYOFFS_DEFAULT_SLOTS = 8;

/**
 * Lee la configuración de bracket por ciclo desde el almacén (JAVASCRIPT/almacen.js).
 * Forma: { superior: {rondaInicial:'octavos', slots:8}, basico: {...} }
 */
function obtenerConfigPlayoffs() {
    try {
        return JSON.parse(almacen.getItem('liga_playoffs_config')) || {};
    } catch (e) {
        return {};
    }
}

function guardarConfigPlayoffs(config) {
    almacen.setItem('liga_playoffs_config', JSON.stringify(config));
}

// ── Copas (Clausura 2026): un ciclo puede tener Copa Oro y Copa Plata, cada una con su cuadro.
// Lo que no tiene 'copa' (partidos, cruces y config de antes) es Oro. La config de Oro sigue en
// config[ciclo]; la de Plata va en config['<ciclo>_plata'] y, si no está, el ciclo no tiene Plata.
function copaDe(objeto) {
    return objeto && objeto.copa === 'plata' ? 'plata' : 'oro';
}

function claveCuadro(ciclo, copa) {
    return copa === 'plata' ? `${ciclo}_plata` : ciclo;
}

function tieneCopaPlata(ciclo, configParam) {
    const config = configParam || obtenerConfigPlayoffs();
    return !!(config && config[claveCuadro(ciclo, 'plata')]);
}

function copasDelCiclo(ciclo, configParam) {
    return tieneCopaPlata(ciclo, configParam) ? ['oro', 'plata'] : ['oro'];
}

/** 'Copa Oro' / 'Copa Plata', o '' si el ciclo tiene un solo cuadro (Básico se ve como "Playoffs"). */
function nombreCopa(ciclo, copa, configParam) {
    if (!tieneCopaPlata(ciclo, configParam)) return '';
    return copa === 'plata' ? 'Copa Plata' : 'Copa Oro';
}

/**
 * Devuelve {ronda: cantidadDeSlots} para las rondas vigentes de un ciclo,
 * desde su ronda inicial configurada hasta la Final.
 * Si el ciclo no tiene config guardada, usa el default (Octavos/8) para no
 * romper el comportamiento de torneos ya cargados sin esta configuración.
 * La Copa Plata no tiene default: sin config, no existe (null).
 */
function slotsPorRonda(ciclo, configParam, copa) {
    const config = configParam || obtenerConfigPlayoffs();
    const guardada = config && config[claveCuadro(ciclo, copa)];
    if (!guardada && copa === 'plata') return null;
    const cfgCiclo = guardada || {
        rondaInicial: CONFIG_PLAYOFFS_DEFAULT_RONDA,
        slots: CONFIG_PLAYOFFS_DEFAULT_SLOTS
    };

    const idxInicial = ORDEN_RONDAS.indexOf(cfgCiclo.rondaInicial);
    if (idxInicial === -1 || !cfgCiclo.slots || cfgCiclo.slots < 1) return null;

    const resultado = {};
    let slotsActuales = cfgCiclo.slots;
    for (let i = idxInicial; i < ORDEN_RONDAS.length; i++) {
        resultado[ORDEN_RONDAS[i]] = slotsActuales;
        slotsActuales = Math.ceil(slotsActuales / 2);
    }
    return resultado;
}

/** Lista ordenada de rondas vigentes para un ciclo (ej: ['cuartos','semis','final']). */
function rondasHabilitadas(ciclo, configParam, copa) {
    const slots = slotsPorRonda(ciclo, configParam, copa);
    return slots ? ORDEN_RONDAS.filter(r => slots.hasOwnProperty(r)) : [];
}

/** Cuántos equipos entran al cuadro de esa copa (llaves de la ronda inicial × 2). 0 si la copa no existe. */
function cuposDeCopa(ciclo, copa, configParam) {
    const slots = slotsPorRonda(ciclo, configParam, copa);
    if (!slots) return 0;
    const inicial = ORDEN_RONDAS.find(r => slots.hasOwnProperty(r));
    return slots[inicial] * 2;
}

// ── Tabla de posiciones (la usan la web pública y el panel, así nunca discrepan) ──

/** Desempates definidos por sorteo: {superior: {"<idEquipo>": prioridad}, basico: {...}}; menor prioridad = queda arriba. */
function obtenerDesempatesSorteo() {
    try {
        return JSON.parse(almacen.getItem('liga_desempates_sorteo')) || {};
    } catch (e) {
        return {};
    }
}

function empatanEnTodo(a, b) {
    return a.pts === b.pts && a.dif === b.dif && a.gf === b.gf && (a.g || 0) === (b.g || 0);
}

// PTS → DIF → GF → partidos ganados → sorteo (decisión de Joaquín, 11/10/2026). Con los tres primeros iguales,
// los goles en contra también lo son (DIF = GF − GC), por eso no se usan.
function compararEquipos(a, b, desempates) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if ((b.g || 0) !== (a.g || 0)) return (b.g || 0) - (a.g || 0);
    const pa = desempates ? desempates[String(a.id)] : undefined;
    const pb = desempates ? desempates[String(b.id)] : undefined;
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
    return 0;
}

function ordenarTabla(equipos, desempates) {
    return [...equipos].sort((a, b) => compararEquipos(a, b, desempates));
}

// Equipo de un partido por el nombre con que figura en él: el que lo tiene hoy o, si ese equipo fue reemplazado
// (Art. 9 Bis, campo "reemplazaA"), el que entró en su lugar.
function equipoDeNombre(equiposCiclo, nombre) {
    const buscado = String(nombre || '').trim();
    return equiposCiclo.find(e => e.nombre.trim() === buscado)
        || equiposCiclo.find(e => (e.reemplazaA || []).some(r => String(r.nombre || '').trim() === buscado));
}

/**
 * Recalcula PJ, G, E, P, GF, GC, DIF y PTS de los equipos de un ciclo (los modifica en el lugar) desde los
 * partidos jugados de fase de grupos y las Quitas de Puntos. Los interzonales suman como cualquier partido.
 * Los partidos de un equipo reemplazado suman al que entró en su lugar; las sanciones se buscan solo por nombre,
 * así la quita del reemplazado no se le resta al nuevo.
 */
function calcularEstadisticas(equiposCiclo, partidos, sanciones, ciclo) {
    const esDelCiclo = valor => (valor === 'superior') === (ciclo === 'superior');
    equiposCiclo.forEach(e => {
        e.pj = 0; e.g = 0; e.e = 0; e.p = 0; e.gf = 0; e.gc = 0; e.dif = 0; e.pts = 0;
    });

    (partidos || []).forEach(partido => {
        if (!partido.jugado || partido.esPlayoff || !esDelCiclo(partido.ciclo)) return; // Los partidos de playoff no suman a la fase de grupos
        const local = equipoDeNombre(equiposCiclo, partido.local);
        const visitante = equipoDeNombre(equiposCiclo, partido.visitante);
        if (!local || !visitante) return;

        local.pj++; visitante.pj++;
        local.gf += partido.golesLocal; local.gc += partido.golesVisitante;
        visitante.gf += partido.golesVisitante; visitante.gc += partido.golesLocal;
        local.dif = local.gf - local.gc;
        visitante.dif = visitante.gf - visitante.gc;

        if (partido.golesLocal > partido.golesVisitante) {
            local.pts += 3; local.g++; visitante.p++;
        } else if (partido.golesLocal < partido.golesVisitante) {
            visitante.pts += 3; visitante.g++; local.p++;
        } else {
            local.pts += 1; visitante.pts += 1; local.e++; visitante.e++;
        }
    });

    (sanciones || []).forEach(sancion => {
        if (!esDelCiclo(sancion.ciclo)) return;
        const equipoSancionado = equiposCiclo.find(e => e.nombre.trim() === sancion.equipo.trim());
        // Solo la "Quita de Puntos" resta en la tabla; en las suspensiones, "puntosRestados" guarda la cantidad de fechas.
        if (equipoSancionado && sancion.tipo === 'Quita de Puntos') equipoSancionado.pts -= sancion.puntosRestados;
    });
}

/**
 * Ranking del ciclo: primero todos los 1° de grupo, después todos los 2°, y así; dentro de cada puesto, con el
 * criterio de la tabla. Asigna a cada fila la copa a la que clasifica (los cupos salen de la config del cuadro:
 * llaves de la ronda inicial × 2) y marca 'porComparacion' cuando su puesto quedó repartido (ej. "mejores 3°").
 * Devuelve [{equipo, grupo, puesto, rank, copa (o null), porComparacion}].
 */
function clasificacionDelCiclo(equipos, grupos, ciclo, desempates, configParam) {
    const filas = [];
    (grupos || []).forEach(grupo => {
        ordenarTabla(equipos.filter(e => e.grupo === grupo), desempates)
            .forEach((equipo, i) => filas.push({ equipo, grupo, puesto: i + 1, copa: null, porComparacion: false }));
    });
    filas.sort((a, b) => a.puesto - b.puesto || compararEquipos(a.equipo, b.equipo, desempates));
    filas.forEach((f, i) => { f.rank = i + 1; });

    let desde = 0;
    copasDelCiclo(ciclo, configParam).forEach(copa => {
        const cupos = cuposDeCopa(ciclo, copa, configParam);
        filas.slice(desde, desde + cupos).forEach(f => { f.copa = copa; });
        desde += cupos;
    });

    const destinosPorPuesto = {};
    filas.forEach(f => { (destinosPorPuesto[f.puesto] = destinosPorPuesto[f.puesto] || new Set()).add(f.copa); });
    filas.forEach(f => { f.porComparacion = f.copa !== null && destinosPorPuesto[f.puesto].size > 1; });
    return filas;
}

// "el mejor 6°", "los 2 mejores 3°", "el 3° restante"…
function fraseParcialClasificacion(puesto, cantidad, restante) {
    if (restante) return cantidad === 1 ? `el ${puesto}° restante` : `los ${cantidad} ${puesto}° restantes`;
    return cantidad === 1 ? `el mejor ${puesto}°` : `los ${cantidad} mejores ${puesto}°`;
}

/** Quiénes van a una copa, en palabras: "1° y 2° de cada grupo + los 2 mejores 3°". */
function textoClasificacionCopa(filas, copa, cantidadGrupos) {
    const deCadaGrupo = cantidadGrupos > 1 ? ' de cada grupo' : '';
    const puestos = [...new Set(filas.map(f => f.puesto))].sort((a, b) => a - b);
    const completos = [];
    const partes = [];
    puestos.forEach(p => {
        const delPuesto = filas.filter(f => f.puesto === p);
        const enCopa = delPuesto.filter(f => f.copa === copa);
        if (enCopa.length === 0) return;
        if (enCopa.length === delPuesto.length) { completos.push(p); return; }
        const restante = delPuesto.some(f => f.copa !== copa && f.rank < enCopa[0].rank);
        partes.push({ puesto: p, texto: fraseParcialClasificacion(p, enCopa.length, restante), mejores: !restante });
    });

    if (completos.length) {
        const desdeElPrimero = completos[0] === 1 && completos.every((p, i) => p === i + 1);
        const texto = desdeElPrimero && completos.length >= 3
            ? `los ${completos.length} primeros${deCadaGrupo}`
            : (completos.length === 1 ? `${completos[0]}°` : `${completos.slice(0, -1).map(p => `${p}°`).join(', ')} y ${completos[completos.length - 1]}°`) + deCadaGrupo;
        partes.push({ puesto: completos[0], texto, mejores: false });
    }
    partes.sort((a, b) => a.puesto - b.puesto);
    return partes.reduce((txt, parte, i) => {
        if (i === 0) return parte.texto;
        return txt + (i === partes.length - 1 && parte.mejores ? ' + ' : ', ') + parte.texto;
    }, '');
}

/** Subtítulo de la tabla de grupos de un ciclo. */
function textoClasificacion(filas, ciclo, cantidadGrupos, configParam) {
    const copas = copasDelCiclo(ciclo, configParam)
        .map(copa => ({ copa, texto: textoClasificacionCopa(filas, copa, cantidadGrupos) }))
        .filter(c => c.texto);
    if (copas.length === 0) return 'Clasificación a Playoffs';
    if (copas.length === 1 && !tieneCopaPlata(ciclo, configParam)) return `Clasifican a Playoffs: ${copas[0].texto}`;
    return copas.map(c => `${nombreCopa(ciclo, c.copa, configParam)}: ${c.texto}`).join(' · ');
}

/** Cartelito de una fila que entra por comparación: "Copa Oro: entra como uno de los 2 mejores 3°". */
function textoEntradaPorComparacion(filas, fila, ciclo, configParam) {
    const delPuesto = filas.filter(f => f.puesto === fila.puesto);
    const enCopa = delPuesto.filter(f => f.copa === fila.copa);
    const restante = delPuesto.some(f => f.copa !== fila.copa && f.rank < enCopa[0].rank);
    const frase = fraseParcialClasificacion(fila.puesto, enCopa.length, restante);
    return `${nombreCopa(ciclo, fila.copa, configParam) || 'Playoffs'}: entra como ${enCopa.length === 1 ? frase : 'uno de ' + frase}`;
}

/** Ronda siguiente en el orden del bracket, o null si ya es la Final. */
function rondaSiguiente(ronda) {
    const idx = ORDEN_RONDAS.indexOf(ronda);
    if (idx === -1 || idx === ORDEN_RONDAS.length - 1) return null;
    return ORDEN_RONDAS[idx + 1];
}

/**
 * El formulario de carga de partidos usa un código numérico de "fecha" para
 * marcar la fase de playoff (108=Octavos, 104=Cuartos, 102=Semis, 100=Final).
 * Única fuente de verdad para ese mapeo — antes vivía duplicado (e inconsistente
 * en su valor por defecto) en dos puntos distintos de admin.js.
 */
function rondaPorCodigoFecha(fechaVal) {
    if (fechaVal === 108) return 'octavos';
    if (fechaVal === 104) return 'cuartos';
    if (fechaVal === 102) return 'semis';
    if (fechaVal === 100) return 'final';
    return null;
}

/**
 * Determina el ganador de un partido de playoff (goles, con desempate por penales).
 * Devuelve {ganador: 'local'|'visitante'|null}. null si está empatado y sin
 * penales cargados, o si el partido todavía no tiene resultado.
 */
function determinarGanador(partido) {
    if (!partido || partido.golesLocal === null || partido.golesLocal === undefined ||
        partido.golesVisitante === null || partido.golesVisitante === undefined) {
        return { ganador: null };
    }
    if (partido.golesLocal > partido.golesVisitante) return { ganador: 'local' };
    if (partido.golesVisitante > partido.golesLocal) return { ganador: 'visitante' };

    const penL = partido.penalesLocal;
    const penV = partido.penalesVisitante;
    if (penL !== null && penL !== undefined && penV !== null && penV !== undefined) {
        if (penL > penV) return { ganador: 'local' };
        if (penV > penL) return { ganador: 'visitante' };
    }
    return { ganador: null };
}

/** Slot que ocupará este ganador en la ronda siguiente (llaves 1,2 -> slot 1; 3,4 -> slot 2; ...). */
function slotDestino(slotOrigen) {
    return Math.ceil(slotOrigen / 2);
}

/** De qué lado del cruce siguiente entra el ganador: slots impares -> local, pares -> visitante. */
function ladoDestino(slotOrigen) {
    return (slotOrigen % 2 === 1) ? 'local' : 'visitante';
}

/**
 * Migra un array de cruces (algunos sin campo 'slot', cargados antes de esta
 * funcionalidad) asignándoles un slot según su posición dentro de su grupo
 * ciclo+ronda, preservando el orden en que ya fueron cargados.
 * Devuelve { cruces, advertencias } — advertencias lista mensajes si algún
 * grupo tiene más cruces cargados que llaves definidas en la config.
 */
function migrarCrucesConSlot(cruces, configParam) {
    const config = configParam || obtenerConfigPlayoffs();
    const advertencias = [];
    const contadorPorGrupo = {};

    const resultado = (cruces || []).map(cruce => {
        const clave = `${cruce.ciclo}__${cruce.ronda}__${copaDe(cruce)}`;
        contadorPorGrupo[clave] = (contadorPorGrupo[clave] || 0) + 1;
        if (cruce.slot) return cruce;
        return { ...cruce, slot: contadorPorGrupo[clave] };
    });

    Object.keys(contadorPorGrupo).forEach(clave => {
        const [ciclo, ronda, copa] = clave.split('__');
        const slots = slotsPorRonda(ciclo, config, copa);
        if (slots && slots[ronda] && contadorPorGrupo[clave] > slots[ronda]) {
            const cuadro = nombreCopa(ciclo, copa, config);
            advertencias.push(
                `Hay ${contadorPorGrupo[clave]} cruces cargados en ${ronda.toUpperCase()} (${ciclo}${cuadro ? ', ' + cuadro : ''}) pero la configuración sólo define ${slots[ronda]} llaves. Revisar manualmente en el Armador de Cruces.`
            );
        }
    });

    return { cruces: resultado, advertencias };
}

// ── Asistente de sorteo (Clausura 2026): los cruces de la ronda inicial de cada copa se sortean en vivo con dos
// bombos. Bombo 1 = la mitad mejor del ranking de esa copa, Bombo 2 = la otra mitad; cada equipo del Bombo 1 recibe un
// rival del Bombo 2. Dos equipos del mismo grupo no se cruzan en esa ronda, y se sugiere la llave para que, en lo
// posible, tampoco queden en la misma mitad del cuadro (se cruzarían antes de la final). Decisiones de Joaquín, 11/10/2026.

/** Filas de la clasificación que van a esa copa, partidas en dos bombos. null si la copa no tiene cuadro. */
function bombosDeCopa(clasificacion, ciclo, copa, configParam) {
    const slots = slotsPorRonda(ciclo, configParam, copa);
    if (!slots) return null;
    const rondaInicial = ORDEN_RONDAS.find(r => slots.hasOwnProperty(r));
    const llaves = slots[rondaInicial];
    const filas = clasificacion.filter(f => f.copa === copa);
    return { rondaInicial, llaves, filas, bombo1: filas.slice(0, llaves), bombo2: filas.slice(llaves, llaves * 2) };
}

function mismoGrupo(a, b) {
    return a.grupo === b.grupo;
}

// ¿Se pueden emparejar todos los que quedan (uno de cada bombo) sin que se crucen dos del mismo grupo?
function sorteoCompletable(restantes1, restantes2) {
    if (restantes1.length === 0) return true;
    const [primero, ...resto] = restantes1;
    return restantes2.some(rival => !mismoGrupo(primero, rival) && sorteoCompletable(resto, restantes2.filter(f => f !== rival)));
}

/** Para el equipo que salió del Bombo 1: cada rival que queda, 'prohibido' (mismo grupo), 'sinSalida' o 'posible'. */
function estadoRivales(elegido, restantes1, restantes2) {
    const otros1 = restantes1.filter(f => f !== elegido);
    return restantes2.map(rival => ({
        rival,
        estado: mismoGrupo(elegido, rival) ? 'prohibido'
            : (sorteoCompletable(otros1, restantes2.filter(f => f !== rival)) ? 'posible' : 'sinSalida')
    }));
}

// Con 4 llaves, la 1 y la 2 van a una semifinal y la 3 y la 4 a la otra.
function mitadDeLlave(llave, llaves) {
    return Math.ceil(llave / Math.max(1, llaves / 2));
}

/** Pares del mismo grupo en llaves distintas de la misma mitad del cuadro: si ganan los dos, se cruzan antes de la final. */
function paresMismaMitad(cruces, llaves) {
    const ubicados = cruces.flatMap(c => [c.local, c.visitante].map(f => ({ f, llave: c.llave })));
    const pares = [];
    ubicados.forEach((a, i) => ubicados.slice(i + 1).forEach(b => {
        if (a.llave !== b.llave && mismoGrupo(a.f, b.f) && mitadDeLlave(a.llave, llaves) === mitadDeLlave(b.llave, llaves)) pares.push([a.f, b.f]);
    }));
    return pares;
}

// Lo mejor a lo que se puede llegar completando el sorteo (menos pares en la misma mitad). Infinity si no hay forma.
function mejorCompletado(cruces, restantes1, restantes2, libres, llaves) {
    if (restantes1.length === 0) return paresMismaMitad(cruces, llaves).length;
    const [primero, ...resto] = restantes1;
    let mejor = Infinity;
    restantes2.forEach(rival => {
        if (mismoGrupo(primero, rival)) return;
        libres.forEach(llave => {
            const costo = mejorCompletado([...cruces, { local: primero, visitante: rival, llave }], resto,
                restantes2.filter(f => f !== rival), libres.filter(l => l !== llave), llaves);
            if (costo < mejor) mejor = costo;
        });
    });
    return mejor;
}

/**
 * Para el cruce que acaba de salir (restantes1/2 ya sin sus dos equipos), cuántos pares del mismo grupo quedarían en la
 * misma mitad en el mejor de los casos según la llave libre que se elija. [{llave, costo, sugerida}]; la sugerida es la
 * de menor costo y, entre iguales, la de número más bajo. null con más de 4 llaves (la búsqueda crece demasiado).
 */
function evaluarLlaves(cruces, nuevo, restantes1, restantes2, llaves) {
    if (llaves > 4) return null;
    const usadas = new Set(cruces.map(c => c.llave));
    const libres = Array.from({ length: llaves }, (_, i) => i + 1).filter(l => !usadas.has(l));
    const evaluadas = libres.map(llave => ({
        llave,
        costo: mejorCompletado([...cruces, { ...nuevo, llave }], restantes1, restantes2, libres.filter(l => l !== llave), llaves),
        sugerida: false
    }));
    const minimo = Math.min(...evaluadas.map(e => e.costo));
    const sugerida = evaluadas.find(e => e.costo === minimo);
    if (sugerida) sugerida.sugerida = true;
    return evaluadas;
}

/**
 * Empates totales (PTS, DIF, GF y partidos ganados iguales, sin desempate guardado entre los dos) que cambian la copa
 * o el bombo de alguno: esos se definen por sorteo antes de sortear los cruces. Devuelve [[equipoA, equipoB], ...].
 */
function empatesQueImportan(equipos, grupos, ciclo, desempates, configParam) {
    const base = desempates || {};
    const destino = d => {
        const filas = clasificacionDelCiclo(equipos, grupos, ciclo, d, configParam);
        const bombo = {};
        copasDelCiclo(ciclo, configParam).forEach(copa => {
            const b = bombosDeCopa(filas, ciclo, copa, configParam);
            if (b) b.filas.forEach((f, i) => { bombo[f.equipo.id] = i < b.llaves ? 1 : 2; });
        });
        return Object.fromEntries(filas.map(f => [f.equipo.id, `${f.copa}|${bombo[f.equipo.id] || ''}`]));
    };
    const enGrupos = equipos.filter(e => (grupos || []).includes(e.grupo));
    const pares = [];
    enGrupos.forEach((a, i) => enGrupos.slice(i + 1).forEach(b => {
        if (!empatanEnTodo(a, b)) return;
        const pa = base[String(a.id)], pb = base[String(b.id)];
        if (pa !== undefined && pb !== undefined && pa !== pb) return;
        const tope = Math.max(0, ...Object.values(base)) + 1;
        const aArriba = destino({ ...base, [a.id]: tope, [b.id]: tope + 1 });
        const bArriba = destino({ ...base, [a.id]: tope + 1, [b.id]: tope });
        if (aArriba[a.id] !== bArriba[a.id] || aArriba[b.id] !== bArriba[b.id]) pares.push([a, b]);
    }));
    return pares;
}

/** Guarda que 'ganador' quedó arriba de 'perdedor' sin romper los desempates anteriores (se renumeran 1..n). */
function desempatarPorSorteo(desempatesCiclo, ganador, perdedor) {
    const d = { ...(desempatesCiclo || {}) };
    const g = String(ganador.id), p = String(perdedor.id);
    if (d[g] === undefined && d[p] === undefined) {
        const tope = Math.max(0, ...Object.values(d));
        d[g] = tope + 1;
        d[p] = tope + 2;
    } else if (d[g] === undefined) {
        d[g] = d[p] - 0.5;
    } else {
        d[p] = d[g] + 0.5;
    }
    Object.keys(d).sort((a, b) => d[a] - d[b]).forEach((id, i) => { d[id] = i + 1; });
    return d;
}
