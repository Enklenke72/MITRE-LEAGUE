# Simulación de un torneo completo antes de migrar a Firebase (21/09/2026)

**Para:** Joaquín y los agentes que hagan los arreglos.
**Alcance:** solo pruebas. **No se modificó ningún archivo de la web.** Todo corrió sobre una copia en el scratchpad de la sesión.

## Cómo se probó

Un script (`banco.js` en esta carpeta) maneja **la interfaz real** de `admin.html` en Edge headless: completa formularios, hace clic en botones, tilda la lista de buena fe y carga pagos. Después abre `index.html` y compara lo que muestra con lo que se cargó.

- Torneo simulado: Superior con 3 grupos de 4 equipos (A, B y C) y Básico con 1 grupo de 4. En total, 16 equipos y 92 jugadores (algunos con ficha médica y datos de emergencia, y uno con el dorsal 0).
- Se cargaron 3 fechas: 24 partidos con día, horario (uno "a confirmar"), cancha, árbitro y arancel.
- En cada fecha: lista de buena fe tildada, pagos (efectivo y transferencia), resultados, goleadores y tarjetas.
- Tribunal: una suspensión de 2 fechas por roja, una quita manual de 1 punto y una advertencia.
- Art. 17 Bis: un equipo faltó sin aviso (3-0 automático y −2), después pagó el 50% y se le levantó la quita. También se probaron el saldo a favor y la deuda arrastrada.
- Playoffs: Superior desde Cuartos con 4 llaves y Básico desde Semis con 2. Hubo un empate sin penales que después se corrigió con penales, y una final definida por penales. Luego se publicaron.
- Web pública: tablas, mejor 4°, goleadores, modales de 6 equipos (PJ, goles y tarjetas por jugador), desplegables del fixture, Tribunal, bracket, campanita y buscador.
- Capturas a 390 px de ancho: tabla, fixture, bracket, Tribunal y lista de buena fe.

**Resultado final: 107 PASS y 20 FAIL.** Algunos FAIL son el mismo bug visto desde lugares distintos. El detalle completo está en `resultado-2026-09-21.txt`.

Para volver a correrlo: copiar el sitio a una carpeta y agregar al final de `JAVASCRIPT/data.js` la línea que vacía la semilla (`if (!location.search.includes("semilla")) { ligaData.cicloSuperior = []; ligaData.cicloBasico = []; ligaData.partidos = []; }`). Después poner ahí `banco.html` y `banco.js`, servirla con `python -m http.server` y abrir `banco.html`. El resultado aparece en la página. En Edge headless usar **siempre `--user-data-dir` con ruta absoluta**.

---

## Fallas, de la más grave a la menos grave

### ALTA: bloquean o corrompen el trabajo del staff

**1. "Editar" un partido de otro grupo deja Local y Visitante vacíos, y al guardar sale "¡Un equipo no puede jugar contra sí mismo!"**
- Pasos: en Carga de Partidos, editar un partido del Grupo A. Guardar. Tocar "Editar" en un partido del Grupo B, poner los goles y guardar.
- Esperado: que se guarde el resultado.
- Pasó: el formulario cambia el grupo pero sigue con la lista de equipos del grupo anterior. Local y Visitante quedan en blanco y el guardado se rechaza. En la simulación pasó **9 veces** en 3 fechas. El staff tiene que volver a elegir el grupo y los dos equipos a mano. Si no se da cuenta, puede terminar guardando el partido con otros equipos.
- Dónde: `admin.js` ~576-578, en el clic de `.btn-editar-partido`. Cambia `grupoSelect.value` sin volver a llamar a `filtrarEquiposPorGrupo()`.

**2. En Equipos y Planteles, "Baja" dice "La ficha fue eliminada" pero el jugador sigue guardado. El botón OK/Debe de la ficha tampoco guarda.**
- Pasos A: abrir el plantel de un equipo. Ir a Carga de Partidos y cambiar el selector de Fecha. Volver a Planteles, tocar "Baja" y confirmar dos veces. Aparece el cartel de eliminado, pero el jugador sigue en `liga_cicloBasico`.
- Pasos B: intentar agregar un jugador con un dorsal repetido (se rechaza, bien) y en seguida tocar OK/Debe de la ficha de otro jugador de la tabla. No se guarda el cambio.
- Causa: los botones de la tabla guardan una referencia al equipo de cuando se dibujó la tabla. Varias acciones vuelven a leer los equipos desde localStorage (`recargarPools()`), entre ellas el submit del jugador aunque sea rechazado, las otras pestañas y el selector de fecha. Después de eso, los cambios se hacen sobre una copia vieja y el guardado los pisa. Las pestañas del panel no vuelven a dibujar la tabla al volver.
- Dónde: `admin.js` ~1528-1605 (eventos de `renderizarTablaJugadores`), ~1612 (`recargarPools()` en el submit) y ~3679 (pestañas).

