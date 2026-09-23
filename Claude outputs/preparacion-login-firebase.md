# Preparación del login para Firebase (23/09/2026)

## Qué te pedía tu pregunta

Vos ya venís pidiéndole el email a tu staff. Acá te digo qué más necesitás y qué NO hace falta pedirles.

## Qué pedirle al staff (a partir de ahora)

- **Nombre completo** (para identificarlos en el panel; hoy nadie lo pide para el login).
- **Email** (ya lo hacías — es lo que van a usar para entrar).
- **NO les pidas una contraseña.** No hace falta ni conviene que vos la sepas. Cuando tengas el proyecto de Firebase creado, vos les creás la cuenta solo con el email (ver más abajo) y ellos definen su propia contraseña.
- **El rol (Staff o Coordinador General) lo definís vos**, no se lo preguntás a ellos. Hoy el único Coordinador General sos vos.

## Cómo se van a crear las cuentas (cuando exista el proyecto)

Dos formas, elegís la que prefieras:

1. **Vos les asignás una contraseña provisoria:** en Firebase Console > Authentication > Users > "Add user", ponés su email y una contraseña temporal, y se la pasás por WhatsApp para que la cambien la primera vez que entren.
2. **Ellos la eligen solos (más prolijo):** creás el usuario solo con el email, y desde la consola le mandás un link de "restablecer contraseña" — así ellos la definen y vos nunca la sabés.

En cualquiera de los dos casos, además tenés que anotar en Firestore (colección `usuarios`) el rol de cada persona, porque Firebase Authentication por sí solo no sabe si alguien es Staff o Coordinador — eso lo modelamos aparte.

## Qué dejé armado en el código (esto es lo que pediste: "el camino del login")

No creé el proyecto de Firebase (eso lo tenés que hacer vos desde tu cuenta de Google) ni conecté nada real todavía — activarlo antes de tiempo haría que el botón "Iniciar Sesión" tire errores confusos contra una clave falsa. Lo que sí dejé listo:

- **`JAVASCRIPT/auth-login.js` (nuevo):** el formulario de `index.html` ahora sí tiene lógica real de JS (antes no hacía nada, `onsubmit="return false"`). Valida que completes email y contraseña, muestra un mensaje de error debajo de los campos, y pone el botón en "Ingresando..." mientras intenta. Hoy, como no hay Firebase conectado, siempre te va a decir *"El acceso todavía no está activado"* — es intencional, para no mentir sobre algo que no funciona. El comentario de arriba del archivo explica exactamente qué 3-4 líneas reemplazar cuando actives Firebase.
- **`JAVASCRIPT/firebase-config.js` (nuevo, plantilla vacía):** con los pasos exactos para crear el proyecto y dónde copiar las claves cuando las tengas. Por ahora no está enlazado desde ningún HTML (para no agregar una dependencia externa a un sitio que hoy no la necesita).
- **`index.html`:** el formulario del login ahora tiene `id="form-login-staff"`, campos `required`, y un cartel de error (`#login-staff-error`) listo para mostrar mensajes reales de Firebase el día que estén conectados. La nota de abajo de la tarjeta ahora dice "Acceso todavía no activado" en vez de "Maqueta de acceso".
- **`estilo.css`:** estilos para ese cartel de error y para el botón mientras está deshabilitado (`.login-staff-error`, `.btn-submit-admin:disabled`, ambos dentro del bloque `login-staff-*`).

## Los pasos que faltan para que el login funcione de verdad

1. Crear el proyecto en Firebase y activar el método "Email/contraseña" (instrucciones dentro de `firebase-config.js`).
2. Completar `firebase-config.js` con las claves reales.
3. En `index.html`, agregar el SDK de Firebase y pasar la etiqueta de `auth-login.js` a `type="module"`; dentro de `auth-login.js`, reemplazar `iniciarSesionStaff` por la llamada real (`signInWithEmailAndPassword`) — el comentario del archivo ya trae el esqueleto.
4. Crear en Firestore la colección `usuarios` con el rol de cada persona (podés cargarla a mano desde la consola mientras el staff es poco).

## Algo relacionado que encontré, no lo toqué: avisame si lo sumamos

El selector `#selector-rol-usuario` de `admin.html` (el que hoy elegís "Admin" o "Staff" desde un `<select>`) sigue siendo **cosmético**: cualquiera que abra `admin.html` puede cambiarse el rol solo. No lo toqué porque me pediste específicamente la vista del login, y reemplazarlo depende de que el login ya esté funcionando (necesita saber el rol real de quien inició sesión). Cuando actives Firebase y quieras que decidamos ese selector también, avisame.

## No probado en navegador

No abrí el sitio para clickear el botón. Como no hay Firebase conectado, el comportamiento esperado es: completás los dos campos, aparece el mensaje rojo "El acceso todavía no está activado...", y el botón vuelve a su estado normal. Convendría que lo mires vos una vez en `index.html` antes de dar esto por cerrado.
