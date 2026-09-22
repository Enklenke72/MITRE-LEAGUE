document.addEventListener('DOMContentLoaded', () => {

    // 1. ALGORITMO DE ORDENAMIENTO
    function ordenarTabla(equipos) {
        return [...equipos].sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dif !== a.dif) return b.dif - a.dif;
            return b.gf - a.gf;
        });
    }

    // Clasificación a Playoffs (formato por grupos): 1°, 2° y 3° de CADA grupo
    // clasifican directo. Además clasifica un único "mejor 4°" comparando el 4to
    // puesto de todos los grupos entre sí (mismo criterio de desempate: PTS → DIF → GF).
    // Recorre TODO el ciclo (no sólo el grupo que se está por pintar), por eso vive
    // separado de renderizarTabla — la tabla en pantalla muestra un grupo a la vez,
    // pero el "mejor 4°" depende de comparar contra los demás grupos.
    function obtenerMejorCuartoId(dataArray) {
        const porGrupo = {};
        dataArray.forEach(equipo => {
            if (!equipo.grupo || equipo.grupo === 'Unico') return; // Tabla Única no tiene este formato de clasificación
            if (!porGrupo[equipo.grupo]) porGrupo[equipo.grupo] = [];
            porGrupo[equipo.grupo].push(equipo);
        });

        const cuartosPuestos = Object.values(porGrupo)
            .map(equiposDelGrupo => ordenarTabla(equiposDelGrupo)[3]) // índice 3 = 4to puesto
            .filter(Boolean); // grupos con menos de 4 equipos no aportan candidato a "mejor 4°"

        if (cuartosPuestos.length === 0) return null;
        return ordenarTabla(cuartosPuestos)[0].id;
    }

    // 2. PROCESAMIENTO MATEMÁTICO DE LA LIGA
    // 2. PROCESAMIENTO MATEMÁTICO DE LA LIGA
    function procesarLiga() {
        // NUEVO: Traemos los equipos actualizados desde la memoria (con sus grupos nuevos)
        const supDinamicos = localStorage.getItem('liga_cicloSuperior');
        if (supDinamicos) { 
            ligaData.cicloSuperior = JSON.parse(supDinamicos); 
        }

        const basDinamicos = localStorage.getItem('liga_cicloBasico');
        if (basDinamicos) { 
            ligaData.cicloBasico = JSON.parse(basDinamicos); 
        }

        const partidosDinamicos = localStorage.getItem('liga_partidos'); 
        if (partidosDinamicos) { 
            ligaData.partidos = JSON.parse(partidosDinamicos); 
        }

        const sancionesDinamicas = localStorage.getItem('liga_sanciones');
        if (sancionesDinamicas) {
            ligaData.sanciones = JSON.parse(sancionesDinamicas);
        }

        const resetearContadores = (ciclo) => {
            ciclo.forEach(e => {
                e.pj = 0; e.g = 0; e.e = 0; e.p = 0; e.gf = 0; e.gc = 0; e.dif = 0; e.pts = 0;
            });
        };
        resetearContadores(ligaData.cicloSuperior);
        resetearContadores(ligaData.cicloBasico);

        ligaData.partidos.forEach(partido => {
            if (!partido.jugado || partido.esPlayoff) return; // Los partidos de playoff no suman a la fase de grupos

            let poolEquipos = partido.ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
            let local = poolEquipos.find(e => e.nombre.trim() === partido.local.trim());
            let visitante = poolEquipos.find(e => e.nombre.trim() === partido.visitante.trim());

            if (local && visitante) {
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
            }
        });

        ligaData.sanciones.forEach(sancion => {
            let pool = sancion.ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
            let equipoSancionado = pool.find(e => e.nombre.trim() === sancion.equipo.trim());
            if (equipoSancionado) {
                // Solo la "Quita de Puntos" resta en la tabla; en las suspensiones, "puntosRestados" guarda la cantidad de fechas.
                if (sancion.tipo === 'Quita de Puntos') equipoSancionado.pts -= sancion.puntosRestados;
            }
        });
    }

    // 3. RENDERIZADO DE TABLAS
    // 1. DIBUJAR TABLAS CON CONTROL GF/GC SEGÚN VISTA
    // 3. RENDERIZADO DE TABLAS CON SOPORTE PARA TABLA ÚNICA Y BOMBOS
    function renderizarTabla(dataArray, tbodySelector, tituloSelector, grupoId, nombreGrupo) {
        const tbody = document.querySelector(tbodySelector);
        const titulo = document.querySelector(tituloSelector);
        if (!tbody || !titulo) return;

        tbody.innerHTML = ''; 

        const esTablaUnica = (grupoId === 'Unico' || grupoId === 'Tabla Única');
        titulo.textContent = esTablaUnica ? 'TABLA ÚNICA' : `Grupo ${nombreGrupo}`;

        // Subtítulo dinámico: Cambia según el formato (Mundial vs Tabla Única)
        const subtitulo = titulo.nextElementSibling;
        if (subtitulo && subtitulo.classList.contains('group-category')) {
            subtitulo.textContent = esTablaUnica
                ? 'Clasificación a Playoffs: Bombo 1 (1° al 4°) | Bombo 2 (5° al 8°) | Bombo 3 (9° al 12°)'
                : 'Clasifican los 3 primeros de cada grupo + el mejor 4° puesto';
        }

        const equiposFiltrados = ordenarTabla(
            esTablaUnica ? dataArray.filter(e => e.grupo === 'Unico' || !e.grupo) : dataArray.filter(e => e.grupo === grupoId)
        );

        const dashboard = document.querySelector('.dashboard-container');
        const esVistaPosiciones = dashboard ? dashboard.classList.contains('vista-ancha') : false;

        document.querySelectorAll('.col-gf-gc').forEach(th => {
            th.style.display = esVistaPosiciones ? 'table-cell' : 'none';
        });

        // El "mejor 4°" se calcula sobre TODO el ciclo (todos los grupos), no sólo
        // sobre el grupo que se está por pintar — por eso se resuelve una vez acá.
        const mejorCuartoId = esTablaUnica ? null : obtenerMejorCuartoId(dataArray);

        equiposFiltrados.forEach((equipo, index) => {
            // Lógica de Clases y Colores por Bombos / Posición
            let clasePosicion = 'td-pos-normal';
            let esMejorCuarto = false;
            let clasifica = false;

            if (esTablaUnica) {
                if (index < 4) clasePosicion = 'td-pos-bombo1';       // Bombo 1 (1° al 4°)
                else if (index < 8) clasePosicion = 'td-pos-bombo2';  // Bombo 2 (5° al 8°)
                else if (index < 12) clasePosicion = 'td-pos-bombo3'; // Bombo 3 (9° al 12°)
            } else {
                esMejorCuarto = (index === 3 && equipo.id === mejorCuartoId);
                clasifica = index < 3 || esMejorCuarto;
                clasePosicion = esMejorCuarto ? 'td-pos-mejor4to' : (clasifica ? 'td-pos-lead' : 'td-pos-normal');
            }

            let colorDiffStyle = equipo.dif > 0 ? 'style="color: #4ade80 !important;"' : (equipo.dif < 0 ? 'style="color: #f43f5e !important;"' : '');
            const diffTexto = equipo.dif > 0 ? '+' + equipo.dif : equipo.dif;

            const columnasGFGC = esVistaPosiciones
                ? `<td style="color: #869bd8;">${equipo.gf}</td><td style="color: #869bd8;">${equipo.gc}</td>`
                : '';

            let claseFila = 'row-normal';
            if (!esTablaUnica) {
                claseFila = esMejorCuarto ? 'row-mejor4to' : (clasifica ? 'row-leader' : 'row-normal');
            }

            tbody.innerHTML += `
                <tr class="${claseFila}">
                    <td class="${clasePosicion}" ${esMejorCuarto ? 'title="Clasifica como mejor 4° puesto"' : ''}>${index + 1}</td>
                    <td class="td-team-name">${equipo.nombre}</td>
                    <td>${equipo.pj}</td>
                    <td>${equipo.g}</td>
                    <td>${equipo.e}</td>
                    <td>${equipo.p}</td>
                    ${columnasGFGC}
                    <td class="td-diff-positive" ${colorDiffStyle}>${diffTexto}</td>
                    <td class="td-pts-total">${equipo.pts}</td>
                </tr>
            `;
        });
    }
    // LÓGICA DE GOLEADORES POR CICLO
    let cicloGoleadoresActivo = 'superior';

    function renderizarGoleadores() {
        const tbody = document.getElementById('tbody-goleadores');
        if (!tbody) return;

        const pool = cicloGoleadoresActivo === 'superior' 
            ? (JSON.parse(localStorage.getItem('liga_cicloSuperior')) || ligaData.cicloSuperior) 
            : (JSON.parse(localStorage.getItem('liga_cicloBasico')) || ligaData.cicloBasico);

        let listaJugadores = [];
        pool.forEach(eq => {
            if (eq.jugadores) {
                eq.jugadores.forEach(j => {
                    if (j.goles && j.goles > 0) {
                        listaJugadores.push({
                            nombre: j.nombre,
                            equipo: eq.nombre,
                            goles: j.goles
                        });
                    }
                });
            }
        });

        listaJugadores.sort((a, b) => b.goles - a.goles);
        const topGoleadores = listaJugadores.slice(0, 10);

        tbody.innerHTML = '';
        if (topGoleadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#869bd8; padding:10px; font-size:10px;">Sin goles registrados.</td></tr>';
            return;
        }

        topGoleadores.forEach((j, i) => {
            tbody.innerHTML += `
                <tr class="row-normal">
                    <td style="color:#fff; text-align:center;">${i + 1}</td>
                    <td class="td-team-name">${j.nombre}</td>
                    <td style="font-size: 12px; color: #a9bce8;">${j.equipo}</td>
                    <td style="font-weight: bold; color: #2edae3; text-align:center;">${j.goles}</td>
                </tr>
            `;
        });
    }

    // Escuchadores de botones del filtro Goleadores
    document.querySelectorAll('.btn-gol-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-gol-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cicloGoleadoresActivo = btn.getAttribute('data-ciclo-gol');
            renderizarGoleadores();
        });
    });



    // 2. LÓGICA DE TABLA ANUAL Y MÉTRICAS (PUNTOS / GF / GC)
    let cicloAnualActivo = 'superior';
    let criterioAnualActivo = 'puntos';

    function renderizarTablaAnual() {
        const tbody = document.getElementById('tbody-anual');
        const thead = document.getElementById('thead-anual');
        if (!tbody || !thead) return;

        const pool = cicloAnualActivo === 'superior' ? [...ligaData.cicloSuperior] : [...ligaData.cicloBasico];

        // Ordenamos según el criterio elegido
        if (criterioAnualActivo === 'puntos') {
            pool.sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.dif - a.dif);
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>+/-</th><th style="color:#f2c00e;">PTS</th>`;
        } else if (criterioAnualActivo === 'gf') {
            pool.sort((a, b) => b.gf !== a.gf ? b.gf - a.gf : a.gc - b.gc);
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th style="color:#4ade80; font-weight:bold;">GF (A Favor)</th><th>GC</th><th>+/-</th><th>PTS</th>`;
        } else if (criterioAnualActivo === 'gc') {
            pool.sort((a, b) => a.gc !== b.gc ? a.gc - b.gc : b.gf - a.gf); // Menos GC primero
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th style="color:#23b1f0; font-weight:bold;">GC (En Contra)</th><th>GF</th><th>+/-</th><th>PTS</th>`;
        }

        tbody.innerHTML = '';
        pool.forEach((e, i) => {
            let metricasHTML = '';
            if (criterioAnualActivo === 'puntos') {
                metricasHTML = `<td>${e.pj}</td><td>${e.g}</td><td>${e.e}</td><td>${e.p}</td><td>${e.gf}</td><td>${e.gc}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td style="color:#f2c00e; font-weight:bold;">${e.pts}</td>`;
            } else if (criterioAnualActivo === 'gf') {
                metricasHTML = `<td>${e.pj}</td><td style="color:#4ade80; font-weight:bold;">${e.gf}</td><td>${e.gc}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td>${e.pts}</td>`;
            } else if (criterioAnualActivo === 'gc') {
                metricasHTML = `<td>${e.pj}</td><td style="color:#23b1f0; font-weight:bold;">${e.gc}</td><td>${e.gf}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td>${e.pts}</td>`;
            }

            tbody.innerHTML += `
                <tr class="row-normal">
                    <td class="td-pos-normal">${i + 1}</td>
                    <td class="td-team-name">${e.nombre}</td>
                    ${metricasHTML}
                </tr>
            `;
        });
    }

    // Escuchadores para la Tabla Anual
    document.querySelectorAll('.btn-anual-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-anual-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cicloAnualActivo = btn.getAttribute('data-anual-ciclo');
            renderizarTablaAnual();
        });
    });

    document.querySelectorAll('.btn-anual-criterio').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-anual-criterio').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            criterioAnualActivo = btn.getAttribute('data-criterio');
            renderizarTablaAnual();
        });
    });

    

    // 4. RENDERIZADO DE PARTIDOS EN HOME Y FIXTURE (Con indicación de Fecha)
    function renderizarResultados(fechaSeleccionada) {
        const partidosDinamicos = localStorage.getItem('liga_partidos');
        if (partidosDinamicos) ligaData.partidos = JSON.parse(partidosDinamicos);

        const contenedor = document.querySelector('.resultados-lista');
        if (!contenedor) return; 

        contenedor.innerHTML = ''; 

        // 1. Si no le pasamos fecha, detecta automáticamente la última fecha con partidos en el sistema
        // (excluye partidos de playoff: usan códigos 100/102/104/108 que son más altos que
        // cualquier fecha real de temporada regular y rompían este cálculo con Math.max)
        if (!fechaSeleccionada) {
            const ultimasFechas = ligaData.partidos.filter(p => !p.esPlayoff).map(p => p.fecha);
            fechaSeleccionada = ultimasFechas.length > 0 ? Math.max(...ultimasFechas) : 1;
        }

        // 2. Buscamos el título principal del bloque en la Home/Fixture para ponerle la Fecha
        const tituloSeccion = document.querySelector('#pantalla-fixture h2');
        if (ligaData.partidos.length === 0) {
            if (tituloSeccion) tituloSeccion.textContent = 'ULTIMOS PARTIDOS';
            contenedor.innerHTML = '<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 18px;">Todavía no hay partidos cargados.</p>';
            return;
        }
        if (tituloSeccion) {
            tituloSeccion.innerHTML = `ULTIMOS PARTIDOS <span style="font-size: 13px; color: #2edae3; font-family: 'Oswald'; display: block; margin-top: 10px;">— FECHA ${fechaSeleccionada} —</span>`;
        }

        const partidosFiltrados = ligaData.partidos.filter(partido => partido.fecha === fechaSeleccionada);

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = `<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 18px;">No hay partidos cargados para la Fecha ${fechaSeleccionada}.</p>`;
            return;
        }

        partidosFiltrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });

        let ultimoSeparador = "";

        partidosFiltrados.forEach(partido => {
            const grupoActual = partido.grupo || 'A';
            const infoSeparador = `${partido.ciclo === 'superior' ? 'Superior' : 'Básico'} - Grupo ${grupoActual}`;

            if (infoSeparador !== ultimoSeparador) {
                contenedor.innerHTML += `
                    <div style="font-family: 'Oswald', sans-serif; font-size: 11px; color: #2edae3; margin: 18px 0 8px 0; text-align: center; border-bottom: 1px dashed #1a3274; padding-bottom: 4px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            if (partido.jugado) {
                contenedor.innerHTML += `
                    <div class="match-card">
                        <span class="team-name">${partido.local}</span>
                        <span class="score" style="color: #2edae3; font-weight: bold;">${partido.golesLocal} - ${partido.golesVisitante}</span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            } else {
                contenedor.innerHTML += `
                    <div class="match-card" style="border-left-color: #e11d48; border-right-color: #e11d48;">
                        <span class="team-name">${partido.local}</span>
                        <span class="score" style="color: #f43f5e; font-size: 13px;">VS<br>
                            ${partido.dia ? `<span class="match-meta-dia">${partido.dia}</span>` : ''}
                            <span style="font-size: 10px; color: #869bd8; display:block; margin-top:2px;">${partido.horario || 'Horario a confirmar'}</span>
                            <span style="font-size: 9px; color: #2edae3; display:block; font-family:'Oswald',sans-serif; margin-top:1px;">${partido.cancha || 'Cancha 1'}</span>
                        </span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            }
        });
    }



    // EVENTOS DE NAVEGACIÓN Y BOTONES
    const botonesFecha = document.querySelectorAll('.tabs-fechas .tab-btn');
    botonesFecha.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesFecha.forEach(b => b.classList.remove('active'));
            boton.classList.add('active');
            renderizarResultados(parseInt(boton.getAttribute('data-fecha')));
        });
    });

    // ============================================================
    // RENDERIZADO DINÁMICO DE BOTONES DE GRUPOS EN LA WEB PÚBLICA
    // ============================================================
    // RENDERIZADO DINÁMICO DE BOTONES (INCLUYE TABLA ÚNICA SÓLO SI EL STAFF LA ACTIVÓ)
    function renderizarBotonesGruposPublico() {
        const gruposTorneo = JSON.parse(localStorage.getItem('liga_grupos')) || {
            superior: ['A', 'B', 'C', 'D', 'E'],
            basico: ['A', 'B']
        };

        // Formato del torneo por ciclo (Grupos por defecto). La pestaña "Tabla
        // Única" NO se infiere de si algún equipo tiene grupo:'Unico' — eso era
        // un efecto secundario accidental. Ahora depende de una decisión
        // explícita del staff en el panel (sección "Formato del Torneo").
        const formatoTorneo = JSON.parse(localStorage.getItem('liga_formato_torneo')) || { superior: 'grupos', basico: 'grupos' };

        const contSup = document.querySelector('.tabs-sup');
        const contBas = document.querySelector('.tabs-bas');

        function armarBotones(contenedor, listaGrupos, ciclo) {
            if (!contenedor) return;
            contenedor.innerHTML = '';

            const grupos = [...listaGrupos];
            const usaTablaUnica = formatoTorneo[ciclo] === 'unico';
            if (usaTablaUnica && !grupos.includes('Unico')) {
                grupos.push('Unico');
            }

            const esSuperior = ciclo === 'superior';

            grupos.forEach((g, idx) => {
                const label = (g === 'Unico') ? 'Tabla Única' : `Grupo ${g}`;
                contenedor.innerHTML += `<button class="tab-btn ${idx === 0 ? 'active' : ''}" data-grupo-val="${g}">${label}</button>`;
            });

            contenedor.querySelectorAll('.tab-btn').forEach(boton => {
                boton.addEventListener('click', () => {
                    contenedor.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    boton.classList.add('active');
                    const grupoVal = boton.getAttribute('data-grupo-val');
                    const labelTxt = (grupoVal === 'Unico') ? 'Tabla Única' : grupoVal;
                    
                    if (esSuperior) {
                        renderizarTabla(ligaData.cicloSuperior, '.tbody-sup', '.group-name-sup', grupoVal, labelTxt);
                    } else {
                        renderizarTabla(ligaData.cicloBasico, '.tbody-bas', '.group-name-bas', grupoVal, labelTxt);
                    }
                });
            });
        }

        armarBotones(contSup, gruposTorneo.superior || ['A'], 'superior');
        armarBotones(contBas, gruposTorneo.basico || ['A'], 'basico');
    }

    // --- INICIALIZACIÓN COMPLETA AL CARGAR LA PÁGINA ---
    procesarLiga(); 
    renderizarBotonesGruposPublico();

    // Dibujamos el primer grupo de cada ciclo
    const gruposIniciales = JSON.parse(localStorage.getItem('liga_grupos')) || { superior: ['A'], basico: ['A'] };
    const primerGrupoSup = (gruposIniciales.superior && gruposIniciales.superior[0]) || 'A';
    const primerGrupoBas = (gruposIniciales.basico && gruposIniciales.basico[0]) || 'A';

    renderizarTabla(ligaData.cicloSuperior, '.tbody-sup', '.group-name-sup', primerGrupoSup, primerGrupoSup);
    renderizarTabla(ligaData.cicloBasico, '.tbody-bas', '.group-name-bas', primerGrupoBas, primerGrupoBas);

    renderizarGoleadores()

    // Carga automáticamente la última fecha jugada/activa (la función detecta
    // sola cuál es, ignorando partidos de playoff — ver renderizarResultados)
    renderizarResultados();
    // Inicializamos la tabla anual al cargar
    renderizarTablaAnual();

    // ============================================================
    // LÓGICA DE NAVEGACIÓN SPA (APAGADO DE PANTALLAS COMPLETO)
    // ============================================================
    // ============================================================
    // NAVEGACIÓN SPA REPARADA (SIN APAGAR HERO NI SPONSORS)
    // ============================================================
    const navItems = document.querySelectorAll('.nav-item');

    function ocultarAbsolutamenteTodo() {
        const elementosParaOcultar = [
            document.getElementById('home'),
            document.getElementById('hero-wrapper'),
            document.querySelector('.sponsors-section'),
            document.querySelector('.main-grid'),
            document.getElementById('pantalla-tablas'),
            document.getElementById('pantalla-fixture-completo'),
            document.getElementById('pantalla-fotos'),
            document.getElementById('pantalla-reglamento'),
            document.getElementById('pantalla-admin'),
            // AGREGAMOS ESTOS DOS PARA QUE NUNCA QUEDEN COLGADOS
            document.querySelector('.columna-goleadores'),
            document.querySelector('.seccion-tabla-anual')
        ];

        elementosParaOcultar.forEach(el => {
            if (el) el.classList.add('seccion-oculta');
        });

        // Limpia clases de vista ancha
        const dashboardContainer = document.querySelector('.dashboard-container');
        const mainGrid = document.querySelector('.main-grid');
        if (dashboardContainer) dashboardContainer.classList.remove('vista-ancha');
        if (mainGrid) mainGrid.classList.remove('vista-ancha');
    }

    function mostrarPantallaInicio() {
        ocultarAbsolutamenteTodo();
        
        // Encendemos los bloques principales de la Home
        const homeDiv = document.getElementById('home');
        const heroDiv = document.getElementById('hero-wrapper');
        const sponsorsSec = document.querySelector('.sponsors-section');
        const mainGrid = document.querySelector('.main-grid');
        const tablas = document.getElementById('pantalla-tablas');
        const fixtureLateral = document.getElementById('pantalla-fixture');

        if (homeDiv) homeDiv.classList.remove('seccion-oculta');
        if (heroDiv) heroDiv.classList.remove('seccion-oculta');
        if (sponsorsSec) sponsorsSec.classList.remove('seccion-oculta');
        if (mainGrid) mainGrid.classList.remove('seccion-oculta');
        if (tablas) tablas.classList.remove('seccion-oculta');
        if (fixtureLateral) fixtureLateral.classList.remove('seccion-oculta');

        // FUERZA EXPLÍCITA: Oculta Goleadores y Anual en el modo resumen de la Home
        document.querySelector('.columna-goleadores')?.classList.add('seccion-oculta');
        document.querySelector('.seccion-tabla-anual')?.classList.add('seccion-oculta');
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const targetId = item.getAttribute('href');
            
            if (targetId === '#home') {
        mostrarPantallaInicio();
        
        // Forzamos a que la cajita lateral de la Home se vuelva a dibujar con la última fecha
        renderizarResultados();
    }
            else {
                ocultarAbsolutamenteTodo();
                
                if (targetId === '#pantalla-tablas') {
                    document.querySelector('.main-grid')?.classList.remove('seccion-oculta');
                    document.getElementById('pantalla-tablas')?.classList.remove('seccion-oculta');
                    document.getElementById('pantalla-fixture')?.classList.add('seccion-oculta');
                    
                    document.querySelector('.dashboard-container')?.classList.add('vista-ancha');
                    document.querySelector('.main-grid')?.classList.add('vista-ancha');
                    document.querySelector('.columna-goleadores')?.classList.remove('seccion-oculta');
                    document.querySelector('.seccion-tabla-anual')?.classList.remove('seccion-oculta');
                }
                else if (targetId === '#pantalla-fixture') {
                    document.getElementById('pantalla-fixture-completo')?.classList.remove('seccion-oculta');
                }
                else if (targetId === '#pantalla-fotos') {
                    document.getElementById('pantalla-fotos')?.classList.remove('seccion-oculta');
                }
                else if (targetId === '#pantalla-reglamento') {
                    document.getElementById('pantalla-reglamento')?.classList.remove('seccion-oculta');
                }
                else if (targetId === '#pantalla-admin') {
                    document.getElementById('pantalla-admin')?.classList.remove('seccion-oculta');
                }
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // ESTADO INICIAL AL CARGAR LA PÁGINA:
    mostrarPantallaInicio();

    

    // ============================================================
    // CONTROL DE SCROLL Y TRANSICIÓN FLUIDA DE ALERTAS (SIDEBAR HEADER)
    // ============================================================
    window.addEventListener('scroll', () => {
        const estaArriba = window.scrollY <= 10;

        if (!estaArriba) {
            document.body.classList.add('scrolled');
        } else {
            document.body.classList.remove('scrolled');

            const dropdownNotifSidebar = document.getElementById('dropdown-notificaciones-sidebar');
            const dropdownNotifHeader = document.getElementById('dropdown-notificaciones');
            const sidebarEl = document.querySelector('aside.sidebar');

            // TRANSICIÓN MÁGICA: Si tenías abiertas las alertas en la sidebar,
            // al volver arriba pasan automáticamente a la campana del Header
            if (dropdownNotifSidebar && !dropdownNotifSidebar.classList.contains('seccion-oculta')) {
                // 1. Cerramos el desplegable lateral y liberamos la barra
                dropdownNotifSidebar.classList.add('seccion-oculta');
                if (sidebarEl) sidebarEl.classList.remove('sidebar-fijada');

                // 2. Encendemos el desplegable del Header sin perder lo que mirabas
                if (dropdownNotifHeader) {
                    dropdownNotifHeader.classList.remove('seccion-oculta');
                }
            }
        }
    }, { passive: true });

    // ============================================================
    // SPONSORS: DATOS (editables desde el panel Staff) + RENDER
    // ============================================================
    function obtenerSponsors() {
        const guardados = JSON.parse(localStorage.getItem('liga_sponsors'));
        if (guardados && guardados.length > 0) return guardados;
        const seed = (typeof ligaData !== 'undefined' && ligaData.sponsors) ? ligaData.sponsors : [];
        if (seed.length > 0) localStorage.setItem('liga_sponsors', JSON.stringify(seed));
        return seed;
    }

    function renderizarSponsorsPublico() {
        const track = document.getElementById('sponsors-track');
        if (!track) return;
        const sponsors = obtenerSponsors().slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));

        track.innerHTML = sponsors.map((s, i) => `
            <div class="sponsor-card-full${i === 0 ? ' active-slide' : ''}"${s.colorFondo ? ` style="background-color: ${s.colorFondo};"` : ''}>
                ${s.categoria ? `<div class="sponsor-badge">${s.categoria}</div>` : ''}
                <img src="${s.logo || 'Recursos/logo pelota fut.svg'}" alt="Sponsor ${s.nombre}" class="sponsor-logo">
                <div class="sponsor-info">
                    <h4>${s.nombre}</h4>
                    <span class="sponsor-support">Apoyan al torneo de la siguiente manera</span>
                    <p>${s.descripcion || ''}</p>
                    ${s.instagram ? `<a href="https://instagram.com/${s.instagram.replace('@', '')}" target="_blank" class="sponsor-contacto-link">@${s.instagram.replace('@', '')}</a>` : ''}
                    ${s.telefono ? `<span class="sponsor-contacto-link">${s.telefono}</span>` : ''}
                    ${s.ubicacion ? `<br>${s.ubicacion.trim().startsWith('http') ? `<a href="${s.ubicacion}" target="_blank" class="sponsor-contacto-link sponsor-ubicacion">${s.ubicacion}</a>` : `<span class="sponsor-contacto-link sponsor-ubicacion">${s.ubicacion}</span>`}` : ''}
                    <br>
                    <button class="sponsor-link-btn btn-beneficio">Ver Beneficio</button>
                    <div class="beneficio-secreto">
                        <p>${s.beneficio || ''}</p>
                        ${s.link ? `<a href="${s.link}" target="_blank" class="link-video-futuro">Más información</a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderizarSponsorsPublico();

    // ============================================================
    // GALERÍA DE FOTOS: DATOS (editables desde el panel Staff) + RENDER
    // ============================================================
    function obtenerFotosAlbumes() {
        const guardados = JSON.parse(localStorage.getItem('liga_fotos_albumes'));
        if (guardados && guardados.length > 0) return guardados;
        const seed = (typeof ligaData !== 'undefined' && ligaData.fotosAlbumes) ? ligaData.fotosAlbumes : [];
        if (seed.length > 0) localStorage.setItem('liga_fotos_albumes', JSON.stringify(seed));
        return seed;
    }

    function renderizarGaleriaFotos() {
        const grid = document.getElementById('galeria-fotos-grid');
        if (!grid) return;
        const albumes = obtenerFotosAlbumes().slice().reverse();

        if (albumes.length === 0) {
            grid.innerHTML = '<p style="color:#869bd8; font-family:Oswald; font-size:11px; grid-column:1/-1; text-align:center;">Todavía no hay álbumes publicados.</p>';
            return;
        }

        grid.innerHTML = albumes.map(a => `
            <a href="${a.link || '#'}" target="_blank" class="foto-card">
                <div class="foto-bg" style="background-image: url('${a.portada || 'Recursos/search.svg'}');"></div>
                <div class="foto-content">
                    <h4>${a.titulo}</h4>
                    <p>Ver álbum completo</p>
                </div>
            </a>
        `).join('');
    }

    renderizarGaleriaFotos();

    // ============================================================
    // CARRUSEL DE SPONSORS
    // ============================================================
    const slidesSponsor = document.querySelectorAll('.sponsor-card-full');
    const btnPrevSponsor = document.getElementById('prev-sponsor');
    const btnNextSponsor = document.getElementById('next-sponsor');
    const btnToggleSponsor = document.getElementById('btn-toggle-sponsors');
    const wrapperSponsor = document.getElementById('sponsors-wrapper');
    const dotsContainerSponsor = document.querySelector('.sponsor-dots');

    if (slidesSponsor.length > 0 && btnPrevSponsor && btnNextSponsor) {
        let currentSponsor = 0;
        let isGridSponsor = false;
        const totalSponsor = slidesSponsor.length;

        if (dotsContainerSponsor) {
            slidesSponsor.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('sponsor-dot');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => goToSponsor(i));
                dotsContainerSponsor.appendChild(dot);
            });
        }

        function updateSponsorCoverflow() {
            const dots = document.querySelectorAll('.sponsor-dot');
            slidesSponsor.forEach((card, i) => {
                card.classList.remove('pos-center', 'pos-left', 'pos-right', 'pos-far-left', 'pos-far-right', 'active-slide');
                let rel = i - currentSponsor;
                if (rel > Math.floor(totalSponsor / 2))  rel -= totalSponsor;
                if (rel < -Math.floor(totalSponsor / 2)) rel += totalSponsor;

                if      (rel === 0)  card.classList.add('pos-center', 'active-slide');
                else if (rel === -1) card.classList.add('pos-left');
                else if (rel === 1)  card.classList.add('pos-right');
                else if (rel < -1)  card.classList.add('pos-far-left');
                else                card.classList.add('pos-far-right');
            });
            dots.forEach((dot, i) => { dot.classList.toggle('active', i === currentSponsor); });
        }

        function goToSponsor(index) {
            currentSponsor = (index + totalSponsor) % totalSponsor;
            updateSponsorCoverflow();
            if(window.sponsorInterval) {
                clearInterval(window.sponsorInterval);
                startSponsorAutoplay();
            }
        }

        btnNextSponsor.addEventListener('click', () => goToSponsor(currentSponsor + 1));
        btnPrevSponsor.addEventListener('click', () => goToSponsor(currentSponsor - 1));

        window.sponsorInterval = null;
        const startSponsorAutoplay = () => {
            window.sponsorInterval = setInterval(() => {
                if (!isGridSponsor) goToSponsor(currentSponsor + 1);
            }, 3500);
        };

        if (btnToggleSponsor) {
            btnToggleSponsor.addEventListener('click', () => {
                isGridSponsor = !isGridSponsor;
                if (isGridSponsor) {
                    wrapperSponsor.classList.add('grid-mode');
                    btnToggleSponsor.textContent  = 'Ver en formato Carrusel';
                    btnToggleSponsor.style.borderColor = '#e11d48';
                    btnToggleSponsor.style.color       = '#e11d48';
                    clearInterval(window.sponsorInterval);
                } else {
                    wrapperSponsor.classList.remove('grid-mode');
                    btnToggleSponsor.textContent  = 'Mostrar todos los sponsors';
                    btnToggleSponsor.style.borderColor = 'rgba(46, 218, 227, 0.4)';
                    btnToggleSponsor.style.color       = '#869bd8';
                    updateSponsorCoverflow(); 
                    startSponsorAutoplay();
                }
            });
        }

        updateSponsorCoverflow();
        startSponsorAutoplay();
    }

    // BOTONES "VER BENEFICIO"
    const botonesBeneficio = document.querySelectorAll('.btn-beneficio');
    botonesBeneficio.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            const cajaSecreta = btn.nextElementSibling;
            if (cajaSecreta && cajaSecreta.classList.contains('beneficio-secreto')) {
                cajaSecreta.classList.toggle('visible');
                if (cajaSecreta.classList.contains('visible')) {
                    btn.textContent = 'Ocultar Beneficio';
                    btn.style.background = '#2edae3';
                    btn.style.color = '#040c26';
                    if (window.sponsorInterval) clearInterval(window.sponsorInterval);
                } else {
                    btn.textContent = 'Ver Beneficio';
                    btn.style.background = 'rgba(46, 218, 227, 0.1)';
                    btn.style.color = '#2edae3';
                    startSponsorAutoplay();
                }
            }
        });
    });

    // ============================================================
    // LÓGICA DEL HERO EN 3D
    // ============================================================
    const heroSlides3D    = document.querySelectorAll('.hero-card-3d');
    const heroBtnPrev3D   = document.getElementById('prev-hero');
    const heroBtnNext3D   = document.getElementById('next-hero');
    const heroDotsCont3D  = document.getElementById('hero-dots-3d');

    if (heroSlides3D.length > 0 && heroBtnPrev3D && heroBtnNext3D) {
        let currentHero = 0;
        const totalHero = heroSlides3D.length;

        if (heroDotsCont3D) {
            heroDotsCont3D.innerHTML = ''; 
            heroSlides3D.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('hero-dot-3d');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => goToHero3D(i));
                heroDotsCont3D.appendChild(dot);
            });
        }

        function updateHero3D() {
            const dots = heroDotsCont3D.querySelectorAll('.hero-dot-3d');
            heroSlides3D.forEach((card, i) => {
                card.classList.remove('hero-center', 'hero-left', 'hero-right', 'hero-far-left', 'hero-far-right');
                
                let rel = i - currentHero;
                if (rel >  Math.floor(totalHero / 2)) rel -= totalHero;
                if (rel < -Math.floor(totalHero / 2)) rel += totalHero;

                if      (rel === 0)  card.classList.add('hero-center');
                else if (rel === -1) card.classList.add('hero-left');
                else if (rel ===  1) card.classList.add('hero-right');
                else if (rel < -1)   card.classList.add('hero-far-left');
                else                 card.classList.add('hero-far-right');
            });
            dots.forEach((dot, i) => dot.classList.toggle('active', i === currentHero));
        }

        function goToHero3D(index) {
            currentHero = (index + totalHero) % totalHero;
            updateHero3D();
            if (window.heroInterval3D) {
                clearInterval(window.heroInterval3D);
                startHeroAutoplay3D();
            }
        }

        heroBtnNext3D.addEventListener('click', () => goToHero3D(currentHero + 1));
        heroBtnPrev3D.addEventListener('click', () => goToHero3D(currentHero - 1));

        window.heroInterval3D = null;
        const startHeroAutoplay3D = () => {
            window.heroInterval3D = setInterval(() => goToHero3D(currentHero + 1), 4500);
        };

        updateHero3D();
        startHeroAutoplay3D();
    }

    // ============================================================
    // LÓGICA DEL MODAL DE NOTICIAS (Ampliar Foto)
    // ============================================================
    const modalNoticia = document.getElementById('modal-noticia');
    const modalImg = document.getElementById('modal-noticia-img');
    const modalTitulo = document.getElementById('modal-noticia-titulo');
    const modalTexto = document.getElementById('modal-noticia-texto');
    const btnCerrarNoticia = document.querySelector('.close-modal-noticia');


                // Dentro de la lógica del Modal de Noticias en main.js:
    document.querySelectorAll('.hero-card-3d').forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('hero-center')) {
                const bgDiv = card.querySelector('.hero-card-bg');
                const h2 = card.querySelector('h2');
                const p = card.querySelector('p');
                const actionBtn = card.querySelector('.hero-action-btn'); // Buscamos si la noticia tiene link
                const linkContainer = document.getElementById('modal-noticia-link-container');

                if (bgDiv) {
                    const styleBg = bgDiv.style.backgroundImage;
                    const urlMatch = styleBg.match(/url\(['"]?(.*?)['"]?\)/);
                    if (urlMatch && urlMatch[1]) modalImg.src = urlMatch[1];
                }

                modalTitulo.textContent = h2 ? h2.textContent : '';
                
                if (p && p.textContent.trim() !== '') {
                    modalTexto.textContent = `"${p.textContent.replace(/^"|"$/g, '')}"`;
                } else {
                    modalTexto.textContent = '';
                }

                // RENDERIZADO DEL BOTÓN DINÁMICO
                if (linkContainer) {
                    linkContainer.innerHTML = ''; // Limpiamos anteriores
                    
                    if (actionBtn) {
                        const href = actionBtn.getAttribute('href');
                        const text = actionBtn.getAttribute('data-link-text') || 'VER MÁS';
                        const isExternal = href.startsWith('http');

                        const newLink = document.createElement('a');
                        newLink.href = href;
                        newLink.textContent = text;
                        newLink.className = 'btn-noticia-action';
                        
                        if (isExternal) {
                            newLink.target = '_blank';
                        } else {
                            // Si es link interno (#pantalla-tablas), usa la navegación SPA y cierra el modal
                            newLink.addEventListener('click', (e) => {
                                modalNoticia.classList.add('seccion-oculta');
                                const targetNav = document.querySelector(`.nav-item[href="${href}"]`);
                                if (targetNav) targetNav.click();
                            });
                        }
                        
                        linkContainer.appendChild(newLink);
                    }
                }

                modalNoticia.classList.remove('seccion-oculta');
            }
        });
    });


                
            
        
    

    if (modalNoticia && btnCerrarNoticia) {
        // Cerrar al tocar la X
        btnCerrarNoticia.addEventListener('click', () => modalNoticia.classList.add('seccion-oculta'));
        
        // Cerrar al tocar el fondo negro fuera de la foto
        modalNoticia.addEventListener('click', (e) => {
            if (e.target === modalNoticia) modalNoticia.classList.add('seccion-oculta');
        });
    }
    // ============================================================
    // INTERCEPTOR DE LINKS INLINE
    // ============================================================
    document.querySelectorAll('.hero-inline-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que la tarjeta abra el modal si tocaron el enlace
            
            const href = link.getAttribute('href');
            // Si es un link interno (#pantalla-tablas), activa la navegación SPA
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetNav = document.querySelector(`.nav-item[href="${href}"]`);
                if (targetNav) targetNav.click();
            }
        });
    });

    // ============================================================
    // LÓGICA DE DESPLIEGUE DEL REGLAMENTO (ACORDEÓN)
    // ============================================================
    document.querySelectorAll('.acordeon-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            
            // Opcional: Cierra las demás si abren una nueva
            document.querySelectorAll('.acordeon-item').forEach(otherItem => {
                if (otherItem !== item) otherItem.classList.remove('active');
            });

            item.classList.toggle('active');
        });
    });

    // ============================================================
    // DIBUJAR NOTICIAS DINÁMICAS DESDE LA MEMORIA EN EL HERO
    // ============================================================
    const heroTrack = document.getElementById('hero-track-3d');
    const noticiasGuardadas = JSON.parse(localStorage.getItem('liga_noticias')) || [];

    if (heroTrack && noticiasGuardadas.length > 0) {
        heroTrack.innerHTML = ''; // Limpiamos las noticias por defecto si cargaste nuevas

        noticiasGuardadas.forEach(n => {
            // Evaluamos si cargaste un link o no
            let htmlLink = '';
            if (n.linkUrl && n.linkUrl !== '') {
                htmlLink = `<a href="${n.linkUrl}" class="hero-inline-link">${n.linkTexto}</a>`;
            }

            heroTrack.innerHTML += `
                <div class="hero-card-3d">
                    <div class="hero-card-bg" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.95)), url('${n.foto}');"></div>
                    <div class="hero-card-content">
                        <h2>${n.titulo}</h2>
                        <p>${n.texto} ${htmlLink}</p>
                    </div>
                </div>
            `;
        });
    }


    // ============================================================
    // TRIBUNAL DE DISCIPLINA DESPLEGABLE
    // ============================================================
    const btnToggleTribunal = document.getElementById('btn-toggle-tribunal');
    const panelTribunal = document.getElementById('panel-tribunal-desplegable');
    const btnCerrarTribunal = document.getElementById('close-panel-tribunal');
    const contFechasTribunal = document.getElementById('selector-fechas-tribunal');
    const contDetalleActa = document.getElementById('contenido-acta-detalle');

    // El acta puede venir como número (sanciones automáticas) o como texto (formulario del Tribunal): se unifica al agrupar.
    function numeroDeActa(s) {
        const n = Number(s.acta || 1);
        return Number.isFinite(n) ? n : s.acta;
    }

    function cargarTribunalPublico() {
        const sanciones = JSON.parse(localStorage.getItem('liga_sanciones')) || [];

        if (!contFechasTribunal || !contDetalleActa) return;

        if (sanciones.length === 0) {
            contFechasTribunal.innerHTML = '';
            contDetalleActa.innerHTML = '<p style="color:#869bd8; font-size:12px; text-align:center; padding:15px;">No hay actas ni sanciones disciplinarias registradas.</p>';
            return;
        }

        const actasDisponibles = [...new Set(sanciones.map(numeroDeActa))].sort((a, b) => a - b);

        contFechasTribunal.innerHTML = '';
        actasDisponibles.forEach((numActa, index) => {
            const btnActa = document.createElement('button');
            btnActa.className = `tab-btn ${index === actasDisponibles.length - 1 ? 'active' : ''}`;
            btnActa.style.fontSize = '11px';
            btnActa.style.padding = '5px 12px';
            btnActa.style.marginRight = '5px';
            btnActa.textContent = `Acta N° ${numActa}`;
            
            btnActa.addEventListener('click', () => {
                document.querySelectorAll('#selector-fechas-tribunal .tab-btn').forEach(b => b.classList.remove('active'));
                btnActa.classList.add('active');
                mostrarDetalleActa(numActa, sanciones);
            });

            contFechasTribunal.appendChild(btnActa);
        });

        const ultimaActa = actasDisponibles[actasDisponibles.length - 1];
        mostrarDetalleActa(ultimaActa, sanciones);
    }

    function mostrarDetalleActa(numActa, sanciones) {
        if (!contDetalleActa) return;
        const sancionesActa = sanciones.filter(s => numeroDeActa(s) === numActa);

        if (sancionesActa.length === 0) {
            contDetalleActa.innerHTML = `<p style="color:#869bd8; font-size:11px;">No hay resoluciones para el Acta N° ${numActa}.</p>`;
            return;
        }

        contDetalleActa.innerHTML = `
            <div style="font-family:'Oswald', sans-serif; font-size:11px; color:#f43f5e; margin-bottom:12px; text-transform:uppercase; border-bottom:1px solid rgba(244,63,94,0.2); padding-bottom:4px;">
                RESOLUCIONES OFICIALES — ACTA N° ${numActa}
            </div>
        `;

        sancionesActa.forEach(s => {
            const jugadorTexto = s.jugador ? ` — ${s.jugador}` : '';
            const sancionPts = s.levantada
                ? `<span style="color:#4ade80; font-weight:bold;">(${s.fechaLevantada}) Quita levantada: pagó el 50%</span>`
                : (s.tipo === 'Quita de Puntos' && s.puntosRestados > 0
                    ? `<span style="color:#f43f5e; font-weight:bold;">(-${s.puntosRestados} PTS)</span>`
                    : (s.tipo === 'Sanción Disciplinaria' && s.puntosRestados > 0
                        ? `<span style="color:#f43f5e; font-weight:bold;">(${s.puntosRestados} ${s.puntosRestados === 1 ? 'fecha' : 'fechas'} de suspensión)</span>`
                        : ''));

            contDetalleActa.innerHTML += `
                <div style="background: rgba(255,255,255,0.03); border-left: 4px solid #f43f5e; padding: 10px; margin-bottom: 8px; border-radius: 3px; text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:white; font-weight:bold;">${s.equipo}${jugadorTexto}</span>
                        <span style="font-size:10px; color:#fca5a5; font-weight:bold;">${s.tipo} ${sancionPts}</span>
                    </div>
                    <p style="color:#cbd5e1; font-size:11px; margin: 5px 0 0 0;"><em>"${s.motivo || 'Sin motivo especificado'}"</em></p>
                </div>
            `;
        });
    }

    if (btnToggleTribunal && panelTribunal) {
        btnToggleTribunal.addEventListener('click', (e) => {
            e.preventDefault();
            panelTribunal.classList.toggle('seccion-oculta');
            if (!panelTribunal.classList.contains('seccion-oculta')) {
                cargarTribunalPublico();
            }
        });
    }

    if (btnCerrarTribunal && panelTribunal) {
        btnCerrarTribunal.addEventListener('click', () => {
            panelTribunal.classList.add('seccion-oculta');
        });
    }

    // ============================================================
    // ANIMACIÓN DE DESPLAZAMIENTO PROPORCIONAL DE TÍTULOS
    // ============================================================
    const toggleTablas = document.getElementById('toggle-titulo-tablas');
    const togglePlayoffs = document.getElementById('toggle-titulo-playoffs');
    const vistaGrupos = document.getElementById('vista-fase-grupos');
    const vistaPlayoffs = document.getElementById('vista-playoffs');

    function moverTitulos(esPlayoffs) {
        if (!toggleTablas || !togglePlayoffs) return;

        // El desplazamiento (translateX/scale) queda resuelto por CSS puro
        // (ver #toggle-titulo-tablas.active/.opaco y #toggle-titulo-playoffs.active/.opaco
        // en estilo.css, con su variante dentro de @media max-width:768px). Acá solo
        // alternamos clases, así reacciona solo a resize/rotación sin recalcular en JS.
        if (esPlayoffs) {
            togglePlayoffs.classList.add('active');
            togglePlayoffs.classList.remove('opaco');

            toggleTablas.classList.remove('active');
            toggleTablas.classList.add('opaco');

            if (vistaGrupos) vistaGrupos.classList.add('seccion-oculta');
            if (vistaPlayoffs) vistaPlayoffs.classList.remove('seccion-oculta');
        } else {
            toggleTablas.classList.add('active');
            toggleTablas.classList.remove('opaco');

            togglePlayoffs.classList.remove('active');
            togglePlayoffs.classList.add('opaco');

            if (vistaGrupos) vistaGrupos.classList.remove('seccion-oculta');
            if (vistaPlayoffs) vistaPlayoffs.classList.add('seccion-oculta');
        }
    }
    // ============================================================
    // ÁRBOL DE PLAYOFFS EN VIVO CON RESULTADOS, PENALES Y CAMPEÓN
    // ============================================================
    // ============================================================
    // ÁRBOL DE PLAYOFFS EN VIVO CON RESULTADOS, PENALES Y CAMPEÓN
    // ============================================================
    // ============================================================
    // RENDERIZADO DEL ÁRBOL DE PLAYOFFS EN LA WEB PÚBLICA
    // ============================================================
    let cicloPlayoffPublicoActivo = 'superior';

    function renderizarPlayoffsPublico() {
        const bannerEspera = document.getElementById('playoffs-banner-espera');
        const contenidoActivo = document.getElementById('playoffs-contenido-activo');
        const bracketContenedor = document.getElementById('bracket-main');
        
        const estanPublicados = localStorage.getItem('liga_playoffs_publicados') === 'true';

        if (!estanPublicados) {
            if (bannerEspera) bannerEspera.classList.remove('seccion-oculta');
            if (contenidoActivo) contenidoActivo.classList.add('seccion-oculta');
            return;
        }

        if (bannerEspera) bannerEspera.classList.add('seccion-oculta');
        if (contenidoActivo) contenidoActivo.classList.remove('seccion-oculta');

        if (!bracketContenedor) return;

        const partidosGuardados = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos || [];
        const crucesGuardadosRaw = JSON.parse(localStorage.getItem('liga_cruces_playoffs')) || [];
        // Por si el visitante carga index.html antes de que el staff haya abierto
        // admin.html al menos una vez desde esta actualización (que es lo que
        // persiste el campo 'slot' en localStorage): migramos también acá, sólo
        // en memoria, para no depender de ese orden de eventos.
        const crucesGuardados = typeof migrarCrucesConSlot === 'function'
            ? migrarCrucesConSlot(crucesGuardadosRaw).cruces
            : crucesGuardadosRaw;
        const crucesCiclo = crucesGuardados.filter(c => c.ciclo === cicloPlayoffPublicoActivo);

        bracketContenedor.innerHTML = '';
        const rondas = typeof rondasHabilitadas === 'function'
            ? rondasHabilitadas(cicloPlayoffPublicoActivo)
            : ['octavos', 'cuartos', 'semis', 'final'];
        const slotsRonda = typeof slotsPorRonda === 'function' ? slotsPorRonda(cicloPlayoffPublicoActivo) : null;
        let campeonTorneo = null;

        const esUltimaRondaHabilitada = (ronda) => ronda === rondas[rondas.length - 1];

        rondas.forEach(ronda => {
            const cantidadSlots = (slotsRonda && slotsRonda[ronda]) || 0;
            let rondaHTML = `
                <div class="bracket-round" data-ronda="${ronda}">
                    <h4 class="round-title">${ronda.toUpperCase()}</h4>
                    <div class="bracket-matches">
            `;

            for (let slot = 1; slot <= cantidadSlots; slot++) {
                const c = crucesCiclo.find(cr => cr.ronda === ronda && cr.slot === slot);

                if (!c || (!c.local && !c.visitante)) {
                    rondaHTML += `
                        <div class="bracket-match" style="padding: 15px; text-align: center; color: #869bd8; font-size: 10px;">
                            A definir
                        </div>
                    `;
                    continue;
                }

                const partidoJugado = partidosGuardados.find(p =>
                    p.esPlayoff && p.ronda === ronda && p.ciclo === cicloPlayoffPublicoActivo &&
                    ((p.local === c.local && p.visitante === c.visitante) || (p.local === c.visitante && p.visitante === c.local))
                );

                let gLocal = '-', gVisita = '-';
                let esGanadorLocal = false, esGanadorVisita = false;
                let penalesLocalTxt = '', penalesVisitaTxt = '';

                if (partidoJugado && partidoJugado.jugado) {
                    const esLocalDirecto = partidoJugado.local === c.local;
                    const golesParaCruce = {
                        golesLocal: esLocalDirecto ? partidoJugado.golesLocal : partidoJugado.golesVisitante,
                        golesVisitante: esLocalDirecto ? partidoJugado.golesVisitante : partidoJugado.golesLocal,
                        penalesLocal: esLocalDirecto ? partidoJugado.penalesLocal : partidoJugado.penalesVisitante,
                        penalesVisitante: esLocalDirecto ? partidoJugado.penalesVisitante : partidoJugado.penalesLocal
                    };

                    gLocal = golesParaCruce.golesLocal;
                    gVisita = golesParaCruce.golesVisitante;

                    const { ganador } = typeof determinarGanador === 'function'
                        ? determinarGanador(golesParaCruce)
                        : { ganador: null };
                    esGanadorLocal = ganador === 'local';
                    esGanadorVisita = ganador === 'visitante';

                    if (gLocal === gVisita && golesParaCruce.penalesLocal !== null && golesParaCruce.penalesVisitante !== null) {
                        penalesLocalTxt = `<span class="score-penal">(${golesParaCruce.penalesLocal})</span>`;
                        penalesVisitaTxt = `<span class="score-penal">(${golesParaCruce.penalesVisitante})</span>`;
                    }

                    if (ronda === 'final') {
                        if (esGanadorLocal) campeonTorneo = c.local;
                        if (esGanadorVisita) campeonTorneo = c.visitante;
                    }
                }

                rondaHTML += `
                    <div class="bracket-match">
                        <div class="team-row ${esGanadorLocal ? 'winner' : ''}">
                            <span class="team-name">${c.local || '(A definir)'}</span>
                            <div>${penalesLocalTxt}<span class="score-num">${gLocal}</span></div>
                        </div>
                        <div class="team-row ${esGanadorVisita ? 'winner' : ''}">
                            <span class="team-name">${c.visitante || '(A definir)'}</span>
                            <div>${penalesVisitaTxt}<span class="score-num">${gVisita}</span></div>
                        </div>
                    </div>
                `;
            }

            // Conectores verticales: unen cada pareja de llaves (1-2, 3-4, ...) con
            // su casillero en la ronda siguiente. No aplica a la última ronda vigente
            // (Final), que no tiene a dónde avanzar.
            if (!esUltimaRondaHabilitada(ronda) && cantidadSlots >= 2) {
                for (let par = 1; par <= Math.floor(cantidadSlots / 2); par++) {
                    const centroA = ((2 * par - 1) - 0.5) / cantidadSlots * 100;
                    const centroB = ((2 * par) - 0.5) / cantidadSlots * 100;
                    rondaHTML += `<div class="bracket-pair-connector" style="top:${centroA}%; height:${centroB - centroA}%;"></div>`;
                }
            }

            rondaHTML += `</div></div>`;
            bracketContenedor.innerHTML += rondaHTML;
        });

        // Columna del campeón
        const cajaCampeonHTML = `
            <div class="bracket-round" style="justify-content: center !important;">
                <div class="champion-box">
                    <span style="font-size: 9px; color: #869bd8; display: block; text-transform: uppercase; letter-spacing: 1px;">CAMPEÓN CLAUSURA 2026</span>
                    <h3 style="font-size: 15px; color: #fff; margin: 8px 0 0 0; text-shadow: 0 0 10px #f2c00e;">
                        ${campeonTorneo ? `${campeonTorneo}` : 'POR DEFINIR'}
                    </h3>
                </div>
            </div>
        `;
        bracketContenedor.innerHTML += cajaCampeonHTML;

        // Oculta del navegador de rondas (Octavos|Cuartos|Semis|Final) los botones
        // de rondas que no existen para el ciclo activo (ej: un ciclo que arranca
        // directo en Cuartos no tiene botón de Octavos).
        document.querySelectorAll('.btn-ronda-nav').forEach(btn => {
            const target = btn.getAttribute('data-ronda-target');
            btn.hidden = !rondas.includes(target);
        });
        // La pestaña activa tiene que ser una ronda que exista: si la activa quedó oculta (o no hay ninguna), pasa a la primera visible.
        const botonesRonda = [...document.querySelectorAll('.btn-ronda-nav')];
        const activaVisible = botonesRonda.some(b => b.classList.contains('active') && !b.hidden);
        if (!activaVisible) {
            botonesRonda.forEach(b => b.classList.remove('active'));
            const primera = botonesRonda.find(b => !b.hidden);
            if (primera) primera.classList.add('active');
        }
    }

    // Escuchador para cambiar de ciclo en Playoffs
    document.querySelectorAll('.btn-playoff-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-playoff-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cicloPlayoffPublicoActivo = btn.getAttribute('data-ciclo-playoff');
            // Al cambiar de ciclo la pestaña de ronda vuelve a la primera ronda que ese ciclo tiene
            document.querySelectorAll('.btn-ronda-nav').forEach(b => b.classList.remove('active'));
            renderizarPlayoffsPublico();
        });
    });

    // Llamamos cada vez que el usuario abre la pestaña de Playoffs
    if (toggleTablas && togglePlayoffs) {
        toggleTablas.addEventListener('click', () => moverTitulos(false));
        togglePlayoffs.addEventListener('click', () => {
            moverTitulos(true);
            renderizarPlayoffsPublico();
        });
    }


    // ============================================================
    // AUTO-SCROLL HORIZONTAL DE RONDAS (OCTAVOS | CUARTOS | SEMIS | FINAL)
    // ============================================================
    const btnsRondaNav = document.querySelectorAll('.btn-ronda-nav');
    const contenedorBracket = document.getElementById('bracket-main');

    btnsRondaNav.forEach(btn => {
        btn.addEventListener('click', () => {
            btnsRondaNav.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const rondaTarget = btn.getAttribute('data-ronda-target');
            const columnaRonda = document.querySelector(`.bracket-round[data-ronda="${rondaTarget}"]`);

            if (columnaRonda && contenedorBracket) {
                const scrollLeftPos = columnaRonda.offsetLeft - (contenedorBracket.offsetWidth / 2) + (columnaRonda.offsetWidth / 2);
                contenedorBracket.scrollTo({ left: scrollLeftPos, behavior: 'smooth' });
            }
        });
    });

    // ============================================================
    // LÓGICA DE DRAG & SCROLL PARA COMPUTADORAS (GRAB & DRAG)
    // ============================================================
    const sliderBracket = document.getElementById('bracket-main');

    if (sliderBracket) {
        let isDown = false;
        let startX;
        let scrollLeft;

        sliderBracket.addEventListener('mousedown', (e) => {
            isDown = true;
            sliderBracket.classList.add('grabbing');
            
            // Posición inicial del mouse respecto al contenedor
            startX = e.pageX - sliderBracket.offsetLeft;
            scrollLeft = sliderBracket.scrollLeft;
        });

        sliderBracket.addEventListener('mouseleave', () => {
            isDown = false;
            sliderBracket.classList.remove('grabbing');
        });

        sliderBracket.addEventListener('mouseup', () => {
            isDown = false;
            sliderBracket.classList.remove('grabbing');
        });

        sliderBracket.addEventListener('mousemove', (e) => {
            if (!isDown) return; // Si no tiene el clic apretado, no hace nada
            e.preventDefault();  // Evita cualquier comportamiento nativo extra
            
            const x = e.pageX - sliderBracket.offsetLeft;
            const walk = (x - startX) * 1.5; // Multiplicador de velocidad (ajustá a gusto)
            sliderBracket.scrollLeft = scrollLeft - walk;
        });
    }

    // ============================================================
    // LÓGICA DE LA PANTALLA COMPLETA DE PARTIDOS
    // ============================================================
    // ============================================================
    // FIXTURE CON GRILLA Y LÍNEA DIVISORIA VERTICAL
    // ============================================================
    let fechaActivaFixture = 1;
    let filtroCicloFixture = 'todos';

    function renderizarFixtureFecha(numeroFecha) {
        const contenedor = document.getElementById('contenedor-partidos-fecha');
        if (!contenedor) return;

        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos;
        let partidosFiltrados = partidosDinamicos.filter(p => p.fecha === numeroFecha);

        if (filtroCicloFixture !== 'todos') {
            partidosFiltrados = partidosFiltrados.filter(p => p.ciclo === filtroCicloFixture);
        }

        contenedor.innerHTML = '';

        if (partidosFiltrados.length === 0) {
            const hayFechas = fechasDeFaseDeGrupos().length > 0 || rondasDePlayoffConPartidos().length > 0;
            const etiquetaFecha = Number(numeroFecha) >= 100 ? nombreRondaPlayoffBoton(numeroFecha) : `Fecha ${numeroFecha}`;
            contenedor.innerHTML = `<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 25px;">${hayFechas ? `No hay partidos cargados para ${etiquetaFecha}.` : 'Todavía no hay partidos cargados.'}</p>`;
            return;
        }

        partidosFiltrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });

        let ultimoSeparador = "";

        partidosFiltrados.forEach((partido, index) => {
            const cicloTxt = partido.ciclo === 'superior' ? 'Superior' : 'Básico';
            const infoSeparador = partido.esPlayoff
                ? `${cicloTxt} — ${nombreFechaPublico(partido.fecha)}`
                : `${cicloTxt} — Grupo ${partido.grupo || 'A'}`;

            if (infoSeparador !== ultimoSeparador) {
                contenedor.innerHTML += `
                    <div style="font-family: 'Oswald', sans-serif; font-size: 11px; color: #2edae3; margin: 20px 0 10px 0; text-align: center; border-bottom: 1px dashed #1a3274; padding-bottom: 5px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            const esJugado = partido.jugado;
            const horarioTxt = partido.horario || 'Horario a confirmar';
            const canchaTxt = partido.cancha || 'Cancha 1';
            const diaTxt = partido.dia || '';

            // Goles y Tarjetas Local
            let htmlLocal = '';
            if (partido.goleadoresLocal && partido.goleadoresLocal.length > 0) {
                htmlLocal += partido.goleadoresLocal.map(g => `<div>${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
            }
            htmlLocal += htmlTarjetasPartido(partido, 'local');
            if (!htmlLocal && esJugado) htmlLocal = '<div style="opacity: 0.4;">Sin incidencias</div>';

            // Goles y Tarjetas Visitante
            let htmlVisita = '';
            if (partido.goleadoresVisitante && partido.goleadoresVisitante.length > 0) {
                htmlVisita += partido.goleadoresVisitante.map(g => `<div>${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
            }
            htmlVisita += htmlTarjetasPartido(partido, 'visitante');
            if (!htmlVisita && esJugado) htmlVisita = '<div style="opacity: 0.4;">Sin incidencias</div>';

            const mvpTxt = partido.mvp ? `<strong>MVP:</strong> ${partido.mvp}` : '';

            contenedor.innerHTML += `
                <div class="match-card-desplegable ${esJugado ? 'jugado' : 'pendiente'}">
                    
                    <!-- HEADER EN GRILLA 3 COLUMNAS -->
                    <div class="match-header-grid">
                        
                        <!-- Columna 1: Equipo Local -->
                        <div class="col-team col-local">
                            <span class="team-name">${partido.local}</span>
                        </div>
                        
                        <!-- Columna 2: Resultado / Metas (Centro exacto) -->
                        <div class="col-center">
                            ${esJugado 
                                ? `<span class="score-main">${partido.golesLocal} - ${partido.golesVisitante}</span>` 
                                : `<span class="vs-badge">VS</span>`
                            }
                            ${diaTxt ? `<span class="match-meta-dia">${diaTxt}</span>` : ''}
                            <div class="match-meta-info">
                                 ${canchaTxt} | ${horarioTxt}
                            </div>
                        </div>

                        <!-- Columna 3: Equipo Visitante + Flecha pegadita -->
                        <div class="col-team col-visita">
                            <span class="team-name">${partido.visitante}</span>
                            <span class="arrow-indicator">▼</span>
                        </div>

                    </div>

                    <!-- DESPLIEGUE CON LÍNEA DIVISORIA VERTICAL AL MEDIO -->
                    <div class="match-details-drawer seccion-oculta">
                        <div class="drawer-divider-top"></div>
                        
                        ${esJugado ? `
                            <div class="split-details-container">
                                <div class="split-col col-left">${htmlLocal}</div>
                                <div class="split-vertical-line"></div>
                                <div class="split-col col-right">${htmlVisita}</div>
                            </div>
                            ${mvpTxt ? `<div class="mvp-banner">${mvpTxt}</div>` : ''}
                        ` : `
                            <div style="text-align: center; color: #869bd8; font-size: 11px; font-family: Oswald; padding: 5px 0;">
                                Partido programado. Presentar DNI en mesa de control 15 min antes.
                            </div>
                        `}
                    </div>

                </div>
            `;
        });

        // Escuchador de Clics
        document.querySelectorAll('.match-card-desplegable').forEach(card => {
            card.addEventListener('click', () => {
                const drawer = card.querySelector('.match-details-drawer');
                const arrow = card.querySelector('.arrow-indicator');
                if (drawer) {
                    drawer.classList.toggle('seccion-oculta');
                    card.classList.toggle('desplegado');
                    if (arrow) arrow.textContent = drawer.classList.contains('seccion-oculta') ? '▼' : '▲';
                }
            });
        });
    }

    // Botones de fecha del fixture: uno por cada fecha de fase de grupos que exista en los partidos (sin tope fijo).
    function fechasDeFaseDeGrupos() {
        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos || [];
        return [...new Set(partidosDinamicos.filter(p => !p.esPlayoff && p.fecha < 100).map(p => p.fecha))].sort((a, b) => a - b);
    }

    // Rondas de playoff (108/104/102/100) que tienen al menos un partido cargado, en orden cronológico
    // (Octavos → Final). Van como botones aparte, después de las fechas de fase de grupos.
    function rondasDePlayoffConPartidos() {
        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos || [];
        const fechas = [...new Set(partidosDinamicos.filter(p => p.esPlayoff || p.fecha >= 100).map(p => p.fecha))];
        return fechas.sort((a, b) => ordenCronologicoFechaPublico(a) - ordenCronologicoFechaPublico(b));
    }

    function nombreRondaPlayoffBoton(fecha) {
        const f = Number(fecha);
        if (f === 108) return 'Octavos';
        if (f === 104) return 'Cuartos';
        if (f === 102) return 'Semifinal';
        if (f === 100) return 'Final';
        return `Fecha ${fecha}`;
    }

    // Al abrir la pantalla de Partidos por primera vez, arranca en la última fecha de fase de grupos
    // con resultado cargado; si ninguna tiene resultado todavía, en la primera fecha que exista.
    function calcularFechaInicialFixture(fechasGrupo) {
        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos || [];
        const conResultado = fechasGrupo.filter(f => partidosDinamicos.some(p => !p.esPlayoff && p.fecha === f && p.jugado));
        if (conResultado.length > 0) return Math.max(...conResultado);
        if (fechasGrupo.length > 0) return fechasGrupo[0];
        const rondas = rondasDePlayoffConPartidos();
        return rondas.length > 0 ? rondas[0] : fechaActivaFixture;
    }

    let fixtureInicializado = false;

    function renderizarBotonesFechaFixture() {
        const contenedorBotones = document.getElementById('botones-fecha-fixture');
        if (!contenedorBotones) return;
        const fechas = fechasDeFaseDeGrupos();
        const rondasPlayoff = rondasDePlayoffConPartidos();
        const todasLasFechas = [...fechas, ...rondasPlayoff];

        if (!fixtureInicializado) {
            fechaActivaFixture = calcularFechaInicialFixture(fechas);
            fixtureInicializado = true;
        } else if (todasLasFechas.length > 0 && !todasLasFechas.includes(fechaActivaFixture)) {
            fechaActivaFixture = todasLasFechas[0];
        }

        contenedorBotones.innerHTML = fechas.map(f =>
            `<button class="tab-btn btn-fecha-select ${f === fechaActivaFixture ? 'active' : ''}" data-fecha="${f}">Fecha ${f}</button>`
        ).join('') + rondasPlayoff.map(f =>
            `<button class="tab-btn btn-fecha-select ${f === fechaActivaFixture ? 'active' : ''}" data-fecha="${f}">${nombreRondaPlayoffBoton(f)}</button>`
        ).join('');
        // Escuchador exclusivo para los botones de fecha en la pantalla de Partidos
        contenedorBotones.querySelectorAll('.btn-fecha-select').forEach(btn => {
            btn.addEventListener('click', () => {
                contenedorBotones.querySelectorAll('.btn-fecha-select').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                fechaActivaFixture = parseInt(btn.getAttribute('data-fecha'));
                renderizarFixtureFecha(fechaActivaFixture);
            });
        });
    }

    // Escuchadores de filtro por Ciclo (Todos / Superior / Básico)
    document.querySelectorAll('.btn-filtro-fixture-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-filtro-fixture-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroCicloFixture = btn.getAttribute('data-ciclo-fix');
            renderizarFixtureFecha(fechaActivaFixture);
        });
    });

    // ============================================================
    // LÓGICA DEL BUSCADOR GLOBAL INTELIGENTE
    // ============================================================
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');

    if (searchInput && searchDropdown) {
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                searchDropdown.classList.add('seccion-oculta');
                searchDropdown.innerHTML = '';
                return;
            }

            // Unimos todos los equipos de la liga para buscar
            const todosLosEquipos = [
                ...ligaData.cicloSuperior.map(e => ({ ...e, ciclo: 'Superior' })),
                ...ligaData.cicloBasico.map(e => ({ ...e, ciclo: 'Básico' }))
            ];

            const coincidencias = todosLosEquipos.filter(eq => 
                eq.nombre.toLowerCase().includes(query)
            );

            if (coincidencias.length === 0) {
                searchDropdown.innerHTML = `
                    <div style="padding: 12px; text-align: center; color: #869bd8; font-size: 11px; font-family: Oswald;">
                        No se encontraron equipos con "${query}"
                    </div>
                `;
                searchDropdown.classList.remove('seccion-oculta');
                return;
            }

            // Renderizar resultados encontrados
            searchDropdown.innerHTML = '';
            coincidencias.forEach(eq => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                const etiquetaGrupo = eq.grupo === 'Unico' ? 'Tabla Única' : `Grupo ${eq.grupo || 'A'}`;
                item.innerHTML = `
                    <div class="search-item-header">
                        <span class="search-item-name">${eq.nombre}</span>
                        <span class="search-item-badge">${eq.ciclo} - ${etiquetaGrupo}</span>
                    </div>
                    <div class="search-item-actions">
                        <button class="search-action-btn btn-ir-tabla" data-equipo="${eq.nombre}">Posiciones</button>
                        <button class="search-action-btn btn-ir-partidos" data-equipo="${eq.nombre}">Partidos</button>
                    </div>
                `;
                searchDropdown.appendChild(item);
            });

            searchDropdown.classList.remove('seccion-oculta');

            // ACCIÓN 1: IR A LA TABLA DE SU GRUPO Y RESALTAR LA FILA EXACTA
            document.querySelectorAll('.btn-ir-tabla').forEach(btn => {
                btn.addEventListener('click', () => {
                    const nombreEquipo = btn.getAttribute('data-equipo');
                    
                    const todosLosEquipos = [...ligaData.cicloSuperior, ...ligaData.cicloBasico];
                    const equipoEncontrado = todosLosEquipos.find(eq => eq.nombre.trim().toLowerCase() === nombreEquipo.trim().toLowerCase());

                    searchDropdown.classList.add('seccion-oculta');
                    searchInput.value = '';

                    // 1. Navegamos a la sección de Posiciones (SPA)
                    const btnTablasNav = document.querySelector('.nav-item[href="#pantalla-tablas"]');
                    if (btnTablasNav) btnTablasNav.click();

                    // 2. Aseguramos que la vista esté en 'TABLA DE POSICIONES' (Fase de Grupos) y no en Playoffs
                    const toggleTablas = document.getElementById('toggle-titulo-tablas');
                    if (toggleTablas && !toggleTablas.classList.contains('active')) {
                        toggleTablas.click(); // Cambia el switch a Posiciones
                    }

                    if (equipoEncontrado) {
                        const esSuperior = ligaData.cicloSuperior.some(eq => eq.nombre === equipoEncontrado.nombre);
                        const grupoTarget = equipoEncontrado.grupo;

                        // 3. Activamos la pestaña del grupo correspondiente (A, B, C...)
                        // Ojo: los botones de .tabs-sup/.tabs-bas son 100% regenerados por
                        // renderizarBotonesGruposPublico() al cargar la página (usan el
                        // atributo data-grupo-val) — el data-grupo/data-grupo-bas del HTML
                        // estático deja de existir apenas se pinta, hay que apuntar al mismo.
                        const contenedorGrupo = esSuperior ? '.tabs-sup' : '.tabs-bas';
                        const btnGrupo = document.querySelector(`${contenedorGrupo} .tab-btn[data-grupo-val="${grupoTarget}"]`);
                        if (btnGrupo) btnGrupo.click();

                        // 4. Buscamos la fila EXCLUSIVAMENTE dentro del contenedor de la Fase de Grupos (evitando la Tabla Anual)
                        setTimeout(() => {
                            const contenedorFaseGrupos = document.getElementById('vista-fase-grupos');
                            if (!contenedorFaseGrupos) return;

                            // FIX BUG 2: búsqueda dentro del tbody correcto según ciclo.
                            // Antes buscaba en '.group-selector .td-team-name', que solo
                            // envuelve al superior → el básico nunca era encontrado.
                            const tbodySelector = esSuperior ? '.tbody-sup' : '.tbody-bas';
                            const tbodyTarget = contenedorFaseGrupos.querySelector(tbodySelector);
                            const celdas = tbodyTarget
                                ? tbodyTarget.querySelectorAll('.td-team-name')
                                : [];

                            let filaTarget = null;
                            celdas.forEach(celda => {
                                if (celda.textContent.trim().toLowerCase() === nombreEquipo.toLowerCase()) {
                                    filaTarget = celda.closest('tr');
                                }
                            });

                            if (filaTarget) {
                                filaTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // FIX BUG 1: agrega clase a la fila (el CSS ahora anima tr.fila-resaltada td)
                                filaTarget.classList.add('fila-resaltada');
                                setTimeout(() => {
                                    filaTarget.classList.remove('fila-resaltada');
                                }, 1000);
                            }
                        }, 120);
                    }
                });
            });

            // ACCIÓN 2: IR A PARTIDOS Y FILTRAR
            // ACCIÓN 2: IR A PARTIDOS, DETECTAR ÚLTIMA FECHA Y RESALTAR CARD
            document.querySelectorAll('.btn-ir-partidos').forEach(btn => {
                btn.addEventListener('click', () => {
                    const nombreEquipo = btn.getAttribute('data-equipo');

                    searchDropdown.classList.add('seccion-oculta');
                    searchInput.value = '';

                    // 1. Obtenemos los partidos del sistema
                    const partidosCrudos = localStorage.getItem('liga_partidos');
                    const partidos = partidosCrudos ? JSON.parse(partidosCrudos) : (ligaData.partidos || []);

                    // 2. Filtramos los partidos del equipo buscado
                    const partidosDelEquipo = partidos.filter(p =>
                        p.local.trim().toLowerCase() === nombreEquipo.trim().toLowerCase() ||
                        p.visitante.trim().toLowerCase() === nombreEquipo.trim().toLowerCase()
                    );

                    // 3. Si no tiene partidos cargados, mostramos aviso
                    if (partidosDelEquipo.length === 0) {
                        alert(`El equipo ${nombreEquipo} todavía no tiene partidos registrados.`);
                        return;
                    }

                    // 4. Calculamos cuál es la fecha más reciente de su fixture
                    // Preferimos fechas de temporada regular: el selector de fechas del
                    // fixture (.btn-fecha-select) sólo tiene botones 1-7, no para los
                    // códigos de playoff (108/104/102/100, que además son más altos que
                    // cualquier fecha real y "ganaban" siempre en el Math.max). Si el
                    // equipo sólo jugó playoffs, usamos esos partidos igual como fallback.
                    const partidosRegularesDelEquipo = partidosDelEquipo.filter(p => !p.esPlayoff);
                    const fechasParaCalcular = partidosRegularesDelEquipo.length > 0 ? partidosRegularesDelEquipo : partidosDelEquipo;
                    const ultimaFecha = Math.max(...fechasParaCalcular.map(p => p.fecha));

                    // 5. Navegamos a la sección de Partidos (SPA)
                    const btnFixtureNav = document.querySelector('.nav-item[href="#pantalla-fixture"]');
                    if (btnFixtureNav) btnFixtureNav.click();

                    // 6. Activamos la fecha exacta y renderizamos su lista de partidos
                    setTimeout(() => {
                        const btnFecha = document.querySelector(`.btn-fecha-select[data-fecha="${ultimaFecha}"]`);
                        if (btnFecha) {
                            document.querySelectorAll('.btn-fecha-select').forEach(b => b.classList.remove('active'));
                            btnFecha.classList.add('active');
                        }

                        renderizarFixtureFecha(ultimaFecha);

                        // 7. Buscamos la tarjeta del partido y le aplicamos el destello
                        setTimeout(() => {
                            const tarjetas = document.querySelectorAll('#contenedor-partidos-fecha .match-card-desplegable');
                            let tarjetaTarget = null;

                            tarjetas.forEach(card => {
                                if (card.textContent.toLowerCase().includes(nombreEquipo.toLowerCase())) {
                                    tarjetaTarget = card;
                                }
                            });

                            if (tarjetaTarget) {
                                tarjetaTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                tarjetaTarget.classList.add('match-card-resaltada');
                                setTimeout(() => {
                                    tarjetaTarget.classList.remove('match-card-resaltada');
                                }, 2500);
                            }
                        }, 120);

                    }, 200);
                });
            });
        });

        // Cerrar el menú si hacen clic fuera de la barra
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.classList.add('seccion-oculta');
            }
        });
    }

        









    // Inicializamos con la última fecha con resultados (o la primera fecha que exista, ver calcularFechaInicialFixture)
    renderizarBotonesFechaFixture();
    renderizarFixtureFecha(fechaActivaFixture);

//Función auxiliar para convertir fecha en tiempo relativo
    function calcularTiempoRelativo(timestamp) {
        if (!timestamp) return 'Hace un momento';
        
        const diferenciaMilisegundos = Date.now() - timestamp;
        const segundos = Math.floor(diferenciaMilisegundos / 1000);
        const minutos = Math.floor(segundos / 60);
        const horas = Math.floor(minutos / 60);
        const dias = Math.floor(horas / 24);

        if (segundos < 60) return 'Hace un momento';
        if (minutos < 60) return `Hace ${minutos} min`;
        if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
        return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    }

    // ============================================================
    // SISTEMA DINÁMICO DE NOTIFICACIONES Y ALERTAS (HEADER + SIDEBAR)
    // ============================================================
    function renderizarNotificaciones() {
        const contenedores = [
            document.getElementById('contenedor-lista-notificaciones'),
            document.getElementById('contenedor-lista-notificaciones-sidebar')
        ];
        const badges = [
            document.getElementById('badge-notificacion'),
            document.getElementById('badge-notificacion-sidebar')
        ];

        // Sin avisos de ejemplo: el torneo arranca limpio y los avisos los carga el staff desde el admin.
        // Si 'liga_notificaciones' no existe, se muestra vacío (sin escribir nada desde la web pública).
        const notifs = JSON.parse(localStorage.getItem('liga_notificaciones')) || [];

        const hayNoLeidas = notifs.some(n => !n.leida);

        // Apaga o enciende el puntito rojo según corresponda
        badges.forEach(badgeDot => {
            if (badgeDot) {
                if (hayNoLeidas) badgeDot.classList.add('activo');
                else badgeDot.classList.remove('activo');
            }
        });

        // Limpia y renderiza en los contenedores
        contenedores.forEach(contenedor => {
            if (!contenedor) return;
            contenedor.innerHTML = '';

            if (notifs.length === 0) {
                contenedor.innerHTML = '<p style="color:#869bd8; font-size:10px; text-align:center; padding:15px;">No hay alertas en el casillero.</p>';
                return;
            }

            notifs.forEach(n => {
        const claseLeida = n.leida ? 'leida' : '';
        const claseUrgente = (n.tipo === 'urgente' && !n.leida) ? 'urgente' : '';
        
        // Calculamos el tiempo en tiempo real usando el timestamp guardado
        const tiempoTexto = n.timestamp ? calcularTiempoRelativo(n.timestamp) : (n.tiempo || 'Reciente');

        contenedor.innerHTML += `
            <div class="notif-item ${claseLeida} ${claseUrgente}">
                <div class="notif-item-title">${n.titulo}</div>
                <div class="notif-item-desc">${n.texto}</div>
                <div class="notif-item-time">${tiempoTexto}</div>
            </div>
        `;
    });
        });
    }

    // Elementos Header
    const btnNotifHeader = document.getElementById('btn-notificaciones-header');
    const dropdownNotifHeader = document.getElementById('dropdown-notificaciones');

    // Elementos Sidebar (usando el ID que ya existía)
    const btnNotifSidebar = document.getElementById('btn-notificaciones');
    const dropdownNotifSidebar = document.getElementById('dropdown-notificaciones-sidebar');
    const sidebarEl = document.querySelector('aside.sidebar');

    // Botones de acción
    const btnsMarcarLeido = [
        document.getElementById('btn-marcar-leido'),
        document.getElementById('btn-marcar-leido-sidebar')
    ];
    const btnsLimpiarNotifs = [
        document.getElementById('btn-limpiar-notifs'),
        document.getElementById('btn-limpiar-notifs-sidebar')
    ];

    // Control para Header
    if (btnNotifHeader && dropdownNotifHeader) {
        btnNotifHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownNotifSidebar) dropdownNotifSidebar.classList.add('seccion-oculta');
            if (sidebarEl) sidebarEl.classList.remove('sidebar-fijada');
            dropdownNotifHeader.classList.toggle('seccion-oculta');
        });
    }

    // Control para Sidebar (Usando e.currentTarget para capturar el contenedor entero)
    if (btnNotifSidebar && dropdownNotifSidebar) {
        btnNotifSidebar.addEventListener('click', (e) => {
            // Evita que el clic en los elementos internos del desplegable vuelva a disparar el evento
            if (dropdownNotifSidebar.contains(e.target)) return;
            
            e.stopPropagation();
            if (dropdownNotifHeader) dropdownNotifHeader.classList.add('seccion-oculta');
            
            dropdownNotifSidebar.classList.toggle('seccion-oculta');
            
            if (sidebarEl) {
                if (!dropdownNotifSidebar.classList.contains('seccion-oculta')) {
                    sidebarEl.classList.add('sidebar-fijada');
                } else {
                    sidebarEl.classList.remove('sidebar-fijada');
                }
            }
        });
    }

    // Cierre general al tocar afuera
    document.addEventListener('click', (e) => {
        if (dropdownNotifHeader && !dropdownNotifHeader.contains(e.target) && btnNotifHeader && !btnNotifHeader.contains(e.target)) {
            dropdownNotifHeader.classList.add('seccion-oculta');
        }
        if (dropdownNotifSidebar && !dropdownNotifSidebar.contains(e.target) && btnNotifSidebar && !btnNotifSidebar.contains(e.target)) {
            dropdownNotifSidebar.classList.add('seccion-oculta');
            if (sidebarEl) sidebarEl.classList.remove('sidebar-fijada');
        }
    });

    // Marcar leídos
    btnsMarcarLeido.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let notifs = JSON.parse(localStorage.getItem('liga_notificaciones')) || [];
                notifs.forEach(n => n.leida = true);
                localStorage.setItem('liga_notificaciones', JSON.stringify(notifs));
                renderizarNotificaciones();
            });
        }
    });

    // Limpiar
    btnsLimpiarNotifs.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.setItem('liga_notificaciones', JSON.stringify([]));
                renderizarNotificaciones();
            });
        }
    });

    renderizarNotificaciones();

    // ============================================================
    // LÓGICA DEL MODAL DE FICHA TÉCNICA DEL EQUIPO (PALETA SITIO)
    // ============================================================
    const modalEquipo = document.getElementById('modal-equipo');
    const btnCerrarModalEquipo = document.getElementById('btn-cerrar-modal-equipo');

    // PJ del jugador = partidos jugados en los que el staff lo tildó en la lista de buena fe (asistentesLocal/Visitante).
    // No cuentan los partidos resueltos automáticamente por ausencia del rival (3-0 sin jugarse).
    function ladosDelEquipoEnPartido(p, equipo) {
        const nombreEquipo = equipo.nombre.trim().toLowerCase();
        return {
            esLocal: (equipo.id != null && p.localId === equipo.id) || (p.local || '').trim().toLowerCase() === nombreEquipo,
            esVisita: (equipo.id != null && p.visitanteId === equipo.id) || (p.visitante || '').trim().toLowerCase() === nombreEquipo
        };
    }

    function partidosJugadosDeJugador(jugador, equipo, partidos) {
        const id = jugador.dni;
        return partidos.filter(p => {
            if (!p.jugado || p.resultadoAuto) return false;
            const { esLocal, esVisita } = ladosDelEquipoEnPartido(p, equipo);
            return (esLocal && (p.asistentesLocal || []).includes(id)) || (esVisita && (p.asistentesVisitante || []).includes(id));
        }).length;
    }

    // Amarillas y rojas del jugador: se cuentan desde los partidos jugados (cada tarjeta guarda el DNI del jugador). Las azules no se registran.
    function tarjetasDeJugador(jugador, equipo, partidos) {
        const id = jugador.dni;
        const total = { amarillas: 0, rojas: 0 };
        partidos.forEach(p => {
            if (!p.jugado) return;
            const { esLocal, esVisita } = ladosDelEquipoEnPartido(p, equipo);
            const contar = lista => (lista || []).filter(x => x === id).length;
            if (esLocal) { total.amarillas += contar(p.amarillasLocal); total.rojas += contar(p.rojasLocal); }
            if (esVisita) { total.amarillas += contar(p.amarillasVisitante); total.rojas += contar(p.rojasVisitante); }
        });
        return total;
    }

    // Las fechas de playoffs son números >= 100 (108 octavos, 104 cuartos, 102 semis, 100 final): van después de las fechas de grupos y en ese orden.
    function ordenCronologicoFechaPublico(fecha) {
        const f = Number(fecha);
        return f >= 100 ? 1000 + (200 - f) : f;
    }

    function nombreFechaPublico(fecha) {
        const f = Number(fecha);
        if (f === 108) return 'OCTAVOS';
        if (f === 104) return 'CUARTOS';
        if (f === 102) return 'SEMIFINAL';
        if (f === 100) return 'FINAL';
        return `FECHA ${fecha}`;
    }

    // Tarjetas de un lado del partido con el mismo formato que los goleadores ("Nombre (#N)", y "(2)" si tiene más de una).
    // En el partido se guarda el DNI de cada jugador: acá se busca el nombre y el dorsal en el plantel.
    function htmlTarjetasPartido(partido, lado) {
        const esLocal = lado === 'local';
        const pool = partido.ciclo === 'basico' ? ligaData.cicloBasico : ligaData.cicloSuperior;
        const nombreEquipo = ((esLocal ? partido.local : partido.visitante) || '').trim().toLowerCase();
        const idEquipo = esLocal ? partido.localId : partido.visitanteId;
        const equipo = pool.find(e => idEquipo != null && e.id === idEquipo) || pool.find(e => e.nombre.trim().toLowerCase() === nombreEquipo);
        if (!equipo) return '';
        const sufijo = esLocal ? 'Local' : 'Visitante';
        return [['amarillas', 'amarilla', 'Amarilla'], ['rojas', 'roja', 'Roja']].map(([campo, clase, etiqueta]) => {
            const cantidades = {};
            (partido[campo + sufijo] || []).forEach(id => { cantidades[id] = (cantidades[id] || 0) + 1; });
            return Object.keys(cantidades).map(id => {
                const jugador = (equipo.jugadores || []).find(j => j.dni === id);
                if (!jugador) return '';
                return `<div><span class="tarjeta-ico tarjeta-${clase}" role="img" aria-label="${etiqueta}"></span>${jugador.nombre} (#${jugador.dorsal}) ${cantidades[id] > 1 ? `(${cantidades[id]})` : ''}</div>`;
            }).join('');
        }).join('');
    }

    function abrirPerfilEquipo(nombreEquipo) {
        if (!modalEquipo) return;

        const todosLosEquipos = [
            ...ligaData.cicloSuperior.map(e => ({ ...e, ciclo: 'Superior' })),
            ...ligaData.cicloBasico.map(e => ({ ...e, ciclo: 'Básico' }))
        ];

        const equipo = todosLosEquipos.find(e => e.nombre.trim().toLowerCase() === nombreEquipo.trim().toLowerCase());
        if (!equipo) return;

        // 1. Cabecera y datos del equipo
        document.getElementById('modal-equipo-nombre').textContent = equipo.nombre;
        document.getElementById('modal-equipo-categoria').textContent = `Ciclo ${equipo.ciclo} — Grupo ${equipo.grupo || 'A'}`;

        const poolCiclo = equipo.ciclo === 'Superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
        const tablaOrdenada = ordenarTabla(poolCiclo.filter(e => e.grupo === equipo.grupo));
        const posReal = tablaOrdenada.findIndex(e => e.nombre === equipo.nombre) + 1;

        document.getElementById('modal-equipo-pos').textContent = posReal > 0 ? `${posReal}°` : '-';
        document.getElementById('modal-equipo-gf').textContent = equipo.gf || 0;
        document.getElementById('modal-equipo-pts').textContent = equipo.pts || 0;
        document.getElementById('modal-equipo-pj').textContent = equipo.pj || 0;

        // 2. Renderizado de plantilla de jugadores
        const tbodyJugadores = document.getElementById('modal-equipo-tbody-jugadores');
        tbodyJugadores.innerHTML = '';

        if (equipo.jugadores && equipo.jugadores.length > 0) {
            equipo.jugadores.sort((a, b) => (b.goles || 0) - (a.goles || 0));
            const partidosParaPJ = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos || [];

            equipo.jugadores.forEach((j, idx) => {
                const fotoUrl = j.foto || 'Recursos/search.svg';
                const dorsal = (j.dorsal !== undefined && j.dorsal !== null && String(j.dorsal).trim() !== '') ? `#${j.dorsal}` : `-`;
                const igUser = j.instagram 
                    ? `<a href="https://instagram.com/${j.instagram.replace('@','')}" target="_blank" class="ig-player-link">@${j.instagram.replace('@','')}</a>` 
                    : '-';

                tbodyJugadores.innerHTML += `
                    <tr class="row-normal">
                        <td><img src="${fotoUrl}" alt="${j.nombre}" class="player-avatar-img"></td>
                        <td style="color: #869bd8; font-size: 11px; text-align: center;">${dorsal}</td>
                        <td style="text-align: left !important; color: #fff; font-weight: bold;">${j.nombre}</td>
                        <td style="text-align: center;">${partidosJugadosDeJugador(j, equipo, partidosParaPJ)}</td>
                        <td style="color: #2edae3; font-weight: bold; text-align: center;">${j.goles || 0}</td>
                        <td style="color: #f2c00e; text-align: center;">${tarjetasDeJugador(j, equipo, partidosParaPJ).amarillas}</td>
                        <td style="color: #f43f5e; text-align: center;">${tarjetasDeJugador(j, equipo, partidosParaPJ).rojas}</td>
                        <td style="text-align: center;">${igUser}</td>
                    </tr>
                `;
            });
        } else {
            tbodyJugadores.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#869bd8; padding:15px; font-size:10px;">Sin jugadores registrados en el sistema.</td></tr>';
        }

        // 3. Renderizado de partidos con ORDEN CRONOLÓGICO Y DESPLEGABLE
        const contPartidos = document.getElementById('modal-equipo-lista-partidos');
        contPartidos.innerHTML = '';

        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || ligaData.partidos;
        const sancionesDinamicas = JSON.parse(localStorage.getItem('liga_sanciones')) || [];

        let misPartidos = partidosDinamicos.filter(p =>
            p.localId === equipo.id || p.visitanteId === equipo.id || // ID estable primero (sobrevive a un cambio de nombre)
            p.local.trim().toLowerCase() === equipo.nombre.trim().toLowerCase() ||
            p.visitante.trim().toLowerCase() === equipo.nombre.trim().toLowerCase()
        );

        if (misPartidos.length === 0) {
            contPartidos.innerHTML = '<p style="color:#869bd8; font-size:10px; text-align:center; padding:15px;">Sin partidos programados.</p>';
        } else {
            // Orden cronológico: las fechas de grupos por número y después los playoffs (108, 104, 102, 100 = octavos … final)
            misPartidos.sort((a, b) => ordenCronologicoFechaPublico(a.fecha) - ordenCronologicoFechaPublico(b.fecha));

            misPartidos.forEach(partido => {
                const esJugado = partido.jugado;
                const horarioTxt = partido.horario || 'Horario a confirmar';
                const canchaTxt = partido.cancha || 'Cancha 1';
                const diaTxt = partido.dia || '';

                // Incidencias Local
                let htmlLocal = '';
                if (partido.goleadoresLocal && partido.goleadoresLocal.length > 0) {
                    htmlLocal += partido.goleadoresLocal.map(g => `<div>${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
                }
                htmlLocal += htmlTarjetasPartido(partido, 'local');
                if (!htmlLocal && esJugado) htmlLocal = '<div style="opacity: 0.4;">Sin goles/tarjetas</div>';

                // Incidencias Visitante
                let htmlVisita = '';
                if (partido.goleadoresVisitante && partido.goleadoresVisitante.length > 0) {
                    htmlVisita += partido.goleadoresVisitante.map(g => `<div>${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
                }
                htmlVisita += htmlTarjetasPartido(partido, 'visitante');
                if (!htmlVisita && esJugado) htmlVisita = '<div style="opacity: 0.4;">Sin goles/tarjetas</div>';

                const mvpTxt = partido.mvp ? `<strong>MVP:</strong> ${partido.mvp}` : '';

                // Sanción/Descuento de puntos en esa fecha
                const sancionPartido = sancionesDinamicas.find(s =>
                    s.tipo === 'Quita de Puntos' &&
                    (s.equipoId != null ? s.equipoId === equipo.id : s.equipo.trim().toLowerCase() === equipo.nombre.trim().toLowerCase()) &&
                    (s.fecha === partido.fecha || s.acta === partido.fecha)
                );
                const htmlSancion = sancionPartido 
                    ? (sancionPartido.levantada
                        ? `<div class="sancion-partido-banner sancion-levantada">(${sancionPartido.fechaLevantada}) Quita levantada: pagó el 50%</div>`
                        : `<div class="sancion-partido-banner">Sanción/Descuento: -${sancionPartido.puntosRestados} PTS (${sancionPartido.motivo || 'Quita de puntos'})</div>`) 
                    : '';

                contPartidos.innerHTML += `
                    <div class="match-card-desplegable ${esJugado ? 'jugado' : 'pendiente'}">
                        
                        <div class="match-header-grid">
                            <div class="col-team col-local">
                                <span class="team-name">${partido.local}</span>
                            </div>

                            <div class="col-center">
                                <span style="font-size: 9px; color: #869bd8; font-family: 'Oswald'; display: block;">${nombreFechaPublico(partido.fecha)}</span>
                                ${esJugado
                                    ? `<span class="score-main">${partido.golesLocal} - ${partido.golesVisitante}</span>`
                                    : `<span class="vs-badge">VS</span>`
                                }
                                ${diaTxt ? `<span class="match-meta-dia">${diaTxt}</span>` : ''}
                                <div class="match-meta-info">${canchaTxt} | ${horarioTxt}</div>
                            </div>

                            <div class="col-team col-visita">
                                <span class="team-name">${partido.visitante}</span>
                                <span class="arrow-indicator">▼</span>
                            </div>
                        </div>

                        <!-- DESPLIEGUE CON DETALLES -->
                        <div class="match-details-drawer seccion-oculta">
                            <div class="drawer-divider-top"></div>
                            
                            ${esJugado ? `
                                <div class="split-details-container">
                                    <div class="split-col col-left">${htmlLocal}</div>
                                    <div class="split-vertical-line"></div>
                                    <div class="split-col col-right">${htmlVisita}</div>
                                </div>
                                ${mvpTxt ? `<div class="mvp-banner">${mvpTxt}</div>` : ''}
                            ` : `
                                <div style="text-align: center; color: #869bd8; font-size: 10px; font-family: Oswald; padding: 4px 0;">
                                    Partido programado
                                </div>
                            `}

                            ${htmlSancion}
                        </div>

                    </div>
                `;
            });

            // Habilitar desplegables dentro del modal
            contPartidos.querySelectorAll('.match-card-desplegable').forEach(card => {
                card.addEventListener('click', () => {
                    const drawer = card.querySelector('.match-details-drawer');
                    const arrow = card.querySelector('.arrow-indicator');
                    if (drawer) {
                        drawer.classList.toggle('seccion-oculta');
                        card.classList.toggle('desplegado');
                        if (arrow) arrow.textContent = drawer.classList.contains('seccion-oculta') ? '▼' : '▲';
                    }
                });
            });
        }

        modalEquipo.classList.remove('seccion-oculta');
    }

    // Eventos de cierre y pestañas
    if (btnCerrarModalEquipo && modalEquipo) {
        btnCerrarModalEquipo.addEventListener('click', () => modalEquipo.classList.add('seccion-oculta'));
        modalEquipo.addEventListener('click', (e) => {
            if (e.target === modalEquipo) modalEquipo.classList.add('seccion-oculta');
        });
    }

    document.querySelectorAll('.btn-tab-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-tab-modal').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.getAttribute('data-modal-target');
            document.querySelectorAll('.tab-modal-content').forEach(cont => cont.classList.add('seccion-oculta'));
            document.getElementById(targetId)?.classList.remove('seccion-oculta');
        });
    });

    // Clic en cualquier equipo de las tablas para abrir su perfil
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('td-team-name')) {
            const nombreEquipo = e.target.textContent.trim();
            abrirPerfilEquipo(nombreEquipo);
        }
    });

    // ============================================================
    // POPOVER DE CONTACTO EN EL FOOTER (al hacer hover/tap en la firma)
    // ============================================================
    const footerFirmaWrapper = document.querySelector('.footer-firma-wrapper');
    const footerFirmaTrigger = document.getElementById('footer-firma-trigger');

    if (footerFirmaWrapper && footerFirmaTrigger) {
        footerFirmaTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const visible = footerFirmaWrapper.classList.toggle('popover-visible');
            footerFirmaTrigger.setAttribute('aria-expanded', visible ? 'true' : 'false');
        });

        document.addEventListener('click', (e) => {
            if (!footerFirmaWrapper.contains(e.target)) {
                footerFirmaWrapper.classList.remove('popover-visible');
                footerFirmaTrigger.setAttribute('aria-expanded', 'false');
            }
        });
    }




















});