**3. Un jugador con dorsal 0 no se puede editar.**
- Pasos: en Planteles, tocar "Editar" en un jugador #0, cambiar cualquier dato (por ejemplo el Instagram) y guardar.
- Pasó: el campo N° aparece vacío y al guardar sale "El número de camiseta es obligatorio y va de 0 a 99". No se puede guardar nada de ese jugador.
- Dónde: `admin.js` ~1548 (`j.dorsal || ''`).
- Mismo problema al mostrar el dorsal 0:
  - La tabla de Planteles muestra "#1" en vez de "#0" (`admin.js` ~1507).
  - El modal SOS muestra "(#-)" (`admin.js` ~1726).
  - El modal público del equipo muestra "-" (`main.js` ~2018).
  - La lista de buena fe y la planilla impresa sí muestran 0.

**4. Arrancar con el `data.js` actual mete datos del torneo anterior.** Ya está en 11.1 punto 8, pero ahora está confirmado con números.
- Con localStorage vacío, abrir admin guarda 3 partidos viejos en `liga_partidos`.
- Crear el primer equipo del torneo nuevo deja **21 equipos guardados** (los 20 viejos más el nuevo).
- Con `data.js` vaciado (equipos y partidos en `[]`) todo anduvo bien. **Hay que vaciarlo antes de cargar el torneo real.**
- También quedan ejemplos fijos del torneo anterior: una noticia "FECHA 5 CERRADA" en `index.html` ~188 y los avisos por defecto de la campanita en `main.js` ~1785.

### MEDIA: datos que se pierden o no se ven

**5. Corregir el DNI de un jugador que ya jugó le borra los PJ.** En la prueba pasó de 3 a 0. La asistencia, las tarjetas y el vínculo con su suspensión se guardan por DNI y no se reescriben al editarlo. Ya estaba anotado en el Pendiente, ítem 2, como algo por hacer.

**6. Cambiar el dorsal de un jugador que ya hizo goles rompe los goleadores de sus partidos.** Se cambió un #7 con 2 goles a #17 y se volvió a guardar el partido. El partido quedó con 1 goleador en lugar de 3 (se perdieron los 2 goles del jugador en el desplegable), aunque su contador personal siguió en 2. La causa es que los goleadores se guardan como texto "Nombre (#7)" y se reconocen por el dorsal (11.4 punto 5).

**7. Un goleador con un dorsal que no existe se ignora sin avisar.** Se cargó "5, 88" en un partido 2-2 y quedó registrado un solo goleador. Las tarjetas, en cambio, sí rechazan el dorsal inexistente. Esto ya figuraba como "sin decidir".

**8. Las tarjetas no aparecen en los desplegables de partido** (ni en el fixture ni en el modal del equipo). Solo se ven los totales por jugador en el modal, y esos totales son correctos. Los desplegables leen `tarjetasLocal` / `tarjetasVisitante`, campos que ya no existen. Hoy se guardan como `amarillasLocal` / `rojasLocal` / `amarillasVisitante` / `rojasVisitante`. Dónde: `main.js` ~1419-1430 y ~2070-2081.

**9. El fixture público solo tiene botones fijos de Fecha 1 a 6** (`index.html` ~495-500).
- La Fecha 7, que el admin permite cargar, no se puede ver.
- Los partidos de playoffs (día, horario, cancha y goleadores) tampoco tienen dónde verse, salvo el bracket.
- Esto va contra la regla de "nada de números fijos".

### BAJA: prolijidad

**10. En el Tribunal público aparece "Acta N° 2" dos veces.** La sanción automática guarda el acta como número (`2`) y el formulario la guarda como texto (`"2"`), así que se arman dos botones con el mismo contenido. Dónde: `main.js` ~1011.

**11. Los playoffs salen en orden inverso: Final, Semis, Cuartos.**
- Pasa en el filtro de fechas del cronograma del admin (`admin.js` ~355), en Tesorería (`admin.js` ~3124) y en el modal público del equipo (`main.js` ~2057).
- En el modal, además, se leen como "FECHA 102" / "FECHA 104" en vez de Semifinal / Cuartos.
- Los tres ordenan con `a.fecha - b.fecha` en vez de `ordenCronologicoFecha()`.

**12. En el bracket público aparece el botón "Octavos" (y viene activo) aunque el ciclo arranca en Cuartos.** El código le pone `hidden`, pero la regla `display` de `.tab-btn` lo pisa. Se ve en la captura a 390 px.

