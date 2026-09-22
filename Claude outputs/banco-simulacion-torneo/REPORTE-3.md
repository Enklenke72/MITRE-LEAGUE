# Tercera corrida: sponsors de punta a punta y banco completo (22/09/2026)

**Para:** Joaquín y los agentes que hacen los arreglos.
**Alcance:** solo pruebas. **No se modificó ningún archivo de la web.** El banco corrió sobre una copia del repo actual en el scratchpad.

## Cómo se probó

El mismo banco de los reportes anteriores (torneo de 16 equipos, 92 jugadores, 3 fechas y playoffs de los dos ciclos, cargado desde `admin.html` y verificado en `index.html` con Edge headless), más una sección nueva de sponsors.

Ajustes al banco, solo donde el comportamiento cambió a propósito:
- Los botones del fixture ahora se esperan con las 3 fechas **más** las rondas de playoff.
- El fixture abre en la última fecha con resultados, no siempre en la Fecha 1.
- Controles nuevos para la noticia fija del hero, los álbumes sin semilla y las sanciones con cantidad 0.
- Sección nueva de sponsors: alta con logo, ubicación, edición, orden, baja y carrusel público.

**Resultado final: 160 PASS y 1 FAIL.** El único FAIL sigue siendo la falla 7 (goleador con un dorsal inexistente), que está sin decidir a propósito. **No se encontraron regresiones.**

El banco actualizado quedó en `banco.js` y el resultado crudo en `resultado-3-2026-09-22.txt`.

---

## 1. Sponsors de punta a punta (prueba nueva, 23 controles, todos pasan)

Se cargaron tres sponsors desde `admin.html`, con distinta combinación de datos:

| Sponsor | Categoría | Contacto | Ubicación | Logo |
|---|---|---|---|---|
| Kiosco El Gol | Sponsor Oficial | Instagram **y** teléfono | Link de Google Maps | Imagen subida |
| Panadería La Mitre | Colaborador | Solo teléfono | Dirección de texto | Sin logo |
| Radio Local FM | Media Partner | Solo Instagram | Sin ubicación | Sin logo |

**En el panel:**
- Arranca sin sponsors ("Todavía no hay sponsors cargados"), porque la semilla quedó vacía.
- Los tres se guardan con su categoría, color de fondo, descripción, beneficio, link e Instagram sin el "@".
- La ubicación se guarda tal cual: link, texto o vacía.
- El logo subido queda como imagen; el que no tiene logo usa el de por defecto.
- El orden se asigna solo (0, 1 y 2).
- **Editar:** la ubicación, el Instagram y el color se precargan. Al guardar, los cambios quedan, el logo se conserva, el orden no se altera y no se duplica el sponsor.
- **Reordenar:** "Bajar" y "Subir" mueven el sponsor y el cambio persiste.
- **Eliminar:** si se cancela la confirmación no se borra nada; al confirmar, desaparece de la lista.

**En la web pública (carrusel):**
- La ubicación que arranca con "http" sale como link que abre en otra pestaña, apuntando a la dirección guardada.
- La ubicación de texto sale como texto, sin link.
- El sponsor sin ubicación no muestra nada en ese lugar.
- Instagram y teléfono siguen igual que siempre: si hay Instagram se muestra el Instagram (aunque también tenga teléfono) y, si no hay, se muestra el teléfono. Es lo que dice la regla del proyecto: "Instagram o teléfono, según corresponda".
- La tarjeta respeta el color de fondo, la categoría y el logo subido, y el botón "Ver Beneficio" muestra el beneficio con el link "Más información".
- El sponsor eliminado desaparece del carrusel.

**Detalle a tener en cuenta, no es falla:** un sponsor con Instagram y teléfono muestra **solo** el Instagram. Si en algún caso se quieren ver los dos, es una decisión a tomar, no un error.

## 2. Cambios nuevos verificados

| Cambio | Estado |
|---|---|
| Playoffs en el fixture público | **Pasa.** Los botones quedan "Fecha 1, Fecha 2, Fecha 3, Cuartos, Semifinal, Final". Los Cuartos muestran sus 4 partidos con el título "Superior — CUARTOS" y sus goleadores. La Final muestra las dos finales, la del Superior y la del Básico |
| El fixture abre en la última fecha con resultados | **Pasa.** Abre en la Fecha 3, que es la última jugada |
| Se sacó la noticia fija "SE ACERCA LA FINAL" | **Pasa.** No aparece en ninguna parte de la web |
| `data.js` con sponsors y álbumes vacíos | **Pasa.** La galería muestra "Todavía no hay álbumes publicados" y la web pública ya no escribe `liga_fotos_albumes` |
| Quita de Puntos con cantidad 0 | **Pasa.** Se rechaza con "Falta la cantidad: indicá cuántos puntos se restan" |
| Suspensión con 0 fechas | **Pasa.** Se rechaza con "Falta la cantidad: indicá cuántas fechas dura la suspensión" |
| Advertencia / Acta con 0 | **Pasa.** Se sigue aceptando |

## 3. Regresiones

Ninguna. Toda la simulación corrió **sin errores de JavaScript**, y sigue pasando todo lo que ya andaba:
- Carga de partidos y edición entre grupos (0 casos de Local/Visitante vacíos).
- Art. 17 Bis, saldo a favor y deuda arrastrada.
- Caja por Fecha ($1.415.000 contra $1.415.000) e inscripciones.
- Lista de buena fe con el mínimo de 4 jugadores, los suspendidos y el alta en cancha.
- Planilla imprimible.
- Avance de playoffs, campeones y bracket.
- Tablas, mejor 4°, goleadores, modales con partidos jugados, goles y tarjetas, Tribunal, campanita y buscador.

## 4. Lo que no se pudo verificar

- Un celular real y una impresora real.
- **Del carrusel de sponsors se verificó el contenido, no la animación:** el paso de una tarjeta a otra con las flechas, los puntitos y el botón "Mostrar todos los sponsors" no se probaron, ni cómo se ve el carrusel en pantalla de celular.
- Que el link de ubicación abra realmente Google Maps: se verificó que el enlace apunte a la dirección guardada y que abra en otra pestaña, pero no se navegó a un sitio externo.
- Noticias con foto y álbumes cargados desde el panel (solo se verificó el estado vacío).
- Egresos y balance general.
- Tabla Única.
- La franja de 769 a 799 px.
- Dos pestañas o dos celulares a la vez (11.4 puntos 6 y 8).
- El tope de localStorage con fotos. **Ojo:** cada logo de sponsor se guarda como imagen dentro de `liga_sponsors`, así que suma a ese tope.

## 5. Conclusión

Sponsors quedó cubierto de punta a punta y funciona, incluido el campo nuevo de ubicación. Los otros cambios también. Desde estas pruebas no hay nada que bloquee la migración; lo que queda son decisiones tuyas (el goleador con dorsal inexistente, si Instagram y teléfono se muestran juntos) y lo del checklist 11.1: el PDF del reglamento y la prueba en un celular real.
