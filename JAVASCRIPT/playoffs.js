// ============================================================
// PLAYOFFS.JS — Lógica pura y compartida del árbol de eliminación
// ============================================================
// Se carga como <script> plano (sin módulos) ANTES de main.js y admin.js,
// igual que data.js. No toca el DOM ni localStorage directamente salvo las
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
 * Lee la configuración de bracket por ciclo desde localStorage.
 * Forma: { superior: {rondaInicial:'octavos', slots:8}, basico: {...} }
 */
function obtenerConfigPlayoffs() {
    try {
        return JSON.parse(localStorage.getItem('liga_playoffs_config')) || {};
    } catch (e) {
        return {};
    }
}

function guardarConfigPlayoffs(config) {
    localStorage.setItem('liga_playoffs_config', JSON.stringify(config));
}

/**
 * Devuelve {ronda: cantidadDeSlots} para las rondas vigentes de un ciclo,
 * desde su ronda inicial configurada hasta la Final.
 * Si el ciclo no tiene config guardada, usa el default (Octavos/8) para no
 * romper el comportamiento de torneos ya cargados sin esta configuración.
 */
function slotsPorRonda(ciclo, configParam) {
    const config = configParam || obtenerConfigPlayoffs();
    const cfgCiclo = (config && config[ciclo]) || {
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
function rondasHabilitadas(ciclo, configParam) {
    const slots = slotsPorRonda(ciclo, configParam);
    return slots ? ORDEN_RONDAS.filter(r => slots.hasOwnProperty(r)) : [];
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
        const clave = `${cruce.ciclo}__${cruce.ronda}`;
        contadorPorGrupo[clave] = (contadorPorGrupo[clave] || 0) + 1;
        if (cruce.slot) return cruce;
        return { ...cruce, slot: contadorPorGrupo[clave] };
    });

    Object.keys(contadorPorGrupo).forEach(clave => {
        const [ciclo, ronda] = clave.split('__');
        const slots = slotsPorRonda(ciclo, config);
        if (slots && slots[ronda] && contadorPorGrupo[clave] > slots[ronda]) {
            advertencias.push(
                `Hay ${contadorPorGrupo[clave]} cruces cargados en ${ronda.toUpperCase()} (${ciclo}) pero la configuración sólo define ${slots[ronda]} llaves. Revisar manualmente en el Armador de Cruces.`
            );
        }
    });

    return { cruces: resultado, advertencias };
}
