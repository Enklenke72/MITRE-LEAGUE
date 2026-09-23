# Corrección del Reglamento MITRE LEAGUE 2026 (PDF) — 22/09/2026

Documento de trabajo para quien edite `Recursos/Reglamento MITRE LEAGUE 2026.pdf` (Joaquín, un diseñador, o quien sea). No se tocó el PDF ni ningún archivo de la web: esto es solo el detalle artículo por artículo de qué cambiar y por qué.

**Fuentes usadas:**
- El PDF actual, leído completo (10 páginas, Artículos 1° a 41°, con un 41° duplicado).
- `CLAUDE.md` completo, en especial secciones 1, 6, 7 (Hecho y Pendiente) y las respuestas de Joaquín del 20/09 y 22/09/2026.
- El acordeón de reglas rápidas de `index.html` (línea ~527 en adelante), que ya tiene los textos actualizados y publicados en la web pública — se usó como referencia de "qué es lo real hoy", no como texto a copiar literal salvo que coincida con lo pedido.

**Cómo leer cada punto:** (a) qué dice hoy el PDF, (b) qué es lo real/decidido, (c) texto sugerido para pegar. Los cuatro textos que Joaquín ya redactó y aprobó (Ficha Médica, Acreditación, Aceptación, Mínimo y Máximo — Pendiente ítems 4 y 5 de `CLAUDE.md`) están marcados **[TEXTO APROBADO — pegar tal cual]**. Todo lo demás que sugiero yo está marcado **[SUGERIDO — a confirmar con Joaquín]**, porque no es una cita literal suya, sino mi redacción a partir de lo ya decidido e implementado.

---

## 1. Los 8 puntos pedidos (Arts. 7, 8, 12, 14, 16, 17, 17 Bis, 41 duplicado)

### Artículo 7° (Pagos y Deuda)
**(a) Dice hoy:** *"Antes de cada encuentro, todos los equipos deberán abonar sin excepción el arancel correspondiente."*
**(b) Real:** No contradice nada implementado — sigue siendo la regla general. La única matización es que el Art. 8 permite quedar en deuda, así que el "sin excepción" convive con esa salvedad.
**(c) Veredicto:** No hace falta reescribirlo. Sugerencia opcional, menor: agregar "(salvo lo previsto en el Artículo 8 para el caso de deuda)" al final, solo para que no choque a primera lectura con el artículo siguiente. **No es necesario, es cosmético.**

---

### Artículo 8° (Pagos y Deuda)
**(a) Dice hoy:** *"Si por algún motivo un equipo no pudiera abonar la totalidad del arancel en algún encuentro, el mismo quedará con deuda hasta el próximo encuentro, donde se deberán abonar ambas fechas. Si la deuda no se cancela, el equipo se verá afectado con quita de puntos."*
**(b) Real (respuestas de Joaquín, 20/09/2026, `CLAUDE.md` Pendiente):**
1. El momento de aplicar la quita **no es automático por fecha**: lo decide el Tribunal de Disciplina hablando con el capitán del equipo.
2. La quita es específicamente **1 (un) punto**, no "puntos" en general.
3. El punto **se devuelve al pagar**.
4. Se aplica **una sola vez por deuda**, no se repite en cada fecha que sigue debiendo.

Nota: hoy esto **no está automatizado en la web** (el Tribunal la carga a mano); es un tema de reglamento, no bloquea la corrección del PDF.

**(c) Texto sugerido [SUGERIDO — a confirmar con Joaquín, no es cita literal]:**
> *"Artículo 8°- Si por algún motivo un equipo no pudiera abonar la totalidad del arancel en algún encuentro, el mismo quedará con deuda hasta el próximo encuentro, donde deberá abonar ambas fechas. Si la deuda no se cancela, el Tribunal de Disciplina, tras conversar con el capitán del equipo, podrá aplicar una quita de 1 (un) punto de la tabla de posiciones. Esta quita se aplica una única vez por cada deuda (no se repite en las fechas siguientes mientras siga sin cancelarse) y se devuelve automáticamente en el momento en que el equipo salda lo adeudado."*

---

