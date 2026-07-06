document.addEventListener('DOMContentLoaded', () => {
    // Formularios
    const formEquipo = document.getElementById('form-nuevo-equipo');
    const formJugador = document.getElementById('form-jugador');
    
    // Selectores de control
    const cicloSelect = document.getElementById('plantel-ciclo');
    const equipoSelect = document.getElementById('plantel-equipo-select');
    const tablaBody = document.getElementById('tabla-jugadores-body');
    const tituloLista = document.getElementById('titulo-lista-plantel');

    // --- SINCRONIZACIÓN DE LA ESTRUCTURA COMPLETA ---
    // Nos aseguramos de traer la estructura base de ligaData para no romper el ecosistema
    let cicloSuperior = JSON.parse(localStorage.getItem('liga_cicloSuperior'));
    let cicloBasico = JSON.parse(localStorage.getItem('liga_cicloBasico'));

    if (!cicloSuperior || !cicloBasico) {
        cicloSuperior = ligaData.cicloSuperior;
        cicloBasico = ligaData.cicloBasico;
        localStorage.setItem('liga_cicloSuperior', JSON.stringify(cicloSuperior));
        localStorage.setItem('liga_cicloBasico', JSON.stringify(cicloBasico));
    }

    // --- FUNCIÓN: LLENAR EL SELECTOR DE EQUIPOS ---
    function actualizarSelectorEquipos() {
        const ciclo = cicloSelect.value;
        equipoSelect.innerHTML = '';

        const pool = ciclo === 'superior' ? cicloSuperior : cicloBasico;

        if (pool.length === 0) {
            equipoSelect.innerHTML = '<option value="">Sin equipos registrados</option>';
            actualizarTablaJugadores();
            return;
        }

        // Ordenamos los equipos alfabéticamente para que sea fácil buscarlos
        pool.sort((a, b) => a.nombre.localeCompare(b.nombre));

        pool.forEach(e => {
            equipoSelect.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`;
        });

        actualizarTablaJugadores();
    }

    // --- FUNCIÓN: DIBUJAR LA LISTA DE JUGADORES ---
    function actualizarTablaJugadores() {
        tablaBody.innerHTML = '';
        const ciclo = cicloSelect.value;
        const equipoNombre = equipoSelect.value;

        if (!equipoNombre) {
            tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#8fa3d9;">Seleccione un equipo para ver su lista.</td></tr>';
            tituloLista.textContent = "Lista de Buena Fe";
            return;
        }

        tituloLista.textContent = `Lista de Buena Fe — ${equipoNombre.toUpperCase()}`;

        const pool = ciclo === 'superior' ? cicloSuperior : cicloBasico;
        const equipoObj = pool.find(e => e.nombre === equipoNombre);

        // Si el equipo no tiene el array de jugadores inicializado, se lo creamos
        if (equipoObj && !equipoObj.jugadores) {
            equipoObj.jugadores = [];
        }

        if (!equipoObj || equipoObj.jugadores.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#8fa3d9;">No hay jugadores cargados en este plantel.</td></tr>';
            return;
        }

        // Ordenamos por número de camiseta (dorsal)
        equipoObj.jugadores.sort((a, b) => a.dorsal - b.dorsal);

        equipoObj.jugadores.forEach(j => {
            const igLink = j.instagram ? `<a href="https://instagram.com/${j.instagram}" target="_blank" style="color:#60a5fa; text-decoration:none;">@${j.instagram}</a>` : '<span style="color:#475569;">-</span>';
            
            tablaBody.innerHTML += `
                <tr>
                    <td style="font-weight:bold; color:#5ce1e6;">${j.dorsal}</td>
                    <td>${j.nombre}</td>
                    <td>${j.dni}</td>
                    <td>${igLink}</td>
                    <td>
                        <button class="btn-borrar-jugador" data-dni="${j.dni}" style="background-color:#991b1b; color:white; border:none; padding:3px 6px; border-radius:4px; cursor:pointer; font-size:10px;">❌</button>
                    </td>
                </tr>
            `;
        });

        // Escuchador para eliminar jugadores del plantel
        document.querySelectorAll('.btn-borrar-jugador').forEach(btn => {
            btn.addEventListener('click', () => {
                const dniBorrar = btn.getAttribute('data-dni');
                equipoObj.jugadores = equipoObj.jugadores.filter(j => j.dni !== dniBorrar);
                
                // Guardamos la baja en el localStorage correspondiente
                localStorage.setItem(ciclo === 'superior' ? 'liga_cicloSuperior' : 'liga_cicloBasico', JSON.stringify(pool));
                actualizarTablaJugadores();
            });
        });
    }

    // Escuchadores de cambio de selectores
    cicloSelect.addEventListener('change', actualizarSelectorEquipos);
    equipoSelect.addEventListener('change', actualizarTablaJugadores);

    // --- FORMULARIO 1: GUARDAR NUEVO EQUIPO ---
    formEquipo.addEventListener('submit', (e) => {
        e.preventDefault();

        const nombreInput = document.getElementById('nuevo-equipo-nombre').value.trim();
        const cicloInput = document.getElementById('nuevo-equipo-ciclo').value;
        const grupoInput = document.getElementById('nuevo-equipo-grupo').value;

        let pool = cicloInput === 'superior' ? cicloSuperior : cicloBasico;

        // Validamos que el curso no esté repetido
        if (pool.some(e => e.nombre.toLowerCase() === nombreInput.toLowerCase())) {
            alert('❌ Error: Este equipo ya se encuentra registrado en el torneo.');
            return;
        }

        const nuevoEq = {
            id: Date.now(),
            nombre: nombreInput,
            grupo: grupoInput,
            pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0,
            jugadores: []
        };

        pool.push(nuevoEq);
        localStorage.setItem(cicloInput === 'superior' ? 'liga_cicloSuperior' : 'liga_cicloBasico', JSON.stringify(pool));
        
        formEquipo.reset();
        
        // Sincronizamos la vista
        cicloSelect.value = cicloInput;
        actualizarSelectorEquipos();
        equipoSelect.value = nombreInput;
        actualizarTablaJugadores();

        alert(`¡Equipo ${nombreInput} añadido correctamente al Grupo ${grupoInput}!`);
    });

    // --- FORMULARIO 2: AGREGAR JUGADOR AL PLANTEL ---
    formJugador.addEventListener('submit', (e) => {
        e.preventDefault();

        const equipoNombre = equipoSelect.value;
        if (!equipoNombre) {
            alert('❌ Seleccione primero un equipo para añadirle integrantes.');
            return;
        }

        const ciclo = cicloSelect.value;
        const pool = ciclo === 'superior' ? cicloSuperior : cicloBasico;
        const equipoObj = pool.find(e => e.nombre === equipoNombre);

        const nombreJ = document.getElementById('jugador-nombre').value.trim();
        const dniJ = document.getElementById('jugador-dni').value.trim();
        const dorsalJ = parseInt(document.getElementById('jugador-dorsal').value);
        const instagramJ = document.getElementById('jugador-instagram').value.trim().replace('@', '');

        // Validaciones internas del plantel
        if (equipoObj.jugadores.some(j => j.dni === dniJ)) {
            alert('❌ Error: Ya existe un jugador con este DNI en el equipo.');
            return;
        }
        if (equipoObj.jugadores.some(j => j.dorsal === dorsalJ)) {
            alert(`❌ Error: El dorsal ${dorsalJ} ya está asignado a otro compañero.`);
            return;
        }

        const nuevoJugador = {
            nombre: nombreJ,
            dni: dniJ,
            dorsal: dorsalJ,
            instagram: instagramJ,
            goles: 0, amarillas: 0, rojas: 0
        };

        equipoObj.jugadores.push(nuevoJugador);
        localStorage.setItem(ciclo === 'superior' ? 'liga_cicloSuperior' : 'liga_cicloBasico', JSON.stringify(pool));

        formJugador.reset();
        actualizarTablaJugadores();
        alert(`¡${nombreJ} ha sido inscrito en ${equipoNombre}!`);
    });

    // Inicializamos al cargar la pestaña
    actualizarSelectorEquipos();
});