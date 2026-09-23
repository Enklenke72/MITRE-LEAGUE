# Quinta corrida: prensa, egresos, Tabla Única, responsive y reglas de suspensión (23/09/2026)

**Para:** Joaquín y los agentes que hacen los arreglos.
**Alcance:** solo pruebas. **No se modificó ningún archivo de la web.** El banco corrió sobre una copia del repo actual en el scratchpad.

## Cómo se probó

El mismo banco de los reportes anteriores (torneo de 16 equipos, 92 jugadores, 3 fechas, playoffs, sponsors), ahora **extendido a 226 controles** (antes 167) para cubrir todo lo que nunca se había probado por falta de datos cargados.

**Resultado final: 226 PASS y 0 FAIL.** Sin regresiones y sin errores de JavaScript.

El banco actualizado quedó en `banco.js` y el resultado crudo en `resultado-5-2026-09-23.txt`.

Ajustes al banco, donde el comportamiento cambió a propósito: el formato nuevo "Nombre (#7) x2" en goleadores y tarjetas, el aviso interno con el nombre de la fase, "Últimos partidos" incluyendo playoffs, y que un suspendido ya no se puede tildar (eso cambia los partidos jugados esperados de ese jugador).

---

## 1. Lo que nunca se había probado

### Noticias con foto
- Una noticia sin foto se rechaza con su aviso.
- Noticia con **foto subida como archivo**: un PNG de 1.973 KB se guarda comprimido en 202 KB.
- Noticia con **foto por ruta de texto**, con su link y el texto del link.
- El panel las lista.
- **El bug anotado de `heroSlides3D` está DESCARTADO:** con 2 noticias cargadas, el hero muestra 2 tarjetas y 2 puntitos, sin tarjetas fantasma. Las flechas quedan visibles, pasan a la noticia siguiente, y la foto subida se ve de fondo. El código ahora dibuja las noticias **antes** de armar el carrusel (`main.js`, comentario "Tiene que ir antes del carrusel").
- El modal de noticia ampliada abre con título, texto y foto, y cierra bien.

### Álbumes de fotos
- Álbum con **portada subida como archivo** (el input nuevo): 1.313 KB quedan en 113 KB.
- Álbum con **portada por ruta de texto**.
- Sin portada se rechaza.
- La galería pública muestra los 2 álbumes, cada uno con su portada y su link.

### Egresos y balance general
- Se cargan dos egresos ($85.000 y $40.000) con concepto, detalle y medio, y el panel los lista.
- El balance cuadra: inscripciones + partidos − egresos = saldo neto ($1.415.000 − $125.000 = $1.290.000).
- Se puede eliminar un egreso y el balance se actualiza.

### Tabla Única (Bombos)
- Mover los 4 equipos del Grupo C a Tabla Única **no alcanza** para que aparezca en la web: hace falta activar el formato, como está diseñado.
- Con el toggle activado aparece la pestaña "Tabla Única", con los 4 equipos ordenados por puntos, marcados como Bombo 1, y el título y subtítulo de Bombos.

### Campanita pública y "Vaciar Historial"
- La campanita muestra los avisos publicados.
- "Marcar leídos" los marca y "Limpiar" la vacía, quedando el cartel "No hay alertas en el casillero".
- En el panel, "Vaciar Historial" respeta el cancelar y borra al confirmar.

### Franja 769–799 px (nunca revisada)
Medido a 780 px de ancho: **ninguna pantalla desborda la página** (portada, Posiciones, Partidos y Playoffs). La columna PTS de la tabla entra bien. El bracket es más ancho que la pantalla pero scrollea dentro de su propia caja, que es como está pensado.

## 2. Las dos reglas nuevas de suspensión

### Un suspendido no puede tildarse en la lista de buena fe
- Si ya estaba tildado de antes (el acta se carga después), **destildarlo sigue funcionando**.
- Al intentar volver a tildarlo, el casillero se destilda solo, sale el aviso *"Lucas Romero está suspendido en esta fecha (Acta 1): no puede jugar ni figurar en la lista de buena fe"* y no se guarda nada.
- Un jugador que no está suspendido se sigue tildando normal.
- El que quedó tildado de antes sigue marcándose con la fila roja y la etiqueta SUSPENDIDO, en la lista y en la planilla impresa.

### Una fecha sólo descuenta si ese partido se jugó
Escenario probado: acta en la Fecha 4 con 2 fechas de suspensión, y las fechas 5, 6 y 7 cargadas sin resultado.

| Situación | Fecha 5 | Fecha 6 | Fecha 7 |
|---|---|---|---|
| Nada jugado | Suspendido | Suspendido | Suspendido |
| Se juega la Fecha 5 | — | Suspendido (lleva 1 de 2) | Suspendido |
| Se juegan Fecha 5 y 6 | — | — | **Libre** |

En la Fecha 4, la del acta, todavía no figura suspendido. Cumplida la suspensión, se lo puede volver a tildar.

## 3. Pregunta para Joaquín (ya respondida — ver el Anexo al final)

**¿Un 3-0 automático cuenta como fecha cumplida de suspensión?** Cuando se cerró este reporte, contaba siempre, porque ese partido queda marcado como jugado aunque no se haya jugado. Joaquín respondió el 23/09/2026 y la regla se cambió: cuenta si el equipo se presentó, no cuenta si el equipo faltó. **Verificado en el Anexo.**

## 4. Regresiones

Ninguna. Sigue pasando todo lo anterior: carga de partidos, Art. 17 Bis, saldo a favor y deuda, Caja por Fecha ($1.415.000 contra $1.415.000), inscripciones, lista de buena fe, planilla imprimible, playoffs y bracket, tablas, goleadores, modales, Tribunal, buscador, sponsors y avisos internos.