### Artículo 12° (Pagos y Deuda)
**(a) Dice hoy:** *"Bajo ningún concepto se reintegrará el pago del arancel correspondiente al derecho de partido."*
**(b) Real:** No lo contradice nada, pero queda incompleto: con el Art. 17 Bis (ausencias) puede generarse un "saldo a favor" que se arrastra a la fecha siguiente (ver `calcularTesoreriaPartidos`, sección 6 de `CLAUDE.md`, y el acordeón "Pagos y Deuda" de `index.html`: *"Si se paga más del 50%, el excedente se descuenta del derecho de partido de la siguiente fecha que se dispute"*). Vale aclarar que ese saldo a favor no es una excepción a este artículo (no es un reintegro en efectivo).
**(c) Texto sugerido [SUGERIDO]:**
> *"Artículo 12°- Bajo ningún concepto se reintegrará el pago del arancel correspondiente al derecho de partido. El saldo a favor que pueda generarse por una ausencia (ver Artículo 17 Bis) no constituye un reintegro: se descuenta del arancel de la siguiente fecha que el equipo dispute."*

---

### Artículo 14° (Partidos)
**(a) Dice hoy:** *"La puntuación será de 3 puntos por partido ganado, 1 punto por partido empatado, 0 puntos por partido perdido y -1 punto al equipo que se ausente."*
**(b) Real:** La ausencia **no** resta 1 punto fijo. Según `CLAUDE.md` sección 6 y el acordeón público (*"Ausencia sin abonar el 50% del derecho de partido = -2 pts"*), la resta es de **2 puntos**, y solo ocurre si el equipo ausente **no abona al menos el 50%** del arancel antes de su siguiente partido. Si paga el 50% o más, no pierde puntos (solo pierde ese partido 3-0). Es todo el mecanismo del Art. 17 Bis (ver más abajo), no una regla de puntaje fija.
**(c) Texto sugerido [SUGERIDO]:**
> *"Artículo 14°- La puntuación será de 3 puntos por partido ganado, 1 punto por partido empatado y 0 puntos por partido perdido. La ausencia de un equipo a un encuentro se rige por lo dispuesto en el Artículo 17 Bis, y puede implicar la pérdida de 2 (dos) puntos de la tabla si no se regulariza el pago correspondiente."*

---

### Artículo 16° (Partidos)
**(a) Dice hoy:** *"En instancias de Play-Offs, se podrá evaluar la posibilidad de que los partidos pasen a tener una duración total de 40 (cuarenta) minutos, divididos en dos tiempos de 20 (veinte) y un descanso de 5 (cinco) minutos en el entretiempo."*
**(b) Real:** El acordeón público de `index.html` ya dice explícitamente: *"Duración Play-Offs: 30 minutos (2 tiempos de 15 min, con 5 min de descanso), igual que en fase de grupos."* Es decir, la duración de 40 minutos quedó descartada: Play-Offs se juega igual que la fase de grupos (30 minutos).
**(c) Texto sugerido [SUGERIDO — pero basado en un texto ya publicado en la web]:**
> *"Artículo 16°- En instancias de Play-Offs, los partidos tendrán la misma duración que en la fase de grupos: 30 (treinta) minutos, divididos en dos tiempos de 15 (quince) minutos y un descanso de 5 (cinco) minutos en el entretiempo. La Organización puede modificar los minutos de cada tiempo de ser necesario."*

---

### Artículo 17° (Partidos)
**(a) Dice hoy:** *"El horario de citación de los partidos será de 15 minutos antes del comienzo del partido, tiempo en el cual los jugadores deberán abonar el arancel correspondiente y firmar la Lista de Buena Fe. Si el equipo no estuviera presente cumplidos estos 15 minutos, se le sumará 1 gol al rival por cada 5 minutos de espera. El equipo que solicite los puntos tendrá que abonar el arancel correspondiente al partido, y se le asignará otro rival para disputar un partido amistoso."*
**(b) Real:** Dos problemas:
1. "Firmar la Lista de Buena Fe" ya no existe: ahora el jugador presenta el DNI y el **staff** lo registra en la lista digital (ver Acreditación, más abajo). Nadie firma nada en el momento.
2. "Abonar el arancel correspondiente" para obtener los puntos es ambiguo hoy: según el Art. 17 Bis, el equipo que se presentó necesita abonar específicamente el **100%** para que se le reconozcan los puntos (si paga menos, hay otros escenarios).
**(c) Texto sugerido [SUGERIDO]:**
> *"Artículo 17°- El horario de citación de los partidos será de 15 minutos antes del comienzo del partido, tiempo en el cual los jugadores deberán presentar su DNI (físico o digital) para ser registrados como presentes en la Lista de Buena Fe digital, y deberá abonarse el arancel correspondiente. Si el equipo no estuviera presente cumplidos estos 15 minutos, se le sumará 1 gol al rival por cada 5 minutos de espera hasta completarse el partido con un resultado de 3 a 0 (ver Artículo 17 Bis). El equipo que se presentó deberá abonar el 100% del arancel correspondiente al partido para que se le reconozcan los puntos, y se le asignará otro rival para disputar un partido amistoso."*

