# Octava corrida: calendario de fechas y fixture automático (01/10/2026)

**Para:** Joaquín y los agentes que sigan con el panel.
**Alcance:** dos features de Carga de Partidos y su verificación con el Firestore simulado: el calendario (qué día se juega cada Fecha de la fase de grupos) y el fixture automático (todos contra todos, cada par una vez). No se probó contra Firebase real ni en un celular.

## Resultado

| Banco | Resultado | Archivo |
|---|---|---|
| Torneo completo (`banco.html`) | **405 PASS / 0 FAIL**: 373 de `REPORTE-7.md`, 6 que sumó otra sesión en `nombresConCodigo` y 26 de la fase nueva. Sin errores de JS ni avisos falsos de "otra persona cargó cambios" | `resultado-17-2026-10-01.txt` |
| Solo la fase nueva (`banco.html?solo=fixture`) | **27 PASS / 0 FAIL** (los 26 más el control final de avisos ajenos), unos 40 s | — |
| Integridad (`banco-integridad.html`) | **12 PASS / 0 FAIL** | `resultado-integridad-2-2026-10-01.txt` |
| Tiempo real (`banco-tiempo-real.html`) | **28 PASS / 0 FAIL** en la última corrida | `resultado-tiempo-real-2-2026-10-01.txt` |

**Ojo con tiempo real:** se corrió 5 veces. Tres dieron 28/0. Dos fallaron (25/3 y 27/1), y fueron las más lentas: 113 s y 94 s, contra unos 70 s de las otras.
- Las fallas son controles que esperan un tiempo fijo, 10 a 11 s, a que el panel publique el resumen. Con la máquina cargada, la web pública no llega a tiempo. En la primera, otra sesión estaba corriendo sus bancos a la misma hora.
- Esos controles no tocan nada de lo nuevo y pasaron en las otras tres corridas.
- Si vuelve a pasar seguido, conviene que el banco espere hasta que llegue el resumen en vez de un tiempo fijo.

## Qué controla la fase nueva (`fixtureAutomatico` en `banco.js`)

Corre **al final** del recorrido porque vacía la base. Arma sus propios equipos por la interfaz:
- Superior: Grupo A con 5 equipos, B con 4, C con 1, D y E vacíos, y uno en Tabla Única.
- Básico: Grupo A con 3 equipos.

1. **Calendario:**
   - Arranca vacío, con un campo por cada una de las 7 fechas de cada ciclo.
   - Al guardarlo queda en `liga_calendario_fechas` y en `config/calendarioFechas`, como `DD/MM/AAAA`, igual que el día de los partidos.
2. **Día del formulario de partido:**
   - Elegir una Fecha con día cargado lo completa solo.
   - Una Fecha sin día lo deja vacío.
   - Un día escrito a mano no se borra al pasar a una Fecha sin día.
   - En Básico, el día se completó y se guardó el que se escribió encima.
3. **Fechas que no alcanzan:** con 4 fechas configuradas y un grupo de 5 equipos (necesita 5), avisa, no abre la vista previa y no crea nada.
4. **Vista previa:**
   - Muestra 16 partidos en 5 fechas: el día del calendario en las Fechas 1 a 3, "sin día" en la 4 y la 5, y uno libre del Grupo A por fecha.
   - Nombra los grupos sin partidos y el equipo de Tabla Única, que no entra.
   - Mientras está abierta, Firestore, los partidos del panel y el Historial no cambian.
   - "Cancelar", y cambiar el arancel, la cierran sin guardar.
5. **Al confirmar:**
   - Quedan 16 partidos. En el Grupo A están los 10 cruces posibles y en el B los 6, cada par una sola vez. Nadie juega contra sí mismo ni dos veces en la misma fecha.
   - El Grupo A juega las Fechas 1 a 5 y el B las 1 a 3: los dos arrancan en la misma Fecha 1.
   - Cada partido tiene horario y cancha vacíos, ningún resultado, el día del calendario, el arancel, "Por asignar" y los ids de sus equipos.
   - Los ids son números únicos. Los 16 partidos están en Firestore y en el Cronograma.
   - El Historial suma una sola entrada.
6. **Bloqueo:** generar de nuevo Superior (ya tiene el fixture) o Básico (tiene un partido cargado a mano) avisa y no crea nada.
7. **Un partido generado se edita y se borra como cualquier otro:**
   - Se abre con horario y cancha "a confirmar" y con su día.
   - Se le cargaron horario, cancha y resultado, y conservó su id.
   - A otro se le movió el día a mano, y un tercero se eliminó.
8. **Cambiar el calendario con partidos ya cargados:**
   - Con "sí", los partidos sin jugar que tenían el día anterior, o ninguno, pasan al día nuevo. El partido jugado, el que se movió a mano y los de Básico quedan igual.
   - El Historial suma una entrada por cada Fecha que cambió.
   - Con "no", el calendario se guarda igual y los partidos conservan su día.
9. **Web pública:** el fixture tiene los botones de las Fechas 1 a 5 y muestra los partidos generados con horario y cancha "a confirmar".
10. **Rol Staff, a 390 px:**
    - Borra el partido a mano de Básico y genera el fixture de ese ciclo: 3 equipos dan 3 partidos en 3 fechas, con uno libre en cada una.
    - En Firestore, el Historial queda firmado por el Staff.
    - El calendario, el generador y la vista previa no desbordan.
11. No hubo errores de JS en todo el recorrido.

## Cómo correrlo

Igual que en `REPORTE-7.md`: la copia del sitio con `firebase-sdk-falso.js`, `cloudinary-falso.js`, la semilla vacía, `libs/` y `planillas-prueba/`.

`banco.html?solo=fixture` corre solo esta fase, en unos 40 a 80 s.

## Capturas

Se miraron en escritorio (1280 px) y a 390 px:
- el calendario con días cargados en dos ciclos;
- el generador;
- la vista previa de un ciclo con dos grupos;
- el formulario de partido con el Día ya completado.

A 390 px el calendario va en dos columnas.

## No probado

- Contra Firebase real.
- En un celular real.
