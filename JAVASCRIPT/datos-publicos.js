// Carga los datos públicos del torneo desde Firestore y recién ahí arranca
// main.js (evento 'liga:datos-listos'). Si no hay conexión y no quedó nada en
// la caché de Firestore, la página se dibuja vacía igual.

import { cargarDatosLiga } from './datos-firestore.js';

cargarDatosLiga('publico')
    .catch(error => console.error('[Mitre League] No se pudieron cargar los datos del torneo:', error))
    .finally(() => document.dispatchEvent(new Event('liga:datos-listos')));
