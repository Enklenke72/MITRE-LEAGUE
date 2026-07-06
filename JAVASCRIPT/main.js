document.addEventListener('DOMContentLoaded', () => {

    // 1. ALGORITMO DE ORDENAMIENTO (De mayor a menor)
    function ordenarTabla(equipos) {
        return [...equipos].sort((a, b) => { // [...equipos] Es crear un clon del array "equipos"
            if (b.pts !== a.pts) return b.pts - a.pts; // 1° Prioridad: Puntos
            if (b.dif !== a.dif) return b.dif - a.dif; // 2° Prioridad: Diferencia de gol
            return b.gf - a.gf;                        // 3° Prioridad: Goles a favor
        });
    }

    // 2. EL CEREBRO MATEMÁTICO (Procesa las planillas de partidos y aplica sanciones)
    function procesarLiga() {
        // Traemos los partidos dinámicos del localStorage si existen
        const partidosDinamicos = localStorage.getItem('liga_partidos'); //Busca partidos en el localStorage
        if (partidosDinamicos) { //Si existen patidos, el if pasa a valer true
            ligaData.partidos = JSON.parse(partidosDinamicos); //Si el if vale trrue, pasa a código JS lo obtenido 
        }

        // Traemos las sanciones dinámicas del localStorage si existen
        const sancionesDinamicas = localStorage.getItem('liga_sanciones');
        if (sancionesDinamicas) {
            ligaData.sanciones = JSON.parse(sancionesDinamicas);
        }

        // Primero nos aseguramos de resetear todo a 0 por seguridad al recargar
        const resetearContadores = (ciclo) => {
            ciclo.forEach(e => {
                e.pj = 0; e.g = 0; e.e = 0; e.p = 0; e.gf = 0; e.gc = 0; e.dif = 0; e.pts = 0;
            });
        };
        resetearContadores(ligaData.cicloSuperior);
        resetearContadores(ligaData.cicloBasico);

        // Recorremos la lista de partidos cargados
        ligaData.partidos.forEach(partido => {
            if (!partido.jugado) return; // Si no se jugó, lo saltea

            // Buscamos en qué ciclo se jugó este partido
            let poolEquipos = partido.ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
            
            // Buscamos coincidencia exacta por nombre
            let local = poolEquipos.find(e => e.nombre.trim() === partido.local.trim());
            let visitante = poolEquipos.find(e => e.nombre.trim() === partido.visitante.trim());

            // Si encuentra ambos, procesa las estadísticas
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

        // Una vez sumados los puntos de los partidos, restamos las penalizaciones del Tribunal
        ligaData.sanciones.forEach(sancion => {
            let pool = sancion.ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
            let equipoSancionado = pool.find(e => e.nombre.trim() === sancion.equipo.trim());
            
            if (equipoSancionado) {
                equipoSancionado.pts -= sancion.puntosRestados;
            }
        });
    }

    // 3. LA FUNCIÓN QUE DIBUJA LA TABLA EN EL HTML (Corregida con tus variables)
    function renderizarTabla(dataArray, tbodySelector, tituloSelector, grupoId, nombreGrupo) {
        const tbody = document.querySelector(tbodySelector);
        const titulo = document.querySelector(tituloSelector);

        if (!tbody || !titulo) return;

        tbody.innerHTML = ''; 
        titulo.textContent = `Grupo ${nombreGrupo}`;

        // Pasamos el colador (filter) y al resultado lo ordenamos antes del loop (sort)
        const equiposFiltrados = ordenarTabla(dataArray.filter(equipo => equipo.grupo === grupoId));

        equiposFiltrados.forEach((equipo, index) => {
            // A. Si está en el top 2 usa la clase row-leader (borde azul), sino fila común
            const claseFila = (index < 2) ? 'row-leader' : 'row-normal';

            // B. Evaluamos los colores de la diferencia de gol (+ verde, - rojo)
            let colorDiffStyle = '';
            if (equipo.dif > 0) {
                colorDiffStyle = 'style="color: #4ade80 !important;"'; // Verde
            } else if (equipo.dif < 0) {
                colorDiffStyle = 'style="color: #f43f5e !important;"'; // Rojo
            }

            // C. Armamos el texto agregando el signo "+" si es mayor a cero
            const diffTexto = equipo.dif > 0 ? '+' + equipo.dif : equipo.dif;

            tbody.innerHTML += `
                <tr class="${claseFila}">
                    <td class="${index < 2 ? 'td-pos-lead' : 'td-pos-normal'}">${index + 1}</td> 
                    <td class="td-team-name">${equipo.nombre}</td>
                    <td>${equipo.pj}</td>
                    <td>${equipo.g}</td>
                    <td>${equipo.e}</td>
                    <td>${equipo.p}</td>
                    <td class="td-diff-positive" ${colorDiffStyle}>${diffTexto}</td>
                    <td class="td-pts-total">${equipo.pts}</td>
                </tr>
            `;
        });
    }

    /*// 3. LA FUNCIÓN QUE DIBUJA LA TABLA EN EL HTML (Actualizada con Clasificación y Colores)
    function renderizarTabla(dataArray, tbodySelector, tituloSelector, grupoId, nombreGrupo) {
        const tbody = document.querySelector(tbodySelector);
        const titulo = document.querySelector(tituloSelector);

        if (!tbody || !titulo) return;

        tbody.innerHTML = ''; 
        titulo.textContent = `Grupo ${nombreGrupo}`;

        // Pasamos el colador (filter) y al resultado lo ordenamos antes del loop (sort)
        const equiposFiltrados = ordenarTabla(dataArray.filter(equipo => equipo.grupo === grupoId));

        equiposFiltrados.forEach((equipo, index) => {
            // A. Determinamos si entra en zona de clasificación (Top 2)
            const esClasificado = (index < 2) ? 'row-leader-classified' : 'row-normal';

            // B. Evaluamos el color de la diferencia de gol (+ verde, - rojo, 0 neutro)
            let claseDiff = 'diff-neutral';
            if (equipo.dif > 0) {
                claseDiff = 'diff-positive';
            } else if (equipo.dif < 0) {
                claseDiff = 'diff-negative';
            }

            // C. Armamos el texto de la diferencia con el "+" si corresponde
            const diffTexto = equipo.dif > 0 ? '+' + equipo.dif : equipo.dif;

            tbody.innerHTML += `
                <tr class="${esClasificado}">
                    <td class="td-pos-cell">${index + 1}</td> 
                    <td class="td-team-name">${equipo.nombre}</td>
                    <td>${equipo.pj}</td>
                    <td>${equipo.g}</td>
                    <td>${equipo.e}</td>
                    <td>${equipo.p}</td>
                    <td class="${claseDiff}">${diffTexto}</td>
                    <td class="td-pts-total">${equipo.pts}</td>
                </tr>
            `;
        });
    }
 */















    // 4. RENDERIZADO DINÁMICO DE RESULTADOS RECIENTES (Agrupado por Grupos)
    function renderizarResultados(fechaSeleccionada) {
        // Actualizamos la lista de partidos con la memoria antes de filtrar
        const partidosDinamicos = localStorage.getItem('liga_partidos');
        if (partidosDinamicos) {
            ligaData.partidos = JSON.parse(partidosDinamicos);
        }

        const contenedor = document.querySelector('.resultados-lista');
        if (!contenedor) return; // Escudo de seguridad

        contenedor.innerHTML = ''; // Limpiamos

        // Filtramos los partidos de la fecha elegida
        const partidosFiltrados = ligaData.partidos.filter(partido => partido.fecha === fechaSeleccionada);

        if (partidosFiltrados.length === 0) {
            contenedor.innerHTML = `<p style="color: #8fa3d9; font-size: 11px; text-align: center; padding: 18px;">No hay partidos programados para esta fecha.</p>`;
            return;
        }
// ORDENAMOS los partidos de la fecha: Ahora Superior va a ir PRIMERO
        partidosFiltrados.sort((a, b) => {
            // Invertimos el orden (b frente a a) para que 'superior' le gane alfabéticamente a 'básico'
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            return (a.grupo || 'A').localeCompare(b.grupo || 'A');
        });
        let ultimoSeparador = "";

        // Recorremos y dibujamos
        partidosFiltrados.forEach(partido => {
            const grupoActual = partido.grupo || 'A';
            const infoSeparador = `${partido.ciclo === 'superior' ? 'Superior' : 'Básico'} - Grupo ${grupoActual}`;

            // Si cambia el ciclo o el grupo, clavamos un título divisorio estético
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


    // --- LÓGICA DE FILTRO DE FECHAS ---
    const botonesFecha = document.querySelectorAll('.tabs-fechas .tab-btn');
    botonesFecha.forEach(boton => {
        boton.addEventListener('click', () => {
            // Apagamos la luz de todos los botones de fecha
            botonesFecha.forEach(b => b.classList.remove('active'));
            // Encendemos el botón cliqueado
            boton.classList.add('active');
            
            // Leemos el número de fecha del atributo HTML y lo convertimos a número entero
            const fecha = parseInt(boton.getAttribute('data-fecha'));
            // Llamamos a la función pasándole la fecha elegida
            renderizarResultados(fecha);
        });
    });



    // --- MANEJO DE EVENTOS DE LAS TABS (Hacer clic en los botones) ---
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

   // --- INICIALIZACIÓN DEL SISTEMA AL CARGAR LA PÁGINA ---
    procesarLiga(); 
    renderizarTabla(ligaData.cicloSuperior, '.tbody-sup', '.group-name-sup', 'A', 'A'); 
    renderizarTabla(ligaData.cicloBasico, '.tbody-bas', '.group-name-bas', 'A', 'A');   
    renderizarResultados(1); // 👈 CAMBIADO: Ahora le pasamos el '1' para que arranque en la Fecha 1
});