## 5. Dos cosas del banco, no de la web

Las anoto porque me hicieron perder una corrida y sirven para el próximo que toque el banco:
1. **La compresión de las fotos es asincrónica.** Con el navegador en modo headless y tiempo virtual, esperar un rato fijo no alcanza: hay que esperar a que aparezca la vista previa. Con la espera corta, la noticia se guardaba sin foto. Ya está corregido en `banco.js` (`esperarPreview`).
2. **"Concepto" y "Medio" de Egresos son listas desplegables** con valores fijos (`arbitros`, `canchas`, `fotografia`, `varios` / `efectivo`, `transferencia`). Mi banco mandaba texto libre y el egreso se guardaba sin concepto. En uso real el navegador no deja mandar el formulario, así que no es una falla; pero muestra que, igual que en los otros formularios, la validación la hace el navegador y no el JavaScript. Si mañana se migra a Firebase, eso hay que validarlo también del lado del servidor.

## 6. Lo que no se pudo verificar

- Un celular real y una impresora real.
- La animación del carrusel de sponsors y cómo se ve en pantalla de celular (las capturas headless no bajan de ~500 px).
- Que los links externos (Google Maps, Drive, Instagram) abran de verdad: se verificó el enlace, no se navegó afuera.
- Dos pestañas o dos celulares a la vez (11.4 puntos 6 y 8).
- El tope de localStorage con muchas fotos: en esta corrida, con 2 noticias, 2 álbumes y 3 sponsors con logo, el uso quedó en unos 720 KB de los ~5 MB. Sirve como referencia: **cada foto subida pesa entre 100 y 270 KB ya comprimida**, así que el tope se alcanza alrededor de 20 o 25 fotos.
- Tabla Única del Ciclo Básico (se probó la del Superior).

## 7. Conclusión

Quedó cubierto todo lo que figuraba como "sin probar por falta de datos", y las dos reglas nuevas de suspensión funcionan como las pidió Joaquín. El banco está en 226 controles y 0 fallas. La pregunta del 3-0 automático quedó respondida y verificada: ver el Anexo.

---

# Anexo — Regla del 3-0 automático en las suspensiones (23/09/2026)

**Regla decidida por Joaquín:** un partido resuelto con 3-0 automático **descuenta** fecha de suspensión si el equipo del jugador **se presentó** (ganó 3-0 porque no vino el rival), y **no descuenta** si el equipo del jugador **faltó** (perdió 3-0). El código lo resuelve mirando la asistencia cargada en Tesorería (`suspensionVigenteDe` en `admin.js`).

**Resultado: 239 PASS y 0 FAIL** en la corrida completa (13 controles nuevos). Resultado crudo en `resultado-6-2026-09-23.txt`.

## Cómo se probó

Para que la prueba sea concluyente se armaron **dos equipos con la misma sanción** (acta en la Fecha 4, 2 fechas de suspensión) y resultados **opuestos en la misma fecha**:

| Fecha | 4to 2da (se presenta) | 6to 1ra (falta) |
|---|---|---|
| 5 | Gana 3-0 automático: no vino el rival, él se presentó y pagó | Pierde 3-0 automático por no presentarse |
| 6 | Partido normal entre los dos, 1-1 | Partido normal entre los dos, 1-1 |
| 7 | Consulta del estado | Consulta del estado |

Así, cualquier diferencia entre los dos en la Fecha 7 viene únicamente de cómo se contó el 3-0.

## Resultados

| Caso | Esperado | Resultado |
|---|---|---|
| **1. Equipo presente en un 3-0 a favor** | La fecha cuenta | **Cumple.** En la Fecha 6 lleva 1 de 2 y sigue suspendido; en la Fecha 7 queda **libre** y se lo puede volver a tildar |
| **2. Equipo ausente perdiendo 3-0** | La fecha no cuenta | **Cumple.** En la Fecha 6 lleva 0 de 2; en la Fecha 7 sigue **suspendido** y al intentar tildarlo avisa *"Julián Martínez está suspendido en esta fecha (Acta 4)"* |
| **3. Sin regresión** | Un partido normal jugado descuenta; uno no jugado, no | **Cumple.** El escenario anterior sigue pasando entero: con las fechas 5 y 6 sin jugar sigue suspendido hasta la 7, y recién queda libre cuando las dos se jugaron. El partido normal 1-1 de la Fecha 6 descontó fecha para los dos equipos (con la asistencia sin registrar, que también cuenta) |

También se verificó que los dos 3-0 se generen bien: 3-0 a favor del que se presentó y 0-3 en contra del que faltó, los dos marcados como resultado automático.

## Sin regresiones

La corrida completa (239 controles) pasó entera: fase de grupos, Art. 17 Bis, Tesorería, lista de buena fe, planilla, playoffs, prensa, egresos, Tabla Única, campanita, responsive y sponsors.

## Lo que no se verificó en este anexo

- El caso de **los dos equipos ausentes** en el mismo partido (el reglamento no lo define y la web avisa para resolverlo a mano): no se probó cómo queda ahí la suspensión.
- Qué pasa si el staff **corrige la asistencia después**: por ejemplo, marcar "faltó" a un equipo que ya tenía fechas contadas. Por cómo está escrito, el cálculo se rehace solo cada vez que se mira la lista, así que debería reacomodarse, pero no lo probé.
- Una suspensión que cruce hacia los **playoffs** (acta en la última fecha de grupos y suspensión que sigue en Octavos).
