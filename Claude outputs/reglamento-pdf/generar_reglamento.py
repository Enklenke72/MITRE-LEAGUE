# -*- coding: utf-8 -*-
"""
Genera el PDF del reglamento MITRE LEAGUE 2026 con los cambios aprobados
(ver Claude outputs/reglamento-antes-y-despues.md y correccion-reglamento-22-09-2026.md).
Aplicado el 27/09/2026 sobre Recursos/Reglamento MITRE LEAGUE 2026.pdf.

Reproduce el estilo visual del PDF original: misma fuente (Merriweather, la
que ya traía embebida el PDF original, pero descargada completa de Google
Fonts porque el subset embebido no traía todos los caracteres que hacen
falta para el texto nuevo — a este script lo acompañan
Merriweather-Regular.ttf y Merriweather-Bold.ttf, licencia SIL Open Font
License, así no depende de tener internet para volver a correr), mismo
tamaño de página, mismos márgenes, mismo encabezado/pie en cada hoja.

Todo el texto que NO cambia se copió tal cual del PDF original (extracción
con pymupdf, sin retipear a mano, para no introducir erratas; se verificó
por comparación automática de texto que coincide exacto). Solo se
reescriben los puntos ya aprobados por Joaquín.

Requiere: pip install pypdf reportlab. Para volver a correrlo, ajustar
RUTA_REPO más abajo si el repo se movió.
"""
import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from pypdf import PdfReader, PdfWriter

RUTA_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_REPO = os.path.normpath(os.path.join(RUTA_SCRIPT, "..", ".."))

FUENTES = RUTA_SCRIPT
SALIDA = os.path.join(RUTA_REPO, "Recursos", "Reglamento MITRE LEAGUE 2026.pdf")

