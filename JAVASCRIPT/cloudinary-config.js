// ============================================================
// CLOUDINARY: dónde se guardan las fotos que sube el staff
// ============================================================
// Firebase Storage exige el plan Blaze, que no se pudo activar. Las fotos de
// jugadores, noticias, portadas de álbum y logos de sponsors se suben a
// Cloudinary y en Firestore queda solo la URL (ver subirImagen en admin.js).
//
// Estos dos datos no son secretos. NUNCA pegues acá el "API Secret" de
// Cloudinary: el navegador no lo necesita y cualquiera podría leerlo.
// - cloudName: el "Cloud name" que muestra el Dashboard de Cloudinary.
// - uploadPreset: el nombre del Upload preset creado en modo "Unsigned".

const CLOUDINARY_CONFIG = {
    cloudName: 'okzgo6qz',
    uploadPreset: 'mitre-league-web'
};
