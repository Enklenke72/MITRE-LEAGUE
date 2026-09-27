// Datos del torneo (claves liga_*) en memoria, con la misma interfaz que
// localStorage para que main.js / admin.js / playoffs.js no cambien de forma.
// Los carga JAVASCRIPT/datos-firestore.js desde Firestore antes de disparar
// el evento 'liga:datos-listos', y cada setItem se guarda en Firestore
// (solo en admin.html: la web pública no escribe).

window.almacen = (() => {
    const datos = new Map();
    let alGuardar = null;

    return {
        getItem(clave) {
            return datos.has(clave) ? datos.get(clave) : null;
        },
        setItem(clave, valor) {
            const texto = String(valor);
            datos.set(clave, texto);
            if (alGuardar) alGuardar(clave, texto);
        },
        cargar(clave, valor) {
            datos.set(clave, valor);
        },
        alGuardar(fn) {
            alGuardar = fn;
        }
    };
})();
