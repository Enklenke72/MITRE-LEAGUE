const ligaData = {
    // El torneo arranca limpio: los equipos y partidos se cargan desde el panel de staff.
    cicloSuperior: [],
    cicloBasico: [],

    // El almacén de partidos. Desde acá se va a alimentar TODO el sistema de manera automática.
    partidos: [],
    // NUEVO ALMACÉN DE SANCIONES (Quita de puntos disciplinarios)
    sanciones: [],

    // SPONSORS (editables desde el panel Staff — Prensa & Fotos). Arranca vacío
    // (decidido por Joaquín, 22/09/2026): los sponsors del torneo nuevo se cargan
    // desde el panel. Una vez que se guarda algo en localStorage ('liga_sponsors'),
    // esa versión manda.
    sponsors: [],

    // ÁLBUMES DE FOTOS (editables desde el panel Staff — Prensa & Fotos). Arranca
    // vacío (decidido por Joaquín, 22/09/2026), misma lógica que sponsors.
    fotosAlbumes: []
};