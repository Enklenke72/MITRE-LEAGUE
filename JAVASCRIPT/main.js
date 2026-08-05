document.addEventListener('DOMContentLoaded', () => {

    // 1. ALGORITMO DE ORDENAMIENTO
    function ordenarTabla(equipos) {
        return [...equipos].sort((a, b) => { 
            if (b.pts !== a.pts) return b.pts - a.pts; 
            if (b.dif !== a.dif) return b.dif - a.dif; 
            return b.gf - a.gf;                        
        });
    }

    // 2. PROCESAMIENTO MATEMÁTICO DE LA LIGA
    function procesarLiga() {
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
            if (!partido.jugado) return; 

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
                equipoSancionado.pts -= sancion.puntosRestados;
            }
        });
    }

    // 3. RENDERIZADO DE TABLAS
    // 1. DIBUJAR TABLAS CON CONTROL GF/GC SEGÚN VISTA
    function renderizarTabla(dataArray, tbodySelector, tituloSelector, grupoId, nombreGrupo) {
        const tbody = document.querySelector(tbodySelector);
        const titulo = document.querySelector(tituloSelector);
        if (!tbody || !titulo) return;

        tbody.innerHTML = ''; 
        titulo.textContent = `Grupo ${nombreGrupo}`;

        const equiposFiltrados = ordenarTabla(dataArray.filter(equipo => equipo.grupo === grupoId));
        const dashboard = document.querySelector('.dashboard-container');
        const esVistaPosiciones = dashboard ? dashboard.classList.contains('vista-ancha') : false;

        document.querySelectorAll('.col-gf-gc').forEach(th => {
            th.style.display = esVistaPosiciones ? 'table-cell' : 'none';
        });

        equiposFiltrados.forEach((equipo, index) => {
            const claseFila = (index < 2) ? 'row-leader' : 'row-normal';
            let colorDiffStyle = equipo.dif > 0 ? 'style="color: #4ade80 !important;"' : (equipo.dif < 0 ? 'style="color: #f43f5e !important;"' : ''); 
            const diffTexto = equipo.dif > 0 ? '+' + equipo.dif : equipo.dif;

            const columnasGFGC = esVistaPosiciones 
                ? `<td style="color: #8fa3d9;">${equipo.gf}</td><td style="color: #8fa3d9;">${equipo.gc}</td>` 
                : '';

            tbody.innerHTML += `
                <tr class="${claseFila}">
                    <td class="${index < 2 ? 'td-pos-lead' : 'td-pos-normal'}">${index + 1}</td> 
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
    // ⚽ LÓGICA DE GOLEADORES POR CICLO
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
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#8fa3d9; padding:10px; font-size:10px;">Sin goles registrados.</td></tr>';
            return;
        }

        topGoleadores.forEach((j, i) => {
            tbody.innerHTML += `
                <tr class="row-normal">
                    <td style="color:#fff; text-align:center;">${i + 1}</td>
                    <td class="td-team-name">${j.nombre}</td>
                    <td style="font-size: 10px; color: #8fa3d9;">${j.equipo}</td>
                    <td style="font-weight: bold; color: #5ce1e6; text-align:center;">${j.goles}</td>
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
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>+/-</th><th style="color:#facc15;">PTS</th>`;
        } else if (criterioAnualActivo === 'gf') {
            pool.sort((a, b) => b.gf !== a.gf ? b.gf - a.gf : a.gc - b.gc);
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th style="color:#4ade80; font-weight:bold;">GF (A Favor)</th><th>GC</th><th>+/-</th><th>PTS</th>`;
        } else if (criterioAnualActivo === 'gc') {
            pool.sort((a, b) => a.gc !== b.gc ? a.gc - b.gc : b.gf - a.gf); // Menos GC primero
            thead.innerHTML = `<th>Pos</th><th>Equipo</th><th>PJ</th><th style="color:#38bdf8; font-weight:bold;">GC (En Contra)</th><th>GF</th><th>+/-</th><th>PTS</th>`;
        }

        tbody.innerHTML = '';
        pool.forEach((e, i) => {
            let metricasHTML = '';
            if (criterioAnualActivo === 'puntos') {
                metricasHTML = `<td>${e.pj}</td><td>${e.g}</td><td>${e.e}</td><td>${e.p}</td><td>${e.gf}</td><td>${e.gc}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td style="color:#facc15; font-weight:bold;">${e.pts}</td>`;
            } else if (criterioAnualActivo === 'gf') {
                metricasHTML = `<td>${e.pj}</td><td style="color:#4ade80; font-weight:bold;">${e.gf}</td><td>${e.gc}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td>${e.pts}</td>`;
            } else if (criterioAnualActivo === 'gc') {
                metricasHTML = `<td>${e.pj}</td><td style="color:#38bdf8; font-weight:bold;">${e.gc}</td><td>${e.gf}</td><td>${e.dif > 0 ? '+'+e.dif : e.dif}</td><td>${e.pts}</td>`;
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
        if (!fechaSeleccionada) {
            const ultimasFechas = ligaData.partidos.map(p => p.fecha);
            fechaSeleccionada = ultimasFechas.length > 0 ? Math.max(...ultimasFechas) : 1;
        }

        // 2. Buscamos el título principal del bloque en la Home/Fixture para ponerle la Fecha
        const tituloSeccion = document.querySelector('#pantalla-fixture h2');
        if (tituloSeccion) {
            tituloSeccion.innerHTML = `ULTIMOS PARTIDOS <span style="font-size: 13px; color: #5ce1e6; font-family: 'Audiowide'; display: block; margin-top: 10px;">— FECHA ${fechaSeleccionada} —</span>`;
        }

        const partidosFiltrados = ligaData.partidos.filter(partido => partido.fecha === fechaSeleccionada);

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = `<p style="color: #8fa3d9; font-size: 11px; text-align: center; padding: 18px;">No hay partidos cargados para la Fecha ${fechaSeleccionada}.</p>`;
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
                    <div style="font-family: 'Audiowide', sans-serif; font-size: 11px; color: #5ce1e6; margin: 18px 0 8px 0; text-align: center; border-bottom: 1px dashed #1e3a8a; padding-bottom: 4px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            if (partido.jugado) {
                contenedor.innerHTML += `
                    <div class="match-card">
                        <span class="team-name">${partido.local}</span>
                        <span class="score" style="color: #5ce1e6; font-weight: bold;">${partido.golesLocal} - ${partido.golesVisitante}</span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            } else {
                contenedor.innerHTML += `
                    <div class="match-card" style="border-left-color: #e11d48; border-right-color: #e11d48;">
                        <span class="team-name">${partido.local}</span>
                        <span class="score" style="color: #f43f5e; font-size: 13px;">VS<br>
                            <span style="font-size: 10px; color: #8fa3d9; display:block; margin-top:2px;">${partido.horario}</span>
                            <span style="font-size: 9px; color: #5ce1e6; display:block; font-family:'Audiowide',sans-serif; margin-top:1px;">${partido.cancha || 'Cancha 1'}</span>
                        </span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            }
        });
    }



    /*// 4. RENDERIZADO DE PARTIDOS
    function renderizarResultados(fechaSeleccionada) {
        const partidosDinamicos = localStorage.getItem('liga_partidos');
        if (partidosDinamicos) ligaData.partidos = JSON.parse(partidosDinamicos);

        const contenedor = document.querySelector('.resultados-lista');
        if (!contenedor) return; 

        contenedor.innerHTML = ''; 
        const partidosFiltrados = ligaData.partidos.filter(partido => partido.fecha === fechaSeleccionada);

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = `<p style="color: #8fa3d9; font-size: 11px; text-align: center; padding: 18px;">No hay partidos programados para esta fecha.</p>`;
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
                    <div style="font-family: 'Audiowide', sans-serif; font-size: 11px; color: #5ce1e6; margin: 20px 0 10px 0; text-align: center; border-bottom: 1px dashed #1e3a8a; padding-bottom: 5px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            if (partido.jugado) {
                contenedor.innerHTML += `
                    <div class="match-card">
                        <span class="team-name">${partido.local}</span>
                        <span class="score">${partido.golesLocal} - ${partido.golesVisitante}</span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            } else {
                contenedor.innerHTML += `
                    <div class="match-card" style="border-left-color: #e11d48; border-right-color: #e11d48;">
                        <span class="team-name">${partido.local}</span>
                        <span class="score" style="color: #f43f5e; font-size: 14px;">VS<br>
                            <span style="font-size: 10px; color: #8fa3d9; display:block; margin-top:2px;">${partido.horario}</span>
                            <span style="font-size: 9px; color: #5ce1e6; display:block; font-family:'Audiowide',sans-serif; margin-top:1px;">${partido.cancha || 'Cancha 1'}</span>
                        </span>
                        <span class="team-name">${partido.visitante}</span>
                    </div>
                `;
            }
        });
    } 
        */

    // EVENTOS DE NAVEGACIÓN Y BOTONES
    const botonesFecha = document.querySelectorAll('.tabs-fechas .tab-btn');
    botonesFecha.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesFecha.forEach(b => b.classList.remove('active'));
            boton.classList.add('active');
            renderizarResultados(parseInt(boton.getAttribute('data-fecha')));
        });
    });

    const botonesSup = document.querySelectorAll('.tabs-sup .tab-btn');
    botonesSup.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesSup.forEach(b => b.classList.remove('active'));
            boton.classList.add('active');
            const grupo = boton.getAttribute('data-grupo');
            renderizarTabla(ligaData.cicloSuperior, '.tbody-sup', '.group-name-sup', grupo, grupo);
        });
    });

    const botonesBas = document.querySelectorAll('.tabs-bas .tab-btn');
    botonesBas.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesBas.forEach(b => b.classList.remove('active'));
            boton.classList.add('active');
            const grupo = boton.getAttribute('data-grupo-bas');
            renderizarTabla(ligaData.cicloBasico, '.tbody-bas', '.group-name-bas', grupo, grupo);
        });
    });

    procesarLiga(); 
    renderizarTabla(ligaData.cicloSuperior, '.tbody-sup', '.group-name-sup', 'A', 'A'); 
    renderizarTabla(ligaData.cicloBasico, '.tbody-bas', '.group-name-bas', 'A', 'A');   
    // Reemplazá la línea "renderizarResultados(1);" por estas líneas:
    const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || [];
    const ultimasFechas = partidosDinamicos.map(p => p.fecha);
    const ultimaFechaActiva = ultimasFechas.length > 0 ? Math.max(...ultimasFechas) : 1;
    
    renderizarGoleadores()

    // Carga automáticamente la última fecha jugada/activa
    renderizarResultados(ultimaFechaActiva);
    // Inicializamos la tabla anual al cargar
    renderizarTablaAnual();

    // ============================================================
    // 🚀 LÓGICA DE NAVEGACIÓN SPA (APAGADO DE PANTALLAS COMPLETO)
    // ============================================================
    // ============================================================
    // 🚀 NAVEGACIÓN SPA REPARADA (SIN APAGAR HERO NI SPONSORS)
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
            document.getElementById('pantalla-admin')
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
        
        // Encendemos los 3 bloques principales de la Home
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
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const targetId = item.getAttribute('href');
            
            if (targetId === '#home') {
        mostrarPantallaInicio();
        
        // 🟢 Forzamos a que la cajita lateral de la Home se vuelva a dibujar con la última fecha
        const partidosDinamicos = JSON.parse(localStorage.getItem('liga_partidos')) || [];
        const ultimasFechas = partidosDinamicos.map(p => p.fecha);
        const ultimaFecha = ultimasFechas.length > 0 ? Math.max(...ultimasFechas) : 1;
        renderizarResultados(ultimaFecha);
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

    // 🚀 ESTADO INICIAL AL CARGAR LA PÁGINA:
    mostrarPantallaInicio();

    

    // SCROLL Y BUSCADOR
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) document.body.classList.add('scrolled');
        else document.body.classList.remove('scrolled');
    }, { passive: true });

    // ============================================================
    // 🎠 CARRUSEL DE SPONSORS
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
                    btnToggleSponsor.style.borderColor = 'rgba(92, 225, 230, 0.4)';
                    btnToggleSponsor.style.color       = '#8fa3d9';
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
                    btn.style.background = '#5ce1e6';
                    btn.style.color = '#051030';
                    if (window.sponsorInterval) clearInterval(window.sponsorInterval);
                } else {
                    btn.textContent = 'Ver Beneficio';
                    btn.style.background = 'rgba(92, 225, 230, 0.1)';
                    btn.style.color = '#5ce1e6';
                }
            }
        });
    });

    // ============================================================
    // 📰 LÓGICA DEL HERO EN 3D
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
    // 🔎 LÓGICA DEL MODAL DE NOTICIAS (Ampliar Foto)
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

                // 🔗 RENDERIZADO DEL BOTÓN DINÁMICO
                if (linkContainer) {
                    linkContainer.innerHTML = ''; // Limpiamos anteriores
                    
                    if (actionBtn) {
                        const href = actionBtn.getAttribute('href');
                        const text = actionBtn.getAttribute('data-link-text') || 'VER MÁS ➔';
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
    // ⚡ INTERCEPTOR DE LINKS INLINE
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
    // 📜 LÓGICA DE DESPLIEGUE DEL REGLAMENTO (ACORDEÓN)
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
    // 📰 DIBUJAR NOTICIAS DINÁMICAS DESDE LA MEMORIA EN EL HERO
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
    // ⚖️ TRIBUNAL DE DISCIPLINA DESPLEGABLE
    // ============================================================
    const btnToggleTribunal = document.getElementById('btn-toggle-tribunal');
    const panelTribunal = document.getElementById('panel-tribunal-desplegable');
    const btnCerrarTribunal = document.getElementById('close-panel-tribunal');
    const contFechasTribunal = document.getElementById('selector-fechas-tribunal');
    const contDetalleActa = document.getElementById('contenido-acta-detalle');

    function cargarTribunalPublico() {
        const sanciones = JSON.parse(localStorage.getItem('liga_sanciones')) || [];

        if (!contFechasTribunal || !contDetalleActa) return;

        if (sanciones.length === 0) {
            contFechasTribunal.innerHTML = '';
            contDetalleActa.innerHTML = '<p style="color:#8fa3d9; font-size:12px; text-align:center; padding:15px;">No hay actas ni sanciones disciplinarias registradas.</p>';
            return;
        }

        const actasDisponibles = [...new Set(sanciones.map(s => s.acta || 1))].sort((a, b) => a - b);

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
        const sancionesActa = sanciones.filter(s => (s.acta || 1).toString() === numActa.toString());

        if (sancionesActa.length === 0) {
            contDetalleActa.innerHTML = `<p style="color:#8fa3d9; font-size:11px;">No hay resoluciones para el Acta N° ${numActa}.</p>`;
            return;
        }

        contDetalleActa.innerHTML = `
            <div style="font-family:'Audiowide', sans-serif; font-size:11px; color:#f43f5e; margin-bottom:12px; text-transform:uppercase; border-bottom:1px solid rgba(244,63,94,0.2); padding-bottom:4px;">
                ⚡ RESOLUCIONES OFICIALES — ACTA N° ${numActa}
            </div>
        `;

        sancionesActa.forEach(s => {
            const jugadorTexto = s.jugador ? ` — 👤 ${s.jugador}` : '';
            const sancionPts = s.puntosRestados > 0 ? `<span style="color:#f43f5e; font-weight:bold;">(-${s.puntosRestados} PTS)</span>` : '';

            contDetalleActa.innerHTML += `
                <div style="background: rgba(255,255,255,0.03); border-left: 4px solid #f43f5e; padding: 10px; margin-bottom: 8px; border-radius: 6px; text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:white; font-weight:bold;">${s.equipo}${jugadorTexto}</span>
                        <span style="font-size:10px; color:#fca5a5; font-weight:bold;">${s.tipo} ${sancionPts}</span>
                    </div>
                    <p style="color:#cbd5e1; font-size:11px; margin: 5px 0 0 0;">💬 <em>"${s.motivo || 'Sin motivo especificado'}"</em></p>
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
    // 🔀 ANIMACIÓN DE DESPLAZAMIENTO PROPORCIONAL DE TÍTULOS
    // ============================================================
    const toggleTablas = document.getElementById('toggle-titulo-tablas');
    const togglePlayoffs = document.getElementById('toggle-titulo-playoffs');
    const vistaGrupos = document.getElementById('vista-fase-grupos');
    const vistaPlayoffs = document.getElementById('vista-playoffs');

    function moverTitulos(esPlayoffs) {
        if (!toggleTablas || !togglePlayoffs) return;

        const gap = 20; // Espacio entre textos en CSS

        if (esPlayoffs) {
            // Evaluamos si es pantalla chica (móvil/tablet <= 768px)
            const esMovil = window.innerWidth <= 768;
            
            // Si es móvil usamos un desplazamiento adaptado (-180px), si es PC tu valor preferido (-290px)
            const posXPlayoffs = esMovil ? '-192px' : '-290px';
            const posXTablas = esMovil ? '105px' : '150px';

            // 1. PLAY-OFFS se desplaza a la izquierda
            togglePlayoffs.style.transform = `translateX(${posXPlayoffs}) scale(1.05)`;
            togglePlayoffs.classList.add('active');
            togglePlayoffs.classList.remove('opaco');

            // 2. TABLA DE POSICIONES se desplaza a la derecha
            toggleTablas.style.transform = `translateX(${posXTablas}) scale(0.9)`;
            toggleTablas.classList.remove('active');
            toggleTablas.classList.add('opaco');

            if (vistaGrupos) vistaGrupos.classList.add('seccion-oculta');
            if (vistaPlayoffs) vistaPlayoffs.classList.remove('seccion-oculta');
        } else {
            // Ambos regresan suavemente a sus posiciones base
            toggleTablas.style.transform = 'translateX(0px) scale(1)';
            toggleTablas.classList.add('active');
            toggleTablas.classList.remove('opaco');

            togglePlayoffs.style.transform = 'translateX(0px) scale(0.9)';
            togglePlayoffs.classList.remove('active');
            togglePlayoffs.classList.add('opaco');

            if (vistaGrupos) vistaGrupos.classList.remove('seccion-oculta');
            if (vistaPlayoffs) vistaPlayoffs.classList.add('seccion-oculta');

            



        }
    }
    // Escuchador para cambiar de ciclo en Playoffs
    document.querySelectorAll('.btn-playoff-ciclo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-playoff-ciclo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cicloElegido = btn.getAttribute('data-ciclo-playoff');
            // Acá podés cargar los partidos de playoffs correspondientes a cada ciclo
        });
    });

    if (toggleTablas && togglePlayoffs) {
        toggleTablas.addEventListener('click', () => moverTitulos(false));
        togglePlayoffs.addEventListener('click', () => moverTitulos(true));
    }

    
    // ============================================================
    // 🎯 AUTO-SCROLL HORIZONTAL DE RONDAS (OCTAVOS | CUARTOS | SEMIS | FINAL)
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
    // 🖱️ LÓGICA DE DRAG & SCROLL PARA COMPUTADORAS (GRAB & DRAG)
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
    // ⚽ LÓGICA DE LA PANTALLA COMPLETA DE PARTIDOS
    // ============================================================
    const botonesFechaFixture = document.querySelectorAll('.btn-fecha-select');
    // ============================================================
    // ⚽ FIXTURE CON GRILLA Y LÍNEA DIVISORIA VERTICAL
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
            contenedor.innerHTML = `<p style="color: #8fa3d9; font-size: 11px; text-align: center; padding: 25px;">No hay partidos cargados para la Fecha ${numeroFecha}.</p>`;
            return;
        }

        partidosFiltrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });

        let ultimoSeparador = "";

        partidosFiltrados.forEach((partido, index) => {
            const grupoActual = partido.grupo || 'A';
            const infoSeparador = `${partido.ciclo === 'superior' ? 'Superior' : 'Básico'} — Grupo ${grupoActual}`;

            if (infoSeparador !== ultimoSeparador) {
                contenedor.innerHTML += `
                    <div style="font-family: 'Audiowide', sans-serif; font-size: 11px; color: #5ce1e6; margin: 20px 0 10px 0; text-align: center; border-bottom: 1px dashed #1e3a8a; padding-bottom: 5px; text-transform: uppercase;">
                         ${infoSeparador}
                    </div>
                `;
                ultimoSeparador = infoSeparador;
            }

            const esJugado = partido.jugado;
            const horarioTxt = partido.horario || '16:00';
            const canchaTxt = partido.cancha || 'Cancha 1';

            // Goles y Tarjetas Local
            let htmlLocal = '';
            if (partido.goleadoresLocal && partido.goleadoresLocal.length > 0) {
                htmlLocal += partido.goleadoresLocal.map(g => `<div>⚽ ${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
            }
            if (partido.tarjetasLocal && partido.tarjetasLocal.length > 0) {
                htmlLocal += partido.tarjetasLocal.map(t => `<div>🟨 ${t.nombre}</div>`).join('');
            }
            if (!htmlLocal && esJugado) htmlLocal = '<div style="opacity: 0.4;">Sin incidencias</div>';

            // Goles y Tarjetas Visitante
            let htmlVisita = '';
            if (partido.goleadoresVisitante && partido.goleadoresVisitante.length > 0) {
                htmlVisita += partido.goleadoresVisitante.map(g => `<div>⚽ ${g.nombre} ${g.cantidad > 1 ? `(${g.cantidad})` : ''}</div>`).join('');
            }
            if (partido.tarjetasVisitante && partido.tarjetasVisitante.length > 0) {
                htmlVisita += partido.tarjetasVisitante.map(t => `<div>🟨 ${t.nombre}</div>`).join('');
            }
            if (!htmlVisita && esJugado) htmlVisita = '<div style="opacity: 0.4;">Sin incidencias</div>';

            const mvpTxt = partido.mvp ? `🌟 <strong>MVP:</strong> ${partido.mvp}` : '';

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
                            <div class="match-meta-info">
                                📍 ${canchaTxt} | ⏰ ${horarioTxt}
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
                            <div style="text-align: center; color: #8fa3d9; font-size: 11px; font-family: Audiowide; padding: 5px 0;">
                                ⏳ Partido programado. Presentar DNI en mesa de control 15 min antes.
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

    // 🟢 Escuchador exclusivo para los botones de fecha en la pantalla de Partidos
    document.querySelectorAll('.btn-fecha-select').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-fecha-select').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fechaActivaFixture = parseInt(btn.getAttribute('data-fecha'));
            
            // Renderizamos SOLO el contenedor de la pantalla de Partidos
            renderizarFixtureFecha(fechaActivaFixture);
        });
    });

    // Escuchadores de botones de Fecha (F1, F2...)
    botonesFechaFixture.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesFechaFixture.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fechaActivaFixture = parseInt(btn.getAttribute('data-fecha'));
            renderizarFixtureFecha(fechaActivaFixture);
        });
    });

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
    // 🔎 LÓGICA DEL BUSCADOR GLOBAL INTELIGENTE
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
                    <div style="padding: 12px; text-align: center; color: #8fa3d9; font-size: 11px; font-family: Audiowide;">
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
                item.innerHTML = `
                    <div class="search-item-header">
                        <span class="search-item-name">🛡️ ${eq.nombre}</span>
                        <span class="search-item-badge">${eq.ciclo} - Grupo ${eq.grupo || 'A'}</span>
                    </div>
                    <div class="search-item-actions">
                        <button class="search-action-btn btn-ir-tabla" data-equipo="${eq.nombre}">📊 Posiciones</button>
                        <button class="search-action-btn btn-ir-partidos" data-equipo="${eq.nombre}">⚽ Partidos</button>
                    </div>
                `;
                searchDropdown.appendChild(item);
            });

            searchDropdown.classList.remove('seccion-oculta');

            // 🟢 ACCIÓN 1: IR A LA TABLA DE SU GRUPO Y RESALTAR LA FILA EXACTA
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
                        if (esSuperior) {
                            const btnGrupo = document.querySelector(`.tabs-sup .tab-btn[data-grupo="${grupoTarget}"]`);
                            if (btnGrupo) btnGrupo.click();
                        } else {
                            const btnGrupo = document.querySelector(`.tabs-bas .tab-btn[data-grupo-bas="${grupoTarget}"]`);
                            if (btnGrupo) btnGrupo.click();
                        }

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

            // 🟢 ACCIÓN 2: IR A PARTIDOS Y FILTRAR
            // 🟢 ACCIÓN 2: IR A PARTIDOS, DETECTAR ÚLTIMA FECHA Y RESALTAR CARD
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
                        alert(`🛡️ El equipo ${nombreEquipo} todavía no tiene partidos registrados.`);
                        return;
                    }

                    // 4. Calculamos cuál es la fecha más reciente de su fixture
                    const ultimaFecha = Math.max(...partidosDelEquipo.map(p => p.fecha));

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

        









    // Inicializamos con la Fecha 1 al cargar
    renderizarFixtureFecha(1);

















});