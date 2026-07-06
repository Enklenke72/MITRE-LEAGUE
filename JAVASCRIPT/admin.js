document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-partido');
    const submitBtn = form.querySelector('button[type="submit"]');
    const cicloSelect = document.getElementById('partido-ciclo');
    const grupoSelect = document.getElementById('partido-grupo-select');
    const localSelect = document.getElementById('partido-local');
    const visitanteSelect = document.getElementById('partido-visitante');
    
    let idPartidoEnEdicion = null;
    let fechaFiltroActiva = "todas"; // Controla qué fecha se muestra en el admin

    // --- CARGAR PARTIDOS EXISTENTES DE LA MEMORIA ---
    let partidos = JSON.parse(localStorage.getItem('liga_partidos')) || [];

    // Si la memoria está completamente vacía (primera vez), cargamos los de data.js por defecto
    if (partidos.length === 0 && typeof ligaData !== 'undefined') {
        partidos = ligaData.partidos || [];
        localStorage.setItem('liga_partidos', JSON.stringify(partidos));
    }

    // --- LÓGICA DE SELECTORES DINÁMICOS DE EQUIPOS ---
    function filtrarEquiposPorGrupo() {
        if (typeof ligaData === 'undefined') return;

        const ciclo = cicloSelect.value;
        const grupo = grupoSelect.value;
        const pool = ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
        const filtrados = pool.filter(e => e.grupo === grupo);

        localSelect.innerHTML = '';
        if (visitanteSelect) visitanteSelect.innerHTML = '';

        if(filtrados.length === 0) {
            localSelect.innerHTML = '<option value="">Sin equipos</option>';
            if (visitanteSelect) visitanteSelect.innerHTML = '<option value="">Sin equipos</option>';
            return;
        }

        filtrados.forEach(e => {
            localSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
            if (visitanteSelect) visitanteSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
        });

        if (visitanteSelect && visitanteSelect.options.length > 1) visitanteSelect.selectedIndex = 1;
    }

    function actualizarOpcionesGrupo() {
        const ciclo = cicloSelect.value;
        const grupoActualAnterior = grupoSelect.value;
        grupoSelect.innerHTML = '';

        const grupos = ciclo === 'superior' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B'];
        grupos.forEach(g => {
            grupoSelect.innerHTML += `<option value="${g}">Grupo ${g}</option>`;
        });

        if(grupos.includes(grupoActualAnterior)) {
            grupoSelect.value = grupoActualAnterior;
        }
        filtrarEquiposPorGrupo();
    }

    cicloSelect.addEventListener('change', actualizarOpcionesGrupo);
    grupoSelect.addEventListener('change', filtrarEquiposPorGrupo);

    // --- FUNCIÓN PARA DIBUJAR LA LISTA DE PARTIDOS ---
    function actualizarListaAdmin() {
        const contenedor = document.getElementById('lista-partidos-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (partidos.length === 0) {
            contenedor.innerHTML = '<p style="color:#8fa3d9; text-align:center; font-size:12px;">No hay partidos registrados.</p>';
            return;
        }

        // 1. Aplicamos el filtro dinámico por fecha seleccionada
        const partidosMostrados = fechaFiltroActiva === "todas" 
            ? [...partidos] 
            : partidos.filter(p => p.fecha === parseInt(fechaFiltroActiva));

        if (partidosMostrados.length === 0) {
            contenedor.innerHTML = `<p style="color:#8fa3d9; text-align:center; font-size:11px; padding: 15px;">No hay partidos programados para la Fecha ${fechaFiltroActiva}.</p>`;
            return;
        }

        // 2. ORDENAMOS para que se agrupen por Ciclo (Superior primero) y luego por Grupo (A, B, C...)
        partidosMostrados.sort((a, b) => {
            if (a.ciclo !== b.ciclo) return b.ciclo.localeCompare(a.ciclo);
            const grupoA = a.grupo || 'A';
            const groupB = b.grupo || 'A';
            if (grupoA !== groupB) return grupoA.localeCompare(groupB);
            return a.id - b.id;
        });

        // 3. Dibujamos las tarjetas metiendo separadores estéticos por grupo
        let ultimoSeparador = "";

        partidosMostrados.forEach(p => {
            const marcador = p.jugado ? `${p.golesLocal} - ${p.golesVisitante}` : 'VS';
            const grupoP = p.grupo || 'A';
            const cicloFormateado = p.ciclo === 'superior' ? 'Superior' : 'Básico';
            
            const separadorActual = `${cicloFormateado} - Grupo ${grupoP}`;

            if (separadorActual !== ultimoSeparador) {
                ultimoSeparador = separadorActual;
                contenedor.innerHTML += `
                    <div style="width:100%; text-align:left; margin: 15px 0 8px 0; padding-bottom:3px; border-bottom: 1px dashed rgba(92, 225, 230, 0.2);">
                        <span style="font-family:'Audiowide', sans-serif; font-size:11px; color:#5ce1e6; text-transform:uppercase;">⚡ ${separadorActual}</span>
                    </div>
                `;
            }

            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(255,255,255,0.03); padding:10px; margin-bottom:8px; border-radius:8px; border-left: 4px solid ${p.jugado ? '#3b82f6' : '#e11d48'};">
                    <div style="text-align:left;">
                        <span style="font-size:10px; color:#8fa3d9; display:block;">F${p.fecha} — ${p.horario} — ${p.cancha || 'Cancha 1'}</span>
                        <span style="font-size:13px; color:white;">${p.local} <strong style="color:#5ce1e6;">${marcador}</strong> ${p.visitante}</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-editar" data-id="${p.id}" style="background-color:#1e3a8a; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">✏️</button>
                        <button class="btn-borrar" data-id="${p.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌</button>
                    </div>
                </div>
            `;
        });

        // 4. ESCUCHADORES DE ACCIONES (Botones de cada tarjeta)
        document.querySelectorAll('.btn-borrar').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                partidos = partidos.filter(p => p.id !== idBorrar);
                localStorage.setItem('liga_partidos', JSON.stringify(partidos));
                if (idPartidoEnEdicion === idBorrar) cancelarEdicion();
                actualizarListaAdmin();
            });
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const idEditar = parseInt(btn.getAttribute('data-id'));
                const p = partidos.find(part => part.id === idEditar);
                
                if (p) {
                    idPartidoEnEdicion = p.id;
                    document.getElementById('partido-fecha').value = p.fecha;
                    cicloSelect.value = p.ciclo;
                    actualizarOpcionesGrupo();
                    grupoSelect.value = p.grupo || 'A';
                    filtrarEquiposPorGrupo();

                    localSelect.value = p.local;
                    if (visitanteSelect) visitanteSelect.value = p.visitante;
                    document.getElementById('goles-local').value = p.golesLocal !== null ? p.golesLocal : '';
                    document.getElementById('goles-visitante').value = p.golesVisitante !== null ? p.golesVisitante : '';
                    document.getElementById('partido-horario').value = p.horario;
                    if(document.getElementById('partido-cancha')) {
                        document.getElementById('partido-cancha').value = p.cancha || "Cancha 1";
                    }

                    submitBtn.textContent = '⚠️ Actualizar Partido';
                    submitBtn.style.backgroundColor = '#d97706';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function cancelarEdicion() {
        // 1. Guardamos en la memoria lo que el usuario ya tenía seleccionado
        const fechaActual = document.getElementById('partido-fecha').value;
        const cicloActual = cicloSelect.value;
        const grupoActual = grupoSelect.value;

        idPartidoEnEdicion = null;
        
        // 2. Reseteamos el formulario (esto limpia goles e inputs)
        form.reset();
        
        // 3. Volvemos a congelar los selectores con lo que guardamos en el paso 1
        document.getElementById('partido-fecha').value = fechaActual;
        cicloSelect.value = cicloActual;
        actualizarOpcionesGrupo(); // Esto refresca los grupos según el ciclo
        grupoSelect.value = grupoActual;
        filtrarEquiposPorGrupo(); // Esto refresca los equipos según el grupo

        // 4. Valores por defecto para el horario y la cancha
        document.getElementById('partido-horario').value = "14:20";
        if(document.getElementById('partido-cancha')) {
            document.getElementById('partido-cancha').value = "Cancha 1";
        }
        
        submitBtn.textContent = '💾 Guardar Resultado';
        submitBtn.style.backgroundColor = '';
    }

    // --- FORMULARIO SUBMIT (GUARDAR / ACTUALIZAR) ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const localInput = localSelect.value;
        const visitanteInput = visitanteSelect ? visitanteSelect.value : "";
        const golesLocalInput = document.getElementById('goles-local').value;
        const golesVisitanteInput = document.getElementById('goles-visitante').value;
        
        if (localInput === visitanteInput) {
            alert('❌ ¡Un equipo no puede jugar contra sí mismo!');
            return;
        }

        const esJugado = golesLocalInput !== "" && golesVisitanteInput !== "";
        const canchaForm = document.getElementById('partido-cancha') ? document.getElementById('partido-cancha').value : "Cancha 1";

        if (idPartidoEnEdicion !== null) {
            partidos = partidos.map(p => {
                if (p.id === idPartidoEnEdicion) {
                    return {
                        ...p,
                        fecha: parseInt(document.getElementById('partido-fecha').value),
                        ciclo: cicloSelect.value,
                        grupo: grupoSelect.value,
                        local: localInput,
                        visitante: visitanteInput,
                        golesLocal: esJugado ? parseInt(golesLocalInput) : null,
                        golesVisitante: esJugado ? parseInt(golesVisitanteInput) : null,
                        horario: document.getElementById('partido-horario').value || "14:20",
                        cancha: canchaForm,
                        jugado: esJugado,
                        dia: esJugado ? "24/06/2026" : "Próximamente"
                    };
                }
                return p;
            });
            alert('¡Partido actualizado correctamente!');
        } else {
            const nuevoPartido = {
                id: Date.now(),
                fecha: parseInt(document.getElementById('partido-fecha').value),
                dia: esJugado ? "24/06/2026" : "Próximamente",
                horario: document.getElementById('partido-horario').value || "14:20",
                cancha: canchaForm,
                grupo: grupoSelect.value,
                local: localInput,
                visitante: visitanteInput,
                golesLocal: esJugado ? parseInt(golesLocalInput) : null,
                golesVisitante: esJugado ? parseInt(golesVisitanteInput) : null,
                ciclo: cicloSelect.value,
                jugado: esJugado
            };
            partidos.push(nuevoPartido);
            alert(esJugado ? '¡Resultado guardado correctamente!' : '¡Próximo partido programado!');
        }

        localStorage.setItem('liga_partidos', JSON.stringify(partidos));
        cancelarEdicion();
        actualizarListaAdmin();
    });

    // --- ESCUCHADOR DE FILTROS POR FECHA ---
    const botonesFiltroAdmin = document.querySelectorAll('.tab-btn-admin');
    botonesFiltroAdmin.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesFiltroAdmin.forEach(b => {
                b.style.backgroundColor = '#051030';
                b.style.color = '#8fa3d9';
                b.style.borderColor = '#1e3a8a';
            });
            
            boton.style.backgroundColor = '#1e293b';
            boton.style.color = 'white';
            boton.style.borderColor = '#334155';

            fechaFiltroActiva = boton.getAttribute('data-fecha-filtro');
            actualizarListaAdmin();
        });
    });

    // --- MANDATORIO: INICIALIZACIÓN ORDENADA ---
    actualizarOpcionesGrupo();
    actualizarListaAdmin();

    // ==========================================
    // --- SECCIÓN: TRIBUNAL DE DISCIPLINA ---
    // ==========================================
    const formSancion = document.getElementById('form-sancion');
    const sancionCiclo = document.getElementById('sancion-ciclo');
    const sancionEquipo = document.getElementById('sancion-equipo');

    let listaSanciones = JSON.parse(localStorage.getItem('liga_sanciones')) || [];

    // Llenar selector de equipos para sanciones (Sincronizado con data.js de forma segura)
    function actualizarEquiposSancion() {
        if (typeof ligaData === 'undefined' || !sancionEquipo) return;
        
        const ciclo = sancionCiclo.value;
        sancionEquipo.innerHTML = '';
        
        // Usamos la base limpia de data.js
        const pool = ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
        
        if (!pool || pool.length === 0) {
            sancionEquipo.innerHTML = '<option value="">Sin equipos registrados</option>';
            return;
        }

        // Ordenamos alfabéticamente para que sea un lujo visual encontrar al equipo
        const poolOrdenado = [...pool].sort((a, b) => a.nombre.localeCompare(b.nombre));

        poolOrdenado.forEach(e => {
            sancionEquipo.innerHTML += `<option value="${e.nombre.trim()}">${e.nombre.trim()}</option>`;
        });
    }

    if (sancionCiclo) {
        sancionCiclo.addEventListener('change', actualizarEquiposSancion);
    }

    // Renderizar la lista de sanciones vigentes abajo en el panel
    function actualizarListaSancionesAdmin() {
        const contenedor = document.getElementById('lista-sanciones-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaSanciones.length === 0) {
            contenedor.innerHTML = '<p style="color:#8fa3d9; text-align:center; font-size:11px;">No hay sanciones disciplinarias vigentes.</p>';
            return;
        }

        listaSanciones.forEach(s => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(225,29,72,0.05); padding:10px; margin-bottom:8px; border-radius:8px; border-left: 4px solid #ef4444;">
                    <div style="text-align:left;">
                        <span style="font-size:10px; color:#f43f5e; display:block; text-transform:uppercase;">${s.ciclo}</span>
                        <span style="font-size:13px; color:white;">${s.equipo} <strong style="color:#f43f5e;">-${s.puntosRestados} PTS</strong></span>
                    </div>
                    <button class="btn-borrar-sancion" data-id="${s.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌</button>
                </div>
            `;
        });

        // Borrar sanción aplicada
        document.querySelectorAll('.btn-borrar-sancion').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
                listaSanciones = listaSanciones.filter(s => s.id !== idBorrar);
                localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
                actualizarListaSancionesAdmin();
            });
        });
    }

    // Submit del formulario de sanciones
    if (formSancion) {
        formSancion.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const puntosInput = document.getElementById('sancion-puntos');
            const nuevaSancion = {
                id: Date.now(),
                ciclo: sancionCiclo.value,
                equipo: sancionEquipo.value,
                puntosRestados: puntosInput ? parseInt(puntosInput.value) : 1
            };

            listaSanciones.push(nuevaSancion);
            localStorage.setItem('liga_sanciones', JSON.stringify(listaSanciones));
            
            actualizarListaSancionesAdmin();
            alert(`¡Sanción aplicada correctamente a ${nuevaSancion.equipo}!`);
        });
    }

    // Inicializar de forma segura la sección de sanciones al cargar
    actualizarEquiposSancion();
    actualizarListaSancionesAdmin();
});