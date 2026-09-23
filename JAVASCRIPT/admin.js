document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. ESTADO GLOBAL Y MEMORIA (LOCALSTORAGE)
    // ============================================================
    let partidos = JSON.parse(localStorage.getItem('liga_partidos')) || [];
    if (partidos.length === 0 && typeof ligaData !== 'undefined') {
        partidos = ligaData.partidos || [];
        localStorage.setItem('liga_partidos', JSON.stringify(partidos));
    }

    let gruposTorneo = JSON.parse(localStorage.getItem('liga_grupos')) || {
        superior: ['A', 'B', 'C', 'D', 'E'],
        basico: ['A', 'B']
    };

    let poolSuperior = JSON.parse(localStorage.getItem('liga_cicloSuperior')) || (typeof ligaData !== 'undefined' ? ligaData.cicloSuperior : []);
    let poolBasico = JSON.parse(localStorage.getItem('liga_cicloBasico')) || (typeof ligaData !== 'undefined' ? ligaData.cicloBasico : []);

    let crucesPlayoffs = JSON.parse(localStorage.getItem('liga_cruces_playoffs')) || [];
    if (typeof migrarCrucesConSlot === 'function') {
        const migracion = migrarCrucesConSlot(crucesPlayoffs);
        crucesPlayoffs = migracion.cruces;
        localStorage.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
        if (migracion.advertencias.length > 0) {
            console.warn('[Playoffs] Advertencias de migración de slots:\n' + migracion.advertencias.join('\n'));
        }
    }
    let playoffsPublicados = localStorage.getItem('liga_playoffs_publicados') === 'true';

    let listaSanciones = JSON.parse(localStorage.getItem('liga_sanciones')) || [];
    let listaNoticias = JSON.parse(localStorage.getItem('liga_noticias')) || [];
    let listaAlertas = JSON.parse(localStorage.getItem('liga_notificaciones')) || [];
    // Avisos internos del staff (no es liga_notificaciones, que es la campanita pública): avisos que genera
    // el propio sistema para que el staff revise algo después, sin bloquear la carga de datos.
    let avisosStaff = JSON.parse(localStorage.getItem('liga_avisos_staff')) || [];

    function registrarAvisoStaff(tipo, detalle) {
        avisosStaff.unshift({
            id: Date.now() + '-' + Math.floor(Math.random() * 100000),
            tipo,
            detalle,
            timestamp: Date.now()
        });
        localStorage.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
        if (typeof actualizarListaAvisosStaff === 'function') actualizarListaAvisosStaff();
    }
    let tesoreriaPartidos = JSON.parse(localStorage.getItem('liga_tesoreria_partidos_v2')) || {};
    let tesoreriaInscripciones = JSON.parse(localStorage.getItem('liga_tesoreria_inscripciones')) || {};
    let listaEgresos = JSON.parse(localStorage.getItem('liga_egresos')) || [];
    let cajaMovimientos = JSON.parse(localStorage.getItem('liga_caja_movimientos')) || [];

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
        localStorage.setItem('liga_caja_movimientos', JSON.stringify(cajaMovimientos));
        if (typeof renderizarCajaPorFecha === 'function') renderizarCajaPorFecha();
    }

    function guardarEquiposEnStorage() {
        guardarClaveConAviso('liga_cicloSuperior', JSON.stringify(poolSuperior));
        guardarClaveConAviso('liga_cicloBasico', JSON.stringify(poolBasico));
    }

    function guardarGruposEnStorage() {
        localStorage.setItem('liga_grupos', JSON.stringify(gruposTorneo));
    }

    function recargarPools() {
        const sup = JSON.parse(localStorage.getItem('liga_cicloSuperior'));
        poolSuperior = (sup && sup.length > 0) ? sup : (typeof ligaData !== 'undefined' ? ligaData.cicloSuperior : []);
        const bas = JSON.parse(localStorage.getItem('liga_cicloBasico'));
        poolBasico = (bas && bas.length > 0) ? bas : (typeof ligaData !== 'undefined' ? ligaData.cicloBasico : []);
    }

    // ============================================================
    // 2. SELECTOR DE ROL (ADMIN / STAFF)
    // ============================================================
    const selectorRol = document.getElementById('selector-rol-usuario');

    function actualizarRolDOM() {
        const rol = selectorRol ? selectorRol.value : 'admin';
        if (rol === 'staff') {
            document.body.classList.remove('rol-admin');
            document.body.classList.add('rol-staff');
        } else {
            document.body.classList.remove('rol-staff');
            document.body.classList.add('rol-admin');
        }
    }

    if (selectorRol) selectorRol.addEventListener('change', actualizarRolDOM);
    actualizarRolDOM();

    // ============================================================
    // 2 BIS. IMÁGENES Y ESPACIO DE ALMACENAMIENTO
    // ============================================================
    // localStorage guarda texto: una foto entra como dataURL base64 y una sacada con el
    // celular pesa varios MB, contra un tope de ~5 MB para TODO el torneo. Por eso cada
    // imagen que sube el staff se redimensiona y se recomprime en el navegador (canvas)
    // antes de guardarse.
    const MAX_LADO_FOTO_JUGADOR = 250;
    const MAX_LADO_FOTO_NOTICIA = 1000;
    const MAX_LADO_LOGO_SPONSOR = 500;
    const MAX_LADO_PORTADA_ALBUM = 800;
    const CALIDAD_JPEG = 0.75;
    const LIMITE_STORAGE_BYTES = 5 * 1024 * 1024;

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

    function pesoDeTexto(txt) {
        return new Blob([txt || '']).size;
    }

    function pesoLegible(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Conecta un <input type="file"> con su vista previa. El objeto devuelto expone
    // .dataURL con la imagen ya comprimida (o null si no se subió ninguna).
    function conectarSubidaFoto(config) {
        const input = document.getElementById(config.inputId);
        const wrap = document.getElementById(config.previewWrapId);
        const img = document.getElementById(config.previewImgId);
        const peso = document.getElementById(config.pesoId);
        const btnQuitar = document.getElementById(config.btnQuitarId);
        const estado = { dataURL: null };

        estado.limpiar = function () {
            estado.dataURL = null;
            if (input) input.value = '';
            if (img) img.removeAttribute('src');
            if (peso) peso.textContent = '';
            if (wrap) wrap.classList.add('seccion-oculta-staff');
        };

        estado.mostrar = function (dataURL) {
            estado.dataURL = dataURL;
            if (img) img.src = dataURL;
            if (peso) peso.textContent = 'Comprimida: ' + pesoLegible(pesoDeTexto(dataURL));
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

    const ETIQUETAS_STORAGE = {
        liga_cicloSuperior: 'Equipos y jugadores (Superior)',
        liga_cicloBasico: 'Equipos y jugadores (Básico)',
        liga_noticias: 'Noticias',
        liga_sponsors: 'Sponsors',
        liga_fotos_albumes: 'Álbumes de fotos',
        liga_partidos: 'Partidos',
        liga_sanciones: 'Sanciones',
        liga_caja_movimientos: 'Caja por fecha',
        liga_notificaciones: 'Avisos',
        liga_avisos_staff: 'Avisos internos del staff'
    };

    function renderizarUsoStorage() {
        const cont = document.getElementById('storage-uso-admin');
        if (!cont) return;

        let total = 0;
        const porClave = [];
        for (let i = 0; i < localStorage.length; i++) {
            const clave = localStorage.key(i);
            const bytes = pesoDeTexto(clave) + pesoDeTexto(localStorage.getItem(clave));
            total += bytes;
            if (clave.indexOf('liga_') === 0) porClave.push({ clave: clave, bytes: bytes });
        }

        const porcentaje = Math.min(100, (total / LIMITE_STORAGE_BYTES) * 100);
        const nivel = porcentaje >= 90 ? 'critico' : (porcentaje >= 80 ? 'alerta' : '');

        const detalles = porClave
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 5)
            .map(x => `<div class="storage-detalle"><strong>${ETIQUETAS_STORAGE[x.clave] || x.clave}</strong><span>${pesoLegible(x.bytes)}</span></div>`)
            .join('');

        let aviso = '';
        if (porcentaje >= 90) {
            aviso = '<span class="storage-aviso critico">Casi sin espacio. Si se llena, el navegador va a fallar al guardar. Borrá noticias o álbumes viejos antes de subir más fotos.</span>';
        } else if (porcentaje >= 80) {
            aviso = '<span class="storage-aviso">Ya usaste más del 80% del espacio. Conviene ir limpiando noticias o álbumes viejos.</span>';
        }

        cont.innerHTML = `
            <span class="storage-total">${pesoLegible(total)} de ~5 MB usados (${porcentaje.toFixed(1)}%)</span>
            <div class="storage-barra"><div class="storage-barra-fill ${nivel}" style="width:${porcentaje.toFixed(1)}%;"></div></div>
            ${detalles || '<div class="storage-detalle"><strong>Todavía no hay datos guardados</strong><span>0 B</span></div>'}
            ${aviso}
        `;
    }

    // Si el navegador se queda sin espacio, setItem tira una excepción y el dato se pierde
    // en silencio: avisamos para que el staff sepa que tiene que liberar lugar.
    function guardarClaveConAviso(clave, valor) {
        try {
            localStorage.setItem(clave, valor);
            return true;
        } catch (err) {
            alert('No se pudo guardar: el navegador se quedó sin espacio.\n\nBorrá noticias o álbumes viejos desde Prensa & Fotos y volvé a intentar.');
            console.error('[Storage] ' + clave, err);
            return false;
        }
    }

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

    // Filtrar Equipos según Grupo en Fase Regular
    function filtrarEquiposPorGrupo() {
        recargarPools();
        const ciclo = cicloSelect ? cicloSelect.value : 'superior';
        const grupo = grupoSelect ? grupoSelect.value : 'A';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const filtrados = pool.filter(e => e.grupo === grupo);

        if (!localSelect || !visitanteSelect) return;

        localSelect.innerHTML = '';
        visitanteSelect.innerHTML = '';

        if (filtrados.length === 0) {
            localSelect.innerHTML = '<option value="">Sin equipos</option>';
            visitanteSelect.innerHTML = '<option value="">Sin equipos</option>';
            return;
        }

        filtrados.forEach(e => {
            localSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
            visitanteSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
        });

        if (visitanteSelect.options.length > 1) visitanteSelect.selectedIndex = 1;
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

        localSelect.innerHTML = '';
        visitanteSelect.innerHTML = '';

        if (!pool || pool.length === 0) {
            localSelect.innerHTML = '<option value="">Sin equipos</option>';
            visitanteSelect.innerHTML = '<option value="">Sin equipos</option>';
            return;
        }

        const fechaVal = parseInt(inputFechaPartido ? inputFechaPartido.value : 0);
        const ronda = (typeof rondaPorCodigoFecha === 'function' ? rondaPorCodigoFecha(fechaVal) : null);
        const crucesRonda = (JSON.parse(localStorage.getItem('liga_cruces_playoffs')) || [])
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
            localSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
            visitanteSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
        });

        if (ladosSinDefinir > 0) {
            const pendiente = `<option value="" disabled>A definir (faltan jugarse ${ladosSinDefinir} lugar${ladosSinDefinir > 1 ? 'es' : ''} de esta ronda)</option>`;
            localSelect.innerHTML += pendiente;
            visitanteSelect.innerHTML += pendiente;
        }

        if (equipos.length > 1) visitanteSelect.selectedIndex = 1;
    }

    // Detección de Modo Regular vs Modo Playoffs en el Formulario
    function actualizarOpcionesGrupo() {
        if (!cicloSelect) return;
        const ciclo = cicloSelect.value;
        const fechaVal = parseInt(inputFechaPartido ? inputFechaPartido.value : 1);
        const esFasePlayoff = fechaVal >= 100;

        if (esFasePlayoff) {
            if (groupCrucePlayoff) groupCrucePlayoff.style.display = 'block';
            if (groupInstanciaRegular) groupInstanciaRegular.style.display = 'none';
            if (rowPenales) rowPenales.style.display = 'grid';

            const ronda = (typeof rondaPorCodigoFecha === 'function' ? rondaPorCodigoFecha(fechaVal) : null) || 'octavos';

            const crucesGuardados = JSON.parse(localStorage.getItem('liga_cruces_playoffs')) || [];
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
                        selectCrucePlayoff.innerHTML += `<option value="${c.local}|${c.visitante}">Llave ${c.slot || '?'}: ${c.local} VS ${c.visitante}</option>`;
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
                    grupoSelect.innerHTML += `<option value="${g}">Grupo ${g}</option>`;
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
        });
    }

    if (inputFechaPartido) inputFechaPartido.addEventListener('change', actualizarOpcionesGrupo);
    if (cicloSelect) cicloSelect.addEventListener('change', actualizarOpcionesGrupo);
    if (grupoSelect) grupoSelect.addEventListener('change', filtrarEquiposPorGrupo);

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
                        <span style="font-size:9px; color:#869bd8; display:block;">${faseLabel} — ${p.dia ? p.dia + ' — ' : ''}${p.cancha || 'Cancha a confirmar'} (${p.ciclo ? p.ciclo.toUpperCase() : 'SUP'})</span>
                        <span style="font-size:12px; color:white;">${p.local} <strong style="color:#2edae3;">${marcador}</strong> ${p.visitante}</span>
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
                partidos = partidos.filter(p => p.id !== idBorrar);
                localStorage.setItem('liga_partidos', JSON.stringify(partidos));
                if (idPartidoEnEdicion === idBorrar) cancelarEdicionPartido();
                sincronizarAusencias();
                actualizarListaAdmin();
                actualizarSelectFechasCronograma();
                if (typeof actualizarFiltroFechasTesoreria === 'function') actualizarFiltroFechasTesoreria();
            });
        });

        document.querySelectorAll('.btn-editar-partido').forEach(btn => {
            btn.addEventListener('click', () => {
                const idEditar = parseInt(btn.getAttribute('data-id'));
                const p = partidos.find(part => part.id === idEditar);
                if (p) {
                    idPartidoEnEdicion = p.id;
                    if (inputFechaPartido) inputFechaPartido.value = p.fecha;
                    if (cicloSelect) cicloSelect.value = p.ciclo;
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

            const localInput = localSelect.value;
            const visitanteInput = visitanteSelect ? visitanteSelect.value : "";
            const golesLocalInput = document.getElementById('goles-local').value;
            const golesVisitanteInput = document.getElementById('goles-visitante').value;
            const ciclo = cicloSelect.value;
            const fechaVal = parseInt(inputFechaPartido.value);

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

            function revertirGolesPartido(partidoViejo) {
                if (!partidoViejo) return;
                const revertirEquipo = (golesArray, equipoIdRef, nombreEquipo) => {
                    if (!golesArray || !golesArray.length) return;
                    // Prioriza el ID estable (sobrevive a un cambio de nombre); si el partido es viejo y no tiene ID guardado, cae al nombre como antes.
                    const equipoObj = (equipoIdRef != null ? poolEquipos.find(e => e.id === equipoIdRef) : null)
                        || poolEquipos.find(e => e.nombre.trim().toLowerCase() === nombreEquipo.trim().toLowerCase());
                    if (!equipoObj || !equipoObj.jugadores) return;
                    golesArray.forEach(g => {
                        const match = g.nombre.match(/#(\d+)/);
                        if (!match) return;
                        const numDorsal = parseInt(match[1]);
                        const jugador = equipoObj.jugadores.find(j => j.dorsal == numDorsal);
                        if (jugador) jugador.goles = Math.max(0, (jugador.goles || 0) - g.cantidad);
                    });
                };
                revertirEquipo(partidoViejo.goleadoresLocal, partidoViejo.localId, partidoViejo.local);
                revertirEquipo(partidoViejo.goleadoresVisitante, partidoViejo.visitanteId, partidoViejo.visitante);
            }

            if (idPartidoEnEdicion !== null) {
                revertirGolesPartido(partidos.find(p => p.id === idPartidoEnEdicion));
            }

            function procesarDorsales(txtDorsales, equipoObj, rivalNombre) {
                if (!txtDorsales || !equipoObj || !equipoObj.jugadores) return [];
                const listaDorsales = txtDorsales.split(',').map(d => d.trim()).filter(d => d !== '');
                const conteoGoles = {};

                listaDorsales.forEach(dorsalStr => {
                    const numDorsal = parseInt(dorsalStr);
                    const jugadorEncontrado = equipoObj.jugadores.find(j => j.dorsal == numDorsal);
                    if (jugadorEncontrado) {
                        jugadorEncontrado.goles = (jugadorEncontrado.goles || 0) + 1;
                        const clave = `${jugadorEncontrado.nombre} (#${numDorsal})`;
                        conteoGoles[clave] = (conteoGoles[clave] || 0) + 1;
                    } else {
                        // El gol no se asigna a nadie (decisión de Joaquín, 22/09/2026): el resto del resultado
                        // se guarda igual, pero queda un aviso para que el staff lo revise y corrija después.
                        registrarAvisoStaff('dorsal_invalido_gol',
                            `Gol cargado con el dorsal #${dorsalStr} en ${equipoObj.nombre} (${nombreFaseTeso(fechaVal)} vs ${rivalNombre || 'rival a definir'}), pero no hay ningún jugador con ese número en el plantel.`);
                    }
                });

                guardarEquiposEnStorage();
                return Object.keys(conteoGoles).map(nombreLabel => ({
                    nombre: nombreLabel,
                    cantidad: conteoGoles[nombreLabel]
                }));
            }

            const arrayGolesLocal = esJugado ? procesarDorsales(dorsalesLocalTxt, eqLocalObj, eqVisitanteObj ? eqVisitanteObj.nombre : visitanteInput) : [];
            const arrayGolesVisita = esJugado ? procesarDorsales(dorsalesVisitaTxt, eqVisitanteObj, eqLocalObj ? eqLocalObj.nombre : localInput) : [];

            const partidoPrevio = idPartidoEnEdicion !== null ? partidos.find(p => p.id === idPartidoEnEdicion) : null;
            const conservaResultadoAuto = !!(partidoPrevio && partidoPrevio.resultadoAuto && esJugado
                && parseInt(golesLocalInput) === partidoPrevio.golesLocal
                && parseInt(golesVisitanteInput) === partidoPrevio.golesVisitante);

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

            if (idPartidoEnEdicion !== null) {
                partidos = partidos.map(p => p.id === idPartidoEnEdicion ? { ...p, ...datosPartido } : p);
                alert('¡Partido actualizado correctamente!');
            } else {
                partidos.push({ id: Date.now(), ...datosPartido });
                alert('¡Partido guardado!');
            }

            localStorage.setItem('liga_partidos', JSON.stringify(partidos));

            if (datosPartido.esPlayoff && datosPartido.jugado) {
                procesarAvancePlayoff(datosPartido);
            }

            sincronizarAusencias();
            cancelarEdicionPartido();
            actualizarListaAdmin();
            actualizarSelectFechasCronograma();
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
            localStorage.setItem('liga_playoffs_publicados', playoffsPublicados ? 'true' : 'false');
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
            playoffEq1.innerHTML += `<option value="${eq.nombre}">${eq.nombre}</option>`;
            playoffEq2.innerHTML += `<option value="${eq.nombre}">${eq.nombre}</option>`;
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
                        <span style="font-size:12px; color:white; font-weight:bold;">${c.local || '(A definir)'} VS ${c.visitante || '(A definir)'}</span>
                    </div>
                    <button class="btn-borrar-cruce" data-id="${c.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-cruce').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                crucesPlayoffs = crucesPlayoffs.filter(c => c.id !== idBorrar);
                localStorage.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
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

        localStorage.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
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

            localStorage.setItem('liga_cruces_playoffs', JSON.stringify(crucesPlayoffs));
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
        return JSON.parse(localStorage.getItem('liga_formato_torneo')) || { superior: 'grupos', basico: 'grupos' };
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
            localStorage.setItem('liga_formato_torneo', JSON.stringify(formato));
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
            nuevoEquipoGrupo.innerHTML += `<option value="${g}">Grupo ${g}</option>`;
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
                <span style="font-size:12px; color:#fff;">Grupo <strong>${g}</strong></span>
                <button class="btn-borrar-grupo-item" data-grupo="${g}" style="background:#991b1b; color:#fff; border:none; border-radius:2px; padding:3px 8px; cursor:pointer; font-size:10px;">Eliminar</button>
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
                moverEquipoSelect.innerHTML += `<option value="${eq.nombre}">${eq.nombre} (${grpLabel})</option>`;
            });
        }

        moverNuevoGrupo.innerHTML = '';
        grupos.forEach(g => {
            moverNuevoGrupo.innerHTML += `<option value="${g}">Grupo ${g}</option>`;
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
                equipoObj.grupo = nuevoGrupoVal;
                guardarEquiposEnStorage();
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
            plantelEquipoSelect.innerHTML += `<option value="${eq.nombre}">${eq.nombre}</option>`;
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

    // Otras acciones vuelven a leer los equipos de localStorage (recargarPools) y dejan viejos los objetos con los que
    // se dibujó la tabla: por eso cada botón busca el equipo y el jugador actuales al momento del clic.
    function buscarJugadorPlantel(ciclo, equipoNombre, dni) {
        recargarPools();
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const equipo = (pool || []).find(e => e.nombre.trim().toLowerCase() === equipoNombre.trim().toLowerCase());
        const jugador = equipo ? (equipo.jugadores || []).find(j => String(j.dni) === dni) : undefined;
        return { equipo, jugador };
    }

    // Los partidos y las sanciones reconocen al jugador por su DNI (asistencia, tarjetas, suspensión) y sus goles por la
    // etiqueta 'Nombre (#N)'. Al corregir esos datos hay que reescribirlos ahí también: si no, pierde PJ, tarjetas,
    // suspensión y goles de sus partidos. (El diseño de los goles queda como está: es tema de la migración, CLAUDE.md 11.4.)
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
            if (cambioNombreODorsal) {
                ladosGoles.forEach(([lado, ladoId, campo]) => {
                    if (!Array.isArray(p[campo]) || !esDelEquipo(p[lado], p[ladoId])) return;
                    p[campo].forEach(g => {
                        if (g.nombre !== etiquetaAntes) return;
                        g.nombre = etiquetaDespues;
                        partidosTocados = true;
                    });
                });
            }
        });
        if (partidosTocados) localStorage.setItem('liga_partidos', JSON.stringify(partidos));

        let sancionesTocadas = false;
        listaSanciones.forEach(s => {
            if (!s.jugadorId || String(s.jugadorId) !== String(antes.dni)) return;
            s.jugadorId = despues.dni;
            s.jugador = `${despues.nombre} (${dorsalBF(despues)})`;
            sancionesTocadas = true;
        });
        if (sancionesTocadas) localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
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
            const igTexto = j.instagram ? `@${j.instagram.replace('@','')}` : '-';
            
            tablaJugadoresBody.innerHTML += `
                <tr>
                    <td style="color:#2edae3; font-weight:bold;">${dorsalBF(j)}</td>
                    <td style="font-weight:bold; color:#fff;" title="${j.nombre}">${j.nombre}</td>
                    <td>${j.dni || '-'}</td>
                    <td style="color:#4284f2;" title="${igTexto}">${igTexto}</td>
                    <td>
                        <button type="button" class="btn-toggle-ficha" data-dni="${j.dni}" style="background:transparent; border:none; cursor:pointer; font-size:10px; font-weight:bold; color:${esFichaEntregada ? '#4ade80' : '#f43f5e'};" title="Cambiar estado ficha">
                            ${esFichaEntregada ? 'OK' : 'Debe'}
                        </button>
                    </td>
                    <td>
                        <div style="display:flex; gap:3px; justify-content:center;">
                            <button type="button" class="btn-accion-plantel btn-editar-jugador" data-dni="${j.dni}" style="background:#0284c7; color:white; border:none; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Editar">Editar</button>
                            <button type="button" class="btn-accion-plantel btn-ver-emergencia" data-dni="${j.dni}" style="background:#1a3274; border:1px solid #2edae3; color:#2edae3; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Emergencia">SOS</button>
                            <button type="button" class="btn-accion-plantel btn-borrar-jugador" data-dni="${j.dni}" data-nombre="${j.nombre}" style="background:#991b1b; color:white; border:none; padding:4px 6px; border-radius:2px; font-size:9px; font-family:'Oswald'; cursor:pointer;" title="Eliminar">Baja</button>
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
                        // Una foto subida se guarda como dataURL: no tiene sentido volcarla en el
                        // campo de texto, va directo a la vista previa.
                        const esSubida = (j.foto || '').indexOf('data:') === 0;
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

                const { equipo } = buscarJugadorPlantel(ciclo, equipoNombre, dni);
                if (!equipo) {
                    alert('No se encontró el equipo en los planteles: no se eliminó nada.');
                    return;
                }
                equipo.jugadores = (equipo.jugadores || []).filter(j => String(j.dni) !== dni);
                guardarEquiposEnStorage();
                if (jugadorEnEdicionDNI === dni) cancelarEdicionJugador();
                renderizarTablaJugadores();
                alert(`La ficha de ${nombre} fue eliminada.`);
            });
        });
    }

    if (formJugador) {
        formJugador.addEventListener('submit', (e) => {
            e.preventDefault();

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
                foto: fotoJugadorSubida.dataURL || (document.getElementById('jugador-foto') ? document.getElementById('jugador-foto').value.trim() : ''),
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
                if (ciclo === 'superior') {
                    poolSuperior = poolSuperior.filter(e => e.nombre.trim().toLowerCase() !== equipoNombre.trim().toLowerCase());
                } else {
                    poolBasico = poolBasico.filter(e => e.nombre.trim().toLowerCase() !== equipoNombre.trim().toLowerCase());
                }

                guardarEquiposEnStorage();
                actualizarComboEquiposPlantel();
                actualizarOpcionesMoverEquipo();
                actualizarOpcionesGrupo();
                alert(`Equipo "${equipoNombre}" eliminado.`);
            }
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
                    <p style="margin:3px 0;"><strong>Equipo:</strong> ${equipoNombre} (${dorsalBF(j)})</p>
                    <p style="margin:3px 0;"><strong>DNI:</strong> ${j.dni || 'Sin datos'}</p>
                    <p style="margin:3px 0;"><strong>F. Nacimiento:</strong> ${j.nacimiento || 'Sin datos'}</p>
                    <p style="margin:3px 0;"><strong>Celular Jugador:</strong> ${j.celular || 'Sin datos'}</p>
                    <p style="margin:3px 0;"><strong>Ficha Médica:</strong> ${j.fichaMedica === 'si' ? 'Entregada y Firmada' : 'Pendiente'}</p>
                </div>

                <div style="background:rgba(244,63,94,0.1); padding:10px; border-radius:3px; border:1px solid rgba(244,63,94,0.3); margin-bottom:10px;">
                    <p style="margin:0 0 6px 0; color:#f43f5e; font-weight:bold; font-size:10px;">EN CASO DE EMERGENCIA AVISAR A:</p>
                    <p style="margin:3px 0;"><strong>Nombre:</strong> ${j.familiarNombre || 'No especificado'}</p>
                    <p style="margin:3px 0;"><strong>Parentesco:</strong> ${j.familiarParentesco || 'No especificado'}</p>
                    <p style="margin:3px 0; font-size:12px; color:#4ade80;"><strong>Teléfono:</strong> ${j.familiarTel || 'Sin teléfono'}</p>
                </div>

                <div style="background:rgba(242, 192, 14,0.08); padding:10px; border-radius:3px; border:1px solid rgba(242, 192, 14,0.2);">
                    <p style="margin:0 0 6px 0; color:#f2c00e; font-weight:bold; font-size:10px;">CENTRO DE SALUD / MÉDICO:</p>
                    <p style="margin:3px 0;"><strong>Concurrir a:</strong> ${j.concurrir || 'Hospital más cercano'} (${j.concurrirDir || 'Sin dirección'})</p>
                    <p style="margin:3px 0;"><strong>Médico:</strong> ${j.medico || 'No especificado'} (${j.medicoDir || 'Sin dirección/tel'})</p>
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
            sancionEquipo.innerHTML += `<option value="${e.nombre.trim()}">${e.nombre.trim()}</option>`;
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
            const detalleJugador = s.jugador ? ` — ${s.jugador}` : '';
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(225,29,72,0.05); padding:10px; margin-bottom:8px; border-radius:4px; border-left: 4px solid ${s.levantada ? '#4ade80' : '#ef4444'};">
                    <div style="text-align:left; max-width: 75%;">
                        <span style="font-size:10px; color:#f43f5e; display:block; text-transform:uppercase;">ACTA N° ${s.acta || 1} (${s.ciclo ? s.ciclo.toUpperCase() : 'SUPERIOR'}) — ${s.tipo || 'Sanción'}${s.origenAuto ? ' · AUTOMÁTICA (Tesorería)' : ''}</span>
                        <span style="font-size:12px; color:white; font-weight:bold;">${s.equipo}${detalleJugador}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block; margin-top:2px;">${s.motivo || 'Sin motivo detallado'}</span>
                        ${s.levantada ? `<span style="font-size:10px; color:#4ade80; display:block; margin-top:2px;">(${s.fechaLevantada}) Quita levantada: pagó el 50%</span>` : ''}
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
                desvincularSancionAuto(listaSanciones.find(s => s.id === idBorrar));
                listaSanciones = listaSanciones.filter(s => s.id !== idBorrar);
                localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
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

            localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
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
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${n.titulo}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block;">${n.texto}</span>
                    </div>
                    <button class="btn-borrar-noticia" data-id="${n.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-noticia').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaNoticias = listaNoticias.filter(n => n.id !== idBorrar);
                localStorage.setItem('liga_noticias', JSON.stringify(listaNoticias));
                actualizarListaNoticiasAdmin();
            });
        });
    }

    if (formNoticia) {
        formNoticia.addEventListener('submit', (e) => {
            e.preventDefault();
            // La foto puede venir de una ruta escrita a mano o de un archivo subido (ya comprimido).
            const fotoNoticia = fotoNoticiaSubida.dataURL || document.getElementById('noticia-foto').value.trim();
            if (!fotoNoticia) {
                alert('Falta la foto de la noticia: pegá una ruta/URL o subí un archivo.');
                return;
            }

            const nuevaNoticia = {
                id: Date.now(),
                titulo: document.getElementById('noticia-titulo').value.trim(),
                texto: document.getElementById('noticia-texto').value.trim(),
                foto: fotoNoticia,
                linkUrl: document.getElementById('noticia-link-url').value.trim(),
                linkTexto: document.getElementById('noticia-link-texto').value.trim() || 'VER MÁS'
            };

            const respaldo = listaNoticias.slice();
            listaNoticias.push(nuevaNoticia);
            if (!guardarClaveConAviso('liga_noticias', JSON.stringify(listaNoticias))) {
                listaNoticias = respaldo;
                return;
            }

            formNoticia.reset();
            fotoNoticiaSubida.limpiar();
            actualizarListaNoticiasAdmin();
            renderizarUsoStorage();
            alert('¡Noticia guardada con éxito!');
        });
    }

    // ============================================================
    // 6.0 MÓDULO ÁLBUMES DE FOTOS
    // ============================================================
    let listaFotosAlbumes = JSON.parse(localStorage.getItem('liga_fotos_albumes')) || (typeof ligaData !== 'undefined' && ligaData.fotosAlbumes ? ligaData.fotosAlbumes : []);
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
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${a.titulo}</span>
                        <span style="font-size:10px; color:#869bd8; display:block;">${a.link}</span>
                    </div>
                    <button class="btn-borrar-album" data-id="${a.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:2px; cursor:pointer; font-size:10px; font-family:'Oswald';">Eliminar</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-album').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaFotosAlbumes = listaFotosAlbumes.filter(a => a.id !== idBorrar);
                localStorage.setItem('liga_fotos_albumes', JSON.stringify(listaFotosAlbumes));
                actualizarListaFotosAdmin();
            });
        });
    }

    if (formFotos) {
        formFotos.addEventListener('submit', (e) => {
            e.preventDefault();
            const portada = portadaAlbumSubida.dataURL || document.getElementById('foto-album-portada').value.trim();
            if (!portada) {
                alert('Falta la foto de portada: pegá una ruta/URL o subí un archivo.');
                return;
            }

            const nuevoAlbum = {
                id: Date.now(),
                titulo: document.getElementById('foto-album-titulo').value.trim(),
                portada: portada,
                link: document.getElementById('foto-album-link').value.trim()
            };

            const respaldo = listaFotosAlbumes.slice();
            listaFotosAlbumes.push(nuevoAlbum);
            if (!guardarClaveConAviso('liga_fotos_albumes', JSON.stringify(listaFotosAlbumes))) {
                listaFotosAlbumes = respaldo;
                return;
            }
            formFotos.reset();
            portadaAlbumSubida.limpiar();
            actualizarListaFotosAdmin();
            renderizarUsoStorage();
            alert('¡Álbum publicado con éxito!');
        });
    }

    actualizarListaFotosAdmin();

    // ============================================================
    // 6.1 GESTOR DE SPONSORS (CRUD completo, editable desde Prensa & Fotos)
    // ============================================================
    let listaSponsors = JSON.parse(localStorage.getItem('liga_sponsors')) || (typeof ligaData !== 'undefined' && ligaData.sponsors ? ligaData.sponsors : []);

    function guardarSponsorsEnStorage() {
        localStorage.setItem('liga_sponsors', JSON.stringify(listaSponsors));
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
                <img src="${s.logo || 'Recursos/logo pelota fut.svg'}" style="width:36px; height:36px; object-fit:contain; border-radius:3px; background:${s.colorFondo || '#0a1d54'};">
                <div style="flex:1; min-width:120px; text-align:left;">
                    <span style="font-size:12px; color:#fff; font-weight:bold; display:block;">${s.nombre}</span>
                    <span style="font-size:9px; color:#869bd8;">${s.categoria || 'Sin categoría'}</span>
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
        formSponsor.addEventListener('submit', (e) => {
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

            if (idSponsorEnEdicion !== null) {
                const existente = listaSponsors.find(s => s.id === idSponsorEnEdicion);
                datosSponsor.logo = logoSponsorBase64Temp || (existente ? existente.logo : '');
                listaSponsors = listaSponsors.map(s => s.id === idSponsorEnEdicion ? { ...s, ...datosSponsor } : s);
                alert(`¡Sponsor "${datosSponsor.nombre}" actualizado!`);
            } else {
                datosSponsor.logo = logoSponsorBase64Temp || 'Recursos/logo pelota fut.svg';
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
    const subVistaTesoPartidos = document.getElementById('sub-vista-teso-partidos');
    const subVistaTesoInscripciones = document.getElementById('sub-vista-teso-inscripciones');
    const subVistaTesoCaja = document.getElementById('sub-vista-teso-caja');
    const filtroTesoreriaFecha = document.getElementById('filtro-tesoreria-fecha');
    const filtroTesoreriaCancha = document.getElementById('filtro-tesoreria-cancha');
    const filtroInscripcionesCiclo = document.getElementById('filtro-inscripciones-ciclo');

    function ocultarTodasLasSubVistasTeso() {
        [subVistaTesoPartidos, subVistaTesoInscripciones, subVistaTesoCaja].forEach(v => { if (v) v.classList.add('seccion-oculta-staff'); });
        [btnSubTesoPartidos, btnSubTesoInscripciones, btnSubTesoCaja].forEach(b => { if (b) b.classList.remove('active'); });
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

    if (btnSubTesoCaja) {
        btnSubTesoCaja.addEventListener('click', () => {
            ocultarTodasLasSubVistasTeso();
            btnSubTesoCaja.classList.add('active');
            if (subVistaTesoCaja) subVistaTesoCaja.classList.remove('seccion-oculta-staff');
            renderizarCajaPorFecha();
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
                        <span style="color:#fff; font-weight:bold; flex:1; min-width:100px;">${m.equipo}</span>
                        <span style="color:#869bd8; flex:1; min-width:120px;">${m.concepto}${m.detalle ? ' — ' + m.detalle : ''}</span>
                        <span style="color:#2edae3; min-width:110px;">${m.medio === 'Efectivo' ? '' : ''} ${m.medio}</span>
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

    function renderizarTesoreriaInscripciones() {
        const tbody = document.getElementById('tbody-tesoreria-inscripciones');
        const inputMontoInscripcion = document.getElementById('monto-inscripcion-individual');
        if (!tbody) return;

        if (inputMontoInscripcion) {
            const montoGuardado = localStorage.getItem('liga_valor_inscripcion');
            if (montoGuardado && !inputMontoInscripcion.dataset.cargado) {
                inputMontoInscripcion.value = montoGuardado;
                inputMontoInscripcion.dataset.cargado = "true";
            }
        }

        recargarPools();
        const ciclo = filtroInscripcionesCiclo ? filtroInscripcionesCiclo.value : 'superior';
        const pool = ciclo === 'superior' ? poolSuperior : poolBasico;
        const valorIndividual = parseFloat(inputMontoInscripcion ? inputMontoInscripcion.value : 3000) || 3000;

        tbody.innerHTML = '';

        if (!pool || pool.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#869bd8; padding:15px;">Sin equipos cargados.</td></tr>';
            return;
        }

        pool.forEach(eq => {
            const cantJugadores = eq.jugadores ? eq.jugadores.length : 0;
            const totalExigido = cantJugadores * valorIndividual;
            const idEq = eq.nombre.trim();
            const pagoData = tesoreriaInscripciones[idEq] || { ef: 0, tr: 0 };
            const deuda = totalExigido - ((pagoData.ef || 0) + (pagoData.tr || 0));

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:bold; color:#fff;">${eq.nombre}</td>
                    <td style="text-align:center; color:#2edae3; font-weight:bold;">${cantJugadores} jug.</td>
                    <td style="text-align:center; color:#f2c00e; font-weight:bold;">$${totalExigido.toLocaleString()}</td>
                    <td style="text-align:center;">
                        <input type="number" class="input-monto-teso in-insc-ef" data-eq="${idEq}" value="${pagoData.ef || 0}">
                    </td>
                    <td style="text-align:center;">
                        <input type="number" class="input-monto-teso in-insc-tr" data-eq="${idEq}" value="${pagoData.tr || 0}">
                    </td>
                    <td style="text-align:center;">
                        <span style="font-weight:bold; color:${deuda <= 0 ? '#4ade80' : '#f43f5e'};">
                            ${deuda <= 0 ? 'AL DÍA' : `$${deuda.toLocaleString()}`}
                        </span>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.in-insc-ef').forEach(inpt => {
            inpt.addEventListener('change', (e) => {
                const idEq = e.target.getAttribute('data-eq');
                if (!tesoreriaInscripciones[idEq]) tesoreriaInscripciones[idEq] = { ef: 0, tr: 0 };
                const valorAnterior = tesoreriaInscripciones[idEq].ef || 0;
                const valorNuevo = parseFloat(e.target.value) || 0;
                tesoreriaInscripciones[idEq].ef = valorNuevo;
                localStorage.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
                registrarMovimientoCaja({ equipo: idEq, concepto: 'Inscripción', medio: 'Efectivo', monto: valorNuevo - valorAnterior });
                renderizarTesoreriaInscripciones();
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
                localStorage.setItem('liga_tesoreria_inscripciones', JSON.stringify(tesoreriaInscripciones));
                registrarMovimientoCaja({ equipo: idEq, concepto: 'Inscripción', medio: 'Transferencia', monto: valorNuevo - valorAnterior });
                renderizarTesoreriaInscripciones();
                calcularBalanceGeneral();
            });
        });
    }

    if (filtroInscripcionesCiclo) filtroInscripcionesCiclo.addEventListener('change', renderizarTesoreriaInscripciones);

    if (document.getElementById('monto-inscripcion-individual')) {
        document.getElementById('monto-inscripcion-individual').addEventListener('change', (e) => {
            localStorage.setItem('liga_valor_inscripcion', e.target.value);
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
        localStorage.setItem('liga_tesoreria_partidos_v2', JSON.stringify(tesoreriaPartidos));
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

    function claveTesoreria(p, lado) {
        const nombre = lado === 'local' ? p.local : p.visitante;
        return `F${p.fecha}_${p.id}_${lado === 'local' ? 'local' : 'visita'}_${nombre.trim().toLowerCase()}`;
    }

    function fechaHoyTexto() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    let ultimoIdSancionAuto = 0;
    function generarIdSancion() {
        ultimoIdSancionAuto = Math.max(Date.now(), ultimoIdSancionAuto + 1);
        return ultimoIdSancionAuto;
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
                const nombreKey = nombre.trim().toLowerCase();
                const clave = claveTesoreria(p, lado);
                const data = tesoreriaPartidos[clave] || {};
                const arancelBase = data.arancel || p.arancelExigido || ARANCEL_PARTIDO_DEFECTO;
                const asistencia = data.asistencia || '';
                const ausente = asistencia === 'sin_aviso' || asistencia === 'con_aviso';

                // El ausente debe el 50 % del derecho de partido; el que se presenta, el 100 %.
                // En Play-Offs el ausente queda eliminado y no juega: no debe nada.
                const exigidoBruto = ausente ? (Number(p.fecha) >= 100 ? 0 : arancelBase * 0.5) : arancelBase;
                const saldoPrevio = saldos[nombreKey] || 0;
                const saldoAplicado = Math.min(saldoPrevio, exigidoBruto);
                const exigido = exigidoBruto - saldoAplicado;
                const pagado = (data.ef || 0) + (data.tr || 0);
                const falta = Math.max(0, exigido - pagado);
                const saldoGenerado = Math.max(0, pagado - exigido);
                saldos[nombreKey] = saldoPrevio - saldoAplicado + saldoGenerado;

                const cubierto = pagado + saldoAplicado;
                porClave[clave] = {
                    clave, nombre, lado, data, arancelBase, asistencia, ausente,
                    exigidoBruto, saldoAplicado, exigido, pagado, falta, saldoGenerado, cubierto,
                    porcentaje: arancelBase > 0 ? cubierto / arancelBase : 1
                };
                if (!historial[nombreKey]) historial[nombreKey] = [];
                historial[nombreKey].push({ orden: ordenCronologicoFecha(p.fecha), fecha: p.fecha, falta });
            });
        });

        return { porClave, historial };
    }

    function obtenerDeudaHistorica(calc, nombreEquipo, fechaActual) {
        const ordenActual = ordenCronologicoFecha(fechaActual);
        const pendientes = (calc.historial[nombreEquipo.trim().toLowerCase()] || [])
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
                            id: generarIdSancion(),
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
            localStorage.setItem('liga_partidos', JSON.stringify(partidos));
            if (typeof actualizarListaAdmin === 'function') actualizarListaAdmin();
        }
        if (cambioSanciones) {
            localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
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
        localStorage.setItem('liga_partidos', JSON.stringify(partidos));
    }

    // Suspensión de un jugador en la fecha de un partido: corre desde la fecha SIGUIENTE a la del acta y dura tantas fechas
    // como indica "puntosRestados" de la sanción "Sanción Disciplinaria" (decidido por Joaquín). Las fechas se cuentan sobre
    // las fechas que existen en el ciclo, en orden cronológico (los playoffs 108/104/102/100 van después de la fecha 7).
    function suspensionVigenteDe(jugador, ciclo, fechaPartido) {
        const dni = soloDigitosDni(jugador.dni);
        if (dni === '') return null;
        const fechas = [...new Set(partidos.filter(p => (p.ciclo || 'superior') === ciclo).map(p => Number(p.fecha)))]
            .sort((a, b) => ordenCronologicoFecha(a) - ordenCronologicoFecha(b));
        const posicion = f => fechas.filter(x => ordenCronologicoFecha(x) <= ordenCronologicoFecha(f)).length;
        const posicionPartido = posicion(Number(fechaPartido));
        return listaSanciones.find(s => {
            if (s.tipo !== 'Sanción Disciplinaria' || !(s.puntosRestados > 0) || s.levantada) return false;
            if (!s.jugadorId || soloDigitosDni(s.jugadorId) !== dni || (s.ciclo || 'superior') !== ciclo) return false;
            const primeraFecha = posicion(Number(s.acta)) + 1;
            return posicionPartido >= primeraFecha && posicionPartido < primeraFecha + Number(s.puntosRestados);
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
            chip = `<div class="teso-chip teso-chip-verde">(${registro.fechaLevantada}) Quita levantada: pagó el 50%</div>`;
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
                    <span class="teso-team-name">${t.nombre}</span>
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
                    <input type="number" class="input-monto-teso in-p-ef" data-key="${t.clave}" data-equipo="${t.nombre}" data-fase="${faseLabel}" value="${t.data.ef || 0}">
                </div>
                <div class="teso-inputs-row">
                    <label>Pago Transf. ($):</label>
                    <input type="number" class="input-monto-teso in-p-tr" data-key="${t.clave}" data-equipo="${t.nombre}" data-fase="${faseLabel}" value="${t.data.tr || 0}">
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
            const avisosHtml = ev.avisos.map(a => `<div class="teso-aviso teso-aviso-${a.tipo}">${a.texto}</div>`).join('');

            return `
                <div class="teso-match-card">
                    <div class="teso-match-header">
                        <span><strong>${faseLabel}</strong> — ${p.cancha || 'Cancha a confirmar'} (${p.horario ? p.horario + ' hs' : 'A confirmar'})</span>
                        <span>Árbitro: <strong>${p.arbitro || 'Por Asignar'}</strong></span>
                        <button type="button" class="teso-btn-imprimir" data-pid="${p.id}">Imprimir planilla</button>
                    </div>

                    <div class="teso-match-teams-grid">
                        ${htmlCajaEquipoTeso(ev.L, ev, faseLabel, obtenerDeudaHistorica(calc, p.local, p.fecha), p)}
                        ${htmlCajaEquipoTeso(ev.V, ev, faseLabel, obtenerDeudaHistorica(calc, p.visitante, p.fecha), p)}
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

    // Egresos
    const formEgreso = document.getElementById('form-egreso');
    if (formEgreso) {
        formEgreso.addEventListener('submit', (e) => {
            e.preventDefault();
            const nuevoEgreso = {
                id: Date.now(),
                concepto: document.getElementById('egreso-concepto').value,
                detalle: document.getElementById('egreso-detalle').value.trim(),
                monto: parseFloat(document.getElementById('egreso-monto').value) || 0,
                medio: document.getElementById('egreso-medio').value
            };
            listaEgresos.push(nuevoEgreso);
            localStorage.setItem('liga_egresos', JSON.stringify(listaEgresos));
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
                        <span style="font-size:11px; color:white; font-weight:bold;">${eg.detalle} (${eg.concepto.toUpperCase()})</span>
                        <span style="font-size:9px; color:#fca5a5; display:block;">Medio: ${eg.medio.toUpperCase()}</span>
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
                localStorage.setItem('liga_egresos', JSON.stringify(listaEgresos));
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
    }

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
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${a.titulo}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block; margin-top:2px;">${a.texto}</span>
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
                localStorage.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
                actualizarListaAlertasAdmin();
            });
        });
    }

    if (btnVaciarAlertasAdmin) {
        btnVaciarAlertasAdmin.addEventListener('click', () => {
            if (listaAlertas.length === 0) return;
            if (!confirm('¿Vaciar todo el historial de avisos? Esta acción no se puede deshacer.')) return;
            listaAlertas = [];
            localStorage.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
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
                        <span style="font-size:11px; color:white; display:block;">${a.detalle}</span>
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
                localStorage.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
                actualizarListaAvisosStaff();
            });
        });
    }

    if (btnVaciarAvisosStaff) {
        btnVaciarAvisosStaff.addEventListener('click', () => {
            if (avisosStaff.length === 0) return;
            if (!confirm('¿Vaciar todo el historial de avisos internos? Esta acción no se puede deshacer.')) return;
            avisosStaff = [];
            localStorage.setItem('liga_avisos_staff', JSON.stringify(avisosStaff));
            actualizarListaAvisosStaff();
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
            localStorage.setItem('liga_notificaciones', JSON.stringify(listaAlertas));
            formAlerta.reset();
            actualizarListaAlertasAdmin();
            alert('¡Alerta emitida!');
        });
    }

    // ============================================================
    // 9. INICIALIZACIÓN GENERAL AL CARGAR ADMIN.HTML
    // ============================================================
    actualizarOpcionesGrupo();
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
                : `<p style="font-size:13px; color:#fff; font-weight:bold; margin:0 0 6px 0;">${pendientes[0].p.local} vs ${pendientes[0].p.visitante}</p>
                   <p style="font-size:11px; color:#869bd8; margin:0;">${pendientes[0].p.dia || 'Sin fecha'} — ${pendientes[0].p.horario || 'Sin horario'} — ${pendientes[0].p.cancha || 'Cancha a confirmar'}</p>`;
        }

        // Últimas sanciones
        const contSanciones = document.getElementById('resumen-ultimas-sanciones');
        if (contSanciones) {
            const ultimas = listaSanciones.slice().sort((a, b) => b.id - a.id).slice(0, 3);
            contSanciones.innerHTML = ultimas.length === 0
                ? '<p style="color:#869bd8; font-size:11px;">Sin sanciones registradas.</p>'
                : ultimas.map(s => `
                    <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:11px; color:#fff; font-weight:bold; display:block;">${s.equipo}</span>
                        <span style="font-size:10px; color:#869bd8;">${s.tipo}${s.motivo ? ' — ' + s.motivo : ''}</span>
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
                        <span style="font-size:11px; color:${a.tipo === 'urgente' ? '#f43f5e' : '#fff'}; font-weight:bold; display:block;">${a.titulo}</span>
                        <span style="font-size:10px; color:#869bd8;">${a.texto || ''}</span>
                    </div>
                `).join('');
        }

        // Equipos con inscripción pendiente (solo cantidad — el detalle en $ vive en Tesorería, exclusivo Admin)
        const contPagos = document.getElementById('resumen-pagos-pendientes');
        if (contPagos) {
            const valorIndividual = parseFloat(localStorage.getItem('liga_valor_inscripcion')) || 3000;
            const equiposTotal = [...(poolSuperior || []), ...(poolBasico || [])];
            const pendientesPago = equiposTotal.filter(eq => {
                const cant = eq.jugadores ? eq.jugadores.length : 0;
                const exigido = cant * valorIndividual;
                const pago = tesoreriaInscripciones[eq.nombre.trim()] || { ef: 0, tr: 0 };
                const pagado = (pago.ef || 0) + (pago.tr || 0);
                return exigido > 0 && pagado < exigido;
            });

            contPagos.innerHTML = pendientesPago.length === 0
                ? '<p style="color:#4ade80; font-size:11px; font-weight:bold;">Todos los equipos están al día con la inscripción.</p>'
                : `<p style="font-size:24px; color:#f2c00e; font-family:'Michroma'; font-weight:bold; margin:0;">${pendientesPago.length}</p>
                   <p style="font-size:10px; color:#869bd8; margin:4px 0 0 0;">equipo(s) con inscripción incompleta</p>`;
        }

        renderizarUsoStorage();
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
                <span class="resultado-buscador-nombre">${r.jugador.nombre}</span>
                <span class="resultado-buscador-meta">${dorsalBF(r.jugador)} — ${r.equipo}</span>
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