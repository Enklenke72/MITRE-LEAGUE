# Séptima corrida: importador de la planilla de inscripción (01/10/2026)

**Para:** Joaquín y los agentes que sigan con el panel.
**Alcance:** feature nueva (importar jugadores desde Excel, CSV o PDF, en Planteles) y su verificación con el Firestore simulado. Aparte, una prueba con la planilla real que pasó Joaquín y otra contra los CDN reales. No se probó contra Firebase real ni en un celular.

## Resultado

| Banco | Resultado | Archivo |
|---|---|---|
| Torneo completo (`banco.html`) | **405 PASS / 0 FAIL**: 327 de antes, 41 del importador, 11 de datos con código y 26 del fixture automático (fase de otra sesión, corrida junto con estas). Sin errores de JS, sin avisos falsos de "otra persona cargó cambios" | `resultado-16-2026-10-01.txt` |
| Integridad (`banco-integridad.html`) | **12 PASS / 0 FAIL** | `resultado-integridad-2026-10-01.txt` |
| Tiempo real (`banco-tiempo-real.html`) | **28 PASS / 0 FAIL** | `resultado-tiempo-real-2026-10-01.txt` |

## Qué controla la fase nueva (`importarPlanilla` en `banco.js`)

Corre al final, después de Tabla Única, y arma sus propios equipos ("Importados", "Casos Borde" y "Pase Origen", en el Grupo B de Superior).

1. **Sin equipo elegido** en "Equipo Destino", el botón pide elegirlo primero.
2. **La planilla del Clausura 2026** (`planilla-valida.xlsx`, misma estructura que la real y datos inventados):
   - Lee los 8 jugadores y saltea los renglones 9 y 10, que están vacíos.
   - Muestra el "CURSO" de la planilla, el equipo destino y "Confirmar importación (8 jugadores)".
3. **Nada se guarda antes de confirmar:** con la vista previa abierta y después de editar un nombre (agregarle "(C)" al capitán), Firestore y los planteles quedan idénticos.
4. **Al confirmar:**
   - Los 8 jugadores quedan en el equipo, en el orden de la planilla.
   - Cada uno queda **igual que un alta a mano con los mismos datos**: mismos campos, ficha médica pendiente, sin foto ni contactos. Se comparó contra un jugador cargado por el formulario.
   - Los DNI van a `equiposPrivado`, no a la colección pública.
   - El Historial de Cambios anota una sola entrada legible.
5. **Volver a subir la misma planilla:** los 8 aparecen como "ya está en este equipo" y no se puede confirmar.
6. **El mismo plantel en otros formatos** se lee igual que el Excel:
   - CSV de Excel en castellano: separado con ";", en Windows-1252, con DNIs con puntos y fechas como texto.
   - PDF impreso con "Guardar como PDF": el título "FECHA DE NAC." viene partido en dos renglones.
   - PDF armado con otra herramienta: otros títulos ("APELLIDO Y NOMBRE", "N° CAMISETA"), nombres alineados a la izquierda, fechas con guiones y número de página abajo.
7. **Archivos ilegibles** muestran un error claro y no abren la vista previa: un PDF escaneado (sin texto), una imagen y un Excel sin fila de títulos.
8. **Casos borde, en una planilla de 10 filas:**
   - Un DNI repetido dentro del archivo, aunque uno venga con puntos, marca error en las dos filas.
   - Un número de camiseta repetido dentro del archivo, lo mismo.
   - El DNI de un jugador que ya jugó con otro equipo se rechaza con el mismo mensaje que el alta a mano.
   - El DNI de un jugador de otro equipo que todavía no jugó aparece como **pase, con una casilla que hay que tildar**: no se pasa solo.
   - Faltan el nombre o el número: error. Una fecha imposible o un DNI de 6 números: solo un aviso.
   - Con errores no se puede confirmar. Corregir los datos en la vista previa vuelve a revisar todo al tipear; "Quitar" saca una fila.
   - Con el pase sin tildar, la importación sigue trabada.
   - Después de todas esas correcciones, Firestore sigue sin cambios.
   - Al confirmar entran 9 jugadores. El pasado conserva su ficha médica y su contacto, toma de la planilla el nombre, el número y el celular, y sale de su equipo anterior. El Historial anota las altas y, aparte, el pase.
9. **Cambiar "Equipo Destino" con la vista previa abierta** pasa la importación a ese equipo.
10. **Pasar el máximo de 10 jugadores** de la lista pide confirmación, igual que el alta a mano. Si se cancela, no se guarda nada.
11. **Con rol Staff** también se puede importar, sin errores de guardado.
12. **A 390 px** la vista previa (una tarjeta por jugador) no desborda. Sin errores de JS en todo el recorrido.

## Fase `nombresConCodigo`: datos de jugadores con código adentro

