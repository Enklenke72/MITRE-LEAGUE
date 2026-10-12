document.addEventListener('liga:datos-listos', () => {

    // Todo lo que carga el staff (jugadores, equipos, sponsors, noticias, avisos, Tribunal) se escapa antes de meterlo en
    // el HTML, así un "<" o una comilla se muestran como texto y no se toman como código.
    function escaparHtml(texto) {
        return String(texto ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Un link "javascript:" ejecutaría código al tocarlo: esos quedan en "#".
    function urlSegura(url, siFalta = '#') {
        const u = String(url ?? '').trim();
        if (!u) return siFalta;
        return escaparHtml(/^(javascript|vbscript|data):/i.test(u.replace(/[\s\u0000-\u001f]/g, '')) ? '#' : u);
    }

    // Para url('...') dentro de un style: las comillas y los paréntesis cerrarían el url() antes de tiempo.
    function urlCss(url) {
        return urlSegura(String(url ?? '').replace(/['"()\\]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()), '');
    }

    // 1. ORDENAMIENTO Y CLASIFICACIÓN: ordenarTabla, calcularEstadisticas y clasificacionDelCiclo viven en
    // playoffs.js, compartidas con el panel, para que la tabla pública y el sorteo usen el mismo ranking.
    function desempatesDe(ciclo) {
        return obtenerDesempatesSorteo()[ciclo] || {};
    }

    function gruposDelCiclo(ciclo) {
        const grupos = JSON.parse(almacen.getItem('liga_grupos')) || { superior: ['A', 'B', 'C', 'D', 'E'], basico: ['A', 'B'] };
        return grupos[ciclo] || [];
    }

    function etiquetaGrupoPartido(partido) {
        return partido.grupo === 'Interzonal' ? 'Interzonal' : `Grupo ${escaparHtml(partido.grupo || 'A')}`;
    }

    // 2. PROCESAMIENTO MATEMÁTICO DE LA LIGA
    // 2. PROCESAMIENTO MATEMÁTICO DE LA LIGA
    function procesarLiga() {
        // NUEVO: Traemos los equipos actualizados desde la memoria (con sus grupos nuevos)
        const supDinamicos = almacen.getItem('liga_cicloSuperior');
        if (supDinamicos) { 
            ligaData.cicloSuperior = JSON.parse(supDinamicos); 
        }

        const basDinamicos = almacen.getItem('liga_cicloBasico');
        if (basDinamicos) { 
            ligaData.cicloBasico = JSON.parse(basDinamicos); 
        }

        const partidosDinamicos = almacen.getItem('liga_partidos'); 
        if (partidosDinamicos) { 
            ligaData.partidos = JSON.parse(partidosDinamicos); 
        }

        const sancionesDinamicas = almacen.getItem('liga_sanciones');
        if (sancionesDinamicas) {
            ligaData.sanciones = JSON.parse(sancionesDinamicas);
        }

        calcularEstadisticas(ligaData.cicloSuperior, ligaData.partidos, ligaData.sanciones, 'superior');
        calcularEstadisticas(ligaData.cicloBasico, ligaData.partidos, ligaData.sanciones, 'basico');
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

        // Quién va a cada copa depende de TODO el ciclo (los mejores 3°, el mejor 6°…), no solo del grupo que se pinta.
        const ciclo = tbodySelector === '.tbody-bas' ? 'basico' : 'superior';
        const desempates = desempatesDe(ciclo);
        const grupos = gruposDelCiclo(ciclo);
        const clasificacion = esTablaUnica ? [] : clasificacionDelCiclo(dataArray, grupos, ciclo, desempates);
        const filaDe = new Map(clasificacion.map(f => [f.equipo, f]));

        // Subtítulo dinámico: Cambia según el formato (Mundial vs Tabla Única)
        const subtitulo = titulo.nextElementSibling;
        if (subtitulo && subtitulo.classList.contains('group-category')) {
            subtitulo.textContent = esTablaUnica
                ? 'Clasificación a Playoffs: Bombo 1 (1° al 4°) | Bombo 2 (5° al 8°) | Bombo 3 (9° al 12°)'
                : textoClasificacion(clasificacion, ciclo, grupos.length);
        }

        const equiposFiltrados = ordenarTabla(
            esTablaUnica ? dataArray.filter(e => e.grupo === 'Unico' || !e.grupo) : dataArray.filter(e => e.grupo === grupoId),
            desempates
        );

        equiposFiltrados.forEach((equipo, index) => {
            // Lógica de Clases y Colores por Bombos / Copa
            let clasePosicion = 'td-pos-normal';
            const fila = filaDe.get(equipo);
            const copa = fila ? fila.copa : null;
            const cartel = fila && fila.porComparacion ? textoEntradaPorComparacion(clasificacion, fila, ciclo) : '';

            if (esTablaUnica) {
                if (index < 4) clasePosicion = 'td-pos-bombo1';       // Bombo 1 (1° al 4°)
                else if (index < 8) clasePosicion = 'td-pos-bombo2';  // Bombo 2 (5° al 8°)
                else if (index < 12) clasePosicion = 'td-pos-bombo3'; // Bombo 3 (9° al 12°)
            } else if (copa) {
                clasePosicion = `td-pos-${copa}`;
            }

            let colorDiffStyle = equipo.dif > 0 ? 'style="color: #4ade80 !important;"' : (equipo.dif < 0 ? 'style="color: #f43f5e !important;"' : '');
            const diffTexto = equipo.dif > 0 ? '+' + equipo.dif : equipo.dif;

            // GF y GC van siempre: el CSS los muestra solo en la vista Posiciones (.vista-ancha), igual que sus títulos.
            const columnasGFGC = `<td class="col-gf-gc" style="color: #869bd8;">${equipo.gf}</td><td class="col-gf-gc" style="color: #869bd8;">${equipo.gc}</td>`;

            const claseFila = !esTablaUnica && copa ? `row-copa-${copa}` : 'row-normal';

            tbody.innerHTML += `
                <tr class="${claseFila}">
                    <td class="${clasePosicion}" ${cartel ? `title="${escaparHtml(cartel)}"` : ''}>${index + 1}</td>
                    <td class="td-team-name">${escaparHtml(equipo.nombre)}</td>
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

    // Ranking de goleadores de un ciclo. Lo usan la tabla de Goleadores (los 10 primeros) y el perfil del jugador
    // ("#8 en Goleadores"), así nunca dicen cosas distintas. Entre empatados queda el orden del plantel.
    function rankingGoleadores(ciclo) {
        const pool = ciclo === 'superior'
            ? (JSON.parse(almacen.getItem('liga_cicloSuperior')) || ligaData.cicloSuperior)
            : (JSON.parse(almacen.getItem('liga_cicloBasico')) || ligaData.cicloBasico);

        const partidos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
        let listaJugadores = [];
        pool.forEach(eq => {
            if (eq.jugadores) {
                eq.jugadores.forEach(j => {
                    const goles = golesDeJugador(j, eq, partidos);
                    if (goles > 0) {
                        listaJugadores.push({
                            nombre: j.nombre,
                            equipo: eq.nombre,
                            dni: j.dni,
                            goles
                        });
                    }
                });
            }
        });

        return listaJugadores.sort((a, b) => b.goles - a.goles);
    }

    function renderizarGoleadores() {
        const tbody = document.getElementById('tbody-goleadores');
        if (!tbody) return;

        const topGoleadores = rankingGoleadores(cicloGoleadoresActivo).slice(0, 10);

        tbody.innerHTML = '';
        if (topGoleadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#869bd8; padding:10px; font-size:10px;">Sin goles registrados.</td></tr>';
            return;
        }

        topGoleadores.forEach((j, i) => {
            const datosPerfil = j.dni ? ` data-equipo="${escaparHtml(j.equipo)}" data-jugador="${escaparHtml(j.dni)}" tabindex="0"` : '';
            tbody.innerHTML += `
                <tr class="row-normal"${datosPerfil}>
                    <td style="color:#fff; text-align:center;">${i + 1}</td>
                    <td class="td-team-name">${escaparHtml(j.nombre)}</td>
                    <td style="font-size: 12px; color: #a9bce8;">${escaparHtml(j.equipo)}</td>
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
            pool.sort((a, b) => b.pts - a.pts || b.dif - a.dif || (b.g || 0) - (a.g || 0)); // PTS → DIF → partidos ganados (Joaquín, 12/10/2026)
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
                    <td class="td-team-name">${escaparHtml(e.nombre)}</td>
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
        const partidosDinamicos = almacen.getItem('liga_partidos');
        if (partidosDinamicos) ligaData.partidos = JSON.parse(partidosDinamicos);

        const contenedor = document.querySelector('.resultados-lista');
        if (!contenedor) return; 

        contenedor.innerHTML = ''; 

        // 1. Si no le pasamos fecha, detecta automáticamente la última fecha con partidos en el sistema.
        // Los playoffs entran en la cuenta: sus códigos (108/104/102/100) no se pueden comparar con
        // Math.max porque van al revés, así que se ordenan con ordenCronologicoFechaPublico.
        if (!fechaSeleccionada) {
            const fechasCargadas = ligaData.partidos.map(p => p.fecha);
            fechaSeleccionada = fechasCargadas.length > 0
                ? fechasCargadas.reduce((masReciente, f) =>
                    ordenCronologicoFechaPublico(f) > ordenCronologicoFechaPublico(masReciente) ? f : masReciente)
                : 1;
        }

        // 2. Buscamos el título principal del bloque en la Home/Fixture para ponerle la Fecha
        const tituloSeccion = document.querySelector('#pantalla-fixture h2');
        if (ligaData.partidos.length === 0) {
            if (tituloSeccion) tituloSeccion.textContent = 'ULTIMOS PARTIDOS';
            contenedor.innerHTML = '<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 18px;">Todavía no hay partidos cargados.</p>';
            return;
        }
        if (tituloSeccion) {
            tituloSeccion.innerHTML = `ULTIMOS PARTIDOS <span style="font-size: 13px; color: #2edae3; font-family: 'Oswald'; display: block; margin-top: 10px;">— ${nombreFechaPublico(fechaSeleccionada)} —</span>`;
        }

        const partidosFiltrados = ligaData.partidos.filter(partido => partido.fecha === fechaSeleccionada);

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = `<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 18px;">No hay partidos cargados para ${nombreFechaPublico(fechaSeleccionada)}.</p>`;
            return;
        }

        partidosFiltrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return ordenCopa(a, b) || (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });

        let ultimoSeparador = "";

        partidosFiltrados.forEach(partido => {
            const esDePlayoff = partido.esPlayoff || Number(partido.fecha) >= 100;
            const infoSeparador = esDePlayoff
                ? `${partido.ciclo === 'superior' ? 'Superior' : 'Básico'} — ${nombreFasePublico(partido)}`
                : `${partido.ciclo === 'superior' ? 'Superior' : 'Básico'} - ${etiquetaGrupoPartido(partido)}`;

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
                        <span class="team-name">${escaparHtml(partido.local)}</span>
                        <span class="score" style="color: #2edae3; font-weight: bold;">${escaparHtml(partido.golesLocal)} - ${escaparHtml(partido.golesVisitante)}</span>
                        <span class="team-name">${escaparHtml(partido.visitante)}</span>
                    </div>
                `;
            } else {
                contenedor.innerHTML += `
                    <div class="match-card" style="border-left-color: #e11d48; border-right-color: #e11d48;">
                        <span class="team-name">${escaparHtml(partido.local)}</span>
                        <span class="score" style="color: #f43f5e; font-size: 13px;">VS<br>
                            ${partido.dia ? `<span class="match-meta-dia">${escaparHtml(partido.dia)}</span>` : ''}
                            <span style="font-size: 10px; color: #869bd8; display:block; margin-top:2px;">${escaparHtml(partido.horario || 'Horario a confirmar')}</span>
                            <span style="font-size: 9px; color: #2edae3; display:block; font-family:'Oswald',sans-serif; margin-top:1px;">${escaparHtml(partido.cancha || 'Cancha a confirmar')}</span>
                        </span>
                        <span class="team-name">${escaparHtml(partido.visitante)}</span>
                    </div>
                `;
            }
        });
    }



    // ============================================================
    // RENDERIZADO DINÁMICO DE BOTONES DE GRUPOS EN LA WEB PÚBLICA
    // ============================================================
    // RENDERIZADO DINÁMICO DE BOTONES (INCLUYE TABLA ÚNICA SÓLO SI EL STAFF LA ACTIVÓ)
    function renderizarBotonesGruposPublico() {
        const gruposTorneo = JSON.parse(almacen.getItem('liga_grupos')) || {
            superior: ['A', 'B', 'C', 'D', 'E'],
            basico: ['A', 'B']
        };

        // Formato del torneo por ciclo (Grupos por defecto). La pestaña "Tabla
        // Única" NO se infiere de si algún equipo tiene grupo:'Unico' — eso era
        // un efecto secundario accidental. Ahora depende de una decisión
        // explícita del staff en el panel (sección "Formato del Torneo").
        const formatoTorneo = JSON.parse(almacen.getItem('liga_formato_torneo')) || { superior: 'grupos', basico: 'grupos' };

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
                const label = (g === 'Unico') ? 'Tabla Única' : `Grupo ${escaparHtml(g)}`;
                contenedor.innerHTML += `<button class="tab-btn ${idx === 0 ? 'active' : ''}" data-grupo-val="${escaparHtml(g)}">${label}</button>`;
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
    const gruposIniciales = JSON.parse(almacen.getItem('liga_grupos')) || { superior: ['A'], basico: ['A'] };
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
        const guardados = JSON.parse(almacen.getItem('liga_sponsors'));
        if (guardados && guardados.length > 0) return guardados;
        const seed = (typeof ligaData !== 'undefined' && ligaData.sponsors) ? ligaData.sponsors : [];
        if (seed.length > 0) almacen.setItem('liga_sponsors', JSON.stringify(seed));
        return seed;
    }

    function renderizarSponsorsPublico() {
        const track = document.getElementById('sponsors-track');
        if (!track) return;
        const sponsors = obtenerSponsors().slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));

        track.innerHTML = sponsors.map((s, i) => `
            <div class="sponsor-card-full${i === 0 ? ' active-slide' : ''}"${s.colorFondo ? ` style="background-color: ${String(s.colorFondo).replace(/[^#a-zA-Z0-9(),.%\s-]/g, '')};"` : ''}>
                ${s.categoria ? `<div class="sponsor-badge">${escaparHtml(s.categoria)}</div>` : ''}
                <img src="${urlSegura(s.logo, 'Recursos/logo pelota fut.svg')}" alt="Sponsor ${escaparHtml(s.nombre)}" class="sponsor-logo">
                <div class="sponsor-info">
                    <h4>${escaparHtml(s.nombre)}</h4>
                    <span class="sponsor-support">Apoyan al torneo de la siguiente manera</span>
                    <p>${escaparHtml(s.descripcion || '')}</p>
                    ${s.instagram ? `<a href="https://instagram.com/${escaparHtml(s.instagram.replace('@', ''))}" target="_blank" class="sponsor-contacto-link">@${escaparHtml(s.instagram.replace('@', ''))}</a>` : ''}
                    ${s.telefono ? `<span class="sponsor-contacto-link">${escaparHtml(s.telefono)}</span>` : ''}
                    ${s.ubicacion ? `<br>${s.ubicacion.trim().startsWith('http') ? `<a href="${urlSegura(s.ubicacion)}" target="_blank" class="sponsor-contacto-link sponsor-ubicacion">${escaparHtml(s.ubicacion)}</a>` : `<span class="sponsor-contacto-link sponsor-ubicacion">${escaparHtml(s.ubicacion)}</span>`}` : ''}
                    <br>
                    <button class="sponsor-link-btn btn-beneficio">Ver Beneficio</button>
                    <div class="beneficio-secreto">
                        <p>${escaparHtml(s.beneficio || '')}</p>
                        ${s.link ? `<a href="${urlSegura(s.link)}" target="_blank" class="link-video-futuro">Más información</a>` : ''}
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
        const guardados = JSON.parse(almacen.getItem('liga_fotos_albumes'));
        if (guardados && guardados.length > 0) return guardados;
        const seed = (typeof ligaData !== 'undefined' && ligaData.fotosAlbumes) ? ligaData.fotosAlbumes : [];
        if (seed.length > 0) almacen.setItem('liga_fotos_albumes', JSON.stringify(seed));
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
            <a href="${urlSegura(a.link)}" target="_blank" class="foto-card">
                <div class="foto-bg" style="background-image: url('${urlCss(a.portada || 'Recursos/search.svg')}');"></div>
                <div class="foto-content">
                    <h4>${escaparHtml(a.titulo)}</h4>
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
    // DIBUJAR NOTICIAS DINÁMICAS DESDE LA MEMORIA EN EL HERO
    // ============================================================
    // Tiene que ir antes del carrusel: si no, las tarjetas nuevas quedan sin posición (invisibles) y sin clic.
    const heroTrack = document.getElementById('hero-track-3d');
    const noticiasGuardadas = JSON.parse(almacen.getItem('liga_noticias')) || [];

    if (heroTrack && noticiasGuardadas.length > 0) {
        heroTrack.innerHTML = ''; // Limpiamos las noticias por defecto si cargaste nuevas

        noticiasGuardadas.forEach(n => {
            // Evaluamos si cargaste un link o no
            let htmlLink = '';
            if (n.linkUrl && n.linkUrl !== '') {
                htmlLink = `<a href="${urlSegura(n.linkUrl)}" class="hero-inline-link">${escaparHtml(n.linkTexto)}</a>`;
            }

            heroTrack.innerHTML += `
                <div class="hero-card-3d">
                    <div class="hero-card-bg" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.95)), url('${urlCss(n.foto)}');"></div>
                    <div class="hero-card-content">
                        <h2>${escaparHtml(n.titulo)}</h2>
                        <p>${escaparHtml(n.texto)} ${htmlLink}</p>
                    </div>
                </div>
            `;
        });
    }

    // ============================================================
    // LÓGICA DEL HERO EN 3D
    // ============================================================
    const heroSlides3D    = document.querySelectorAll('.hero-card-3d');
    const heroBtnPrev3D   = document.getElementById('prev-hero');
    const heroBtnNext3D   = document.getElementById('next-hero');
    const heroDotsCont3D  = document.getElementById('hero-dots-3d');

    const heroUnaSola = heroSlides3D.length <= 1;
    [heroBtnPrev3D, heroBtnNext3D, heroDotsCont3D].forEach(el => { if (el) el.hidden = heroUnaSola; });

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
        const sanciones = JSON.parse(almacen.getItem('liga_sanciones')) || [];

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
            contDetalleActa.innerHTML = `<p style="color:#869bd8; font-size:11px;">No hay resoluciones para el Acta N° ${escaparHtml(numActa)}.</p>`;
            return;
        }

        contDetalleActa.innerHTML = `
            <div style="font-family:'Oswald', sans-serif; font-size:11px; color:#f43f5e; margin-bottom:12px; text-transform:uppercase; border-bottom:1px solid rgba(244,63,94,0.2); padding-bottom:4px;">
                RESOLUCIONES OFICIALES — ACTA N° ${escaparHtml(numActa)}
            </div>
        `;

        sancionesActa.forEach(s => {
            const jugadorTexto = s.jugador ? ` — ${escaparHtml(s.jugador)}` : '';
            const sancionPts = s.levantada
                ? `<span style="color:#4ade80; font-weight:bold;">(${escaparHtml(s.fechaLevantada)}) Quita levantada: pagó el 50%</span>`
                : (s.tipo === 'Quita de Puntos' && s.puntosRestados > 0
                    ? `<span style="color:#f43f5e; font-weight:bold;">(-${escaparHtml(s.puntosRestados)} PTS)</span>`
                    : (s.tipo === 'Sanción Disciplinaria' && s.puntosRestados > 0
                        ? `<span style="color:#f43f5e; font-weight:bold;">(${escaparHtml(s.puntosRestados)} ${s.puntosRestados === 1 ? 'fecha' : 'fechas'} de suspensión)</span>`
                        : ''));

            contDetalleActa.innerHTML += `
                <div style="background: rgba(255,255,255,0.03); border-left: 4px solid #f43f5e; padding: 10px; margin-bottom: 8px; border-radius: 3px; text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:white; font-weight:bold;">${escaparHtml(s.equipo)}${jugadorTexto}</span>
                        <span style="font-size:10px; color:#fca5a5; font-weight:bold;">${escaparHtml(s.tipo)} ${sancionPts}</span>
                    </div>
                    <p style="color:#cbd5e1; font-size:11px; margin: 5px 0 0 0;"><em>"${escaparHtml(s.motivo || 'Sin motivo especificado')}"</em></p>
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
    let copaPlayoffPublicoActiva = 'oro'; // Copa Oro o Plata del ciclo elegido (Hecho #33)

    function renderizarPlayoffsPublico() {
        const bannerEspera = document.getElementById('playoffs-banner-espera');
        const contenidoActivo = document.getElementById('playoffs-contenido-activo');
        const bracketContenedor = document.getElementById('bracket-main');
        
        const estanPublicados = almacen.getItem('liga_playoffs_publicados') === 'true';

        if (!estanPublicados) {
            if (bannerEspera) bannerEspera.classList.remove('seccion-oculta');
            if (contenidoActivo) contenidoActivo.classList.add('seccion-oculta');
            return;
        }

        if (bannerEspera) bannerEspera.classList.add('seccion-oculta');
        if (contenidoActivo) contenidoActivo.classList.remove('seccion-oculta');

        // Las pestañas Copa Oro / Copa Plata solo aparecen si el ciclo tiene las dos.
        const conPlata = tieneCopaPlata(cicloPlayoffPublicoActivo);
        if (!conPlata) copaPlayoffPublicoActiva = 'oro';
        const copa = copaPlayoffPublicoActiva;
        const tabsCopa = document.querySelector('.tabs-copa-playoff');
        if (tabsCopa) {
            tabsCopa.hidden = !conPlata;
            tabsCopa.querySelectorAll('.btn-playoff-copa').forEach(b => b.classList.toggle('active', b.getAttribute('data-copa-playoff') === copa));
        }

        if (!bracketContenedor) return;

        const partidosGuardados = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
        const crucesGuardadosRaw = JSON.parse(almacen.getItem('liga_cruces_playoffs')) || [];
        // Por si el visitante carga index.html antes de que el staff haya abierto
        // admin.html al menos una vez desde esta actualización (que es lo que
        // persiste el campo 'slot'): migramos también acá, sólo
        // en memoria, para no depender de ese orden de eventos.
        const crucesGuardados = typeof migrarCrucesConSlot === 'function'
            ? migrarCrucesConSlot(crucesGuardadosRaw).cruces
            : crucesGuardadosRaw;
        const crucesCiclo = crucesGuardados.filter(c => c.ciclo === cicloPlayoffPublicoActivo && copaDe(c) === copa);

        bracketContenedor.innerHTML = '';
        const rondas = typeof rondasHabilitadas === 'function'
            ? rondasHabilitadas(cicloPlayoffPublicoActivo, null, copa)
            : ['octavos', 'cuartos', 'semis', 'final'];
        const slotsRonda = typeof slotsPorRonda === 'function' ? slotsPorRonda(cicloPlayoffPublicoActivo, null, copa) : null;
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
                    p.esPlayoff && p.ronda === ronda && p.ciclo === cicloPlayoffPublicoActivo && copaDe(p) === copa &&
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
                        penalesLocalTxt = `<span class="score-penal">(${escaparHtml(golesParaCruce.penalesLocal)})</span>`;
                        penalesVisitaTxt = `<span class="score-penal">(${escaparHtml(golesParaCruce.penalesVisitante)})</span>`;
                    }

                    if (ronda === 'final') {
                        if (esGanadorLocal) campeonTorneo = c.local;
                        if (esGanadorVisita) campeonTorneo = c.visitante;
                    }
                }

                rondaHTML += `
                    <div class="bracket-match">
                        <div class="team-row ${esGanadorLocal ? 'winner' : ''}">
                            <span class="team-name">${escaparHtml(c.local || '(A definir)')}</span>
                            <div>${penalesLocalTxt}<span class="score-num">${escaparHtml(gLocal)}</span></div>
                        </div>
                        <div class="team-row ${esGanadorVisita ? 'winner' : ''}">
                            <span class="team-name">${escaparHtml(c.visitante || '(A definir)')}</span>
                            <div>${penalesVisitaTxt}<span class="score-num">${escaparHtml(gVisita)}</span></div>
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
                    <span style="font-size: 9px; color: #869bd8; display: block; text-transform: uppercase; letter-spacing: 1px;">CAMPEÓN ${conPlata ? escaparHtml(nombreCopa(cicloPlayoffPublicoActivo, copa).toUpperCase()) : 'CLAUSURA 2026'}</span>
                    <h3 style="font-size: 15px; color: #fff; margin: 8px 0 0 0; text-shadow: 0 0 10px #f2c00e;">
                        ${campeonTorneo ? escaparHtml(campeonTorneo) : 'POR DEFINIR'}
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

    // Pestañas Copa Oro / Copa Plata (solo visibles en un ciclo con las dos)
    document.querySelectorAll('.btn-playoff-copa').forEach(btn => {
        btn.addEventListener('click', () => {
            copaPlayoffPublicoActiva = btn.getAttribute('data-copa-playoff');
            document.querySelectorAll('.btn-ronda-nav').forEach(b => b.classList.remove('active'));
            renderizarPlayoffsPublico();
        });
    });

    // Escuchador para cambiar de ciclo en Playoffs
    document.querySelectorAll('.btn-playoff-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-playoff-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cicloPlayoffPublicoActivo = btn.getAttribute('data-ciclo-playoff');
            copaPlayoffPublicoActiva = 'oro';
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

        const partidosDinamicos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos;
        let partidosFiltrados = partidosDinamicos.filter(p => p.fecha === numeroFecha);

        if (filtroCicloFixture !== 'todos') {
            partidosFiltrados = partidosFiltrados.filter(p => p.ciclo === filtroCicloFixture);
        }

        // Si se vuelve a dibujar por una actualización en vivo, los partidos que el visitante tenía abiertos siguen abiertos.
        const abiertos = new Set([...contenedor.querySelectorAll('.match-card-desplegable.desplegado')].map(c => c.dataset.pid));
        contenedor.innerHTML = '';

        if (partidosFiltrados.length === 0) {
            const hayFechas = fechasDeFaseDeGrupos().length > 0 || rondasDePlayoffConPartidos().length > 0;
            const etiquetaFecha = Number(numeroFecha) >= 100 ? nombreRondaPlayoffBoton(numeroFecha) : `Fecha ${numeroFecha}`;
            contenedor.innerHTML = `<p style="color: #869bd8; font-size: 11px; text-align: center; padding: 25px;">${hayFechas ? `No hay partidos cargados para ${etiquetaFecha}.` : 'Todavía no hay partidos cargados.'}</p>`;
            return;
        }

        partidosFiltrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return ordenCopa(a, b) || (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });

        let ultimoSeparador = "";

        partidosFiltrados.forEach((partido, index) => {
            const cicloTxt = partido.ciclo === 'superior' ? 'Superior' : 'Básico';
            const infoSeparador = partido.esPlayoff
                ? `${cicloTxt} — ${nombreFasePublico(partido)}`
                : `${cicloTxt} — ${etiquetaGrupoPartido(partido)}`;

            if (infoSeparador !== ultimoSeparador) {
                contenedor.innerHTML += `
                    <div style="font-family: 'Oswald', sans-serif; font-size: 11px; color: #2edae3; margin: 20px 0 10px 0; text-align: center; border-bottom: 1px dashed #1a3274; padding-bottom: 5px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            const esJugado = partido.jugado;
            const horarioTxt = escaparHtml(partido.horario || 'Horario a confirmar');
            const canchaTxt = escaparHtml(partido.cancha || 'Cancha a confirmar');
            const diaTxt = escaparHtml(partido.dia || '');

            // Goles y Tarjetas Local
            let htmlLocal = '';
            if (partido.goleadoresLocal && partido.goleadoresLocal.length > 0) {
                htmlLocal += partido.goleadoresLocal.map(g => `<div>${escaparHtml(g.nombre)} ${g.cantidad > 1 ? `x${g.cantidad}` : ''}</div>`).join('');
            }
            htmlLocal += htmlTarjetasPartido(partido, 'local');
            if (!htmlLocal && esJugado) htmlLocal = '<div style="opacity: 0.4;">Sin incidencias</div>';

            // Goles y Tarjetas Visitante
            let htmlVisita = '';
            if (partido.goleadoresVisitante && partido.goleadoresVisitante.length > 0) {
                htmlVisita += partido.goleadoresVisitante.map(g => `<div>${escaparHtml(g.nombre)} ${g.cantidad > 1 ? `x${g.cantidad}` : ''}</div>`).join('');
            }
            htmlVisita += htmlTarjetasPartido(partido, 'visitante');
            if (!htmlVisita && esJugado) htmlVisita = '<div style="opacity: 0.4;">Sin incidencias</div>';

            const mvpTxt = htmlMvpPartido(partido);

            contenedor.innerHTML += `
                <div class="match-card-desplegable ${esJugado ? 'jugado' : 'pendiente'}" data-pid="${escaparHtml(partido.id)}">

                    <!-- HEADER EN GRILLA 3 COLUMNAS -->
                    <div class="match-header-grid">

                        <!-- Columna 1: Equipo Local -->
                        <div class="col-team col-local">
                            <span class="team-name">${escaparHtml(partido.local)}</span>
                        </div>

                        <!-- Columna 2: Resultado / Metas (Centro exacto) -->
                        <div class="col-center">
                            ${esJugado
                                ? `<span class="score-main">${escaparHtml(partido.golesLocal)} - ${escaparHtml(partido.golesVisitante)}</span>`
                                : `<span class="vs-badge">VS</span>`
                            }
                            ${diaTxt ? `<span class="match-meta-dia">${diaTxt}</span>` : ''}
                            <div class="match-meta-info">
                                 ${canchaTxt} | ${horarioTxt}
                            </div>
                        </div>

                        <!-- Columna 3: Equipo Visitante + Flecha pegadita -->
                        <div class="col-team col-visita">
                            <span class="team-name">${escaparHtml(partido.visitante)}</span>
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

        // Escuchador de Clics. Solo las tarjetas del fixture: las del modal de un equipo tienen el suyo, y
        // engancharles otro hacía que se abrieran y cerraran en el mismo clic.
        const alternarTarjeta = card => {
            const drawer = card.querySelector('.match-details-drawer');
            const arrow = card.querySelector('.arrow-indicator');
            if (drawer) {
                drawer.classList.toggle('seccion-oculta');
                card.classList.toggle('desplegado');
                if (arrow) arrow.textContent = drawer.classList.contains('seccion-oculta') ? '▼' : '▲';
            }
        };
        contenedor.querySelectorAll('.match-card-desplegable').forEach(card => {
            card.addEventListener('click', () => alternarTarjeta(card));
            if (abiertos.has(card.dataset.pid)) alternarTarjeta(card);
        });
    }

    // Botones de fecha del fixture: uno por cada fecha de fase de grupos que exista en los partidos (sin tope fijo).
    function fechasDeFaseDeGrupos() {
        const partidosDinamicos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
        return [...new Set(partidosDinamicos.filter(p => !p.esPlayoff && p.fecha < 100).map(p => p.fecha))].sort((a, b) => a - b);
    }

    // Rondas de playoff (108/104/102/100) que tienen al menos un partido cargado, en orden cronológico
    // (Octavos → Final). Van como botones aparte, después de las fechas de fase de grupos.
    function rondasDePlayoffConPartidos() {
        const partidosDinamicos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
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
        const partidosDinamicos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
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
                        No se encontraron equipos con "${escaparHtml(query)}"
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
                const etiquetaGrupo = eq.grupo === 'Unico' ? 'Tabla Única' : `Grupo ${escaparHtml(eq.grupo || 'A')}`;
                item.innerHTML = `
                    <div class="search-item-header">
                        <span class="search-item-name">${escaparHtml(eq.nombre)}</span>
                        <span class="search-item-badge">${eq.ciclo} - ${etiquetaGrupo}</span>
                    </div>
                    <div class="search-item-actions">
                        <button class="search-action-btn btn-ir-tabla" data-equipo="${escaparHtml(eq.nombre)}">Posiciones</button>
                        <button class="search-action-btn btn-ir-partidos" data-equipo="${escaparHtml(eq.nombre)}">Partidos</button>
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
                    const partidosCrudos = almacen.getItem('liga_partidos');
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
                    // Preferimos fechas de temporada regular: los códigos de playoff
                    // (108/104/102/100) son más altos que cualquier fecha real y "ganaban"
                    // siempre en el Math.max. Si el equipo sólo jugó playoffs, usamos esos
                    // partidos igual como fallback.
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
    const CLAVE_AVISOS_LEIDOS = 'liga_avisos_leidos_dispositivo';
    const CLAVE_AVISOS_OCULTOS = 'liga_avisos_ocultos_dispositivo';

    function idsAvisosEnDispositivo(clave) {
        try {
            return JSON.parse(localStorage.getItem(clave)) || [];
        } catch (e) {
            return [];
        }
    }

    function sumarAvisosEnDispositivo(clave) {
        const ids = new Set(idsAvisosEnDispositivo(clave));
        (JSON.parse(almacen.getItem('liga_notificaciones')) || []).forEach(n => ids.add(String(n.id)));
        try {
            localStorage.setItem(clave, JSON.stringify([...ids]));
        } catch (e) {
            console.warn('[Avisos] No se pudo guardar en este dispositivo:', e);
        }
    }

    function renderizarNotificaciones() {
        const contenedores = [
            document.getElementById('contenedor-lista-notificaciones'),
            document.getElementById('contenedor-lista-notificaciones-sidebar')
        ];
        const badges = [
            document.getElementById('badge-notificacion'),
            document.getElementById('badge-notificacion-sidebar')
        ];

        // Los avisos los carga el staff y son de todos: "leído" y "limpiar" se guardan solo en este dispositivo.
        const leidos = idsAvisosEnDispositivo(CLAVE_AVISOS_LEIDOS);
        const ocultos = idsAvisosEnDispositivo(CLAVE_AVISOS_OCULTOS);
        const notifs = (JSON.parse(almacen.getItem('liga_notificaciones')) || [])
            .filter(n => !ocultos.includes(String(n.id)))
            .map(n => ({ ...n, leida: n.leida || leidos.includes(String(n.id)) }));

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
                <div class="notif-item-title">${escaparHtml(n.titulo)}</div>
                <div class="notif-item-desc">${escaparHtml(n.texto)}</div>
                <div class="notif-item-time">${escaparHtml(tiempoTexto)}</div>
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
                sumarAvisosEnDispositivo(CLAVE_AVISOS_LEIDOS);
                renderizarNotificaciones();
            });
        }
    });

    // Limpiar
    btnsLimpiarNotifs.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                sumarAvisosEnDispositivo(CLAVE_AVISOS_OCULTOS);
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

    // Goles del jugador: se cuentan desde los partidos jugados (antes eran un contador guardado en el jugador, que se
    // desfasaba al borrar un partido o si dos personas guardaban a la vez). Cada goleador guarda el DNI del jugador;
    // los partidos cargados antes del 27/09/2026 no lo tienen y se reconoce al jugador por su número de camiseta.
    function golesDeJugador(jugador, equipo, partidos) {
        const tieneDorsal = jugador.dorsal !== undefined && jugador.dorsal !== null && String(jugador.dorsal).trim() !== '';
        let total = 0;
        partidos.forEach(p => {
            if (!p.jugado) return;
            const { esLocal, esVisita } = ladosDelEquipoEnPartido(p, equipo);
            const contar = lista => (lista || []).forEach(g => {
                const dorsalEtiqueta = ((g.nombre || '').match(/#(\d+)/) || [])[1];
                const esEl = g.id != null
                    ? g.id === jugador.dni
                    : tieneDorsal && dorsalEtiqueta !== undefined && Number(dorsalEtiqueta) === Number(jugador.dorsal);
                if (esEl) total += g.cantidad || 0;
            });
            if (esLocal) contar(p.goleadoresLocal);
            if (esVisita) contar(p.goleadoresVisitante);
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

    // Un partido de playoff de un ciclo con dos copas dice de cuál: "Copa Plata · CUARTOS".
    function nombreFasePublico(partido) {
        const fase = nombreFechaPublico(partido.fecha);
        const copa = Number(partido.fecha) >= 100 ? nombreCopa(partido.ciclo || 'superior', copaDe(partido)) : '';
        return copa ? `${copa} · ${fase}` : fase;
    }

    // Dentro de un mismo ciclo, los partidos de la Copa Oro van antes que los de la Plata.
    function ordenCopa(a, b) {
        return (copaDe(a) === 'plata') - (copaDe(b) === 'plata');
    }

    // Tarjetas de un lado del partido con el mismo formato que los goleadores ("Nombre (#N)", y "x2" si tiene más de una).
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
                return `<div><span class="tarjeta-ico tarjeta-${clase}" role="img" aria-label="${etiqueta}"></span>${escaparHtml(jugador.nombre)} (#${escaparHtml(jugador.dorsal)}) ${cantidades[id] > 1 ? `x${cantidades[id]}` : ''}</div>`;
            }).join('');
        }).join('');
    }

    // Equipo de un lado del partido en el plantel público (por id estable, o por nombre en los partidos viejos).
    function equipoDelLadoPublico(partido, esLocal) {
        const pool = partido.ciclo === 'basico' ? ligaData.cicloBasico : ligaData.cicloSuperior;
        const id = esLocal ? partido.localId : partido.visitanteId;
        const nombre = ((esLocal ? partido.local : partido.visitante) || '').trim().toLowerCase();
        return pool.find(e => id != null && e.id === id) || pool.find(e => e.nombre.trim().toLowerCase() === nombre) || null;
    }

    // MVP del partido: el panel guarda al jugador (mvpId, que en la web pública es el código de su DNI) y acá se arma
    // "Nombre (#N)". Un partido viejo puede traer el MVP como texto suelto en "mvp".
    function htmlMvpPartido(partido) {
        if (partido.mvpId) {
            for (const esLocal of [true, false]) {
                const equipo = equipoDelLadoPublico(partido, esLocal);
                const jugador = equipo && (equipo.jugadores || []).find(j => j.dni === partido.mvpId);
                if (jugador) return `<strong>MVP:</strong> ${escaparHtml(jugador.nombre)} (#${escaparHtml(jugador.dorsal)})`;
            }
            return '';
        }
        return partido.mvp ? `<strong>MVP:</strong> ${escaparHtml(partido.mvp)}` : '';
    }

    const SILUETA_JUGADOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4.2"/><path d="M3.5 22c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8z"/></svg>';

    function abrirPerfilEquipo(nombreEquipo) {
        if (!modalEquipo) return false;

        const todosLosEquipos = [
            ...ligaData.cicloSuperior.map(e => ({ ...e, ciclo: 'Superior' })),
            ...ligaData.cicloBasico.map(e => ({ ...e, ciclo: 'Básico' }))
        ];

        const equipo = todosLosEquipos.find(e => e.nombre.trim().toLowerCase() === nombreEquipo.trim().toLowerCase());
        if (!equipo) return false;

        // 1. Cabecera y datos del equipo
        document.getElementById('modal-equipo-nombre').textContent = equipo.nombre;
        document.getElementById('modal-equipo-categoria').textContent = `Ciclo ${equipo.ciclo} — Grupo ${equipo.grupo || 'A'}`;

        const poolCiclo = equipo.ciclo === 'Superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
        const tablaOrdenada = ordenarTabla(poolCiclo.filter(e => e.grupo === equipo.grupo), desempatesDe(equipo.ciclo === 'Superior' ? 'superior' : 'basico'));
        const posReal = tablaOrdenada.findIndex(e => e.nombre === equipo.nombre) + 1;

        document.getElementById('modal-equipo-pos').textContent = posReal > 0 ? `${posReal}°` : '-';
        document.getElementById('modal-equipo-gf').textContent = equipo.gf || 0;
        document.getElementById('modal-equipo-pts').textContent = equipo.pts || 0;
        document.getElementById('modal-equipo-pj').textContent = equipo.pj || 0;

        // 2. Renderizado de plantilla de jugadores
        const tbodyJugadores = document.getElementById('modal-equipo-tbody-jugadores');
        tbodyJugadores.innerHTML = '';

        if (equipo.jugadores && equipo.jugadores.length > 0) {
            const partidosParaPJ = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
            const golesDe = new Map(equipo.jugadores.map(j => [j, golesDeJugador(j, equipo, partidosParaPJ)]));
            equipo.jugadores.sort((a, b) => golesDe.get(b) - golesDe.get(a));

            equipo.jugadores.forEach((j, idx) => {
                const fotoHtml = j.foto
                    ? `<img src="${escaparHtml(j.foto)}" alt="${escaparHtml(j.nombre)}" class="player-avatar-img">`
                    : `<span class="player-avatar-img player-avatar-vacio" role="img" aria-label="Sin foto">${SILUETA_JUGADOR}</span>`;
                const dorsal = (j.dorsal !== undefined && j.dorsal !== null && String(j.dorsal).trim() !== '') ? `#${escaparHtml(j.dorsal)}` : `-`;
                const ig = j.instagram ? escaparHtml(j.instagram.replace('@','')) : '';
                const igUser = ig
                    ? `<a href="https://instagram.com/${ig}" target="_blank" class="ig-player-link">@${ig}</a>`
                    : '-';

                const datosPerfil = j.dni ? ` data-jugador="${escaparHtml(j.dni)}" tabindex="0"` : '';

                tbodyJugadores.innerHTML += `
                    <tr class="row-normal"${datosPerfil}>
                        <td>${fotoHtml}</td>
                        <td style="color: #869bd8; font-size: 11px; text-align: center;">${dorsal}</td>
                        <td style="text-align: left !important; color: #fff; font-weight: bold;">${escaparHtml(j.nombre)}</td>
                        <td style="text-align: center; color:#fff;">${partidosJugadosDeJugador(j, equipo, partidosParaPJ)}</td>
                        <td style="color: #2edae3; font-weight: bold; text-align: center;">${golesDe.get(j)}</td>
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

        const partidosDinamicos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos;
        const sancionesDinamicas = JSON.parse(almacen.getItem('liga_sanciones')) || [];

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
                const horarioTxt = escaparHtml(partido.horario || 'Horario a confirmar');
                const canchaTxt = escaparHtml(partido.cancha || 'Cancha a confirmar');
                const diaTxt = escaparHtml(partido.dia || '');

                // Incidencias Local
                let htmlLocal = '';
                if (partido.goleadoresLocal && partido.goleadoresLocal.length > 0) {
                    htmlLocal += partido.goleadoresLocal.map(g => `<div>${escaparHtml(g.nombre)} ${g.cantidad > 1 ? `x${g.cantidad}` : ''}</div>`).join('');
                }
                htmlLocal += htmlTarjetasPartido(partido, 'local');
                if (!htmlLocal && esJugado) htmlLocal = '<div style="opacity: 0.4;">Sin goles/tarjetas</div>';

                // Incidencias Visitante
                let htmlVisita = '';
                if (partido.goleadoresVisitante && partido.goleadoresVisitante.length > 0) {
                    htmlVisita += partido.goleadoresVisitante.map(g => `<div>${escaparHtml(g.nombre)} ${g.cantidad > 1 ? `x${g.cantidad}` : ''}</div>`).join('');
                }
                htmlVisita += htmlTarjetasPartido(partido, 'visitante');
                if (!htmlVisita && esJugado) htmlVisita = '<div style="opacity: 0.4;">Sin goles/tarjetas</div>';

                const mvpTxt = htmlMvpPartido(partido);

                // Sanción/Descuento de puntos en esa fecha
                const sancionPartido = sancionesDinamicas.find(s =>
                    s.tipo === 'Quita de Puntos' &&
                    (s.equipoId != null ? s.equipoId === equipo.id : s.equipo.trim().toLowerCase() === equipo.nombre.trim().toLowerCase()) &&
                    (s.fecha === partido.fecha || s.acta === partido.fecha)
                );
                const htmlSancion = sancionPartido 
                    ? (sancionPartido.levantada
                        ? `<div class="sancion-partido-banner sancion-levantada">(${escaparHtml(sancionPartido.fechaLevantada)}) Quita levantada: pagó el 50%</div>`
                        : `<div class="sancion-partido-banner">Sanción/Descuento: -${escaparHtml(sancionPartido.puntosRestados)} PTS (${escaparHtml(sancionPartido.motivo || 'Quita de puntos')})</div>`)
                    : '';

                contPartidos.innerHTML += `
                    <div class="match-card-desplegable ${esJugado ? 'jugado' : 'pendiente'}">
                        
                        <div class="match-header-grid">
                            <div class="col-team col-local">
                                <span class="team-name">${escaparHtml(partido.local)}</span>
                            </div>

                            <div class="col-center">
                                <span style="font-size: 9px; color: #869bd8; font-family: 'Oswald'; display: block;">${escaparHtml(nombreFasePublico(partido))}</span>
                                ${esJugado
                                    ? `<span class="score-main">${escaparHtml(partido.golesLocal)} - ${escaparHtml(partido.golesVisitante)}</span>`
                                    : `<span class="vs-badge">VS</span>`
                                }
                                ${diaTxt ? `<span class="match-meta-dia">${diaTxt}</span>` : ''}
                                <div class="match-meta-info">${canchaTxt} | ${horarioTxt}</div>
                            </div>

                            <div class="col-team col-visita">
                                <span class="team-name">${escaparHtml(partido.visitante)}</span>
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
        return true;
    }

    // ============================================================
    // PERFIL DEL JUGADOR: otra vista dentro del mismo modal (en el celular es más simple que un modal sobre otro)
    // ============================================================
    const vistaEquipoModal = document.getElementById('modal-vista-equipo');
    const vistaJugadorModal = document.getElementById('modal-vista-jugador');
    const cardModalEquipo = modalEquipo ? modalEquipo.querySelector('.modal-equipo-card') : null;
    let jugadorAbierto = null;  // {equipo, dni} mientras se ve un perfil
    let scrollListaEquipo = 0;  // dónde estaba la lista del equipo, para que "Volver" deje al visitante en el mismo lugar

    function mostrarVistaModal(vista) {
        if (!vistaEquipoModal || !vistaJugadorModal) return;
        vistaEquipoModal.classList.toggle('seccion-oculta', vista !== 'equipo');
        vistaJugadorModal.classList.toggle('seccion-oculta', vista !== 'jugador');
    }

    function volverAlEquipo() {
        jugadorAbierto = null;
        mostrarVistaModal('equipo');
        if (cardModalEquipo) cardModalEquipo.scrollTop = scrollListaEquipo;
    }

    function cerrarModalEquipo() {
        modalEquipo.classList.add('seccion-oculta');
        jugadorAbierto = null;
        mostrarVistaModal('equipo');
    }

    // Partidos del jugador: los jugados (sin los 3-0 automáticos) en los que figura tildado en la lista de buena fe,
    // hizo goles, vio tarjetas o fue el MVP.
    function htmlPartidosDeJugador(jugador, equipo, partidos) {
        const filas = partidos.filter(p => p.jugado && !p.resultadoAuto).map(p => {
            const { esLocal, esVisita } = ladosDelEquipoEnPartido(p, equipo);
            if (!esLocal && !esVisita) return null;
            const tildado = (p[esLocal ? 'asistentesLocal' : 'asistentesVisitante'] || []).includes(jugador.dni);
            const goles = golesDeJugador(jugador, equipo, [p]);
            const tarjetas = tarjetasDeJugador(jugador, equipo, [p]);
            const mvp = !!p.mvpId && p.mvpId === jugador.dni;
            if (!tildado && !goles && !tarjetas.amarillas && !tarjetas.rojas && !mvp) return null;
            return { p, esLocal, goles, tarjetas, mvp };
        }).filter(Boolean);

        if (filas.length === 0) return '<p class="perfil-jugador-vacio">Todavía no jugó partidos.</p>';

        filas.sort((a, b) => ordenCronologicoFechaPublico(a.p.fecha) - ordenCronologicoFechaPublico(b.p.fecha));
        return filas.map(({ p, esLocal, goles, tarjetas, mvp }) => {
            const propios = esLocal ? p.golesLocal : p.golesVisitante;
            const ajenos = esLocal ? p.golesVisitante : p.golesLocal;
            let res = propios > ajenos ? 'G' : (propios < ajenos ? 'P' : 'E');
            let penales = '';
            // Un empate de playoffs se define por penales
            if (res === 'E' && p.esPlayoff && p.penalesLocal != null && p.penalesVisitante != null && p.penalesLocal !== p.penalesVisitante) {
                const penPropios = esLocal ? p.penalesLocal : p.penalesVisitante;
                const penAjenos = esLocal ? p.penalesVisitante : p.penalesLocal;
                res = penPropios > penAjenos ? 'G' : 'P';
                penales = ` (${escaparHtml(penPropios)}-${escaparHtml(penAjenos)} pen.)`;
            }
            const textoRes = { G: 'Ganó', E: 'Empató', P: 'Perdió' }[res];
            const icono = (clase, etiqueta, n) => `<span class="tarjeta-ico tarjeta-${clase}" role="img" aria-label="${etiqueta}"></span>`.repeat(n);
            const incidencias = [
                goles ? `<span class="perfil-partido-goles">${goles} ${goles === 1 ? 'gol' : 'goles'}</span>` : '',
                icono('amarilla', 'Amarilla', tarjetas.amarillas) + icono('roja', 'Roja', tarjetas.rojas),
                mvp ? '<span class="perfil-partido-mvp">MVP</span>' : ''
            ].join('');
            return `
                <div class="perfil-partido">
                    <div class="perfil-partido-info">
                        <span class="perfil-partido-fecha">${escaparHtml(nombreFechaPublico(p.fecha))}</span>
                        <span class="perfil-partido-rival">vs ${escaparHtml(esLocal ? p.visitante : p.local)}</span>
                    </div>
                    <div class="perfil-partido-detalle">
                        <span class="perfil-partido-res res-${res}" title="${textoRes}">${res} ${escaparHtml(propios)}-${escaparHtml(ajenos)}${penales}</span>
                        ${incidencias}
                    </div>
                </div>
            `;
        }).join('');
    }

    function dibujarPerfilJugador(jugador, equipo, ciclo) {
        const partidos = JSON.parse(almacen.getItem('liga_partidos')) || ligaData.partidos || [];
        const nombreCiclo = ciclo === 'superior' ? 'Superior' : 'Básico';
        const tieneDorsal = jugador.dorsal !== undefined && jugador.dorsal !== null && String(jugador.dorsal).trim() !== '';

        document.getElementById('perfil-jugador-volver-equipo').textContent = equipo.nombre;
        document.getElementById('perfil-jugador-foto').innerHTML = jugador.foto
            ? `<img src="${escaparHtml(jugador.foto)}" alt="${escaparHtml(jugador.nombre)}">`
            : SILUETA_JUGADOR;
        document.getElementById('perfil-jugador-dorsal').textContent = tieneDorsal ? `#${jugador.dorsal}` : 'S/N';
        document.getElementById('perfil-jugador-nombre').textContent = jugador.nombre;
        document.getElementById('perfil-jugador-categoria').textContent =
            `${equipo.nombre} · Ciclo ${nombreCiclo} — ${equipo.grupo === 'Unico' ? 'Tabla Única' : `Grupo ${equipo.grupo || 'A'}`}`;
        const ig = jugador.instagram ? escaparHtml(jugador.instagram.replace('@', '')) : '';
        document.getElementById('perfil-jugador-instagram').innerHTML = ig
            ? `<a href="https://instagram.com/${ig}" target="_blank" class="ig-player-link">@${ig}</a>`
            : '';

        const puesto = rankingGoleadores(ciclo).findIndex(g =>
            g.equipo.trim().toLowerCase() === equipo.nombre.trim().toLowerCase() && g.dni === jugador.dni) + 1;
        const ranking = document.getElementById('perfil-jugador-ranking');
        ranking.textContent = puesto > 0 ? `#${puesto} en Goleadores · Ciclo ${nombreCiclo}` : 'Sin goles todavía';
        ranking.classList.toggle('sin-goles', puesto === 0);

        const tarjetas = tarjetasDeJugador(jugador, equipo, partidos);
        document.getElementById('perfil-jugador-pj').textContent = partidosJugadosDeJugador(jugador, equipo, partidos);
        document.getElementById('perfil-jugador-goles').textContent = golesDeJugador(jugador, equipo, partidos);
        document.getElementById('perfil-jugador-mvp').textContent = partidos.filter(p => p.jugado && p.mvpId && p.mvpId === jugador.dni).length;
        document.getElementById('perfil-jugador-amarillas').textContent = tarjetas.amarillas;
        document.getElementById('perfil-jugador-rojas').textContent = tarjetas.rojas;

        document.getElementById('perfil-jugador-partidos').innerHTML = htmlPartidosDeJugador(jugador, equipo, partidos);
    }

    // Abre el modal del equipo (así "Volver" ya lo tiene listo) y pasa a la vista del jugador. Si el jugador ya no
    // está en el plantel, se queda en el equipo. conservarScroll: lo usa el refresco en vivo para no mover la pantalla.
    function abrirPerfilJugador(nombreEquipo, dni, conservarScroll) {
        if (!modalEquipo || !cardModalEquipo) return false;
        const modalYaAbierto = !modalEquipo.classList.contains('seccion-oculta');
        if (!conservarScroll) scrollListaEquipo = (modalYaAbierto && !jugadorAbierto) ? cardModalEquipo.scrollTop : 0;
        if (!abrirPerfilEquipo(nombreEquipo)) return false;

        const nombre = nombreEquipo.trim().toLowerCase();
        const ciclo = ligaData.cicloSuperior.some(e => e.nombre.trim().toLowerCase() === nombre) ? 'superior' : 'basico';
        const equipo = (ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico).find(e => e.nombre.trim().toLowerCase() === nombre);
        const jugador = equipo && (equipo.jugadores || []).find(j => j.dni === dni);
        if (!jugador) {
            volverAlEquipo();
            return false;
        }

        jugadorAbierto = { equipo: equipo.nombre, dni };
        dibujarPerfilJugador(jugador, equipo, ciclo);
        mostrarVistaModal('jugador');
        if (!conservarScroll) cardModalEquipo.scrollTop = 0;
        return true;
    }

    // Tocar un jugador (la fila entera, menos el link de Instagram) abre su perfil. Con el teclado: Enter.
    function abrirPerfilDesdeFila(e, nombreEquipoDe) {
        const fila = e.target.closest('tr[data-jugador]');
        if (!fila || e.target.closest('a')) return;
        if (e.type === 'keydown') {
            if (e.key !== 'Enter') return;
            e.preventDefault();
        }
        abrirPerfilJugador(nombreEquipoDe(fila), fila.dataset.jugador);
    }

    const tbodyJugadoresModal = document.getElementById('modal-equipo-tbody-jugadores');
    const tbodyGoleadores = document.getElementById('tbody-goleadores');
    const equipoDelModal = () => document.getElementById('modal-equipo-nombre').textContent;
    ['click', 'keydown'].forEach(tipo => {
        if (tbodyJugadoresModal) tbodyJugadoresModal.addEventListener(tipo, e => abrirPerfilDesdeFila(e, equipoDelModal));
        if (tbodyGoleadores) tbodyGoleadores.addEventListener(tipo, e => abrirPerfilDesdeFila(e, fila => fila.dataset.equipo));
    });

    const btnVolverEquipo = document.getElementById('btn-volver-equipo');
    if (btnVolverEquipo) btnVolverEquipo.addEventListener('click', volverAlEquipo);

    // Eventos de cierre y pestañas
    if (btnCerrarModalEquipo && modalEquipo) {
        btnCerrarModalEquipo.addEventListener('click', cerrarModalEquipo);
        modalEquipo.addEventListener('click', (e) => {
            if (e.target === modalEquipo) cerrarModalEquipo();
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

    // Clic en cualquier equipo de las tablas para abrir su perfil (en la tabla de Goleadores ese nombre es de un jugador)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('td-team-name') && !e.target.closest('#tbody-goleadores')) {
            const nombreEquipo = e.target.textContent.trim();
            jugadorAbierto = null;
            mostrarVistaModal('equipo');
            abrirPerfilEquipo(nombreEquipo);
        }
    });

    // ============================================================
    // TIEMPO REAL: cuando el staff carga algo en el panel
    // ============================================================
    // datos-firestore.js actualiza el almacén y avisa con 'liga:datos-actualizados'. Se redibuja lo
    // que depende de los datos sin perder dónde estaba parado el visitante (grupo, fecha del fixture,
    // acta del Tribunal, perfil de equipo abierto). Noticias, sponsors y álbumes se actualizan al
    // volver a entrar: sus carruseles se arman una sola vez al cargar la página.

    // Dispara solo el escuchador del botón: un clic que burbujea cerraría la campanita o el popover.
    const pulsarSinPropagar = boton => boton.dispatchEvent(new Event('click'));

    function restaurarGrupo(selectorTabs, grupoAnterior) {
        const botones = [...document.querySelectorAll(`${selectorTabs} .tab-btn`)];
        const boton = botones.find(b => b.getAttribute('data-grupo-val') === grupoAnterior) || botones[0];
        if (boton) pulsarSinPropagar(boton);
    }

    function refrescarConDatosNuevos() {
        const grupoSup = (document.querySelector('.tabs-sup .tab-btn.active') || {}).dataset?.grupoVal;
        const grupoBas = (document.querySelector('.tabs-bas .tab-btn.active') || {}).dataset?.grupoVal;
        procesarLiga();
        renderizarBotonesGruposPublico();
        restaurarGrupo('.tabs-sup', grupoSup);
        restaurarGrupo('.tabs-bas', grupoBas);

        renderizarGoleadores();
        renderizarResultados();
        renderizarTablaAnual();
        renderizarPlayoffsPublico();
        renderizarBotonesFechaFixture();
        renderizarFixtureFecha(fechaActivaFixture);
        renderizarNotificaciones();
        aplicarCiclosQueSeJuegan();

        if (panelTribunal && contFechasTribunal && !panelTribunal.classList.contains('seccion-oculta')) {
            const actaAbierta = (contFechasTribunal.querySelector('.tab-btn.active') || {}).textContent;
            cargarTribunalPublico();
            const boton = [...contFechasTribunal.querySelectorAll('.tab-btn')].find(b => b.textContent === actaAbierta);
            if (boton) pulsarSinPropagar(boton);
        }

        if (modalEquipo && !modalEquipo.classList.contains('seccion-oculta')) {
            if (jugadorAbierto) {
                // El perfil se redibuja en el lugar; si al jugador lo dieron de baja, vuelve al equipo
                const scroll = cardModalEquipo.scrollTop;
                if (abrirPerfilJugador(jugadorAbierto.equipo, jugadorAbierto.dni, true)) cardModalEquipo.scrollTop = scroll;
            } else {
                abrirPerfilEquipo(document.getElementById('modal-equipo-nombre').textContent);
            }
        }
    }

    // ============================================================
    // CICLOS QUE SE JUEGAN (se eligen en el panel: liga_ciclos_activos)
    // ============================================================
    // Un ciclo que no se juega esta edición se oculta: su bloque en Posiciones y sus pestañas en Goleadores,
    // Tabla General y Play-Offs. Si queda uno solo, esos selectores de ciclo también se ocultan. Va acá abajo
    // porque usa el ciclo elegido de cada sección (cicloPlayoffPublicoActivo se declara más arriba).
    function ciclosQueSeJuegan() {
        let guardado = null;
        try { guardado = JSON.parse(almacen.getItem('liga_ciclos_activos')); } catch (e) { guardado = null; }
        const activos = { superior: !guardado || guardado.superior !== false, basico: !guardado || guardado.basico !== false };
        return (activos.superior || activos.basico) ? activos : { superior: true, basico: true };
    }

    function ajustarPestanasDeCiclo(selector, atributo, cicloElegido, activos) {
        const botones = [...document.querySelectorAll(selector)];
        if (botones.length === 0) return;
        botones.forEach(b => b.classList.toggle('ciclo-no-se-juega', !activos[b.getAttribute(atributo)]));
        botones[0].parentElement.classList.toggle('ciclo-no-se-juega', botones.filter(b => activos[b.getAttribute(atributo)]).length < 2);
        // Si estaba elegido el ciclo que no se juega, pasa al otro (el clic no burbujea: no cierra nada abierto)
        if (!activos[cicloElegido]) {
            const otro = botones.find(b => activos[b.getAttribute(atributo)]);
            if (otro) otro.dispatchEvent(new Event('click'));
        }
    }

    function aplicarCiclosQueSeJuegan() {
        const activos = ciclosQueSeJuegan();
        const cerca = (selector, contenedor) => {
            const e = document.querySelector(selector);
            return e ? e.closest(contenedor) : null;
        };
        const inicioBasico = document.querySelector('.basic-section-margin');
        const bloques = {
            superior: [document.querySelector('.group-selector > .cycle-label'), document.querySelector('.tabs-sup'),
                cerca('.group-name-sup', '.group-title-container'), cerca('.tbody-sup', '.table-wrapper')],
            basico: [inicioBasico, cerca('.group-name-bas', '.group-title-container'), cerca('.tbody-bas', '.table-wrapper')]
        };
        Object.entries(bloques).forEach(([ciclo, elementos]) =>
            elementos.forEach(e => { if (e) e.classList.toggle('ciclo-no-se-juega', !activos[ciclo]); }));
        // La línea que separa los dos ciclos (el <hr> y el <br> de arriba) solo tiene sentido con los dos
        const separadores = [];
        let previo = inicioBasico ? inicioBasico.previousElementSibling : null;
        while (previo && (previo.tagName === 'HR' || previo.tagName === 'BR')) { separadores.push(previo); previo = previo.previousElementSibling; }
        separadores.forEach(e => e.classList.toggle('ciclo-no-se-juega', !(activos.superior && activos.basico)));

        ajustarPestanasDeCiclo('.btn-gol-ciclo', 'data-ciclo-gol', cicloGoleadoresActivo, activos);
        ajustarPestanasDeCiclo('.btn-anual-ciclo', 'data-anual-ciclo', cicloAnualActivo, activos);
        ajustarPestanasDeCiclo('.btn-playoff-ciclo', 'data-ciclo-playoff', cicloPlayoffPublicoActivo, activos);
    }

    aplicarCiclosQueSeJuegan();

    document.addEventListener('liga:datos-actualizados', refrescarConDatosNuevos);

    // ============================================================
    // POPOVER DE CONTACTO EN EL FOOTER (al hacer hover/tap en la firma)
    // ============================================================
    const footerFirmaWrapper = document.querySelector('.footer-firma-wrapper');
    const footerFirmaTrigger = document.getElementById('footer-firma-trigger');
    const footerContactoPopover = document.querySelector('.footer-contacto-popover');

    if (footerFirmaWrapper && footerFirmaTrigger && footerContactoPopover) {
        // El cartel se centra sobre el botón, pero el botón no siempre queda
        // centrado en la pantalla (el texto "Diseñado y Desarrollado por" lo
        // corre hacia un lado). En celus angostos (~360px) eso lo hacía salir
        // de la pantalla. Esto lo vuelve a meter en pantalla sin moverle la flechita.
        const ajustarPopoverFooter = () => {
            footerContactoPopover.style.setProperty('--popover-shift', '0px');
            const margen = 10;
            const rect = footerContactoPopover.getBoundingClientRect();
            let shift = 0;
            if (rect.right > window.innerWidth - margen) {
                shift = (window.innerWidth - margen) - rect.right;
            } else if (rect.left < margen) {
                shift = margen - rect.left;
            }
            footerContactoPopover.style.setProperty('--popover-shift', shift + 'px');
        };

        ajustarPopoverFooter();
        window.addEventListener('resize', ajustarPopoverFooter);
        footerFirmaWrapper.addEventListener('mouseenter', ajustarPopoverFooter);

        footerFirmaTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ajustarPopoverFooter();
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