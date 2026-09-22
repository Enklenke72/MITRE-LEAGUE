# Mitre League — Project.md

**Cliente:** Joaquín Coria (Coria Joaquín), secretario de deportes del centro de estudiantes — EEST Nro 4 "Ing. Emilio Mitre"
**Fecha de la reunión:** miércoles, notas 09:30
**Última actualización de este documento:** 17/09/2026

---

## 1. Resumen del proyecto

Sitio web para el "Mitre League", torneo escolar de fútbol 5 organizado por el centro de estudiantes. Formato tipo mundial (fase de grupos → octavos → semis → final), dividido en dos categorías: **Ciclo Básico** (1° a 3°) y **Ciclo Superior** (4° a 7°).

Joaquín ya venía desarrollando el sitio por su cuenta (autodidacta) y lo dejó en pausa por la carga de organizar el torneo en paralelo. Pide: ordenar el código existente, optimizarlo, y terminar las funcionalidades que quedaron pendientes — con la presión de lanzarlo a tiempo para el arranque del torneo.

**Objetivo doble para Joaquín:** que la web resuelva un problema real de gestión del staff (dejar de cargar todo a mano en Excel/papel) y que funcione como pieza central de su portfolio freelance como desarrollador frontend.

**Tono / identidad deseada:** seria y confiable, pero no "vieja ni sin gracia" — debe transmitir un plus respecto a lo que se venía haciendo. Información clara pero con una estética atrevida. Público objetivo: chicos de secundaria, algún visitante o padre. Frase clave del cliente: *"la clave es que un pibe del torneo entre a la página, le saque captura y la comparta con su grupo de amigos."*

---

## 2. Arquitectura actual del proyecto

Carpeta: `MITRE LEAGUE/` (repo git local, rama `main`)

```
index.html            → página pública (jugadores/visitantes)
admin.html            → panel de staff/administración
admin-planteles.html  → tercer HTML separado, gestión de planteles (⚠️ ver Duda #1)
estilo.css            → hoja de estilos única (3.901 líneas)
JAVASCRIPT/
  main.js             → lógica de index.html (2.141 líneas)
  admin.js            → lógica de admin.html (1.792 líneas)
  admin-planteles.js  → lógica de admin-planteles.html (315 líneas, ⚠️ ver Duda #1)
  data.js             → datos semilla/mock (grupos, equipos, partidos de ejemplo)
Recursos/             → imágenes, íconos SVG, sponsors, fuentes (Audiowide, Michroma, Oswald), reglamento en PDF
LISTA DE TAREAS PAGINA.pdf → documento de Joaquín con roadmap propio en 6 fases + estado actual
```

**Requisito explícito de estructura final:** solo dos archivos HTML (`index.html` y `admin.html`); todo JS debe vivir en archivos `.js` separados (nunca inline en `<script>`); todo lo que hoy esté en archivos sueltos adicionales debe evaluarse para migrar.

### Estado real verificado en el código (no solo lo declarado)

- **Persistencia:** 100% `localStorage`, bajo claves como `liga_cicloSuperior`, `liga_cicloBasico`, `liga_partidos`, `liga_grupos`, `liga_sanciones`, `liga_noticias`, `liga_notificaciones`, `liga_cruces_playoffs`, `liga_playoffs_publicados`, `liga_tesoreria_inscripciones`, `liga_egresos`, `liga_valor_inscripcion`. Ningún archivo usa Firebase todavía.
- **Roles:** no hay autenticación real. `admin.js` línea 49-63 usa un `<select id="selector-rol-usuario">` que solo alterna clases CSS (`rol-admin` / `rol-staff`) en el `<body>`. Cualquiera que abra `admin.html` puede cambiarse el rol manualmente desde el propio selector.
- **Tesorería:** el módulo (`admin.html` línea ~794 en adelante, sección `sec-tesoreria`) hoy es un único bloque visible para cualquiera en "rol admin/staff" — no hay separación de código entre lo que debería ver el staff (cobros por equipo) y lo que solo debería ver el coordinador general (recaudación total, egresos, balance). Es el "Dashboard Financiero Ciego" que el propio Joaquín tiene anotado como pendiente.
- **Notificaciones:** la campanita y el dropdown ya están maquetados en `index.html` (header y sidebar) y tienen lógica funcionando en `main.js`/`admin.js` (`liga_notificaciones` en localStorage). Falta terminar de pulir el diseño del desplegable según la propia lista de Joaquín.
- **Sponsors:** el carrusel coverflow 3D ya funciona en `main.js`, pero las tarjetas están **hardcodeadas en el HTML** de `index.html`, no leídas dinámicamente. No existe todavía ningún panel CRUD de sponsors en `admin.html`.
- **Playoffs:** hay lógica de sub-pestañas y de cruces (`crucesPlayoffs`, `liga_cruces_playoffs`) en `admin.js`, pero según la propia lista de tareas de Joaquín falta: los conectores visuales tipo bracket, el orden fijo por número de llave, el avance automático de ganadores entre rondas, y la tarjeta de campeón.
- **CSS inline:** `admin.html` tiene un bloque `<style>` embebido en el `<head>` (líneas 9+) con `@font-face` y estilos de body — contradice el pedido de mantener todo el CSS en `estilo.css`.