**13. Una "Quita de Puntos" con la cantidad vacía se guarda como `null`.** No resta nada y no avisa. Dónde: `admin.js` ~1901, con `parseInt('')`.

**14. (Leído en el código, no probado)** La cabecera de cada partido en Tesorería muestra "14:20 hs" cuando el horario está "a confirmar" (`admin.js` ~3135, `p.horario || '14:20'`).

**15. Detalle de CLAUDE.md:** la sección 4 dice que `liga_formato_torneo` usa `'unica'`, pero el valor real es `'unico'`. El código es coherente; solo está mal el documento.

---

## Lo que funcionó bien (verificado)

- **Grupos y equipos:** gestor de grupos, alta de equipos y rechazo de un nombre repetido (aunque cambien mayúsculas o espacios).
- **Validaciones de jugador:** dorsal repetido, dorsal vacío y dorsal 100 se rechazan. El traslado entre equipos funciona: pide confirmación, al cancelar no cambia nada y reconoce el DNI aunque se escriba con puntos. El alta en cancha rechaza el DNI de alguien que ya jugó en otro equipo.
- **Carga de partidos:** 24 partidos con ids únicos, `localId` / `visitanteId`, horario a confirmar y rechazo de un equipo contra sí mismo.
- **Goleadores y tarjetas:**
  - Dos goles del #0 se agrupan como "(#0) (2)".
  - Editar sin cambiar nada no duplica goles.
  - Pasar un resultado de 2-1 a 3-1 actualiza bien el contador.
  - Al editar, goleadores y tarjetas vuelven a aparecer cargados.
  - Una tarjeta con dorsal inexistente se rechaza sin guardar nada.
- **Art. 17 Bis:** 3-0 automático, sanción −2, quita levantada con fecha al pagar el 50% y banner "Quita levantada" en el modal público.
- **Tesorería:**
  - Saldo a favor de $10.000 aplicado en la fecha siguiente, y deuda arrastrada de "$10.000 (F2)".
  - Caja por Fecha igual a la suma de pagos ($1.415.000).
  - Inscripciones: cálculo correcto, "AL DÍA" y movimiento registrado en la Caja.
  - El rol Staff oculta los totales (solo cosmético).
- **Lista de buena fe:**
  - Tildar pone solo al equipo "Se presentó".
  - Aviso "Faltan 1 para poder jugar" con 3 tildados.
  - "SUSPENDIDO · Acta 1 · 2 fechas" aparece en las fechas 2 y 3 y no en la del acta, con la fila en rojo si está tildado.
  - Alta en cancha con #0 y botón de ficha FALTA/OK.
- **Planilla imprimible:** una hoja por partido, 10 filas por equipo, sin Goles ni RESULTADO, con SUSPENDIDO en la celda Firma y el N° 0 visible.
- **Playoffs:**
  - Configuración por ciclo y armador limitado a las rondas vigentes.
  - Al pisar una llave ocupada pide confirmación.
  - Un empate sin penales no hace avanzar a nadie; al corregirlo con penales sí avanza.
  - Semis y Final se arman solas en los dos ciclos.
  - Campeón correcto en el bracket y penales visibles.
- **Web pública:**
  - Las 4 tablas coinciden con el cálculo propio (PTS → DIF → GF, con la quita manual y el 3-0).
  - Top 3 y mejor 4° resaltados.
  - Goleadores correctos.
  - PJ, goles, amarillas y rojas por jugador correctos en los modales. El 3-0 automático no suma PJ.
  - Desplegables del fixture con marcador y goleadores en los 24 partidos.
  - Suspensión visible en el Tribunal, aviso en la campanita y buscador.
- **Sin errores de JavaScript** en toda la simulación, y sin desborde horizontal de la página a 390 px.

## Lo que no se pudo verificar

- Celular real e impresora real.
- Captura a 390 px del modal del equipo: la captura headless salió en blanco. El contenido del modal sí se verificó por DOM.
- Noticias con foto, álbumes, CRUD de sponsors, egresos y balance general.
- Tabla Única (Bombos).
- La franja de 769 a 799 px.
- Dos pestañas o dos celulares a la vez: es el problema de la migración, 11.4 puntos 6 y 8.
- El tope de ~5 MB de localStorage con fotos.

## Recomendación antes de migrar

Arreglar los puntos 1 a 4 (el 4 es vaciar `data.js` y los ejemplos fijos) y decidir el 8 y el 9. El resto se puede resolver durante la migración o quedar anotado. Después de los arreglos, volver a correr este banco: tendría que terminar sin FAIL en esos puntos.
