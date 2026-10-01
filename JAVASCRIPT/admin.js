document.addEventListener('liga:datos-listos', (evento) => {

    // ============================================================
    // 1. ESTADO GLOBAL Y MEMORIA (LOCALSTORAGE)
    // ============================================================
    let partidos = JSON.parse(almacen.getItem('liga_partidos')) || [];
    if (partidos.length === 0 && typeof ligaData !== 'undefined') {
        partidos = ligaData.partidos || [];
        almacen.setItem('liga_partidos', JSON.stringify(partidos));
    }

    let gruposTorneo = JSON.parse(almacen.getItem('liga_grupos')) || {
        superior: ['A', 'B', 'C', 'D', 'E'],
        basico: ['A', 'B']
    };

    let poolSuperior = JSON.parse(almacen.getItem('liga_cicloSuperior')) || (typeof ligaData !== 'undefined' ? ligaData.cicloSuperior : []);
    let poolBasico = JSON.parse(almacen.getItem('liga_cicloBasico')) || (typeof ligaData !== 'undefined' ? ligaData.cicloBasico : []);

    let crucesPlayoffs = JSON.parse(almacen.getItem('liga_cruces_playoffs')) || [];
    if (typeof migrarCrucesConSlot === 'function') {
        const migracion = migrarCrucesConSlot(crucesPlayoffs);
        crucesPlayoffs = migracion.cruces;
        almacen.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
        if (migracion.advertencias.length > 0) {
            console.warn('[Playoffs] Advertencias de migración de slots:\n' + migracion.advertencias.join('\n'));
        }
    }
    let playoffsPublicados = almacen.getItem('liga_playoffs_publicados') === 'true';

    let listaSanciones = JSON.parse(almacen.getItem('liga_sanciones')) || [];
    let listaNoticias = JSON.parse(almacen.getItem('liga_noticias')) || [];
    let listaAlertas = JSON.parse(almacen.getItem('liga_notificaciones')) || [];
    // Avisos internos del staff (no es liga_notificaciones, que es la campanita pública): avisos que genera
    // el propio sistema para que el staff revise algo después, sin bloquear la carga de datos.
    let avisosStaff = JSON.parse(almacen.getItem('liga_avisos_staff')) || [];

    function registrarAvisoStaff(tipo, detalle) {
        avisosStaff.unshift({
            id: Date.now() + '-' + Math.floor(Math.random() * 100000),
            tipo,
            detalle,
            timestamp: Date.now()
        });
        almacen.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
        if (typeof actualizarListaAvisosStaff === 'function') actualizarListaAvisosStaff();
    }

    // Historial de cambios para el Coordinador: quién cargó qué, en frases legibles. Se anota a mano en los guardados
    // que importan (resultados, pagos, beneficios, Tribunal, altas y bajas de jugadores), no en cada setItem.
    // El Staff solo agrega entradas: no recibe el historial ni lo puede vaciar (lo hacen cumplir las reglas).
    const usuarioPanel = (evento.detail && evento.detail.usuario) || {};
    let historialCambios = JSON.parse(almacen.getItem('liga_historial_cambios')) || [];

    function registrarHistorial(tipo, detalle) {
        historialCambios.push({
            id: Date.now() + '-' + Math.floor(Math.random() * 100000),
            tipo,
            detalle,
            autor: usuarioPanel.nombre || usuarioPanel.email || 'Sin identificar',
            email: usuarioPanel.email || '',
            rol: usuarioPanel.rol || '',
            timestamp: Date.now()
        });
        almacen.setItem('liga_historial_cambios', JSON.stringify(historialCambios));
        if (typeof actualizarListaHistorial === 'function') actualizarListaHistorial();
    }

    function nombreCicloHistorial(ciclo) {
        return ciclo === 'basico' ? 'Básico' : 'Superior';
    }

    function marcadorHistorial(p) {
        const penales = p.esPlayoff && p.golesLocal === p.golesVisitante && p.penalesLocal != null
            ? ` (penales ${p.penalesLocal}-${p.penalesVisitante})` : '';
        return `${p.local} ${p.golesLocal}-${p.golesVisitante} ${p.visitante}${penales}`;
    }

    function textoHistorialPartido(previo, nuevo) {
        const donde = `${nombreFaseTeso(nuevo.fecha)} (${nombreCicloHistorial(nuevo.ciclo)})`;
        const cruce = `${nuevo.local} vs ${nuevo.visitante}`;
        if (!nuevo.jugado) {
            if (previo && previo.jugado) return `borró el resultado de ${donde}: ${cruce} (era ${marcadorHistorial(previo)})`;
            return `${previo ? 'editó' : 'cargó'} el partido de ${donde}: ${cruce}`;
        }
        if (!previo || !previo.jugado) return `cargó el resultado de ${donde}: ${marcadorHistorial(nuevo)}`;
        const antes = marcadorHistorial(previo);
        const ahora = marcadorHistorial(nuevo);
        return antes === ahora ? `editó el partido de ${donde}: ${ahora}` : `cambió el resultado de ${donde}: ${ahora} (era ${antes})`;
    }

    function textoHistorialSancion(s) {
        const n = s.puntosRestados;
        const que = s.tipo === 'Quita de Puntos' ? `quita de ${n} ${n === 1 ? 'punto' : 'puntos'}`
            : s.tipo === 'Sanción Disciplinaria' ? `suspensión de ${n} ${n === 1 ? 'fecha' : 'fechas'}`
            : s.tipo === 'Advertencia / Acta' ? 'advertencia' : (s.tipo || 'sanción');
        return `Acta N° ${s.acta} (${nombreCicloHistorial(s.ciclo)}): ${que} a ${s.equipo}${s.jugador ? ' — ' + s.jugador : ''}`;
    }

    function textoJugadorHistorial(j) {
        return `${j.nombre} (${j.dorsal === undefined || j.dorsal === null || j.dorsal === '' ? 'S/N' : '#' + j.dorsal})`;
    }

    function textoGrupoHistorial(grupo) {
        return grupo === 'Unico' ? 'Tabla Única' : `Grupo ${grupo}`;
    }

    // De lo visible (nombre, número, Instagram, ficha) se anota antes → después; del DNI, la foto y los datos
    // de contacto y médicos, solo qué cambió (decisión de Joaquín: el historial no duplica datos de menores).
    const CAMBIOS_VISIBLES_JUGADOR = [
        ['nombre', 'nombre', v => `«${v}»`],
        ['dorsal', 'número', v => (v === '' ? 'S/N' : `#${v}`)],
        ['instagram', 'Instagram', v => (v === '' ? 'sin Instagram' : `@${v}`)],
        ['fichaMedica', 'ficha médica', v => (v === 'si' ? 'entregada' : 'pendiente')]
    ];
    const CAMBIOS_SENSIBLES_JUGADOR = [
        [['dni'], 'el DNI'],
        [['foto'], 'la foto'],
        [['nacimiento'], 'la fecha de nacimiento'],
        [['celular'], 'el celular'],
        [['concurrir', 'concurrirDir'], 'el sanatorio'],
        [['medico', 'medicoDir'], 'el médico de cabecera'],
        [['familiarNombre', 'familiarParentesco', 'familiarTel'], 'el contacto de emergencia']
    ];

    function textoEdicionJugadorHistorial(antes, despues, equipoNombre) {
        const valor = (j, campo) => (j[campo] === undefined || j[campo] === null ? '' : String(j[campo]).trim());
        const visibles = CAMBIOS_VISIBLES_JUGADOR
            .filter(([campo]) => valor(antes, campo) !== valor(despues, campo))
            .map(([campo, etiqueta, formato]) => `${etiqueta} ${formato(valor(antes, campo))} → ${formato(valor(despues, campo))}`);
        const sensibles = CAMBIOS_SENSIBLES_JUGADOR
            .filter(([campos]) => campos.some(campo => valor(antes, campo) !== valor(despues, campo)))
            .map(([, etiqueta]) => etiqueta);
        if (!visibles.length && !sensibles.length) return null;
        const partes = [];
        if (visibles.length) partes.push(visibles.join(', '));
        if (sensibles.length) partes.push('actualizó ' + (sensibles.length === 1 ? sensibles[0]
            : sensibles.slice(0, -1).join(', ') + ' y ' + sensibles[sensibles.length - 1]));
        return `editó la ficha de ${textoJugadorHistorial(despues)} en ${equipoNombre}: ${partes.join('; ')}`;
    }

    let tesoreriaPartidos = JSON.parse(almacen.getItem('liga_tesoreria_partidos_v2')) || {};
    let tesoreriaInscripciones = JSON.parse(almacen.getItem('liga_tesoreria_inscripciones')) || {};
    let listaEgresos = JSON.parse(almacen.getItem('liga_egresos')) || [];
    let cajaMovimientos = JSON.parse(almacen.getItem('liga_caja_movimientos')) || [];

    // Registra cada pago individual (quién, cuánto, cómo y cuándo) para la Caja por Fecha (exclusivo Coordinador).
    // Se llama cada vez que se carga o modifica un monto en Tesorería; "monto" es la diferencia contra el valor anterior.
    function registrarMovimientoCaja({ equipo, concepto, detalle, medio, monto }) {
        if (!monto) return; // Sin cambio real, no genera movimiento
        cajaMovimientos.push({
            id: Date.now() + Math.random(),
            equipo: equipo || 'Equipo sin identificar',
            concepto: concepto || 'Pago',
            detalle: detalle || '',
            medio: medio || 'Efectivo',
            monto: monto,
            fechaHora: new Date().toISOString()
        });
        almacen.setItem('liga_caja_movimientos', JSON.stringify(cajaMovimientos));
        if (typeof renderizarCajaPorFecha === 'function') renderizarCajaPorFecha();
        const mov = cajaMovimientos[cajaMovimientos.length - 1];
        const queEs = `${mov.concepto}${mov.detalle ? ' · ' + mov.detalle : ''}, ${mov.medio.toLowerCase()}`;
        registrarHistorial('pago', mov.monto > 0
            ? `registró un pago de $${mov.monto.toLocaleString()} de ${mov.equipo} (${queEs})`
            : `descontó $${(-mov.monto).toLocaleString()} de lo pagado por ${mov.equipo} (${queEs})`);
    }

    function guardarEquiposEnStorage() {
        almacen.setItem('liga_cicloSuperior', JSON.stringify(poolSuperior));
        almacen.setItem('liga_cicloBasico', JSON.stringify(poolBasico));
    }

    function guardarGruposEnStorage() {
        almacen.setItem('liga_grupos', JSON.stringify(gruposTorneo));
    }

    function recargarPools() {
        const sup = JSON.parse(almacen.getItem('liga_cicloSuperior'));
        poolSuperior = (sup && sup.length > 0) ? sup : (typeof ligaData !== 'undefined' ? ligaData.cicloSuperior : []);
        const bas = JSON.parse(almacen.getItem('liga_cicloBasico'));
        poolBasico = (bas && bas.length > 0) ? bas : (typeof ligaData !== 'undefined' ? ligaData.cicloBasico : []);
    }

    // El rol (clases rol-admin / rol-staff del <body>) lo pone auth-admin.js
    // según usuarios/{uid} en Firestore.

    // ============================================================
    // 2 BIS. IMÁGENES
    // ============================================================
    // Las fotos se suben a Cloudinary (JAVASCRIPT/cloudinary-config.js) y en Firestore queda solo
    // la URL. Antes se redimensionan y recomprimen en el navegador: una sacada con el celular pesa
    // varios MB y el plan gratis de Cloudinary cuenta el espacio y el tráfico.
    const MAX_LADO_FOTO_JUGADOR = 250;
    const MAX_LADO_FOTO_NOTICIA = 1000;
    const MAX_LADO_LOGO_SPONSOR = 500;
    const MAX_LADO_PORTADA_ALBUM = 800;
    const CALIDAD_JPEG = 0.75;

    function comprimirImagen(file, maxLado, calidad) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                reject(new Error('El archivo no es una imagen.'));
                return;
            }

            const lector = new FileReader();
            lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
            lector.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
                img.onload = () => {
                    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
                    const ancho = Math.max(1, Math.round(img.width * escala));
                    const alto = Math.max(1, Math.round(img.height * escala));

                    const canvas = document.createElement('canvas');
                    canvas.width = ancho;
                    canvas.height = alto;

                    const ctx = canvas.getContext('2d');
                    // El JPEG no soporta transparencia: pintamos el fondo del sitio para que un
                    // PNG transparente no termine sobre negro puro.
                    ctx.fillStyle = '#040c26';
                    ctx.fillRect(0, 0, ancho, alto);
                    ctx.drawImage(img, 0, 0, ancho, alto);

                    resolve(canvas.toDataURL('image/jpeg', calidad));
                };
                img.src = lector.result;
            };
            lector.readAsDataURL(file);
        });
    }

    // Una ruta o URL escrita a mano, o una foto ya subida, se devuelve igual. Un dataURL recién
    // comprimido se sube a Cloudinary y se devuelve su URL. Si falla, avisa y devuelve null.
    async function subirImagen(imagen, boton) {
        if (!imagen || imagen.indexOf('data:') !== 0) return imagen;
        const textoBoton = boton ? boton.textContent : '';
        if (boton) { boton.disabled = true; boton.textContent = 'Subiendo foto...'; }
        try {
            if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.uploadPreset) {
                throw new Error('falta configurar Cloudinary (JAVASCRIPT/cloudinary-config.js).');
            }
            const datos = new FormData();
            datos.append('file', imagen);
            datos.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CONFIG.cloudName)}/image/upload`, {
                method: 'POST', body: datos, signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined
            }).catch(() => { throw new Error('no hay conexión o tardó demasiado.'); });
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok || !json.secure_url) {
                throw new Error((json.error && json.error.message) || 'Cloudinary respondió con error ' + resp.status + '.');
            }
            return json.secure_url;
        } catch (err) {
            alert('No se pudo subir la foto: ' + err.message + '\nNo se guardó nada, probá de nuevo.');
            return null;
        } finally {
            if (boton) { boton.disabled = false; boton.textContent = textoBoton; }
        }
    }

    function pesoDeTexto(txt) {
        return new Blob([txt || '']).size;
    }

    function pesoLegible(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Conecta un <input type="file"> con su vista previa. El objeto devuelto expone .imagen:
    // la recién comprimida (dataURL, se sube al guardar), la URL de una ya subida, o null.
    function conectarSubidaFoto(config) {
        const input = document.getElementById(config.inputId);
        const wrap = document.getElementById(config.previewWrapId);
        const img = document.getElementById(config.previewImgId);
        const peso = document.getElementById(config.pesoId);
        const btnQuitar = document.getElementById(config.btnQuitarId);
        const estado = { imagen: null };

        estado.limpiar = function () {
            estado.imagen = null;
            if (input) input.value = '';
            if (img) img.removeAttribute('src');
            if (peso) peso.textContent = '';
            if (wrap) wrap.classList.add('seccion-oculta-staff');
        };

        estado.mostrar = function (imagen) {
            estado.imagen = imagen;
            if (img) img.src = imagen;
            if (peso) peso.textContent = imagen.indexOf('data:') === 0 ? 'Comprimida: ' + pesoLegible(pesoDeTexto(imagen)) : '';
            if (wrap) wrap.classList.remove('seccion-oculta-staff');
        };

        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                comprimirImagen(file, config.maxLado, CALIDAD_JPEG)
                    .then(estado.mostrar)
                    .catch(err => {
                        alert('No se pudo procesar la imagen: ' + err.message);
                        estado.limpiar();
                    });
            });
        }

        if (btnQuitar) btnQuitar.addEventListener('click', estado.limpiar);

        return estado;
    }

    const fotoJugadorSubida = conectarSubidaFoto({
        inputId: 'jugador-foto-file',
        previewWrapId: 'jugador-foto-preview-wrap',
        previewImgId: 'jugador-foto-preview',
        pesoId: 'jugador-foto-peso',
        btnQuitarId: 'btn-quitar-foto-jugador',
        maxLado: MAX_LADO_FOTO_JUGADOR
    });

    const fotoNoticiaSubida = conectarSubidaFoto({
        inputId: 'noticia-foto-file',
        previewWrapId: 'noticia-foto-preview-wrap',
        previewImgId: 'noticia-foto-preview',
        pesoId: 'noticia-foto-peso',
        btnQuitarId: 'btn-quitar-foto-noticia',
        maxLado: MAX_LADO_FOTO_NOTICIA
    });

    const portadaAlbumSubida = conectarSubidaFoto({
        inputId: 'foto-album-portada-file',
        previewWrapId: 'foto-album-portada-preview-wrap',
        previewImgId: 'foto-album-portada-preview',
        pesoId: 'foto-album-portada-peso',
        btnQuitarId: 'btn-quitar-portada-album',
        maxLado: MAX_LADO_PORTADA_ALBUM
    });

    // ============================================================
    // 3. MÓDULO JORNADA: CARGA DE PARTIDOS Y PLAYOFFS
    // ============================================================
    const formPartido = document.getElementById('form-partido');
    const submitBtnPartido = formPartido ? formPartido.querySelector('button[type="submit"]') : null;
    const cicloSelect = document.getElementById('partido-ciclo');
    const grupoSelect = document.getElementById('partido-grupo-select');
    const localSelect = document.getElementById('partido-local');
    const visitanteSelect = document.getElementById('partido-visitante');
    const inputFechaPartido = document.getElementById('partido-fecha');
    const inputDiaPartido = document.getElementById('partido-dia');
    const inputHorarioPartido = document.getElementById('partido-horario');
    const inputArancelPartido = document.getElementById('partido-arancel-monto');
    const checkHorarioConfirmar = document.getElementById('partido-horario-confirmar');
    const selectCrucePlayoff = document.getElementById('partido-cruce-playoff-select');
    const groupCrucePlayoff = document.getElementById('group-cruce-playoff-directo');
    const groupInstanciaRegular = document.getElementById('group-instancia-regular');
    const rowPenales = document.getElementById('row-penales-partido');
    const selectFiltroCronograma = document.getElementById('filtro-fecha-cronograma-admin');

    // Sub-pestañas de Jornada
    const btnSubJornadaPartidos = document.getElementById('btn-sub-jornada-partidos');
    const btnSubJornadaPlayoffs = document.getElementById('btn-sub-jornada-playoffs');
    const subVistaJornadaPartidos = document.getElementById('sub-vista-jornada-partidos');
    const subVistaJornadaPlayoffs = document.getElementById('sub-vista-jornada-playoffs');

    if (btnSubJornadaPartidos && btnSubJornadaPlayoffs) {
        btnSubJornadaPartidos.addEventListener('click', () => {
            btnSubJornadaPartidos.classList.add('active');
            btnSubJornadaPlayoffs.classList.remove('active');
            if (subVistaJornadaPartidos) subVistaJornadaPartidos.classList.remove('seccion-oculta-staff');
            if (subVistaJornadaPlayoffs) subVistaJornadaPlayoffs.classList.add('seccion-oculta-staff');
        });

        btnSubJornadaPlayoffs.addEventListener('click', () => {
            btnSubJornadaPlayoffs.classList.add('active');
            btnSubJornadaPartidos.classList.remove('active');
            if (subVistaJornadaPlayoffs) subVistaJornadaPlayoffs.classList.remove('seccion-oculta-staff');
            if (subVistaJornadaPartidos) subVistaJornadaPartidos.classList.add('seccion-oculta-staff');
            actualizarSelectsPlayoffs();
            actualizarRondaYSlotPlayoffs();
            renderizarCrucesPlayoffsAdmin();
            actualizarBotonEstadoPlayoffs();
            renderizarResumenConfigBracket();
        });
    }

    let idPartidoEnEdicion = null;
    let fechaFiltroActiva = "todas";

    // El modelo guarda el día de calendario como "DD/MM/AAAA" (ver data.js), pero el
    // <input type="date"> trabaja con "AAAA-MM-DD": traducimos en los dos sentidos.
    function diaInputAStorage(valor) {
        if (!valor) return '';
        const partes = valor.split('-');
        if (partes.length !== 3) return '';
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function diaStorageAInput(valor) {
        if (!valor) return '';
        const partes = valor.split('/');
        if (partes.length !== 3) return '';
        const [d, m, a] = partes;
        return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Un partido sin horario definido se guarda con horario vacío; la web pública y el
    // cronograma lo muestran como "Horario a confirmar".
    function aplicarHorarioAConfirmar() {
        if (!checkHorarioConfirmar || !inputHorarioPartido) return;
        inputHorarioPartido.disabled = checkHorarioConfirmar.checked;
        if (checkHorarioConfirmar.checked) inputHorarioPartido.value = '';
    }

    if (checkHorarioConfirmar) checkHorarioConfirmar.addEventListener('change', aplicarHorarioAConfirmar);

    // Igual que el horario: con la casilla tildada el partido se guarda con cancha vacía
    // ("Cancha a confirmar"). El select conserva su valor para cuando se destilda.
    const checkCanchaConfirmar = document.getElementById('partido-cancha-confirmar');
    function aplicarCanchaAConfirmar() {
        const selectCancha = document.getElementById('partido-cancha');
        if (!checkCanchaConfirmar || !selectCancha) return;
        selectCancha.disabled = checkCanchaConfirmar.checked;
    }

    if (checkCanchaConfirmar) checkCanchaConfirmar.addEventListener('change', aplicarCanchaAConfirmar);

    // Selector de Fecha del Cronograma
    function actualizarSelectFechasCronograma() {
        if (!selectFiltroCronograma) return;
        const valActual = selectFiltroCronograma.value || fechaFiltroActiva;
        selectFiltroCronograma.innerHTML = '<option value="todas">Todas las Fechas</option>';

        const fechasUnicas = [...new Set(partidos.map(p => p.fecha))].sort((a, b) => ordenCronologicoFecha(a) - ordenCronologicoFecha(b));
        if (fechasUnicas.length === 0) fechasUnicas.push(1);

        fechasUnicas.forEach(f => {
            let label = `Fecha ${f}`;
            if (f === 108 || f === '108') label = "8vos de Final";
            else if (f === 104 || f === '104') label = "Cuartos de Final";
            else if (f === 102 || f === '102') label = "Semifinal";
            else if (f === 100 || f === '100') label = "Gran Final";
            selectFiltroCronograma.innerHTML += `<option value="${f}">${label}</option>`;
        });

        selectFiltroCronograma.value = valActual;
    }

    if (selectFiltroCronograma) {
        selectFiltroCronograma.addEventListener('change', (e) => {
            fechaFiltroActiva = e.target.value;
            actualizarListaAdmin();
        });
    }

    // Cantidad de fechas de fase de grupos por ciclo (liga_fechas_grupos): cada torneo tiene otra cantidad
    // de equipos, así que no hay un número fijo. 7 si nunca se configuró.
    const FECHAS_GRUPOS_DEFECTO = 7;
    const FECHAS_PLAYOFF = [[108, '8vos de Final'], [104, 'Cuartos de Final'], [102, 'Semifinal'], [100, 'Gran Final']];
    const inputFechasGruposSup = document.getElementById('fechas-grupos-superior');
    const inputFechasGruposBas = document.getElementById('fechas-grupos-basico');
    const btnGuardarFechasGrupos = document.getElementById('btn-guardar-fechas-grupos');

    function fechasGruposValida(n) {
        return Number.isInteger(n) && n >= 1 && n <= 30;
    }

    function obtenerFechasGrupos() {
        let guardado = null;
        try { guardado = JSON.parse(almacen.getItem('liga_fechas_grupos')); } catch (e) { guardado = null; }
        const leer = ciclo => {
            const n = Number(guardado && guardado[ciclo]);
            return fechasGruposValida(n) ? n : FECHAS_GRUPOS_DEFECTO;
        };
        return { superior: leer('superior'), basico: leer('basico') };
    }

    // Fechas de fase de grupos que ya tienen partidos (de un ciclo, o de los dos con null).
    function fechasGruposConPartidos(ciclo) {
        return [...new Set(partidos
            .filter(p => p && Number(p.fecha) < 100 && (ciclo === null || (p.ciclo || 'superior') === ciclo))
            .map(p => Number(p.fecha)))];
    }

    // 1..n más las fechas que ya tienen partidos aunque queden fuera de rango (para poder editarlos).
    function listaFechasGrupos(n, extras) {
        const fechas = new Set(extras.filter(f => Number.isFinite(f) && f >= 1));
        for (let f = 1; f <= n; f++) fechas.add(f);
        return [...fechas].sort((a, b) => a - b);
    }

    // Opciones de "Fecha / Fase" según el ciclo elegido. valorDeseado (al editar un partido) siempre queda disponible.
    function armarOpcionesFechaPartido(valorDeseado) {
        if (!inputFechaPartido) return;
        const ciclo = cicloSelect ? cicloSelect.value : 'superior';
        const valor = String(valorDeseado !== undefined ? valorDeseado : (inputFechaPartido.value || '1'));
        const extras = fechasGruposConPartidos(ciclo);
        if (valorDeseado !== undefined && Number(valorDeseado) < 100) extras.push(Number(valorDeseado));
        const grupos = listaFechasGrupos(obtenerFechasGrupos()[ciclo] || FECHAS_GRUPOS_DEFECTO, extras);
        inputFechaPartido.innerHTML = grupos.map(f => `<option value="${f}">Fecha ${f}</option>`).join('')
            + FECHAS_PLAYOFF.map(([f, texto]) => `<option value="${f}">${texto}</option>`).join('');
        if ([...inputFechaPartido.options].some(o => o.value === valor)) {
            inputFechaPartido.value = valor;
        } else {
            // La fecha elegida no existe en este ciclo (tiene menos fechas): la más cercana por debajo.
            inputFechaPartido.value = String(grupos.filter(f => f < Number(valor)).pop() || grupos[0]);
        }
    }

    // Un egreso no es de un ciclo: se ofrecen las fechas del ciclo que tiene más, más los playoffs.
    function armarOpcionesFechaEgreso() {
        const select = document.getElementById('egreso-fecha');
        if (!select) return;
        const valor = select.value;
        const config = obtenerFechasGrupos();
        const grupos = listaFechasGrupos(Math.max(config.superior, config.basico), fechasGruposConPartidos(null));
        select.innerHTML = '<option value="">General del torneo (ej. premios)</option>'
            + [...grupos, ...FECHAS_PLAYOFF.map(([f]) => f)].map(f => `<option value="${f}">${nombreFaseTeso(f)}</option>`).join('');
        select.value = [...select.options].some(o => o.value === valor) ? valor : '';
    }

    function mostrarFechasGrupos() {
        const config = obtenerFechasGrupos();
        if (inputFechasGruposSup) inputFechasGruposSup.value = config.superior;
        if (inputFechasGruposBas) inputFechasGruposBas.value = config.basico;
    }

    if (btnGuardarFechasGrupos) {
        btnGuardarFechasGrupos.addEventListener('click', () => {
            const nuevo = {
                superior: Number(inputFechasGruposSup ? inputFechasGruposSup.value : FECHAS_GRUPOS_DEFECTO),
                basico: Number(inputFechasGruposBas ? inputFechasGruposBas.value : FECHAS_GRUPOS_DEFECTO)
            };
            if (!fechasGruposValida(nuevo.superior) || !fechasGruposValida(nuevo.basico)) {
                alert('La cantidad de fechas de fase de grupos tiene que ser un número entero entre 1 y 30 en cada ciclo.');
                return;
            }
            almacen.setItem('liga_fechas_grupos', JSON.stringify(nuevo));
            armarOpcionesFechaPartido();
            armarOpcionesFechaEgreso();
            renderizarCalendarioFechas();

            const fueraDeRango = [['superior', 'Superior'], ['basico', 'Básico']].map(([ciclo, nombre]) => {
                const fuera = fechasGruposConPartidos(ciclo).filter(f => f > nuevo[ciclo]).sort((a, b) => a - b);
                if (fuera.length === 0) return '';
                return `• Ciclo ${nombre}: ya hay partidos en ${fuera.length === 1 ? 'la Fecha' : 'las Fechas'} ${fuera.join(', ')}, más allá de las ${nuevo[ciclo]} que guardaste.`;
            }).filter(Boolean);
            alert(`Fechas de fase de grupos guardadas: Superior ${nuevo.superior}, Básico ${nuevo.basico}.`
                + (fueraDeRango.length > 0
                    ? '\n\nOjo:\n' + fueraDeRango.join('\n') + '\nNo se borró nada: esas fechas siguen apareciendo en Carga de Partidos para poder editar o borrar esos partidos.'
                    : ''));
        });
    }

    // ── Calendario de fechas (liga_calendario_fechas): qué día se juega cada Fecha de la fase de grupos, por ciclo.
    // Se carga una vez y completa el Día de los partidos (formulario y fixture automático). Se guarda como DD/MM/AAAA,
    // igual que el día de cada partido.
    const contenedoresCalendario = {
        superior: document.getElementById('calendario-fechas-superior'),
        basico: document.getElementById('calendario-fechas-basico')
    };
    const btnGuardarCalendario = document.getElementById('btn-guardar-calendario-fechas');
    const PATRON_DIA_CALENDARIO = /^\d{2}\/\d{2}\/\d{4}$/;
    // Día del calendario que corresponde a lo elegido hoy en el formulario de partido: si el Día es ese, se toma como
    // automático y cambia con la Fecha; un día escrito a mano no se toca.
    let diaAutocompletado = '';

    function obtenerCalendarioFechas() {
        let guardado = null;
        try { guardado = JSON.parse(almacen.getItem('liga_calendario_fechas')); } catch (e) { guardado = null; }
        const calendario = { superior: {}, basico: {} };
        ['superior', 'basico'].forEach(ciclo => {
            const dias = guardado && guardado[ciclo];
            if (!dias || typeof dias !== 'object') return;
            Object.keys(dias).forEach(f => { if (PATRON_DIA_CALENDARIO.test(String(dias[f]))) calendario[ciclo][f] = String(dias[f]); });
        });
        return calendario;
    }

    // 'DD/MM/AAAA' de esa Fecha del ciclo, o '' si no se cargó (los playoffs no van en el calendario).
    function diaDeCalendario(ciclo, fecha) {
        if (!(Number(fecha) < 100)) return '';
        return obtenerCalendarioFechas()[ciclo === 'basico' ? 'basico' : 'superior'][String(Number(fecha))] || '';
    }

    function diaCalendarioDelFormulario() {
        if (!inputFechaPartido) return '';
        return diaStorageAInput(diaDeCalendario(cicloSelect ? cicloSelect.value : 'superior', inputFechaPartido.value));
    }

    // Al cambiar la Fecha o el Ciclo el Día pasa a ser el del calendario. Si esa Fecha no tiene día, se vacía solo si
    // el que estaba era el automático de la Fecha anterior.
    function autocompletarDiaPartido() {
        if (!inputDiaPartido) return;
        const dia = diaCalendarioDelFormulario();
        if (dia) inputDiaPartido.value = dia;
        else if (diaAutocompletado && inputDiaPartido.value === diaAutocompletado) inputDiaPartido.value = '';
        diaAutocompletado = dia;
    }

    // Una fila por fecha, las mismas que ofrece "Fecha / Fase". Lo tipeado sin guardar se conserva al redibujar.
    function renderizarCalendarioFechas() {
        const calendario = obtenerCalendarioFechas();
        const config = obtenerFechasGrupos();
        ['superior', 'basico'].forEach(ciclo => {
            const contenedor = contenedoresCalendario[ciclo];
            if (!contenedor) return;
            const tipeado = {};
            contenedor.querySelectorAll('.calendario-input').forEach(input => { tipeado[input.dataset.fecha] = input.value; });
            contenedor.innerHTML = listaFechasGrupos(config[ciclo], fechasGruposConPartidos(ciclo)).map(f => {
                const valor = f in tipeado ? tipeado[f] : diaStorageAInput(calendario[ciclo][f] || '');
                return `<label class="calendario-item">Fecha ${f}<input type="date" class="calendario-input" data-ciclo="${ciclo}" data-fecha="${f}" value="${valor}"></label>`;
            }).join('');
        });
    }

    function textoCambioDia(c) {
        const n = c.afectados.length;
        const cuantos = `${n} ${n === 1 ? 'partido' : 'partidos'}`;
        if (!c.antes) return `${cuantos} sin día ${n === 1 ? 'pasa' : 'pasan'} al ${c.despues}`;
        if (!c.despues) return `${cuantos} del ${c.antes} ${n === 1 ? 'queda' : 'quedan'} sin día`;
        return `${cuantos} ${n === 1 ? 'pasa' : 'pasan'} del ${c.antes} al ${c.despues}`;
    }

    if (btnGuardarCalendario) {
        btnGuardarCalendario.addEventListener('click', () => {
            const anterior = obtenerCalendarioFechas();
            // Las fechas que no se ven (por ejemplo, más allá de la cantidad configurada) se conservan.
            const nuevo = { superior: { ...anterior.superior }, basico: { ...anterior.basico } };
            ['superior', 'basico'].forEach(ciclo => {
                const contenedor = contenedoresCalendario[ciclo];
                if (!contenedor) return;
                contenedor.querySelectorAll('.calendario-input').forEach(input => {
                    const dia = diaInputAStorage(input.value);
                    if (dia) nuevo[ciclo][input.dataset.fecha] = dia;
                    else delete nuevo[ciclo][input.dataset.fecha];
                });
            });

            // Decisión de Joaquín (01/10/2026): si cambia el día de una Fecha que ya tiene partidos, se ofrece pasarlos al
            // día nuevo. Solo los sin jugar que tienen el Día vacío o el día anterior del calendario: los que se movieron
            // a mano a otro día y los ya jugados quedan como están.
            const cambios = [];
            ['superior', 'basico'].forEach(ciclo => {
                new Set([...Object.keys(anterior[ciclo]), ...Object.keys(nuevo[ciclo])]).forEach(f => {
                    const antes = anterior[ciclo][f] || '', despues = nuevo[ciclo][f] || '';
                    if (antes === despues) return;
                    const afectados = partidos.filter(p => p && (p.ciclo || 'superior') === ciclo && Number(p.fecha) === Number(f) && !p.esPlayoff && !p.jugado
                        && ((p.dia || '') === '' || p.dia === antes) && (p.dia || '') !== despues);
                    if (afectados.length) cambios.push({ ciclo, fecha: Number(f), antes, despues, afectados });
                });
            });
            cambios.sort((a, b) => (a.ciclo === b.ciclo ? a.fecha - b.fecha : (a.ciclo === 'superior' ? -1 : 1)));

            almacen.setItem('liga_calendario_fechas', JSON.stringify(nuevo));

            let actualizados = false;
            if (cambios.length && confirm('Cambió el día de fechas que ya tienen partidos sin jugar:\n\n'
                + cambios.map(c => `• ${nombreFaseTeso(c.fecha)} (${nombreCicloHistorial(c.ciclo)}): ${textoCambioDia(c)}`).join('\n')
                + '\n\nLos partidos que se movieron a mano a otro día y los ya jugados no se tocan. ¿Actualizar el Día de esos partidos?')) {
                const diaNuevo = new Map();
                cambios.forEach(c => c.afectados.forEach(p => diaNuevo.set(p.id, c.despues)));
                partidos = partidos.map(p => (p && diaNuevo.has(p.id) ? { ...p, dia: diaNuevo.get(p.id) } : p));
                almacen.setItem('liga_partidos', JSON.stringify(partidos));
                cambios.forEach(c => registrarHistorial('partido', `cambió el día de ${nombreFaseTeso(c.fecha)} (${nombreCicloHistorial(c.ciclo)}) en ${c.afectados.length} ${c.afectados.length === 1 ? 'partido' : 'partidos'}: ${c.antes || 'sin día'} → ${c.despues || 'sin día'}`));
                actualizarListaAdmin();
                actualizados = true;
            }

            if (idPartidoEnEdicion === null && inputDiaPartido) {
                const dia = diaCalendarioDelFormulario();
                if (inputDiaPartido.value === '' || inputDiaPartido.value === diaAutocompletado) inputDiaPartido.value = dia;
                diaAutocompletado = dia;
            }
            renderizarCalendarioFechas();
            alert('Calendario guardado.' + (cambios.length
                ? (actualizados ? ' Se actualizó el Día de los partidos de esas fechas.' : ' Los partidos ya cargados quedaron con el día que tenían.')
                : ''));
        });
    }

    // ── Fixture automático de la fase de grupos: todos contra todos dentro de cada grupo, cada par una sola vez.
    // Los grupos del ciclo comparten la numeración (la Fecha 1 de todos es la misma semana). Horario y cancha quedan
    // a confirmar: los acomoda el staff semana a semana según los pedidos de cada equipo.
    const selectCicloFixture = document.getElementById('fixture-auto-ciclo');
    const inputArancelFixture = document.getElementById('fixture-auto-arancel');
    const btnFixtureAuto = document.getElementById('btn-fixture-auto');
    const panelFixtureAuto = document.getElementById('fixture-auto-vista-previa');
    let fixtureAuto = null;

    // Método del círculo: el primero queda fijo y el resto rota. Con cantidad impar, cada ronda uno queda libre.
    function rondasTodosContraTodos(equipos) {
        const lista = equipos.slice();
        if (lista.length % 2 === 1) lista.push(null);
        const rondas = [];
        for (let r = 0; r < lista.length - 1; r++) {
            const cruces = [];
            let libre = null;
            for (let i = 0; i < lista.length / 2; i++) {
                let local = lista[i], visitante = lista[lista.length - 1 - i];
                if (i === 0 && r % 2 === 1) [local, visitante] = [visitante, local]; // el fijo alterna de lado
                if (local === null || visitante === null) { libre = local || visitante; continue; }
                cruces.push([local, visitante]);
            }
            rondas.push({ cruces, libre });
            lista.splice(1, 0, lista.pop());
        }
        return rondas;
    }

    // Mismo criterio que el alta a mano: sin un monto mayor a 0, Tesorería usa el arancel por defecto.
    function arancelDelFixture() {
        const valor = parseFloat(inputArancelFixture ? inputArancelFixture.value : '');
        return valor > 0 ? valor : null;
    }

    // Arma el fixture del ciclo sin guardar nada. Devuelve {bloqueo} o los partidos y lo que muestra la vista previa.
    function armarFixtureCiclo(ciclo, arancel) {
        const nombreCiclo = nombreCicloHistorial(ciclo);
        const yaCargados = partidos.filter(p => p && (p.ciclo || 'superior') === ciclo && Number(p.fecha) < 100);
        if (yaCargados.length) {
            const fechas = [...new Set(yaCargados.map(p => Number(p.fecha)))].sort((a, b) => a - b);
            return { bloqueo: `El ciclo ${nombreCiclo} ya tiene ${yaCargados.length} ${yaCargados.length === 1 ? 'partido' : 'partidos'} de fase de grupos (${fechas.length === 1 ? 'Fecha' : 'Fechas'} ${fechas.join(', ')}). `
                + 'El fixture automático arma la fase de grupos completa desde la Fecha 1, así que solo se usa con el ciclo sin partidos: '
                + 'para no duplicar cruces, seguí cargándolos a mano o eliminá esos partidos desde el Cronograma. No se creó nada.' };
        }

        recargarPools();
        const pool = ciclo === 'basico' ? poolBasico : poolSuperior;
        const gruposCiclo = gruposTorneo[ciclo] || [];
        const grupos = gruposCiclo.map(g => {
            const equipos = pool.filter(e => e.grupo === g);
            return { grupo: g, equipos, rondas: equipos.length >= 2 ? rondasTodosContraTodos(equipos) : [] };
        });
        const fechasNecesarias = Math.max(0, ...grupos.map(g => g.rondas.length));
        if (fechasNecesarias === 0) {
            return { bloqueo: `No hay ningún grupo del ciclo ${nombreCiclo} con al menos 2 equipos: armá los grupos en Planteles y volvé a armar el fixture. No se creó nada.` };
        }
        const configuradas = obtenerFechasGrupos()[ciclo];
        if (fechasNecesarias > configuradas) {
            const masLargo = grupos.find(g => g.rondas.length === fechasNecesarias);
            return { bloqueo: `Para que todos se enfrenten una vez, el ${textoGrupoHistorial(masLargo.grupo)} (${masLargo.equipos.length} equipos) necesita ${fechasNecesarias} fechas y el ciclo ${nombreCiclo} tiene ${configuradas} configuradas. `
                + 'Subí la cantidad en "Fechas de Fase de Grupos" y volvé a armar el fixture. No se creó nada.' };
        }

        const nuevos = [];
        const fechas = [];
        for (let r = 0; r < fechasNecesarias; r++) {
            const fecha = r + 1;
            const dia = diaDeCalendario(ciclo, fecha);
            const libres = [];
            grupos.forEach(g => {
                const ronda = g.rondas[r];
                if (!ronda) return;
                // La misma forma que un partido nuevo cargado a mano, sin jugar.
                ronda.cruces.forEach(([local, visitante]) => nuevos.push({
                    fecha, ciclo, grupo: g.grupo,
                    local: local.nombre, visitante: visitante.nombre,
                    localId: local.id !== undefined ? local.id : null,
                    visitanteId: visitante.id !== undefined ? visitante.id : null,
                    golesLocal: null, golesVisitante: null, penalesLocal: null, penalesVisitante: null,
                    esPlayoff: false, ronda: null, dia, arancelExigido: arancel,
                    horario: '', cancha: '', arbitro: 'Por asignar',
                    goleadoresLocal: [], goleadoresVisitante: [],
                    amarillasLocal: [], rojasLocal: [], amarillasVisitante: [], rojasVisitante: [],
                    jugado: false, resultadoAuto: false
                }));
                if (ronda.libre) libres.push({ grupo: g.grupo, nombre: ronda.libre.nombre });
            });
            fechas.push({ fecha, dia, libres });
        }

        return {
            ciclo, arancel, nuevos, fechas, configuradas,
            grupos: grupos.map(g => ({ grupo: g.grupo, equipos: g.equipos.length, fechas: g.rondas.length, partidos: g.rondas.reduce((n, r) => n + r.cruces.length, 0) })),
            fueraDeGrupo: pool.filter(e => !gruposCiclo.includes(e.grupo)),
            // Si cambian los equipos, los grupos o el calendario entre la vista previa y la confirmación, se vuelve a revisar.
            firma: JSON.stringify(nuevos.map(p => [p.fecha, p.grupo, p.localId, p.local, p.visitanteId, p.visitante, p.dia]))
        };
    }

    function renderizarFixtureAuto() {
        if (!panelFixtureAuto || !fixtureAuto) return;
        const f = fixtureAuto;
        const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
        const lineaGrupo = g => {
            const nombre = textoGrupoHistorial(g.grupo);
            if (g.equipos === 0) return `${nombre}: sin equipos.`;
            if (g.equipos === 1) return `${nombre}: 1 equipo, sin partidos.`;
            return `${nombre}: ${plural(g.equipos, 'equipo', 'equipos')} → ${plural(g.partidos, 'partido', 'partidos')} en ${plural(g.fechas, 'fecha', 'fechas')}`
                + (g.equipos % 2 === 1 ? ' (cada fecha queda uno libre).' : '.');
        };
        const dondeEsta = e => (e.grupo === 'Unico' ? 'Tabla Única' : (e.grupo ? `Grupo ${e.grupo}, que no está en los grupos del ciclo` : 'sin grupo'));
        const arancel = f.arancel ? `$${f.arancel.toLocaleString()}` : `el de siempre ($${ARANCEL_PARTIDO_DEFECTO.toLocaleString()})`;
        const porFecha = f.fechas.map(fe => {
            const cruces = f.nuevos.filter(p => p.fecha === fe.fecha).map(p =>
                `<li class="fixture-auto-cruce"><span class="fixture-auto-grupo">Grupo ${attrSeguro(p.grupo)} — </span>${attrSeguro(p.local)} <span class="fixture-auto-vs">vs</span> ${attrSeguro(p.visitante)}</li>`);
            const libres = fe.libres.map(l =>
                `<li class="fixture-auto-cruce fixture-auto-libre"><span class="fixture-auto-grupo">Grupo ${attrSeguro(l.grupo)} — </span>Libre: ${attrSeguro(l.nombre)}</li>`);
            return `<div class="fixture-auto-fecha" data-fecha="${fe.fecha}">
                <h4 class="fixture-auto-fecha-titulo">Fecha ${fe.fecha} · ${fe.dia ? attrSeguro(fe.dia) : '<span class="fixture-auto-sin-dia">sin día en el calendario</span>'}</h4>
                <ul class="fixture-auto-cruces">${[...cruces, ...libres].join('')}</ul>
            </div>`;
        }).join('');

        panelFixtureAuto.innerHTML = `
            <h3 class="fixture-auto-titulo">Vista previa del fixture — Ciclo ${nombreCicloHistorial(f.ciclo)}</h3>
            <p class="fixture-auto-texto"><strong>${plural(f.nuevos.length, 'partido', 'partidos')} en ${plural(f.fechas.length, 'fecha', 'fechas')}</strong> (el ciclo tiene ${f.configuradas} configuradas). Cada par de equipos se enfrenta una sola vez. Horario y cancha: a confirmar. Arancel: ${arancel} por equipo.</p>
            <p class="fixture-auto-nota">Todavía no se guardó nada. Al confirmar se crean todos juntos; después cada uno se edita desde el Cronograma (horario, cancha, resultado).</p>
            <ul class="fixture-auto-grupos">${f.grupos.map(g => `<li>${attrSeguro(lineaGrupo(g))}</li>`).join('')}</ul>
            ${f.fueraDeGrupo.length
                ? `<p class="fixture-auto-texto fixture-auto-aviso">No entran (no están en un grupo del ciclo): ${f.fueraDeGrupo.map(e => `${attrSeguro(e.nombre)} (${attrSeguro(dondeEsta(e))})`).join(', ')}.</p>`
                : ''}
            <div class="fixture-auto-fechas">${porFecha}</div>
            <div class="fixture-auto-botones">
                <button type="button" class="importar-btn-cancelar" data-accion="cancelar">Cancelar</button>
                <button type="button" class="btn-submit-admin" data-accion="confirmar">Confirmar (${plural(f.nuevos.length, 'partido', 'partidos')})</button>
            </div>`;
        panelFixtureAuto.classList.remove('seccion-oculta-staff');
    }

    function cerrarFixtureAuto() {
        fixtureAuto = null;
        if (panelFixtureAuto) {
            panelFixtureAuto.innerHTML = '';
            panelFixtureAuto.classList.add('seccion-oculta-staff');
        }
    }

    // Ids numéricos como los del alta a mano (Editar y Eliminar los leen con parseInt). Se cuentan hacia atrás desde
    // ahora salteando los que existen: no chocan entre sí ni con el Date.now() de un partido que se cargue después.
    function idsNuevosPartido(cantidad) {
        const usados = new Set(partidos.map(p => p && p.id));
        const ids = [];
        for (let id = Date.now(); ids.length < cantidad; id--) {
            if (!usados.has(id)) ids.push(id);
        }
        return ids;
    }

    function confirmarFixtureAuto() {
        const actual = armarFixtureCiclo(fixtureAuto.ciclo, fixtureAuto.arancel);
        if (actual.bloqueo) {
            cerrarFixtureAuto();
            alert(actual.bloqueo);
            return;
        }
        if (actual.firma !== fixtureAuto.firma) {
            fixtureAuto = actual;
            renderizarFixtureAuto();
            alert('Cambiaron los equipos, los grupos o el calendario desde que se armó la vista previa: revisala de nuevo antes de confirmar. No se creó nada.');
            return;
        }
        const ids = idsNuevosPartido(actual.nuevos.length);
        actual.nuevos.forEach((p, i) => partidos.push({ id: ids[i], ...p }));
        almacen.setItem('liga_partidos', JSON.stringify(partidos));
        const cantidad = `${actual.nuevos.length} ${actual.nuevos.length === 1 ? 'partido' : 'partidos'}`;
        const enFechas = `${actual.fechas.length} ${actual.fechas.length === 1 ? 'fecha' : 'fechas'}`;
        registrarHistorial('partido', `generó el fixture de FASE DE GRUPOS (${nombreCicloHistorial(actual.ciclo)}): ${cantidad} en ${enFechas}`);

        cerrarFixtureAuto();
        actualizarListaAdmin();
        actualizarSelectFechasCronograma();
        armarOpcionesFechaPartido();
        armarOpcionesFechaEgreso();
        renderizarCalendarioFechas();
        if (typeof actualizarFiltroFechasTesoreria === 'function') actualizarFiltroFechasTesoreria();
        alert(`Fixture del ciclo ${nombreCicloHistorial(actual.ciclo)} guardado: ${cantidad} en ${enFechas}. Horario y cancha quedan a confirmar: completalos con "Editar" en el Cronograma.`);
    }

    if (btnFixtureAuto && panelFixtureAuto) {
        btnFixtureAuto.addEventListener('click', () => {
            const resultado = armarFixtureCiclo(selectCicloFixture ? selectCicloFixture.value : 'superior', arancelDelFixture());
            if (resultado.bloqueo) {
                cerrarFixtureAuto();
                alert(resultado.bloqueo);
                return;
            }
            fixtureAuto = resultado;
            renderizarFixtureAuto();
            panelFixtureAuto.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        panelFixtureAuto.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-accion]');
            if (!boton || !fixtureAuto) return;
            if (boton.dataset.accion === 'cancelar') cerrarFixtureAuto();
            else if (boton.dataset.accion === 'confirmar') confirmarFixtureAuto();
        });

        // La vista previa es de un ciclo y un arancel: si cambian, hay que volver a armarla.
        [selectCicloFixture, inputArancelFixture].forEach(campo => {
            if (campo) campo.addEventListener('change', cerrarFixtureAuto);
        });
    }

    // Al rearmar Local/Visitante (cambio de fecha, grupo o ciclo) se conservan los equipos elegidos si
    // siguen disponibles. Si no: en un partido nuevo, los primeros de la lista como siempre; editando uno,
    // ese lado queda vacío y hay que elegirlo (no se cambia un equipo sin que el staff lo vea).
    function restaurarEquiposElegidos(nombres, previoLocal, previoVisitante) {
        const disponible = n => !!n && nombres.includes(n);
        let local = disponible(previoLocal) ? previoLocal : null;
        let visita = disponible(previoVisitante) && previoVisitante !== local ? previoVisitante : null;
        if (idPartidoEnEdicion === null) {
            if (local === null) local = nombres.find(n => n !== visita) || null;
            if (visita === null) visita = nombres.find(n => n !== local) || null;
            if (local !== null) localSelect.value = local;
            if (visita !== null) visitanteSelect.value = visita;
            return;
        }
        // Editando: si un lado quedó vacío (por ejemplo, se pasó por otro grupo y se volvió), vuelve el equipo del partido.
        const editado = partidos.find(p => p.id === idPartidoEnEdicion);
        if (local === null && editado && disponible(editado.local) && editado.local !== visita) local = editado.local;
        if (visita === null && editado && disponible(editado.visitante) && editado.visitante !== local) visita = editado.visitante;
        [[localSelect, local], [visitanteSelect, visita]].forEach(([select, valor]) => {
            if (valor !== null) { select.value = valor; return; }
            select.insertAdjacentHTML('afterbegin', '<option value="">-- Elegí el equipo --</option>');
            select.value = '';
        });
        alinearCamposConEquipos();
    }

    // Campos que dependen del lado. equiposDeLosCampos dice a qué equipo corresponde hoy cada lado de
    // esos campos: si los dos equipos se invierten, los campos se van con su equipo (el marcador, los
    // goleadores y las tarjetas de cada equipo siguen siendo los mismos).
    const CAMPOS_POR_LADO = [
        ['goles-local', 'goles-visitante'], ['penales-local', 'penales-visitante'],
        ['dorsales-goles-local', 'dorsales-goles-visitante'],
        ['dorsales-amarillas-local', 'dorsales-amarillas-visitante'], ['dorsales-rojas-local', 'dorsales-rojas-visitante']
    ];
    let equiposDeLosCampos = null;

    function alinearCamposConEquipos() {
        if (!equiposDeLosCampos || !localSelect || !visitanteSelect || !localSelect.value || localSelect.value === visitanteSelect.value) return;
        if (equiposDeLosCampos.local !== visitanteSelect.value || equiposDeLosCampos.visitante !== localSelect.value) return;
        CAMPOS_POR_LADO.forEach(([idA, idB]) => {
            const a = document.getElementById(idA), b = document.getElementById(idB);
            if (a && b) [a.value, b.value] = [b.value, a.value];
        });
        equiposDeLosCampos = { local: localSelect.value, visitante: visitanteSelect.value };
    }

    // Elegir en un lado al equipo que estaba del otro los intercambia, con sus campos.
    [[localSelect, visitanteSelect], [visitanteSelect, localSelect]].forEach(([select, otro]) => {
        if (!select || !otro) return;
        select.addEventListener('focus', () => { select.dataset.previo = select.value; });
        select.addEventListener('change', () => {
            const previo = select.dataset.previo || '';
            if (select.value && select.value === otro.value && previo && [...otro.options].some(o => o.value === previo)) {
                if (!equiposDeLosCampos) {
                    equiposDeLosCampos = select === localSelect ? { local: previo, visitante: select.value } : { local: select.value, visitante: previo };
                }
                otro.value = previo;
            }
            alinearCamposConEquipos();
            select.dataset.previo = select.value;
        });
    });

    // Filtrar Equipos según Grupo en Fase Regular
    function filtrarEquiposPorGrupo() {
        recargarPools();
        const ciclo = cicloSelect ? cicloSelect.value : 'superior';
        const grupo = grupoSelect ? grupoSelect.value : 'A';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const filtrados = pool.filter(e => e.grupo === grupo);

        if (!localSelect || !visitanteSelect) return;
        const previoLocal = localSelect.value, previoVisitante = visitanteSelect.value;

        localSelect.innerHTML = '';
        visitanteSelect.innerHTML = '';

        if (filtrados.length === 0) {
            localSelect.innerHTML = '<option value="">Sin equipos</option>';
            visitanteSelect.innerHTML = '<option value="">Sin equipos</option>';
            return;
        }

        filtrados.forEach(e => {
            localSelect.innerHTML += `<option value="${attrSeguro(e.nombre)}">${attrSeguro(e.nombre)}</option>`;
            visitanteSelect.innerHTML += `<option value="${attrSeguro(e.nombre)}">${attrSeguro(e.nombre)}</option>`;
        });

        restaurarEquiposElegidos(filtrados.map(e => e.nombre), previoLocal, previoVisitante);
    }

    // Filtrar Equipos para Cruces Libres en Playoffs
    // Sólo se ofrecen los equipos que YA están puestos en el bracket de esa ronda: los que
    // ganaron su llave anterior, o los que el staff sorteó a mano en el Armador. Un equipo
    // eliminado no tiene que poder elegirse en la ronda siguiente. Si algún lado del cruce
    // todavía no se definió, se muestra "A definir" (deshabilitado): hasta que no se juegue
    // la llave anterior no hay equipo para cargar ahí.
    function filtrarEquiposPlayoffs() {
        recargarPools();
        const ciclo = cicloSelect ? cicloSelect.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;

        if (!localSelect || !visitanteSelect) return;
        const previoLocal = localSelect.value, previoVisitante = visitanteSelect.value;

        localSelect.innerHTML = '';
        visitanteSelect.innerHTML = '';

        if (!pool || pool.length === 0) {
            localSelect.innerHTML = '<option value="">Sin equipos</option>';
            visitanteSelect.innerHTML = '<option value="">Sin equipos</option>';
            return;
        }

        const fechaVal = parseInt(inputFechaPartido ? inputFechaPartido.value : 0);
        const ronda = (typeof rondaPorCodigoFecha === 'function' ? rondaPorCodigoFecha(fechaVal) : null);
        const crucesRonda = (JSON.parse(almacen.getItem('liga_cruces_playoffs')) || [])
            .filter(c => c.ciclo === ciclo && c.ronda === ronda);

        // Sin cruces armados (ronda inicial antes del sorteo) se ofrece el plantel completo,
        // que es el comportamiento de siempre: ahí todavía no hay bracket del que deducir nada.
        let equipos = pool.slice();
        let ladosSinDefinir = 0;

        if (crucesRonda.length > 0) {
            const clasificados = [];
            crucesRonda.forEach(c => {
                ['local', 'visitante'].forEach(lado => {
                    if (c[lado]) {
                        if (!clasificados.includes(c[lado])) clasificados.push(c[lado]);
                    } else {
                        ladosSinDefinir++;
                    }
                });
            });
            equipos = pool.filter(e => clasificados.includes(e.nombre));
        }

        equipos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (equipos.length === 0) {
            const vacio = '<option value="">Todavía no hay equipos clasificados a esta ronda</option>';
            localSelect.innerHTML += vacio;
            visitanteSelect.innerHTML += vacio;
        }

        equipos.forEach(e => {
            localSelect.innerHTML += `<option value="${attrSeguro(e.nombre)}">${attrSeguro(e.nombre)}</option>`;
            visitanteSelect.innerHTML += `<option value="${attrSeguro(e.nombre)}">${attrSeguro(e.nombre)}</option>`;
        });

        if (ladosSinDefinir > 0) {
            const pendiente = `<option value="" disabled>A definir (faltan jugarse ${ladosSinDefinir} lugar${ladosSinDefinir > 1 ? 'es' : ''} de esta ronda)</option>`;
            localSelect.innerHTML += pendiente;
            visitanteSelect.innerHTML += pendiente;
        }

        restaurarEquiposElegidos(equipos.map(e => e.nombre), previoLocal, previoVisitante);
    }

    // Detección de Modo Regular vs Modo Playoffs en el Formulario
    function actualizarOpcionesGrupo() {
        if (!cicloSelect) return;
        armarOpcionesFechaPartido();
        const ciclo = cicloSelect.value;
        const fechaVal = parseInt(inputFechaPartido ? inputFechaPartido.value : 1);
        const esFasePlayoff = fechaVal >= 100;

        if (esFasePlayoff) {
            if (groupCrucePlayoff) groupCrucePlayoff.style.display = 'block';
            if (groupInstanciaRegular) groupInstanciaRegular.style.display = 'none';
            if (rowPenales) rowPenales.style.display = 'grid';

            const ronda = (typeof rondaPorCodigoFecha === 'function' ? rondaPorCodigoFecha(fechaVal) : null) || 'octavos';

            const crucesGuardados = JSON.parse(almacen.getItem('liga_cruces_playoffs')) || [];
            // Sólo cruces con ambos equipos definidos — un cruce generado automáticamente
            // por el avance de playoffs puede tener un lado todavía "A definir".
            const crucesRonda = crucesGuardados
                .filter(c => c.ciclo === ciclo && c.ronda === ronda && c.local && c.visitante)
                .sort((a, b) => (a.slot || 0) - (b.slot || 0));

            if (selectCrucePlayoff) {
                selectCrucePlayoff.innerHTML = '<option value="">-- Seleccionar Cruce Sorteado --</option>';
                if (crucesRonda.length === 0) {
                    selectCrucePlayoff.innerHTML += '<option value="" disabled>No hay cruces armados (con ambos equipos definidos) en esta ronda</option>';
                } else {
                    crucesRonda.forEach(c => {
                        selectCrucePlayoff.innerHTML += `<option value="${attrSeguro(c.local)}|${attrSeguro(c.visitante)}">Llave ${attrSeguro(c.slot || '?')}: ${attrSeguro(c.local)} VS ${attrSeguro(c.visitante)}</option>`;
                    });
                }
            }

            filtrarEquiposPlayoffs();
        } else {
            if (groupCrucePlayoff) groupCrucePlayoff.style.display = 'none';
            if (groupInstanciaRegular) groupInstanciaRegular.style.display = 'flex';
            if (rowPenales) rowPenales.style.display = 'none';

            const grupos = gruposTorneo[ciclo] || [];
            if (grupoSelect) {
                const grpAnterior = grupoSelect.value;
                grupoSelect.innerHTML = '';
                grupos.forEach(g => {
                    grupoSelect.innerHTML += `<option value="${attrSeguro(g)}">Grupo ${attrSeguro(g)}</option>`;
                });
                if (grupos.includes(grpAnterior)) grupoSelect.value = grpAnterior;
            }
            filtrarEquiposPorGrupo();
        }
    }

    if (selectCrucePlayoff) {
        selectCrucePlayoff.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const [eqLocal, eqVisita] = e.target.value.split('|');
            if (localSelect) localSelect.value = eqLocal;
            if (visitanteSelect) visitanteSelect.value = eqVisita;
            alinearCamposConEquipos();
        });
    }

    if (inputFechaPartido) inputFechaPartido.addEventListener('change', actualizarOpcionesGrupo);
    if (cicloSelect) cicloSelect.addEventListener('change', actualizarOpcionesGrupo);
    if (grupoSelect) grupoSelect.addEventListener('change', filtrarEquiposPorGrupo);
    // Después de los de arriba: cuando se completa el Día, la Fecha ya quedó ajustada al ciclo.
    if (inputFechaPartido) inputFechaPartido.addEventListener('change', autocompletarDiaPartido);
    if (cicloSelect) cicloSelect.addEventListener('change', autocompletarDiaPartido);

    // Dibujar Cronograma de Partidos
    function actualizarListaAdmin() {
        const contenedor = document.getElementById('lista-partidos-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (partidos.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:12px;">No hay partidos registrados.</p>';
            return;
        }

        const partidosMostrados = fechaFiltroActiva === "todas" 
            ? [...partidos] 
            : partidos.filter(p => p.fecha.toString() === fechaFiltroActiva.toString());

        if (partidosMostrados.length === 0) {
            contenedor.innerHTML = `<p style="color:#869bd8; text-align:center; font-size:11px; padding: 15px;">No hay partidos para el filtro seleccionado.</p>`;
            return;
        }

        partidosMostrados.sort((a, b) => (a.horario || "00:00").localeCompare(b.horario || "00:00"));

        // null y no "": un partido con horario a confirmar guarda el horario vacío y con
        // "" como valor inicial se quedaba sin su encabezado de grupo.
        let ultimoHorario = null;

        partidosMostrados.forEach(p => {
            const marcador = p.jugado ? `${p.golesLocal} - ${p.golesVisitante}` : 'VS';
            const horarioActual = p.horario || '';

            let faseLabel = `F${p.fecha}`;
            if (p.fecha === 108) faseLabel = "8vos";
            else if (p.fecha === 104) faseLabel = "4tos";
            else if (p.fecha === 102) faseLabel = "Semis";
            else if (p.fecha === 100) faseLabel = "Final";

            if (horarioActual !== ultimoHorario) {
                ultimoHorario = horarioActual;
                contenedor.innerHTML += `
                    <div style="width:100%; text-align:left; margin: 12px 0 6px 0; padding-bottom:2px; border-bottom: 1px dashed rgba(46, 218, 227, 0.5);">
                        <span style="font-family:'Oswald', sans-serif; font-size:12px; color:#fff; text-transform:uppercase;">${horarioActual ? `HORARIO ${horarioActual} HS` : 'HORARIO A CONFIRMAR'}</span>
                    </div>
                `;
            }

            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(255,255,255,0.03); padding:8px 10px; margin-bottom:6px; border-radius:3px; border-left: 4px solid ${p.jugado ? '#2c68e7' : '#e11d48'};">
                    <div style="text-align:left;">
                        <span style="font-size:9px; color:#869bd8; display:block;">${faseLabel} — ${p.dia ? attrSeguro(p.dia) + ' — ' : ''}${attrSeguro(p.cancha || 'Cancha a confirmar')} (${p.ciclo ? p.ciclo.toUpperCase() : 'SUP'})</span>
                        <span style="font-size:12px; color:white;">${attrSeguro(p.local)} <strong style="color:#2edae3;">${attrSeguro(marcador)}</strong> ${attrSeguro(p.visitante)}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-editar-partido" data-id="${p.id}" style="background-color:#1a3274; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Editar</button>
                        <button class="btn-borrar-partido" data-id="${p.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-partido').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                const partidoBorrado = partidos.find(p => p.id === idBorrar);
                const planTeso = partidoBorrado ? planTesoreriaPartido(partidoBorrado, null) : null;
                if (planTeso && planTeso.bloqueos.length > 0) {
                    alert(textoBloqueoTesoreria(planTeso, 'No se puede eliminar este partido: tiene plata cargada en Aranceles por Partido.'));
                    return;
                }
                // También se van las entradas vacías que dejó este partido en claves viejas (sin plata no hay nada que rastrear).
                if (planTeso) Object.keys(tesoreriaPartidos).forEach(clave => {
                    if (clave.split('_')[1] === String(idBorrar) && montoTeso(tesoreriaPartidos[clave]) === 0 && !planTeso.descartes.includes(clave)) planTeso.descartes.push(clave);
                });
                partidos = partidos.filter(p => p.id !== idBorrar);
                almacen.setItem('liga_partidos', JSON.stringify(partidos));
                if (partidoBorrado) registrarHistorial('partido', `eliminó el partido de ${nombreFaseTeso(partidoBorrado.fecha)} (${nombreCicloHistorial(partidoBorrado.ciclo)}): `
                    + (partidoBorrado.jugado ? marcadorHistorial(partidoBorrado) : `${partidoBorrado.local} vs ${partidoBorrado.visitante}`));
                if (planTeso) aplicarPlanTesoreria(planTeso);
                if (idPartidoEnEdicion === idBorrar) cancelarEdicionPartido();
                sincronizarAusencias();
                actualizarListaAdmin();
                actualizarSelectFechasCronograma();
                armarOpcionesFechaPartido();
                armarOpcionesFechaEgreso();
                if (typeof actualizarFiltroFechasTesoreria === 'function') actualizarFiltroFechasTesoreria();
            });
        });

        document.querySelectorAll('.btn-editar-partido').forEach(btn => {
            btn.addEventListener('click', () => {
                const idEditar = parseInt(btn.getAttribute('data-id'));
                const p = partidos.find(part => part.id === idEditar);
                if (p) {
                    idPartidoEnEdicion = p.id;
                    equiposDeLosCampos = null;
                    if (cicloSelect) cicloSelect.value = p.ciclo;
                    armarOpcionesFechaPartido(p.fecha);
                    actualizarOpcionesGrupo();

                    if (p.fecha < 100 && grupoSelect) {
                        grupoSelect.value = p.grupo || 'A';
                        filtrarEquiposPorGrupo();
                    }
                    if (localSelect) localSelect.value = p.local;
                    if (visitanteSelect) visitanteSelect.value = p.visitante;

                    document.getElementById('goles-local').value = p.golesLocal !== null ? p.golesLocal : '';
                    document.getElementById('goles-visitante').value = p.golesVisitante !== null ? p.golesVisitante : '';
                    if (document.getElementById('penales-local')) document.getElementById('penales-local').value = p.penalesLocal !== null ? p.penalesLocal : '';
                    if (document.getElementById('penales-visitante')) document.getElementById('penales-visitante').value = p.penalesVisitante !== null ? p.penalesVisitante : '';
                    if (inputDiaPartido) inputDiaPartido.value = diaStorageAInput(p.dia);
                    diaAutocompletado = diaStorageAInput(diaDeCalendario(p.ciclo, p.fecha));
                    if (inputArancelPartido) inputArancelPartido.value = p.arancelExigido || 30000;
                    if (checkHorarioConfirmar) checkHorarioConfirmar.checked = !p.horario;
                    document.getElementById('partido-horario').value = p.horario || '';
                    aplicarHorarioAConfirmar();
                    document.getElementById('partido-cancha').value = p.cancha || 'Cancha 1';
                    if (checkCanchaConfirmar) checkCanchaConfirmar.checked = !p.cancha;
                    aplicarCanchaAConfirmar();
                    document.getElementById('partido-arbitro-nombre').value = p.arbitro || '';

                    recargarPools();
                    const poolEdicion = p.ciclo === 'basico' ? poolBasico : poolSuperior;
                    const buscarEnEdicion = nombre => poolEdicion.find(e => e.nombre.trim().toLowerCase() === (nombre || '').trim().toLowerCase());
                    const equipoEdLocal = buscarEnEdicion(p.local);
                    const equipoEdVisita = buscarEnEdicion(p.visitante);
                    document.getElementById('dorsales-goles-local').value = dorsalesDeGoleadores(p.goleadoresLocal);
                    document.getElementById('dorsales-goles-visitante').value = dorsalesDeGoleadores(p.goleadoresVisitante);
                    document.getElementById('dorsales-amarillas-local').value = dorsalesDeIds(p.amarillasLocal, equipoEdLocal);
                    document.getElementById('dorsales-rojas-local').value = dorsalesDeIds(p.rojasLocal, equipoEdLocal);
                    document.getElementById('dorsales-amarillas-visitante').value = dorsalesDeIds(p.amarillasVisitante, equipoEdVisita);
                    document.getElementById('dorsales-rojas-visitante').value = dorsalesDeIds(p.rojasVisitante, equipoEdVisita);
                    equiposDeLosCampos = { local: p.local, visitante: p.visitante };

                    if (submitBtnPartido) {
                        submitBtnPartido.textContent = 'Actualizar Partido';
                        submitBtnPartido.style.backgroundColor = '#d97706';
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function leerCampoTexto(id) {
        const campo = document.getElementById(id);
        return campo ? campo.value.trim() : '';
    }

    // "4, 8, 4" -> ids (DNI) de los jugadores con esos números de camiseta en el equipo, y los números que no existen.
    function resolverDorsalesEnEquipo(txt, equipo) {
        const ids = [];
        const faltantes = [];
        txt.split(',').map(d => d.trim()).filter(d => d !== '').forEach(d => {
            const numero = Number(d);
            const jugador = equipo && Number.isInteger(numero)
                ? (equipo.jugadores || []).find(j => j.dorsal !== undefined && j.dorsal !== null && String(j.dorsal).trim() !== '' && Number(j.dorsal) === numero)
                : null;
            if (jugador) ids.push(jugador.dni);
            else faltantes.push(d);
        });
        return { ids, faltantes };
    }

    // Inversa: ids (DNI) -> "4, 8, 4", para volver a mostrar las tarjetas al editar un partido.
    function dorsalesDeIds(ids, equipo) {
        return (ids || []).map(id => {
            const jugador = equipo && (equipo.jugadores || []).find(j => j.dni === id);
            return jugador ? jugador.dorsal : null;
        }).filter(d => d !== null && d !== undefined && String(d).trim() !== '').join(', ');
    }

    // Inversa de procesarDorsales: [{nombre:'Juan (#9)', cantidad:2}] -> "9, 9", para volver a mostrar los goleadores al editar.
    function dorsalesDeGoleadores(goleadores) {
        const dorsales = [];
        (goleadores || []).forEach(g => {
            const match = String(g.nombre).match(/#(\d+)/);
            if (!match) return;
            for (let i = 0; i < g.cantidad; i++) dorsales.push(match[1]);
        });
        return dorsales.join(', ');
    }

    function cancelarEdicionPartido() {
        idPartidoEnEdicion = null;
        equiposDeLosCampos = null;

        // El staff carga varios partidos seguidos de la misma fecha, ciclo, grupo y día.
        // Conservamos ese contexto y limpiamos sólo lo que cambia de un partido al otro
        // (equipos, goles, dorsales y penales).
        const inputArancel = inputArancelPartido;
        const inputArbitro = document.getElementById('partido-arbitro-nombre');
        const selectCancha = document.getElementById('partido-cancha');

        const contexto = {
            fecha: inputFechaPartido ? inputFechaPartido.value : "1",
            ciclo: cicloSelect ? cicloSelect.value : "superior",
            grupo: grupoSelect ? grupoSelect.value : "",
            dia: inputDiaPartido ? inputDiaPartido.value : "",
            horario: inputHorarioPartido ? inputHorarioPartido.value : "14:20",
            horarioAConfirmar: checkHorarioConfirmar ? checkHorarioConfirmar.checked : false,
            cancha: selectCancha ? selectCancha.value : "Cancha 1",
            canchaAConfirmar: checkCanchaConfirmar ? checkCanchaConfirmar.checked : false,
            arbitro: inputArbitro ? inputArbitro.value : "",
            arancel: inputArancel ? inputArancel.value : ""
        };

        if (formPartido) formPartido.reset();

        if (inputFechaPartido) inputFechaPartido.value = contexto.fecha;
        if (cicloSelect) cicloSelect.value = contexto.ciclo;
        actualizarOpcionesGrupo();

        if (grupoSelect && contexto.grupo && grupoSelect.querySelector(`option[value="${contexto.grupo}"]`)) {
            grupoSelect.value = contexto.grupo;
            filtrarEquiposPorGrupo();
        }

        if (inputDiaPartido) inputDiaPartido.value = contexto.dia;
        diaAutocompletado = diaCalendarioDelFormulario();
        if (checkHorarioConfirmar) checkHorarioConfirmar.checked = contexto.horarioAConfirmar;
        if (inputHorarioPartido) inputHorarioPartido.value = contexto.horario;
        aplicarHorarioAConfirmar();
        if (selectCancha) selectCancha.value = contexto.cancha;
        if (checkCanchaConfirmar) checkCanchaConfirmar.checked = contexto.canchaAConfirmar;
        aplicarCanchaAConfirmar();
        if (inputArbitro) inputArbitro.value = contexto.arbitro;
        if (inputArancel && contexto.arancel) inputArancel.value = contexto.arancel;

        if (submitBtnPartido) {
            submitBtnPartido.textContent = 'GUARDAR Y COMPUTAR PARTIDO';
            submitBtnPartido.style.backgroundColor = '#1a3274';
        }
    }

    // Submit de Partido
    if (formPartido) {
        formPartido.addEventListener('submit', (e) => {
            e.preventDefault();
            alinearCamposConEquipos();

            const localInput = localSelect.value;
            const visitanteInput = visitanteSelect ? visitanteSelect.value : "";
            const golesLocalInput = document.getElementById('goles-local').value;
            const golesVisitanteInput = document.getElementById('goles-visitante').value;
            const ciclo = cicloSelect.value;
            const fechaVal = parseInt(inputFechaPartido.value);

            if (!localInput || !visitanteInput) {
                alert('Elegí el equipo local y el visitante del partido.');
                return;
            }

            if (localInput === visitanteInput) {
                alert('¡Un equipo no puede jugar contra sí mismo!');
                return;
            }

            const esJugado = golesLocalInput !== "" && golesVisitanteInput !== "";

            const penLocalVal = document.getElementById('penales-local') ? parseInt(document.getElementById('penales-local').value) || 0 : 0;
            const penVisitaVal = document.getElementById('penales-visitante') ? parseInt(document.getElementById('penales-visitante').value) || 0 : 0;

            const rondaPlayoff = typeof rondaPorCodigoFecha === 'function' ? rondaPorCodigoFecha(fechaVal) : null;

            recargarPools();
            const poolEquipos = ciclo === 'superior' ? poolSuperior : poolBasico;
            const eqLocalObj = poolEquipos.find(e => e.nombre.trim().toLowerCase() === localInput.trim().toLowerCase());
            const eqVisitanteObj = poolEquipos.find(e => e.nombre.trim().toLowerCase() === visitanteInput.trim().toLowerCase());

            const dorsalesLocalTxt = document.getElementById('dorsales-goles-local').value.trim();
            const dorsalesVisitaTxt = document.getElementById('dorsales-goles-visitante').value.trim();

            // Tarjetas (solo amarillas y rojas): se guardan dentro del partido con el DNI de cada jugador y los totales
            // se derivan de los partidos (no hay contador sobre el jugador). Se valida antes de tocar nada.
            const tarjetasTxt = {
                amarillasLocal: leerCampoTexto('dorsales-amarillas-local'),
                rojasLocal: leerCampoTexto('dorsales-rojas-local'),
                amarillasVisitante: leerCampoTexto('dorsales-amarillas-visitante'),
                rojasVisitante: leerCampoTexto('dorsales-rojas-visitante')
            };
            if (Object.values(tarjetasTxt).some(t => t !== '') && !esJugado) {
                alert('Para cargar tarjetas primero cargá el resultado del partido.');
                return;
            }
            const tarjetas = {};
            for (const [campo, txt] of Object.entries(tarjetasTxt)) {
                const equipoTarjeta = campo.endsWith('Local') ? eqLocalObj : eqVisitanteObj;
                const resuelto = resolverDorsalesEnEquipo(txt, equipoTarjeta);
                if (resuelto.faltantes.length > 0) {
                    alert(`No hay ningún jugador con el número ${resuelto.faltantes.join(', ')} en ${equipoTarjeta ? equipoTarjeta.nombre : 'el equipo'} (campo de tarjetas).`);
                    return;
                }
                tarjetas[campo] = resuelto.ids;
            }

            // Los goles de cada jugador se cuentan desde los partidos (main.js, golesDeJugador): acá solo se
            // arma la lista del partido. Cada goleador lleva el DNI del jugador (id) además de la etiqueta.
            function procesarDorsales(txtDorsales, equipoObj, rivalNombre) {
                if (!txtDorsales || !equipoObj || !equipoObj.jugadores) return [];
                const listaDorsales = txtDorsales.split(',').map(d => d.trim()).filter(d => d !== '');
                const conteoGoles = {};

                listaDorsales.forEach(dorsalStr => {
                    const numDorsal = parseInt(dorsalStr);
                    const jugadorEncontrado = equipoObj.jugadores.find(j => j.dorsal == numDorsal);
                    if (jugadorEncontrado) {
                        const clave = `${jugadorEncontrado.nombre} (#${numDorsal})`;
                        if (!conteoGoles[clave]) conteoGoles[clave] = { cantidad: 0, id: idJugadorBF(jugadorEncontrado) };
                        conteoGoles[clave].cantidad++;
                    } else {
                        // El gol no se asigna a nadie (decisión de Joaquín, 22/09/2026): el resto del resultado
                        // se guarda igual, pero queda un aviso para que el staff lo revise y corrija después.
                        registrarAvisoStaff('dorsal_invalido_gol',
                            `Gol cargado con el dorsal #${dorsalStr} en ${equipoObj.nombre} (${nombreFaseTeso(fechaVal)} vs ${rivalNombre || 'rival a definir'}), pero no hay ningún jugador con ese número en el plantel.`);
                    }
                });

                return Object.keys(conteoGoles).map(nombreLabel => ({
                    nombre: nombreLabel,
                    cantidad: conteoGoles[nombreLabel].cantidad,
                    id: conteoGoles[nombreLabel].id
                }));
            }

            // Antes de guardar nada (procesarDorsales ya anota avisos): un equipo con plata cargada no puede salir del partido.
            const partidoEditado = idPartidoEnEdicion !== null ? partidos.find(p => p.id === idPartidoEnEdicion) : null;
            const planTeso = partidoEditado ? planTesoreriaPartido(partidoEditado, {
                ...partidoEditado, fecha: fechaVal, ciclo, local: localInput, visitante: visitanteInput,
                localId: eqLocalObj ? eqLocalObj.id : null, visitanteId: eqVisitanteObj ? eqVisitanteObj.id : null
            }) : null;
            if (planTeso && planTeso.bloqueos.length > 0) {
                alert(textoBloqueoTesoreria(planTeso, 'No se guardó el cambio: sacás del partido a un equipo que tiene plata cargada en Aranceles por Partido.'));
                return;
            }

            const arrayGolesLocal = esJugado ? procesarDorsales(dorsalesLocalTxt, eqLocalObj, eqVisitanteObj ? eqVisitanteObj.nombre : visitanteInput) : [];
            const arrayGolesVisita = esJugado ? procesarDorsales(dorsalesVisitaTxt, eqVisitanteObj, eqLocalObj ? eqLocalObj.nombre : localInput) : [];

            const partidoPrevio = idPartidoEnEdicion !== null ? partidos.find(p => p.id === idPartidoEnEdicion) : null;
            // De qué lado estaba cada equipo en el partido guardado ('Local', 'Visitante' o null si es nuevo en el partido).
            const ladoPrevioDe = equipo => {
                if (!partidoPrevio || !equipo) return null;
                const coincide = lado => {
                    const id = buscarEquipoIdTeso(partidoPrevio, lado);
                    if (id != null) return id === equipo.id;
                    return ((lado === 'local' ? partidoPrevio.local : partidoPrevio.visitante) || '').trim().toLowerCase() === equipo.nombre.trim().toLowerCase();
                };
                return coincide('local') ? 'Local' : (coincide('visita') ? 'Visitante' : null);
            };
            const ladoPrevioLocal = ladoPrevioDe(eqLocalObj), ladoPrevioVisitante = ladoPrevioDe(eqVisitanteObj);
            const invertido = ladoPrevioLocal === 'Visitante' && ladoPrevioVisitante === 'Local';
            const conservaResultadoAuto = !!(partidoPrevio && partidoPrevio.resultadoAuto && esJugado
                && parseInt(golesLocalInput) === partidoPrevio[invertido ? 'golesVisitante' : 'golesLocal']
                && parseInt(golesVisitanteInput) === partidoPrevio[invertido ? 'golesLocal' : 'golesVisitante']);

            const datosPartido = {
                fecha: fechaVal,
                ciclo: ciclo,
                grupo: (fechaVal < 100 && grupoSelect) ? grupoSelect.value : 'Playoffs',
                local: localInput,
                visitante: visitanteInput,
                localId: eqLocalObj ? eqLocalObj.id : null, // Referencia estable: sobrevive si se corrige el nombre del equipo
                visitanteId: eqVisitanteObj ? eqVisitanteObj.id : null,
                golesLocal: esJugado ? parseInt(golesLocalInput) : null,
                golesVisitante: esJugado ? parseInt(golesVisitanteInput) : null,
                penalesLocal: (fechaVal >= 100 && esJugado) ? penLocalVal : null,
                penalesVisitante: (fechaVal >= 100 && esJugado) ? penVisitaVal : null,
                esPlayoff: fechaVal >= 100,
                ronda: rondaPlayoff,
                dia: inputDiaPartido ? diaInputAStorage(inputDiaPartido.value) : '',
                arancelExigido: (inputArancelPartido && parseFloat(inputArancelPartido.value) > 0)
                    ? parseFloat(inputArancelPartido.value)
                    : null,
                horario: (checkHorarioConfirmar && checkHorarioConfirmar.checked)
                    ? ''
                    : ((inputHorarioPartido ? inputHorarioPartido.value.trim() : '') || "14:20"),
                cancha: (checkCanchaConfirmar && checkCanchaConfirmar.checked)
                    ? ''
                    : (document.getElementById('partido-cancha').value || "Cancha 1"),
                arbitro: document.getElementById('partido-arbitro-nombre').value.trim() || "Por asignar",
                goleadoresLocal: arrayGolesLocal,
                goleadoresVisitante: arrayGolesVisita,
                amarillasLocal: tarjetas.amarillasLocal,
                rojasLocal: tarjetas.rojasLocal,
                amarillasVisitante: tarjetas.amarillasVisitante,
                rojasVisitante: tarjetas.rojasVisitante,
                jugado: esJugado,
                resultadoAuto: conservaResultadoAuto
            };

            // La lista de buena fe (y de ahí los PJ) es de cada equipo: se va con él si cambia de lado, y la de un
            // equipo que deja el partido se descarta (como su entrada de Tesorería).
            if (partidoPrevio) {
                datosPartido.asistentesLocal = ladoPrevioLocal ? [...(partidoPrevio['asistentes' + ladoPrevioLocal] || [])] : [];
                datosPartido.asistentesVisitante = ladoPrevioVisitante ? [...(partidoPrevio['asistentes' + ladoPrevioVisitante] || [])] : [];
            }

            if (idPartidoEnEdicion !== null) {
                partidos = partidos.map(p => p.id === idPartidoEnEdicion ? { ...p, ...datosPartido } : p);
                alert('¡Partido actualizado correctamente!');
            } else {
                partidos.push({ id: Date.now(), ...datosPartido });
                alert('¡Partido guardado!');
            }

            almacen.setItem('liga_partidos', JSON.stringify(partidos));
            registrarHistorial('partido', textoHistorialPartido(partidoPrevio, datosPartido));
            if (planTeso) aplicarPlanTesoreria(planTeso);

            if (datosPartido.esPlayoff && datosPartido.jugado) {
                procesarAvancePlayoff(datosPartido);
            }

            sincronizarAusencias();
            cancelarEdicionPartido();
            actualizarListaAdmin();
            actualizarSelectFechasCronograma();
            armarOpcionesFechaEgreso();
            if (typeof actualizarFiltroFechasTesoreria === 'function') actualizarFiltroFechasTesoreria();
        });
    }

    // Armador de Cruces de Playoffs
    const formPlayoff = document.getElementById('form-armar-playoff');
    const playoffCicloSel = document.getElementById('playoff-ciclo-select');
    const playoffRondaSel = document.getElementById('playoff-ronda-select');
    const playoffSlotSel = document.getElementById('playoff-slot-select');
    const playoffEq1 = document.getElementById('playoff-equipo-1');
    const playoffEq2 = document.getElementById('playoff-equipo-2');
    const btnTogglePublicarPlayoffs = document.getElementById('btn-toggle-publicar-playoffs');

    // ── Configurar Bracket por Ciclo (ronda inicial + cantidad de llaves) ──
    const formConfigBracket = document.getElementById('form-config-bracket');
    const configBracketCiclo = document.getElementById('config-bracket-ciclo');
    const configBracketRondaInicial = document.getElementById('config-bracket-ronda-inicial');
    const configBracketSlots = document.getElementById('config-bracket-slots');
    const resumenConfigBracket = document.getElementById('resumen-config-bracket');

    function renderizarResumenConfigBracket() {
        if (!resumenConfigBracket) return;
        const config = typeof obtenerConfigPlayoffs === 'function' ? obtenerConfigPlayoffs() : {};
        const etiquetaCiclo = { superior: 'Superior', basico: 'Básico' };
        const etiquetaRonda = { octavos: 'Octavos', cuartos: 'Cuartos', semis: 'Semifinal', final: 'Final' };
        let html = '';
        ['superior', 'basico'].forEach(ciclo => {
            const cfg = config[ciclo];
            if (cfg) {
                html += `<div><strong>${etiquetaCiclo[ciclo]}</strong>: arranca en ${etiquetaRonda[cfg.rondaInicial] || cfg.rondaInicial} con ${cfg.slots} llave(s).</div>`;
            } else {
                html += `<div><strong>${etiquetaCiclo[ciclo]}</strong>: sin configurar (default: Octavos, 8 llaves).</div>`;
            }
        });
        resumenConfigBracket.innerHTML = html;
    }

    if (formConfigBracket) {
        formConfigBracket.addEventListener('submit', (e) => {
            e.preventDefault();
            const ciclo = configBracketCiclo.value;
            const rondaInicial = configBracketRondaInicial.value;
            const slots = parseInt(configBracketSlots.value);

            if (!slots || slots < 1) {
                alert('La cantidad de llaves tiene que ser al menos 1.');
                return;
            }

            const config = typeof obtenerConfigPlayoffs === 'function' ? obtenerConfigPlayoffs() : {};
            config[ciclo] = { rondaInicial, slots };
            if (typeof guardarConfigPlayoffs === 'function') guardarConfigPlayoffs(config);

            renderizarResumenConfigBracket();
            actualizarRondaYSlotPlayoffs();
            alert(`Configuración guardada — Ciclo ${ciclo === 'superior' ? 'Superior' : 'Básico'} arranca en ${rondaInicial.toUpperCase()} con ${slots} llave(s).`);
        });
    }

    function actualizarBotonEstadoPlayoffs() {
        if (!btnTogglePublicarPlayoffs) return;
        if (playoffsPublicados) {
            btnTogglePublicarPlayoffs.textContent = 'PUBLICADOS EN LA WEB (Árbol Visible)';
            btnTogglePublicarPlayoffs.style.background = '#15803d';
            btnTogglePublicarPlayoffs.style.borderColor = '#4ade80';
        } else {
            btnTogglePublicarPlayoffs.textContent = 'OCULTOS (Mostrando Cartel de Espera)';
            btnTogglePublicarPlayoffs.style.background = '#991b1b';
            btnTogglePublicarPlayoffs.style.borderColor = '#f43f5e';
        }
    }

    if (btnTogglePublicarPlayoffs) {
        btnTogglePublicarPlayoffs.addEventListener('click', () => {
            playoffsPublicados = !playoffsPublicados;
            almacen.setItem('liga_playoffs_publicados', playoffsPublicados ? 'true' : 'false');
            actualizarBotonEstadoPlayoffs();
            alert(playoffsPublicados 
                ? '¡Playoffs activados en la web!' 
                : 'Playoffs ocultos. Se muestra el cartel de espera.');
        });
    }

    function actualizarSelectsPlayoffs() {
        if (!playoffEq1 || !playoffEq2) return;
        recargarPools();
        const ciclo = playoffCicloSel ? playoffCicloSel.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;

        playoffEq1.innerHTML = '';
        playoffEq2.innerHTML = '';

        if (!pool || pool.length === 0) {
            playoffEq1.innerHTML = '<option value="">Sin equipos registrados</option>';
            playoffEq2.innerHTML = '<option value="">Sin equipos registrados</option>';
            return;
        }

        pool.sort((a, b) => a.nombre.localeCompare(b.nombre));
        pool.forEach(eq => {
            playoffEq1.innerHTML += `<option value="${attrSeguro(eq.nombre)}">${attrSeguro(eq.nombre)}</option>`;
            playoffEq2.innerHTML += `<option value="${attrSeguro(eq.nombre)}">${attrSeguro(eq.nombre)}</option>`;
        });
        if (playoffEq2.options.length > 1) playoffEq2.selectedIndex = 1;
    }

    const ETIQUETAS_RONDA = { octavos: 'Octavos de Final', cuartos: 'Cuartos de Final', semis: 'Semifinal', final: 'Final' };

    // Llena el select de Ronda Target sólo con las rondas vigentes para el ciclo
    // elegido, según la configuración del bracket (ver form-config-bracket).
    function actualizarRondaYSlotPlayoffs() {
        if (!playoffRondaSel || !playoffCicloSel) return;
        const ciclo = playoffCicloSel.value;
        const rondas = typeof rondasHabilitadas === 'function'
            ? rondasHabilitadas(ciclo)
            : ['octavos', 'cuartos', 'semis', 'final'];

        const rondaPrevia = playoffRondaSel.value;
        playoffRondaSel.innerHTML = rondas.map(r => `<option value="${r}">${ETIQUETAS_RONDA[r] || r}</option>`).join('');
        if (rondas.includes(rondaPrevia)) playoffRondaSel.value = rondaPrevia;

        actualizarSlotsPlayoffs();
    }

    // Llena el select de Llave (Slot) según cuántas llaves tiene la ronda elegida.
    function actualizarSlotsPlayoffs() {
        if (!playoffSlotSel || !playoffCicloSel || !playoffRondaSel) return;
        const ciclo = playoffCicloSel.value;
        const ronda = playoffRondaSel.value;
        const slots = typeof slotsPorRonda === 'function' ? slotsPorRonda(ciclo) : null;
        const cantidad = (slots && slots[ronda]) || 1;

        const slotPrevio = playoffSlotSel.value;
        let opciones = '';
        for (let i = 1; i <= cantidad; i++) {
            opciones += `<option value="${i}">Llave ${i}</option>`;
        }
        playoffSlotSel.innerHTML = opciones;
        if (slotPrevio && parseInt(slotPrevio) <= cantidad) playoffSlotSel.value = slotPrevio;
    }

    if (playoffCicloSel) {
        playoffCicloSel.addEventListener('change', () => {
            actualizarSelectsPlayoffs();
            actualizarRondaYSlotPlayoffs();
        });
    }
    if (playoffRondaSel) playoffRondaSel.addEventListener('change', actualizarSlotsPlayoffs);

    function renderizarCrucesPlayoffsAdmin() {
        const contenedor = document.getElementById('lista-cruces-playoffs-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (crucesPlayoffs.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px; padding:15px;">No hay cruces armados todavía.</p>';
            return;
        }

        const crucesOrdenados = [...crucesPlayoffs].sort((a, b) => {
            if (a.ciclo !== b.ciclo) return a.ciclo.localeCompare(b.ciclo);
            const idxA = typeof ORDEN_RONDAS !== 'undefined' ? ORDEN_RONDAS.indexOf(a.ronda) : 0;
            const idxB = typeof ORDEN_RONDAS !== 'undefined' ? ORDEN_RONDAS.indexOf(b.ronda) : 0;
            if (idxA !== idxB) return idxA - idxB;
            return (a.slot || 0) - (b.slot || 0);
        });

        crucesOrdenados.forEach(c => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(242, 192, 14,0.05); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid #f2c00e;">
                    <div style="text-align:left;">
                        <span style="font-size:10px; color:#f2c00e; display:block; text-transform:uppercase;">${c.ronda.toUpperCase()} — LLAVE ${c.slot || '?'} (${c.ciclo.toUpperCase()})</span>
                        <span style="font-size:12px; color:white; font-weight:bold;">${attrSeguro(c.local || '(A definir)')} VS ${attrSeguro(c.visitante || '(A definir)')}</span>
                    </div>
                    <button class="btn-borrar-cruce" data-id="${c.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-cruce').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                crucesPlayoffs = crucesPlayoffs.filter(c => c.id !== idBorrar);
                almacen.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
                renderizarCrucesPlayoffsAdmin();
                actualizarOpcionesGrupo();
            });
        });
    }

    // ============================================================
    // AVANCE AUTOMÁTICO DE GANADORES ENTRE RONDAS DE PLAYOFFS
    // ============================================================

    // Busca, dentro de 'partidos', un partido de playoff ya jugado que corresponda
    // a un cruce dado (mismo ciclo+ronda, mismos equipos en cualquier orden).
    function buscarPartidoDeCruce(cruce) {
        return partidos.find(p =>
            p.esPlayoff && p.jugado && p.ronda === cruce.ronda && p.ciclo === cruce.ciclo &&
            ((p.local === cruce.local && p.visitante === cruce.visitante) ||
             (p.local === cruce.visitante && p.visitante === cruce.local))
        );
    }

    // Al cargarse el resultado de un partido de playoff, determina el ganador y lo
    // ubica automáticamente en el cruce que le corresponde en la ronda siguiente,
    // según el slot fijo del cruce de origen. Nunca pisa el lado hermano del cruce
    // destino (el que alimenta el otro partido de la misma llave).
    function procesarAvancePlayoff(partidoJugado) {
        if (typeof determinarGanador !== 'function' || typeof rondaSiguiente !== 'function') return;

        const cruceOrigen = crucesPlayoffs.find(c =>
            c.ciclo === partidoJugado.ciclo && c.ronda === partidoJugado.ronda &&
            ((c.local === partidoJugado.local && c.visitante === partidoJugado.visitante) ||
             (c.local === partidoJugado.visitante && c.visitante === partidoJugado.local))
        );
        if (!cruceOrigen || !cruceOrigen.slot) return; // sin cruce armado (o sin slot), no hay adónde avanzar

        const { ganador } = determinarGanador(partidoJugado);
        if (!ganador) return; // empate sin penales cargados: no se puede determinar todavía

        const nombreGanador = ganador === 'local' ? partidoJugado.local : partidoJugado.visitante;

        const rondaDestino = rondaSiguiente(cruceOrigen.ronda);
        if (!rondaDestino) return; // ya era la Final, no hay ronda siguiente

        const slotDest = slotDestino(cruceOrigen.slot);
        const ladoDest = ladoDestino(cruceOrigen.slot);

        let cruceDestino = crucesPlayoffs.find(c =>
            c.ciclo === cruceOrigen.ciclo && c.ronda === rondaDestino && c.slot === slotDest
        );

        if (!cruceDestino) {
            cruceDestino = { id: Date.now(), ciclo: cruceOrigen.ciclo, ronda: rondaDestino, slot: slotDest, local: null, visitante: null };
            crucesPlayoffs.push(cruceDestino);
        } else {
            const partidoDestinoYaJugado = buscarPartidoDeCruce(cruceDestino);
            if (partidoDestinoYaJugado && cruceDestino[ladoDest] !== nombreGanador) {
                const continuar = confirm(
                    `El cruce de ${rondaDestino.toUpperCase()} (Llave ${slotDest}) que depende de este resultado YA tiene un partido jugado.\n\n` +
                    `Si confirmás, se va a actualizar el equipo clasificado en ese cruce, pero el resultado ya cargado en ${rondaDestino.toUpperCase()} puede quedar inconsistente (puede que haya "ganado" un equipo que en realidad quedó eliminado ahora). Vas a tener que revisar y corregir esa ronda manualmente.\n\n` +
                    `¿Confirmás el avance de todas formas?`
                );
                if (!continuar) return;
            }
        }

        cruceDestino[ladoDest] = nombreGanador;

        almacen.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
        renderizarCrucesPlayoffsAdmin();
        actualizarSelectsPlayoffs();
        actualizarRondaYSlotPlayoffs();
        actualizarOpcionesGrupo();
    }

    if (formPlayoff) {
        formPlayoff.addEventListener('submit', (e) => {
            e.preventDefault();
            const ronda = document.getElementById('playoff-ronda-select').value;
            const slot = parseInt(document.getElementById('playoff-slot-select').value);
            const eq1 = playoffEq1.value;
            const eq2 = playoffEq2.value;

            if (eq1 === eq2) {
                alert('No podés armar un cruce con el mismo equipo.');
                return;
            }

            const yaExiste = crucesPlayoffs.find(c => c.ciclo === playoffCicloSel.value && c.ronda === ronda && c.slot === slot);
            if (yaExiste) {
                // La llave 1 viene preseleccionada, así que es fácil pisar un cruce ya armado
                // sin darse cuenta: pedimos confirmación explícita antes de reemplazarlo.
                const ocupadaPor = `${yaExiste.local || 'A definir'} vs ${yaExiste.visitante || 'A definir'}`;
                const confirmado = confirm(
                    `La Llave ${slot} de ${ronda.toUpperCase()} ya está ocupada por:\n\n${ocupadaPor}\n\n` +
                    `Si continuás se reemplaza por:\n\n${eq1} vs ${eq2}\n\n¿Sobrescribir la llave?`
                );
                if (!confirmado) return;

                yaExiste.local = eq1;
                yaExiste.visitante = eq2;
            } else {
                crucesPlayoffs.push({
                    id: Date.now(),
                    ciclo: playoffCicloSel.value,
                    ronda: ronda,
                    slot: slot,
                    local: eq1,
                    visitante: eq2
                });
            }

            almacen.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
            renderizarCrucesPlayoffsAdmin();
            actualizarOpcionesGrupo();
            alert(`Cruce de ${ronda.toUpperCase()} (Llave ${slot}) guardado: ${eq1} vs ${eq2}`);
        });
    }

    // ============================================================
    // 4. MÓDULO PLANTELES, JUGADORES, GRUPOS Y EMERGENCIAS
    // ============================================================
    const btnSubPlantelJugadores = document.getElementById('btn-sub-plantel-jugadores');
    const btnSubPlantelAdmin = document.getElementById('btn-sub-plantel-admin');
    const subVistaPlantelJugadores = document.getElementById('sub-vista-plantel-jugadores');
    const subVistaPlantelAdmin = document.getElementById('sub-vista-plantel-admin');

    if (btnSubPlantelJugadores && btnSubPlantelAdmin) {
        btnSubPlantelJugadores.addEventListener('click', () => {
            btnSubPlantelJugadores.classList.add('active');
            btnSubPlantelAdmin.classList.remove('active');
            if (subVistaPlantelJugadores) subVistaPlantelJugadores.classList.remove('seccion-oculta-staff');
            if (subVistaPlantelAdmin) subVistaPlantelAdmin.classList.add('seccion-oculta-staff');
            actualizarComboEquiposPlantel();
        });

        btnSubPlantelAdmin.addEventListener('click', () => {
            btnSubPlantelAdmin.classList.add('active');
            btnSubPlantelJugadores.classList.remove('active');
            if (subVistaPlantelAdmin) subVistaPlantelAdmin.classList.remove('seccion-oculta-staff');
            if (subVistaPlantelJugadores) subVistaPlantelJugadores.classList.add('seccion-oculta-staff');
            renderizarListaGruposAdmin();
            actualizarOpcionesMoverEquipo();
            actualizarSelectsFormatoTorneo();
        });
    }

    // ── Formato del Torneo por Ciclo (Fase de Grupos / Tabla Única) ──
    // Control explícito para que el staff decida si mostrar la pestaña "Tabla
    // Única" en la web pública. Por defecto ambos ciclos quedan en 'grupos' —
    // la Tabla Única no se muestra sola por el sólo hecho de mover un equipo
    // ahí, hay que activarla acá a propósito.
    const selectFormatoSuperior = document.getElementById('formato-torneo-superior');
    const selectFormatoBasico = document.getElementById('formato-torneo-basico');
    const btnGuardarFormatoTorneo = document.getElementById('btn-guardar-formato-torneo');

    function obtenerFormatoTorneo() {
        return JSON.parse(almacen.getItem('liga_formato_torneo')) || { superior: 'grupos', basico: 'grupos' };
    }

    function actualizarSelectsFormatoTorneo() {
        const formato = obtenerFormatoTorneo();
        if (selectFormatoSuperior) selectFormatoSuperior.value = formato.superior || 'grupos';
        if (selectFormatoBasico) selectFormatoBasico.value = formato.basico || 'grupos';
    }

    if (btnGuardarFormatoTorneo) {
        btnGuardarFormatoTorneo.addEventListener('click', () => {
            const formato = {
                superior: selectFormatoSuperior ? selectFormatoSuperior.value : 'grupos',
                basico: selectFormatoBasico ? selectFormatoBasico.value : 'grupos'
            };
            almacen.setItem('liga_formato_torneo', JSON.stringify(formato));
            alert('Formato del torneo guardado. Los cambios se ven en la web pública al recargarla.');
        });
    }

    // Crear Equipo
    const formNuevoEquipo = document.getElementById('form-nuevo-equipo');
    const nuevoEquipoCiclo = document.getElementById('nuevo-equipo-ciclo');
    const nuevoEquipoGrupo = document.getElementById('nuevo-equipo-grupo');

    function actualizarSelectorGruposFormulario() {
        if (!nuevoEquipoCiclo || !nuevoEquipoGrupo) return;
        const ciclo = nuevoEquipoCiclo.value;
        const grupos = gruposTorneo[ciclo] || [];

        nuevoEquipoGrupo.innerHTML = '';
        grupos.forEach(g => {
            nuevoEquipoGrupo.innerHTML += `<option value="${attrSeguro(g)}">Grupo ${attrSeguro(g)}</option>`;
        });
        nuevoEquipoGrupo.innerHTML += `<option value="Unico">Tabla Única</option>`;
    }

    if (nuevoEquipoCiclo) nuevoEquipoCiclo.addEventListener('change', actualizarSelectorGruposFormulario);

    if (formNuevoEquipo) {
        formNuevoEquipo.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nuevo-equipo-nombre').value.trim();
            const ciclo = nuevoEquipoCiclo.value;
            const grupo = nuevoEquipoGrupo.value;

            recargarPools();
            const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
            if (pool.some(eq => eq.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
                alert('Ya existe un equipo con ese nombre.');
                return;
            }

            pool.push({
                id: Date.now(),
                nombre: nombre,
                grupo: grupo,
                pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0,
                jugadores: []
            });

            guardarEquiposEnStorage();
            registrarHistorial('jugador', `creó el equipo ${nombre} en ${textoGrupoHistorial(grupo)} (${nombreCicloHistorial(ciclo)})`);
            formNuevoEquipo.reset();
            actualizarSelectorGruposFormulario();
            actualizarComboEquiposPlantel(nombre);
            actualizarOpcionesMoverEquipo();
            alert(`Equipo ${nombre} registrado en el Grupo ${grupo}.`);
        });
    }

    // Gestor de Grupos
    const gestorCiclo = document.getElementById('gestor-grupos-ciclo');
    const inptNuevoGrupo = document.getElementById('nuevo-grupo-nombre');
    const btnAgregarGrupo = document.getElementById('btn-agregar-grupo');
    const contenedorListaGrupos = document.getElementById('lista-grupos');

    function renderizarListaGruposAdmin() {
        if (!contenedorListaGrupos || !gestorCiclo) return;
        const ciclo = gestorCiclo.value;
        const grupos = gruposTorneo[ciclo] || [];

        contenedorListaGrupos.innerHTML = '';

        if (grupos.length === 0) {
            contenedorListaGrupos.innerHTML = '<span style="font-size:11px; color:#869bd8;">No hay grupos creados para este ciclo.</span>';
            return;
        }

        grupos.forEach(g => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:3px; border-left:3px solid #f2c00e;';
            item.innerHTML = `
                <span style="font-size:12px; color:#fff;">Grupo <strong>${attrSeguro(g)}</strong></span>
                <button class="btn-borrar-grupo-item" data-grupo="${attrSeguro(g)}" style="background:#991b1b; color:#fff; border:none; border-radius:2px; padding:3px 8px; cursor:pointer; font-size:10px;">Eliminar</button>
            `;
            contenedorListaGrupos.appendChild(item);
        });

        document.querySelectorAll('.btn-borrar-grupo-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const grupoABorrar = btn.getAttribute('data-grupo');
                if (confirm(`¿Estás seguro de eliminar el Grupo ${grupoABorrar}?`)) {
                    gruposTorneo[ciclo] = gruposTorneo[ciclo].filter(g => g !== grupoABorrar);
                    guardarGruposEnStorage();
                    renderizarListaGruposAdmin();
                    actualizarSelectorGruposFormulario();
                    actualizarOpcionesMoverEquipo();
                    actualizarOpcionesGrupo();
                }
            });
        });
    }

    if (btnAgregarGrupo) {
        btnAgregarGrupo.addEventListener('click', () => {
            const nombre = inptNuevoGrupo.value.trim().toUpperCase();
            const ciclo = gestorCiclo.value;

            if (!nombre) {
                alert('Ingresá una letra o nombre para el grupo.');
                return;
            }

            if (gruposTorneo[ciclo].includes(nombre)) {
                alert('Ese grupo ya existe en este ciclo.');
                return;
            }

            gruposTorneo[ciclo].push(nombre);
            guardarGruposEnStorage();
            inptNuevoGrupo.value = '';

            renderizarListaGruposAdmin();
            actualizarSelectorGruposFormulario();
            actualizarOpcionesMoverEquipo();
            actualizarOpcionesGrupo();
            alert(`Grupo ${nombre} agregado con éxito.`);
        });
    }

    if (gestorCiclo) gestorCiclo.addEventListener('change', renderizarListaGruposAdmin);

    // Mover Equipos de Grupo
    const moverCiclo = document.getElementById('mover-equipo-ciclo');
    const moverEquipoSelect = document.getElementById('mover-equipo-select');
    const moverNuevoGrupo = document.getElementById('mover-equipo-nuevo-grupo');
    const btnMoverEquipo = document.getElementById('btn-mover-equipo');

    function actualizarOpcionesMoverEquipo() {
        if (!moverCiclo || !moverEquipoSelect || !moverNuevoGrupo) return;
        recargarPools();
        const ciclo = moverCiclo.value;
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const grupos = gruposTorneo[ciclo] || [];

        moverEquipoSelect.innerHTML = '';
        if (pool.length === 0) {
            moverEquipoSelect.innerHTML = '<option value="">Sin equipos cargados</option>';
        } else {
            pool.sort((a, b) => a.nombre.localeCompare(b.nombre));
            pool.forEach(eq => {
                const grpLabel = eq.grupo === 'Unico' ? 'Tabla Única' : `Grupo ${eq.grupo || 'A'}`;
                moverEquipoSelect.innerHTML += `<option value="${attrSeguro(eq.nombre)}">${attrSeguro(eq.nombre)} (${attrSeguro(grpLabel)})</option>`;
            });
        }

        moverNuevoGrupo.innerHTML = '';
        grupos.forEach(g => {
            moverNuevoGrupo.innerHTML += `<option value="${attrSeguro(g)}">Grupo ${attrSeguro(g)}</option>`;
        });
        moverNuevoGrupo.innerHTML += `<option value="Unico">Tabla Única</option>`;
    }

    if (moverCiclo) moverCiclo.addEventListener('change', actualizarOpcionesMoverEquipo);

    if (btnMoverEquipo) {
        btnMoverEquipo.addEventListener('click', () => {
            const ciclo = moverCiclo.value;
            const equipoNombre = moverEquipoSelect.value;
            const nuevoGrupoVal = moverNuevoGrupo.value;

            if (!equipoNombre) {
                alert('Seleccioná un equipo para mover.');
                return;
            }

            recargarPools();
            const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
            const equipoObj = pool.find(e => e.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());

            if (equipoObj) {
                const grupoAnterior = equipoObj.grupo;
                equipoObj.grupo = nuevoGrupoVal;
                guardarEquiposEnStorage();
                if (grupoAnterior !== nuevoGrupoVal) registrarHistorial('jugador', `pasó a ${equipoObj.nombre} de ${textoGrupoHistorial(grupoAnterior)} a ${textoGrupoHistorial(nuevoGrupoVal)} (${nombreCicloHistorial(ciclo)})`);
                actualizarOpcionesMoverEquipo();
                actualizarOpcionesGrupo();
                alert(`¡${equipoNombre} fue movido al Grupo ${nuevoGrupoVal} exitosamente!`);
            }
        });
    }

    // Jugadores y Planteles
    const plantelCiclo = document.getElementById('plantel-ciclo');
    const plantelEquipoSelect = document.getElementById('plantel-equipo-select');
    const formJugador = document.getElementById('form-jugador');
    const tablaJugadoresBody = document.getElementById('tabla-jugadores-body');
    const tituloListaPlantel = document.getElementById('titulo-lista-plantel');
    const tituloFormJugador = document.getElementById('titulo-form-jugador');
    const btnSubmitJugador = document.getElementById('btn-submit-jugador');
    const btnCancelarEdicionJugador = document.getElementById('btn-cancelar-edicion-jugador');

    let jugadorEnEdicionDNI = null;

    function cancelarEdicionJugador() {
        jugadorEnEdicionDNI = null;
        if (tituloFormJugador) tituloFormJugador.textContent = 'Añadir Jugador';
        if (btnSubmitJugador) {
            btnSubmitJugador.textContent = 'AGREGAR JUGADOR';
            btnSubmitJugador.style.background = '#1a3274';
            btnSubmitJugador.style.borderColor = '#2edae3';
        }
        if (btnCancelarEdicionJugador) btnCancelarEdicionJugador.classList.add('seccion-oculta-staff');
        limpiarFormularioJugador();
    }

    function limpiarFormularioJugador() {
        document.getElementById('jugador-nombre').value = '';
        document.getElementById('jugador-dni').value = '';
        document.getElementById('jugador-dorsal').value = '';
        document.getElementById('jugador-instagram').value = '';
        if (document.getElementById('jugador-foto')) document.getElementById('jugador-foto').value = '';
        fotoJugadorSubida.limpiar();
        if (document.getElementById('jugador-nacimiento')) document.getElementById('jugador-nacimiento').value = '';
        if (document.getElementById('jugador-celular')) document.getElementById('jugador-celular').value = '';
        if (document.getElementById('jugador-concurrir')) document.getElementById('jugador-concurrir').value = '';
        if (document.getElementById('jugador-concurrir-dir')) document.getElementById('jugador-concurrir-dir').value = '';
        if (document.getElementById('jugador-medico')) document.getElementById('jugador-medico').value = '';
        if (document.getElementById('jugador-medico-dir')) document.getElementById('jugador-medico-dir').value = '';
        if (document.getElementById('jugador-familiar-nombre')) document.getElementById('jugador-familiar-nombre').value = '';
        if (document.getElementById('jugador-familiar-parentesco')) document.getElementById('jugador-familiar-parentesco').value = '';
        if (document.getElementById('jugador-familiar-tel')) document.getElementById('jugador-familiar-tel').value = '';
    }

    if (btnCancelarEdicionJugador) btnCancelarEdicionJugador.addEventListener('click', cancelarEdicionJugador);

    function actualizarComboEquiposPlantel(equipoASeleccionar = null) {
        if (!plantelEquipoSelect) return;
        recargarPools();
        const ciclo = plantelCiclo ? plantelCiclo.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;

        plantelEquipoSelect.innerHTML = '';

        if (!pool || pool.length === 0) {
            plantelEquipoSelect.innerHTML = '<option value="">Sin equipos cargados</option>';
            renderizarTablaJugadores();
            return;
        }

        pool.sort((a, b) => a.nombre.localeCompare(b.nombre));
        pool.forEach(eq => {
            plantelEquipoSelect.innerHTML += `<option value="${attrSeguro(eq.nombre)}">${attrSeguro(eq.nombre)}</option>`;
        });

        if (equipoASeleccionar) {
            plantelEquipoSelect.value = equipoASeleccionar;
        }

        renderizarTablaJugadores();
    }

    if (plantelCiclo) plantelCiclo.addEventListener('change', () => {
        cancelarEdicionJugador();
        actualizarComboEquiposPlantel();
    });
    if (plantelEquipoSelect) plantelEquipoSelect.addEventListener('change', () => {
        cancelarEdicionJugador();
        renderizarTablaJugadores();
    });

    // Otras acciones vuelven a leer los equipos del almacén (recargarPools) y dejan viejos los objetos con los que
    // se dibujó la tabla: por eso cada botón busca el equipo y el jugador actuales al momento del clic.
    function buscarJugadorPlantel(ciclo, equipoNombre, dni) {
        recargarPools();
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const equipo = (pool || []).find(e => e.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());
        const jugador = equipo ? (equipo.jugadores || []).find(j => String(j.dni) === dni) : undefined;
        return { equipo, jugador };
    }

    // Los partidos y las sanciones reconocen al jugador por su DNI (asistencia, tarjetas, goles, suspensión) y sus goles
    // también muestran la etiqueta 'Nombre (#N)'. Al corregir esos datos hay que reescribirlos ahí también: si no,
    // pierde PJ, tarjetas, suspensión y goles de sus partidos.
    function propagarCambioJugador(equipo, antes, despues) {
        const cambioDni = String(antes.dni) !== String(despues.dni);
        const cambioNombreODorsal = antes.nombre !== despues.nombre || String(antes.dorsal) !== String(despues.dorsal);
        if (!cambioDni && !cambioNombreODorsal) return;

        const etiquetaAntes = `${antes.nombre} (#${antes.dorsal})`;
        const etiquetaDespues = `${despues.nombre} (#${despues.dorsal})`;
        const nombreEquipo = equipo.nombre.trim().toLowerCase();
        const esDelEquipo = (nombre, id) => (equipo.id != null && id === equipo.id) || (nombre || '').trim().toLowerCase() === nombreEquipo;
        const camposConDni = ['asistentesLocal', 'asistentesVisitante', 'amarillasLocal', 'rojasLocal', 'amarillasVisitante', 'rojasVisitante'];
        const ladosGoles = [['local', 'localId', 'goleadoresLocal'], ['visitante', 'visitanteId', 'goleadoresVisitante']];

        let partidosTocados = false;
        partidos.forEach(p => {
            if (cambioDni) {
                camposConDni.forEach(campo => {
                    if (!Array.isArray(p[campo])) return;
                    p[campo] = p[campo].map(id => {
                        if (String(id) !== String(antes.dni)) return id;
                        partidosTocados = true;
                        return despues.dni;
                    });
                });
            }
            ladosGoles.forEach(([lado, ladoId, campo]) => {
                if (!Array.isArray(p[campo]) || !esDelEquipo(p[lado], p[ladoId])) return;
                p[campo].forEach(g => {
                    const esEl = g.id != null ? String(g.id) === String(antes.dni) : g.nombre === etiquetaAntes;
                    if (!esEl) return;
                    if (cambioNombreODorsal && g.nombre !== etiquetaDespues) { g.nombre = etiquetaDespues; partidosTocados = true; }
                    if (cambioDni && g.id != null) { g.id = despues.dni; partidosTocados = true; }
                });
            });
        });
        if (partidosTocados) almacen.setItem('liga_partidos', JSON.stringify(partidos));

        let sancionesTocadas = false;
        listaSanciones.forEach(s => {
            if (!s.jugadorId || String(s.jugadorId) !== String(antes.dni)) return;
            s.jugadorId = despues.dni;
            s.jugador = `${despues.nombre} (${dorsalBF(despues)})`;
            sancionesTocadas = true;
        });
        if (sancionesTocadas) almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
    }

    function renderizarTablaJugadores() {
        if (!tablaJugadoresBody || !plantelEquipoSelect) return;
        recargarPools();
        const ciclo = plantelCiclo ? plantelCiclo.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const equipoNombre = plantelEquipoSelect.value;

        tablaJugadoresBody.innerHTML = '';

        if (!equipoNombre) {
            tablaJugadoresBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#869bd8; padding:15px;">Selecciona un equipo para ver su plantel.</td></tr>';
            return;
        }

        const equipoObj = pool.find(e => e.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());

        if (tituloListaPlantel) tituloListaPlantel.textContent = `Lista de Buena Fe — ${equipoNombre}`;

        if (!equipoObj || !equipoObj.jugadores || equipoObj.jugadores.length === 0) {
            tablaJugadoresBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#869bd8; padding:15px;">Sin jugadores en la Lista de Buena Fe.</td></tr>';
            return;
        }

        equipoObj.jugadores.forEach((j, idx) => {
            const esFichaEntregada = j.fichaMedica === 'si';
            const igTexto = j.instagram ? `@${attrSeguro(j.instagram.replace('@',''))}` : '-';

            tablaJugadoresBody.innerHTML += `
                <tr>
                    <td style="color:#2edae3; font-weight:bold;">${dorsalBF(j)}</td>
                    <td style="font-weight:bold; color:#fff;" title="${attrSeguro(j.nombre)}">${attrSeguro(j.nombre)}</td>
                    <td>${attrSeguro(j.dni || '-')}</td>
                    <td style="color:#4284f2;" title="${igTexto}">${igTexto}</td>
                    <td>
                        <button type="button" class="btn-toggle-ficha" data-dni="${attrSeguro(j.dni)}" style="background:transparent; border:none; cursor:pointer; font-size:10px; font-weight:bold; color:${esFichaEntregada ? '#4ade80' : '#f43f5e'};" title="Cambiar estado ficha">
                            ${esFichaEntregada ? 'OK' : 'Debe'}
                        </button>
                    </td>
                    <td>
                        <div style="display:flex; gap:3px; justify-content:center;">
                            <button type="button" class="btn-accion-plantel btn-editar-jugador" data-dni="${attrSeguro(j.dni)}" style="background:#0284c7; color:white; border:none; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Editar">Editar</button>
                            <button type="button" class="btn-accion-plantel btn-ver-emergencia" data-dni="${attrSeguro(j.dni)}" style="background:#1a3274; border:1px solid #2edae3; color:#2edae3; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Emergencia">SOS</button>
                            <button type="button" class="btn-accion-plantel btn-borrar-jugador" data-dni="${attrSeguro(j.dni)}" data-nombre="${attrSeguro(j.nombre)}" style="background:#991b1b; color:white; border:none; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Eliminar">Baja</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Eventos
        document.querySelectorAll('.btn-toggle-ficha').forEach(btn => {
            btn.addEventListener('click', () => {
                const { jugador } = buscarJugadorPlantel(ciclo, equipoNombre, btn.getAttribute('data-dni'));
                if (jugador) {
                    jugador.fichaMedica = jugador.fichaMedica === 'si' ? 'no' : 'si';
                    guardarEquiposEnStorage();
                    renderizarTablaJugadores();
                }
            });
        });

        document.querySelectorAll('.btn-editar-jugador').forEach(btn => {
            btn.addEventListener('click', () => {
                const { jugador: j } = buscarJugadorPlantel(ciclo, equipoNombre, btn.getAttribute('data-dni'));
                if (j) {
                    jugadorEnEdicionDNI = j.dni;
                    document.getElementById('jugador-nombre').value = j.nombre || '';
                    document.getElementById('jugador-dni').value = j.dni || '';
                    document.getElementById('jugador-dorsal').value = j.dorsal ?? '';
                    document.getElementById('jugador-instagram').value = j.instagram || '';
                    if (document.getElementById('jugador-foto')) {
                        // Una foto subida (URL de Cloudinary, o dataURL de antes del cambio) va a la
                        // vista previa, no al campo de texto.
                        const esSubida = /^(data:|https:\/\/res\.cloudinary\.com\/)/.test(j.foto || '');
                        document.getElementById('jugador-foto').value = esSubida ? '' : (j.foto || '');
                        if (esSubida) fotoJugadorSubida.mostrar(j.foto);
                        else fotoJugadorSubida.limpiar();
                    }
                    if (document.getElementById('jugador-ficha-medica')) document.getElementById('jugador-ficha-medica').value = j.fichaMedica || 'no';
                    if (document.getElementById('jugador-nacimiento')) document.getElementById('jugador-nacimiento').value = j.nacimiento || '';
                    if (document.getElementById('jugador-celular')) document.getElementById('jugador-celular').value = j.celular || '';
                    if (document.getElementById('jugador-concurrir')) document.getElementById('jugador-concurrir').value = j.concurrir || '';
                    if (document.getElementById('jugador-concurrir-dir')) document.getElementById('jugador-concurrir-dir').value = j.concurrirDir || '';
                    if (document.getElementById('jugador-medico')) document.getElementById('jugador-medico').value = j.medico || '';
                    if (document.getElementById('jugador-medico-dir')) document.getElementById('jugador-medico-dir').value = j.medicoDir || '';
                    if (document.getElementById('jugador-familiar-nombre')) document.getElementById('jugador-familiar-nombre').value = j.familiarNombre || '';
                    if (document.getElementById('jugador-familiar-parentesco')) document.getElementById('jugador-familiar-parentesco').value = j.familiarParentesco || '';
                    if (document.getElementById('jugador-familiar-tel')) document.getElementById('jugador-familiar-tel').value = j.familiarTel || '';

                    const detailsEl = document.querySelector('#form-jugador details');
                    if (detailsEl && (j.familiarTel || j.concurrir || j.medico)) detailsEl.open = true;

                    if (tituloFormJugador) tituloFormJugador.textContent = `Editando a: ${j.nombre}`;
                    if (btnSubmitJugador) {
                        btnSubmitJugador.textContent = 'ACTUALIZAR DATOS';
                        btnSubmitJugador.style.background = '#0284c7';
                        btnSubmitJugador.style.borderColor = '#23b1f0';
                    }
                    if (btnCancelarEdicionJugador) btnCancelarEdicionJugador.classList.remove('seccion-oculta-staff');
                }
            });
        });

        document.querySelectorAll('.btn-ver-emergencia').forEach(btn => {
            btn.addEventListener('click', () => {
                const { jugador: j } = buscarJugadorPlantel(ciclo, equipoNombre, btn.getAttribute('data-dni'));
                if (j) abrirModalEmergencia(j, equipoNombre);
            });
        });

        document.querySelectorAll('.btn-borrar-jugador').forEach(btn => {
            btn.addEventListener('click', () => {
                const dni = btn.getAttribute('data-dni');
                const nombre = btn.getAttribute('data-nombre') || 'este jugador';

                if (!confirm(`PASO 1: ¿Estás seguro de que deseas eliminar a ${nombre}?`)) return;
                if (!confirm(`PASO 2 DE SEGURIDAD:\nEsta acción borrará permanentemente la ficha de ${nombre}.\n\n¿Confirmar?`)) return;

                const { equipo, jugador } = buscarJugadorPlantel(ciclo, equipoNombre, dni);
                if (!equipo) {
                    alert('No se encontró el equipo en los planteles: no se eliminó nada.');
                    return;
                }
                equipo.jugadores = (equipo.jugadores || []).filter(j => String(j.dni) !== dni);
                guardarEquiposEnStorage();
                registrarHistorial('jugador', `dio de baja a ${jugador ? textoJugadorHistorial(jugador) : nombre} de ${equipo.nombre}`);
                if (jugadorEnEdicionDNI === dni) cancelarEdicionJugador();
                renderizarTablaJugadores();
                alert(`La ficha de ${nombre} fue eliminada.`);
            });
        });
    }

    if (formJugador) {
        formJugador.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Antes de leer los planteles: si no, un guardado durante la subida quedaría sobre una copia vieja.
            const foto = await subirImagen(fotoJugadorSubida.imagen || (document.getElementById('jugador-foto') ? document.getElementById('jugador-foto').value.trim() : ''), btnSubmitJugador);
            if (foto === null) return;
            if (fotoJugadorSubida.imagen) fotoJugadorSubida.imagen = foto;

            recargarPools();
            const ciclo = plantelCiclo.value;
            const equipoNombre = plantelEquipoSelect.value;
            const pool = ciclo === 'superior' ? poolSuperior : poolBasico;

            const equipoObj = pool.find(eq => eq.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());
            if (!equipoObj) {
                alert('Selecciona un equipo válido.');
                return;
            }

            if (!equipoObj.jugadores) equipoObj.jugadores = [];

            const dorsalTxt = document.getElementById('jugador-dorsal').value.trim();
            const dorsalNum = Number(dorsalTxt);
            if (dorsalTxt === '' || !Number.isInteger(dorsalNum) || dorsalNum < 0 || dorsalNum > 99) {
                alert('El número de camiseta es obligatorio y va de 0 a 99.');
                return;
            }

            const jugadorEditado = jugadorEnEdicionDNI !== null ? equipoObj.jugadores.find(j => j.dni === jugadorEnEdicionDNI) : null;
            const validacion = validarJugadorEnTorneo(equipoObj, document.getElementById('jugador-dni').value.trim(), dorsalNum, jugadorEditado);
            if (validacion.error) {
                alert(validacion.error);
                return;
            }
            const traslado = validacion.traslado;
            if (traslado && !confirm(textoConfirmarTraslado(traslado, equipoObj))) return;

            const datosJugador = {
                nombre: document.getElementById('jugador-nombre').value.trim(),
                dni: document.getElementById('jugador-dni').value.trim(),
                dorsal: dorsalNum,
                instagram: document.getElementById('jugador-instagram').value.trim(),
                foto: foto,
                fichaMedica: document.getElementById('jugador-ficha-medica') ? document.getElementById('jugador-ficha-medica').value : 'no',
                nacimiento: document.getElementById('jugador-nacimiento') ? document.getElementById('jugador-nacimiento').value : '',
                celular: document.getElementById('jugador-celular') ? document.getElementById('jugador-celular').value.trim() : '',
                concurrir: document.getElementById('jugador-concurrir') ? document.getElementById('jugador-concurrir').value.trim() : '',
                concurrirDir: document.getElementById('jugador-concurrir-dir') ? document.getElementById('jugador-concurrir-dir').value.trim() : '',
                medico: document.getElementById('jugador-medico') ? document.getElementById('jugador-medico').value.trim() : '',
                medicoDir: document.getElementById('jugador-medico-dir') ? document.getElementById('jugador-medico-dir').value.trim() : '',
                familiarNombre: document.getElementById('jugador-familiar-nombre') ? document.getElementById('jugador-familiar-nombre').value.trim() : '',
                familiarParentesco: document.getElementById('jugador-familiar-parentesco') ? document.getElementById('jugador-familiar-parentesco').value.trim() : '',
                familiarTel: document.getElementById('jugador-familiar-tel') ? document.getElementById('jugador-familiar-tel').value.trim() : ''
            };

            if (jugadorEnEdicionDNI !== null) {
                const indice = equipoObj.jugadores.findIndex(j => j.dni === jugadorEnEdicionDNI);
                if (indice !== -1) {
                    const antes = equipoObj.jugadores[indice];
                    const despues = { ...antes, ...datosJugador };
                    equipoObj.jugadores[indice] = despues;
                    propagarCambioJugador(equipoObj, antes, despues);
                    const textoEdicion = textoEdicionJugadorHistorial(antes, despues, equipoObj.nombre);
                    if (textoEdicion) registrarHistorial('jugador', textoEdicion);
                    alert(`¡Ficha de ${datosJugador.nombre} actualizada correctamente!`);
                }
                cancelarEdicionJugador();
            } else {
                let nuevo = { ...datosJugador, goles: 0, amarillas: 0, rojas: 0 };
                if (traslado) {
                    traslado.equipo.jugadores = traslado.equipo.jugadores.filter(j => j !== traslado.jugador);
                    nuevo = { ...traslado.jugador, ...datosJugador, foto: datosJugador.foto || traslado.jugador.foto || '' };
                }
                equipoObj.jugadores.push(nuevo);
                registrarHistorial('jugador', traslado
                    ? `pasó a ${textoJugadorHistorial(nuevo)} de ${traslado.equipo.nombre} a ${equipoObj.nombre}`
                    : `dio de alta a ${textoJugadorHistorial(nuevo)} en ${equipoObj.nombre}`);
                alert(`¡${datosJugador.nombre} añadido a ${equipoNombre}!`);
                limpiarFormularioJugador();
            }

            guardarEquiposEnStorage();
            actualizarComboEquiposPlantel(equipoNombre);
        });
    }

    // Borrar Equipo Completo
    const btnEliminarEquipoCompleto = document.getElementById('btn-eliminar-equipo-completo');
    if (btnEliminarEquipoCompleto) {
        btnEliminarEquipoCompleto.addEventListener('click', () => {
            const ciclo = plantelCiclo.value;
            const equipoNombre = plantelEquipoSelect.value;

            if (!equipoNombre) {
                alert('No hay ningún equipo seleccionado para eliminar.');
                return;
            }

            if (confirm(`¿Estás seguro de eliminar completamente al equipo "${equipoNombre}" y a todos sus jugadores del torneo?`)) {
                const equipoBorrado = (ciclo === 'superior' ? poolSuperior : poolBasico).find(e => e.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());
                const cantidadBorrada = equipoBorrado && equipoBorrado.jugadores ? equipoBorrado.jugadores.length : 0;
                if (ciclo === 'superior') {
                    poolSuperior = poolSuperior.filter(e => e.nombre.trim().toLowerCase() !== equipoNombre.trim().toLowerCase());
                } else {
                    poolBasico = poolBasico.filter(e => e.nombre.trim().toLowerCase() !== equipoNombre.trim().toLowerCase());
                }

                guardarEquiposEnStorage();
                registrarHistorial('jugador', `eliminó el equipo ${equipoNombre} (${nombreCicloHistorial(ciclo)}) con sus ${cantidadBorrada} ${cantidadBorrada === 1 ? 'jugador' : 'jugadores'}`);
                actualizarComboEquiposPlantel();
                actualizarOpcionesMoverEquipo();
                actualizarOpcionesGrupo();
                alert(`Equipo "${equipoNombre}" eliminado.`);
            }
        });
    }

    // ── Importar la planilla de inscripción de un equipo (Excel, CSV o PDF) ──
    // El equipo es el elegido en "Equipo Destino": varias planillas llegan sin el nombre (decisión de Joaquín, 01/10/2026).
    // Nada se guarda hasta "Confirmar importación": antes se ve una vista previa editable, y cada fila pasa por
    // validarJugadorEnTorneo (contra lo ya guardado) y por el control de repetidos dentro del mismo archivo.
    // Las librerías se descargan recién al subir un archivo. SheetJS sale de su CDN oficial porque la versión de cdnjs
    // tiene fallas conocidas al leer archivos armados a propósito (y las planillas las mandan los equipos); pdf.js va en
    // su versión "legacy", que anda en celulares más viejos.
    const URL_SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    const SRI_SHEETJS = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
    const URL_PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/pdf.min.mjs';
    const URL_PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/pdf.worker.min.mjs';
    const ESPERA_LIBRERIA_MS = 30000;

    const btnImportarPlanilla = document.getElementById('btn-importar-planilla');
    const inputPlanilla = document.getElementById('importar-planilla-archivo');
    const estadoLecturaPlanilla = document.getElementById('importar-planilla-estado');
    const panelImportacion = document.getElementById('importar-vista-previa');
    let importacion = null;

    function conPlazo(promesa) {
        return Promise.race([promesa, new Promise((_, reject) => setTimeout(() => reject(new Error('sin respuesta')), ESPERA_LIBRERIA_MS))]);
    }

    // Marca los errores de descarga de una librería: en ese caso el problema es la conexión, no el archivo.
    const errorDeLector = e => Object.assign(e instanceof Error ? e : new Error(String(e)), { sinLector: true });

    let promesaSheetJS = null;
    function cargarSheetJS() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (!promesaSheetJS) {
            promesaSheetJS = conPlazo(new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = URL_SHEETJS;
                script.integrity = SRI_SHEETJS;
                script.crossOrigin = 'anonymous';
                script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('no cargó')));
                script.onerror = () => reject(new Error('no cargó'));
                document.head.appendChild(script);
            })).catch(e => { promesaSheetJS = null; throw errorDeLector(e); });
        }
        return promesaSheetJS;
    }

    let promesaPdfJs = null;
    function cargarPdfJs() {
        if (!promesaPdfJs) {
            promesaPdfJs = conPlazo(import(URL_PDFJS)).then(pdfjs => {
                pdfjs.GlobalWorkerOptions.workerSrc = URL_PDFJS_WORKER;
                return pdfjs;
            }).catch(e => { promesaPdfJs = null; throw errorDeLector(e); });
        }
        return promesaPdfJs;
    }

    const normalizarTitulo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

    // Títulos de la planilla de inscripción (Clausura 2026): NOMBRE Y APELLIDO, DNI, FECHA DE NAC., CELULAR, INSTAGRAM y
    // DORSAL CAMISETA. Se reconocen por el texto, no por la posición; el orden importa ("NÚMERO DE DNI" es el DNI).
    const COLUMNAS_PLANILLA = [
        ['dni', /\b(DNI|DOCUMENTO)\b/],
        ['dorsal', /\b(DORSAL|CAMISETA|NUMERO|NRO)\b/],
        ['nacimiento', /\bNAC/],
        ['instagram', /\b(INSTAGRAM|INSTA|IG)\b/],
        ['celular', /\b(CELULAR|CEL|TELEFONO|TEL)\b/],
        ['nombre', /\b(NOMBRE|APELLIDO|JUGADOR)/]
    ];

    function campoDeTitulo(texto) {
        const t = normalizarTitulo(texto);
        const hallado = t && COLUMNAS_PLANILLA.find(([, patron]) => patron.test(t));
        return hallado ? hallado[0] : null;
    }

    // Lo que llega en el archivo lo escribió cada equipo: se sacan < y > (ningún dato del jugador los usa) para que
    // no termine como HTML en las tablas del panel o de la web.
    function textoCelda(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    }

    const textoOpcional = v => { const t = textoCelda(v); return /^[-–—.\s]*$/.test(t) ? '' : t; };

    function textoDni(v) {
        if (typeof v === 'number') return String(Math.round(v));
        const t = textoCelda(v);
        const digitos = t.replace(/[.,\s-]/g, '');
        return /^\d+$/.test(digitos) ? digitos : t;
    }

    function textoDorsal(v) {
        if (typeof v === 'number') return String(v);
        return textoCelda(v).replace(/^(N[°º.]?|#)\s*(?=\d)/i, '');
    }

    // En Excel la fecha es un número de días (desde 1899-12-30, o desde 1904 en libros viejos de Mac); en un CSV o un PDF,
    // texto como "18/2/2010". Queda como AAAA-MM-DD, igual que el campo de fecha del formulario.
    function fechaDePlanilla(v, fecha1904) {
        if (v === null || v === undefined || v === '') return { nacimiento: '' };
        let y, m, d;
        if (typeof v === 'number') {
            const fecha = new Date(Date.UTC(1899, 11, 30) + (Math.floor(v) + (fecha1904 ? 1462 : 0)) * 86400000);
            [y, m, d] = [fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate()];
        } else {
            const t = textoCelda(v);
            let p = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
            if (p) [y, m, d] = [+p[1], +p[2], +p[3]];
            else if ((p = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
                [d, m, y] = [+p[1], +p[2], +p[3]];
                if (m > 12 && d <= 12) [d, m] = [m, d];
                if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
            }
        }
        const fecha = y ? new Date(Date.UTC(y, m - 1, d)) : null;
        if (!fecha || fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
            return { nacimiento: '', nacimientoLeido: textoCelda(v) };
        }
        return { nacimiento: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }

    // De una tabla ya leída (filas × celdas) saca los jugadores: busca la fila de títulos y toma las de abajo.
    function jugadoresDeTabla(tabla, fecha1904) {
        const iTitulos = tabla.findIndex(fila => {
            const campos = fila.map(campoDeTitulo);
            return campos.includes('nombre') && campos.includes('dni');
        });
        if (iTitulos === -1) {
            return { error: 'No se encontró la fila de títulos de la planilla (NOMBRE Y APELLIDO, DNI, FECHA DE NAC., CELULAR, INSTAGRAM, DORSAL CAMISETA).' };
        }
        const columnas = {};
        tabla[iTitulos].forEach((celda, i) => {
            const campo = campoDeTitulo(celda);
            if (campo === 'nombre') (columnas.nombre = columnas.nombre || []).push(i);
            else if (campo && !columnas[campo]) columnas[campo] = [i];
        });
        const curso = tabla.slice(0, iTitulos)
            .map(fila => fila.map(textoCelda).filter(Boolean).join(' '))
            .find(t => /^(CURSO|EQUIPO)\b/.test(normalizarTitulo(t))) || '';

        const filas = [];
        tabla.slice(iTitulos + 1).forEach(fila => {
            const celda = campo => (columnas[campo] ? fila[columnas[campo][0]] : '');
            const nombre = (columnas.nombre || []).map(i => textoCelda(fila[i])).filter(Boolean).join(' ').replace(/^\d{1,3}\s*[).:-]\s*/, '');
            const jugador = {
                nombre,
                dni: textoDni(celda('dni')),
                dorsal: textoDorsal(celda('dorsal')),
                ...fechaDePlanilla(celda('nacimiento'), fecha1904),
                celular: textoOpcional(celda('celular')),
                instagram: textoOpcional(celda('instagram')).replace(/^@+/, '')
            };
            // Una fila sin nombre ni DNI es un renglón vacío de la planilla (o el número de página de un PDF).
            if (!jugador.nombre && soloDigitosDni(jugador.dni).length < 5) return;
            filas.push(jugador);
        });
        return { filas, curso };
    }

    // Excel en castellano guarda el CSV común en Windows-1252: leído como UTF-8, las tildes y la ñ se rompen.
    function textoDeCsv(datos) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(datos); }
        catch (e) { return new TextDecoder('windows-1252').decode(datos); }
    }

    async function leerPlanillaExcel(archivo, esCsv) {
        const XLSX = await cargarSheetJS();
        const datos = await archivo.arrayBuffer();
        const libro = esCsv ? XLSX.read(textoDeCsv(datos), { type: 'string', raw: true }) : XLSX.read(datos, { type: 'array' });
        const fecha1904 = !!(libro.Workbook && libro.Workbook.WBProps && libro.Workbook.WBProps.date1904);
        let resultado = jugadoresDeTabla([], fecha1904);
        for (const hoja of libro.SheetNames) {
            resultado = jugadoresDeTabla(XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, raw: true, defval: '' }), fecha1904);
            if (!resultado.error) break;
        }
        return resultado;
    }

    // Un PDF no tiene celdas, solo textos con su posición: se arman los renglones por altura, y cada texto va a la columna
    // cuyo título tiene más cerca en horizontal (en la planilla todas las celdas están centradas). Lo que cae fuera de los
    // títulos (la numeración "1)" de la izquierda) se descarta.
    function renglonesDePdf(items) {
        const renglones = [];
        [...items].sort((a, b) => b.y - a.y || a.x - b.x).forEach(item => {
            const actual = renglones[renglones.length - 1];
            if (actual && Math.abs(actual.y - item.y) <= Math.max(2, 0.45 * Math.min(actual.alto, item.alto))) actual.items.push(item);
            else renglones.push({ y: item.y, alto: item.alto, items: [item] });
        });
        renglones.forEach(r => r.items.sort((a, b) => a.x - b.x));
        return renglones;
    }

    function unirTextosPdf(items) {
        return items.reduce((texto, item, i) => {
            const anterior = items[i - 1];
            const separado = anterior && item.x - (anterior.x + anterior.ancho) > 0.15 * item.alto;
            return texto + (separado ? ' ' : '') + item.texto;
        }, '');
    }

    function columnasDeTitulos(renglones, iTitulo) {
        const titulo = renglones[iTitulo];
        const banda = renglones.filter(r => Math.abs(r.y - titulo.y) < titulo.alto).flatMap(r => r.items);
        const columnas = [];
        [...banda].sort((a, b) => a.x - b.x).forEach(item => {
            const ultima = columnas[columnas.length - 1];
            if (ultima && item.x <= ultima.x1 + 0.6 * item.alto) {
                ultima.items.push(item);
                ultima.x1 = Math.max(ultima.x1, item.x + item.ancho);
            } else {
                columnas.push({ x0: item.x, x1: item.x + item.ancho, items: [item] });
            }
        });
        columnas.forEach(c => {
            c.centro = (c.x0 + c.x1) / 2;
            c.texto = renglonesDePdf(c.items).map(r => unirTextosPdf(r.items)).join(' ');
        });
        return { columnas, banda: new Set(banda) };
    }

    function tablaDePdf(paginas) {
        const tabla = [];
        let columnas = null;
        paginas.forEach(items => {
            const renglones = renglonesDePdf(items);
            const iTitulo = renglones.findIndex(r => {
                const t = normalizarTitulo(r.items.map(i => i.texto).join(' '));
                return /\b(DNI|DOCUMENTO)\b/.test(t) && /\b(NOMBRE|APELLIDO|JUGADOR)/.test(t);
            });
            let enTitulos = new Set();
            if (iTitulo !== -1) {
                const encontrado = columnasDeTitulos(renglones, iTitulo);
                if (!columnas) {
                    renglones.slice(0, iTitulo).filter(r => !r.items.some(i => encontrado.banda.has(i)))
                        .forEach(r => tabla.push([unirTextosPdf(r.items)]));
                    tabla.push(encontrado.columnas.map(c => c.texto));
                }
                columnas = encontrado.columnas;
                enTitulos = encontrado.banda;
            }
            if (!columnas) return;
            const desde = iTitulo === -1 ? 0 : iTitulo;
            renglones.slice(desde).filter(r => !r.items.some(i => enTitulos.has(i))).forEach(r => {
                const celdas = columnas.map(() => []);
                const n = columnas.length;
                const izquierda = n > 1 ? columnas[0].centro - (columnas[1].centro - columnas[0].centro) / 2 : -Infinity;
                const derecha = n > 1 ? columnas[n - 1].centro + (columnas[n - 1].centro - columnas[n - 2].centro) / 2 : Infinity;
                r.items.forEach(item => {
                    const centro = item.x + item.ancho / 2;
                    if (centro < izquierda || centro > derecha) return;
                    let mejor = 0;
                    columnas.forEach((c, i) => { if (Math.abs(c.centro - centro) < Math.abs(columnas[mejor].centro - centro)) mejor = i; });
                    celdas[mejor].push(item);
                });
                tabla.push(celdas.map(unirTextosPdf));
            });
        });
        return tabla;
    }

    async function leerPlanillaPdf(archivo) {
        const pdfjs = await cargarPdfJs();
        const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()), isEvalSupported: false });
        const paginas = [];
        try {
            const pdf = await tarea.promise;
            for (let n = 1; n <= pdf.numPages; n++) {
                const contenido = await (await pdf.getPage(n)).getTextContent();
                paginas.push(contenido.items.filter(it => it.str && it.str.trim()).map(it => ({
                    texto: it.str, x: it.transform[4], y: it.transform[5], ancho: it.width,
                    alto: Math.abs(it.height) || Math.hypot(it.transform[2], it.transform[3]) || 10
                })));
            }
        } finally {
            tarea.destroy();
        }
        if (!paginas.some(p => p.length)) {
            return { error: 'Este PDF no tiene texto: es una foto o un escaneo de la planilla, y eso no se puede leer. Pedile al equipo el Excel, o cargá los jugadores a mano.' };
        }
        const resultado = jugadoresDeTabla(tablaDePdf(paginas), false);
        if (!resultado.error) resultado.desdePdf = true;
        return resultado;
    }

    async function leerPlanilla(archivo) {
        const nombre = (archivo.name || '').toLowerCase();
        if (/\.pdf$/.test(nombre) || archivo.type === 'application/pdf') return leerPlanillaPdf(archivo);
        if (/\.(xlsx|xlsm|xls|ods)$/.test(nombre)) return leerPlanillaExcel(archivo, false);
        if (/\.(csv|txt)$/.test(nombre)) return leerPlanillaExcel(archivo, true);
        return { error: 'Ese archivo no es una planilla: subí el Excel (.xlsx o .xls), un .csv o un PDF.' };
    }

    function mostrarEstadoLectura(texto, esError) {
        if (!estadoLecturaPlanilla) return;
        estadoLecturaPlanilla.textContent = texto;
        estadoLecturaPlanilla.classList.toggle('importar-lectura-error', !!esError);
    }

    // El destino se toma de "Ciclo" y "Equipo Destino" al subir la planilla, y cambia solo si se tocan esos dos.
    // (Otras acciones también cambian el equipo elegido, sin aviso: la importación no se tiene que ir a otro equipo.)
    function destinoElegido() {
        return { ciclo: plantelCiclo ? plantelCiclo.value : 'superior', nombre: plantelEquipoSelect ? plantelEquipoSelect.value : '' };
    }

    function equipoDestinoImportacion() {
        const { ciclo, nombre } = importacion.destino;
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const equipo = nombre ? (pool || []).find(e => e.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()) : null;
        return equipo ? { equipo, ciclo } : null;
    }

    const clavePase = hallado => `${hallado.ciclo}|${hallado.equipo.nombre}`;
    const dorsalDeFila = f => {
        const t = String(f.dorsal).trim();
        const n = Number(t);
        return t !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
    };

    // Marca con "error" las filas que repiten un valor de otra fila del archivo (validarJugadorEnTorneo solo compara
    // contra lo ya guardado, no contra las filas que se están por importar).
    function marcarRepetidosEnArchivo(filas, valorDe, mensaje) {
        const porValor = new Map();
        filas.forEach(f => {
            const v = valorDe(f);
            if (v === '' || v === null) return;
            porValor.set(v, [...(porValor.get(v) || []), f]);
        });
        porValor.forEach(grupo => {
            if (grupo.length < 2) return;
            grupo.forEach(f => f.errores.push(mensaje(f, grupo.filter(o => o !== f).map(o => o.n).join(', '))));
        });
    }

    // Se valida todo junto (los repetidos dependen de las demás filas) y contra los planteles recién leídos.
    function validarImportacion() {
        recargarPools();
        const destino = equipoDestinoImportacion();
        const activas = importacion.filas.filter(f => !f.quitada);
        activas.forEach(f => {
            f.errores = []; f.avisos = []; f.traslado = null; f.existente = null;
            const digitos = soloDigitosDni(f.dni);
            if (!f.nombre.trim()) f.errores.push('Falta el nombre.');
            if (!digitos) f.errores.push('Falta el DNI.');
            else if (digitos.length < 7 || digitos.length > 8) f.avisos.push(`Revisá el DNI: tiene ${digitos.length} ${digitos.length === 1 ? 'número' : 'números'}.`);
            if (String(f.dorsal).trim() === '') f.errores.push('Falta el número de camiseta (0 a 99).');
            else if (dorsalDeFila(f) === null) f.errores.push('El número de camiseta va de 0 a 99.');
            if (f.nacimientoLeido && !f.nacimiento) f.avisos.push(`No se entendió la fecha de nacimiento «${f.nacimientoLeido}»: completala si la tenés.`);
            const hallado = destino && digitos ? buscarDniEnTorneo(f.dni, null) : null;
            if (hallado && hallado.equipo === destino.equipo) f.existente = hallado.jugador;
        });
        const nuevas = activas.filter(f => !f.existente);
        marcarRepetidosEnArchivo(nuevas, f => soloDigitosDni(f.dni), (f, otras) => `DNI repetido en la planilla (también en la fila ${otras}).`);
        marcarRepetidosEnArchivo(nuevas, dorsalDeFila, (f, otras) => `Número ${dorsalDeFila(f)} repetido en la planilla (también en la fila ${otras}).`);
        if (destino) {
            nuevas.filter(f => f.errores.length === 0).forEach(f => {
                const validacion = validarJugadorEnTorneo(destino.equipo, f.dni, dorsalDeFila(f), null);
                if (validacion.error) f.errores.push(validacion.error);
                else if (validacion.traslado) f.traslado = validacion.traslado;
            });
        }
        activas.forEach(f => {
            f.estado = f.existente ? 'existe'
                : f.errores.length ? 'error'
                : f.traslado ? (f.pase === clavePase(f.traslado) ? 'pase' : 'pase-pendiente')
                : 'ok';
        });
        return { destino, activas };
    }

    function htmlEstadoFila(f, destino) {
        const lista = (mensajes, clase) => mensajes.length ? `<ul class="${clase}">${mensajes.map(m => `<li>${attrSeguro(m)}</li>`).join('')}</ul>` : '';
        let html = '';
        if (f.estado === 'existe') {
            html = `<p class="importar-msj-existe">Ya está en este equipo como ${attrSeguro(textoJugadorHistorial(f.existente))}: no se vuelve a cargar. Si cambió algún dato, editalo desde la lista.</p>`;
        } else if (f.estado === 'error') {
            html = lista(f.errores, 'importar-msj-errores');
        } else if (f.traslado) {
            const origen = `${f.traslado.equipo.nombre} (${nombreCicloHistorial(f.traslado.ciclo)})`;
            html = `<p class="importar-msj-pase">${attrSeguro(f.traslado.jugador.nombre)} está inscripto en ${attrSeguro(origen)} y todavía no jugó ningún partido con ese equipo.</p>
                <label class="importar-pase"><input type="checkbox" class="importar-pase-check">
                <span>Pasarlo a ${attrSeguro(destino ? destino.equipo.nombre : 'este equipo')} (se lo saca de ${attrSeguro(f.traslado.equipo.nombre)} y conserva su ficha)</span></label>`;
        } else {
            html = '<span class="importar-chip-ok">Listo para importar</span>';
        }
        return html + (f.estado === 'existe' ? '' : lista(f.avisos, 'importar-msj-avisos'));
    }

    function htmlFilaImportacion(f) {
        const campo = (clave, etiqueta, extra = '') => `
            <label class="importar-campo importar-c-${clave}"><span class="importar-etiqueta">${etiqueta}</span>
                <input class="importar-input" data-campo="${clave}" value="${attrSeguro(f[clave])}" ${extra}></label>`;
        return `
            <div class="importar-fila" data-n="${f.n}">
                <span class="importar-num"><span class="importar-etiqueta">Fila </span>${f.n}</span>
                ${campo('nombre', 'Nombre y apellido', 'type="text" autocomplete="off"')}
                ${campo('dni', 'DNI', 'type="text" inputmode="numeric" autocomplete="off"')}
                ${campo('dorsal', 'N° camiseta', 'type="text" inputmode="numeric" maxlength="3" autocomplete="off"')}
                ${campo('nacimiento', 'Nacimiento', 'type="date"')}
                ${campo('celular', 'Celular', 'type="text" inputmode="tel" autocomplete="off"')}
                ${campo('instagram', 'Instagram', 'type="text" autocomplete="off"')}
                <button type="button" class="importar-quitar" data-accion="quitar">Quitar</button>
                <div class="importar-estado"></div>
            </div>`;
    }

    function renderizarImportacion() {
        if (!panelImportacion || !importacion) return;
        const origen = [`Archivo: <strong>${attrSeguro(importacion.archivo)}</strong>`];
        if (importacion.curso) origen.push(`la planilla dice «${attrSeguro(importacion.curso)}»`);
        panelImportacion.innerHTML = `
            <h3 class="importar-titulo">Vista previa de la importación</h3>
            <p class="importar-origen">${origen.join(' · ')}</p>
            <p class="importar-destino"></p>
            ${importacion.desdePdf ? '<p class="importar-nota importar-nota-pdf">Leído desde un PDF: revisá que cada dato haya quedado en su columna.</p>' : ''}
            <p class="importar-nota">Todavía no se guardó nada. Podés corregir cualquier dato acá mismo (por ejemplo, agregarle «(C)» al nombre del capitán) y se vuelve a revisar al tipear.</p>
            <div class="importar-encabezado" aria-hidden="true">
                <span>#</span><span>Nombre y apellido</span><span>DNI</span><span>N°</span><span>Nacimiento</span><span>Celular</span><span>Instagram</span><span></span>
            </div>
            <div class="importar-filas">${importacion.filas.map(htmlFilaImportacion).join('')}</div>
            <p class="importar-resumen" aria-live="polite"></p>
            <p class="importar-bloqueo"></p>
            <div class="importar-botones">
                <button type="button" class="importar-btn-cancelar" data-accion="cancelar">Cancelar</button>
                <button type="button" class="btn-submit-admin importar-btn-confirmar" data-accion="confirmar">Confirmar importación</button>
            </div>`;
        panelImportacion.classList.remove('seccion-oculta-staff');
        actualizarImportacion();
    }

    // Actualiza los estados y el resumen sin redibujar los campos (no se pierde el foco mientras se tipea).
    function actualizarImportacion() {
        if (!panelImportacion || !importacion) return { bloqueo: 'No hay ninguna importación abierta.' };
        const { destino, activas } = validarImportacion();
        activas.forEach(f => {
            const fila = panelImportacion.querySelector(`.importar-fila[data-n="${f.n}"]`);
            if (!fila) return;
            const html = htmlEstadoFila(f, destino);
            const caja = fila.querySelector('.importar-estado');
            if (caja.dataset.html !== html) { caja.innerHTML = html; caja.dataset.html = html; }
            const check = caja.querySelector('.importar-pase-check');
            if (check) check.checked = f.estado === 'pase';
            fila.className = `importar-fila importar-fila-${f.estado}`;
        });

        const cuenta = estado => activas.filter(f => f.estado === estado).length;
        const importables = activas.filter(f => f.estado === 'ok' || f.estado === 'pase');
        const [conError, pendientes, existentes] = [cuenta('error'), cuenta('pase-pendiente'), cuenta('existe')];
        const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
        const sinDestino = importacion.destino.nombre
            ? `El equipo ${importacion.destino.nombre} ya no está en los planteles: elegí el equipo destino arriba, en "Equipo Destino".`
            : 'Elegí el equipo destino arriba, en "Equipo Destino".';
        let bloqueo = '';
        if (!destino) bloqueo = sinDestino;
        else if (conError) bloqueo = `Corregí o quitá ${conError === 1 ? 'la fila con error' : `las ${conError} filas con error`} para poder importar.`;
        else if (pendientes) bloqueo = `Confirmá o quitá ${pendientes === 1 ? 'el pase' : `los ${pendientes} pases`} desde otro equipo.`;
        else if (!importables.length) bloqueo = 'No hay jugadores nuevos para importar.';

        const total = destino ? (destino.equipo.jugadores || []).length + importables.length : 0;
        panelImportacion.querySelector('.importar-destino').innerHTML = destino
            ? `Destino: <strong>${attrSeguro(destino.equipo.nombre)}</strong> (${nombreCicloHistorial(destino.ciclo)}), hoy con ${plural((destino.equipo.jugadores || []).length, 'jugador', 'jugadores')}.`
                + (total > MAX_JUGADORES_LISTA ? ` <span class="importar-aviso-tope">Con esta importación quedaría con ${total} y el reglamento permite ${MAX_JUGADORES_LISTA} en la lista.</span>` : '')
            : `<span class="importar-aviso-tope">${attrSeguro(sinDestino)}</span>`;
        const partes = [`${importables.length} para importar`];
        if (conError) partes.push(`${conError} con error`);
        if (pendientes) partes.push(plural(pendientes, 'pase sin confirmar', 'pases sin confirmar'));
        if (existentes) partes.push(plural(existentes, 'ya cargado', 'ya cargados'));
        panelImportacion.querySelector('.importar-resumen').textContent = `${plural(activas.length, 'fila', 'filas')}: ${partes.join(' · ')}.`;
        panelImportacion.querySelector('.importar-bloqueo').textContent = bloqueo;
        const btnConfirmar = panelImportacion.querySelector('.importar-btn-confirmar');
        btnConfirmar.disabled = !!bloqueo;
        btnConfirmar.textContent = importables.length ? `Confirmar importación (${plural(importables.length, 'jugador', 'jugadores')})` : 'Confirmar importación';
        return { bloqueo, destino, importables, total };
    }

    function cerrarImportacion() {
        importacion = null;
        if (panelImportacion) {
            panelImportacion.innerHTML = '';
            panelImportacion.classList.add('seccion-oculta-staff');
        }
    }

    function confirmarImportacion() {
        const { bloqueo, destino, importables, total } = actualizarImportacion();
        if (bloqueo) { alert(bloqueo); return; }
        const equipo = destino.equipo;
        if (total > MAX_JUGADORES_LISTA && !confirm(`${equipo.nombre} va a quedar con ${total} jugadores y el reglamento permite un máximo de ${MAX_JUGADORES_LISTA} en la lista. ¿Importar igual?`)) return;
        if (!equipo.jugadores) equipo.jugadores = [];

        const altas = [];
        const pases = [];
        importables.forEach(f => {
            const datos = {
                nombre: textoCelda(f.nombre), dorsal: dorsalDeFila(f), nacimiento: f.nacimiento || '',
                celular: textoCelda(f.celular), instagram: textoCelda(f.instagram).replace(/^@+/, '')
            };
            if (f.traslado) {
                // Como en el alta a mano: conserva DNI, foto, ficha médica y contactos; de la planilla toma lo que trae.
                const t = f.traslado;
                t.equipo.jugadores = t.equipo.jugadores.filter(j => j !== t.jugador);
                const pasado = { ...t.jugador, nombre: datos.nombre, dorsal: datos.dorsal };
                ['nacimiento', 'celular', 'instagram'].forEach(c => { if (datos[c]) pasado[c] = datos[c]; });
                equipo.jugadores.push(pasado);
                pases.push({ jugador: pasado, origen: t.equipo.nombre });
                return;
            }
            const nuevo = {
                nombre: datos.nombre, dni: textoCelda(f.dni), dorsal: datos.dorsal,
                instagram: datos.instagram, foto: '', fichaMedica: 'no', nacimiento: datos.nacimiento, celular: datos.celular,
                concurrir: '', concurrirDir: '', medico: '', medicoDir: '',
                familiarNombre: '', familiarParentesco: '', familiarTel: '',
                goles: 0, amarillas: 0, rojas: 0
            };
            equipo.jugadores.push(nuevo);
            altas.push(nuevo);
        });
        guardarEquiposEnStorage();
        if (altas.length) {
            registrarHistorial('jugador', `importó ${altas.length} ${altas.length === 1 ? 'jugador' : 'jugadores'} a ${equipo.nombre} desde la planilla de inscripción: ${altas.map(textoJugadorHistorial).join(', ')}`);
        }
        pases.forEach(p => registrarHistorial('jugador', `pasó a ${textoJugadorHistorial(p.jugador)} de ${p.origen} a ${equipo.nombre} (desde la planilla de inscripción)`));

        cerrarImportacion();
        mostrarEstadoLectura('');
        actualizarComboEquiposPlantel(equipo.nombre);
        renderizarResumenStaff();
        alert(`Se ${importables.length === 1 ? 'importó 1 jugador' : `importaron ${importables.length} jugadores`} a ${equipo.nombre}.`);
    }

    if (btnImportarPlanilla && inputPlanilla && panelImportacion) {
        btnImportarPlanilla.addEventListener('click', () => {
            if (!plantelEquipoSelect || !plantelEquipoSelect.value) {
                alert('Primero creá o elegí el equipo en "Equipo Destino": la planilla se carga en ese equipo.');
                return;
            }
            if (importacion && importacion.editada && !confirm('Ya hay una importación abierta con cambios. ¿Descartarla y subir otra planilla?')) return;
            inputPlanilla.value = '';
            inputPlanilla.click();
        });

        inputPlanilla.addEventListener('change', async () => {
            const archivo = inputPlanilla.files && inputPlanilla.files[0];
            if (!archivo) return;
            const destino = destinoElegido();
            btnImportarPlanilla.disabled = true;
            mostrarEstadoLectura('Leyendo la planilla...');
            let resultado;
            try {
                resultado = await leerPlanilla(archivo);
            } catch (e) {
                // El worker de pdf.js se descarga recién al abrir el PDF: si falla, también es la conexión.
                const sinLector = !!(e && (e.sinLector || /fake worker|dynamically imported module/i.test(e.message)));
                resultado = { error: sinLector
                    ? 'No se pudo descargar el lector de planillas: hace falta conexión a internet. Probá de nuevo con señal.'
                    : 'No se pudo leer el archivo: puede estar dañado o tener contraseña. Probá abrirlo y guardarlo de nuevo, o pedile otra copia al equipo.' };
            } finally {
                btnImportarPlanilla.disabled = false;
                inputPlanilla.value = '';
            }
            if (resultado.error) { mostrarEstadoLectura(resultado.error, true); return; }
            if (!resultado.filas.length) { mostrarEstadoLectura('La planilla no tiene jugadores cargados debajo de los títulos.', true); return; }
            mostrarEstadoLectura(`Planilla leída: ${resultado.filas.length} ${resultado.filas.length === 1 ? 'fila' : 'filas'}. Revisalas en la vista previa de abajo.`);
            importacion = {
                archivo: archivo.name, curso: resultado.curso, desdePdf: !!resultado.desdePdf, editada: false, destino,
                filas: resultado.filas.map((f, i) => ({ n: i + 1, nacimientoLeido: '', ...f, quitada: false, pase: null }))
            };
            renderizarImportacion();
            panelImportacion.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        panelImportacion.addEventListener('input', (e) => {
            const input = e.target.closest('.importar-input');
            const filaEl = input && input.closest('.importar-fila');
            if (!filaEl || !importacion) return;
            const fila = importacion.filas.find(f => String(f.n) === filaEl.dataset.n);
            fila[input.dataset.campo] = input.value;
            if (input.dataset.campo === 'nacimiento') fila.nacimientoLeido = '';
            importacion.editada = true;
            actualizarImportacion();
        });

        panelImportacion.addEventListener('change', (e) => {
            const check = e.target.closest('.importar-pase-check');
            const filaEl = check && check.closest('.importar-fila');
            if (!filaEl || !importacion) return;
            const fila = importacion.filas.find(f => String(f.n) === filaEl.dataset.n);
            fila.pase = check.checked && fila.traslado ? clavePase(fila.traslado) : null;
            importacion.editada = true;
            actualizarImportacion();
        });

        panelImportacion.addEventListener('click', (e) => {
            const boton = e.target.closest('[data-accion]');
            if (!boton || !importacion) return;
            if (boton.dataset.accion === 'quitar') {
                const filaEl = boton.closest('.importar-fila');
                importacion.filas.find(f => String(f.n) === filaEl.dataset.n).quitada = true;
                importacion.editada = true;
                filaEl.remove();
                actualizarImportacion();
            } else if (boton.dataset.accion === 'cancelar') {
                if (importacion.editada && !confirm('¿Descartar la importación? No se guardó nada.')) return;
                cerrarImportacion();
                mostrarEstadoLectura('');
            } else if (boton.dataset.accion === 'confirmar') {
                confirmarImportacion();
            }
        });

        // Cambiar el ciclo o el equipo con la vista previa abierta la pasa a ese equipo (por si se eligió mal).
        [plantelCiclo, plantelEquipoSelect].forEach(select => {
            if (select) select.addEventListener('change', () => {
                if (!importacion) return;
                importacion.destino = destinoElegido();
                actualizarImportacion();
            });
        });
    }

    // Modal de Emergencia
    const modalEmergencia = document.getElementById('modal-emergencia');
    const btnCerrarEmergencia = document.getElementById('btn-cerrar-modal-emergencia');

    function abrirModalEmergencia(j, equipoNombre) {
        const modal = document.getElementById('modal-emergencia');
        if (!modal) return;

        const titulo = document.getElementById('emergencia-modal-titulo');
        const body = document.getElementById('emergencia-modal-body');

        if (titulo) titulo.textContent = `Ficha Médica — ${j.nombre}`;

        if (body) {
            body.innerHTML = `
                <div style="background:rgba(4, 12, 38,0.8); padding:10px; border-radius:3px; border:1px solid #1a3274; margin-bottom:10px;">
                    <p style="margin:3px 0;"><strong>Equipo:</strong> ${attrSeguro(equipoNombre)} (${dorsalBF(j)})</p>
                    <p style="margin:3px 0;"><strong>DNI:</strong> ${attrSeguro(j.dni || 'Sin datos')}</p>
                    <p style="margin:3px 0;"><strong>F. Nacimiento:</strong> ${attrSeguro(j.nacimiento || 'Sin datos')}</p>
                    <p style="margin:3px 0;"><strong>Celular Jugador:</strong> ${attrSeguro(j.celular || 'Sin datos')}</p>
                    <p style="margin:3px 0;"><strong>Ficha Médica:</strong> ${j.fichaMedica === 'si' ? 'Entregada y Firmada' : 'Pendiente'}</p>
                </div>

                <div style="background:rgba(244,63,94,0.1); padding:10px; border-radius:3px; border:1px solid rgba(244,63,94,0.3); margin-bottom:10px;">
                    <p style="margin:0 0 6px 0; color:#f43f5e; font-weight:bold; font-size:10px;">EN CASO DE EMERGENCIA AVISAR A:</p>
                    <p style="margin:3px 0;"><strong>Nombre:</strong> ${attrSeguro(j.familiarNombre || 'No especificado')}</p>
                    <p style="margin:3px 0;"><strong>Parentesco:</strong> ${attrSeguro(j.familiarParentesco || 'No especificado')}</p>
                    <p style="margin:3px 0; font-size:12px; color:#4ade80;"><strong>Teléfono:</strong> ${attrSeguro(j.familiarTel || 'Sin teléfono')}</p>
                </div>

                <div style="background:rgba(242, 192, 14,0.08); padding:10px; border-radius:3px; border:1px solid rgba(242, 192, 14,0.2);">
                    <p style="margin:0 0 6px 0; color:#f2c00e; font-weight:bold; font-size:10px;">CENTRO DE SALUD / MÉDICO:</p>
                    <p style="margin:3px 0;"><strong>Concurrir a:</strong> ${attrSeguro(j.concurrir || 'Hospital más cercano')} (${attrSeguro(j.concurrirDir || 'Sin dirección')})</p>
                    <p style="margin:3px 0;"><strong>Médico:</strong> ${attrSeguro(j.medico || 'No especificado')} (${attrSeguro(j.medicoDir || 'Sin dirección/tel')})</p>
                </div>
            `;
        }

        modal.classList.remove('seccion-oculta');
    }

    if (btnCerrarEmergencia) btnCerrarEmergencia.addEventListener('click', () => {
        if (modalEmergencia) modalEmergencia.classList.add('seccion-oculta');
    });

    document.addEventListener('click', (e) => {
        if (modalEmergencia && e.target === modalEmergencia) modalEmergencia.classList.add('seccion-oculta');
    });

    // ============================================================
    // 5. MÓDULO TRIBUNAL DE DISCIPLINA
    // ============================================================
    const formSancion = document.getElementById('form-sancion');
    const sancionCiclo = document.getElementById('sancion-ciclo');
    const sancionEquipo = document.getElementById('sancion-equipo');
    const submitBtnSancion = document.getElementById('btn-submit-sancion');
    const tituloFormSancion = document.getElementById('titulo-form-sancion');
    let idSancionEnEdicion = null;

    function actualizarEquiposSancion() {
        if (!sancionEquipo || !sancionCiclo) return;
        recargarPools();
        const ciclo = sancionCiclo.value;
        sancionEquipo.innerHTML = '';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;

        if (!pool || pool.length === 0) {
            sancionEquipo.innerHTML = '<option value="">Sin equipos registrados</option>';
            actualizarJugadoresSancion();
            return;
        }

        pool.sort((a, b) => a.nombre.localeCompare(b.nombre));
        pool.forEach(e => {
            sancionEquipo.innerHTML += `<option value="${attrSeguro(e.nombre.trim())}">${attrSeguro(e.nombre.trim())}</option>`;
        });
        actualizarJugadoresSancion();
    }

    // El jugador de una sanción se elige de la lista del equipo: así la sanción queda vinculada al jugador (por su DNI)
    // y la lista de buena fe puede avisar cuando está suspendido.
    function actualizarJugadoresSancion() {
        const selectJugador = document.getElementById('sancion-jugador-id');
        if (!selectJugador || !sancionEquipo || !sancionCiclo) return;
        const pool = sancionCiclo.value === 'superior' ? poolSuperior : poolBasico;
        const equipo = (pool || []).find(e => e.nombre.trim().toLowerCase() === (sancionEquipo.value || '').trim().toLowerCase());
        const jugadores = (equipo && equipo.jugadores) || [];
        selectJugador.innerHTML = '<option value="">Sin jugador (sanción al equipo)</option>' +
            jugadores.map(j => `<option value="${attrSeguro(j.dni)}">${dorsalBF(j)} ${attrSeguro(j.nombre)}</option>`).join('');
    }

    if (sancionCiclo) sancionCiclo.addEventListener('change', actualizarEquiposSancion);
    if (sancionEquipo) sancionEquipo.addEventListener('change', actualizarJugadoresSancion);

    function actualizarListaSancionesAdmin() {
        const contenedor = document.getElementById('lista-sanciones-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaSanciones.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay resoluciones registradas.</p>';
            return;
        }

        listaSanciones.forEach(s => {
            const detalleJugador = s.jugador ? ` — ${attrSeguro(s.jugador)}` : '';
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(225,29,72,0.05); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid ${s.levantada ? '#4ade80' : '#ef4444'};">
                    <div style="text-align:left; max-width: 75%;">
                        <span style="font-size:10px; color:#f43f5e; display:block; text-transform:uppercase;">ACTA N° ${s.acta || 1} (${s.ciclo ? s.ciclo.toUpperCase() : 'SUPERIOR'}) — ${s.tipo || 'Sanción'}${s.origenAuto ? ' · AUTOMÁTICA (Tesorería)' : ''}</span>
                        <span style="font-size:12px; color:white; font-weight:bold;">${attrSeguro(s.equipo)}${detalleJugador}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block; margin-top:2px;">${attrSeguro(s.motivo || 'Sin motivo detallado')}</span>
                        ${s.levantada ? `<span style="font-size:10px; color:#4ade80; display:block; margin-top:2px;">(${attrSeguro(s.fechaLevantada)}) Quita levantada: pagó el 50%</span>` : ''}
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-editar-sancion" data-id="${s.id}" style="background-color:#1a3274; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Editar</button>
                        <button class="btn-borrar-sancion" data-id="${s.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-sancion').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                const sancionBorrada = listaSanciones.find(s => s.id === idBorrar);
                desvincularSancionAuto(sancionBorrada);
                listaSanciones = listaSanciones.filter(s => s.id !== idBorrar);
                almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
                if (sancionBorrada) registrarHistorial('sancion', `eliminó la resolución del ${textoHistorialSancion(sancionBorrada)}`);
                if (idSancionEnEdicion === idBorrar) cancelarEdicionSancion();
                actualizarListaSancionesAdmin();
            });
        });

        document.querySelectorAll('.btn-editar-sancion').forEach(btn => {
            btn.addEventListener('click', () => {
                const idEditar = parseInt(btn.getAttribute('data-id'));
                const s = listaSanciones.find(sanc => sanc.id === idEditar);
                if (s) {
                    idSancionEnEdicion = s.id;
                    if (document.getElementById('sancion-acta-num')) document.getElementById('sancion-acta-num').value = s.acta || 1;
                    sancionCiclo.value = s.ciclo || 'superior';
                    actualizarEquiposSancion();
                    sancionEquipo.value = s.equipo;
                    actualizarJugadoresSancion();
                    if (document.getElementById('sancion-jugador-id')) document.getElementById('sancion-jugador-id').value = s.jugadorId || '';
                    if (document.getElementById('sancion-tipo')) document.getElementById('sancion-tipo').value = s.tipo || 'Sanción Disciplinaria';
                    if (document.getElementById('sancion-puntos')) document.getElementById('sancion-puntos').value = s.puntosRestados || 0;
                    if (document.getElementById('sancion-motivo')) document.getElementById('sancion-motivo').value = s.motivo || '';

                    if (submitBtnSancion) {
                        submitBtnSancion.textContent = 'ACTUALIZAR RESOLUCIÓN';
                        submitBtnSancion.style.background = '#d97706';
                        submitBtnSancion.style.borderColor = '#f59e0b';
                    }
                    if (tituloFormSancion) tituloFormSancion.textContent = 'Editar Acta / Sanción';
                }
            });
        });
    }

    function cancelarEdicionSancion() {
        idSancionEnEdicion = null;
        if (formSancion) formSancion.reset();
        actualizarEquiposSancion();
        if (submitBtnSancion) {
            submitBtnSancion.textContent = 'PUBLICAR RESOLUCIÓN TRIBUNAL';
            submitBtnSancion.style.background = '#991b1b';
            submitBtnSancion.style.borderColor = '#f43f5e';
        }
        if (tituloFormSancion) tituloFormSancion.textContent = 'Emitir Acta / Registrar Sanción';
    }

    if (formSancion) {
        formSancion.addEventListener('submit', (e) => {
            e.preventDefault();

            recargarPools();
            const poolSancion = sancionCiclo.value === 'superior' ? poolSuperior : poolBasico;
            const equipoObjSancion = poolSancion.find(eq => eq.nombre.trim().toLowerCase() === sancionEquipo.value.trim().toLowerCase());

            const dniSancionado = document.getElementById('sancion-jugador-id') ? document.getElementById('sancion-jugador-id').value : '';
            const jugadorSancionado = dniSancionado && equipoObjSancion ? (equipoObjSancion.jugadores || []).find(j => j.dni === dniSancionado) : null;

            const datosSancion = {
                acta: document.getElementById('sancion-acta-num') ? document.getElementById('sancion-acta-num').value : 1,
                ciclo: sancionCiclo.value,
                equipo: sancionEquipo.value,
                equipoId: equipoObjSancion ? equipoObjSancion.id : null, // Referencia estable: sobrevive si el nombre del equipo se corrige más adelante
                jugador: jugadorSancionado ? `${jugadorSancionado.nombre} (${dorsalBF(jugadorSancionado)})` : '',
                jugadorId: jugadorSancionado ? jugadorSancionado.dni : '',
                tipo: document.getElementById('sancion-tipo') ? document.getElementById('sancion-tipo').value : 'Sanción Disciplinaria',
                puntosRestados: document.getElementById('sancion-puntos') ? parseInt(document.getElementById('sancion-puntos').value) : 0,
                motivo: document.getElementById('sancion-motivo') ? document.getElementById('sancion-motivo').value.trim() : ''
            };

            if (isNaN(datosSancion.puntosRestados) || datosSancion.puntosRestados <= 0) {
                if (datosSancion.tipo === 'Advertencia / Acta') {
                    datosSancion.puntosRestados = 0;
                } else {
                    const queFalta = datosSancion.tipo === 'Quita de Puntos' ? 'cuántos puntos se restan' : 'cuántas fechas dura la suspensión';
                    alert(`Falta la cantidad: indicá ${queFalta}.`);
                    return;
                }
            }

            if (idSancionEnEdicion !== null) {
                listaSanciones = listaSanciones.map(s => {
                    if (s.id !== idSancionEnEdicion) return s;
                    const editada = { ...s, ...datosSancion };
                    if (s.origenAuto) { desvincularSancionAuto(s); editada.origenAuto = false; } // Editada a mano: deja de ser automática
                    if (editada.levantada && editada.puntosRestados > 0) editada.levantada = false;
                    return editada;
                });
                alert('¡Resolución actualizada correctamente!');
            } else {
                listaSanciones.push({ id: Date.now(), ...datosSancion });
                alert(`¡Resolución publicada en el Acta N° ${datosSancion.acta}!`);
            }

            almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
            registrarHistorial('sancion', `${idSancionEnEdicion !== null ? 'editó la resolución del' : 'emitió el'} ${textoHistorialSancion(datosSancion)}`);
            cancelarEdicionSancion();
            actualizarListaSancionesAdmin();
        });
    }

    // ============================================================
    // 6. MÓDULO PRENSA Y NOTICIAS HERO 3D
    // ============================================================
    const formNoticia = document.getElementById('form-noticia-admin');

    function actualizarListaNoticiasAdmin() {
        const contenedor = document.getElementById('lista-noticias-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaNoticias.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay noticias personalizadas.</p>';
            return;
        }

        listaNoticias.forEach(n => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(46, 218, 227,0.05); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid #2edae3;">
                    <div style="text-align:left; max-width: 80%;">
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${attrSeguro(n.titulo)}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block;">${attrSeguro(n.texto)}</span>
                    </div>
                    <button class="btn-borrar-noticia" data-id="${n.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-noticia').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaNoticias = listaNoticias.filter(n => n.id !== idBorrar);
                almacen.setItem('liga_noticias', JSON.stringify(listaNoticias));
                actualizarListaNoticiasAdmin();
            });
        });
    }

    if (formNoticia) {
        formNoticia.addEventListener('submit', async (e) => {
            e.preventDefault();
            // La foto puede venir de una ruta escrita a mano o de un archivo subido (ya comprimido).
            const fotoElegida = fotoNoticiaSubida.imagen || document.getElementById('noticia-foto').value.trim();
            if (!fotoElegida) {
                alert('Falta la foto de la noticia: pegá una ruta/URL o subí un archivo.');
                return;
            }
            const fotoNoticia = await subirImagen(fotoElegida, formNoticia.querySelector('button[type="submit"]'));
            if (fotoNoticia === null) return;

            const nuevaNoticia = {
                id: Date.now(),
                titulo: document.getElementById('noticia-titulo').value.trim(),
                texto: document.getElementById('noticia-texto').value.trim(),
                foto: fotoNoticia,
                linkUrl: document.getElementById('noticia-link-url').value.trim(),
                linkTexto: document.getElementById('noticia-link-texto').value.trim() || 'VER MÁS'
            };

            listaNoticias.push(nuevaNoticia);
            almacen.setItem('liga_noticias', JSON.stringify(listaNoticias));

            formNoticia.reset();
            fotoNoticiaSubida.limpiar();
            actualizarListaNoticiasAdmin();
            alert('¡Noticia guardada con éxito!');
        });
    }

    // ============================================================
    // 6.0 MÓDULO ÁLBUMES DE FOTOS
    // ============================================================
    let listaFotosAlbumes = JSON.parse(almacen.getItem('liga_fotos_albumes')) || (typeof ligaData !== 'undefined' && ligaData.fotosAlbumes ? ligaData.fotosAlbumes : []);
    const formFotos = document.getElementById('form-fotos-admin');

    function actualizarListaFotosAdmin() {
        const contenedor = document.getElementById('lista-fotos-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaFotosAlbumes.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay álbumes publicados.</p>';
            return;
        }

        listaFotosAlbumes.forEach(a => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(37,99,235,0.05); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid #4284f2;">
                    <div style="text-align:left; max-width: 80%;">
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${attrSeguro(a.titulo)}</span>
                        <span style="font-size:10px; color:#869bd8; display:block;">${attrSeguro(a.link)}</span>
                    </div>
                    <button class="btn-borrar-album" data-id="${a.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-album').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaFotosAlbumes = listaFotosAlbumes.filter(a => a.id !== idBorrar);
                almacen.setItem('liga_fotos_albumes', JSON.stringify(listaFotosAlbumes));
                actualizarListaFotosAdmin();
            });
        });
    }

    if (formFotos) {
        formFotos.addEventListener('submit', async (e) => {
            e.preventDefault();
            const portadaElegida = portadaAlbumSubida.imagen || document.getElementById('foto-album-portada').value.trim();
            if (!portadaElegida) {
                alert('Falta la foto de portada: pegá una ruta/URL o subí un archivo.');
                return;
            }
            const portada = await subirImagen(portadaElegida, formFotos.querySelector('button[type="submit"]'));
            if (portada === null) return;

            const nuevoAlbum = {
                id: Date.now(),
                titulo: document.getElementById('foto-album-titulo').value.trim(),
                portada: portada,
                link: document.getElementById('foto-album-link').value.trim()
            };

            listaFotosAlbumes.push(nuevoAlbum);
            almacen.setItem('liga_fotos_albumes', JSON.stringify(listaFotosAlbumes));
            formFotos.reset();
            portadaAlbumSubida.limpiar();
            actualizarListaFotosAdmin();
            alert('¡Álbum publicado con éxito!');
        });
    }

    actualizarListaFotosAdmin();

    // ============================================================
    // 6.1 GESTOR DE SPONSORS (CRUD completo, editable desde Prensa & Fotos)
    // ============================================================
    let listaSponsors = JSON.parse(almacen.getItem('liga_sponsors')) || (typeof ligaData !== 'undefined' && ligaData.sponsors ? ligaData.sponsors : []);

    function guardarSponsorsEnStorage() {
        almacen.setItem('liga_sponsors', JSON.stringify(listaSponsors));
    }

    const formSponsor = document.getElementById('form-sponsor-admin');
    const inputSponsorLogoFile = document.getElementById('sponsor-logo-file');
    const previewSponsorWrap = document.getElementById('sponsor-logo-preview-wrap');
    const previewSponsorImg = document.getElementById('sponsor-logo-preview');
    const btnCancelarEdicionSponsor = document.getElementById('btn-cancelar-edicion-sponsor');
    const btnSubmitSponsor = document.getElementById('btn-submit-sponsor');
    const tituloFormSponsor = document.getElementById('titulo-form-sponsor');
    const listaSponsorsAdminCont = document.getElementById('lista-sponsors-admin');

    let logoSponsorBase64Temp = null;
    let idSponsorEnEdicion = null;

    if (inputSponsorLogoFile) {
        inputSponsorLogoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // Igual que las fotos de jugador/noticia: se redimensiona y recomprime en el
            // navegador antes de guardarse, así el logo no se guarda "en crudo" (CLAUDE.md).
            comprimirImagen(file, MAX_LADO_LOGO_SPONSOR, CALIDAD_JPEG)
                .then(dataURL => {
                    logoSponsorBase64Temp = dataURL;
                    if (previewSponsorImg) previewSponsorImg.src = logoSponsorBase64Temp;
                    if (previewSponsorWrap) previewSponsorWrap.classList.remove('seccion-oculta-staff');
                })
                .catch(err => {
                    alert('No se pudo procesar el logo: ' + err.message);
                    logoSponsorBase64Temp = null;
                    inputSponsorLogoFile.value = '';
                });
        });
    }

    function limpiarFormularioSponsor() {
        if (formSponsor) formSponsor.reset();
        logoSponsorBase64Temp = null;
        if (previewSponsorWrap) previewSponsorWrap.classList.add('seccion-oculta-staff');
        if (document.getElementById('sponsor-color-fondo')) document.getElementById('sponsor-color-fondo').value = '#3e3f9b';
    }

    function cancelarEdicionSponsor() {
        idSponsorEnEdicion = null;
        if (tituloFormSponsor) tituloFormSponsor.textContent = 'Añadir Sponsor';
        if (btnSubmitSponsor) btnSubmitSponsor.textContent = 'Guardar Sponsor';
        if (btnCancelarEdicionSponsor) btnCancelarEdicionSponsor.classList.add('seccion-oculta-staff');
        limpiarFormularioSponsor();
    }

    if (btnCancelarEdicionSponsor) btnCancelarEdicionSponsor.addEventListener('click', cancelarEdicionSponsor);

    function moverSponsor(id, direccion) {
        const ordenados = listaSponsors.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
        const idx = ordenados.findIndex(s => s.id === id);
        const idxDestino = idx + direccion;
        if (idx === -1 || idxDestino < 0 || idxDestino >= ordenados.length) return;

        const tmp = ordenados[idx];
        ordenados[idx] = ordenados[idxDestino];
        ordenados[idxDestino] = tmp;
        ordenados.forEach((s, i) => { s.orden = i; });

        listaSponsors = ordenados;
        guardarSponsorsEnStorage();
        renderizarListaSponsorsAdmin();
    }

    function renderizarListaSponsorsAdmin() {
        if (!listaSponsorsAdminCont) return;
        const ordenados = listaSponsors.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));

        if (ordenados.length === 0) {
            listaSponsorsAdminCont.innerHTML = '<p style="color:#869bd8; font-size:11px;">Todavía no hay sponsors cargados.</p>';
            return;
        }

        listaSponsorsAdminCont.innerHTML = ordenados.map((s, idx) => `
            <div style="display:flex; align-items:center; gap:10px; background: rgba(4, 12, 38,0.6); padding:8px; border-radius:4px; margin-bottom:8px; flex-wrap:wrap;">
                <img src="${attrSeguro(s.logo || 'Recursos/logo pelota fut.svg')}" style="width:36px; height:36px; object-fit:contain; border-radius:3px; background:${String(s.colorFondo || '#0a1d54').replace(/[^#a-zA-Z0-9(),.%\s-]/g, '')};">
                <div style="flex:1; min-width:120px; text-align:left;">
                    <span style="font-size:12px; color:#fff; font-weight:bold; display:block;">${attrSeguro(s.nombre)}</span>
                    <span style="font-size:9px; color:#869bd8;">${attrSeguro(s.categoria || 'Sin categoría')}</span>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button type="button" class="btn-sponsor-subir" data-id="${s.id}" ${idx === 0 ? 'disabled' : ''} style="background:#1a3274; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald'; opacity:${idx === 0 ? '0.3' : '1'};">Subir</button>
                    <button type="button" class="btn-sponsor-bajar" data-id="${s.id}" ${idx === ordenados.length - 1 ? 'disabled' : ''} style="background:#1a3274; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald'; opacity:${idx === ordenados.length - 1 ? '0.3' : '1'};">Bajar</button>
                    <button type="button" class="btn-sponsor-editar" data-id="${s.id}" style="background:#0284c7; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Editar</button>
                    <button type="button" class="btn-sponsor-borrar" data-id="${s.id}" style="background:#991b1b; color:white; border:none; padding:4px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            </div>
        `).join('');

        listaSponsorsAdminCont.querySelectorAll('.btn-sponsor-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseFloat(btn.getAttribute('data-id'));
                const s = listaSponsors.find(x => x.id === id);
                if (!s) return;
                idSponsorEnEdicion = id;
                document.getElementById('sponsor-nombre').value = s.nombre || '';
                document.getElementById('sponsor-categoria').value = s.categoria || '';
                document.getElementById('sponsor-descripcion').value = s.descripcion || '';
                document.getElementById('sponsor-beneficio').value = s.beneficio || '';
                document.getElementById('sponsor-color-fondo').value = s.colorFondo || '#3e3f9b';
                document.getElementById('sponsor-instagram').value = s.instagram || '';
                document.getElementById('sponsor-telefono').value = s.telefono || '';
                document.getElementById('sponsor-link').value = s.link || '';
                document.getElementById('sponsor-ubicacion').value = s.ubicacion || '';
                logoSponsorBase64Temp = null;
                if (s.logo && previewSponsorImg && previewSponsorWrap) {
                    previewSponsorImg.src = s.logo;
                    previewSponsorWrap.classList.remove('seccion-oculta-staff');
                }
                if (tituloFormSponsor) tituloFormSponsor.textContent = `Editando: ${s.nombre}`;
                if (btnSubmitSponsor) btnSubmitSponsor.textContent = 'Guardar Cambios';
                if (btnCancelarEdicionSponsor) btnCancelarEdicionSponsor.classList.remove('seccion-oculta-staff');
                if (formSponsor) formSponsor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        listaSponsorsAdminCont.querySelectorAll('.btn-sponsor-borrar').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseFloat(btn.getAttribute('data-id'));
                const s = listaSponsors.find(x => x.id === id);
                if (!confirm(`¿Eliminar el sponsor "${s ? s.nombre : ''}"? Esta acción no se puede deshacer.`)) return;
                listaSponsors = listaSponsors.filter(x => x.id !== id);
                guardarSponsorsEnStorage();
                if (idSponsorEnEdicion === id) cancelarEdicionSponsor();
                renderizarListaSponsorsAdmin();
            });
        });

        listaSponsorsAdminCont.querySelectorAll('.btn-sponsor-subir').forEach(btn => {
            btn.addEventListener('click', () => moverSponsor(parseFloat(btn.getAttribute('data-id')), -1));
        });
        listaSponsorsAdminCont.querySelectorAll('.btn-sponsor-bajar').forEach(btn => {
            btn.addEventListener('click', () => moverSponsor(parseFloat(btn.getAttribute('data-id')), 1));
        });
    }

    if (formSponsor) {
        formSponsor.addEventListener('submit', async (e) => {
            e.preventDefault();

            const datosSponsor = {
                nombre: document.getElementById('sponsor-nombre').value.trim(),
                categoria: document.getElementById('sponsor-categoria').value,
                descripcion: document.getElementById('sponsor-descripcion').value.trim(),
                beneficio: document.getElementById('sponsor-beneficio').value.trim(),
                colorFondo: document.getElementById('sponsor-color-fondo').value,
                instagram: document.getElementById('sponsor-instagram').value.trim().replace('@', ''),
                telefono: document.getElementById('sponsor-telefono').value.trim(),
                link: document.getElementById('sponsor-link').value.trim(),
                ubicacion: document.getElementById('sponsor-ubicacion').value.trim()
            };
            const idEdicion = idSponsorEnEdicion;
            const logoSubido = await subirImagen(logoSponsorBase64Temp, btnSubmitSponsor);
            if (logoSponsorBase64Temp && logoSubido === null) return;

            if (idEdicion !== null) {
                const existente = listaSponsors.find(s => s.id === idEdicion);
                datosSponsor.logo = logoSubido || (existente ? existente.logo : '');
                listaSponsors = listaSponsors.map(s => s.id === idEdicion ? { ...s, ...datosSponsor } : s);
                alert(`¡Sponsor "${datosSponsor.nombre}" actualizado!`);
            } else {
                datosSponsor.logo = logoSubido || 'Recursos/logo pelota fut.svg';
                const maxOrden = listaSponsors.reduce((max, s) => Math.max(max, s.orden || 0), -1);
                listaSponsors.push({ id: Date.now(), orden: maxOrden + 1, ...datosSponsor });
                alert(`¡Sponsor "${datosSponsor.nombre}" agregado!`);
            }

            guardarSponsorsEnStorage();
            cancelarEdicionSponsor();
            renderizarListaSponsorsAdmin();
        });
    }

    renderizarListaSponsorsAdmin();

    // ============================================================
    // 7. MÓDULO TESORERÍA, BALANCES Y DEUDA ACUMULADA
    // ============================================================
    const btnSubTesoPartidos = document.getElementById('btn-sub-teso-partidos');
    const btnSubTesoInscripciones = document.getElementById('btn-sub-teso-inscripciones');
    const btnSubTesoCaja = document.getElementById('btn-sub-teso-caja');
    const btnSubTesoCalculadora = document.getElementById('btn-sub-teso-calculadora');
    const btnSubTesoRecaudacion = document.getElementById('btn-sub-teso-recaudacion');
    const subVistaTesoRecaudacion = document.getElementById('sub-vista-teso-recaudacion');
    const subVistaTesoPartidos = document.getElementById('sub-vista-teso-partidos');
    const subVistaTesoInscripciones = document.getElementById('sub-vista-teso-inscripciones');
    const subVistaTesoCaja = document.getElementById('sub-vista-teso-caja');
    const subVistaTesoCalculadora = document.getElementById('sub-vista-teso-calculadora');
    const filtroTesoreriaFecha = document.getElementById('filtro-tesoreria-fecha');
    const filtroTesoreriaCancha = document.getElementById('filtro-tesoreria-cancha');
    const filtroInscripcionesCiclo = document.getElementById('filtro-inscripciones-ciclo');

    function ocultarTodasLasSubVistasTeso() {
        [subVistaTesoPartidos, subVistaTesoInscripciones, subVistaTesoRecaudacion, subVistaTesoCaja, subVistaTesoCalculadora].forEach(v => { if (v) v.classList.add('seccion-oculta-staff'); });
        [btnSubTesoPartidos, btnSubTesoInscripciones, btnSubTesoRecaudacion, btnSubTesoCaja, btnSubTesoCalculadora].forEach(b => { if (b) b.classList.remove('active'); });
    }

    if (btnSubTesoPartidos && btnSubTesoInscripciones) {
        btnSubTesoPartidos.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoPartidos.classList.add('active');
            if (subVistaTesoPartidos) subVistaTesoPartidos.classList.remove('seccion-oculta-staff');
            renderizarTesoreriaPartidos();
        });

        btnSubTesoInscripciones.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoInscripciones.classList.add('active');
            if (subVistaTesoInscripciones) subVistaTesoInscripciones.classList.remove('seccion-oculta-staff');
            renderizarTesoreriaInscripciones();
        });
    }

    if (btnSubTesoRecaudacion) {
        btnSubTesoRecaudacion.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoRecaudacion.classList.add('active');
            if (subVistaTesoRecaudacion) subVistaTesoRecaudacion.classList.remove('seccion-oculta-staff');
            renderizarRecaudacionPorFecha();
        });
    }

    if (btnSubTesoCaja) {
        btnSubTesoCaja.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoCaja.classList.add('active');
            if (subVistaTesoCaja) subVistaTesoCaja.classList.remove('seccion-oculta-staff');
            renderizarCajaPorFecha();
        });
    }

    if (btnSubTesoCalculadora) {
        btnSubTesoCalculadora.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoCalculadora.classList.add('active');
            if (subVistaTesoCalculadora) subVistaTesoCalculadora.classList.remove('seccion-oculta-staff');
            cargarConfigCalculadoraArancel();
            calcularArancelRecomendado();
        });
    }

    // CAJA POR FECHA (EXCLUSIVO COORDINADOR): historial de cada pago individual, agrupado por día real de carga.
    function renderizarCajaPorFecha() {
        const contenedor = document.getElementById('contenedor-caja-por-fecha');
        if (!contenedor) return;

        if (cajaMovimientos.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; padding:20px; font-size:12px;">Todavía no se registró ningún pago. Los movimientos aparecen automáticamente apenas se cargue un monto en Aranceles o Inscripciones.</p>';
            return;
        }

        const grupos = {};
        cajaMovimientos.forEach(m => {
            const dia = (m.fechaHora || '').slice(0, 10);
            if (!grupos[dia]) grupos[dia] = [];
            grupos[dia].push(m);
        });

        const diasOrdenados = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

        contenedor.innerHTML = '';
        diasOrdenados.forEach(dia => {
            const movimientosDia = grupos[dia].slice().sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
            const totalDia = movimientosDia.reduce((acc, m) => acc + (m.monto || 0), 0);
            const fechaObj = dia ? new Date(dia + 'T12:00:00') : null;
            const fechaLegible = fechaObj && !isNaN(fechaObj)
                ? fechaObj.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                : 'Fecha sin datos';

            let filasHtml = '';
            movimientosDia.forEach(m => {
                const horaObj = new Date(m.fechaHora);
                const hora = !isNaN(horaObj) ? horaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                const esNegativo = m.monto < 0;
                filasHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:11px; flex-wrap:wrap;">
                        <span style="color:#869bd8; min-width:42px;">${hora}</span>
                        <span style="color:#fff; font-weight:bold; flex:1; min-width:100px;">${attrSeguro(m.equipo)}</span>
                        <span style="color:#869bd8; flex:1; min-width:120px;">${attrSeguro(m.concepto)}${m.detalle ? ' — ' + attrSeguro(m.detalle) : ''}</span>
                        <span style="color:#2edae3; min-width:110px;">${m.medio === 'Efectivo' ? '' : ''} ${attrSeguro(m.medio)}</span>
                        <span style="color:${esNegativo ? '#f43f5e' : '#4ade80'}; font-weight:bold; min-width:80px; text-align:right;">${esNegativo ? '-' : '+'}$${Math.abs(m.monto).toLocaleString()}</span>
                    </div>
                `;
            });

            contenedor.innerHTML += `
                <div class="admin-card-panel" style="margin-bottom:15px; border-color:#f2c00e;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px; text-transform:capitalize;">
                        <h4 style="color:#f2c00e; margin:0;">${fechaLegible}</h4>
                        <span style="color:#4ade80; font-weight:bold; font-family:'Michroma'; font-size:13px;">Total del día: $${totalDia.toLocaleString()}</span>
                    </div>
                    ${filasHtml}
                </div>
            `;
        });
    }

    // Solo el resumen (total pagado + estado de deuda) de UNA tarjeta: cargar un monto no debe redibujar
    // la lista entera, o se pierde el foco y el scroll en el equipo que se estaba cargando (celular en cancha).
    // Beneficio de inscripción de un equipo (por ejemplo, los campeones): exento o % de descuento, con un motivo.
    // Se guarda en su entrada de liga_tesoreria_inscripciones como beneficio: { tipo: 'exento' | 'descuento',
    // porcentaje, motivo } (null = sin beneficio). Lo bonificado no es plata que entró: no suma a ninguna recaudación.
    function porcentajeBeneficio(beneficio) {
        if (!beneficio) return 0;
        if (beneficio.tipo === 'exento') return 100;
        if (beneficio.tipo === 'descuento') return Math.min(100, Math.max(0, Number(beneficio.porcentaje) || 0));
        return 0;
    }

    function montosInscripcion(cantJugadores, valorIndividual, beneficio) {
        const bruto = cantJugadores * valorIndividual;
        const exigido = Math.round(bruto * (1 - porcentajeBeneficio(beneficio) / 100));
        return { bruto, exigido, bonificado: bruto - exigido };
    }

    function valorInscripcionGuardado() {
        return parseFloat(almacen.getItem('liga_valor_inscripcion')) || 3000;
    }

    // Cobrado: ef + tr de todas las entradas (igual que el Balance Central de Caja). Bonificado: solo informativo.
    function totalesInscripciones() {
        let cobrado = 0, bonificado = 0;
        Object.values(tesoreriaInscripciones).forEach(p => { cobrado += (p.ef || 0) + (p.tr || 0); });
        const valor = valorInscripcionGuardado();
        [...(poolSuperior || []), ...(poolBasico || [])].forEach(eq => {
            const pago = tesoreriaInscripciones[claveInscripcion(eq)];
            bonificado += montosInscripcion(eq.jugadores ? eq.jugadores.length : 0, valor, pago && pago.beneficio).bonificado;
        });
        return { cobrado, bonificado };
    }

    function textoExigidoInscripcion(cantJugadores, montos) {
        return `${cantJugadores} jug. — Exigido $${montos.exigido.toLocaleString()}` + (montos.bonificado > 0 ? ` (de $${montos.bruto.toLocaleString()})` : '');
    }

    function htmlEstadoBeneficio(beneficio) {
        const pct = porcentajeBeneficio(beneficio);
        if (!pct) return '<div class="teso-insc-benef-estado"></div>';
        const titulo = beneficio.tipo === 'exento' ? 'EXENTO' : `${pct}% DE DESCUENTO`;
        return `<div class="teso-insc-benef-estado"><span class="teso-chip teso-chip-dorado">${titulo}${beneficio.motivo ? ' · ' + attrSeguro(beneficio.motivo) : ''}</span></div>`;
    }

    // Solo el resumen (total pagado + estado de deuda) de UNA tarjeta: cargar un monto no debe redibujar
    // la lista entera, o se pierde el foco y el scroll en el equipo que se estaba cargando (celular en cancha).
    function htmlResumenInscripcion(montos, pagoData) {
        const pagado = (pagoData.ef || 0) + (pagoData.tr || 0);
        const diferencia = montos.exigido - pagado;
        let chip = '<span class="teso-chip teso-chip-verde">AL DÍA</span>';
        if (diferencia > 0) chip = `<span class="teso-chip teso-chip-rojo">Falta $${diferencia.toLocaleString()}</span>`;
        // Pagó de más (por ejemplo, se lo pasó a exento después de que pagó): no es una deuda negativa.
        else if (diferencia < 0) chip = `<span class="teso-chip teso-chip-verde">A favor $${(-diferencia).toLocaleString()}</span>`;
        return `
            <div class="teso-insc-resumen">
                <span class="teso-insc-total">Total pagado: $${pagado.toLocaleString()}${montos.bonificado > 0 ? `<span class="teso-insc-bonif">Bonificado: $${montos.bonificado.toLocaleString()} (no suma a la caja)</span>` : ''}</span>
                ${chip}
            </div>
        `;
    }

    function htmlCardInscripcion(idEq, nombreEq, cantJugadores, valorIndividual, pagoData) {
        const beneficio = pagoData.beneficio || null;
        const tipo = beneficio ? beneficio.tipo : '';
        const montos = montosInscripcion(cantJugadores, valorIndividual, beneficio);
        return `
            <div class="teso-team-box teso-insc-card" data-eq="${attrSeguro(idEq)}" data-nombre="${attrSeguro(nombreEq)}" data-cant="${cantJugadores}" data-valor="${valorIndividual}" data-exigido="${montos.exigido}">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <span class="teso-team-name">${attrSeguro(nombreEq)}</span>
                    <span class="teso-insc-exigido" style="font-family:'Oswald',sans-serif; font-size:11px; color:#869bd8;">${textoExigidoInscripcion(cantJugadores, montos)}</span>
                </div>
                ${htmlEstadoBeneficio(beneficio)}
                <div class="teso-inputs-row">
                    <label>Pago Efectivo ($):</label>
                    <input type="number" class="input-monto-teso in-insc-ef" data-eq="${attrSeguro(idEq)}" value="${pagoData.ef || 0}">
                </div>
                <div class="teso-inputs-row">
                    <label>Pago Transf. ($):</label>
                    <input type="number" class="input-monto-teso in-insc-tr" data-eq="${attrSeguro(idEq)}" value="${pagoData.tr || 0}">
                </div>
                ${htmlResumenInscripcion(montos, pagoData)}
                <details class="teso-insc-benef">
                    <summary>Beneficio (exento o descuento)</summary>
                    <div class="teso-inputs-row">
                        <label>Tipo:</label>
                        <select class="select-asist-teso in-insc-benef-tipo">
                            <option value=""${tipo === '' ? ' selected' : ''}>Sin beneficio</option>
                            <option value="exento"${tipo === 'exento' ? ' selected' : ''}>Exento (no paga)</option>
                            <option value="descuento"${tipo === 'descuento' ? ' selected' : ''}>Descuento (%)</option>
                        </select>
                    </div>
                    <div class="teso-inputs-row teso-insc-fila-pct"${tipo === 'descuento' ? '' : ' hidden'}>
                        <label>Descuento (%):</label>
                        <input type="number" min="1" max="100" class="input-monto-teso in-insc-benef-pct" value="${tipo === 'descuento' ? porcentajeBeneficio(beneficio) : ''}">
                    </div>
                    <div class="teso-insc-fila-motivo"${tipo ? '' : ' hidden'}>
                        <label>Motivo:</label>
                        <input type="text" maxlength="60" class="input-monto-teso in-insc-benef-motivo" placeholder="Ej: Campeones 2025" value="${attrSeguro((beneficio && beneficio.motivo) || '')}">
                    </div>
                </details>
            </div>
        `;
    }

    // Actualiza lo que depende de los montos y del beneficio sin reemplazar la tarjeta (no toca los inputs).
    function actualizarCardInscripcion(card) {
        if (!card) return;
        const beneficio = (tesoreriaInscripciones[card.dataset.eq] || {}).beneficio || null;
        const cant = parseInt(card.dataset.cant) || 0;
        const montos = montosInscripcion(cant, parseFloat(card.dataset.valor) || 0, beneficio);
        card.dataset.exigido = montos.exigido;
        card.querySelector('.teso-insc-exigido').textContent = textoExigidoInscripcion(cant, montos);
        card.querySelector('.teso-insc-benef-estado').outerHTML = htmlEstadoBeneficio(beneficio);
        const ef = parseFloat(card.querySelector('.in-insc-ef').value) || 0;
        const tr = parseFloat(card.querySelector('.in-insc-tr').value) || 0;
        const resumenViejo = card.querySelector('.teso-insc-resumen');
        if (resumenViejo) resumenViejo.outerHTML = htmlResumenInscripcion(montos, { ef, tr });
    }

    // Cambiar el beneficio no mueve plata: no registra nada en la Caja.
    function guardarBeneficioInscripcion(card) {
        const idEq = card.dataset.eq;
        const tipo = card.querySelector('.in-insc-benef-tipo').value;
        const inputPct = card.querySelector('.in-insc-benef-pct');
        const inputMotivo = card.querySelector('.in-insc-benef-motivo');
        let beneficio = null;
        if (tipo === 'exento') {
            beneficio = { tipo, porcentaje: 100, motivo: inputMotivo.value.trim() };
        } else if (tipo === 'descuento') {
            let pct = Math.round(parseFloat(inputPct.value));
            if (!(pct >= 1)) pct = 50;
            pct = Math.min(100, pct);
            inputPct.value = pct;
            beneficio = { tipo, porcentaje: pct, motivo: inputMotivo.value.trim() };
        } else {
            inputMotivo.value = '';
        }
        card.querySelector('.teso-insc-fila-pct').hidden = tipo !== 'descuento';
        card.querySelector('.teso-insc-fila-motivo').hidden = !tipo;
        if (!beneficio && !tesoreriaInscripciones[idEq]) return;
        if (!tesoreriaInscripciones[idEq]) tesoreriaInscripciones[idEq] = { ef: 0, tr: 0 };
        const beneficioAnterior = JSON.stringify(tesoreriaInscripciones[idEq].beneficio || null);
        tesoreriaInscripciones[idEq].beneficio = beneficio;
        almacen.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
        if (JSON.stringify(beneficio) !== beneficioAnterior) {
            const nombreEq = card.dataset.nombre;
            const motivo = beneficio && beneficio.motivo ? ` (motivo: ${beneficio.motivo})` : '';
            registrarHistorial('beneficio', !beneficio ? `le sacó el beneficio de inscripción a ${nombreEq}`
                : beneficio.tipo === 'exento' ? `marcó a ${nombreEq} como exento de la inscripción${motivo}`
                : `le puso a ${nombreEq} un descuento del ${beneficio.porcentaje}% en la inscripción${motivo}`);
        }
        actualizarCardInscripcion(card);
        calcularBalanceGeneral();
    }

    function renderizarTesoreriaInscripciones() {
        const contenedor = document.getElementById('contenedor-tesoreria-inscripciones');
        const inputMontoInscripcion = document.getElementById('monto-inscripcion-individual');
        if (!contenedor) return;

        if (inputMontoInscripcion) {
            const montoGuardado = almacen.getItem('liga_valor_inscripcion');
            if (montoGuardado && !inputMontoInscripcion.dataset.cargado) {
                inputMontoInscripcion.value = montoGuardado;
                inputMontoInscripcion.dataset.cargado = "true";
            }
        }

        recargarPools();
        const ciclo = filtroInscripcionesCiclo ? filtroInscripcionesCiclo.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const valorIndividual = parseFloat(inputMontoInscripcion ? inputMontoInscripcion.value : 3000) || 3000;

        contenedor.innerHTML = '';

        if (!pool || pool.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:12px; padding:15px;">Sin equipos cargados.</p>';
            return;
        }

        pool.forEach(eq => {
            const cantJugadores = eq.jugadores ? eq.jugadores.length : 0;
            const idEq = claveInscripcion(eq);
            const pagoData = tesoreriaInscripciones[idEq] || { ef: 0, tr: 0 };
            contenedor.innerHTML += htmlCardInscripcion(idEq, eq.nombre.trim(), cantJugadores, valorIndividual, pagoData);
        });

        contenedor.querySelectorAll('.in-insc-benef-tipo, .in-insc-benef-pct, .in-insc-benef-motivo').forEach(campo => {
            campo.addEventListener('change', (e) => guardarBeneficioInscripcion(e.target.closest('.teso-insc-card')));
        });

        document.querySelectorAll('.in-insc-ef').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const idEq = e.target.getAttribute('data-eq');
                if (!tesoreriaInscripciones[idEq]) tesoreriaInscripciones[idEq] = { ef: 0, tr: 0 };
                const valorAnterior = tesoreriaInscripciones[idEq].ef || 0;
                const valorNuevo = parseFloat(e.target.value) || 0;
                tesoreriaInscripciones[idEq].ef = valorNuevo;
                almacen.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
                registrarMovimientoCaja({ equipo: e.target.closest('.teso-insc-card').dataset.nombre, concepto: 'Inscripción', medio: 'Efectivo', monto: valorNuevo - valorAnterior });
                actualizarCardInscripcion(e.target.closest('.teso-insc-card'));
                calcularBalanceGeneral();
            });
        });

        document.querySelectorAll('.in-insc-tr').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const idEq = e.target.getAttribute('data-eq');
                if (!tesoreriaInscripciones[idEq]) tesoreriaInscripciones[idEq] = { ef: 0, tr: 0 };
                const valorAnterior = tesoreriaInscripciones[idEq].tr || 0;
                const valorNuevo = parseFloat(e.target.value) || 0;
                tesoreriaInscripciones[idEq].tr = valorNuevo;
                almacen.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
                registrarMovimientoCaja({ equipo: e.target.closest('.teso-insc-card').dataset.nombre, concepto: 'Inscripción', medio: 'Transferencia', monto: valorNuevo - valorAnterior });
                actualizarCardInscripcion(e.target.closest('.teso-insc-card'));
                calcularBalanceGeneral();
            });
        });
    }

    if (filtroInscripcionesCiclo) filtroInscripcionesCiclo.addEventListener('change', renderizarTesoreriaInscripciones);

    if (document.getElementById('monto-inscripcion-individual')) {
        document.getElementById('monto-inscripcion-individual').addEventListener('change', (e) => {
            almacen.setItem('liga_valor_inscripcion', e.target.value);
            registrarHistorial('inscripcion', `cambió el valor de la inscripción por jugador a $${(parseFloat(e.target.value) || 0).toLocaleString()}`);
            renderizarTesoreriaInscripciones();
            calcularBalanceGeneral();
        });
    }

    // ============================================================
    // REGLAMENTO ART. 17 BIS: AUSENCIAS, PAGO DEL 50 % / 100 %, SALDO A FAVOR Y SANCIÓN AUTOMÁTICA
    // Todo se recalcula desde cero con lo que carga el staff (asistencia + pagos). Por eso corregir un dato
    // deshace o rehace solo sus consecuencias: la sanción, el resultado 3-0 y el saldo a favor.
    // ============================================================
    const ARANCEL_PARTIDO_DEFECTO = 30000;
    const PUNTOS_QUITA_AUSENCIA = 2;

    function guardarTesoreriaPartidos() {
        almacen.setItem('liga_tesoreria_partidos_v2', JSON.stringify(tesoreriaPartidos));
    }

    // Orden cronológico real: fechas de grupo (1, 2, 3…) y después 8vos (108) → 4tos (104) → semis (102) → final (100).
    function ordenCronologicoFecha(fecha) {
        const f = Number(fecha);
        return f >= 100 ? 1000 + (200 - f) : f;
    }

    function nombreFaseTeso(fecha) {
        const f = Number(fecha);
        if (f === 108) return '8VOS DE FINAL';
        if (f === 104) return 'CUARTOS DE FINAL';
        if (f === 102) return 'SEMIFINAL';
        if (f === 100) return 'GRAN FINAL';
        return `FECHA ${fecha}`;
    }

    // Tesorería identifica a cada equipo por su id, que sobrevive a un cambio de nombre (antes era por nombre y
    // renombrar un equipo le "borraba" los pagos). Solo los partidos viejos sin id caen al nombre.
    function equipoTeso(p, lado) {
        const id = buscarEquipoIdTeso(p, lado);
        return id != null ? `eq${id}` : ((lado === 'local' ? p.local : p.visitante) || '').trim().toLowerCase();
    }

    function claveTesoreria(p, lado) {
        return `F${p.fecha}_${p.id}_${lado === 'local' ? 'local' : 'visita'}_${equipoTeso(p, lado)}`;
    }

    function claveInscripcion(eq) {
        return eq.id != null ? `eq${eq.id}` : eq.nombre.trim();
    }

    // Claves con el nombre (hasta el 27/09/2026): se pasan una sola vez a las claves con id. Si ya se
    // pasaron, no hace nada. También actualiza la clave que guardan las sanciones automáticas.
    function migrarClavesTesoreria() {
        let pagos = false, sanciones = false, inscripciones = false;
        partidos.forEach(p => {
            if (!p || !p.local || !p.visitante) return;
            ['local', 'visita'].forEach(lado => {
                const nombre = (lado === 'local' ? p.local : p.visitante).trim().toLowerCase();
                const vieja = `F${p.fecha}_${p.id}_${lado}_${nombre}`;
                const nueva = claveTesoreria(p, lado);
                if (vieja === nueva || !(vieja in tesoreriaPartidos)) return;
                if (!(nueva in tesoreriaPartidos)) tesoreriaPartidos[nueva] = tesoreriaPartidos[vieja];
                delete tesoreriaPartidos[vieja];
                pagos = true;
                listaSanciones.forEach(s => {
                    if (s.claveTeso !== vieja) return;
                    s.claveTeso = nueva;
                    sanciones = true;
                });
            });
        });
        [...(poolSuperior || []), ...(poolBasico || [])].forEach(eq => {
            const vieja = eq.nombre.trim();
            const nueva = claveInscripcion(eq);
            if (vieja === nueva || !(vieja in tesoreriaInscripciones)) return;
            if (!(nueva in tesoreriaInscripciones)) tesoreriaInscripciones[nueva] = tesoreriaInscripciones[vieja];
            delete tesoreriaInscripciones[vieja];
            inscripciones = true;
        });
        if (pagos) guardarTesoreriaPartidos();
        if (sanciones) almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
        if (inscripciones) almacen.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
    }
    migrarClavesTesoreria();

    const montoTeso = d => ((d && d.ef) || 0) + ((d && d.tr) || 0);

    // Qué pasa con la Tesorería de un partido que se edita o se borra (nuevo = null): nunca puede quedar plata sin
    // rastro. Cada equipo que sigue en el partido se lleva su entrada (pagos, arancel, asistencia, sanción descartada)
    // a la clave nueva; se lo busca por equipo y no por lado, así también sirve invertir local y visitante. Un equipo
    // que deja el partido con plata cargada bloquea el cambio; sin plata, su entrada se descarta.
    function planTesoreriaPartido(previo, nuevo) {
        const plan = { mudanzas: [], descartes: [], bloqueos: [] };
        ['local', 'visita'].forEach(lado => {
            const vieja = claveTesoreria(previo, lado);
            const datos = tesoreriaPartidos[vieja];
            if (!datos) return;
            const equipo = equipoTeso(previo, lado);
            const ladoNuevo = nuevo ? ['local', 'visita'].find(l => equipoTeso(nuevo, l) === equipo) : null;
            if (ladoNuevo) {
                const clave = claveTesoreria(nuevo, ladoNuevo);
                if (clave !== vieja) plan.mudanzas.push({ vieja, nueva: clave, fecha: nuevo.fecha });
            } else if (montoTeso(datos) > 0) {
                plan.bloqueos.push(`${lado === 'local' ? previo.local : previo.visitante}: $${montoTeso(datos).toLocaleString()} (${nombreFaseTeso(previo.fecha)})`);
            } else {
                plan.descartes.push(vieja);
            }
        });
        return plan;
    }

    function aplicarPlanTesoreria(plan) {
        if (plan.mudanzas.length === 0 && plan.descartes.length === 0) return;
        const entradas = plan.mudanzas.map(m => tesoreriaPartidos[m.vieja]);
        plan.mudanzas.forEach(m => delete tesoreriaPartidos[m.vieja]);
        plan.descartes.forEach(clave => delete tesoreriaPartidos[clave]);
        plan.mudanzas.forEach((m, i) => {
            const previa = tesoreriaPartidos[m.nueva];
            // Un pago suelto de antes en la clave nueva es del mismo equipo en este mismo partido: se suma, es su plata.
            tesoreriaPartidos[m.nueva] = previa
                ? { ...entradas[i], ef: (previa.ef || 0) + (entradas[i].ef || 0), tr: (previa.tr || 0) + (entradas[i].tr || 0) }
                : entradas[i];
        });
        let cambioSanciones = false;
        listaSanciones.forEach(s => {
            const m = plan.mudanzas.find(x => x.vieja === s.claveTeso);
            if (!m) return;
            s.claveTeso = m.nueva;
            if (s.origenAuto) {
                s.id = idSancionAutomatica(m.nueva);
                s.acta = m.fecha;
                s.fecha = m.fecha;
            }
            cambioSanciones = true;
        });
        guardarTesoreriaPartidos();
        if (cambioSanciones) almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
    }

    function textoBloqueoTesoreria(plan, motivo) {
        return motivo + '\n\n'
            + plan.bloqueos.map(b => '• ' + b).join('\n')
            + '\n\nPrimero poné esos pagos en $0 en Tesorería > Aranceles por Partido (así queda registrada la devolución en la Caja) y después volvé a intentarlo.';
    }

    function fechaHoyTexto() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Id fijo para la sanción automática de un pago (partido + equipo): si dos personas la generan a la vez
    // cae en el mismo documento en vez de duplicarse. Es un número (como los demás ids, que se leen con
    // parseInt) muy por encima de Date.now() para no chocar con las sanciones cargadas a mano.
    function idSancionAutomatica(claveTeso) {
        let a = 2166136261, b = 5381;
        for (let i = 0; i < claveTeso.length; i++) {
            const c = claveTeso.charCodeAt(i);
            a = Math.imul(a ^ c, 16777619) >>> 0;
            b = (Math.imul(b, 33) ^ c) >>> 0;
        }
        return 1e15 + a * 1024 + (b & 1023);
    }

    function buscarEquipoIdTeso(p, lado) {
        const idGuardado = lado === 'local' ? p.localId : p.visitanteId;
        if (idGuardado != null) return idGuardado;
        const pool = (p.ciclo === 'basico' ? poolBasico : poolSuperior) || [];
        const nombre = (lado === 'local' ? p.local : p.visitante).trim().toLowerCase();
        const equipo = pool.find(e => e.nombre.trim().toLowerCase() === nombre);
        return equipo ? equipo.id : null;
    }

    // Una sanción automática que un admin borró o editó a mano deja de ser "automática": se marca en Tesorería
    // para que el sistema no la vuelva a crear sola.
    function desvincularSancionAuto(sancion) {
        if (!sancion || !sancion.origenAuto || !sancion.claveTeso) return;
        if (!tesoreriaPartidos[sancion.claveTeso]) tesoreriaPartidos[sancion.claveTeso] = { ef: 0, tr: 0 };
        tesoreriaPartidos[sancion.claveTeso].sancionDescartada = true;
        guardarTesoreriaPartidos();
    }

    // Cuánto debe cada equipo en cada partido, en orden cronológico, arrastrando el saldo a favor
    // (todo pago por encima de lo exigido se descuenta del siguiente partido que dispute).
    function calcularTesoreriaPartidos() {
        const porClave = {};
        const historial = {};
        const saldos = {};
        const ordenados = partidos
            .filter(p => p && p.local && p.visitante)
            .sort((a, b) => ordenCronologicoFecha(a.fecha) - ordenCronologicoFecha(b.fecha));

        ordenados.forEach(p => {
            ['local', 'visita'].forEach(lado => {
                const nombre = lado === 'local' ? p.local : p.visitante;
                const equipoKey = equipoTeso(p, lado);
                const clave = claveTesoreria(p, lado);
                const data = tesoreriaPartidos[clave] || {};
                const arancelBase = data.arancel || p.arancelExigido || ARANCEL_PARTIDO_DEFECTO;
                const asistencia = data.asistencia || '';
                const ausente = asistencia === 'sin_aviso' || asistencia === 'con_aviso';

                // El ausente debe el 50 % del derecho de partido; el que se presenta, el 100 %.
                // En Play-Offs el ausente queda eliminado y no juega: no debe nada.
                const exigidoBruto = ausente ? (Number(p.fecha) >= 100 ? 0 : arancelBase * 0.5) : arancelBase;
                const saldoPrevio = saldos[equipoKey] || 0;
                const saldoAplicado = Math.min(saldoPrevio, exigidoBruto);
                const exigido = exigidoBruto - saldoAplicado;
                const pagado = (data.ef || 0) + (data.tr || 0);
                const falta = Math.max(0, exigido - pagado);
                const saldoGenerado = Math.max(0, pagado - exigido);
                saldos[equipoKey] = saldoPrevio - saldoAplicado + saldoGenerado;

                const cubierto = pagado + saldoAplicado;
                porClave[clave] = {
                    clave, nombre, lado, data, arancelBase, asistencia, ausente,
                    exigidoBruto, saldoAplicado, exigido, pagado, falta, saldoGenerado, cubierto,
                    porcentaje: arancelBase > 0 ? cubierto / arancelBase : 1
                };
                if (!historial[equipoKey]) historial[equipoKey] = [];
                historial[equipoKey].push({ orden: ordenCronologicoFecha(p.fecha), fecha: p.fecha, falta });
            });
        });

        return { porClave, historial };
    }

    // equipoKey = equipoTeso(partido, lado)
    function obtenerDeudaHistorica(calc, equipoKey, fechaActual) {
        const ordenActual = ordenCronologicoFecha(fechaActual);
        const pendientes = (calc.historial[equipoKey] || [])
            .filter(h => h.orden < ordenActual && h.falta > 0);
        return {
            deudaTotal: pendientes.reduce((acc, h) => acc + h.falta, 0),
            fechasDeuda: pendientes.map(h => `F${h.fecha}`)
        };
    }

    // Aplica el Art. 17 Bis a un partido: qué corresponde (sanciones, resultado, avisos) según asistencia y pagos.
    function evaluarPartidoAusencias(p, calc) {
        const L = calc.porClave[claveTesoreria(p, 'local')];
        const V = calc.porClave[claveTesoreria(p, 'visita')];
        const esPlayoff = Number(p.fecha) >= 100;
        const ev = { L, V, esPlayoff, ganadorAuto: null, sanciones: [], avisos: [] };
        if (!L.ausente && !V.ausente) return ev;

        const rivalDe = t => (t === L ? V : L);
        const dinero = n => `$${Math.round(n).toLocaleString()}`;

        if (L.ausente && V.ausente) {
            ev.avisos.push({ tipo: 'alerta', texto: 'Ambos equipos figuran como ausentes. El reglamento no define este caso: resolvelo a mano.' });
        }

        [L, V].filter(t => t.ausente).forEach(t => {
            if (esPlayoff) {
                ev.avisos.push({ tipo: 'alerta', texto: `${t.nombre} queda ELIMINADO por no presentarse (Art. 17 Bis).` });
                return;
            }
            const motivoAusencia = t.asistencia === 'con_aviso' ? 'avisó que no asistía' : 'no se presentó';
            const activa = t.porcentaje < 0.5;
            ev.sanciones.push({
                t,
                activa,
                motivo: `Fecha ${p.fecha} (vs ${rivalDe(t).nombre}): ${motivoAusencia} y no abonó el 50% del derecho de partido (Art. 17 Bis).`
            });
            ev.avisos.push(activa
                ? { tipo: 'alerta', texto: `${t.nombre}: -${PUNTOS_QUITA_AUSENCIA} PTS en la tabla hasta que abone el 50% (faltan ${dinero(Math.max(0, t.arancelBase * 0.5 - t.cubierto))}).` }
                : { tipo: 'ok', texto: `${t.nombre}: abonó el 50%, pierde el partido pero conserva sus puntos.` });
        });

        if (L.ausente !== V.ausente && !esPlayoff) {
            const A = L.ausente ? L : V;
            const P = rivalDe(A);
            if (P.asistencia !== 'presente') {
                ev.avisos.push({ tipo: 'info', texto: `Marcá "Se presentó" en ${P.nombre} (con sus pagos ya cargados) para resolver el partido.` });
            } else if (P.porcentaje >= 1) {
                ev.ganadorAuto = P.lado;
                ev.avisos.push({ tipo: 'ok', texto: `Resultado automático: 3-0 para ${P.nombre}, que abonó el 100%. Corresponde asignarle un amistoso (Art. 17).` });
            } else if (P.porcentaje >= 0.5) {
                ev.avisos.push({ tipo: 'info', texto: `Partido suspendido sin puntos para ninguno: ${P.nombre} abonó entre el 50% y el 100%.` });
            } else {
                ev.avisos.push({ tipo: 'alerta', texto: `${P.nombre} abonó menos del 50%: queda como equipo no presentado, pierde los puntos del partido y -${PUNTOS_QUITA_AUSENCIA} PTS en la tabla.` });
            }
            if (P.asistencia === 'presente') {
                const activaP = P.porcentaje < 0.5;
                ev.sanciones.push({
                    t: P,
                    activa: activaP,
                    motivo: `Fecha ${p.fecha} (vs ${A.nombre}): se presentó pero abonó menos del 50% del derecho de partido, por lo que queda como equipo no presentado (Art. 17 Bis).`
                });
            }
        }

        return ev;
    }

    // Reconcilia con la realidad actual: crea/levanta/reactiva sanciones automáticas, carga o deshace el 3-0
    // y limpia lo que quedó huérfano (asistencia corregida, partido borrado, etc.).
    function sincronizarAusencias() {
        const calc = calcularTesoreriaPartidos();
        const evaluaciones = {};
        const aplicables = new Set();
        let cambioSanciones = false;
        let cambioPartidos = false;
        let cambioTeso = false;

        partidos.forEach(p => {
            if (!p || !p.local || !p.visitante) return;
            const ev = evaluarPartidoAusencias(p, calc);
            evaluaciones[p.id] = ev;

            ev.sanciones.forEach(s => {
                const clave = s.t.clave;
                aplicables.add(clave);
                if (tesoreriaPartidos[clave] && tesoreriaPartidos[clave].sancionDescartada) return;

                const existente = listaSanciones.find(x => x.origenAuto && x.claveTeso === clave);
                if (s.activa) {
                    if (!existente) {
                        listaSanciones.push({
                            id: idSancionAutomatica(clave),
                            acta: p.fecha,
                            fecha: p.fecha,
                            ciclo: p.ciclo || 'superior',
                            equipo: s.t.nombre,
                            equipoId: buscarEquipoIdTeso(p, s.t.lado),
                            jugador: '',
                            tipo: 'Quita de Puntos',
                            puntosRestados: PUNTOS_QUITA_AUSENCIA,
                            motivo: s.motivo,
                            origenAuto: true,
                            claveTeso: clave
                        });
                        cambioSanciones = true;
                    } else if (existente.levantada || existente.puntosRestados !== PUNTOS_QUITA_AUSENCIA || existente.motivo !== s.motivo) {
                        existente.levantada = false;
                        existente.puntosRestados = PUNTOS_QUITA_AUSENCIA;
                        existente.motivo = s.motivo;
                        delete existente.fechaLevantada;
                        delete existente.puntosOriginales;
                        cambioSanciones = true;
                    }
                } else if (existente && !existente.levantada) {
                    existente.puntosOriginales = existente.puntosRestados || PUNTOS_QUITA_AUSENCIA;
                    existente.puntosRestados = 0;
                    existente.levantada = true;
                    existente.fechaLevantada = fechaHoyTexto();
                    cambioSanciones = true;
                } else if (existente && existente.motivo !== s.motivo) {
                    // Ya levantada, pero el partido cambió de fecha o de rival: se actualiza el texto.
                    existente.motivo = s.motivo;
                    cambioSanciones = true;
                }
            });

            if (ev.ganadorAuto) {
                if (!p.jugado || p.resultadoAuto) {
                    const golesLocal = ev.ganadorAuto === 'local' ? 3 : 0;
                    const golesVisitante = ev.ganadorAuto === 'visita' ? 3 : 0;
                    if (!p.jugado || !p.resultadoAuto || p.golesLocal !== golesLocal || p.golesVisitante !== golesVisitante) {
                        p.golesLocal = golesLocal;
                        p.golesVisitante = golesVisitante;
                        p.penalesLocal = null;
                        p.penalesVisitante = null;
                        p.goleadoresLocal = [];
                        p.goleadoresVisitante = [];
                        p.jugado = true;
                        p.resultadoAuto = true;
                        cambioPartidos = true;
                    }
                } else {
                    ev.avisos.push({ tipo: 'alerta', texto: 'Ya hay un resultado cargado a mano en este partido: no se lo pisó con el 3-0.' });
                }
            } else if (p.resultadoAuto) {
                p.golesLocal = null;
                p.golesVisitante = null;
                p.jugado = false;
                delete p.resultadoAuto;
                cambioPartidos = true;
            }
        });

        // Sanciones automáticas cuya causa desapareció (se corrigió la asistencia, se borró el partido…)
        const cantidadAntes = listaSanciones.length;
        listaSanciones = listaSanciones.filter(s => !s.origenAuto || aplicables.has(s.claveTeso));
        if (listaSanciones.length !== cantidadAntes) cambioSanciones = true;

        // Si la causa desapareció, se limpia la marca de "descartada" para que una futura ausencia sí se sancione.
        Object.keys(tesoreriaPartidos).forEach(clave => {
            if (tesoreriaPartidos[clave].sancionDescartada && !aplicables.has(clave)) {
                delete tesoreriaPartidos[clave].sancionDescartada;
                cambioTeso = true;
            }
        });

        if (cambioTeso) guardarTesoreriaPartidos();
        if (cambioPartidos) {
            almacen.setItem('liga_partidos', JSON.stringify(partidos));
            if (typeof actualizarListaAdmin === 'function') actualizarListaAdmin();
        }
        if (cambioSanciones) {
            almacen.setItem('liga_sanciones', JSON.stringify(listaSanciones));
            if (typeof actualizarListaSancionesAdmin === 'function') actualizarListaSancionesAdmin();
        }

        return { calc, evaluaciones };
    }

    // Lista de buena fe en cancha. La asistencia se guarda dentro de cada partido (asistentesLocal / asistentesVisitante,
    // como los goleadores) y de ahí salen los PJ de cada jugador. La ficha médica es un dato del jugador
    // (se comparte con Equipos y Planteles).
    const bfAbiertos = new Set();
    const MAX_JUGADORES_LISTA = 10;
    const MINIMO_JUGADORES_PARTIDO = 4;

    function attrSeguro(texto) {
        return String(texto).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function idJugadorBF(j) {
        return j.dni;
    }

    function dorsalBF(j) {
        const d = j.dorsal;
        return (d === undefined || d === null || String(d).trim() === '') ? 'S/N' : `#${attrSeguro(d)}`;
    }

    function buscarEquipoBF(nombre, ciclo) {
        const pool = (ciclo === 'basico' ? poolBasico : poolSuperior) || [];
        return pool.find(e => e.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    }

    function campoAsistentes(lado) {
        return lado === 'local' ? 'asistentesLocal' : 'asistentesVisitante';
    }

    function guardarPartidosBF() {
        almacen.setItem('liga_partidos', JSON.stringify(partidos));
    }

    // Suspensión de un jugador en la fecha de un partido: corre desde la fecha SIGUIENTE a la del acta y dura tantas fechas
    // como indica "puntosRestados" de la sanción "Sanción Disciplinaria" (decidido por Joaquín). Las fechas se cuentan sobre
    // las fechas que existen en el ciclo, en orden cronológico (los playoffs 108/104/102/100 van después de la fecha 7).
    // Decisión de Joaquín (23/09/2026): una fecha sólo le descuenta suspensión al jugador si su
    // equipo efectivamente jugó ese partido. Si el partido se suspende o no se juega, la sanción
    // no corre y se arrastra a la fecha siguiente que sí se dispute.
    function suspensionVigenteDe(jugador, ciclo, fechaPartido) {
        const dni = soloDigitosDni(jugador.dni);
        if (dni === '') return null;
        const orden = f => ordenCronologicoFecha(Number(f));
        const ordenPartido = orden(fechaPartido);

        return listaSanciones.find(s => {
            if (s.tipo !== 'Sanción Disciplinaria' || !(s.puntosRestados > 0) || s.levantada) return false;
            if (!s.jugadorId || soloDigitosDni(s.jugadorId) !== dni || (s.ciclo || 'superior') !== ciclo) return false;

            const ordenActa = orden(s.acta);
            // La suspensión corre desde la fecha siguiente a la del acta.
            if (ordenPartido <= ordenActa) return false;

            // De qué lado juega el equipo sancionado en cada partido (null si no es suyo).
            const nombreEquipo = (s.equipo || '').trim().toLowerCase();
            const ladoDelEquipo = pp => {
                if (s.equipoId != null) {
                    if (pp.localId === s.equipoId) return 'local';
                    if (pp.visitanteId === s.equipoId) return 'visita';
                }
                if (nombreEquipo === '') return null;
                if ((pp.local || '').trim().toLowerCase() === nombreEquipo) return 'local';
                if ((pp.visitante || '').trim().toLowerCase() === nombreEquipo) return 'visita';
                return null;
            };

            const fechasCumplidas = new Set();
            partidos.forEach(pp => {
                if ((pp.ciclo || 'superior') !== ciclo || !pp.jugado) return;
                const lado = ladoDelEquipo(pp);
                if (!lado) return;
                // Decisión de Joaquín (23/09/2026): si el equipo NO se presentó, esa fecha no le descuenta
                // suspensión, aunque el partido figure jugado por el 3-0 automático del Art. 17 Bis. Si sí se
                // presentó, el 3-0 sí cuenta: el jugador estuvo y cumplió la fecha.
                const asistencia = (tesoreriaPartidos[claveTesoreria(pp, lado)] || {}).asistencia || '';
                if (asistencia === 'sin_aviso' || asistencia === 'con_aviso') return;
                const o = orden(pp.fecha);
                if (o > ordenActa && o < ordenPartido) fechasCumplidas.add(Number(pp.fecha));
            });

            return fechasCumplidas.size < Number(s.puntosRestados);
        }) || null;
    }

    // Avisa cuando hay menos jugadores habilitados tildados que el mínimo para comenzar. Un suspendido tildado no cuenta.
    function textoAvisoMinimoBF(habilitados) {
        return habilitados < MINIMO_JUGADORES_PARTIDO
            ? `Faltan ${MINIMO_JUGADORES_PARTIDO - habilitados} para poder jugar (mínimo ${MINIMO_JUGADORES_PARTIDO})`
            : '';
    }

    function htmlListaBuenaFe(t, p) {
        const ciclo = p.ciclo || 'superior';
        const equipo = buscarEquipoBF(t.nombre, ciclo);
        if (!equipo) return '<div class="teso-nota">No se encontró este equipo en los planteles.</div>';
        const jugadores = equipo.jugadores || [];

        const presentes = p[campoAsistentes(t.lado)] || [];
        const totalPresentes = jugadores.filter(j => presentes.includes(idJugadorBF(j))).length;
        const habilitadosPresentes = jugadores.filter(j => presentes.includes(idJugadorBF(j)) && !suspensionVigenteDe(j, ciclo, p.fecha)).length;
        const totalFichas = jugadores.filter(j => j.fichaMedica === 'si').length;
        const abierto = bfAbiertos.has(t.clave) ? 'open' : '';
        const datos = `data-key="${t.clave}" data-pid="${p.id}" data-lado="${t.lado}" data-equipo="${attrSeguro(t.nombre)}" data-ciclo="${ciclo}"`;

        const filas = jugadores.map(j => {
            const id = attrSeguro(idJugadorBF(j));
            const presente = presentes.includes(idJugadorBF(j));
            const ficha = j.fichaMedica === 'si';
            const susp = suspensionVigenteDe(j, ciclo, p.fecha);
            const etiquetaSusp = susp ? `<span class="bf-tag-susp">SUSPENDIDO · Acta ${attrSeguro(susp.acta)} · ${susp.puntosRestados} ${Number(susp.puntosRestados) === 1 ? 'fecha' : 'fechas'}</span>` : '';
            return `
                <div class="bf-fila ${presente && (!ficha || susp) ? 'bf-fila-alerta' : ''}" data-susp="${susp ? 1 : 0}">
                    <div class="bf-jugador">
                        <span class="bf-nombre">${dorsalBF(j)} ${attrSeguro(j.nombre)}</span>
                        ${etiquetaSusp}
                        <span class="bf-dni">DNI ${attrSeguro(j.dni)}</span>
                    </div>
                    <label class="bf-check">
                        <input type="checkbox" class="bf-chk-asist" ${datos} data-jid="${id}" ${presente ? 'checked' : ''} aria-label="Asistió: ${attrSeguro(j.nombre)}">
                        <span class="bf-check-caja" aria-hidden="true"></span>
                    </label>
                    <button type="button" class="bf-btn bf-btn-ficha ${ficha ? 'bf-si' : 'bf-no'}" ${datos} data-jid="${id}" aria-pressed="${ficha}">${ficha ? 'OK' : 'FALTA'}</button>
                </div>`;
        }).join('');

        return `
            <details class="bf-detalle" data-key="${t.clave}" ${abierto}>
                <summary class="bf-resumen">
                    <span class="bf-titulo">Lista de buena fe</span>
                    <span class="bf-contadores"><span class="bf-cont-asist">Asistieron ${totalPresentes}/${jugadores.length}</span> · <span class="bf-cont-ficha">Fichas ${totalFichas}/${jugadores.length}</span></span>
                    <span class="bf-aviso-min">${textoAvisoMinimoBF(habilitadosPresentes)}</span>
                </summary>
                <div class="bf-encabezado"><span>Jugador</span><span>Asistió</span><span>Ficha</span></div>
                ${filas || '<div class="teso-nota">Este equipo todavía no tiene jugadores cargados.</div>'}
                <details class="bf-alta">
                    <summary class="bf-alta-titulo">+ Agregar jugador a la lista</summary>
                    <div class="bf-alta-campos" ${datos}>
                        <input type="text" class="bf-input bf-alta-nombre" placeholder="Nombre y apellido" maxlength="60" autocomplete="off" aria-label="Nombre y apellido">
                        <div class="bf-alta-fila">
                            <input type="text" inputmode="numeric" class="bf-input bf-alta-dni" placeholder="DNI (obligatorio)" maxlength="12" required autocomplete="off" aria-label="DNI">
                            <input type="number" inputmode="numeric" min="0" max="99" class="bf-input bf-alta-dorsal" placeholder="N° (0-99)" aria-label="Número de camiseta" required>
                        </div>
                        <button type="button" class="bf-btn bf-alta-guardar">AGREGAR Y MARCAR ASISTENCIA</button>
                        <span class="bf-alta-ayuda">Queda en el plantel con la ficha médica pendiente. DNI y número de camiseta son obligatorios; el resto de los datos se completa después en Equipos y Planteles.</span>
                    </div>
                </details>
            </details>`;
    }

    function actualizarContadoresBF(detalle) {
        const filas = detalle.querySelectorAll('.bf-fila');
        detalle.querySelector('.bf-cont-asist').textContent = `Asistieron ${detalle.querySelectorAll('.bf-chk-asist:checked').length}/${filas.length}`;
        detalle.querySelector('.bf-cont-ficha').textContent = `Fichas ${detalle.querySelectorAll('.bf-btn-ficha.bf-si').length}/${filas.length}`;
        let habilitados = 0;
        filas.forEach(fila => {
            const presente = fila.querySelector('.bf-chk-asist').checked;
            const ficha = fila.querySelector('.bf-btn-ficha').classList.contains('bf-si');
            const suspendido = fila.dataset.susp === '1';
            if (presente && !suspendido) habilitados++;
            fila.classList.toggle('bf-fila-alerta', presente && (!ficha || suspendido));
        });
        detalle.querySelector('.bf-aviso-min').textContent = textoAvisoMinimoBF(habilitados);
    }

    // Si algún jugador figura en la lista, el equipo se presentó: se sincroniza la asistencia del equipo (Art. 17 Bis).
    // Lo puesto así se marca como automático para poder deshacerlo si se destilda a todos. Devuelve true si cambió.
    function sincronizarPresenciaEquipoBF(p, lado, clave) {
        const cantidad = (p[campoAsistentes(lado)] || []).length;
        if (!tesoreriaPartidos[clave]) tesoreriaPartidos[clave] = { ef: 0, tr: 0 };
        const d = tesoreriaPartidos[clave];
        if (cantidad > 0 && d.asistencia !== 'presente') {
            d.asistencia = 'presente';
            d.asistenciaAuto = true;
            guardarTesoreriaPartidos();
            return true;
        }
        if (cantidad === 0 && d.asistenciaAuto) {
            delete d.asistenciaAuto;
            if (d.asistencia === 'presente') d.asistencia = '';
            guardarTesoreriaPartidos();
            return true;
        }
        return false;
    }

    // Tildar o destildar solo actualiza esa fila (no se redibuja la tarjeta): así el staff no pierde el scroll
    // ni la lista abierta mientras marca jugador tras jugador. Solo se redibuja si cambió la asistencia del equipo.
    function marcarAsistenciaBF(chk) {
        const p = partidos.find(x => String(x.id) === chk.dataset.pid);
        if (!p) return;

        // Decisión de Joaquín (23/09/2026): un jugador suspendido no puede figurar en la lista de
        // buena fe de esa fecha. Se bloquea sólo tildarlo: destildar siempre queda habilitado, por
        // si el Tribunal carga la sanción después de que el staff ya lo había marcado presente.
        if (chk.checked) {
            const equipoChk = buscarEquipoBF(chk.dataset.equipo, chk.dataset.ciclo);
            const jugadorChk = equipoChk && (equipoChk.jugadores || []).find(j => idJugadorBF(j) === chk.dataset.jid);
            const suspChk = jugadorChk && suspensionVigenteDe(jugadorChk, chk.dataset.ciclo, p.fecha);
            if (suspChk) {
                chk.checked = false;
                alert(`${jugadorChk.nombre} está suspendido en esta fecha (Acta ${suspChk.acta}): no puede jugar ni figurar en la lista de buena fe.`);
                return;
            }
        }

        const campo = campoAsistentes(chk.dataset.lado);
        const resto = (p[campo] || []).filter(x => x !== chk.dataset.jid);
        p[campo] = chk.checked ? [...resto, chk.dataset.jid] : resto;
        guardarPartidosBF();
        if (sincronizarPresenciaEquipoBF(p, chk.dataset.lado, chk.dataset.key)) {
            renderizarTesoreriaPartidos();
            calcularBalanceGeneral();
            return;
        }
        actualizarContadoresBF(chk.closest('.bf-detalle'));
    }

    function alternarFichaBF(btn) {
        recargarPools();
        const equipo = buscarEquipoBF(btn.dataset.equipo, btn.dataset.ciclo);
        const jugador = equipo && (equipo.jugadores || []).find(j => idJugadorBF(j) === btn.dataset.jid);
        if (!jugador) return;
        jugador.fichaMedica = jugador.fichaMedica === 'si' ? 'no' : 'si';
        guardarEquiposEnStorage();
        const entregada = jugador.fichaMedica === 'si';
        document.querySelectorAll('.bf-btn-ficha').forEach(otro => {
            if (otro.dataset.jid === btn.dataset.jid && otro.dataset.equipo === btn.dataset.equipo && otro.dataset.ciclo === btn.dataset.ciclo) {
                otro.classList.toggle('bf-si', entregada);
                otro.classList.toggle('bf-no', !entregada);
                otro.textContent = entregada ? 'OK' : 'FALTA';
                otro.setAttribute('aria-pressed', String(entregada));
                actualizarContadoresBF(otro.closest('.bf-detalle'));
            }
        });
        if (typeof renderizarTablaJugadores === 'function') renderizarTablaJugadores();
        if (typeof renderizarResumenStaff === 'function') renderizarResumenStaff();
    }

    const soloDigitosDni = s => String(s).replace(/\D/g, '');

    function buscarDniEnTorneo(dni, ignorar) {
        const digitos = soloDigitosDni(dni);
        if (digitos === '') return null;
        for (const [ciclo, pool] of [['superior', poolSuperior], ['basico', poolBasico]]) {
            for (const equipo of pool || []) {
                const jugador = (equipo.jugadores || []).find(j => j !== ignorar && soloDigitosDni(j.dni) === digitos);
                if (jugador) return { equipo, ciclo, jugador };
            }
        }
        return null;
    }

    // "Jugó con su equipo" = figura tildado en la lista de buena fe de cualquier partido de ese equipo (jugado o no todavía).
    function jugoConSuEquipo(hallado) {
        const digitos = soloDigitosDni(hallado.jugador.dni);
        const nombreEquipo = hallado.equipo.nombre.trim().toLowerCase();
        return partidos.some(p => {
            if ((p.ciclo || 'superior') !== hallado.ciclo) return false;
            const esLocal = (hallado.equipo.id != null && p.localId === hallado.equipo.id) || (p.local || '').trim().toLowerCase() === nombreEquipo;
            const esVisita = (hallado.equipo.id != null && p.visitanteId === hallado.equipo.id) || (p.visitante || '').trim().toLowerCase() === nombreEquipo;
            const tildados = [...(esLocal ? p.asistentesLocal || [] : []), ...(esVisita ? p.asistentesVisitante || [] : [])];
            return tildados.some(id => soloDigitosDni(id) === digitos);
        });
    }

    // Reglas de datos de un jugador (decididas por Joaquín): el número de camiseta no se repite dentro del equipo (los goles
    // se cargan por número) y el DNI es único en TODO el torneo. Un DNI ya inscripto en otro equipo solo puede pasar a este
    // si todavía no jugó ningún partido con el suyo (devuelve "traslado" para que quien llama pida confirmación y lo mueva).
    // "ignorar" es el jugador que se está editando: no choca consigo mismo y en edición no se permite trasladar.
    // Devuelve { error, traslado }.
    function validarJugadorEnTorneo(equipo, dni, dorsal, ignorar) {
        const otros = (equipo.jugadores || []).filter(j => j !== ignorar);
        if (otros.some(j => j.dorsal !== undefined && j.dorsal !== null && String(j.dorsal).trim() !== '' && Number(j.dorsal) === Number(dorsal))) {
            return { error: `El número ${dorsal} ya lo tiene otro jugador de este equipo (los goles se cargan por número de camiseta).` };
        }
        const hallado = buscarDniEnTorneo(dni, ignorar);
        if (!hallado) return {};
        if (hallado.equipo === equipo) return { error: 'Ese DNI ya está en la lista de este equipo.' };
        if (ignorar) return { error: `Ese DNI ya está inscripto en ${hallado.equipo.nombre}.` };
        if (jugoConSuEquipo(hallado)) {
            return { error: `Ese DNI ya está inscripto en ${hallado.equipo.nombre} y ya jugó con ese equipo, por eso no puede jugar en otro.` };
        }
        return { traslado: hallado };
    }

    function textoConfirmarTraslado(hallado, equipoDestino) {
        return `${hallado.jugador.nombre} (DNI ${hallado.jugador.dni}) está inscripto en ${hallado.equipo.nombre} y todavía no jugó ningún partido con ese equipo. ¿Pasarlo a ${equipoDestino.nombre}? Se lo saca de ${hallado.equipo.nombre}.`;
    }

    // Alta de un jugador en el momento (antes se anotaba a mano en el espacio en blanco de la planilla).
    // Queda en el plantel del equipo y ya marcado como presente en este partido.
    function agregarJugadorEnCancha(btn) {
        const caja = btn.closest('.bf-alta-campos');
        const nombre = caja.querySelector('.bf-alta-nombre').value.trim();
        const dni = caja.querySelector('.bf-alta-dni').value.trim();
        const dorsalTxt = caja.querySelector('.bf-alta-dorsal').value.trim();
        if (!nombre) { alert('Escribí el nombre del jugador.'); return; }
        if (!dni) { alert('El DNI es obligatorio: no se puede agregar un jugador sin DNI.'); return; }
        const numeroCamiseta = Number(dorsalTxt);
        if (dorsalTxt === '' || !Number.isInteger(numeroCamiseta) || numeroCamiseta < 0 || numeroCamiseta > 99) {
            alert('El número de camiseta es obligatorio y va de 0 a 99.');
            return;
        }

        recargarPools();
        const equipo = buscarEquipoBF(caja.dataset.equipo, caja.dataset.ciclo);
        if (!equipo) { alert('No se encontró el equipo en los planteles.'); return; }
        if (!equipo.jugadores) equipo.jugadores = [];

        const validacion = validarJugadorEnTorneo(equipo, dni, numeroCamiseta, null);
        if (validacion.error) { alert(validacion.error); return; }
        const traslado = validacion.traslado;
        if (traslado && !confirm(textoConfirmarTraslado(traslado, equipo))) return;
        if (equipo.jugadores.length >= MAX_JUGADORES_LISTA && !confirm(`${equipo.nombre} ya tiene ${equipo.jugadores.length} jugadores y el reglamento permite un máximo de ${MAX_JUGADORES_LISTA} en la lista. ¿Agregarlo igual?`)) return;

        let nuevo = {
            nombre, dni, dorsal: numeroCamiseta,
            instagram: '', foto: '', fichaMedica: 'no', nacimiento: '', celular: '',
            concurrir: '', concurrirDir: '', medico: '', medicoDir: '',
            familiarNombre: '', familiarParentesco: '', familiarTel: '',
            goles: 0, amarillas: 0, rojas: 0
        };
        if (traslado) {
            traslado.equipo.jugadores = traslado.equipo.jugadores.filter(j => j !== traslado.jugador);
            nuevo = { ...traslado.jugador, dorsal: numeroCamiseta };
        }
        equipo.jugadores.push(nuevo);
        guardarEquiposEnStorage();
        registrarHistorial('jugador', traslado
            ? `pasó a ${textoJugadorHistorial(nuevo)} de ${traslado.equipo.nombre} a ${equipo.nombre} (en cancha, desde la lista de buena fe)`
            : `dio de alta a ${textoJugadorHistorial(nuevo)} en ${equipo.nombre} (en cancha, desde la lista de buena fe)`);

        const p = partidos.find(x => String(x.id) === caja.dataset.pid);
        if (p) {
            const campo = campoAsistentes(caja.dataset.lado);
            p[campo] = [...(p[campo] || []), idJugadorBF(nuevo)];
            guardarPartidosBF();
            sincronizarPresenciaEquipoBF(p, caja.dataset.lado, caja.dataset.key);
        }
        bfAbiertos.add(caja.dataset.key);
        renderizarTesoreriaPartidos();
        calcularBalanceGeneral();
        if (typeof renderizarTablaJugadores === 'function') renderizarTablaJugadores();
        if (typeof renderizarResumenStaff === 'function') renderizarResumenStaff();
    }

    function htmlCajaEquipoTeso(t, ev, faseLabel, hist, p) {
        const dinero = n => `$${Math.round(n).toLocaleString()}`;
        const cancelado = t.falta <= 0;
        const sancion = ev.sanciones.find(s => s.t.clave === t.clave);
        const registro = listaSanciones.find(x => x.origenAuto && x.claveTeso === t.clave);
        const descartada = !!(t.data && t.data.sancionDescartada);

        let chip = '';
        if (descartada) {
            chip = '<div class="teso-chip teso-chip-gris">Sanción automática descartada por un administrador.</div>';
        } else if (sancion && sancion.activa) {
            chip = `<div class="teso-chip teso-chip-rojo">${t.ausente ? `-${PUNTOS_QUITA_AUSENCIA} PTS en la tabla hasta abonar el 50%` : `Queda como no presentado: -${PUNTOS_QUITA_AUSENCIA} PTS en la tabla`}</div>`;
        } else if (registro && registro.levantada) {
            chip = `<div class="teso-chip teso-chip-verde">(${attrSeguro(registro.fechaLevantada)}) Quita levantada: pagó el 50%</div>`;
        }

        const notas = [];
        if (t.ausente) notas.push(ev.esPlayoff ? 'Ausente en Play-Offs: queda eliminado y no abona derecho de partido.' : `Ausente: debe el 50% del derecho de partido (${dinero(t.exigidoBruto)}).`);
        if (t.saldoAplicado > 0) notas.push(`Saldo a favor aplicado: -${dinero(t.saldoAplicado)}.`);
        if (t.saldoGenerado > 0) notas.push(`Le queda saldo a favor de ${dinero(t.saldoGenerado)} para su próxima fecha.`);
        const notasHtml = notas.map(n => `<div class="teso-nota">${n}</div>`).join('');

        const opcion = (valor, texto) => `<option value="${valor}" ${t.asistencia === valor ? 'selected' : ''}>${texto}</option>`;
        const badgeDeuda = hist.deudaTotal > 0
            ? `<div style="font-family:'Michroma',sans-serif; font-size:11px; color:#f2c00e; background:rgba(242, 192, 14,0.1); padding:7px 8px; border-radius:2px; border:1px solid rgba(242, 192, 14,0.3); margin-top:8px; text-align:center; line-height:1.5;">Arrastra deuda de $${hist.deudaTotal.toLocaleString()} (${hist.fechasDeuda.join(', ')})</div>`
            : '';

        return `
            <div class="teso-team-box">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <span class="teso-team-name">${attrSeguro(t.nombre)}</span>
                    <span style="font-family:'Michroma',sans-serif; font-size:${cancelado ? '11px' : '15px'}; color:${cancelado ? '#4ade80' : '#f43f5e'};">
                        ${cancelado ? 'CANCELADO' : `FALTA: $${t.falta.toLocaleString()}`}
                    </span>
                </div>
                <div class="teso-inputs-row">
                    <label>Asistencia:</label>
                    <select class="select-asist-teso in-p-asist" data-key="${t.clave}">
                        ${opcion('', 'Sin registrar')}
                        ${opcion('presente', 'Se presentó')}
                        ${opcion('sin_aviso', 'Faltó sin aviso')}
                        ${opcion('con_aviso', 'Faltó con aviso')}
                    </select>
                </div>
                <div class="teso-inputs-row">
                    <label>Arancel Exigido ($):</label>
                    <input type="number" class="input-monto-teso in-p-arancel" data-key="${t.clave}" value="${t.arancelBase}">
                </div>
                <div class="teso-inputs-row">
                    <label>Pago Efectivo ($):</label>
                    <input type="number" class="input-monto-teso in-p-ef" data-key="${t.clave}" data-equipo="${attrSeguro(t.nombre)}" data-fase="${faseLabel}" value="${t.data.ef || 0}">
                </div>
                <div class="teso-inputs-row">
                    <label>Pago Transf. ($):</label>
                    <input type="number" class="input-monto-teso in-p-tr" data-key="${t.clave}" data-equipo="${attrSeguro(t.nombre)}" data-fase="${faseLabel}" value="${t.data.tr || 0}">
                </div>
                ${notasHtml}
                ${chip}
                ${badgeDeuda}
                ${htmlListaBuenaFe(t, p)}
            </div>
        `;
    }

    function obtenerPartidosFiltradosTeso() {
        const filtroFecha = filtroTesoreriaFecha ? filtroTesoreriaFecha.value : 'todas';
        const filtroCancha = filtroTesoreriaCancha ? filtroTesoreriaCancha.value : 'todas';
        let lista = filtroFecha === 'todas' ? [...partidos] : partidos.filter(p => p.fecha.toString() === filtroFecha.toString());
        if (filtroCancha !== 'todas') lista = lista.filter(p => (p.cancha || 'Cancha a confirmar') === filtroCancha);
        return lista;
    }

    // Vista imprimible de la planilla de buena fe (respaldo en papel): una hoja A4 apaisada por partido,
    // con las columnas de la planilla que se usaba (Jugador, DNI, N°, Firma) y filas en blanco
    // hasta completar 10 para anotar a mano a quien se sume en el momento.
    function htmlPlanillaEquipo(nombre, ciclo, fecha) {
        const equipo = buscarEquipoBF(nombre, ciclo);
        const jugadores = (equipo && equipo.jugadores) || [];
        const cantidadFilas = Math.max(MAX_JUGADORES_LISTA, jugadores.length);
        let filas = '';
        for (let i = 0; i < cantidadFilas; i++) {
            const j = jugadores[i];
            const susp = j ? suspensionVigenteDe(j, ciclo, fecha) : null;
            const celdaFirma = susp ? `<td class="plan-firma plan-susp">SUSPENDIDO · Acta ${attrSeguro(susp.acta)}</td>` : '<td class="plan-firma"></td>';
            filas += `<tr><td class="plan-jugador">${j ? attrSeguro(j.nombre) : ''}</td><td>${j ? attrSeguro(j.dni) : ''}</td><td class="plan-centro">${j ? attrSeguro(j.dorsal ?? '') : ''}</td>${celdaFirma}</tr>`;
        }
        return `<table class="plan-tabla"><thead><tr><th colspan="4" class="plan-equipo">Equipo: ${attrSeguro(nombre)}</th></tr><tr><th>Jugador</th><th>DNI</th><th>N°</th><th>Firma</th></tr></thead><tbody>${filas}</tbody></table>`;
    }

    function htmlPlanillaPartido(p) {
        const ciclo = p.ciclo || 'superior';
        const hora = p.horario ? `${attrSeguro(p.horario)} hs` : 'horario a confirmar';
        return `
            <section class="plan-hoja">
                <h2 class="plan-titulo">MITRE LEAGUE — Planilla de buena fe</h2>
                <p class="plan-partido">${attrSeguro(p.local)} VS ${attrSeguro(p.visitante)} — ${attrSeguro(nombreFaseTeso(p.fecha))} — ${attrSeguro(p.cancha || 'Cancha a confirmar')} — ${hora}</p>
                <div class="plan-equipos">${htmlPlanillaEquipo(p.local, ciclo, p.fecha)}${htmlPlanillaEquipo(p.visitante, ciclo, p.fecha)}</div>
            </section>`;
    }

    function imprimirPlanillas(lista) {
        const aImprimir = lista.filter(p => p && p.local && p.visitante).sort((a, b) => ordenCronologicoFecha(a.fecha) - ordenCronologicoFecha(b.fecha));
        if (aImprimir.length === 0) { alert('No hay partidos para imprimir con este filtro.'); return; }
        recargarPools();
        let contenedor = document.getElementById('vista-imprimible');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'vista-imprimible';
            document.body.appendChild(contenedor);
        }
        contenedor.innerHTML = aImprimir.map(htmlPlanillaPartido).join('');
        window.print();
    }

    function renderizarTesoreriaPartidos() {
        const contenedor = document.getElementById('contenedor-tesoreria-partidos-cards');
        if (!contenedor) return;

        recargarPools();
        const { calc, evaluaciones } = sincronizarAusencias();
        contenedor.innerHTML = '';

        const partidosFiltrados = obtenerPartidosFiltradosTeso();

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px; padding:20px;">No hay partidos cargados para este filtro.</p>';
            return;
        }

        partidosFiltrados.sort((a, b) => ordenCronologicoFecha(a.fecha) - ordenCronologicoFecha(b.fecha));

        contenedor.innerHTML = partidosFiltrados.map(p => {
            if (!p || !p.local || !p.visitante) return '';
            const ev = evaluaciones[p.id];
            const faseLabel = nombreFaseTeso(p.fecha);
            const avisosHtml = ev.avisos.map(a => `<div class="teso-aviso teso-aviso-${a.tipo}">${attrSeguro(a.texto)}</div>`).join('');

            return `
                <div class="teso-match-card">
                    <div class="teso-match-header">
                        <span><strong>${faseLabel}</strong> — ${attrSeguro(p.cancha || 'Cancha a confirmar')} (${p.horario ? attrSeguro(p.horario) + ' hs' : 'A confirmar'})</span>
                        <span>Árbitro: <strong>${attrSeguro(p.arbitro || 'Por Asignar')}</strong></span>
                        <button type="button" class="teso-btn-imprimir" data-pid="${p.id}">Imprimir planilla</button>
                    </div>

                    <div class="teso-match-teams-grid">
                        ${htmlCajaEquipoTeso(ev.L, ev, faseLabel, obtenerDeudaHistorica(calc, equipoTeso(p, 'local'), p.fecha), p)}
                        ${htmlCajaEquipoTeso(ev.V, ev, faseLabel, obtenerDeudaHistorica(calc, equipoTeso(p, 'visita'), p.fecha), p)}
                    </div>
                    ${avisosHtml ? `<div class="teso-avisos-partido">${avisosHtml}</div>` : ''}
                </div>
            `;
        }).join('');

        document.querySelectorAll('.in-p-asist').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                if (!tesoreriaPartidos[key]) tesoreriaPartidos[key] = { ef: 0, tr: 0 };
                tesoreriaPartidos[key].asistencia = e.target.value;
                delete tesoreriaPartidos[key].asistenciaAuto;
                guardarTesoreriaPartidos();
                renderizarTesoreriaPartidos();
                calcularBalanceGeneral();
            });
        });

        document.querySelectorAll('.in-p-arancel').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                if (!tesoreriaPartidos[key]) tesoreriaPartidos[key] = { ef: 0, tr: 0 };
                tesoreriaPartidos[key].arancel = parseFloat(e.target.value) || 0;
                guardarTesoreriaPartidos();
                renderizarTesoreriaPartidos();
                calcularBalanceGeneral();
            });
        });

        document.querySelectorAll('.in-p-ef').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                if (!tesoreriaPartidos[key]) tesoreriaPartidos[key] = { ef: 0, tr: 0 };
                const valorAnterior = tesoreriaPartidos[key].ef || 0;
                const valorNuevo = parseFloat(e.target.value) || 0;
                tesoreriaPartidos[key].ef = valorNuevo;
                guardarTesoreriaPartidos();
                registrarMovimientoCaja({ equipo: e.target.dataset.equipo, concepto: 'Arancel de Partido', detalle: e.target.dataset.fase, medio: 'Efectivo', monto: valorNuevo - valorAnterior });
                renderizarTesoreriaPartidos();
                calcularBalanceGeneral();
            });
        });

        document.querySelectorAll('.in-p-tr').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                if (!tesoreriaPartidos[key]) tesoreriaPartidos[key] = { ef: 0, tr: 0 };
                const valorAnterior = tesoreriaPartidos[key].tr || 0;
                const valorNuevo = parseFloat(e.target.value) || 0;
                tesoreriaPartidos[key].tr = valorNuevo;
                guardarTesoreriaPartidos();
                registrarMovimientoCaja({ equipo: e.target.dataset.equipo, concepto: 'Arancel de Partido', detalle: e.target.dataset.fase, medio: 'Transferencia', monto: valorNuevo - valorAnterior });
                renderizarTesoreriaPartidos();
                calcularBalanceGeneral();
            });
        });
    }

    if (filtroTesoreriaFecha) filtroTesoreriaFecha.addEventListener('change', renderizarTesoreriaPartidos);
    if (filtroTesoreriaCancha) filtroTesoreriaCancha.addEventListener('change', renderizarTesoreriaPartidos);

    const btnImprimirPlanillas = document.getElementById('btn-imprimir-planillas');
    if (btnImprimirPlanillas) btnImprimirPlanillas.addEventListener('click', () => imprimirPlanillas(obtenerPartidosFiltradosTeso()));

    const contenedorTesoPartidos = document.getElementById('contenedor-tesoreria-partidos-cards');
    if (contenedorTesoPartidos) {
        contenedorTesoPartidos.addEventListener('click', (e) => {
            const btnImprimir = e.target.closest('.teso-btn-imprimir');
            if (btnImprimir) {
                imprimirPlanillas(partidos.filter(x => String(x.id) === btnImprimir.dataset.pid));
                return;
            }
            const btn = e.target.closest('.bf-btn');
            if (!btn) return;
            if (btn.classList.contains('bf-btn-ficha')) alternarFichaBF(btn);
            else if (btn.classList.contains('bf-alta-guardar')) agregarJugadorEnCancha(btn);
        });
        contenedorTesoPartidos.addEventListener('change', (e) => {
            if (e.target.classList && e.target.classList.contains('bf-chk-asist')) marcarAsistenciaBF(e.target);
        });
        contenedorTesoPartidos.addEventListener('toggle', (e) => {
            if (!e.target.classList || !e.target.classList.contains('bf-detalle')) return;
            const key = e.target.dataset.key;
            if (e.target.open) bfAbiertos.add(key);
            else bfAbiertos.delete(key);
        }, true);
    }

    function actualizarFiltroFechasTesoreria() {
        actualizarFiltroCanchasTesoreria();
        const selectFechas = document.getElementById('filtro-tesoreria-fecha');
        if (!selectFechas) return;

        const valorActual = selectFechas.value || 'todas';
        selectFechas.innerHTML = '<option value="todas">Todas las Fechas</option>';

        if (partidos.length === 0) return;

        const fechasUnicas = [...new Set(partidos.map(p => p.fecha))].sort((a, b) => ordenCronologicoFecha(a) - ordenCronologicoFecha(b));
        fechasUnicas.forEach(f => {
            let label = `Fecha ${f}`;
            if (f === 108 || f === '108') label = "8vos de Final";
            else if (f === 104 || f === '104') label = "Cuartos de Final";
            else if (f === 102 || f === '102') label = "Semifinal";
            else if (f === 100 || f === '100') label = "Gran Final";

            selectFechas.innerHTML += `<option value="${f}">${label}</option>`;
        });

        selectFechas.value = valorActual;
    }

    function actualizarFiltroCanchasTesoreria() {
        if (!filtroTesoreriaCancha) return;
        const valorActual = filtroTesoreriaCancha.value || 'todas';
        const canchas = [...new Set(partidos.map(p => p.cancha || 'Cancha a confirmar'))].sort();
        filtroTesoreriaCancha.innerHTML = '<option value="todas">Todas las Canchas</option>' +
            canchas.map(c => `<option value="${attrSeguro(c)}">${attrSeguro(c)}</option>`).join('');
        filtroTesoreriaCancha.value = canchas.includes(valorActual) ? valorActual : 'todas';
    }

    // Egresos. Cada uno puede ser de una fecha del torneo (mismo número que los partidos: '1', '2'… y
    // '108'/'104'/'102'/'100' en playoffs) o general del torneo (fecha vacía o ausente, por ejemplo premios).
    const selectEgresoFecha = document.getElementById('egreso-fecha');
    armarOpcionesFechaEgreso();

    function textoFechaEgreso(eg) {
        return eg.fecha ? nombreFaseTeso(eg.fecha) : 'GENERAL DEL TORNEO';
    }

    const formEgreso = document.getElementById('form-egreso');
    if (formEgreso) {
        formEgreso.addEventListener('submit', (e) => {
            e.preventDefault();
            const nuevoEgreso = {
                id: Date.now(),
                concepto: document.getElementById('egreso-concepto').value,
                detalle: document.getElementById('egreso-detalle').value.trim(),
                monto: parseFloat(document.getElementById('egreso-monto').value) || 0,
                medio: document.getElementById('egreso-medio').value,
                fecha: selectEgresoFecha ? selectEgresoFecha.value : ''
            };
            listaEgresos.push(nuevoEgreso);
            almacen.setItem('liga_egresos', JSON.stringify(listaEgresos));
            formEgreso.reset();
            renderizarEgresosAdmin();
            calcularBalanceGeneral();
            alert('Egreso registrado.');
        });
    }

    function renderizarEgresosAdmin() {
        const contenedor = document.getElementById('lista-egresos-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaEgresos.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay egresos cargados.</p>';
            return;
        }

        listaEgresos.forEach(eg => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(244,63,94,0.05); padding:8px 12px; margin-bottom:6px; border-radius:3px; border-left: 4px solid #f43f5e;">
                    <div style="text-align:left;">
                        <span style="font-size:11px; color:white; font-weight:bold;">${attrSeguro(eg.detalle)} (${attrSeguro(eg.concepto.toUpperCase())})</span>
                        <span style="font-size:9px; color:#fca5a5; display:block;">Medio: ${attrSeguro(eg.medio.toUpperCase())} · ${textoFechaEgreso(eg)}</span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="font-size:13px; color:#f43f5e; font-weight:bold;">-$${eg.monto.toLocaleString()}</span>
                        <button class="btn-borrar-egreso" data-id="${eg.id}" style="background-color:#991b1b; color:white; border:none; padding:3px 6px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-egreso').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaEgresos = listaEgresos.filter(e => e.id !== idBorrar);
                almacen.setItem('liga_egresos', JSON.stringify(listaEgresos));
                renderizarEgresosAdmin();
                calcularBalanceGeneral();
            });
        });
    }

    function calcularBalanceGeneral() {
        let efTotal = 0;
        let trTotal = 0;
        let totalInscripciones = 0;
        let totalPartidos = 0;

        Object.values(tesoreriaInscripciones).forEach(p => {
            const ef = p.ef || 0;
            const tr = p.tr || 0;
            efTotal += ef;
            trTotal += tr;
            totalInscripciones += (ef + tr);
        });

        Object.values(tesoreriaPartidos).forEach(p => {
            const ef = p.ef || 0;
            const tr = p.tr || 0;
            efTotal += ef;
            trTotal += tr;
            totalPartidos += (ef + tr);
        });

        let egresosTotal = 0;
        listaEgresos.forEach(eg => {
            egresosTotal += (eg.monto || 0);
        });

        const neto = (efTotal + trTotal) - egresosTotal;

        if (document.getElementById('txt-total-inscripciones')) document.getElementById('txt-total-inscripciones').textContent = `$${totalInscripciones.toLocaleString()}`;
        if (document.getElementById('txt-total-partidos')) document.getElementById('txt-total-partidos').textContent = `$${totalPartidos.toLocaleString()}`;
        if (document.getElementById('txt-total-egresos')) document.getElementById('txt-total-egresos').textContent = `-$${egresosTotal.toLocaleString()}`;
        if (document.getElementById('txt-saldo-neto')) document.getElementById('txt-saldo-neto').textContent = `$${neto.toLocaleString()}`;
        const txtBonificado = document.getElementById('txt-bonificado-inscripciones');
        if (txtBonificado) {
            const { bonificado } = totalesInscripciones();
            txtBonificado.textContent = bonificado > 0 ? `Bonificado: $${bonificado.toLocaleString()} (no suma)` : '';
        }
        renderizarRecaudacionPorFecha();
    }

    // RECAUDACIÓN POR FECHA (EXCLUSIVO COORDINADOR): aranceles cobrados y egresos de cada fecha del torneo.
    // Las inscripciones y los egresos generales no son de una fecha: van solo en el total, que tiene que
    // coincidir con el "Saldo Caja Neto" del Balance Central de Caja.
    function renderizarRecaudacionPorFecha() {
        const contenedor = document.getElementById('contenedor-recaudacion-fecha');
        if (!contenedor) return;

        const porFecha = {};
        const filaDe = f => porFecha[f] || (porFecha[f] = { partidos: 0, aranceles: 0, egresos: 0 });
        const clavesContadas = new Set();
        partidos.forEach(p => {
            if (!p || !p.local || !p.visitante) return;
            const fila = filaDe(String(p.fecha));
            fila.partidos++;
            ['local', 'visita'].forEach(lado => {
                const clave = claveTesoreria(p, lado);
                if (clavesContadas.has(clave)) return;
                clavesContadas.add(clave);
                const d = tesoreriaPartidos[clave] || {};
                fila.aranceles += (d.ef || 0) + (d.tr || 0);
            });
        });

        // Pagos cargados en un partido que después se borró (o se le cambió la fecha o un equipo) antes del
        // 29/09/2026, cuando eso todavía se permitía: el Balance los sigue sumando, así que se listan aparte
        // para que el total cierre igual y se puedan rastrear.
        let sinPartido = 0;
        const sueltos = [];
        Object.keys(tesoreriaPartidos).forEach(clave => {
            if (clavesContadas.has(clave)) return;
            const monto = montoTeso(tesoreriaPartidos[clave]);
            if (!monto) return;
            sinPartido += monto;
            const partes = clave.match(/^F([^_]*)_[^_]*_(?:local|visita)_(.*)$/);
            const idEquipo = partes && /^eq/.test(partes[2]) ? partes[2].slice(2) : null;
            const equipo = idEquipo !== null ? [...(poolSuperior || []), ...(poolBasico || [])].find(e => String(e.id) === idEquipo) : null;
            sueltos.push({ equipo: equipo ? equipo.nombre : clave, fecha: partes ? nombreFaseTeso(partes[1]) : '', monto });
        });

        let egresosGenerales = 0;
        listaEgresos.forEach(eg => {
            if (eg.fecha) filaDe(String(eg.fecha)).egresos += (eg.monto || 0);
            else egresosGenerales += (eg.monto || 0);
        });

        const fechas = Object.keys(porFecha).sort((a, b) => ordenCronologicoFecha(a) - ordenCronologicoFecha(b));
        const dinero = n => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString()}`;
        const filaMonto = (etiqueta, monto, clase) => `
            <div class="teso-recaud-fila"><span>${etiqueta}</span><strong class="${clase}">${dinero(monto)}</strong></div>`;

        const tarjetas = fechas.map(f => {
            const r = porFecha[f];
            const neto = r.aranceles - r.egresos;
            return `
                <div class="teso-team-box teso-recaud-card" data-fecha="${attrSeguro(f)}">
                    <div class="teso-recaud-titulo">
                        <span class="teso-team-name">${nombreFaseTeso(f)}</span>
                        <span class="teso-nota">${r.partidos} partido${r.partidos === 1 ? '' : 's'}</span>
                    </div>
                    ${filaMonto('Aranceles cobrados', r.aranceles, 'teso-recaud-ingreso')}
                    ${filaMonto('Egresos de la fecha', -r.egresos, 'teso-recaud-egreso')}
                    <div class="teso-recaud-fila teso-recaud-neto"><span>Neto de la fecha</span><strong class="${neto < 0 ? 'teso-recaud-egreso' : ''}">${dinero(neto)}</strong></div>
                </div>
            `;
        }).join('');

        const arancelesTotal = fechas.reduce((acc, f) => acc + porFecha[f].aranceles, 0) + sinPartido;
        const egresosPorFecha = fechas.reduce((acc, f) => acc + porFecha[f].egresos, 0);
        const { cobrado: inscripciones, bonificado } = totalesInscripciones();
        const netoTotal = arancelesTotal + inscripciones - egresosPorFecha - egresosGenerales;

        contenedor.innerHTML = `
            ${tarjetas ? `<div class="teso-recaud-grid">${tarjetas}</div>` : '<p class="teso-nota" style="text-align:center; padding:15px;">Todavía no hay partidos ni egresos con fecha.</p>'}
            <div class="teso-team-box teso-recaud-total">
                <span class="teso-recaud-total-titulo">Total del torneo</span>
                ${filaMonto('Aranceles de todas las fechas', arancelesTotal, 'teso-recaud-ingreso')}
                ${sinPartido ? `<div class="teso-recaud-sueltos">
                    <p class="teso-nota">Incluye ${dinero(sinPartido)} cargados en partidos que ya no existen (se borraron o se les cambió la fecha o un equipo antes de que el panel lo impidiera). Detalle para rastrearlos:</p>
                    ${sueltos.map(s => `<div class="teso-recaud-fila teso-recaud-suelto"><span>${attrSeguro(s.equipo)}${s.fecha ? ' · ' + attrSeguro(s.fecha) : ''}</span><strong>${dinero(s.monto)}</strong></div>`).join('')}
                </div>` : ''}
                ${filaMonto('Inscripciones cobradas', inscripciones, 'teso-recaud-ingreso')}
                ${filaMonto('Egresos por fecha', -egresosPorFecha, 'teso-recaud-egreso')}
                ${filaMonto('Egresos generales del torneo', -egresosGenerales, 'teso-recaud-egreso')}
                <div class="teso-recaud-fila teso-recaud-neto"><span>Neto total</span><strong id="txt-recaud-neto-total" class="${netoTotal < 0 ? 'teso-recaud-egreso' : ''}">${dinero(netoTotal)}</strong></div>
                ${bonificado > 0 ? `<div class="teso-recaud-fila teso-recaud-bonif"><span>Bonificado en inscripciones (informativo, no suma)</span><span>${dinero(bonificado)}</span></div>` : ''}
            </div>
        `;
    }

    // ============================================================
    // 7 bis. CALCULADORA DE ARANCEL RECOMENDADO (Solo Admin)
    // Herramienta de planificación, no de registro: estima cuánto cobrarle
    // a cada equipo ANTES de una jornada, para cubrir los egresos previstos
    // de esa fecha puntual aunque falte un % de equipos, más un margen.
    // No usa `liga_egresos` (esa lista es un histórico acumulado de todo el
    // torneo, sin fecha por gasto, para el Balance Central de Caja) ni
    // toca `liga_tesoreria_partidos_v2`: el arancel de cada partido lo
    // sigue cargando el admin a mano en "Aranceles por Partido". Guarda su
    // configuración aparte en `liga_calculadora_arancel`.
    // ============================================================
    let configCalculadoraArancel = JSON.parse(almacen.getItem('liga_calculadora_arancel')) || {};

    const CAMPOS_CALC_EGRESOS = ['calc-egreso-canchas', 'calc-egreso-arbitros', 'calc-egreso-pelotas', 'calc-egreso-premios', 'calc-egreso-otros'];
    const elCalcCiclo = document.getElementById('calc-ciclo');
    const elCalcCantidadEquipos = document.getElementById('calc-cantidad-equipos');
    const elCalcRiesgoPct = document.getElementById('calc-riesgo-pct');
    const elCalcMargenTipo = document.getElementById('calc-margen-tipo');
    const elCalcMargenValor = document.getElementById('calc-margen-valor');
    const elCalcMargenValorLabel = document.getElementById('calc-margen-valor-label');
    const elCalcResultado = document.getElementById('calc-resultado-arancel');

    function equiposCargadosPorCicloCalc(ciclo) {
        if (ciclo === 'basico') return poolBasico.length;
        if (ciclo === 'ambos') return poolSuperior.length + poolBasico.length;
        return poolSuperior.length; // 'superior' por defecto
    }

    function autocompletarCantidadEquiposCalc() {
        if (!elCalcCiclo || !elCalcCantidadEquipos) return;
        const cantidad = equiposCargadosPorCicloCalc(elCalcCiclo.value);
        elCalcCantidadEquipos.value = cantidad > 0 ? cantidad : 1;
    }

    function actualizarLabelMargenCalc() {
        if (!elCalcMargenTipo || !elCalcMargenValorLabel) return;
        elCalcMargenValorLabel.textContent = elCalcMargenTipo.value === 'fijo'
            ? 'Ganancia deseada para la jornada ($)'
            : 'Ganancia (%)';
    }

    function guardarConfigCalculadoraArancel() {
        if (!elCalcCiclo) return;
        const config = {
            rubros: {},
            ciclo: elCalcCiclo.value,
            cantidadEquipos: parseFloat(elCalcCantidadEquipos.value) || 0,
            riesgoPct: parseFloat(elCalcRiesgoPct.value) || 0,
            margenTipo: elCalcMargenTipo.value,
            margenValor: parseFloat(elCalcMargenValor.value) || 0
        };
        CAMPOS_CALC_EGRESOS.forEach(id => {
            const el = document.getElementById(id);
            config.rubros[id] = el ? (parseFloat(el.value) || 0) : 0;
        });
        configCalculadoraArancel = config;
        almacen.setItem('liga_calculadora_arancel', JSON.stringify(config));
    }

    // Rellena el formulario con la última configuración guardada. Si nunca se guardó una
    // cantidad de equipos, se autocompleta con los equipos realmente cargados en el ciclo.
    function cargarConfigCalculadoraArancel() {
        const c = configCalculadoraArancel;
        if (!elCalcCiclo) return;
        if (c && c.rubros) {
            CAMPOS_CALC_EGRESOS.forEach(id => {
                const el = document.getElementById(id);
                if (el && c.rubros[id] != null) el.value = c.rubros[id];
            });
        }
        if (c && c.ciclo) elCalcCiclo.value = c.ciclo;
        if (c && c.cantidadEquipos) {
            elCalcCantidadEquipos.value = c.cantidadEquipos;
        } else {
            autocompletarCantidadEquiposCalc();
        }
        if (c && c.riesgoPct != null) elCalcRiesgoPct.value = c.riesgoPct;
        if (c && c.margenTipo) elCalcMargenTipo.value = c.margenTipo;
        if (c && c.margenValor != null) elCalcMargenValor.value = c.margenValor;
        actualizarLabelMargenCalc();
    }

    // Fórmula: (egresos + ganancia) / (1 − riesgo%) / cantidad de equipos.
    // Dividir por (1 − riesgo%) sube el arancel lo suficiente para que, aunque ese % de
    // equipos no pague, lo recaudado entre los que sí pagan siga cubriendo egresos + ganancia.
    function calcularArancelRecomendado() {
        if (!elCalcResultado) return;

        let egresosTotalJornada = 0;
        CAMPOS_CALC_EGRESOS.forEach(id => {
            const el = document.getElementById(id);
            egresosTotalJornada += el ? (parseFloat(el.value) || 0) : 0;
        });

        const cantidadEquipos = Math.max(0, parseFloat(elCalcCantidadEquipos.value) || 0);
        const riesgoPct = Math.min(90, Math.max(0, parseFloat(elCalcRiesgoPct.value) || 0));
        const margenTipo = elCalcMargenTipo ? elCalcMargenTipo.value : 'porcentaje';
        const margenValorIngresado = Math.max(0, parseFloat(elCalcMargenValor.value) || 0);

        if (cantidadEquipos <= 0) {
            elCalcResultado.innerHTML = '<p style="color:#f43f5e; text-align:center; font-size:12px;">Cargá la cantidad de equipos que juegan esa jornada para calcular.</p>';
            return;
        }

        const margen = margenTipo === 'fijo' ? margenValorIngresado : egresosTotalJornada * (margenValorIngresado / 100);
        const totalACubrir = egresosTotalJornada + margen;
        const fraccionPaga = (100 - riesgoPct) / 100;
        const totalARecaudarConRiesgo = fraccionPaga > 0 ? (totalACubrir / fraccionPaga) : totalACubrir;
        const arancelPorEquipo = totalARecaudarConRiesgo / cantidadEquipos;
        const arancelRedondeado = Math.ceil(arancelPorEquipo / 500) * 500;

        const equiposQuePaganEnElPeorCaso = cantidadEquipos * fraccionPaga;
        const recaudacionPeorCaso = arancelRedondeado * equiposQuePaganEnElPeorCaso;
        const recaudacionSiPaganTodos = arancelRedondeado * cantidadEquipos;
        const gananciaSiPaganTodos = recaudacionSiPaganTodos - egresosTotalJornada;

        elCalcResultado.innerHTML = `
            <div class="calc-arancel-card">
                <div class="calc-arancel-linea"><span>Egresos estimados de la jornada</span><span>$${egresosTotalJornada.toLocaleString()}</span></div>
                <div class="calc-arancel-linea"><span>+ Ganancia deseada${margenTipo === 'fijo' ? '' : ` (${margenValorIngresado}% sobre egresos)`}</span><span>$${Math.round(margen).toLocaleString()}</span></div>
                <div class="calc-arancel-linea calc-total"><span>= Total a cubrir</span><span>$${Math.round(totalACubrir).toLocaleString()}</span></div>
                <div class="calc-arancel-linea"><span>÷ (100% − ${riesgoPct}% de riesgo de ausencias)</span><span>$${Math.round(totalARecaudarConRiesgo).toLocaleString()}</span></div>
                <div class="calc-arancel-linea"><span>÷ ${cantidadEquipos} equipo${cantidadEquipos === 1 ? '' : 's'}</span><span>$${Math.round(arancelPorEquipo).toLocaleString()}</span></div>
            </div>
            <div class="calc-arancel-resultado">
                <span style="font-size:11px; color:#d8b4fe; text-transform:uppercase; letter-spacing:1px;">Arancel recomendado por equipo</span>
                <span class="calc-monto">$${arancelRedondeado.toLocaleString()}</span>
                <span style="font-size:10px; color:#a9bce8; display:block; margin-top:4px;">(redondeado a $500)</span>
            </div>
            <p class="calc-arancel-nota">
                Si falta el ${riesgoPct}% de los equipos (${(cantidadEquipos - equiposQuePaganEnElPeorCaso).toFixed(1)} de ${cantidadEquipos}) y el resto paga este arancel, se recaudan $${Math.round(recaudacionPeorCaso).toLocaleString()} — igual cubre egresos + ganancia.<br>
                Si juegan y pagan los ${cantidadEquipos} equipos, se recaudan $${recaudacionSiPaganTodos.toLocaleString()} y la ganancia real sube a $${Math.round(gananciaSiPaganTodos).toLocaleString()}.
            </p>
        `;
    }

    if (elCalcCiclo) {
        elCalcCiclo.addEventListener('change', () => {
            autocompletarCantidadEquiposCalc();
            guardarConfigCalculadoraArancel();
            calcularArancelRecomendado();
        });
    }
    if (elCalcMargenTipo) {
        elCalcMargenTipo.addEventListener('change', () => {
            actualizarLabelMargenCalc();
            guardarConfigCalculadoraArancel();
            calcularArancelRecomendado();
        });
    }
    [...CAMPOS_CALC_EGRESOS, 'calc-cantidad-equipos', 'calc-riesgo-pct', 'calc-margen-valor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                guardarConfigCalculadoraArancel();
                calcularArancelRecomendado();
            });
        }
    });

    // ============================================================
    // 8. MÓDULO AVISOS Y ALERTAS
    // ============================================================
    const formAlerta = document.getElementById('form-alerta-admin');
    const btnVaciarAlertasAdmin = document.getElementById('btn-vaciar-alertas-admin');

    function calcularTiempoRelativoAdmin(timestamp) {
        if (!timestamp) return 'Hace un momento';
        const diff = Date.now() - timestamp;
        const seg = Math.floor(diff / 1000);
        const min = Math.floor(seg / 60);
        const hrs = Math.floor(min / 60);
        const dias = Math.floor(hrs / 24);

        if (seg < 60) return 'Hace un momento';
        if (min < 60) return `Hace ${min} min`;
        if (hrs < 24) return `Hace ${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
        return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    }

    function actualizarListaAlertasAdmin() {
        const contenedor = document.getElementById('lista-alertas-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaAlertas.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay alertas emitidas.</p>';
            return;
        }

        listaAlertas.forEach(a => {
            const esUrgente = a.tipo === 'urgente';
            const tiempoDinamico = a.timestamp ? calcularTiempoRelativoAdmin(a.timestamp) : (a.tiempo || 'Reciente');

            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(255,255,255,0.03); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid ${esUrgente ? '#f43f5e' : '#2edae3'};">
                    <div style="text-align:left; max-width: 80%;">
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${attrSeguro(a.titulo)}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block; margin-top:2px;">${attrSeguro(a.texto)}</span>
                        <span style="font-size:8px; color:#869bd8; display:block; margin-top:3px;">${tiempoDinamico}</span>
                    </div>
                    <button class="btn-borrar-alerta" data-id="${a.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-alerta').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaAlertas = listaAlertas.filter(a => a.id !== idBorrar);
                almacen.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
                actualizarListaAlertasAdmin();
            });
        });
    }

    if (btnVaciarAlertasAdmin) {
        btnVaciarAlertasAdmin.addEventListener('click', () => {
            if (listaAlertas.length === 0) return;
            if (!confirm('¿Vaciar todo el historial de avisos? Esta acción no se puede deshacer.')) return;
            listaAlertas = [];
            almacen.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
            actualizarListaAlertasAdmin();
        });
    }

    const btnVaciarAvisosStaff = document.getElementById('btn-vaciar-avisos-staff');

    function actualizarListaAvisosStaff() {
        const contenedor = document.getElementById('lista-avisos-staff');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (avisosStaff.length === 0) {
            contenedor.innerHTML = '<p style="color:#869bd8; text-align:center; font-size:11px;">No hay avisos pendientes.</p>';
            return;
        }

        avisosStaff.forEach(a => {
            const tiempoDinamico = calcularTiempoRelativoAdmin(a.timestamp);

            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(255,255,255,0.03); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid #f2c00e;">
                    <div style="text-align:left; max-width: 80%;">
                        <span style="font-size:11px; color:white; display:block;">${attrSeguro(a.detalle)}</span>
                        <span style="font-size:8px; color:#869bd8; display:block; margin-top:3px;">${tiempoDinamico}</span>
                    </div>
                    <button class="btn-borrar-aviso-staff" data-id="${a.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-aviso-staff').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = btn.getAttribute('data-id');
                avisosStaff = avisosStaff.filter(a => a.id !== idBorrar);
                almacen.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
                actualizarListaAvisosStaff();
            });
        });
    }

    if (btnVaciarAvisosStaff) {
        btnVaciarAvisosStaff.addEventListener('click', () => {
            if (avisosStaff.length === 0) return;
            if (!confirm('¿Vaciar todo el historial de avisos internos? Esta acción no se puede deshacer.')) return;
            avisosStaff = [];
            almacen.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
            actualizarListaAvisosStaff();
        });
    }

    function fechaHoraHistorial(timestamp) {
        return new Date(timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Lo más nuevo arriba. Se ordena por hora y no por el orden guardado: cada panel agrega sus entradas por su cuenta.
    function actualizarListaHistorial() {
        const contenedor = document.getElementById('lista-historial-cambios');
        if (!contenedor) return;
        if (historialCambios.length === 0) {
            contenedor.innerHTML = '<p class="historial-vacio">Todavía no hay cambios registrados.</p>';
            return;
        }
        contenedor.innerHTML = [...historialCambios].sort((a, b) => b.timestamp - a.timestamp).map(h => `
            <div class="historial-item historial-tipo-${attrSeguro(h.tipo)}">
                <p class="historial-texto"><strong class="historial-autor">${attrSeguro(h.autor)}</strong> ${attrSeguro(h.detalle)}</p>
                <span class="historial-meta">${fechaHoraHistorial(h.timestamp)}${h.rol ? ' · ' + (h.rol === 'coordinador' ? 'Coordinador' : 'Staff') : ''}${h.email && h.email !== h.autor ? ' · ' + attrSeguro(h.email) : ''}</span>
            </div>
        `).join('');
    }

    const btnVaciarHistorial = document.getElementById('btn-vaciar-historial-cambios');
    if (btnVaciarHistorial) {
        btnVaciarHistorial.addEventListener('click', () => {
            if (usuarioPanel.rol !== 'coordinador' || historialCambios.length === 0) return;
            if (!confirm('¿Vaciar todo el historial de cambios del staff? Esta acción no se puede deshacer.')) return;
            historialCambios = [];
            almacen.setItem('liga_historial_cambios', JSON.stringify(historialCambios));
            actualizarListaHistorial();
        });
    }

    if (formAlerta) {
        formAlerta.addEventListener('submit', (e) => {
            e.preventDefault();
            const nuevaAlerta = {
                id: Date.now(),
                titulo: document.getElementById('alerta-titulo').value.trim(),
                texto: document.getElementById('alerta-texto').value.trim(),
                tipo: document.getElementById('alerta-tipo').value,
                timestamp: Date.now(),
                leida: false
            };

            listaAlertas.unshift(nuevaAlerta);
            almacen.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
            formAlerta.reset();
            actualizarListaAlertasAdmin();
            alert('¡Alerta emitida!');
        });
    }

    // ============================================================
    // 9. INICIALIZACIÓN GENERAL AL CARGAR ADMIN.HTML
    // ============================================================
    mostrarFechasGrupos();
    actualizarOpcionesGrupo();
    renderizarCalendarioFechas();
    autocompletarDiaPartido();
    actualizarListaAdmin();
    actualizarSelectFechasCronograma();
    actualizarSelectsPlayoffs();
    actualizarRondaYSlotPlayoffs();
    renderizarCrucesPlayoffsAdmin();
    actualizarBotonEstadoPlayoffs();
    renderizarResumenConfigBracket();

    actualizarSelectorGruposFormulario();
    renderizarListaGruposAdmin();
    actualizarOpcionesMoverEquipo();
    actualizarComboEquiposPlantel();
    actualizarSelectsFormatoTorneo();

    actualizarEquiposSancion();
    actualizarListaSancionesAdmin();
    actualizarListaNoticiasAdmin();
    actualizarListaAlertasAdmin();
    actualizarListaAvisosStaff();
    actualizarListaHistorial();

    renderizarTesoreriaInscripciones();
    renderizarTesoreriaPartidos();
    renderizarCajaPorFecha();
    renderizarEgresosAdmin();
    actualizarFiltroFechasTesoreria();
    calcularBalanceGeneral();

    // ============================================================
    // RESUMEN GENERAL (DASHBOARD DEL STAFF)
    // ============================================================
    function renderizarResumenStaff() {
        recargarPools();

        const gridMetricas = document.getElementById('grid-resumen-metricas');
        if (gridMetricas) {
            const equiposTotal = [...(poolSuperior || []), ...(poolBasico || [])];
            const totalEquipos = equiposTotal.length;
            const totalJugadores = equiposTotal.reduce((acc, eq) => acc + (eq.jugadores ? eq.jugadores.length : 0), 0);
            const fichasPendientes = equiposTotal.reduce((acc, eq) => acc + (eq.jugadores || []).filter(j => j.fichaMedica !== 'si').length, 0);
            const partidosJugados = partidos.filter(p => p.jugado).length;
            const partidosPendientes = partidos.filter(p => !p.jugado).length;

            const metricas = [
                { label: 'Equipos Inscriptos', valor: totalEquipos },
                { label: 'Jugadores Cargados', valor: totalJugadores },
                { label: 'Partidos Jugados', valor: partidosJugados },
                { label: 'Partidos Pendientes', valor: partidosPendientes },
                { label: 'Fichas Médicas Pendientes', valor: fichasPendientes },
                { label: 'Sanciones Registradas', valor: listaSanciones.length }
            ];

            gridMetricas.innerHTML = metricas.map(m => `
                <div class="metrica-resumen-card">
                    <span class="metrica-label">${m.label}</span>
                    <span class="metrica-valor">${m.valor}</span>
                </div>
            `).join('');
        }

        // Próximo partido pendiente por fecha/hora más cercana
        const contProximo = document.getElementById('resumen-proximo-partido');
        if (contProximo) {
            const parseFechaDia = (diaStr) => {
                if (!diaStr) return null;
                const partes = diaStr.split('/');
                if (partes.length !== 3) return null;
                const [d, m, y] = partes.map(Number);
                const fecha = new Date(y, m - 1, d);
                return isNaN(fecha) ? null : fecha;
            };

            const pendientes = partidos
                .filter(p => !p.jugado)
                .map(p => ({ p, fechaObj: parseFechaDia(p.dia) }))
                .filter(x => x.fechaObj)
                .sort((a, b) => a.fechaObj - b.fechaObj || (a.p.horario || '').localeCompare(b.p.horario || ''));

            contProximo.innerHTML = pendientes.length === 0
                ? '<p style="color:#869bd8; font-size:11px;">No hay partidos pendientes cargados.</p>'
                : `<p style="font-size:13px; color:#fff; font-weight:bold; margin:0 0 6px 0;">${attrSeguro(pendientes[0].p.local)} vs ${attrSeguro(pendientes[0].p.visitante)}</p>
                   <p style="font-size:11px; color:#869bd8; margin:0;">${attrSeguro(pendientes[0].p.dia || 'Sin fecha')} — ${attrSeguro(pendientes[0].p.horario || 'Sin horario')} — ${attrSeguro(pendientes[0].p.cancha || 'Cancha a confirmar')}</p>`;
        }

        // Últimas sanciones
        const contSanciones = document.getElementById('resumen-ultimas-sanciones');
        if (contSanciones) {
            const ultimas = listaSanciones.slice().sort((a, b) => b.id - a.id).slice(0, 3);
            contSanciones.innerHTML = ultimas.length === 0
                ? '<p style="color:#869bd8; font-size:11px;">Sin sanciones registradas.</p>'
                : ultimas.map(s => `
                    <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:11px; color:#fff; font-weight:bold; display:block;">${attrSeguro(s.equipo)}</span>
                        <span style="font-size:10px; color:#869bd8;">${attrSeguro(s.tipo)}${s.motivo ? ' — ' + attrSeguro(s.motivo) : ''}</span>
                    </div>
                `).join('');
        }

        // Últimos avisos
        const contAvisos = document.getElementById('resumen-ultimos-avisos');
        if (contAvisos) {
            const ultimos = listaAlertas.slice().sort((a, b) => (b.timestamp || b.id || 0) - (a.timestamp || a.id || 0)).slice(0, 3);
            contAvisos.innerHTML = ultimos.length === 0
                ? '<p style="color:#869bd8; font-size:11px;">Sin avisos publicados.</p>'
                : ultimos.map(a => `
                    <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:11px; color:${a.tipo === 'urgente' ? '#f43f5e' : '#fff'}; font-weight:bold; display:block;">${attrSeguro(a.titulo)}</span>
                        <span style="font-size:10px; color:#869bd8;">${attrSeguro(a.texto || '')}</span>
                    </div>
                `).join('');
        }

        // Equipos con inscripción pendiente (solo cantidad — el detalle en $ vive en Tesorería, exclusivo Admin)
        const contPagos = document.getElementById('resumen-pagos-pendientes');
        if (contPagos) {
            const valorIndividual = valorInscripcionGuardado();
            const equiposTotal = [...(poolSuperior || []), ...(poolBasico || [])];
            const pendientesPago = equiposTotal.filter(eq => {
                const cant = eq.jugadores ? eq.jugadores.length : 0;
                const pago = tesoreriaInscripciones[claveInscripcion(eq)] || { ef: 0, tr: 0 };
                const exigido = montosInscripcion(cant, valorIndividual, pago.beneficio).exigido;
                const pagado = (pago.ef || 0) + (pago.tr || 0);
                return exigido > 0 && pagado < exigido;
            });

            contPagos.innerHTML = pendientesPago.length === 0
                ? '<p style="color:#4ade80; font-size:11px; font-weight:bold;">Todos los equipos están al día con la inscripción.</p>'
                : `<p style="font-size:24px; color:#f2c00e; font-family:'Michroma'; font-weight:bold; margin:0;">${pendientesPago.length}</p>
                   <p style="font-size:10px; color:#869bd8; margin:4px 0 0 0;">equipo(s) con inscripción incompleta</p>`;
        }
    }

    document.querySelectorAll('.btn-acceso-rapido[data-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = document.querySelector(`.staff-tab-btn[data-target="${btn.getAttribute('data-target')}"]`);
            if (tab) tab.click();
        });
    });

    const tabResumenStaff = document.querySelector('.staff-tab-btn[data-target="sec-resumen"]');
    if (tabResumenStaff) tabResumenStaff.addEventListener('click', renderizarResumenStaff);

    const tabTesoreriaStaff = document.querySelector('.staff-tab-btn[data-target="sec-tesoreria"]');
    if (tabTesoreriaStaff) tabTesoreriaStaff.addEventListener('click', renderizarTesoreriaPartidos);

    renderizarResumenStaff();

    // ============================================================
    // BUSCADOR GLOBAL DE JUGADOR (Staff)
    // ============================================================
    const inputBuscadorGlobal = document.getElementById('input-buscador-global');
    const resultadosBuscadorGlobal = document.getElementById('resultados-buscador-global');

    function normalizarTextoBusqueda(txt) {
        return (txt || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function ejecutarBusquedaGlobal(query) {
        if (!resultadosBuscadorGlobal) return;
        const qOriginal = query.trim();
        const q = normalizarTextoBusqueda(qOriginal);

        if (q.length < 2) {
            resultadosBuscadorGlobal.classList.add('seccion-oculta');
            resultadosBuscadorGlobal.innerHTML = '';
            return;
        }

        recargarPools();
        const coincidencias = [];
        [{ pool: poolSuperior, ciclo: 'superior' }, { pool: poolBasico, ciclo: 'basico' }].forEach(({ pool, ciclo }) => {
            (pool || []).forEach(equipo => {
                (equipo.jugadores || []).forEach(j => {
                    const coincideNombre = normalizarTextoBusqueda(j.nombre).includes(q);
                    const coincideDni = normalizarTextoBusqueda(j.dni).includes(q);
                    const coincideDorsal = j.dorsal != null && j.dorsal.toString() === qOriginal;
                    if (coincideNombre || coincideDni || coincideDorsal) {
                        coincidencias.push({ jugador: j, equipo: equipo.nombre, ciclo });
                    }
                });
            });
        });

        if (coincidencias.length === 0) {
            resultadosBuscadorGlobal.innerHTML = '<div class="resultado-buscador-vacio">Sin coincidencias.</div>';
            resultadosBuscadorGlobal.classList.remove('seccion-oculta');
            return;
        }

        resultadosBuscadorGlobal.innerHTML = coincidencias.slice(0, 8).map((r, idx) => `
            <div class="resultado-buscador-item" data-idx="${idx}">
                <span class="resultado-buscador-nombre">${attrSeguro(r.jugador.nombre)}</span>
                <span class="resultado-buscador-meta">${dorsalBF(r.jugador)} — ${attrSeguro(r.equipo)}</span>
            </div>
        `).join('');
        resultadosBuscadorGlobal.classList.remove('seccion-oculta');

        resultadosBuscadorGlobal.querySelectorAll('.resultado-buscador-item').forEach(item => {
            item.addEventListener('click', () => {
                const r = coincidencias[parseInt(item.getAttribute('data-idx'))];
                if (!r) return;

                const tabPlanteles = document.querySelector('.staff-tab-btn[data-target="sec-planteles"]');
                if (tabPlanteles) tabPlanteles.click();
                if (btnSubPlantelJugadores) btnSubPlantelJugadores.click();

                if (plantelCiclo) plantelCiclo.value = r.ciclo;
                actualizarComboEquiposPlantel(r.equipo);

                resultadosBuscadorGlobal.classList.add('seccion-oculta');
                if (inputBuscadorGlobal) inputBuscadorGlobal.value = '';
            });
        });
    }

    if (inputBuscadorGlobal) {
        inputBuscadorGlobal.addEventListener('input', (e) => ejecutarBusquedaGlobal(e.target.value));
        inputBuscadorGlobal.addEventListener('focus', (e) => {
            if (e.target.value.trim().length >= 2) ejecutarBusquedaGlobal(e.target.value);
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.buscador-global-staff') && resultadosBuscadorGlobal) {
                resultadosBuscadorGlobal.classList.add('seccion-oculta');
            }
        });
    }

    // ============================================================
    // NAVEGACIÓN POR PESTAÑAS DEL PANEL STAFF
    // ============================================================
    const tabsStaff = document.querySelectorAll('.staff-tab-btn[data-target]');
    const modulosStaff = document.querySelectorAll('.staff-modulo');

    tabsStaff.forEach(tab => {
        tab.addEventListener('click', () => {
            tabsStaff.forEach(t => t.classList.remove('active'));
            modulosStaff.forEach(m => m.classList.add('seccion-oculta-staff'));

            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            const moduloTarget = document.getElementById(target);
            if (moduloTarget) moduloTarget.classList.remove('seccion-oculta-staff');
            if (target === 'sec-planteles') renderizarTablaJugadores();
        });
    });

});