---

### Artículo 17° Bis — NUEVO (no existe hoy en el PDF)
**(a) Dice hoy:** No existe. El PDF no tiene ningún artículo dedicado al mecanismo de ausencias con porcentajes de pago; solo el Art. 17 (citación) y el Art. 4/4 Bis (mínimo de jugadores) tocan el tema de forma parcial.
**(b) Real:** Esto **ya está implementado y automatizado** en Tesorería (`admin.js`, función `evaluarPartidoAusencias`) y ya está descripto en el acordeón público de `index.html` (bloques "Tiempos, Puntaje y Citación" y "Pagos y Deuda"). Es la pieza que más falta en el PDF: hoy el PDF no explica en ningún lado la regla del 50%/100% ni la quita de 2 puntos.
**(c) Texto sugerido [SUGERIDO — no es cita literal de Joaquín, armado a partir de `CLAUDE.md` sección 6 y el acordeón ya publicado; recomiendo que Joaquín lo revise con calma antes de mandarlo a diseño, porque tiene varios casos]:**
> *"Artículo 17° Bis– Cuando un equipo no se presente a un encuentro dentro del horario de citación del Artículo 17, se aplicará lo siguiente:*
>
> *a) El equipo ausente pierde el partido 3 a 0. Para no perder puntos de la tabla, deberá abonar como mínimo el 50% del arancel correspondiente antes de su siguiente encuentro. Si abona el 50% o más, conserva sus puntos (el excedente pagado por encima del 50% queda como saldo a favor para su siguiente partido, ver Artículo 12). Si abona menos del 50%, o no abona, se le restarán 2 (dos) puntos de la tabla de posiciones; esta quita se levanta automáticamente en el momento en que el equipo cancele la deuda.*
>
> *b) El equipo que sí se presentó deberá abonar el 100% del arancel correspondiente para que se le reconozca el resultado de 3 a 0 y los puntos del partido, y se le asignará otro rival para disputar un partido amistoso. Si abona entre el 50% y el 100%, el partido queda suspendido, sin puntos para ninguno de los dos equipos. Si abona menos del 50%, se lo considerará también como equipo no presentado, aplicándosele lo dispuesto en el inciso a).*
>
> *c) En instancias de Play-Offs no rige la quita de puntos ni el 3 a 0 automático de este artículo: el equipo ausente queda directamente eliminado del torneo, y no corresponde el pago del arancel de ese encuentro."*

---

### Artículo 41° (duplicado)
**(a) Dice hoy:** Hay **dos** artículos numerados "41°" seguidos, con contenidos totalmente distintos:
1. *"La Organización se encargará de publicar el presente reglamento en la red social oficial del torneo..."*
2. *"En concordancia con lo establecido en el Artículo 1°, al firmar la Lista de Buena Fe, cada jugador cede de manera gratuita y voluntaria a la Organización del Torneo el derecho de uso de su imagen..."*
**(b) Real:** Es un error de numeración, no de contenido: ambos textos son válidos y no se contradicen entre sí ni con nada implementado (salvo la mención a "firmar la Lista de Buena Fe", ver más abajo). Solo falta corregir la numeración.
**(c) Solución sugerida:** Dejar el primero como **Artículo 41°** (publicación del reglamento) y renumerar el segundo como **Artículo 42°** (derechos de imagen). No hace falta tocar el contenido de ninguno de los dos, salvo el punto que sigue.

---

## 2. Encontrado además de la lista: menciones a "firmar la Lista de Buena Fe / la planilla" que quedaron desactualizadas

Se pidió buscar cualquier mención a firma de planilla en papel que no refleje el cambio a la lista de buena fe digital. Encontré **cinco** puntos más, además de los Arts. 3, 6 y 17 ya cubiertos arriba:

