# Genera las planillas de prueba del importador de jugadores (carpeta planillas-prueba/), todas con DATOS INVENTADOS.
#
#   python generar-planillas-prueba.py "<ruta a una planilla de inscripción real .xlsx>"
#
# La planilla real se usa solo como molde (estilos, anchos, celdas combinadas): se reemplazan todos los textos y
# números, y se sacan el autor, la ruta de OneDrive y la configuración de impresora. Ningún dato real llega a los
# archivos generados. Necesita reportlab (para los PDF) y Edge (para el PDF "impreso").
import io, os, re, subprocess, sys, zipfile, datetime
from xml.sax.saxutils import escape

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, 'planillas-prueba')
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

CURSO = 'CURSO: 5to 4ta'
CAPITAN, TEL_CAPITAN = 'Valentino Acuña', '11-2345-0001'
# nombre, dni, nacimiento, celular, instagram, dorsal  (lo que el importador tiene que leer, en cualquier formato)
JUGADORES = [
    ('Valentino Acuña', 50123456, (2010, 2, 18), '11-2345-0001', 'valen.acu', 21),
    ('Thiago Ñañez', 50234567, (2009, 11, 3), '11-2345-0002', 'thiago_nz', 7),
    ('Bautista Gómez', 49876543, (2009, 7, 25), '11 2345 0003', '@bauti.gomez', 10),
    ('Lautaro Pérez', 50345678, (2010, 5, 30), 1123450004, '', 0),
    ('Joaquín Ríos', 50456789, (2010, 1, 9), '11-2345-0005', '-', 99),
    ('Benjamín Sosa Frattini', 49987654, (2009, 12, 31), '11-2345-0006', 'benja.sf', 11),
    ('Ignacio Martínez', 50567890, (2010, 3, 14), '11-2345-0007', 'nacho.mtz', 5),
    ('Santino Rivero ', 50678901, (2009, 9, 9), '11-2345-0008', 'tinoriv', 47),
]
FILAS_PLANILLA = 10  # la planilla trae 10 renglones numerados; los que sobran quedan vacíos
TITULOS = ['NOMBRE Y APELLIDO', 'DNI', 'FECHA DE NAC.', 'CELULAR', 'INSTAGRAM', 'DORSAL CAMISETA']


def serial_excel(fecha):
    return (datetime.date(*fecha) - datetime.date(1899, 12, 30)).days


def miles(n, sep):
    return f'{n:,}'.replace(',', sep)


def fecha_ar(fecha, sep='/', dos_digitos=False):
    y, m, d = fecha
    return f'{d}{sep}{m}{sep}{y}' if not dos_digitos else f'{d:02d}{sep}{m:02d}{sep}{y}'


