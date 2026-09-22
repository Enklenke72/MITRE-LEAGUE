# Cuarta corrida: avisos internos, contactos de sponsor y logo comprimido (22/09/2026)

**Para:** Joaquín y los agentes que hacen los arreglos.
**Alcance:** solo pruebas. **No se modificó ningún archivo de la web.** El banco corrió sobre una copia del repo actual en el scratchpad.

## Cómo se probó

El mismo banco de los reportes anteriores (torneo de 16 equipos, 92 jugadores, 3 fechas, playoffs de los dos ciclos y sponsors de punta a punta), cargado desde `admin.html` y verificado en `index.html` con Edge headless.

Cambios en el banco para esta vuelta:
- El caso del gol con dorsal inexistente pasó de "se ignora en silencio" (que se marcaba como FAIL a propósito) a verificar el aviso interno completo.
- El sponsor con Instagram y teléfono ahora tiene que mostrar los dos.
- El logo de prueba pasó de una imagen chica a una **grande de verdad**: PNG con ruido de 2400 × 1600, que pesa 3.140 KB.

**Resultado final: 167 PASS y 0 FAIL.** Es la primera corrida sin ninguna falla. **No se encontraron regresiones.**

El banco actualizado quedó en `banco.js` y el resultado crudo en `resultado-4-2026-09-22.txt`.

---

## 1. Aviso interno por gol con dorsal inexistente (resuelve la falla 7)

Se cargó el partido de la Fecha 2 entre 4to 3ra y 6to 2da (2-2), poniendo como goleadores locales los dorsales "5, 88", donde el 88 no existe en el plantel.

- **El resto del resultado se guarda igual que antes:** el partido queda jugado, con el 2-2, el gol del #5 del local y los dos goleadores del visitante.
- **Queda un aviso y uno solo**, con el texto: *"Gol cargado con el dorsal #88 en 4to 3ra (Fecha 2 vs 6to 2da), pero no hay ningún jugador con ese número en el plantel."* Están el dorsal, el equipo, la fecha y el rival.
- **La pestaña "Avisos Internos" lo muestra** con su hora relativa y su botón Eliminar.
- **"Vaciar Historial" funciona y pide confirmación:** si se cancela, el aviso queda; al confirmar, la lista queda en "No hay avisos pendientes".
- Ninguna otra carga del torneo (24 partidos de grupos y 10 de playoffs) generó avisos de más: el único aviso fue el del 88.

## 2. Sponsor con Instagram y teléfono

- La tarjeta pública del sponsor que tiene los dos ahora muestra **"@kioscoelgol" y "221 555-0001"**, los dos. Antes mostraba solo el Instagram.
- El sponsor que solo tiene teléfono sigue mostrando el teléfono.
- La ubicación sigue igual: link si arranca con "http", texto si no, y nada si no tiene.

## 3. Logo de sponsor comprimido

Se subió un PNG de 2400 × 1600 con ruido, de **3.140 KB**:

- Se guarda como **JPEG de 15 KB**, unas 200 veces más liviano.
- Queda redimensionado a **500 × 333**, que respeta el máximo de 500 px de lado.
- Se ve bien en el panel y en la tarjeta del carrusel, y sigue siendo una imagen válida (se midió cargándola).
- Al editar el sponsor sin volver a subir el logo, el logo comprimido se conserva.

Esto también baja bastante el riesgo que había marcado en el REPORTE-3 sobre el espacio del navegador: antes un logo se guardaba crudo.

## 4. Regresiones

Ninguna. Toda la simulación corrió **sin errores de JavaScript** y sigue pasando todo lo anterior:
- Carga de partidos y edición entre grupos (0 casos de Local/Visitante vacíos).
- Art. 17 Bis, saldo a favor y deuda arrastrada; Caja por Fecha ($1.415.000 contra $1.415.000) e inscripciones.
- Lista de buena fe con mínimo de 4 jugadores, suspendidos y alta en cancha; planilla imprimible.
- Playoffs: avance, campeones, bracket y partidos en el fixture.
- Tablas, mejor 4°, goleadores, modales, Tribunal, campanita y buscador.
- Sponsors: alta, edición, orden, baja y carrusel.

## 5. Dos cosas para tener en cuenta (no son fallas)

1. **Si se vuelve a guardar el mismo partido sin corregir el dorsal, el aviso se registra otra vez.** No lo probé; lo digo por cómo está escrito el código: el aviso se crea cada vez que se procesan los goleadores. Editar tres veces un partido con el dorsal mal dejaría tres avisos iguales. Si molesta, se puede evitar repetir el mismo aviso; si no, alcanza con "Vaciar Historial".
2. **`liga_avisos_staff` no está en el inventario de datos de CLAUDE.md** (ni en la tabla de la sección 4 ni en la 11.2, que lista qué lee y escribe cada clave). Está mencionada en el Pendiente. Conviene agregarla antes de la migración para que no se escape: es una clave nueva, solo del staff, que **no** debería ser pública en Firebase.

## 6. Lo que no se pudo verificar

- Un celular real y una impresora real.
- La animación del carrusel de sponsors (flechas, puntitos y el botón "Mostrar todos los sponsors") y cómo se ve en pantalla de celular.
- Que el link de ubicación abra realmente Google Maps (se verificó el enlace, no se navegó afuera).
- Noticias con foto y álbumes cargados desde el panel.
- Egresos y balance general.
- Tabla Única.
- La franja de 769 a 799 px.
- Dos pestañas o dos celulares a la vez (11.4 puntos 6 y 8).
- Avisos internos con muchos avisos acumulados (se probó con uno).

## 7. Conclusión

Las tres cosas pedidas andan. Con esta vuelta el banco quedó en cero fallas. Lo que falta antes de migrar no es código: el PDF del reglamento, la prueba en un celular real y el resto del checklist 11.1.