### Artículo 1° (Preliminar)
**(a) Dice hoy:** *"Todo jugador de cada equipo toma conocimiento del presente reglamento y acepta todas las condiciones del mismo firmando la Lista de Buena Fe."*
**(b) Real:** Esto mezcla dos cosas que ahora son distintas. La Lista de Buena Fe hoy es la asistencia partido a partido (digital, la carga el staff). La **aceptación del reglamento** es otra cosa: se formaliza **una sola vez**, firmando la ficha médica (Pendiente ítem 5, confirmado por Joaquín).
**(c) Texto sugerido — Aceptación del Reglamento [TEXTO APROBADO — pegar tal cual]:**
> *"La participación en el torneo implica el conocimiento y la aceptación de este reglamento. La aceptación se formaliza una única vez mediante la firma de la ficha médica por el adulto responsable, o por el propio alumno si es mayor de 18 años."*

### Artículo 3° (Lista de Buena Fe)
**(a) Dice hoy:** *"En cada encuentro los jugadores deberán constatar su presencia firmando la planilla y presentando DNI físico o digital obligatoriamente. Si esto no se cumpliese, el jugador no podrá disputar el partido. En caso de falta de tiempo, la firma podrá efectuarse durante el entretiempo."*
**(b) Real:** Ya no se firma nada: el jugador presenta el DNI y el staff lo registra en la lista digital (Pendiente ítem 5, texto de Acreditación ya aprobado).
**(c) Texto sugerido:**
> *"En cada partido los jugadores deben presentar su DNI (físico o digital) antes de jugar. La asistencia es registrada por el staff de la Organización mediante la lista de buena fe digital."* **[TEXTO APROBADO — pegar tal cual, este es el núcleo]**
> Sugiero conservar, adaptadas, las dos frases finales del artículo actual (no son parte del texto aprobado, son mi adaptación): *"Si esto no se cumpliese, el jugador no podrá disputar el partido. En caso de falta de tiempo, la acreditación podrá completarse durante el entretiempo."* **[SUGERIDO]**

### Artículo 6° (Lista de Buena Fe)
**(a) Dice hoy:** *"En cada encuentro todos los jugadores de cada equipo deberán firmar la planilla para disputar el partido."*
**(b) Real:** Repite, con otras palabras, lo mismo que el Art. 3 (que ya se corrige arriba). Es redundante y tiene el mismo problema de la firma en papel.
**(c) Texto sugerido [SUGERIDO]:**
> *"Artículo 6°- En cada encuentro, todos los jugadores de cada equipo deberán estar registrados como presentes en la Lista de Buena Fe digital (ver Artículo 3) para poder disputar el partido."*

### Artículo 36° (Disposiciones Generales)
**(a) Dice hoy:** *"Como dicta el Artículo 1°, al firmar la Lista de Buena Fe, cada jugador toma conocimiento del presente reglamento y acepta todas y cada una de las condiciones del mismo, y se atiene a todas las consecuencias en caso de incumplimiento."*
**(b) Real:** Mismo problema que el Art. 1: la aceptación del reglamento ya no pasa por firmar la Lista de Buena Fe.
**(c) Texto sugerido [SUGERIDO]:**
> *"Artículo 36°- Como dicta el Artículo 1°, la participación en el torneo implica el conocimiento y la aceptación de este reglamento, formalizada mediante la firma de la ficha médica. Cada jugador se atiene a todas las consecuencias en caso de incumplimiento."*

### Segundo Artículo 41° / nuevo Artículo 42° (derechos de imagen)
**(a) Dice hoy:** *"...al firmar la Lista de Buena Fe, cada jugador cede de manera gratuita y voluntaria a la Organización del Torneo el derecho de uso de su imagen..."*
**(b) Real:** Mismo problema de nuevo, pero acá **no hay una decisión de Joaquín** sobre si el consentimiento de imagen debe pasar a formalizarse también con la ficha médica (como la aceptación del reglamento) o si conviene dejarlo redactado de otra forma. Lo dejo como pregunta abierta en vez de decidirlo — ver sección 4.

---

## 3. Texto para la Ficha Médica (documento aparte — no es un artículo del reglamento)

La ficha médica en papel no está en el repo (`CLAUDE.md` lo marca como pendiente). El siguiente texto ya está redactado y aprobado por Joaquín para agregarse a esa ficha, donde se firma la aceptación del reglamento:

