# Sexta corrida: Historial de Cambios del staff (30/09/2026)

**Para:** Joaquín y los agentes que sigan con el panel.
**Alcance:** feature nueva (Historial de Cambios) + su verificación con el Firestore simulado. No se probó contra Firebase real.

## Resultado

| Banco | Resultado | Archivo |
|---|---|---|
| Torneo completo (`banco.html`) | **327 PASS / 0 FAIL** (313 de antes + 14 nuevos), sin errores de JS, sin avisos falsos de "otra persona cargó cambios" | `resultado-15-2026-09-30.txt` |
| Integridad (`banco-integridad.html`) | **12 PASS / 0 FAIL** | `resultado-integridad-2026-09-30.txt` |
| Tiempo real (`banco-tiempo-real.html`) | **28 PASS / 0 FAIL** | `resultado-tiempo-real-2026-09-30.txt` |

## Qué controla la fase nueva (`historialDeCambios` en `banco.js`)

1. **Coordinador:** ve la pestaña. Todo el recorrido anterior del banco quedó anotado: 271 entradas (resultados, pagos, altas, Tribunal), cada una firmada por quien la hizo. Entre ellas está el pago que cargó el Staff en la fase de beneficios. "Vaciar Historial" pide confirmación y borra todo del servidor.
2. **Staff, en la pantalla:** no descarga el historial. No ve la pestaña, la lista ni el botón, ni siquiera forzando el clic en la pestaña.
3. **Staff, cargando datos:** carga un resultado, lo corrige, registra un pago, emite una suspensión, da de alta a un jugador y lo da de baja. Quedan exactamente 6 entradas legibles firmadas "Prueba staff":
   - `cargó el resultado de FECHA 4 (Superior): 4to 1ra 2-1 5to 2da`
   - `cambió el resultado de FECHA 4 (Superior): 4to 1ra 3-1 5to 2da (era 4to 1ra 2-1 5to 2da)`
   - `registró un pago de $5,000 de 4to 1ra (Arancel de Partido · FECHA 4, efectivo)` (el Edge de prueba usa la coma de los miles en inglés; en un navegador en español sale `$5.000`, igual que el resto del panel)
   - `emitió el Acta N° 4 (Superior): suspensión de 1 fecha a 5to 2da — Lucas Romero (#9)`
   - `dio de alta a Nuevo Historial (#42) en 4to 1ra` / `dio de baja a Nuevo Historial (#42) de 4to 1ra`

   No hubo errores de guardado ni de JS, y ninguna entrada tiene DNIs en el texto.
4. **Reglas con rol Staff, probadas directo contra el Firestore simulado** (sin pasar por el panel). Todas dan `permission-denied`: leer la colección, leer un documento, escucharla, borrar una entrada, editarla, pisarla con `setDoc` y crear una firmada con otro email. Forzar el clic en "Vaciar Historial" con Staff no borra nada.
5. **Coordinador otra vez:** ve las 6 entradas del Staff con nombre, rol y email, la más nueva arriba. Sus propios cambios de beneficio quedan anotados con su nombre: descuento, cambio de %, motivo y quitar el beneficio. Cambiar el motivo por el mismo texto no anota nada. Agregar entradas después de las del Staff no reescribe ninguna y no da errores de guardado.
6. **390 px:** la pestaña no desborda (`scrollWidth` 382). También se revisó por captura, en escritorio y a 390 px.

## Falla real que encontró el banco (arreglada)

La primera corrida dio 7 avisos falsos de "otra persona cargó cambios", más errores de guardado ocultos. El problema era de fondo, no del banco.

- **Qué pasaba:** el orden de cada lista se guarda en `_pos`, y cada panel lo numera según lo que conoce. El Staff no lee el historial, así que numeraba sus entradas desde 0 y chocaba con las del Coordinador. Con el empate, el panel del Coordinador intentaba reescribir `_pos` de todas las entradas, y las reglas (a propósito) no dejan editar el historial.
- **Arreglo:** en `datos-firestore.js`, la opción `ordenPor` del `ESQUEMA` hace que la posición salga de la hora de cada entrada (`timestamp`) y no se recalcule nunca.

## Probado solo con el simulador

Los bancos usan el Firestore simulado, que imita `firestore.rules`. La regla real no se probó: esta máquina no tiene el emulador de Firebase y no llega al CDN.
