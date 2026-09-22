# Mitre League — Contexto del proyecto (para agentes)

**Última actualización:** 21/09/2026 (armado con reportes de las sesiones de Claude que trabajaron en el repo; guía de migración a Firebase en la sección 11; simulación de torneo completo y sus arreglos en Hecho #14)
**Cliente:** Joaquín Coria, secretario de deportes del centro de estudiantes — EEST Nro 4 "Ing. Emilio Mitre".
**Qué es:** sitio web estático del torneo escolar de fútbol 5 "Mitre League". Formato tipo mundial (grupos → playoffs → final), dos ciclos: **Superior** (4° a 7°) y **Básico** (1° a 3°). Público: chicos de secundaria, padres, visitantes. Tono: serio pero atrevido, pensado para que un alumno le saque captura y la comparta.
**Doble objetivo de Joaquín:** reemplazar la carga manual en Excel/papel del staff, y usar la web como pieza de portfolio freelance.

> Agente nuevo: leé las secciones 1 a 4 antes de tocar nada. La 7 dice qué está hecho y qué falta. La 9 dice cómo coordinarte con otros agentes. La 11 es la guía para migrar a Firebase (leela completa antes de tocar datos). La 10 es una plantilla para recibir una tarea.

---

## 1. Reglas duras (no negociables)

- **Solo dos HTML:** `index.html` (público) y `admin.html` (staff). No crear otros HTML.
- **Todo JS en archivos `.js` separados** (carpeta `JAVASCRIPT/`). Nada de `<script>` inline con lógica.
- **Todo CSS en `estilo.css`.** Nada de `<style>` inline (el de `admin.html` ya se migró).
- **Persistencia actual = `localStorage`** (claves `liga_*`). Firebase (Fase 2) **fue pedido por Joaquín el 20/09/2026, pero condicionado a que se cierre el checklist de la sección 11.1**: no empieces sin confirmarlo con él.
- **Los números de equipos son de datos de ejemplo, no constantes.** Cada edición puede tener más o menos equipos por ciclo, y Ciclo Básico puede no jugarse. Nada debe asumir 20/9 equipos ni 16/8/4 llaves.
- **Colores e identidad visual:** se mantienen. Si querés proponer otra paleta, **preguntá antes**.
- **Debajo de cada sponsor:** Instagram **y** teléfono, cada uno si lo cargó (decisión de Joaquín, 22/09/2026; antes era uno u otro). Si además cargó una ubicación (dirección o link de mapa), se muestra aparte; lo que no se cargó no aparece.
- **Idioma:** el sitio, los comentarios y el trato con Joaquín van en español rioplatense.

## 2. Cómo trabaja Joaquín con los agentes (preferencias)

- Si encontrás algo relacionado que no te pidieron (un bug cercano, una inconsistencia), **preguntá antes de decidir dejarlo afuera**; no lo omitas en silencio ni lo arregles a escondidas.
- No agregar features, refactors ni abstracciones que no pidió. Sin comentarios salvo que el porqué no sea obvio.
- Joaquín revisa por lotes. Cerrá cada lote con un reporte corto: qué hiciste, qué desvió del plan y por qué, y qué falta probar.
- No commitear ni pushear si no lo pide.

## 3. Arquitectura

```
index.html                → página pública (~800 líneas)
admin.html                → panel de staff (~1.010 líneas)
estilo.css                → hoja única (~4.400 líneas)
JAVASCRIPT/
  data.js                 → datos semilla (equipos, partidos, sponsors, álbumes). Global `ligaData`
  playoffs.js             → lógica pura y compartida del bracket (se carga antes de main.js y admin.js)
  main.js                 → lógica de index.html (~2.180 líneas)
  admin.js                → lógica de admin.html (~2.890 líneas)
Recursos/                 → imágenes/SVG, fuentes (Audiowide, Michroma, Oswald), SPONSORS/, Fotos/, Reglamento PDF
Claude outputs/project.md → copia VIEJA de este documento, no la uses como fuente
LISTA DE TAREAS PAGINA.pdf → roadmap propio de Joaquín (el Módulo E quedó cortado en el PDF y está excluido)
```

Carpetas hermanas fuera del repo (en `Proyectos/`): `MITRE LEAGUE - copia/` es una copia de respaldo, **no la edites**. `ClaudePruebas/` contiene skills de revisión de diseño (`revisor-design-landing`, `revisor-design-mobile`, en `1er Caso/Skills`) que algunas sesiones usan.

- Scripts planos (sin módulos ES): `data.js` y `playoffs.js` exponen globales que `main.js`/`admin.js` consumen.
- Ocultar/mostrar: clases `seccion-oculta` (público) y `seccion-oculta-staff` (admin). Las pestañas de admin usan `data-target` → `id="sec-..."`.
- Títulos "TABLA DE POSICIONES" / "PLAY-OFFS" (`#toggle-titulo-tablas`, `#toggle-titulo-playoffs`): JS solo alterna `active`/`opaco`; el desplazamiento es CSS con override en `@media (max-width:768px)`.
- Breakpoints usados: 480, 600, 650, 768, 800 px. La franja 769–799 no se revisó visualmente.

### Secciones de `admin.html`
`sec-resumen`, `sec-jornada` (carga de partidos, Armador de Playoffs, config del bracket, toggle Tabla Única), `sec-planteles` (equipos, jugadores, grupos), `sec-prensa` (noticias, álbumes, sponsors CRUD), `sec-tribunal` (sanciones), `sec-tesoreria` (Aranceles por Partido, Inscripciones por Jugador, Caja por Fecha), `sec-alertas` (avisos).

### Secciones de `index.html` relevantes
Tablas/fase de grupos (`#vista-fase-grupos`), Playoffs (`#vista-playoffs`), Tribunal, carrusel de sponsors, acordeón del Reglamento, login de staff (`#pantalla-admin`, clase `login-staff-section`) y footer con popover de contacto.

### Trampas de CSS conocidas
- Regla mobile `.table-style td { font-size: 11px !important }` pisa estilos: para cambiar el nombre de un equipo en tabla usá el selector `.table-style td.td-team-name`.
- `.recent-results` no define color y hereda negro; varias secciones lo usan así, y `index.html` tiene otros `h2` con estilos inline. Revisá el contraste si ponés texto ahí.
- Tipografías: nombres de equipo (`.team-name`, `.teso-team-name`) en Michroma; los inputs de plata (`.input-monto-teso`) siguen en Oswald bold porque Michroma desborda.

## 4. Modelo de datos (localStorage)

Regla general: la semilla de `data.js` solo se usa si la clave no existe; una vez que el staff guarda algo, **manda localStorage**.

| Clave | Contenido |
|---|---|
| `liga_cicloSuperior` / `liga_cicloBasico` | Array de equipos `{id, nombre, grupo, pj,g,e,p,gf,gc,dif,pts, jugadores[]}`. Jugador: `{nombre, dni, ..., goles, amarillas, rojas}` (más ficha médica/emergencia) |
| `liga_grupos` | Configuración de grupos |
| `liga_partidos` | `{id, fecha, dia, horario, cancha, local, visitante, golesLocal, golesVisitante, ciclo:'superior'\|'basico', jugado, esPlayoff?}` + asistencia por equipo (ver Art. 17 Bis) + `amarillasLocal` / `rojasLocal` / `amarillasVisitante` / `rojasVisitante` (arrays de DNI, una entrada por tarjeta) + `asistentesLocal` / `asistentesVisitante` (ids de jugador tildados en la lista de buena fe; id = `dni`, obligatorio en todo jugador; de ahí salen los PJ individuales, que solo cuentan en partidos `jugado` y no `resultadoAuto`). Los `esPlayoff` **no cuentan** en las tablas de grupos. **Las fechas de playoffs son números ≥ 100** (108, 104, 102, 100…), no son "fechas" comunes; para ordenar usá `ordenCronologicoFecha()` (admin.js) |
| `liga_sanciones` | `{id, acta, ciclo, equipo, equipoId, jugador, tipo, puntosRestados, motivo, origenAuto?, claveTeso?, fechaLevantada?}`. Con `origenAuto` la creó Tesorería automáticamente |
| `liga_noticias`, `liga_fotos_albumes` | Prensa y álbumes |
| `liga_sponsors` | `{id, orden, nombre, categoria, logo, colorFondo, descripcion, beneficio, instagram, telefono, link}`. Categorías: Sponsor Oficial / Media Partner / Colaborador |
| `liga_notificaciones` | Avisos (`listaAlertas`); el público los lee con la campanita |
| `liga_avisos_staff` | Avisos internos del staff (22/09/2026), generados por el sistema (hoy solo el de dorsal inválido en goles). **Nunca públicos** — no confundir con `liga_notificaciones` |
| `liga_cruces_playoffs` | Cruces `{id, ciclo, ronda, slot, local, visitante}` (slot 1-based fijo por llave) |
| `liga_playoffs_publicados` | String `'true'`/`'false'` **global** (no por ciclo ni por ronda): si los playoffs están visibles al público |
| `liga_playoffs_config` | `{superior:{rondaInicial, slots}, basico:{...}}`; default Octavos/8 |
| `liga_formato_torneo` | `{superior:'grupos'\|'unico', basico:...}`. Tabla Única es decisión explícita del admin |
| `liga_tesoreria_partidos_v2` | Aranceles por partido, por clave equipo/partido: `{ef, tr, arancel}` |
| `liga_tesoreria_inscripciones` | Por **nombre** de equipo (no por id, ver 11.4 punto 7): `{ef, tr}` |
| `liga_valor_inscripcion` | Valor de la inscripción por jugador (string numérico; default 3000) |
| `liga_egresos` | Egresos generales |
| `liga_caja_movimientos` | `{id, equipo, concepto, detalle, medio, monto, fechaHora}` |

**Para cualquier agente que necesite estos datos** (por ejemplo para armar un Excel): viven en el `localStorage` **del navegador de Joaquín**, no en un archivo del repo, así que una terminal no los puede leer. Opciones: (a) la semilla de `data.js`, (b) un export desde el navegador (`JSON.stringify(localStorage)` en la consola, que Joaquín te pasa), (c) un botón de exportación en admin (es un cambio de la web y se acuerda antes). Los datos de tesorería son sensibles: no los publiques ni los muevas fuera del repo sin pedirlo.

## 5. Playoffs (módulo construido)

- `playoffs.js` (funciones puras): `slotsPorRonda(ciclo)`, `rondasHabilitadas(ciclo)`, `rondaSiguiente(ronda)`, `determinarGanador(partido)` (goles → penales), `slotDestino(slot)` / `ladoDestino(slot)`, `migrarCrucesConSlot()`, `obtenerConfigPlayoffs()` / `guardarConfigPlayoffs()`. Rondas: `octavos → cuartos → semis → final`.
- Admin configura ronda inicial y cantidad de llaves por ciclo; el bracket público se dibuja por slot fijo ("A definir" en vacíos) con conectores CSS estilo Sofascore.
- Al guardar un partido `esPlayoff` jugado, `procesarAvancePlayoff()` (admin.js) mueve al ganador al slot/lado que corresponde en la ronda siguiente sin pisar el lado hermano. Tarjeta dorada de campeón al cerrar la Final. Un ciclo sin equipos se oculta.

## 6. Tesorería y reglamento (Art. 17 Bis automático)

Implementado en `admin.js` (bloque de Tesorería reescrito) con clases `teso-*` en `estilo.css`:
- `calcularTesoreriaPartidos()` calcula por equipo cuánto debe, cuánto cubrió (con **saldo a favor arrastrado** entre fechas) y su porcentaje pagado.
- Cada partido tiene un **selector de asistencia por equipo** (presente / ausente sin aviso / ausente con aviso).
- `evaluarPartidoAusencias(p, calc)` aplica el Art. 17 Bis: el equipo ausente que no abonó el 50% recibe una **sanción automática de −`PUNTOS_QUITA_AUSENCIA` (2) PTS** en `liga_sanciones` (`origenAuto`), que se **levanta con fecha** al pagar (banner "Quita levantada" en el Tribunal público). Si el rival se presentó y abonó el 100% → **3-0 automático**; entre 50% y 100% → partido suspendido sin puntos; menos de 50% → también queda como no presentado. En playoffs solo se avisa que el ausente queda eliminado.
- `sincronizarAusencias()` reconcilia todo tras cada cambio (crea, levanta o reactiva sanciones, carga o deshace el 3-0, limpia huérfanas). El admin puede editar o eliminar la sanción; si la edita a mano deja de ser automática.
- Si ambos equipos figuran ausentes, el reglamento no lo define: se avisa y se resuelve a mano.
- La lógica se probó con 18 casos simulados fuera del navegador; **no se probó en el navegador**.
- "Caja por Fecha" existe (Tesorería > Aranceles > sub-pestaña "Caja por Fecha") y solo se ve en modo Administrador; la verificó un Edge headless.

### Roles y permisos
- **Coordinador general (Joaquín):** ve todo, incluida recaudación total, egresos y balance.
- **Staff:** entra a Tesorería para marcar qué equipo pagó, pero **no** ve totales, egresos, balance ni "Caja por Fecha".
- **Hoy es solo cosmético:** `<select id="selector-rol-usuario">` alterna `rol-admin`/`rol-staff` en `<body>` y el CSS oculta `.solo-admin`. No hay seguridad real. Se resuelve en Fase 2 (Firebase Auth + Security Rules), no ocultando más elementos.
- El login de `#pantalla-admin` en `index.html` es **solo una maqueta** (`<form onsubmit="return false">`, sin validación).

## 7. Estado del proyecto

### Hecho
1. Limpieza y fixes (bug de notificaciones, código muerto, listeners duplicados, CSS inline de admin migrado, `admin-planteles.*` eliminado).
2. CSS del bracket consolidado en un solo bloque.
3. Módulo Playoffs dinámico (sección 5).
4. Sponsors: CRUD en admin, semilla en `data.js`, carrusel dinámico (ya no hay tarjetas hardcodeadas).
5. Responsive de los títulos Tabla/Playoffs en CSS puro.
6. Avisos: botón "Vaciar Historial" en admin (sin "marcar leído": esa vista no tiene estado leído).
7. Top-3 + mejor 4° resaltados, búsqueda corregida, salto al fixture desde el perfil de equipo, Tabla Única opcional.
8. Footer con crédito: popover al pasar el mouse o tocar el nombre del desarrollador, con mailto e Instagram (`#footer-firma-trigger`). `admin.html` no tiene footer.
9. Login de staff en `index.html` rediseñado como maqueta (tarjeta única `login-staff-*`, candado SVG, título Michroma blanco, foco cian, media query 480 px).
10. Legibilidad tipográfica: nombres de equipo en Michroma, sin `font-size` inline en el perfil de equipo, badges de Aranceles.
11. Reglamento revisado contra el PDF: acordeón de `index.html` corregido (textos, bloques nuevos "Pagos y Deuda" y "Lluvia"), link de descarga arreglado (`Recursos/Reglamento%20MITRE%20LEAGUE%202026.pdf`). Sumada la pauta de ausencias (Art. 17 Bis) y su automatización (sección 6).
12. **Lista de buena fe digital** (reemplaza la firma en papel, pensada para celular en cancha): en Tesorería > Aranceles por Partido cada equipo tiene un desplegable "Lista de buena fe" con un checkbox de asistencia y un botón de ficha médica (OK/FALTA) por jugador, filtro por cancha, y alta de jugador en el momento (queda en el plantel con ficha pendiente y ya marcado como presente). Tildar al primer jugador pone solo al equipo como "Se presentó" (Art. 17 Bis); si se destilda a todos, vuelve a "Sin registrar". Nadie se oculta por no tener ficha: se ve quién la entregó y quién no (fila roja si está presente sin ficha). Los PJ de cada jugador se muestran en el modal público del equipo. **Vista imprimible** (respaldo en papel, pedida por Joaquín): botón "Imprimir planilla" en cada partido y "Imprimir planillas (filtro actual)" arriba; genera una hoja A4 apaisada por partido con las columnas de la planilla de semifinales sin la de Goles (Jugador, DNI, N°, Firma; decidido por Joaquín 20/09/2026) y filas en blanco hasta 10. No hay HTML nuevo: `#vista-imprimible` se crea por JS y las reglas `@media print` (clases `plan-*`) están en `estilo.css`. Código: bloque "Lista de buena fe en cancha" y `imprimirPlanillas` en `admin.js`, clases `bf-*` en `estilo.css`. Probado en Edge headless a 390 px; **no en un celular real ni con una impresora real**.

13. **Textos del reglamento en la web (20/09/2026):** mínimo de 4 jugadores para presentarse, "Acreditación" sin firma de planilla y nuevo punto "Aceptación del Reglamento" (index.html, acordeón "Lista de Buena Fe y Jugadores"). Falta el PDF y la ficha médica en papel (ver Pendiente).

14. **Simulación de un torneo completo y arreglos (21/09/2026).** Un banco de pruebas maneja la interfaz real de `admin.html` en Edge headless (16 equipos, 92 jugadores, 3 fechas, lista de buena fe, pagos, Tribunal, Art. 17 Bis, playoffs de los dos ciclos) y verifica `index.html`. Primera corrida: 107 PASS / 20 FAIL (`Claude outputs/banco-simulacion-torneo/REPORTE.md`). Tras los arreglos: **129 PASS / 1 FAIL, sin regresiones ni errores de JS** (`REPORTE-2.md`, misma carpeta; el FAIL es la falla 7, sin decidir). Para volver a correrlo, ver el REPORTE.md. Arreglado:
    - `admin.js`: editar un partido de otro grupo refiltra los equipos (antes dejaba Local/Visitante vacíos); Planteles busca equipo y jugador al momento del clic (`buscarJugadorPlantel`) y redibuja la tabla al abrir la pestaña (antes Baja y ficha OK/Debe no guardaban); el dorsal 0 se ve y se edita (jugador sin dorsal = "S/N"); al editar DNI, dorsal o nombre, `propagarCambioJugador` los reescribe en asistencia, tarjetas, goleadores y sanciones; filtros de cronograma y Tesorería ordenados con `ordenCronologicoFecha`; Quita de Puntos o Suspensión sin cantidad se rechaza; cabecera de Tesorería "A confirmar" sin horario.
    - Web pública: `data.js` con equipos y partidos en `[]` (arranque limpio); sin la noticia "FECHA 5 CERRADA" ni los avisos por defecto de la campanita; texto "Todavía no hay partidos cargados." si no hay partidos; tarjetas en los desplegables de partido (`htmlTarjetasPartido`); botones de fecha del fixture generados desde las fechas de grupos existentes (sin tope fijo); acta normalizada en el Tribunal (`numeroDeActa`); modal del equipo con playoffs en orden y con nombre de ronda (`ordenCronologicoFechaPublico`, `nombreFechaPublico`); bracket sin "Octavos" si el ciclo arranca en Cuartos (`.tab-btn[hidden]`) y con la primera ronda visible activa.

15. **Ajustes del 22/09/2026 (pedidos por Joaquín tras revisar la simulación).** Arreglado y probado por mitre-league-5d: **160 PASS / 1 FAIL** (`REPORTE-3.md`, misma carpeta; el FAIL es la falla 7, sin decidir a propósito — ver ítem 16, ya resuelto después de esa corrida). Sponsors quedó cubierto de punta a punta (23 controles: alta con logo/ubicación/edición/orden/baja y carrusel público), sin regresiones y sin errores de JS.
    - `data.js`: `sponsors` y `fotosAlbumes` arrancan en `[]` (antes traían la semilla del torneo anterior).
    - Sponsors: nuevo campo **Ubicación** (dirección o link de mapa), opcional. Alta/edición en `admin.js`/`admin.html` (`sponsor-ubicacion`, clave `ubicacion`); en la tarjeta pública (`renderizarSponsorsPublico`, main.js) se muestra debajo de Instagram/teléfono solo si tiene contenido, como link si empieza con "http" o como texto si no (clase `.sponsor-ubicacion` en estilo.css).
    - Sanciones: una "Quita de Puntos" o "Sanción Disciplinaria" con cantidad **0** ahora se rechaza igual que vacía (`admin.js` ~1973); "Advertencia / Acta" sigue aceptando 0.
    - Fixture público: los partidos de playoffs (fechas ≥100) ahora también aparecen como botones ahí, no solo en el bracket (`rondasDePlayoffConPartidos`, nombres de ronda con `nombreFechaPublico`). El fixture abre por defecto en la **última fecha de fase de grupos con resultados jugados** (`calcularFechaInicialFixture`), no en la primera; si ninguna tiene resultado, cae en la primera fecha como antes.
    - `index.html`: se sacó la noticia fija "SE ACERCA LA FINAL" del hero. Queda solo "¡Y SE FUE!...". El bug ya anotado de `heroSlides3D` (se calcula antes de dibujar `liga_noticias`) sigue igual, solo que ahora con 1 tarjeta fantasma en vez de hasta 3.

16. **Avisos internos del staff y ajustes finales de sponsors (22/09/2026).**
    - **Panel de Avisos Internos: HECHO** (por una sesión nueva que Joaquín despachó directamente, sin pasar por mí). Pestaña nueva `sec-avisos-staff` en `admin.html` ("Avisos Internos", junto a "Avisos" que sigue siendo la campanita pública), con lista y botón "Vaciar Historial". Guarda en `liga_avisos_staff` (`registrarAvisoStaff(tipo, detalle)` en `admin.js`), ya sumada a `ETIQUETAS_STORAGE` para el medidor de espacio. Primer caso conectado: un gol cargado con un dorsal que no existe en el plantel (`procesarDorsales`, ~810) ya NO se ignora en silencio — el resto del resultado se guarda igual y queda un aviso con el equipo, la fecha, el rival y el dorsal que falló. Verificado por sintaxis y CRLF; no probado todavía por un banco.
    - **Instagram y teléfono juntos: HECHO.** Antes la tarjeta pública del sponsor mostraba uno u otro ("Instagram o teléfono, según corresponda"); ahora Joaquín pidió mostrar los dos si el sponsor cargó ambos. Cambiado en `renderizarSponsorsPublico` (main.js ~633). Regla del proyecto actualizada (sección 1).
    - **Logo de sponsor sin comprimir: ARREGLADO.** A diferencia de las fotos de jugador (250px) y de noticia (1000px), el logo de sponsor se guardaba con un `FileReader` crudo, sin pasar por `comprimirImagen`. Ahora usa la misma función, con `MAX_LADO_LOGO_SPONSOR = 500` y la misma calidad JPEG 0.75 (`admin.js`, junto a `MAX_LADO_FOTO_JUGADOR`/`MAX_LADO_FOTO_NOTICIA`). Esto era parte de lo que hacía crecer el uso de `localStorage` que anotó mitre-league-5d en `REPORTE-3.md`.
    - **PROBADO (22/09/2026, mitre-league-5d): 167 PASS / 0 FAIL** (`REPORTE-4.md`, misma carpeta) — primera corrida sin ninguna falla, sin regresiones. El aviso interno queda único y con equipo/fecha/rival/dorsal correctos, "Vaciar Historial" funciona, Instagram+teléfono se muestran juntos, y un PNG de 3.140 KB quedó en un JPEG de 15 KB a 500×333. **Detalle a tener en cuenta, no es falla:** si se vuelve a guardar el mismo partido sin corregir el dorsal, el aviso se registra otra vez (se crea cada vez que se procesan los goleadores); no molesta si alcanza con "Vaciar Historial" de vez en cuando, pero se puede evitar la repetición si Joaquín lo prefiere.

### Pendiente
- **CAMBIO DE PLAN (20/09/2026): se descarta el agente que volcaba datos a una plantilla de Excel.** En su lugar se **digitaliza la planilla de buena fe** (ya hecho en gran parte, ver Hecho #12). Un Excel exportado solo sirve de respaldo, y solo si Joaquín lo vuelve a pedir. Lo que falta para dar la lista digital por terminada, en orden de urgencia:
  1. **Dónde viven los datos (era bloqueante): se resuelve con la migración a Firebase, que Joaquín pidió el 20/09/2026** apenas se cierre el resto. La asistencia de la lista de buena fe hoy se guarda en el `localStorage` de cada celular y no sincroniza entre dispositivos. Ver sección 11.
  2. **Regla de datos decidida por Joaquín (20/09/2026): no puede haber jugadores sin DNI ni sin dorsal; el dorsal no se repite dentro de un equipo (0 a 99, el 0 está habilitado); el DNI es único en TODO el torneo, con una excepción: un jugador inscripto en un equipo puede pasar a otro solo si todavía no jugó ningún partido con el suyo.** **HECHO en los dos caminos de alta** (alta en cancha de la lista de buena fe y formulario de Planteles), con una sola función compartida `validarJugadorEnTorneo` en `admin.js`: DNI y número `0..99` obligatorios (el número vacío ya no se guarda como 0; `#jugador-dorsal` tiene `min="0"`), dorsal repetido rechazado dentro del equipo, DNI repetido rechazado en todo el torneo (todos los equipos de ambos ciclos, comparando solo los dígitos). Traslado: si el DNI ya está en otro equipo y ese jugador **no figura tildado en ningún partido de su equipo** (jugado o no todavía), se pide confirmación y se lo **mueve** (se lo saca del equipo anterior y conserva sus datos, ficha médica incluida); si ya figura tildado, se rechaza. Al **editar** un jugador no se permite trasladar (si el DNI nuevo está en otro equipo se rechaza). No hay migración de jugadores ya guardados: Joaquín dijo que se empieza de cero al subir a Firebase (los de `data.js` y `localStorage` actuales no importan). Con DNI obligatorio y único, el id de la asistencia (`dni`) queda bien y desaparece el problema de editar/borrar por DNI vacío (~1523/1566). Si se corrige un DNI mal tipeado (o el dorsal o el nombre), `propagarCambioJugador` lo reescribe en partidos y sanciones, así no se pierden PJ, tarjetas, goles ni suspensión (HECHO 21/09/2026; no se probó por separado la suspensión tras cambiar el DNI). (Ver también 11.4 punto 4: ese id debe pasar a ser un `jugadorId` interno.)
  3. **Aviso de jugador suspendido: HECHO (20/09/2026).** Regla de Joaquín: la suspensión corre **desde la fecha siguiente a la del acta** y dura `puntosRestados` fechas (tipo "Sanción Disciplinaria"); el número de acta del formulario del Tribunal es el número de fecha. En el Tribunal el jugador se elige de la lista del equipo (`#sancion-jugador-id`, reemplaza al texto libre) y la sanción guarda `jugadorId` (= DNI del jugador) y `jugador` (texto "Nombre (#dorsal)"). En la lista de buena fe cada jugador suspendido en la fecha del partido lleva la marca roja "SUSPENDIDO · Acta N · X fechas", y si además está tildado la fila se pinta de rojo. **También en la planilla impresa** (20/09/2026, pedido de Joaquín: las rojas y suspensiones se cargan a mano en el Tribunal pero tienen que influir en las dos listas): el jugador sigue apareciendo pero la celda Firma dice "SUSPENDIDO · Acta N" (`.plan-susp`). Código: `suspensionVigenteDe` en `admin.js` (cuenta las fechas que existen en el ciclo en orden cronológico, así entran bien los playoffs 108/104/102/100). Pendiente de confirmar con Joaquín: si un partido que se suspende o no se juega descuenta la fecha de suspensión (hoy cuenta cada fecha del ciclo, se juegue o no). Ojo migración: `jugadorId` es el DNI y `liga_sanciones` es público (ver 11.4 punto 4).
  4. **Mínimo de 4 jugadores para presentarse: confirmado por Joaquín.** Ya aplicado en la web (`index.html`, acordeón "Lista de Buena Fe y Jugadores": "Mínimo 4 jugadores para presentarse y comenzar el partido, máximo 10 inscriptos en lista"). **Falta el PDF.** El aviso de la lista de buena fe con menos de 4 tildados **está HECHO** (`textoAvisoMinimoBF`, constante `MINIMO_JUGADORES_PARTIDO`): muestra "Faltan X para poder jugar (mínimo 4)" en rojo y desaparece con 4; un jugador suspendido tildado no cuenta para el mínimo (decisión mía, a confirmar con Joaquín).
  5. **Aceptación del reglamento: confirmado por Joaquín.** Ya aplicada en la web (`index.html`: nuevo punto "Aceptación del Reglamento" y "Acreditación" reescrita, sin firma de planilla). **Faltan el PDF y la ficha médica en papel** (la ficha no está en el repo). Textos redactados, para copiar tal cual:
     - Ficha médica: *"Declaro haber leído el Reglamento del Mitre League 2026 y acepto su cumplimiento. Entiendo que la participación en el torneo implica la aceptación de este reglamento. Firma: ______ Aclaración: ______ DNI: ______ Carácter: ☐ Adulto responsable ☐ Alumno mayor de 18 años."*
     - PDF, artículo de Acreditación: *"En cada partido los jugadores deben presentar su DNI (físico o digital) antes de jugar. La asistencia es registrada por el staff de la Organización mediante la lista de buena fe digital."*
     - PDF, artículo nuevo de Aceptación: *"La participación en el torneo implica el conocimiento y la aceptación de este reglamento. La aceptación se formaliza una única vez mediante la firma de la ficha médica por el adulto responsable, o por el propio alumno si es mayor de 18 años."*
     - PDF, Mínimo y Máximo: *"Mínimo 4 jugadores para presentarse y comenzar el partido, máximo 10 inscriptos en lista."*
  6. **Decidido: la lista digital NO carga goles ni resultado** (eso queda en Carga de Partidos). **Sí se quiere una vista imprimible de respaldo**, con el formato de tabla de la planilla de semifinales (columnas Jugador / DNI / N° / Firma). **HECHA (20/09/2026)** por la sesión que hizo la lista digital, ver Hecho #12: no la repitas. Joaquín pidió sacarle la columna Goles y el pie RESULTADO (ya no están).
  7. **Decidido: un 3-0 automático NO cuenta como PJ del jugador.** Ya es así en el código (`main.js` ~1957). No requiere cambios.
  8. **Joaquín prueba en un celular real** (20/09). Todavía no informó el resultado.
  9. **Carga de tarjetas: HECHA (20/09/2026).** Decidido por Joaquín: solo amarillas y rojas (las azules no se registran ni se muestran) y se cargan en **Carga de Partidos, junto a los goles**: cuatro campos (amarillas y rojas de cada equipo, con dorsales separados por coma; un dorsal repetido cuenta dos tarjetas). Se guardan **dentro del partido** como `amarillasLocal`, `rojasLocal`, `amarillasVisitante`, `rojasVisitante` (arrays con el DNI del jugador, una entrada por tarjeta) y los totales del modal público se **derivan** de los partidos jugados (`tarjetasDeJugador` en `main.js`), sin contador sobre el jugador (los campos `amarillas`/`rojas` del jugador ya no se usan). Validaciones: un dorsal que no existe en el plantel se rechaza y no se guarda nada; no se pueden cargar tarjetas sin el resultado; al editar un partido los campos se rellenan con los dorsales guardados. Código: `resolverDorsalesEnEquipo` / `dorsalesDeIds` y el submit de partido en `admin.js`. **Sin decidir con Joaquín:** si una roja debe crear o sugerir la sanción en el Tribunal (hoy la suspensión se carga a mano en el Tribunal, ítem 3). Recordar que las amarillas no se acumulan de un partido a otro (reglamento).
- **Qué falta probar en navegador:** el banco (Hecho #14) ya cubrió en Edge headless la carga de partidos, planteles, lista de buena fe, planilla, Tesorería/Art. 17 Bis, banner "Quita levantada", Caja por Fecha, Tribunal, bracket y avance de playoffs, tablas, goleadores, modales, campanita y buscador. **Sin probar:** celular real e impresora real; login, footer/popover y tipografías (Joaquín tampoco los vio); noticias con foto, álbumes, CRUD de sponsors y carrusel, egresos y balance; Tabla Única; "Vaciar Historial"; franja 769–799 px; dos pestañas o dos celulares a la vez; el tope de localStorage con fotos. Las capturas headless no bajan de ~500 px de ancho.
- **Bugs menores encontrados el 21/09/2026, sin arreglar:** (1) carrusel de noticias del hero: `heroSlides3D` se calcula antes de dibujar las noticias de `liga_noticias`, así que con noticias cargadas los botones y puntos quedan atados a las tarjetas fijas (no probado); (2) el buscador, al ir al fixture, no actualiza `fechaActivaFixture` y el fixture vuelve a la fecha anterior tras cambiar el filtro de ciclo; (3) goleadores y tarjetas comparan `j.dorsal == numDorsal` en `admin.js` (~770, ~789): un dorsal vacío de un dato viejo se confunde con el #0 (con arranque limpio no debería pasar); (4) comentario viejo en `main.js` ~1707 ("botones 1-7").
- **Resuelto (d9, 20/09/2026):** `main.js` ~95 ya resta puntos solo a la sanción "Quita de Puntos"; en las suspensiones `puntosRestados` guarda la cantidad de fechas. Verificado en el código.
- **Reglamento en PDF sin editar:** Arts. 7, 8, 12, 14, 16, 17, 17 Bis y el Art. 41 duplicado contradicen o no reflejan lo de la web.
- **Art. 8 (quita de 1 punto por deuda) no está automatizado.** En playoffs solo hay aviso de eliminado. Regla explicada por Joaquín (20/09/2026): si tras la fecha 1 un equipo queda debiendo y en la fecha 2 sigue con deuda, **recién en la fecha 2** se le descuenta 1 punto de la tabla por incumplimiento de pago (el reglamento dice: "queda con deuda hasta el próximo encuentro, donde debe abonar ambas fechas. Si no la cancela, se le quita 1 punto"). **Respuestas de Joaquín (20/09/2026):** (1) **el momento lo deciden ellos, hablando con el capitán del equipo y desde el Tribunal de Disciplina: NO debe aplicarse solo por fecha**; (2) el punto **se devuelve al pagar**; (3) **una sola vez por deuda**, no se repite en cada fecha. **Sin construir:** falta confirmar con Joaquín el diseño propuesto: botón "Aplicar quita de 1 punto (Art. 8)" en la tarjeta del equipo en Tesorería, que solo el Tribunal/Coordinador pulsa; crea una sanción "Quita de Puntos" de 1 punto (`origenAuto`, con marca de que ya se aplicó para esa deuda, así no se repite) que se levanta con fecha sola cuando el equipo cancela lo adeudado. Se apoyaría en `obtenerDeudaHistorica` y `sincronizarAusencias`. Mientras tanto, el Tribunal puede cargar la quita a mano (Tipo "Quita de Puntos", 1 punto), pero no se levanta sola.
- **Bug de goleadores al editar un partido: ARREGLADO (20/09/2026, aprobado por Joaquín).** Antes los campos "Dorsales Goleadores" (`#dorsales-goles-local` / `#dorsales-goles-visitante`) no se rellenaban al editar, y guardar sin volver a escribirlos borraba los goleadores y restaba los goles. Ahora se rellenan desde `goleadoresLocal/Visitante` (`dorsalesDeGoleadores` en `admin.js`). Sigue en pie el diseño de fondo (11.4 punto 5: los goles son un contador mutable sobre el jugador). **Sin decidir con Joaquín:** hoy, si en el campo de goleadores se escribe un dorsal que no existe en el plantel, `procesarDorsales` lo ignora en silencio (el gol no se asigna a nadie, no hay aviso); las tarjetas sí lo rechazan.
- **Avisos internos del staff: HECHO (22/09/2026, ver Hecho #16).** Extensible a otros avisos futuros (por ejemplo, si más adelante el Art. 8 o algo similar necesita avisar sin bloquear); hoy solo está conectado el caso del dorsal inválido en goles.
- **Módulo C (control de calidad): HECHO en gran parte con el banco (Hecho #14):** tablas, desempates (PTS → DIF → GF), saldo arrastrado y caja real ($1.415.000 contra $1.415.000). Falta el responsive (franja 769–799 px, celular real) y Tabla Única.
- **Fase 2 — Migración a Firebase: pedida por Joaquín el 20/09/2026 para apenas se cierre lo pendiente (no iniciada).** Guía completa, inventario de datos y trampas en la **sección 11**. Confirmar con Joaquín que se cerró el checklist 11.1 antes de arrancar.
- **Excluido por decisión del cliente:** Módulo E ("Plantilla de Pre..." cortado en el PDF).

**Respuestas de Joaquín (22/09/2026) a lo que dejó la simulación:**
- **Falla 7 (goleador con dorsal inexistente):** NO se rechaza. El resto del resultado se guarda igual (ese gol queda sin asignar, como hoy) y además se anota un aviso para el staff con equipo y partido. Ver el ítem de Pendiente "Avisos internos del staff" (todavía sin construir).
- **Playoffs en el fixture, sponsors/álbumes vacíos, noticia fija, fecha inicial del fixture, cantidad 0 en sanciones, campo de ubicación del sponsor: todos HECHOS (22/09/2026), ver Hecho #15.**
- **Corrección de DNI en todos los partidos del torneo:** confirmado, está bien así (ya lo hace `propagarCambioJugador`, Hecho #14).
- **CRUD de sponsors de punta a punta: PROBADO Y APROBADO (22/09/2026, `REPORTE-3.md`).** Esa corrida encontró que Instagram y teléfono no se mostraban juntos y que el logo no se comprimía; los dos quedaron resueltos después, ver Hecho #16 (sin re-probar todavía por un banco). Ojo con la migración: cada logo de sponsor se guarda como imagen dentro de `liga_sponsors` (dataURL), suma al tope de localStorage (ver 11.4 punto 11, va a Storage) — la compresión lo mitiga pero no lo elimina.

### Preguntas abiertas para Joaquín
- ¿Dominio propio o `*.web.app` de Firebase?
- (Resuelto 20/09/2026) No se conserva el histórico de tesorería: se arranca limpio.
- Un jugador suspendido tildado, ¿debe contar o no para el mínimo de 4 (hoy no cuenta, decisión mía sin confirmar, Pendiente ítem 4)?
- Si un partido se suspende o no se juega, ¿descuenta igual la fecha de la suspensión del jugador (hoy sí, cuenta cada fecha del ciclo se juegue o no, Pendiente ítem 3)?
- (Resuelto) Las suspensiones ya no restan puntos en la tabla; solo "Quita de Puntos". Ver 11.6 para las preguntas de la migración.

## 8. Cómo correr y probar

- Es estático: abrí `index.html` / `admin.html` directo, o serví la carpeta (`python -m http.server 8080` → `http://localhost:8080`).
- No hay build ni dependencias. **No hay `node` en el PATH.** Una sesión probó lógica con `Code.exe` y `ELECTRON_RUN_AS_NODE=1`; otra usó Edge headless para comprobar pantallas.
- Para probar con datos limpios, borrá las claves `liga_*` desde DevTools → Application → Local Storage.
- Todo cambio de UI hay que verlo en el navegador (desktop y ancho mobile ≤ 600 px) antes de darlo por terminado, o decir explícitamente que no se pudo.

## 9. Trabajo en paralelo con otros agentes

- Suele haber varias sesiones editando el mismo repo a la vez (hubo 4 en este ciclo: playoffs/sponsors, login/footer, Caja por Fecha, reglamento/tesorería). **Releé el archivo justo antes de editarlo** y no toques áreas ajenas a tu tarea.
- Antes de empezar, mirá `git status` y las secciones que vas a tocar: `#pantalla-admin`, los bloques `teso-*` y el footer ya fueron editados por más de una sesión.
- Editá con anclas chicas y únicas: los bloques grandes con líneas en blanco con espacios al final suelen fallar.
- No borres ni muevas archivos que no creaste. Si aparece algo que no reconocés (por ejemplo un `_test_*.html`), preguntá antes de borrarlo.
- Temporales y experimentos van al scratchpad de tu sesión, no al repo.
- Los entregables que no son parte de la web (Excel, informes, PDFs) van en `Claude outputs/`.
- Al terminar, reportá en pocas líneas: qué cambiaste (archivos y líneas), qué no pudiste verificar y qué encontraste de paso.

## 10. Plantilla para delegar una tarea nueva

Al crear un agente, pasale esto más el objetivo concreto:

> Leé `CLAUDE.md`. Tarea: **[qué hay que lograr y por qué]**. Alcance: **[archivos o secciones que puede tocar]**. No tocar: **[lo que no]**. Entregable: **[cambio en la web / archivo en `Claude outputs/` / reporte]**. Datos de entrada: **[semilla de data.js / export del navegador que pasa Joaquín]**. Verificación esperada: **[cómo se comprueba que quedó bien]**.

## 11. Guía de migración a Firebase (para el agente que la ejecute)

**Autorización:** Joaquín pidió el 20/09/2026 migrar todo a Firebase apenas no falte nada. Es un pedido condicionado: antes de arrancar, confirmá con él que se cerró el checklist 11.1 y que da luz verde. Todo lo de abajo sale de leer el código real (no de suposiciones); las líneas son aproximadas y cambian, buscá por nombre de función.

### 11.1 Checklist previo (cerrar antes de migrar, o acordar con Joaquín que va después)
1. Validación de jugadores: DNI obligatorio y único en todo el torneo, dorsal obligatorio 0–99 y único por equipo (Pendiente, ítem 2). **HECHO en la web**; en Firebase hay que volver a hacerla cumplir en el servidor.
2. Aviso de jugador suspendido en la lista de buena fe (Pendiente, ítem 3). **HECHO** y verificado por el banco.
3. Aviso con menos de 4 jugadores tildados (Pendiente, ítem 4). **HECHO** y verificado por el banco.
4. PDF del reglamento: Arts. 7, 8, 12, 14, 16, 17, 17 Bis, 41 duplicado, mínimo de 4 y aceptación. Textos ya redactados en el Pendiente.
5. Vista imprimible de respaldo de la lista de buena fe (hecha, ver Hecho #12; falta probarla con una impresora real).
6. Prueba de Joaquín en un celular real. Verificación en navegador: el banco (Hecho #14) cubrió casi todo; queda lo listado en Pendiente, "Qué falta probar en navegador".
7. Carga de tarjetas (Pendiente, ítem 9). **HECHA**, guardada en el partido y verificada por el banco.
8. Limpiar la semilla (Joaquín confirmó que se arranca limpio). **HECHO (22/09/2026):** `data.js` tiene equipos, partidos, sponsors y álbumes en `[]`; se quitaron "FECHA 5 CERRADA", "SE ACERCA LA FINAL" y los avisos por defecto. Solo queda la noticia fija "¡Y SE FUE!...".
9. Decisiones que dejó la simulación: todas respondidas por Joaquín el 22/09/2026 y **HECHAS** (Hecho #15), salvo el aviso de dorsal inválido en goles, que queda como feature nueva sin asignar ("Avisos internos del staff", Pendiente).
10. Sponsors: campo "ubicación" nuevo (form + guardado + render público) y su CRUD de punta a punta. **HECHO y PROBADO (22/09/2026, Hecho #15, `REPORTE-3.md`).**

### 11.2 Qué lee y escribe cada clave hoy (inventario completo)
Todo el acceso a datos es `localStorage` directo, repartido en `admin.js` (~65 puntos), `main.js` (~30) y `playoffs.js` (2). No hay una capa de datos: primero hay que crearla.

| Clave | Formato real | Escribe (admin) | Lee/escribe (público) |
|---|---|---|---|
| `liga_cicloSuperior`, `liga_cicloBasico` | Array de equipos con `jugadores[]` embebidos | `guardarEquiposEnStorage()` (equipos, jugadores, fichas, goles, alta en cancha) | Lee. Además `procesarLiga()` (main.js ~36) **pisa `ligaData` en memoria** con esto |
| `liga_partidos` | Array de partidos | Submit de partido, borrado, `sincronizarAusencias`, `guardarPartidosBF` (asistencia) | Lee |
| `liga_grupos` | `{superior:['A',…], basico:[…]}` | `guardarGruposEnStorage()` | Lee |
| `liga_sanciones` | Array | Tribunal + `sincronizarAusencias` (automáticas) | Lee |
| `liga_noticias` | Array (con foto dataURL) | Prensa | Lee |
| `liga_fotos_albumes` | Array `{id,titulo,portada,link}` | Prensa | Lee **y escribe la semilla** (main.js ~646) |
| `liga_sponsors` | Array | Sponsors CRUD | Lee **y escribe la semilla** (main.js ~608) |
| `liga_notificaciones` | Array `{id,titulo,texto,tipo,timestamp,leida}` | Avisos | **Lee y ESCRIBE** (ver 11.4, punto 1) |
| `liga_avisos_staff` | Array `{id,tipo,detalle,timestamp}` (`registrarAvisoStaff`) | Se genera solo, desde `procesarDorsales` (goles) | No — nunca debe ser pública ni legible por el rol Staff sin más (a definir con Auth/Rules quién la ve) |
| `liga_cruces_playoffs` | Array de cruces con `slot` | Armador, `procesarAvancePlayoff`, `migrarCrucesConSlot` (corre y escribe **en cada carga de admin**) | Lee |
| `liga_playoffs_publicados` | **String `'true'`/`'false'` global**, no por ciclo ni por ronda | Botón publicar/ocultar | Lee |
| `liga_playoffs_config` | `{superior:{rondaInicial,slots}, basico:{…}}` | `guardarConfigPlayoffs` (playoffs.js) | Lee |
| `liga_formato_torneo` | `{superior:'grupos'\|'unico', basico:…}` | Toggle Tabla Única | Lee |
| `liga_tesoreria_partidos_v2` | Objeto por clave `F{fecha}_{idPartido}_{local\|visita}_{nombre en minúsculas}` → `{ef,tr,arancel?,asistencia?,asistenciaAuto?,sancionDescartada?}` | Tesorería | No |
| `liga_tesoreria_inscripciones` | Objeto por **nombre** de equipo → `{ef,tr}` | Tesorería | No |
| `liga_valor_inscripcion` | String numérico (default 3000) | Tesorería | No |
| `liga_egresos` | Array | Tesorería | No |
| `liga_caja_movimientos` | Array `{id (Date.now()+Math.random()),equipo (texto),concepto,detalle,medio,monto,fechaHora}` | `registrarMovimientoCaja` | No |

Campos de `liga_partidos` que la tabla de la sección 4 no lista: `grupo` ('A'… o 'Playoffs'), `localId`/`visitanteId` (id estable del equipo; los partidos viejos y la semilla **no los tienen**), `ronda`, `penalesLocal/Visitante`, `arbitro`, `horario` (`''` = "a confirmar"), `dia` ('DD/MM/AAAA'), `arancelExigido`, `goleadoresLocal/Visitante` (`[{nombre:'Nombre (#7)', cantidad}]`), `resultadoAuto` (3-0 automático), `asistentesLocal/Visitante`.
Campos de sanciones automáticas: `origenAuto`, `claveTeso`, `levantada`, `fechaLevantada`. Ids: `Date.now()` (partidos, sanciones, cruces), `id` numérico en equipos (1–20 Superior, 101–109 Básico en la semilla).

### 11.3 Diseño recomendado (ajustable)
- Colecciones: `equipos`, `jugadores` (público: nombre, dorsal, foto, goles) y `jugadoresPrivado` (ver 11.4 punto 4), `partidos`, `sanciones`, `noticias`, `albumes`, `sponsors`, `notificaciones`, `crucesPlayoffs`, `tesoreriaPartidos`, `tesoreriaInscripciones`, `egresos`, `cajaMovimientos`, `usuarios`, y un doc `config/*` para grupos, formato, playoffs (publicados + config) y valor de inscripción.
- SDK modular v9+ desde CDN con `<script type="module">`, sin bundler. Sigue valiendo: solo dos HTML y JS en `JAVASCRIPT/` (por ejemplo `firebase-config.js` y `firestore-service.js`). `main.js`, `admin.js` y `playoffs.js` hoy son scripts planos sin módulos: hay que decidir cómo convivir (por ejemplo, la capa de datos expone globales).
- Orden: (1) capa de abstracción con la misma forma de datos que hoy, (2) público solo lectura, (3) admin sin tesorería, (4) tesorería y roles al final con las Security Rules ya probadas, (5) `onSnapshot` en partidos y cruces, (6) Auth, (7) Hosting. Storage para fotos.
- Usar la persistencia offline de Firestore: la lista de buena fe se usa en la cancha con señal mala.

### 11.4 Trampas que rompen la migración si se copian tal cual
1. **El público no debe escribir nunca.** Hoy `main.js` escribe: siembra `liga_sponsors` y `liga_fotos_albumes` (~616, ~654) y "Marcar leídos" / "Limpiar" (~1917, ~1928) **modifican el array global de avisos**. (Los avisos por defecto ya no se siembran desde el 21/09/2026.) En Firebase, "leído" y "limpiar" del visitante tienen que ser **estado local del dispositivo** (una clave nueva de localStorage), no cambios en el documento compartido.
2. **Semilla y fallback a `ligaData`:** hoy, si una clave no existe, se usa `data.js`. Desde el 21/09/2026 `data.js` trae equipos y partidos vacíos, pero sigue trayendo sponsors y álbumes. Definir una carga inicial única explícita, y quitar el fallback del público o dejarlo vacío. `main.js` reasigna `ligaData.cicloSuperior/cicloBasico/partidos/sanciones` en cada `procesarLiga()`: la capa de datos tiene que alimentar `ligaData` o hay que refactorizar esas lecturas.
3. **Las posiciones se calculan en el cliente**, no se guardan: `procesarLiga()` resetea `pj,g,e,p,gf,gc,dif,pts` de cada equipo y recalcula desde `liga_partidos` (`jugado` y no `esPlayoff`) más las sanciones de tipo "Quita de Puntos". Los `pj/pts` guardados en el documento del equipo **no son fuente de verdad**; no los migres como si lo fueran. Cada visitante lee todos los partidos: con ~100 partidos está bien, pero es lo que consume la cuota gratis (Spark).
4. **Datos personales de menores.** El documento de equipo trae por jugador `dni`, `nacimiento`, `celular`, `fichaMedica`, `medico`, `medicoDir`, `concurrir`, `concurrirDir`, `familiarNombre/Parentesco/Tel`, `instagram`. El público lee ese objeto entero desde el navegador. Si `equipos` pasa a lectura pública en Firestore, **se expone todo**. Separar: lo público (nombre, dorsal, foto, goles, PJ, instagram) y lo privado (todo lo demás) en documentos distintos, este último legible solo por Staff/Coordinador. Además, `asistentesLocal/Visitante` guardan `dni || nombre` como id del jugador dentro de `partidos` (que es público): hay que cambiarlos por un `jugadorId` interno **y migrar los ya guardados**, o el DNI queda expuesto. `dia`, `arancelExigido` y `arbitro` dentro del partido son datos de bajo riesgo.
5. **Goles por jugador = contador mutable.** Al guardar un partido, `admin.js` (~681-728) revierte los goles del partido viejo y suma los nuevos sobre `jugador.goles` (lectura-modificación-escritura sobre otro documento), identificando al jugador por **dorsal** y parseando `#(\d+)` del texto `'Nombre (#N)'`. Con varios administradores a la vez eso se corrompe. Recomendación: derivar goleadores de los partidos (fuente de verdad = `goleadoresLocal/Visitante`) o usar transacciones. Depende de que el dorsal sea único (11.1, ítem 1). **Las tarjetas ya siguen esa regla** (Pendiente, ítem 9): se guardan en el partido (`amarillasLocal/rojasLocal/amarillasVisitante/rojasVisitante`, con el DNI del jugador) y los totales se derivan; los goles todavía no.
6. **Todos los guardados reescriben el arreglo completo.** `guardarPartidosBF`, el submit de partidos, etc. hacen `setItem('liga_partidos', JSON.stringify(partidos))`. Con Firestore y tres celulares marcando asistencia, el último en guardar **pisa a los otros**. Pasar a escrituras por documento, y para la asistencia usar `arrayUnion/arrayRemove` sobre el partido (o un documento por tildado).
7. **Claves de Tesorería atadas al nombre del equipo.** Inscripciones va por `eq.nombre.trim()`; partidos por `F{fecha}_{idPartido}_{lado}_{nombre}`; el saldo a favor arrastrado se agrupa por nombre en minúsculas (`calcularTesoreriaPartidos`); la caja guarda el nombre como texto. Renombrar un equipo hoy rompe todo eso. Migrar a `equipoId` + `partidoId` y convertir las claves existentes (ya está `localId/visitanteId` en partidos nuevos; los viejos hay que completarlos por nombre). Casi todo `main.js`/`admin.js` busca equipos con `find(e => e.nombre.trim()…)`.
8. **`sincronizarAusencias()` tiene efectos secundarios y se ejecuta al renderizar Tesorería** (`renderizarTesoreriaPartidos`): crea, levanta y borra sanciones, carga o deshace un 3-0 y escribe en tres colecciones. Con varios clientes abiertos se van a pisar y duplicar. Hacerlo idempotente con ids determinísticos (usar `claveTeso` como id de la sanción automática), ejecutarlo solo tras una escritura explícita (o en una Cloud Function), y probarlo con dos pestañas.
9. **`migrarCrucesConSlot` corre y guarda en cada carga de admin.** Convertirlo en migración de una sola vez.
10. **Estado en memoria por pestaña:** `admin.js` carga todo al inicio (`let partidos = …`) y `recargarPools()` vuelve a leer localStorage. Con `onSnapshot` hay que reemplazar eso por una caché que se actualiza sola, sin re-renderizar los desplegables abiertos ni perder el scroll (la lista de buena fe abierta no debe cerrarse al llegar un cambio ajeno).
11. **Imágenes:** fotos de jugadores (250 px) y de noticias (1000 px) se comprimen a JPEG en el navegador y quedan como **dataURL dentro** de `liga_ciclo*` y `liga_noticias`. A Storage, guardando la URL (Firestore limita 1 MB por documento). Sponsors y álbumes de la semilla usan rutas relativas a `Recursos/` (esas pueden seguir así). Se descarta el widget "Espacio de Almacenamiento" (Resumen) y `guardarClaveConAviso`, que existen por el tope de ~5 MB de localStorage.
12. **Auth y roles:** hoy es solo cosmético (sección 6). El Coordinador ve tesorería total, egresos, balance y Caja por Fecha; Staff marca pagos y usa la lista de buena fe pero no ve totales. Las Security Rules tienen que hacer cumplir eso: lectura pública de equipos/jugadores públicos, partidos, sanciones, noticias, álbumes, sponsors, notificaciones, cruces y config; **nada público** de tesorería, egresos, caja ni datos personales. Reemplazar `#selector-rol-usuario` y la maqueta de login de `#pantalla-admin`.
13. **Ordenamiento de fechas:** los playoffs usan números ≥ 100 en `fecha` (108/104/102/100) y se ordenan con `ordenCronologicoFecha()`. No ordenar `fecha` con un `orderBy` simple.
14. **Datos existentes: decidido por Joaquín (20/09/2026), se arranca LIMPIO con el torneo nuevo.** No hay que importar nada del `localStorage` actual ni conservar el histórico de `liga_tesoreria_partidos_v2`: no hace falta un import ni migrar claves viejas (esto simplifica el punto 7 y la migración de ids del punto 4: solo aplica al código nuevo). Tampoco cargar la semilla de `data.js`. Los equipos, jugadores y partidos del torneo nuevo se cargan desde el panel ya sobre Firebase. No hay `node` en el PATH: el emulador de Firebase probablemente no corra, así que probar contra un proyecto de prueba y con el simulador de reglas de la consola.

### 11.5 Reglas de negocio que la migración tiene que conservar
- Empate de tabla: PTS → DIF → GF. Clasifican los 3 primeros de cada grupo + el mejor 4°; Tabla Única opcional (Bombos). Playoffs no suman a la tabla de grupos.
- Art. 17 Bis (sección 6): sanción −2 PTS por ausencia sin abonar el 50%, se levanta con fecha al pagar, 3-0 automático si el rival abonó el 100%, saldo a favor arrastrado.
- Solo la sanción "Quita de Puntos" resta puntos; en las suspensiones `puntosRestados` guarda la cantidad de fechas.
- **PJ del jugador:** cuentan solo los partidos `jugado` **sin** `resultadoAuto` en los que el staff lo tildó en la lista de buena fe. **Un 3-0 automático NO cuenta como PJ** (decisión de Joaquín, 20/09/2026; ya implementado en `main.js` ~1957).
- La lista de buena fe digital **no carga goles ni resultado**: eso queda en Carga de Partidos.
- Un jugador no puede figurar sin DNI ni sin dorsal; dorsal 0 a 99, único por equipo; DNI único en todo el torneo, salvo que el jugador pase a otro equipo sin haber jugado ningún partido con el anterior (ver Pendiente, ítem 2). La migración a Firebase tiene que hacer cumplir esto también en el servidor (Security Rules o Cloud Function), no solo en el formulario.
- Sin números fijos de equipos ni de llaves (sección 1).

### 11.6 Preguntas para Joaquín antes de empezar
- ¿Dominio propio o `*.web.app`?
- (Resuelto 20/09/2026) Se arranca limpio con el torneo nuevo, sin importar datos ni histórico de tesorería.
- (Resuelto 20/09/2026) Se construye la carga de tarjetas (Pendiente, ítem 9).
- ¿Quién tiene cuenta de Coordinador y quiénes son Staff (para las reglas)?