Después de este lote, Joaquín pidió que los datos de los jugadores se muestren escapados en el panel y en la web. El importador ya saca `<` y `>`, pero el alta a mano no. La fase da de alta, por el formulario, un jugador con código en el nombre (`<img … onerror=…>` y comillas), en el Instagram y en el contacto de emergencia. Después controla:

1. La tabla de Planteles los muestra como texto y no se ejecuta nada.
2. "Editar" encuentra a ese jugador por su DNI y carga sus datos tal cual.
3. La ficha de emergencia muestra el contacto como texto.
4. El buscador del encabezado muestra el nombre como texto.
5. En la web pública, el perfil del equipo muestra el nombre y el Instagram como texto: las únicas imágenes son las fotos de los jugadores.

**Control de que la prueba sirve:** contra una copia sin el arreglo, la fase falla en Planteles, en el buscador y en la web (74 PASS / 3 FAIL).

Después Joaquín pidió escapar también todo lo demás que carga el staff, así que la fase suma un equipo (`Los <3 & "Cía"`), un sponsor con código en el nombre, la descripción y el beneficio, más un link `javascript:`, y un aviso de la campanita con código. Controla:

6. El equipo aparece tal cual en los selectores del panel.
7. El panel muestra el sponsor y el aviso como texto.
8. En la web, el equipo aparece tal cual en la tabla y su perfil se abre al tocarlo.
9. El buscador de la web lo muestra tal cual, y el botón "Posiciones" lleva el nombre correcto.
10. La tarjeta del sponsor se ve como texto y su link `javascript:` queda en `#`.
11. La campanita muestra el aviso como texto, sin ejecutarlo.

## Pruebas aparte (no están en el banco)

- **La planilla real que pasó Joaquín** (`Recursos/Planilla Inscripcion ML clausura ´26-2.xlsx`):
  - Se cargó solo en la copia local de prueba y se miró un resumen enmascarado, sin nombres, DNIs ni teléfonos.
  - Resultado: 10 de 10 filas listas para importar, DNIs de 8 dígitos, fechas entre 2008 y 2010, celulares, Instagram y números bien leídos. También encontró el "CURSO".
  - La copia y el perfil del navegador se borraron después. Ningún dato real quedó en las planillas de prueba ni en este reporte.
- **Contra los CDN reales**, con el `admin.js` sin tocar:
  - SheetJS cargó con su hash de integridad. Si el hash no coincidiera, el navegador la bloquearía.
  - pdf.js leyó el PDF con su worker bajado de jsDelivr.
  - Unos 3 s por archivo, contando la descarga.
- **Capturas** en escritorio (1280 px) y a 390 px.

## Cómo correrlo

Igual que siempre (ver `REPORTE.md`: copia del sitio, `firebase-sdk-falso.js`, `cloudinary-falso.js` y la semilla vacía en `data.js`), con tres pasos más:

1. Bajar las librerías a `libs/`, en la raíz de la copia:
   ```
   curl -o libs/xlsx.full.min.js https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
   curl -o libs/pdf.min.mjs https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/pdf.min.mjs
   curl -o libs/pdf.worker.min.mjs https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/pdf.worker.min.mjs
   ```
2. En la **copia** de `JAVASCRIPT/admin.js`, reemplazar `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/` y `https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/` por `/libs/`. El hash de integridad sigue valiendo porque el archivo es el mismo.
3. Copiar `planillas-prueba/` a la raíz de la copia.

Edge, con `--host-resolver-rules` que incluya `MAP cdn.sheetjs.com ~NOTFOUND, MAP cdn.jsdelivr.net ~NOTFOUND`, así un pedido que se escape al CDN falla enseguida en vez de frenar la corrida.

`banco.html?solo=importar` corre solo lo que necesita el importador: arranque, equipos, jugadores, partidos, la Fecha 1 y las dos fases nuevas. Tarda alrededor de un minuto, contra unos 4 del banco completo.

Las planillas de `planillas-prueba/` se regeneran con `generar-planillas-prueba.py`:
- Usa una planilla real como molde (estilos, anchos y celdas combinadas) y le reemplaza todos los datos.
- También saca el autor, la ruta de OneDrive y la configuración de impresora.
- Necesita `reportlab` y Edge.

## Límites conocidos

- **PDF escaneado o foto:** no se puede leer. El importador lo detecta y avisa.
- **PDF con texto:** se lee por posición. Si un nombre largo ocupa dos renglones dentro de la celda, o las columnas del PDF están muy corridas, algún dato puede caer en otra columna. Por eso la vista previa avisa "revisá que cada dato haya quedado en su columna" y todo se puede corregir ahí.
- **Fechas:** una fecha escrita a la estadounidense y ambigua (1/9/2010) se lee como día/mes, que es lo que usa Excel en castellano. Si el mes pasa de 12 (2/18/2010), se da vuelta sola.
- **Sin probar:** contra Firebase real, en un celular real, y con un PDF real mandado por un equipo (no había ninguno a mano).