**[TEXTO APROBADO — pegar tal cual]**
> *"Declaro haber leído el Reglamento del Mitre League 2026 y acepto su cumplimiento. Entiendo que la participación en el torneo implica la aceptación de este reglamento. Firma: ______ Aclaración: ______ DNI: ______ Carácter: ☐ Adulto responsable ☐ Alumno mayor de 18 años."*

---

## 4. Preguntas — respondidas por Joaquín (22/09/2026)

1. **Art. 2° (inscripción del equipo):** **se mantiene en 5.** El mínimo de 4 es solo para presentarse y jugar un partido (Art. 4°); para inscribir el equipo sigue pidiéndose un mínimo de 5. **No tocar el Art. 2°.**
2. **Art. 4° Bis (excepción para jugar con menos del mínimo, avisando a la Organización):** **se saca.** Joaquín decidió eliminar esta excepción: no se puede jugar con menos de 4 jugadores, sin excepción avisando ni de ningún otro modo. Sacar el Art. 4° Bis del PDF (o dejarlo explícitamente derogado, según cómo prefiera Joaquín numerar el resto).
3. **Planilla impresa de respaldo:** **no se menciona.** Alcanza con describir el mecanismo digital (el texto de Acreditación ya aprobado) como el oficial. La planilla impresa queda como una herramienta interna de respaldo del staff, no como parte del reglamento.
4. **Segundo Art. 41°/42° (derechos de imagen):** **sí, pasa a la ficha médica**, igual que la aceptación del reglamento. Se formaliza una única vez, junto con la aceptación, con la firma del adulto responsable (o el alumno si es mayor de 18). Texto sugerido para reemplazar la mención a "al firmar la Lista de Buena Fe" **[SUGERIDO — a confirmar con Joaquín, no es cita literal]:**
   > *"En concordancia con lo establecido en el Artículo 1°, cada jugador cede de manera gratuita y voluntaria a la Organización del Torneo el derecho de uso de su imagen (fotos y videos tomados durante el torneo) con fines de difusión y promoción del evento. Este consentimiento se formaliza una única vez, junto con la aceptación del reglamento, mediante la firma de la ficha médica por el adulto responsable, o por el propio alumno si es mayor de 18 años."*
5. **Art. 8° y Art. 17° Bis:** siguen siendo **sugeridos**, no cita literal — Joaquín todavía tiene que leerlos con calma antes de mandarlos a diseño (el de 17° Bis en particular, por la cantidad de casos).
6. **De paso, no es del PDF:** el acordeón "Pagos y Deuda" de `index.html` (línea ~603) todavía no refleja las precisiones del Art. 8 del 20/09/2026 (que el Tribunal decide el momento, no es automático, se devuelve al pagar, una sola vez por deuda) — hoy solo dice "si no la cancela, se le quita 1 punto". Es un ajuste de la web, quedó anotado en CLAUDE.md para asignarlo.

---

## 5. Resumen para pegar rápido

| Artículo | Acción |
|---|---|
| 1° | Reemplazar con texto de Aceptación (aprobado) |
| 2° | Sin cambio — pregunta abierta (#1) |
| 3° | Reemplazar con texto de Acreditación (aprobado) + cierre adaptado |
| 4° / 4° Bis | Cambiar "5" por "4" — pregunta abierta sobre la excepción (#2) |
| 5° | Sin cambio; agregar como recuadro el texto de Mínimo y Máximo (aprobado) |
| 6° | Reescribir (redundante con el 3°, misma corrección) |
| 7° | Sin cambio (opcional, cosmético) |
| 8° | Reescribir (quita de 1 punto, decide el Tribunal, se devuelve al pagar, una vez por deuda) |
| 12° | Agregar cláusula sobre saldo a favor |
| 14° | Reescribir (sacar el "-1 punto al ausente", remitir al 17° Bis) |
| 16° | Reescribir (30 minutos en Play-Offs, no 40) |
| 17° | Reescribir (DNI + registro digital, 100% para puntos) |
| 17° Bis | **Agregar de cero** (no existe hoy) |
| 36° | Reescribir (remitir a ficha médica, no a la Lista de Buena Fe) |
| 41° (primero) | Mantener, queda como Artículo 41° |
| 41° (segundo) | Renumerar a Artículo 42° — pregunta abierta sobre la mención a firmar (#4) |
| Ficha médica (aparte) | Agregar texto de declaración aprobado |