# ---------- XLSX: misma estructura que la planilla real, datos inventados ----------
def generar_xlsx(molde, destino):
    z = zipfile.ZipFile(molde)
    textos = []

    def s(t):
        if t not in textos:
            textos.append(t)
        return textos.index(t)

    def celda(ref, estilo, valor):
        if isinstance(valor, str):
            return f'<c r="{ref}" s="{estilo}" t="s"><v>{s(valor)}</v></c>'
        return f'<c r="{ref}" s="{estilo}"><v>{valor}</v></c>'

    filas = [
        f'<row r="1">{celda("A1", 18, "PLANILLA DE INSCRIPCIÓN CLAUSURA MITRE LEAGUE 2026")}</row>',
        f'<row r="2">{celda("A2", 20, CURSO)}</row>',
        f'<row r="4">{celda("A4", 15, "CAPITAN/A:")}{celda("B4", 3, CAPITAN)}{celda("C4", 16, "Es obligatorio completar todas las celdas con los datos correspondientes")}</row>',
        f'<row r="5">{celda("A5", 15, "TELÉFONO:")}{celda("B5", 3, TEL_CAPITAN)}</row>',
        '<row r="6">' + ''.join(celda(f'{c}6', 14 if c == 'G' else 13, t) for c, t in zip('BCDEFG', TITULOS)) + '</row>',
    ]
    for i in range(FILAS_PLANILLA):
        r = 7 + i
        partes = [celda(f'A{r}', 4, f'{i + 1})')]
        if i < len(JUGADORES):
            nombre, dni, nac, cel, ig, dorsal = JUGADORES[i]
            partes += [celda(f'B{r}', 5, nombre), celda(f'C{r}', 6, dni), celda(f'D{r}', 7, serial_excel(nac)),
                       celda(f'E{r}', 8, cel), celda(f'F{r}', 5, ig), celda(f'G{r}', 5, dorsal)]
        filas.append(f'<row r="{r}">' + ''.join(partes) + '</row>')

    hoja = z.read('xl/worksheets/sheet1.xml').decode('utf8')
    hoja = re.sub(r'<sheetData>.*</sheetData>', '<sheetData>' + ''.join(filas) + '</sheetData>', hoja, flags=re.S)
    hoja = re.sub(r'<pageSetup ([^>]*?) r:id="rId1"/>', r'<pageSetup \1/>', hoja)
    compartidos = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                   f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(textos)}" uniqueCount="{len(textos)}">'
                   + ''.join(f'<si><t xml:space="preserve">{escape(t)}</t></si>' for t in textos) + '</sst>')
    libro = re.sub(r'<mc:AlternateContent.*?</mc:AlternateContent>', '', z.read('xl/workbook.xml').decode('utf8'), flags=re.S)
    libro = re.sub(r'<xr:revisionPtr[^>]*/>', '', libro)
    nucleo = re.sub(r'<(dc:creator|cp:lastModifiedBy)>[^<]*<', r'<\1>Banco de pruebas<', z.read('docProps/core.xml').decode('utf8'))

    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as out:
        for n in z.namelist():
            if n.startswith('xl/printerSettings/') or n == 'xl/worksheets/_rels/sheet1.xml.rels':
                continue
            datos = z.read(n)
            if n == 'xl/worksheets/sheet1.xml': datos = hoja.encode('utf8')
            elif n == 'xl/sharedStrings.xml': datos = compartidos.encode('utf8')
            elif n == 'xl/workbook.xml': datos = libro.encode('utf8')
            elif n == 'docProps/core.xml': datos = nucleo.encode('utf8')
            elif n == '[Content_Types].xml':
                datos = re.sub(rb'<Default Extension="bin"[^>]*/>', b'', datos)
            out.writestr(n, datos)


# ---------- CSV como lo guarda Excel en castellano: ";" y Windows-1252, con lo que se ve en cada celda ----------
def generar_csv(destino):
    renglones = ['PLANILLA DE INSCRIPCIÓN CLAUSURA MITRE LEAGUE 2026;;;;;;', f'{CURSO};;;;;;', ';;;;;;',
                 f'CAPITAN/A:;{CAPITAN};Es obligatorio completar todas las celdas con los datos correspondientes;;;;',
                 f'TELÉFONO:;{TEL_CAPITAN};;;;;', ';' + ';'.join(TITULOS)]
    for i in range(FILAS_PLANILLA):
        if i < len(JUGADORES):
            nombre, dni, nac, cel, ig, dorsal = JUGADORES[i]
            renglones.append(';'.join([f'{i + 1})', nombre, miles(dni, '.'), fecha_ar(nac), str(cel), ig, str(dorsal)]))
        else:
            renglones.append(f'{i + 1});;;;;;')
    open(destino, 'wb').write(('\r\n'.join(renglones) + '\r\n').encode('cp1252'))


