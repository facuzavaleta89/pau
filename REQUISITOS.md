# REQUISITOS.md — Qué pidió Pau

Resumen fiel del instructivo que mandó Pau (kinesióloga). Su documento mezcla **lo que ella necesita** con **ideas que le sugirió otro chat de IA**. Esa diferencia importa para priorizar: lo primero es su dolor real, lo segundo es opcional.

---

## 1. Cómo trabaja hoy

Usa Word, un archivo por mes, y los archiva en una carpeta (tiene 3 años de historial).

### RPG — sesiones individuales (martes y jueves)
Lista simple por día: hora, nombre y estado.

```
MARTES 3/3
9:00  LORE – PAGADO MASAJES
10:00 FACU – PENDIENTE PAGO
11:00 RAMI – CANCELA
JUEVES 5/3
11:00 RAMI – PAGADO EVALUACION INICIAL
```

Observaciones importantes:
- El pago es **por sesión**, no mensual.
- Hay **tipos de sesión** distintos con precio propio: RPG, masajes, evaluación inicial.
- Estados de la sesión: realizada / cancela / pendiente.

### TPA — clases grupales (lunes, miércoles y viernes)
Es lo más "caótico". Tiene dos niveles:

**a) Calendario general fijo** (grilla horario × alumnos). Verde = ya pagó el mes.

| Día | Horarios que usa hoy |
|---|---|
| Lunes | 10:30, 11:30, 12:30, 16:00, 17:00, 18:00, 19:00 |
| Miércoles | 10:30, 11:30, 12:30, 16:00, 17:00, 18:00, 19:00 |
| Viernes | 10:30, 11:30, 12:30, 16:00, 17:00, 18:00 |

Cada horario tiene **4 lugares** (columnas de su grilla).

**b) Copia semana a semana** donde marca con colores:
- quién asistió (verde),
- quién faltó avisando (rojo, con texto "FALTA AVISA"),
- quién faltó sin avisar,
- quién **recupera** en ese horario (celeste, "RECUPERA CAMI ZABALA"),
- quién **viene de otro horario** ("VIENE MARTIN", "VIENE VALE PEÑA"),
- notas libres debajo de la grilla, por ejemplo: *"9/2 bajó de presión Hedi en mitad de la clase"*.

> Ojo con los colores: en su Word el **rojo es "faltó avisando"**. En la app actual el rojo es "faltó sin avisar" y el ámbar es "avisó". Hay que confirmarlo con ella (ver PENDIENTES.md).

---

## 2. Lo que ella pide (núcleo — prioridad máxima)

1. **Tocar el nombre de un paciente → ver su historia clínica**, desde cualquier agenda.
2. **Historia clínica general** con:
   - Nombre completo, edad, teléfono, teléfono de contacto, dirección, profesión
   - Actividad física
   - Antecedentes clínicos ("patologías previas")
   - Estudios imagenológicos
   - Motivo de consulta
   - Evaluación inicial
   - Objetivo del tratamiento
3. **Registro clase a clase / notas de sesión**: si se le bajó la presión, si tuvo dolor, si avanzó en un ejercicio. Su frase textual: *"para no anotarlo así libre"*. **Este es el corazón del pedido.**
4. **TPA: registro rápido al terminar la clase**: tocar el horario → lista de alumnos → marcar presente / avisó / faltó / recupera / vino de otra clase → el calendario se pinta solo.
5. **RPG: calendario simple** con día, hora, paciente, estado de pago y sesión realizada/cancelada.
6. Ver de un vistazo **quién pagó**.

## 3. Sugerencias del otro chat (incluidas en su documento — prioridad secundaria)

- Alertas automáticas (3 faltas seguidas, episodio de presión previo, lesión reciente)
- Control de pagos con plan mensual y precio (ej: "TPA mensual – 1 vez por semana – $40.000"), ingresos del mes, pendientes
- Estadísticas: pacientes activos, faltas por mes, clases llenas, ingresos
- Búsqueda rápida de paciente en una barra superior
- Lista de espera con botón "Liberar cupo"
- Historial de asistencia dentro de la ficha (1/3 presente, 8/3 faltó sin avisar…)
- Vista mensual tipo calendario para ver clases llenas, huecos y cancelaciones
- Estructura en 4 módulos conectados: Agenda RPG, Agenda TPA, Historia clínica, Pagos

## 4. Pagos y calendario general (respuestas de Pau, octubre 2026)

Diseño en `docs/DISENO_PAGOS.md`.

### TPA: plan mensual
- Se paga un **plan mensual según la cantidad de veces por semana**.
- La cuota mensual cubre **4 clases por cada vez por semana** (1 vez = 4 clases, 2 veces = 8, 3 veces = 12).
- El plan tiene **descuento solo si se paga todo junto entre el 1 y el 10 del mes**. Si no, se cobra por **clase suelta**. Pau a veces hace excepciones: la app **sugiere, no bloquea**.
- Los **precios cambian mes a mes**:

| Mes | 1 vez por semana | 2 veces | 3 veces | Clase suelta |
|---|---|---|---|---|
| Septiembre 2026 | $46.000 | $74.000 | $100.000 | $16.000 |
| Octubre 2026 | $50.000 | $80.000 | $110.000 | $18.000 |

- Las **clases sueltas** de TPA (quien viene a una clase sin ser fijo y sin usar una recuperación: `asistencia_tpa` con tipo "suelta") se cobran aparte.
- ✅ (Facu, 13/11/2026) La cuota cubre **el mes entero**, también en los meses con 5 lunes.
- ✅ (Pau, 13/11/2026) **Después del 10 cobra el mismo precio del plan** (en la práctica no aplica el recargo de la línea de arriba). **Alta a mitad de mes: por clase** (clase suelta del mes × clases que le quedan desde su alta). Las **sueltas** se pagan cuando vienen o al comienzo del mes, nunca al final. Los precios de noviembre y diciembre los carga ella desde la app.

### RPG: por sesión
- Cada sesión se cobra **suelta**: **$46.000**, y todas valen lo mismo (RPG, masajes, evaluación inicial).
- Ya existe el estado de pago por sesión (`sesiones_rpg.estado_pago`).

### Su Word de pagos del mes
- Lista de alumnos **por plan** (1, 2 o 3 veces por semana).
- **Clases sueltas**: persona × cantidad.
- **Total por plan** y **total del mes**.
- Marca si pagó en **efectivo**.

### Calendario general del mes (lo primero que mira en TPA)
- Grilla **lunes / miércoles / viernes × horarios × 4 lugares** con los fijos.
- **Verde** = pagó el mes · **rosa** = todavía no pagó · **amarillo** = LIBRE.

## 5. Contexto de uso

- ✅ Confirmado (22/10/2026): la usa **sobre todo desde la compu**; el celular tiene que seguir andando bien (entre clases o al terminar cada una). _Antes decía "sobre todo desde el celular" (inferido)._
- Es la única usuaria. No hay recepcionista ni pacientes que entren a la app.
