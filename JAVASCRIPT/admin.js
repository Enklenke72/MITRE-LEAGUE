document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-partido');
    const submitBtn = form.querySelector('button[type="submit"]');
    const cicloSelect = document.getElementById('partido-ciclo');
    const grupoSelect = document.getElementById('partido-grupo-select');
    const localSelect = document.getElementById('partido-local');
    const visitanteSelect = document.getElementById('partido-visitante');

    // 1. CARGAR PARTIDOS EXISTENTES DE LA MEMORIA
    let partidos = JSON.parse(localStorage.getItem('liga_partidos')) || [];

    if (partidos.length === 0 && typeof ligaData !== 'undefined') {
        partidos = ligaData.partidos || [];
        localStorage.setItem('liga_partidos', JSON.stringify(partidos));
    }

    // 2. DETECCIÓN AUTOMÁTICA DE LA ÚLTIMA FECHA CARGADA
    function obtenerUltimaFechaCargada() {
        if (partidos.length === 0) return "1";
        const fechasNum = partidos.map(p => p.fecha);
        return Math.max(...fechasNum).toString();
    }

    let idPartidoEnEdicion = null;
    let fechaFiltroActiva = obtenerUltimaFechaCargada();

    function sincronizarBotonesFiltro() {
        const botonesFiltroAdmin = document.querySelectorAll('.tab-btn-admin');
        botonesFiltroAdmin.forEach(boton => {
            const val = boton.getAttribute('data-fecha-filtro');
            if (val === fechaFiltroActiva) {
                boton.style.backgroundColor = '#1e293b';
                boton.style.color = 'white';
                boton.style.borderColor = '#334155';
                boton.classList.add('active');
            } else {
                boton.style.backgroundColor = '#051030';
                boton.style.color = '#8fa3d9';
                boton.style.borderColor = '#1e3a8a';
                boton.classList.remove('active');
            }
        });
    }

    // SELECTORES DINÁMICOS DE EQUIPOS
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

    if (cicloSelect) cicloSelect.addEventListener('change', actualizarOpcionesGrupo);
    if (grupoSelect) grupoSelect.addEventListener('change', filtrarEquiposPorGrupo);

    // DIBUJAR LA LISTA DE PARTIDOS
    function actualizarListaAdmin() {
        const contenedor = document.getElementById('lista-partidos-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (partidos.length === 0) {
            contenedor.innerHTML = '<p style="color:#8fa3d9; text-align:center; font-size:12px;">No hay partidos registrados.</p>';
            return;
        }

        const partidosMostrados = fechaFiltroActiva === "todas" 
            ? [...partidos] 
            : partidos.filter(p => p.fecha === parseInt(fechaFiltroActiva));

        if (partidosMostrados.length === 0) {
            contenedor.innerHTML = `<p style="color:#8fa3d9; text-align:center; font-size:11px; padding: 15px;">No hay partidos programados para la Fecha ${fechaFiltroActiva}.</p>`;
            return;
        }

        partidosMostrados.sort((a, b) => {
            const horA = a.horario || "00:00";
            const horB = b.horario || "00:00";
            return horA.localeCompare(horB);
        });

        let ultimoHorario = "";

        partidosMostrados.forEach(p => {
            const marcador = p.jugado ? `${p.golesLocal} - ${p.golesVisitante}` : 'VS';
            const grupoP = p.grupo || 'A';
            const cicloFormateado = p.ciclo === 'superior' ? 'Superior' : 'Básico';
            const horarioActual = p.horario || 'Horario a confirmar';

            if (horarioActual !== ultimoHorario) {
                ultimoHorario = horarioActual;
                contenedor.innerHTML += `
                    <div style="width:100%; text-align:left; margin: 15px 0 8px 0; padding-bottom:3px; border-bottom: 1px dashed rgba(92, 225, 230, 0.76);">
                        <span style="font-family:'Audiowide', sans-serif; font-size:14px; color:#fff; text-transform:uppercase;">HORARIO ${horarioActual} HS</span>
                    </div>
                `;
            }

            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(255,255,255,0.03); padding:10px; margin-bottom:8px; border-radius:8px; border-left: 4px solid ${p.jugado ? '#3b82f6' : '#e11d48'};">
                    <div style="text-align:left;">
                        <span style="font-size:10px; color:#8fa3d9; display:block;">F${p.fecha} — ${p.cancha || 'Cancha 1'} (${cicloFormateado} - Grp ${grupoP})</span>
                        <span style="font-size:13px; color:white;">${p.local} <strong style="color:#5ce1e6;">${marcador}</strong> ${p.visitante}</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-editar" data-id="${p.id}" style="background-color:#1e3a8a; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">✏️</button>
                        <button class="btn-borrar" data-id="${p.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌</button>
                    </div>
                </div>
            `;
        });

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
        const fechaActual = document.getElementById('partido-fecha').value;
        const cicloActual = cicloSelect.value;
        const grupoActual = grupoSelect.value;

        idPartidoEnEdicion = null;
        if (form) form.reset();
        
        document.getElementById('partido-fecha').value = fechaActual;
        cicloSelect.value = cicloActual;
        actualizarOpcionesGrupo();
        grupoSelect.value = grupoActual;
        filtrarEquiposPorGrupo();

        document.getElementById('partido-horario').value = "14:20";
        if(document.getElementById('partido-cancha')) {
            document.getElementById('partido-cancha').value = "Cancha 1";
        }
        
        submitBtn.textContent = '💾 Guardar Resultado';
        submitBtn.style.backgroundColor = '';
    }

    if (form) {
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
    }

    const botonesFiltroAdmin = document.querySelectorAll('.tab-btn-admin');
    botonesFiltroAdmin.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesFiltroAdmin.forEach(b => {
                b.style.backgroundColor = '#051030';
                b.style.color = '#8fa3d9';
                b.style.borderColor = '#1e3a8a';
                b.classList.remove('active');
            });
            
            boton.style.backgroundColor = '#1e293b';
            boton.style.color = 'white';
            boton.style.borderColor = '#334155';
            boton.classList.add('active');

            fechaFiltroActiva = boton.getAttribute('data-fecha-filtro');
            actualizarListaAdmin();
        });
    });

    sincronizarBotonesFiltro();
    actualizarOpcionesGrupo();
    actualizarListaAdmin();

    // ==========================================
    // --- SECCIÓN: TRIBUNAL DE DISCIPLINA (EDICIÓN Y EMISIÓN) ---
    // ==========================================
    const formSancion = document.getElementById('form-sancion');
    const sancionCiclo = document.getElementById('sancion-ciclo');
    const sancionEquipo = document.getElementById('sancion-equipo');
    const submitBtnSancion = document.getElementById('btn-submit-sancion');
    const tituloFormSancion = document.getElementById('titulo-form-sancion');

    let idSancionEnEdicion = null;
    let listaSanciones = JSON.parse(localStorage.getItem('liga_sanciones')) || [];

    function actualizarEquiposSancion() {
        if (typeof ligaData === 'undefined' || !sancionEquipo) return;
        
        const ciclo = sancionCiclo.value;
        sancionEquipo.innerHTML = '';
        
        const pool = ciclo === 'superior' ? ligaData.cicloSuperior : ligaData.cicloBasico;
        
        if (!pool || pool.length === 0) {
            sancionEquipo.innerHTML = '<option value="">Sin equipos registrados</option>';
            return;
        }

        const poolOrdenado = [...pool].sort((a, b) => a.nombre.localeCompare(b.nombre));
        poolOrdenado.forEach(e => {
            sancionEquipo.innerHTML += `<option value="${e.nombre.trim()}">${e.nombre.trim()}</option>`;
        });
    }

    if (sancionCiclo) {
        sancionCiclo.addEventListener('change', actualizarEquiposSancion);
    }

    function actualizarListaSancionesAdmin() {
        const contenedor = document.getElementById('lista-sanciones-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaSanciones.length === 0) {
            contenedor.innerHTML = '<p style="color:#8fa3d9; text-align:center; font-size:11px;">No hay resoluciones registradas.</p>';
            return;
        }

        listaSanciones.forEach(s => {
            const detalleJugador = s.jugador ? ` — 👤 ${s.jugador}` : '';
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(225,29,72,0.05); padding:10px; margin-bottom:8px; border-radius:8px; border-left: 4px solid #ef4444;">
                    <div style="text-align:left; max-width: 75%;">
                        <span style="font-size:10px; color:#f43f5e; display:block; text-transform:uppercase;">ACTA N° ${s.acta || 1} (${s.ciclo ? s.ciclo.toUpperCase() : 'SUPERIOR'}) — ${s.tipo || 'Sanción'}</span>
                        <span style="font-size:12px; color:white; font-weight:bold;">${s.equipo}${detalleJugador}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block; margin-top:2px;">💬 ${s.motivo || 'Sin motivo detallado'}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-editar-sancion" data-id="${s.id}" style="background-color:#1e3a8a; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">✏️</button>
                        <button class="btn-borrar-sancion" data-id="${s.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-borrar-sancion').forEach(btn => {
            btn.addEventListener('click', () => {
                const idBorrar = parseInt(btn.getAttribute('data-id'));
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
                    if(document.getElementById('sancion-acta-num')) document.getElementById('sancion-acta-num').value = s.acta || 1;
                    sancionCiclo.value = s.ciclo || 'superior';
                    actualizarEquiposSancion();
                    sancionEquipo.value = s.equipo;
                    if(document.getElementById('sancion-jugador')) document.getElementById('sancion-jugador').value = s.jugador || '';
                    if(document.getElementById('sancion-tipo')) document.getElementById('sancion-tipo').value = s.tipo || 'Sanción Disciplinaria';
                    if(document.getElementById('sancion-puntos')) document.getElementById('sancion-puntos').value = s.puntosRestados || 0;
                    if(document.getElementById('sancion-motivo')) document.getElementById('sancion-motivo').value = s.motivo || '';

                    if (submitBtnSancion) {
                        submitBtnSancion.textContent = '⚠️ ACTUALIZAR RESOLUCIÓN';
                        submitBtnSancion.style.background = '#d97706';
                        submitBtnSancion.style.borderColor = '#f59e0b';
                    }
                    if (tituloFormSancion) tituloFormSancion.textContent = '✏️ Editar Acta / Sanción';
                }
            });
        });
    }

    function cancelarEdicionSancion() {
        idSancionEnEdicion = null;
        if (formSancion) formSancion.reset();
        actualizarEquiposSancion();
        if (submitBtnSancion) {
            submitBtnSancion.textContent = '🔴 PUBLICAR RESOLUCIÓN TRIBUNAL';
            submitBtnSancion.style.background = '#991b1b';
            submitBtnSancion.style.borderColor = '#f43f5e';
        }
        if (tituloFormSancion) tituloFormSancion.textContent = '⚖️ Emitir Acta / Registrar Sanción';
    }

    if (formSancion) {
        formSancion.addEventListener('submit', (e) => {
            e.preventDefault();

            const datosSancion = {
                acta: document.getElementById('sancion-acta-num') ? document.getElementById('sancion-acta-num').value : 1,
                ciclo: sancionCiclo.value,
                equipo: sancionEquipo.value,
                jugador: document.getElementById('sancion-jugador') ? document.getElementById('sancion-jugador').value.trim() : '',
                tipo: document.getElementById('sancion-tipo') ? document.getElementById('sancion-tipo').value : 'Sanción Disciplinaria',
                puntosRestados: document.getElementById('sancion-puntos') ? parseInt(document.getElementById('sancion-puntos').value) : 0,
                motivo: document.getElementById('sancion-motivo') ? document.getElementById('sancion-motivo').value.trim() : ''
            };

            if (idSancionEnEdicion !== null) {
                listaSanciones = listaSanciones.map(s => s.id === idSancionEnEdicion ? { ...s, ...datosSancion } : s);
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

    actualizarEquiposSancion();
    actualizarListaSancionesAdmin();

    // ==========================================
    // --- SECCIÓN: NOTICIAS DEL HERO 3D ---
    // ==========================================
    const formNoticia = document.getElementById('form-noticia-admin');
    let listaNoticias = JSON.parse(localStorage.getItem('liga_noticias')) || [];

    function actualizarListaNoticiasAdmin() {
        const contenedor = document.getElementById('lista-noticias-admin');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (listaNoticias.length === 0) {
            contenedor.innerHTML = '<p style="color:#8fa3d9; text-align:center; font-size:11px;">No hay noticias personalizadas.</p>';
            return;
        }

        listaNoticias.forEach(n => {
            contenedor.innerHTML += `
                <div class="match-card" style="display:flex; justify-content:space-between; align-items:center; background-color:rgba(92,225,230,0.05); padding:10px; margin-bottom:8px; border-radius:8px; border-left: 4px solid #5ce1e6;">
                    <div style="text-align:left; max-width: 80%;">
                        <span style="font-size:12px; color:white; font-weight:bold; display:block;">${n.titulo}</span>
                        <span style="font-size:10px; color:#cbd5e1; display:block;">${n.texto}</span>
                    </div>
                    <button class="btn-borrar-noticia" data-id="${n.id}" style="background-color:#991b1b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌</button>
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

            const nuevaNoticia = {
                id: Date.now(),
                titulo: document.getElementById('noticia-titulo').value.trim(),
                texto: document.getElementById('noticia-texto').value.trim(),
                foto: document.getElementById('noticia-foto').value.trim(),
                linkUrl: document.getElementById('noticia-link-url').value.trim(),
                linkTexto: document.getElementById('noticia-link-texto').value.trim() || 'VER MÁS ➔'
            };

            listaNoticias.push(nuevaNoticia);
            localStorage.setItem('liga_noticias', JSON.stringify(listaNoticias));

            formNoticia.reset();
            actualizarListaNoticiasAdmin();
            alert('¡Noticia guardada con éxito!');
        });
    }

    actualizarListaNoticiasAdmin();
});