# Segunda corrida de la simulación, con los arreglos aplicados (21/09/2026)

**Para:** Joaquín y los agentes que hacen los arreglos.
**Alcance:** solo pruebas. **No se modificó ningún archivo de la web.** El banco corrió sobre una copia del repo actual en el scratchpad.

## Cómo se probó

Se usó el mismo banco que en `REPORTE.md`: un torneo simulado de 16 equipos, 92 jugadores, 3 fechas y playoffs de los dos ciclos, cargado desde `admin.html` y verificado en `index.html` con Edge headless. Además hubo dos capturas a 390 px (bracket y fixture).

Ajustes al banco, solo donde el comportamiento cambió a propósito:
- El conteo de goles en los desplegables ya no cuenta las filas de tarjetas, que ahora también muestran "(#N)".
- Los botones del fixture se validan contra las fechas que existen (1, 2 y 3), en lugar de exigir un botón fijo de Fecha 7.
- Que los playoffs no estén en el fixture queda como información, porque está sin decidir.
- Controles nuevos:
  - Tarjetas en el desplegable del modal.
  - Nombres y orden de las rondas en el modal.
  - Botón "Octavos" oculto en el bracket.
  - "A confirmar" en Tesorería.
  - Suspensión sin cantidad rechazada.

El banco actualizado quedó en `banco.js` y el resultado crudo en `resultado-2-2026-09-21.txt`.

**Resultado final: 129 PASS y 1 FAIL.** El único FAIL es la falla 7 (goleador con un dorsal inexistente), que está sin decidir a propósito. **No se encontraron regresiones.**

---

## Las 20 fallas de la primera corrida

| # (REPORTE.md) | Falla | Ahora |
|---|---|---|
| 1 | Editar un partido de otro grupo dejaba Local y Visitante vacíos | **Pasa.** Se cargaron las 3 fechas por "Editar" sin ningún caso (0 contra 9 en la primera corrida) |
| 2 | "Baja" y el botón OK/Debe de la ficha no guardaban en Planteles | **Pasa.** La baja después de pasar por otra pestaña y el botón de ficha después de un alta rechazada guardan bien |
| 3 | No se podía editar a un jugador con dorsal 0 | **Pasa.** Se edita y se guarda, y el 0 se ve en la tabla de Planteles, en el SOS y en el modal público |
| 4 | La semilla de `data.js` se mezclaba con el torneo nuevo | **Pasa.** Con el `data.js` real, abrir admin no guarda partidos y el primer equipo deja 1 solo guardado. La campanita no trae avisos de ejemplo |
| 5 | Corregir el DNI borraba los PJ | **Pasa.** Los PJ quedan en 3 antes y 3 después |
| 6 | Cambiar el dorsal de un goleador perdía sus goles | **Pasa.** El partido conserva "(#17) x2" más "(#9) x1" |
| 7 | Un goleador con dorsal inexistente se ignora sin aviso | **Sigue.** Sin decidir a propósito, no es regresión |
| 8 | Las tarjetas no aparecían en los desplegables | **Pasa.** El fixture y el modal muestran amarillas y rojas con cantidad (por ejemplo "#5 (2)") |
| 9 | El fixture tenía botones fijos de Fecha 1 a 6 | **Pasa.** Los botones salen de las fechas que existen. Los playoffs en el fixture siguen sin decidir |
| 10 | "Acta N° 2" aparecía dos veces en el Tribunal | **Pasa.** Quedan Acta 1, 2 y 3, sin duplicados |
| 11 | Los playoffs salían en orden inverso | **Pasa** en el cronograma, en Tesorería y en el modal (CUARTOS, SEMIFINAL) |
| 12 | Aparecía el botón "Octavos" con un bracket que arranca en Cuartos | **Pasa.** Queda oculto y la pestaña activa es Cuartos. Verificado también en la captura |
| 13 | La Quita de Puntos sin cantidad se guardaba como `null` | **Pasa.** Se rechaza con "Falta la cantidad…". La Suspensión sin cantidad también se rechaza |
| 14 | Tesorería mostraba "14:20 hs" en un partido sin horario | **Pasa.** Ahora dice "(A confirmar)" |
| 15 | Error en CLAUDE.md (`'unica'` en vez de `'unico'`) | No se volvió a revisar: es documentación, no código |
| Otros FAIL de la primera corrida | Las tablas B y C, el mejor 4°, los PJ de los modales y "Editar 2-1 → 3-1" | **Pasan todos.** Eran consecuencia de la falla 1 |

## Regresiones nuevas

Ninguna. Toda la simulación corrió **sin errores de JavaScript**.

Todo lo que ya andaba bien en la primera corrida sigue andando:
- Art. 17 Bis y saldo a favor o deuda arrastrada.
- Caja por Fecha ($1.415.000 contra $1.415.000) e inscripciones.
- Lista de buena fe: mínimo de 4 jugadores, suspendidos y alta en cancha.
- Planilla imprimible.
- Avance de playoffs y campeones.
- Tablas, goleadores y buscador.

**Único punto que parecía raro, descartado:** en la captura del bracket a 390 px el título resaltado era "TABLA DE POSICIONES". Por DOM se comprobó que las clases cambian bien (`active` y `opaco`) al alternar entre las vistas. Fue la captura agarrando la animación a mitad de camino, no una falla.

## Lo que no se pudo verificar

Es lo mismo que en la primera corrida:
- Un celular real y una impresora real.
- Una captura a 390 px del modal del equipo. Su contenido se verificó por DOM.
- Noticias con foto, álbumes, CRUD de sponsors, egresos y balance general.
- Tabla Única.
- La franja de 769 a 799 px.
- Dos pestañas o dos celulares a la vez (11.4 puntos 6 y 8).
- El tope de localStorage con fotos.
- **Aclaración:** en `propagarCambioJugador` se probó el efecto en los PJ y en los goleadores. **No** se probó por separado que la suspensión del Tribunal siga funcionando cuando se cambia el DNI del jugador suspendido.

## Conclusión

Desde el punto de vista de estas pruebas, las fallas que bloqueaban la migración están resueltas. Antes de migrar quedan solo decisiones pendientes:
- La falla 7.
- Los playoffs en el fixture.
- Los sponsors y álbumes de la semilla.
- El resto del checklist 11.1: PDF del reglamento y prueba en un celular real.