---

## 3. Roles y permisos (confirmado con el cliente)

- **Coordinador general (Joaquín):** acceso total. Es el único que ve recaudación total, egresos y el dinero de las inscripciones.
- **Staff habilitado:** accede a la sección de tesorería porque gestiona qué equipo pagó y cuál no (carga de pagos por equipo/jugador), pero **no** ve el total recaudado, los egresos generales ni el balance económico completo del torneo.
- Fuente: confirmado directamente por Joaquín; coincide con el "Sistema de Roles" y el "Dashboard Financiero Ciego" de su propia lista de tareas (Fase 2 y Fase 3).

**Implicancia técnica:** la migración a Firebase Auth + Firestore Security Rules deberá reflejar esta separación a nivel de reglas de seguridad del backend, no solo ocultando elementos en el frontend (el código actual solo hace lo segundo, que no es seguro).

---

## 4. Migración a Firebase (de cero)

- Confirmado: **no existe todavía** proyecto de Firebase creado. Hay que darlo de alta desde cero como parte de este trabajo (Firestore, Authentication, Storage, Hosting).
- Reemplazar todas las llamadas a `localStorage` por lectura/escritura asíncrona en Firestore.
- Implementar `onSnapshot` para sincronización en tiempo real entre dispositivos (para que el staff no tenga que recargar la página para ver cambios de otros compañeros).
- Reemplazar el `<select>` simulado de rol por login real con email/contraseña (Firebase Auth), con roles Staff / Coordinador General.
- Escribir Firestore Security Rules acordes a la separación de roles de la sección 3.
- Deploy en Firebase Hosting (capa gratuita) + vinculación de dominio propio si corresponde.

---

## 5. Pendientes detectados (cruce entre la lista de Joaquín y el código real)

### Módulo A — Playoffs / llave eliminatoria
- Conectores visuales tipo bracket (CSS puro, estilo Sofascore) entre Octavos → Cuartos → Semis → Final.
- Estructura fija por número de cruce/llave (slots 1 a 8), no por orden de carga.
- Avance automático del ganador de un partido al casillero correspondiente de la ronda siguiente.
- Tarjeta dorada de "Campeón" al cerrarse la Final.

### Módulo B — Gestor de sponsors
- Panel CRUD en `admin.html` (alta, edición, borrado).
- Campos por sponsor: nombre, logo/foto, categoría (Sponsor Oficial / Media Partner / Colaborador), descripción del aporte, beneficio exclusivo, enlace externo.
- Confirmado con el cliente: debajo de la foto de cada sponsor va su Instagram o su teléfono, según corresponda.
- Control de orden/prioridad de aparición en el carrusel.
- `main.js` debe leer los sponsors desde los datos (futuro Firestore) en vez de tarjetas fijas en el HTML.

### Módulo C — Control de calidad
- Carga masiva de datos de prueba (fechas, resultados, goleadores, sanciones) para validar tablas, desempates (PTS → DIF → GF) y comportamiento responsive.
- Auditoría de que los saldos de tesorería arrastrados entre fechas coincidan con la caja real.

### Módulo D — Firebase y seguridad (ver sección 4)

### Módulo E — "Plantilla de Pre..." (el PDF de Joaquín corta la frase acá)
- **Duda #2 abajo:** confirmar qué es este módulo, el PDF entregado queda incompleto en ese punto.