pdfmetrics.registerFont(TTFont("Merri", os.path.join(FUENTES, "Merriweather-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Merri-Bold", os.path.join(FUENTES, "Merriweather-Bold.ttf")))

ANCHO, ALTO = 596, 842  # mismo tamaño que el PDF original

# ------------------------------------------------------------------
# Estilos (medidos sobre el PDF original: márgenes 72/70, cuerpo 12pt,
# interlineado ~16.5, separación entre párrafos ~13, encabezados de
# sección centrados en negrita, subtítulos de "Reglas de Juego" con
# sangría de 36pt)
# ------------------------------------------------------------------
titulo = ParagraphStyle("titulo", fontName="Merri-Bold", fontSize=18, leading=22,
                         alignment=TA_CENTER, spaceAfter=13)
centrado = ParagraphStyle("centrado", fontName="Merri", fontSize=12, leading=16.5,
                           alignment=TA_CENTER, spaceAfter=13)
encabezado_seccion = ParagraphStyle("encabezado_seccion", fontName="Merri-Bold", fontSize=12,
                                     leading=16.5, alignment=TA_CENTER, spaceBefore=13, spaceAfter=13)
cuerpo = ParagraphStyle("cuerpo", fontName="Merri", fontSize=12, leading=16.5,
                         alignment=TA_LEFT, spaceAfter=13)
subtitulo_regla = ParagraphStyle("subtitulo_regla", fontName="Merri-Bold", fontSize=12,
                                  leading=16.5, alignment=TA_LEFT, leftIndent=36, spaceAfter=13)

def art(numero_negrita, texto):
    """Un artículo: número en negrita seguido del texto en redonda, mismo párrafo."""
    return Paragraph(f"<b>{numero_negrita}</b>{texto}", cuerpo)

def p(texto, estilo=cuerpo):
    return Paragraph(texto, estilo)

def h(texto):
    return Paragraph(texto, encabezado_seccion)

def sub(texto):
    return Paragraph(texto, subtitulo_regla)

story = []
story.append(Paragraph("Reglamento MITRE LEAGUE 2026", titulo))
story.append(p("Se deja en claro desde un principio que este torneo está realizado por "
                "estudiantes y NO por el Colegio ni por la sede donde se realiza el torneo.",
                centrado))

story.append(h("Preliminar"))
story.append(art("Artículo 1°- ",
    "La participación en el torneo implica el conocimiento y la aceptación de este "
    "reglamento. La aceptación se formaliza una única vez mediante la firma de la ficha "
    "médica por el adulto responsable, o por el propio alumno si es mayor de 18 años."))

story.append(h("Lista de Buena Fe"))
story.append(art("Artículo 2°- ",
    "Cada equipo que desee inscribirse al torneo, deberá reunir un mínimo de 5 jugadores "
    "y completar la lista de su equipo con los siguientes datos de cada uno: Nombre "
    "Completo, DNI, Año y División*. Todos los jugadores deben ser estudiantes del "
    "Colegio Emilio Mitre."))
story.append(p("Todos los jugadores deberán presentar la ficha médica correspondiente para "
                "poder participar, sin excepción alguna, la primera fecha del torneo (más "
                "tardar, la 2da fecha). Completa y firmada por un adulto responsable en caso "
                "de que el jugador sea menor de edad; o con la firma del alumno mayor de 18 años."))
story.append(art("Artículo 3°- ",
    "En cada partido los jugadores deben presentar su DNI (físico o digital) antes de "
    "jugar. La asistencia es registrada por el staff de la Organización mediante la lista "
    "de buena fe digital. Si esto no se cumpliese, el jugador no podrá disputar el "
    "partido. En caso de falta de tiempo, la acreditación podrá completarse durante el "
    "entretiempo."))
story.append(art("Artículo 4°- ",
    "Si, por cualquier motivo o razón, un equipo el día del encuentro no presenta un "
    "mínimo de 4 jugadores inscriptos, se le concederán los puntos del encuentro al "
    "equipo rival si este se presentase y abonase el arancel correspondiente."))
story.append(art("Artículo 5°- ",
    "En la Lista de cada equipo se podrán inscribir hasta un máximo de 10 jugadores, y se "
    "podrán efectuar modificaciones hasta las 72 horas antes de cada encuentro, y "
    "aquellas modificaciones deberán siempre ser informadas a la Organización. Mínimo 4 "
    "jugadores para presentarse y comenzar el partido, máximo 10 inscriptos en lista."))
story.append(art("Artículo 6°- ",
    "En cada encuentro, todos los jugadores de cada equipo deberán estar registrados "
    "como presentes en la Lista de Buena Fe digital (ver Artículo 3°) para poder "
    "disputar el partido."))
story.append(p("*Se agrega que: cada equipo tendrá la posibilidad de inscribir hasta 1 (un) "
                "único jugador del mismo año, pero distinta división. Este jugador debe estar "
                "inscripto en un solo equipo por edición del torneo. El capitán tiene el deber "
                "de comunicar esta decisión a la Organización, y en la ficha de inscripción "
                "deberá constatar a qué año y división pertenece dicho jugador."))
story.append(p("No se permitirán traspasos de jugadores entre equipos en una misma edición "
                "de la liga. Cada jugador puede jugar en un solo equipo por edición del torneo."))
story.append(p("Las condiciones de inscripción deben ser cumplidas a la fecha de inscripción "
                "del equipo."))

story.append(h("Pagos y Deuda"))
story.append(art("Artículo 7°- ",
    "Antes de cada encuentro, todos los equipos deberán abonar sin excepción el arancel "
    "correspondiente."))
story.append(art("Artículo 8°- ",
    "Si por algún motivo un equipo no pudiera abonar la totalidad del arancel en algún "
    "encuentro, el mismo quedará con deuda hasta el próximo encuentro, donde deberá "
    "abonar ambas fechas. Si la deuda no se cancela, el Tribunal de Disciplina, tras "
    "conversar con el capitán del equipo, podrá aplicar una quita de 1 (un) punto de la "
    "tabla de posiciones. Esta quita se aplica una única vez por cada deuda (no se repite "
    "en las fechas siguientes mientras siga sin cancelarse) y se devuelve automáticamente "
    "en el momento en que el equipo salde lo adeudado."))
story.append(art("Artículo 9°- ",
    "La Organización podrá inscribir equipos nuevos en el momento que lo desee."))
story.append(art("Artículo 9 Bis – ",
    "En caso de reemplazo de un equipo por otro, el participante nuevo conservará la "
    "misma cantidad de puntos y estadísticas en general con las que contaba el equipo "
    "reemplazado."))
story.append(art("Artículo 10°- ",
    "El arancel impuesto por la Organización podrá ser modificado durante la realización "
    "del torneo."))
story.append(art("Artículo 11°- ",
    "Se podrá cobrar un valor de entrada al público; estipulado dependiendo de la fase "
    "del torneo, comunicado previamente por la Organización. Menores de 10 años no "
    "abonan entrada."))
story.append(art("Artículo 12°- ",
    "Bajo ningún concepto se reintegrará el pago del arancel correspondiente al derecho "
    "de partido. El saldo a favor que pueda generarse por una ausencia (ver Artículo 17° "
    "Bis) no constituye un reintegro: se descuenta del arancel de la siguiente fecha que "
    "el equipo dispute."))

story.append(h("Formato"))
story.append(p("Se realizará una inicial una Fase de grupos, donde los mejores clasificados "
                "pasarán a la ronda de Play-Offs."))
story.append(p("Las llaves de Play-Offs serán determinadas en base a las posiciones de cada "
                "equipo en la fase de grupos."))

story.append(h("Partidos"))
story.append(art("Artículo 13°- ",
    "Los equipos estarán formados por 5 (cinco) jugadores, uno de los cuales será el "
    "arquero."))
story.append(art("Artículo 14°- ",
    "La puntuación será de 3 puntos por partido ganado, 1 punto por partido empatado y 0 "
    "puntos por partido perdido. La ausencia de un equipo a un encuentro se rige por lo "
    "dispuesto en el Artículo 17° Bis, y puede implicar la pérdida de 2 (dos) puntos de "
    "la tabla si no se regulariza el pago correspondiente."))
story.append(art("Artículo 15°- ",
    "Los encuentros durante la fase de grupos tendrán una duración total de 30 (treinta) "
    "minutos, divididos en dos tiempos de 15 (quince) y un descanso de 5 (cinco) minutos "
    "en el entretiempo. La Organización puede modificar los minutos de cada tiempo de ser "
    "necesario."))
story.append(art("Artículo 16°- ",
    "En instancias de Play-Offs, los partidos tendrán la misma duración que en la fase de "
    "grupos: 30 (treinta) minutos, divididos en dos tiempos de 15 (quince) minutos y un "
    "descanso de 5 (cinco) minutos en el entretiempo. La Organización puede modificar los "
    "minutos de cada tiempo de ser necesario."))
story.append(art("Artículo 17°- ",
    "El horario de citación de los partidos será de 15 minutos antes del comienzo del "
    "partido, tiempo en el cual los jugadores deberán presentar su DNI (físico o "
    "digital) para ser registrados como presentes en la Lista de Buena Fe digital, y "
    "deberá abonarse el arancel correspondiente. Si el equipo no estuviera presente "
    "cumplidos estos 15 minutos, se le sumará 1 gol al rival por cada 5 minutos de "
    "espera hasta completarse el partido con un resultado de 3 a 0 (ver Artículo 17° "
    "Bis). El equipo que se presentó deberá abonar el 100% del arancel correspondiente "
    "al partido para que se le reconozcan los puntos, y se le asignará otro rival para "
    "disputar un partido amistoso."))
story.append(art("Artículo 17° Bis – ",
    "Cuando un equipo no se presente a un encuentro dentro del horario de citación del "
    "Artículo 17°, se aplicará lo siguiente:"))
story.append(p("a) El equipo ausente pierde el partido 3 a 0. Para no perder puntos de la "
                "tabla, deberá abonar como mínimo el 50% del arancel correspondiente antes "
                "de su siguiente encuentro. Si abona el 50% o más, conserva sus puntos (el "
                "excedente pagado por encima del 50% queda como saldo a favor para su "
                "siguiente partido, ver Artículo 12°). Si abona menos del 50%, o no abona, "
                "se le restarán 2 (dos) puntos de la tabla de posiciones; esta quita se "
                "levanta automáticamente en el momento en que el equipo cancele la deuda."))
story.append(p("b) El equipo que sí se presentó deberá abonar el 100% del arancel "
                "correspondiente para que se le reconozca el resultado de 3 a 0 y los "
                "puntos del partido, y se le asignará otro rival para disputar un partido "
                "amistoso. Si abona entre el 50% y el 100%, el partido queda suspendido, "
                "sin puntos para ninguno de los dos equipos. Si abona menos del 50%, se lo "
                "considerará también como equipo no presentado, aplicándosele lo dispuesto "
                "en el inciso a)."))
story.append(p("c) En instancias de Play-Offs no rige la quita de puntos ni el 3 a 0 "
                "automático de este artículo: el equipo ausente queda directamente "
                "eliminado del torneo, y no corresponde el pago del arancel de ese "
                "encuentro."))
story.append(art("Artículo 18°- ",
    "Las fechas de Play-Offs (8vos, 4tos, Semifinales y Final) podrán ser a PARTIDO "
    "ÚNICO."))

story.append(h("Inferioridad numérica"))
story.append(art("Artículo 19°- ",
    "El partido se verá suspendido cuando un equipo se vea con la cantidad de 3 "
    "jugadores. El equipo con más jugadores en la cancha será favorecido con un "
    "resultado de 3 a 0, excepto que en ese momento el resultado fuera por mayor "
    "diferencia, lo cual se deberá respetar."))

story.append(h("Suspensión del Partido"))
story.append(art("Artículo 20°- ",
    "Podrá verse suspendido el partido por decisión del árbitro ante las siguientes "
    "posibles situaciones:"))
for item in [
    "1- Agresiones físicas hacia el árbitro, realizadas por jugadores o público presente.",
    "2- Agresiones físicas entre el público presente o entre los jugadores.",
    "3- Agresiones verbales del público presente.",
    "4- Agresiones y daños del público presente a la propiedad de la sede donde se "
    "disputa el partido.",
    "5- Cuando el clima presente tormentas eléctricas.",
    "6- Cuando la cancha no presente condiciones necesarias para asegurar la seguridad "
    "para los jugadores y demás personas presentes.",
]:
    story.append(p(item))

story.append(h("Políticas de Lluvia"))
story.append(art("Artículo 21°- ",
    "Si el día del encuentro, el clima presenta probabilidades de lluvia o "
    "inestabilidad, el capitán de cada equipo deberá contactarse con la Organización "
    "para confirmar la realización de la fecha."))
story.append(art("Artículo 22°- ",
    "En caso de tormenta eléctrica, el árbitro podrá suspender el encuentro. Si el "
    "encuentro no se reanuda ese mismo día, el partido se verá reprogramado para otra "
    "jornada, pero en ningún caso se reintegrará el pago del arancel."))
story.append(art("Artículo 23°- ",
    "Se tomará el resultado y el tiempo del partido al momento de la suspensión, "
    "dividiendo en 2 tiempos el lapso restante."))

story.append(h("Sanciones"))
story.append(art("Artículo 24°- ",
    "Faltas que implican Tarjeta Amarilla y sanción al jugador:"))
for item in [
    "1- Conducta antideportiva",
    "2- Palabras o acciones discriminatorias",
    "3- Incumplir las reglas del juego",
    "4- Incumplir distancias reglamentarias",
]:
    story.append(p(item))
story.append(art("Artículo 25°- ",
    "Si un jugador acumulase dos tarjetas amarillas en un partido, el árbitro lo "
    "sancionará con Tarjeta Azul."))
story.append(p("Las tarjetas amarillas NO se acumulan de un partido a otro."))
story.append(p("La tarjeta azul NO impide al jugador disputar la siguiente fecha."))
story.append(art("Artículo 26º - ",
    "Faltas que implican Tarjeta Azul y expulsión del jugador*:"))
for item in [
    "1- Doble tarjeta amarilla",
    "2- Último recurso (propenso a gol)",
    "3- Reiteración en palabras o acciones discriminatorias, o conducta antideportiva.",
]:
    story.append(p(item))
story.append(p("*El equipo jugará con un jugador menos por 3 minutos o hasta que el equipo "
                "rival marque un gol, luego podrá entrar un suplente para completar el "
                "equipo. El jugador sancionado con Tarjeta Azul NO podrá volver a "
                "participar del encuentro."))
story.append(art("Artículo 27°- ",
    "Faltas que implican Tarjeta Roja y expulsión del jugador:"))
for item in [
    "1- Conducta violenta",
    "2- Juego brusco grave",
    "3- Agredir a cualquier persona (incluye escupidas), verbal o físicamente.",
    "4- Falta brusca que impida la oportunidad de gol de un jugador contrario que se "
    "dirija hacia el arco, sancionable con tiro libre o penal.",
    "5- Detener intencionalmente con la mano una oportunidad clara de gol",
]:
    story.append(p(item))
story.append(p("La expulsión de un jugador NO se limpia por pasar de fase."))
story.append(art("Artículo 28°- ",
    "Los jugadores sancionados con Tarjeta Azul o Tarjeta Roja deberán retirarse de la "
    "cancha, y del lugar designado para suplentes; permaneciendo el resto del partido "
    "por fuera de estas dos áreas."))
story.append(art("Artículo 29°- ",
    "La cantidad de fechas posibles de la suspensión queda a decisión de la "
    "Organización."))
story.append(art("Artículo 30°- ",
    "La Organización puede decidir acerca de la continuidad de un jugador/equipo en el "
    "torneo, en relación a la gravedad del caso de su expulsión/episodio de violencia."))

story.append(h("Permanencia Dentro del Campo de Juego y sus Cercanías"))
story.append(art("Artículo 31°- ",
    "Toda persona ajena al partido o jugadores suplentes deberán estar fuera de la "
    "cancha mientras el juego esté en curso."))
story.append(art("Artículo 32°- ",
    "El público/persona ajena al partido, deberá permanecer en la zona designada para "
    "ese grupo (tribunas, detrás del alambrado, etc)."))
story.append(art("Artículo 33°- ",
    "Quienes pueden ingresar a la zona inmediatamente por fuera del campo de juego son: "
    "Jugadores, Árbitros, Miembros/Personal/Colaboradores de la Organización."))

story.append(h("— Reglas de Juego —"))
story.append(art("Artículo 34°- ",
    "Se instauran las siguientes reglas de juego que adoptará el torneo para toda su "
    "realización:"))

story.append(sub("Goles"))
story.append(p("Serán convalidados desde cualquier sector del campo de juego exceptuando "
                "que se realice desde un saque de banda."))

story.append(sub("Tiros Libres"))
story.append(p("Se deberá dejar al menos 1 paso de distancia entre los jugadores rivales. "
                "Todos los tiros libres serán directos, incluyendo piso (excepto que no "
                "sean de contacto; todo tiro libre indirecto dentro del área se ejecutará "
                "desde el borde del área y la barrera se ubicara en la línea de meta)."))
story.append(p("Si el jugador ejecutante pide distancia, el rival debe dar 3 pasos desde "
                "la pelota. Aquí deberá esperar la orden del árbitro para efectuar el tiro "
                "libre."))
story.append(p("Si el jugador rival no respetase la distancia, podrá ser amonestado."))

story.append(sub("Piso"))
story.append(p("Se cobrará tiro libre directo* frente al piso efectuado en disputa por el "
                "balón y/o en pos de sacar ventaja sobre el rival, cuando este se de a "
                "menos de un metro de distancia del jugador contrario."))
story.append(p("*Dentro del área, el piso en disputa por el balón y/o en pos de sacar "
                "ventaja sobre el rival (menos de un metro de distancia sobre él) será "
                "sancionado con tiro penal."))
story.append(p("El piso sumará como \u201cfalta\u201d en la libreta del árbitro."))

story.append(sub("Laterales"))
story.append(p("El lateral deberá ejecutarse con los pies y, en caso de realizarse "
                "incorrectamente, se le concederá al rival."))
story.append(p("Deberá haber un mínimo de 1 metro de distancia entre el rival y el "
                "jugador que ejecuta el lateral. De no respetarse dicha distancia, el "
                "rival podría recibir una Tarjeta Amarilla."))

story.append(sub("Tiros de Esquina"))
story.append(p("El rival del jugador que ejecuta el tiro de esquina deberá colocarse "
                "sobre la línea del área propia. De no respetarse dicha distancia, el "
                "rival podría recibir una Tarjeta Amarilla."))

story.append(sub("Cambios"))
story.append(p("En cada partido se podrán realizar cambios ilimitados. NO será necesario "
                "pedir autorización al árbitro para realizar los cambios."))
story.append(p("Para la realización de un cambio el balón NO debe estar en juego."))

story.append(sub("Arquero"))
story.append(p("Solo podrá tomar con la mano los pases realizados de sus compañeros "
                "hechos con una parte del cuerpo, de la cintura para arriba o con la "
                "cabeza. En caso de tomar la pelota con sus manos tras un pase de su "
                "compañero con una parte del cuerpo indebida, se sancionará tiro libre "
                "indirecto para el rival desde el borde del área."))
story.append(p("Podrá tener la pelota en su poder hasta un máximo de 5 segundos, antes de "
                "ser sancionado con un tiro libre por retención."))

story.append(sub("Saque de Arquero"))
story.append(p("El saque de arco siempre deberá ser con las manos, pasando la pelota "
                "fuera de su área."))
story.append(p("Únicamente podrá salir jugando con los pies luego de una atajada que no "
                "derive en un corte de la jugada."))
story.append(p("Si algún jugador contrario impide al arquero sacar, será considerado "
                "infracción y podrá ser sancionado con Tarjeta Amarilla."))
story.append(p("En el saque de arco se permite pasar la línea de mitad de campo."))

story.append(sub("Tiro penal"))
story.append(p("Será realizado desde el punto penal marcado en el área y el jugador que "
                "lo ejecute no podrá tomar carrera."))
story.append(p("Las faltas dentro del área por parte de un jugador o el arquero, "
                "determinarán un tiro penal para el rival."))
story.append(p("Tocar la pelota con la mano dentro del área por parte de un jugador que "
                "no sea el arquero, determinarán un tiro penal para el rival."))
story.append(p("Cuando un equipo cometa 6 faltas en cualquiera de los dos tiempos, se "
                "cobrará un \u201ctiro castigo\u201d que es la ejecución de un tiro penal, "
                "pero con carrera. La distancia donde se coloca la pelota es a 11 pasos "
                "desde la línea de meta. Los jugadores que no sean el ejecutante del "
                "penal o el arquero que defiende su arco deberán permanecer detrás de "
                "mitad de cancha."))
story.append(p("Llegados los Play-Offs, el arquero que se encuentre en la cancha al "
                "finalizar el partido deberá ser el mismo que ataje los penales."))
story.append(p("Los partidos de Play-Offs se definirán por 3 penales por cada equipo."))

story.append(sub("Último Recurso"))
story.append(p("La intervención con la mano de un jugador que no fuera el arquero o de "
                "este fuera del área será tomada como último recurso. Como así también "
                "la falta del último hombre ante una clara situación de gol."))

story.append(sub("Pique"))
story.append(p("Se realizará para reanudar el juego luego de una interrupción temporal "
                "necesaria, siempre que la pelota no haya salido de la cancha y que la "
                "pelota esté en juego."))

story.append(sub("Árbitros"))
story.append(p("Se asignará 1 (un) árbitro para cada encuentro, quien será la máxima "
                "autoridad dentro del campo de juego. Serán sancionadas las faltas de "
                "respeto dentro o fuera de la cancha durante o después de un partido "
                "dirigidas al árbitro."))
story.append(p("El árbitro sorteará para decidir quién inicia el juego y quien elige el "
                "lado de la cancha. Ante la ausencia del árbitro designado, la "
                "Organización elegirá a un miembro que cumpla la misma función."))
story.append(p("Puede solicitar el retiro de algún espectador, simpatizante o jugador si "
                "fuera necesario para el normal inicio, desarrollo o desenlace del "
                "partido. Si este no se retirara puede ser suspendido el partido y el "
                "equipo por el cual simpatiza/juega podrá perder los puntos."))
story.append(p("NO permitirá que personas sin autorización entren en el campo de juego o "
                "inmediatamente por fuera de él. Si esto ocurriera, tiene el poder de "
                "pausar el partido hasta que la situación se regularice."))

story.append(art("Artículo 35°- ",
    "Está prohibido el uso de botines de 11 y de accesorios tipo aretes, aros, anillos, "
    "piercings, cadenas, etc. (exceptuando algunas situaciones excepcionales). En caso "
    "de que el árbitro vea, antes o durante el partido, que se incumple esta regla, el "
    "jugador será amonestado sin previo aviso."))
story.append(art("Artículo 35° Bis- ",
    "No se permitirá la pérdida de tiempo de juego por este motivo, lo que obliga al "
    "equipo a realizar el cambio obligatorio del jugador hasta que esté en condiciones "
    "de volver a la cancha. Si no tienen cambios, el equipo jugará con un jugador "
    "menos."))

story.append(h("— Disposiciones Generales —"))
story.append(art("Artículo 36°- ",
    "Como dicta el Artículo 1°, la participación en el torneo implica el conocimiento y "
    "la aceptación de este reglamento, formalizada mediante la firma de la ficha "
    "médica. Cada jugador se atiene a todas las consecuencias en caso de "
    "incumplimiento."))
story.append(art("Artículo 37°- ",
    "En el caso de que un equipo juegue con alguien que no está anotado en la lista o "
    "no es quien dice ser; se les quitarán los puntos y se les advertirá de dicha "
    "conducta al capitán del equipo. En el caso de que un jugador esté anotado en la "
    "lista, pero infrinja las condiciones de inscripción; se le quitarán los puntos "
    "del partido al equipo al que pertenece y se le advertirá de dicha conducta a su "
    "capitán."))
story.append(art("Artículo 38°- ",
    "Si algún equipo tuviera que realizar un reclamo deberá canalizarlo a través de su "
    "capitán."))
story.append(art("Artículo 39°- ",
    "En caso de suspender la fecha de antemano por parte de la Organización se "
    "comunicará al equipo antes de la fecha de juego."))
story.append(art("Artículo 40°- ",
    "Ante un acto de violencia o actitud antideportiva por parte del público presente "
    "para con los demás, se responsabilizará al equipo al cual pertenezca/apoyen las "
    "personas del público en cuestión. Ante esta situación, el partido podrá ser "
    "suspendido y el equipo responsable perderá los puntos, según consideración de la "
    "Organización."))
story.append(art("Artículo 40° Bis- ",
    "La continuidad del equipo en el Torneo dependerá de la gravedad del episodio y "
    "quedará a consideración de la Organización."))
story.append(art("Artículo 41°- ",
    "La Organización se encargará de publicar el presente reglamento en la red social "
    "oficial del torneo: @mitre.league en Instagram; y también de enviarlo a los "
    "capitanes de cada equipo, quienes se encargarán de hacerlo llegar a todos sus "
    "compañeros de equipo."))
story.append(art("Artículo 42°- ",
    "En concordancia con lo establecido en el Artículo 1°, cada jugador cede de manera "
    "gratuita y voluntaria a la Organización del Torneo el derecho de uso de su "
    "imagen. Este consentimiento se formaliza una única vez, junto con la aceptación "
    "del reglamento, mediante la firma de la ficha médica por el adulto responsable, o "
    "por el propio alumno si es mayor de 18 años. Esto autoriza la captura de "
    "fotografías y videos durante la jornada deportiva para su posterior difusión en "
    "el Instagram oficial del torneo, redes sociales y cualquier material publicitario "
    "o informativo relacionado con la competencia. La organización garantiza que el "
    "uso de dicho material será exclusivamente para fines de promoción y cobertura del "
    "evento."))


def encabezado_pie(canvas, doc):
    canvas.saveState()
    canvas.setFont("Merri", 11)
    canvas.drawCentredString(ANCHO / 2, 795, "Reglamento Mitre League")
    canvas.drawCentredString(ANCHO / 2, 40, "Mitre League")
    canvas.restoreState()


buf = io.BytesIO()
doc = SimpleDocTemplate(buf, pagesize=(ANCHO, ALTO),
                         leftMargin=72, rightMargin=70, topMargin=72, bottomMargin=55)
doc.build(story, onFirstPage=encabezado_pie, onLaterPages=encabezado_pie)
buf.seek(0)

with open(SALIDA, "wb") as f:
    f.write(buf.read())

r = PdfReader(SALIDA)
print("OK. Paginas generadas:", len(r.pages))
