// ============================================================
// CONFIGURACIÓN DE FIREBASE — completar cuando exista el proyecto
// ============================================================
// Este archivo hoy es una plantilla vacía: el proyecto de Firebase de
// Mitre League todavía no está creado (ver CLAUDE.md, sección 11, y
// Claude outputs/preparacion-login-firebase.md).
//
// Pasos para completarlo:
//   1. Entrar a https://console.firebase.google.com/ y crear un proyecto
//      (por ejemplo "mitre-league").
//   2. "Compilación" > "Authentication" > "Comenzar" > habilitar el
//      proveedor "Correo electrónico/contraseña".
//   3. "Compilación" > "Firestore Database" > crear la base.
//   4. "Configuración del proyecto" (el engranaje, arriba a la izquierda) >
//      "Tus apps" > agregar una app web (ícono </>) > copiar acá abajo el
//      objeto de configuración que te muestra.
//   5. Recién ahí este archivo se importa desde index.html/admin.html (con
//      <script type="module">) junto con el SDK de Firebase, y
//      JAVASCRIPT/auth-login.js pasa a llamar a Firebase Auth de verdad.
//
// No completar con datos inventados: mientras no exista el proyecto, este
// archivo se deja vacío así, y el login sigue mostrando "acceso no
// activado" en vez de fallar contra una clave falsa.

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

export { firebaseConfig };