### Otros (de la Fase 1 del propio roadmap de Joaquín, y de la charla)
- Diseño responsive real para celular (tablas, selectores de grupo, tarjetas de resultado).
- Terminar de maquetar/pulir el desplegable de notificaciones.
- Footer con crédito "Desarrollado por Joaquín Augusto Coria" con link a redes/GitHub.
- Pulir `estilo.css` en general una vez conectadas las nuevas funciones.
- Robustecer el código para que agregar funcionalidades nuevas no rompa lo ya probado (hoy todas las pruebas de Joaquín fueron estáticas, cambiando código a mano).

---

## 6. Decisiones cerradas (no negociables según el cliente)

- Solo dos HTML finales: `index.html` (cliente) y `admin.html` (staff).
- Todo JS en archivos separados, nunca inline.
- Backend final: Firebase (Firestore + Auth + Storage + Hosting), dejando atrás localStorage.
- Coordinador general = Joaquín, único con visión completa de tesorería.
- Debajo de cada sponsor: Instagram o teléfono según corresponda.
- Identidad visual: transmitir seriedad y experiencia, pero con un plus "atrevido" respecto a lo tradicional — nada de aspecto viejo o genérico.

## 7. Abierto a sugerencias (el cliente dijo que puede escuchar cambios)

- Colores: se mantienen los que ya viene usando la web. Si el equipo quiere sugerir una paleta distinta, **preguntar antes** de aplicar cualquier cambio.
- Cualquier ajuste de UX/estructura que no toque las decisiones cerradas de la sección 6 puede proponerse y discutirse.

---

## 8. Dudas a resolver con Joaquín antes de arrancar a codear

1. **`admin-planteles.html` / `admin-planteles.js`:** tu lista de tareas dice "Consolidación en admin.js: eliminado el conflicto con scripts externos (admin-planteles.js)", pero ambos archivos (`admin-planteles.html`, 179 líneas, y `admin-planteles.js`, 315 líneas) siguen existiendo como archivos aparte en la carpeta del proyecto. ¿La gestión de planteles ya vive funcionalmente dentro de `admin.html`/`admin.js` y estos dos archivos quedaron obsoletos (los eliminamos), o todavía se usa `admin-planteles.html` como página aparte y hay que migrar su contenido a `admin.html` como parte de este trabajo?
2. **Módulo E de tu lista de tareas** ("Plantilla de Pre...") corta la frase en el PDF que nos pasaste. ¿Qué es exactamente — una plantilla de pre-inscripción de equipos, de prensa, algo de RRSS? Necesitamos el alcance completo para no dejarlo afuera.
3. **CSS inline en `admin.html`:** el archivo tiene hoy un bloque `<style>` propio en el `<head>` (fuentes y estilos de body) además de `estilo.css`. ¿Lo migramos a `estilo.css` para mantener todo centralizado, tal como pediste para el JS?
4. **Prioridad de lanzamiento:** dado que tenés fecha límite para salir junto con el arranque del torneo, ¿cuál de los módulos pendientes (A: Playoffs, B: Sponsors, D: Firebase) es el más crítico para el día 1, y cuáles podrían liberarse en una segunda etapa una vez lanzado?
5. **Dominio y hosting:** ¿ya tenés pensado un dominio propio para vincular a Firebase Hosting, o arrancamos con la URL gratuita de Firebase (`*.web.app`) por ahora?

---

## 9. Próximos pasos sugeridos

1. Responder las dudas de la sección 8.
2. Definir con Joaquín cuál de los módulos pendientes es bloqueante para el lanzamiento y cuál puede ir después (evitar intentar cerrar las 5 fases restantes antes de la fecha del torneo).
3. Alta del proyecto en Firebase (Firestore + Auth + Storage + Hosting).
4. Migrar `localStorage` → Firestore de forma incremental, módulo por módulo, sin romper lo que ya funciona en estático (empezar por datos de solo lectura pública, dejar tesorería y roles para cuando estén las Security Rules listas).
5. Separar visualmente y a nivel de datos la vista de tesorería de Staff vs. Coordinador General, antes de exponerlo a producción.
6. Resolver la duplicidad de `admin-planteles.*` según la respuesta de la Duda #1.