# ---------- PDF "Guardar como PDF": la planilla en HTML (anchos y centrado de la real) impresa por Edge ----------
def generar_pdf_edge(destino):
    anchos = [13.89, 45.71, 14.70, 12.27, 17.66, 19.42, 18.34]
    col = ''.join(f'<col style="width:{a * 7 + 5:.0f}px">' for a in anchos)
    td = lambda t, extra='': f'<td{extra}>{escape(str(t))}</td>'
    filas = [f'<tr><td colspan="7" class="titulo">PLANILLA DE INSCRIPCIÓN CLAUSURA MITRE LEAGUE 2026</td></tr>',
             f'<tr><td colspan="7" class="curso">{CURSO}</td></tr>',
             f'<tr>{td("CAPITAN/A:", " class=t")}{td(CAPITAN)}<td colspan="5" rowspan="2" class="nota">Es obligatorio completar todas las celdas con los datos correspondientes</td></tr>',
             f'<tr>{td("TELÉFONO:", " class=t")}{td(TEL_CAPITAN)}</tr>',
             '<tr class="tit"><td></td>' + ''.join(f'<td>{"DORSAL<br>CAMISETA" if t.startswith("DORSAL") else t}</td>' for t in TITULOS) + '</tr>']
    for i in range(FILAS_PLANILLA):
        if i < len(JUGADORES):
            nombre, dni, nac, cel, ig, dorsal = JUGADORES[i]
            filas.append('<tr>' + td(f'{i + 1})') + td(nombre) + td(miles(dni, '.')) + td(fecha_ar(nac)) + td(cel) + td(ig) + td(dorsal) + '</tr>')
        else:
            filas.append('<tr>' + td(f'{i + 1})') + '<td></td>' * 6 + '</tr>')
    html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
        @page {{ size: A4 landscape; margin: 1.9cm 1.8cm; }}
        body {{ font-family: Arial, sans-serif; font-size: 10pt; margin: 0; }}
        table {{ border-collapse: collapse; table-layout: fixed; }}
        td {{ border: 1px solid #000; text-align: center; vertical-align: middle; height: 20px; padding: 0 3px; overflow: hidden; white-space: nowrap; }}
        .titulo {{ font-size: 14pt; font-weight: bold; background: #ddd; }} .curso {{ font-size: 13pt; font-weight: bold; height: 34px; }}
        .t {{ font-weight: bold; }} .nota {{ font-style: italic; white-space: normal; }}
        .tit td {{ font-weight: bold; background: #ccc; height: 34px; white-space: normal; }}
    </style></head><body><table>{col}{''.join(filas)}</table></body></html>'''
    ruta_html = os.path.join(SALIDA, '_planilla.html')
    open(ruta_html, 'w', encoding='utf8').write(html)
    perfil = os.path.join(os.environ.get('TEMP', SALIDA), 'perfil-edge-planillas')
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', f'--user-data-dir={perfil}',
                    f'--print-to-pdf={destino}', 'file:///' + ruta_html.replace('\\', '/')], check=True, capture_output=True, timeout=120)
    os.remove(ruta_html)


# ---------- PDF armado con otra herramienta y otros formatos: títulos distintos, nombres a la izquierda, ----------
# ---------- DNI con puntos, fecha con guiones y número de página abajo ----------
def generar_pdf_reportlab(destino):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    estilos = getSampleStyleSheet()
    datos = [['', 'APELLIDO Y NOMBRE', 'DNI', 'FECHA DE NACIMIENTO', 'CELULAR', 'INSTAGRAM', 'N° CAMISETA']]
    for i, (nombre, dni, nac, cel, ig, dorsal) in enumerate(JUGADORES):
        datos.append([f'{i + 1})', nombre.strip(), miles(dni, '.'), fecha_ar(nac, '-', True), str(cel), ig, str(dorsal)])
    tabla = Table(datos, colWidths=[30, 210, 80, 120, 95, 100, 80])
    tabla.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, colors.black), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                               ('FONTSIZE', (0, 0), (-1, -1), 10), ('ALIGN', (2, 1), (-1, -1), 'CENTER'), ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                               ('ALIGN', (1, 1), (1, -1), 'LEFT'), ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey)]))
    pie = lambda c, d: (c.setFont('Helvetica', 9), c.drawCentredString(landscape(A4)[0] / 2, 25, f'Página {d.page}'))
    doc = SimpleDocTemplate(destino, pagesize=landscape(A4), leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=50)
    doc.build([Paragraph('Inscripción Mitre League — ' + CURSO, estilos['Title']), tabla], onFirstPage=pie, onLaterPages=pie)


# ---------- PDF "escaneado": solo la grilla dibujada, sin ningún texto ----------
def generar_pdf_escaneado(destino):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(destino, pagesize=landscape(A4))
    for i in range(12):
        c.line(60, 500 - i * 30, 780, 500 - i * 30)
    for x in (60, 120, 360, 450, 540, 640, 720, 780):
        c.line(x, 500, x, 170)
    c.save()


if __name__ == '__main__':
    os.makedirs(SALIDA, exist_ok=True)
    generar_xlsx(sys.argv[1], os.path.join(SALIDA, 'planilla-valida.xlsx'))
    generar_csv(os.path.join(SALIDA, 'planilla-valida.csv'))
    generar_pdf_edge(os.path.join(SALIDA, 'planilla-valida-impresa.pdf'))
    generar_pdf_reportlab(os.path.join(SALIDA, 'planilla-valida-otro-formato.pdf'))
    generar_pdf_escaneado(os.path.join(SALIDA, 'planilla-escaneada.pdf'))
    print('Listo:', sorted(os.listdir(SALIDA)))
