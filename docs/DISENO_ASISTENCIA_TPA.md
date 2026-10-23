# Diseño: asistencia TPA, faltas, recuperaciones y notas

_Referencia para las entregas de la Fase 1 (asistencia). Sale del diagnóstico del 20/10/2026 con las decisiones de Facu del 21/10/2026 aplicadas. En los ejemplos se usan "Alumna A", "Alumno B", etc.: no son datos reales._

**Estado:** entregas 1 y 2 mergeadas (la migración de la 2 aplicada y verificada por Facu). Entrega 3 escrita (rama `fase-1/recuperaciones`, 23/10/2026): migración `20261023000001` lista para que Facu la aplique. Entrega 4 pendiente. Pau respondió las preguntas de recuperaciones el 21/10/2026 (reglas en la sección 3.2); los casos borde (10.2) los decidió Facu el 22/10/2026 con criterios que Pau puede corregir cuando lo vea en uso.

---

## 1. Decisiones tomadas (Facu, 21/10/2026)

1. **Sin `falta_id`.** No se vincula cada recuperación con una falta concreta: el saldo se calcula **contando** por alumno y por mes (sección 3.2). "Adelanta" no es un tipo propio: es una recuperación usada antes de faltar en ese mes. **Excepción (entrega 3):** el cambio de horario sí apunta a su aviso de origen (`asistencia_tpa.cambio_de`), porque se cargan juntos y un cambio que cruza el mes cuenta en el mes de la falta (10.2.5).
2. **Tipos de quien ocupa un lugar:** `fijo`, `recupera`, `cambio`, `suelta`. Se mantiene `ocupa_lugar_de`.
3. **Datos de prueba de asistencia:** se borran con el script de la sección 5 (no se convierten).
4. **Una sola migración** con los estados nuevos definitivos (sin etapa de expandir/contraer). Facu la aplica justo antes de probar el preview y mergea el mismo día.
5. **Vitest** como dependencia de desarrollo, solo para funciones puras (`armarSemanaTPA`, cálculo de recuperaciones, alerta de 2 faltas).
6. **Función transaccional `guardar_clase_tpa`:** sí (`security invoker`, `execute` solo para `authenticated`, revocado a `public` y `anon`).
7. **`fecha_alta` en `horarios_tpa`:** sí, en la entrega 2 (dentro de la migración única).
8. **Orden:** primero las faltas. Cuatro entregas (sección 8).
9. **Criterios por defecto** (Pau los puede cambiar):
   - colores como están hoy (ámbar = avisó, rojo = no avisó);
   - lugar lleno → **avisar, no bloquear**;
   - 2 faltas seguidas sin aviso → en **cualquier horario** del alumno; las clases **sin marcar no cortan** la racha;
   - las clases sueltas se anotan como quien ocupa un lugar (`tipo = 'suelta'`).
10. **Reglas de recuperación confirmadas por Pau (21/10/2026):** prioridad, tope, vencimiento, feriados y clases canceladas por ella. Ver sección 3.2. La clase cancelada guarda **un motivo fijo** (`feriado` o `cancelada_por_pau`) porque cada uno tiene reglas distintas (sección 4, paso 5).
11. **Casos borde (Facu, 22/10/2026; no se le preguntan a Pau, ella los puede corregir al verlos en uso).** Detalle en 10.2:
    - **Feriado:** el mínimo de 4 clases se cuenta **en total** (4 × veces por semana), no por horario.
    - **Qué crédito se usa primero:** cada uso consume primero el que **vence antes** (los avisados vencen a fin de mes; los de clases canceladas por Pau no vencen). La prioridad de Pau sigue valiendo para **a quién se le ofrece primero un lugar**, no para qué crédito se gasta.
    - **Adelantó y no faltó en el mes:** la app lo muestra y decide Pau.
    - **Corte de luz, paro, etc.:** `cancelada_por_pau`. Sin opción "Otro".
    - **Cambio de horario que cruza el mes:** consume el crédito **del mes de la falta**, con aviso en la app.
    - **Alta a mitad de mes:** por feriado recupera como máximo los feriados que le tocaron.
    - **Cada pendiente de recuperar muestra su origen** ("cancelé el mié 7", "avisó con tiempo el lun 12").
12. **Pau usa la app sobre todo desde la compu** (Facu, 22/10/2026): se diseña primero para la compu; el celular tiene que seguir funcionando bien.

---

## 2. Modelo de datos

### 2.1 Cómo se guarda cada concepto de Pau

| Concepto de Pau | Cómo se guarda |
|---|---|
| Fijo | `horarios_tpa` (+ `fecha_alta` editable, entrega 2) |
| Presente / Avisó C.T. / Avisó S.T. / No avisó (de un fijo) | `asistencia_tpa.estado` con `tipo = 'fijo'`: `presente`, `aviso_con_tiempo`, `aviso_sin_tiempo`, `falto_sin_avisar` |
| Sin marcar | **sin fila** (como hoy) |
| Cuándo llegó el aviso | `asistencia_tpa.avisado_at` (lo completa la app al marcar el aviso) |
| Clase cancelada | `clases_tpa.motivo_cancelacion` (**de la clase**, no de cada alumno): `feriado` o `cancelada_por_pau` (enfermedad, viaje). `NULL` = la clase se da |
| Quien viene a ocupar un lugar | fila de `asistencia_tpa` con `tipo` ≠ `fijo` |
| "Recupera" | `tipo = 'recupera'` |
| "Viene a las 18" (cambio puntual de horario) | `tipo = 'cambio'` en el destino, con `cambio_de` = la fila del aviso del fijo en el origen (la app marca las dos cosas juntas, en una transacción) |
| "Adelanta" | **no es un tipo**: es un `recupera` usado antes de faltar en el mes (se ve en el saldo como "adelantó 1") |
| Clase suelta ($18.000) | `tipo = 'suelta'` (no consume recuperaciones; sirve para Pagos en la fase 2) |
| "FIJO falta / QUIEN RECUPERA" en la misma celda | `asistencia_tpa.ocupa_lugar_de` = fila del fijo que falta. Vacío = ocupa un lugar libre (horario con menos de 4 fijos) |
| Estado de quien viene a ocupar | `pendiente` (todavía no vino) → `presente` / `falto_sin_avisar` |
| Nota de evolución | `notas_evolucion` (tabla nueva, entrega 4) |

### 2.2 Estados definitivos

| `tipo` | Estados permitidos |
|---|---|
| `fijo` | `presente`, `aviso_con_tiempo`, `aviso_sin_tiempo`, `falto_sin_avisar` (sin marcar = sin fila; nunca `pendiente`) |
| `recupera`, `cambio`, `suelta` | `pendiente`, `presente`, `falto_sin_avisar` |

Desaparecen: `aviso_ausencia`, `recupera` y `vino_otra_clase` (como estados) y `cancelado` (pasa a la clase).

---

## 3. Reglas de cálculo (funciones puras, con tests de Vitest)

### 3.1 Contador del horario (entrega 2)

`ocupados = fijos que no avisaron falta + personas que vienen a ocupar` (en cualquier estado).

- 4 fijos, 1 avisó, nadie en su lugar → **3/4 · 1 libre**.
- 4 fijos, 1 avisó y alguien recupera → **4/4**.
- "No avisó" cuenta como ocupado: el lugar estaba reservado y nadie más pudo usarlo.
- Una clase cancelada no tiene lugares.
- Más personas que lugares → se muestra "5/4" y un aviso; **no se bloquea**.

Lo calcula `contarLugares()` (`src/lib/tpa.ts`, con tests), llamado desde `armarSemanaTPA()` (que sigue siendo la única fuente de quién está en cada horario) y desde el modal con las marcas sin guardar. Un estado desconocido de un fijo cuenta como ocupado. `textoLugares()` arma "3/4 · 1 libre", "4/4" o "5/4 · 1 de más".

### 3.2 Saldo de recuperaciones (entrega 3): se calcula, no se guarda

#### Reglas de Pau (21/10/2026)

| Origen de la recuperación | ¿Genera? | ¿Cuenta en el tope? | ¿Vence? |
|---|---|---|---|
| 1. Clase **cancelada por Pau** (enfermedad, viaje) | Siempre: una para cada fijo de ese horario en esa fecha | No | **Nunca**: si no la usa, pasa al mes siguiente |
| 2. **Avisó con tiempo** (C.T.) | Sí | Sí | A fin de mes |
| 3. **Avisó sin tiempo** (S.T.) | Sí | Sí | A fin de mes |
| 4. **Feriado** | Solo si por los feriados le quedan **menos de 4 clases en el mes por cada vez por semana** | No | A fin de mes |
| **No avisó** | No | — | — |

- **Prioridad** (en este orden): 1) canceladas por Pau, 2) C.T., 3) S.T., 4) feriado, solo si hay lugar. Ordena **a quién se le ofrece primero un lugar**: el selector "Ocupar lugar" (7.3) y la pestaña Recuperaciones (7.4). **No** decide qué crédito consume cada uso: eso lo decide el vencimiento (paso 4 de abajo, decisión del 22/10/2026).
- **Tope:** 1 recuperación por mes por cada vez por semana (1, 2 o 3). Aplica a C.T. y S.T. **El cambio de horario y el adelanto cuentan como recuperación** (consumen tope).
- **Anotado para recuperar y no viene:** pierde esa recuperación (cuenta como usada).
- **24 h:** la app solo **sugiere** con tiempo / sin tiempo (3.4); nunca bloquea. Pau hace excepciones.

#### Cálculo

Función pura `calcularRecuperaciones(mes, datos, hoy)` en `src/lib/recuperaciones.ts`, con tests (todos los casos de abajo). Recorre los meses desde la primera clase cancelada por Pau hasta M, porque esas recuperaciones pasan de mes en mes. Los datos (`cargarDatosRecuperaciones` en `queries.ts`) son todos los horarios, las clases canceladas y, de todo el historial, solo las filas que cuentan (avisos, "No avisó" y quienes ocupan un lugar), leídas de a 1000. Por alumno y por mes M:

1. **Frecuencia** `f` = cantidad de horarios fijos que tiene (1, 2 o 3). _Supuesto:_ los vigentes el último día del mes, o hoy si el mes está en curso (el primer día si es futuro); si ese día no tenía ninguno (se dio de baja en el mes), el máximo que tuvo en el mes. En la fase 2 puede salir del plan pagado.
2. **Recuperaciones a favor (créditos):**
   - **Por cancelación de Pau:** una por cada clase con `motivo_cancelacion = 'cancelada_por_pau'` en una fecha en que era fijo de ese horario (`eraFijoEn`, con `fecha_alta`/`fecha_baja`). Se suman las de **meses anteriores** que no usó (arrastre). Si había avisado antes de que Pau cancelara, cuenta como cancelada por Pau, no como aviso.
   - **Por aviso:** sus filas `tipo = 'fijo'` con `aviso_con_tiempo` o `aviso_sin_tiempo` en clases **no canceladas** de M. Orden: primero las C.T., después las S.T.; dentro de cada grupo, la más vieja primero. Tienen derecho **las primeras `f`**; el resto figura como "sin derecho (llegó al tope)".
   - **Por feriado:** `clases del mes` = fechas de M en las que era fijo de alguno de sus horarios (desde su `fecha_alta`); `feriados` = cuántas de esas clases se cancelaron con `motivo_cancelacion = 'feriado'`; `dadas = clases del mes − feriados` (las canceladas por Pau cuentan como dadas: ya generan su propia recuperación). Créditos por feriado = `min(feriados, max(0, 4 × f − dadas))`, **en total** (no por horario, decisión 10.2.1). El `min(feriados, …)` hace que un alta a mitad de mes recupere como máximo los feriados que le tocaron (10.2.6).
3. **Usos en M:** sus filas con `tipo = 'recupera'` o `'cambio'` en clases no canceladas de M, **en cualquier estado** (`pendiente`, `presente` o `falto_sin_avisar`: si no viene, la pierde). Si avisa antes que no va a la recuperación, Pau lo saca con "Quitar de esta clase" y no cuenta. Las `suelta` no cuentan. **Excepción:** un `cambio` cuyo aviso de origen (el del fijo, el mismo día que la app los marcó juntos) es de otro mes cuenta en el **mes de la falta** y la app lo avisa (10.2.5).
4. **Asignación (decisión del 22/10/2026):** cada uso consume primero el crédito que **vence antes**: los que vencen a fin de mes (C.T., S.T. y feriado, en ese orden entre sí y el más viejo primero) y, si no hay, los de clases canceladas por Pau (el más viejo primero, incluido el arrastre), que no vencen. Así no se pierde un crédito que vencía mientras queda uno que no vence.
5. **Resultado:**
   - **Pendientes**, separadas por origen (Pau / C.T. / S.T. / feriado).
   - **Tope usado** = usos que consumieron un aviso + usos sin crédito. Si pasa de `f` → aviso "ya usó 2 de 2 recuperaciones de octubre" (no bloquea).
   - **Adelantó** = usos sin crédito (recuperó antes de faltar). Si falta más tarde en el mes, ese aviso lo cubre. Si termina el mes sin faltar: la app lo muestra ("adelantó 1 y no faltó en octubre") y decide Pau (10.2.3).
   - **Origen de cada pendiente**, siempre a la vista: "cancelé el mié 7", "avisó con tiempo el lun 12", "feriado del lun 12".
   - **Al cerrar el mes:** las pendientes C.T., S.T. y feriado se **pierden**; las de Pau **pasan** al mes siguiente.
6. **Clase cancelada con filas ya cargadas:** se ignoran. Los avisos de los fijos no generan crédito (lo genera la cancelación) y quien venía a ocupar un lugar no gasta su recuperación.

Nada se bloquea: si Pau hace una excepción ("ya usó 2 de 2", "es de otro mes"), la app avisa y la deja seguir.

#### Casos para los tests

| Caso | Resultado esperado |
|---|---|
| `f = 2`. Octubre: C.T. lun 5, S.T. mié 14, C.T. lun 19. Usa 1 | Derecho: C.T. 5 y C.T. 19 (S.T. 14 sin derecho, tope). El uso consume C.T. 5 → pendiente C.T. 19 |
| `f = 1`, fijo los miércoles. Pau cancela mié 7; C.T. mié 14; usa 1 | El uso consume la C.T. 14 (vence antes) → pendiente "cancelé el mié 7", no vence |
| `f = 1`. Pau cancela en octubre y no la usa | En noviembre figura "1 de Pau (de octubre)" |
| `f = 1`, fijo los lunes. Noviembre 2026 tiene 5 lunes y 1 es feriado | Dadas 4 ≥ 4 → no recupera |
| `f = 1`, fijo los lunes. Un mes con 4 lunes y 1 feriado | Dadas 3 → 1 recuperación por feriado (última en prioridad) |
| Anotado para recuperar, queda en "No vino" | Cuenta como usada |
| Cambio de horario: C.T. en el origen + `cambio` en el destino, mismo mes | Crédito C.T. consumido por el cambio; usa 1 del tope |
| `f = 1`, sin faltas, recupera (adelanta) el 6 y avisa C.T. el 20 | Al final del mes: 0 pendientes, 0 adelantos, tope 1 de 1 |
| `f = 1`, recupera (adelanta) el 6 y no falta en el mes | Al final del mes: "adelantó 1 y no faltó"; lo decide Pau |
| `f = 2`, fijo lunes y viernes. 5 lunes sin feriado, 4 viernes con 1 feriado | En total: 5 + 3 = 8 = 4 × 2 → no recupera por feriado |
| `f = 1`, alta el 15, le toca 1 feriado en lo que queda del mes | Como máximo 1 por feriado |
| Avisa C.T. vie 30/10 y viene a cambio de horario lun 2/11 | El cambio consume la C.T. de octubre, con aviso "es de otro mes" |
| Avisa sin tiempo y no vino nadie a su lugar | Igual tiene derecho (el tope aplica a S.T. igual que a C.T.) |
| No avisó | Sin crédito |

### 3.3 Alerta de 2 faltas seguidas sin aviso (entrega 4)

Función pura en `src/lib/alertas.ts`. Con las asistencias del alumno **como fijo**, en **cualquiera de sus horarios**, ordenadas por fecha y hora:

- se ignoran las clases canceladas y las **sin marcar** (no cortan la racha);
- si las dos últimas marcadas son `falto_sin_avisar` → alerta en la grilla, en el modal y en la ficha;
- el lugar no se libera solo (Pau dijo que no).

### 3.4 Con tiempo / sin tiempo (entrega 2)

- Sugerencia **visible** y que se cambia con un toque: "Faltan 49 h para la clase → con tiempo". Implementado en `src/lib/avisos.ts` (`sugerirAviso`, `esClaseFutura`, `avisadoAtAlGuardar`, con tests). Texto en minutos (< 1 h), horas (< 72 h) o días.
- Con tiempo = el aviso se carga **24 h o más** antes del inicio de la clase. Es solo la sugerencia: Pau confirmó (21/10/2026) que la app **nunca bloquea** y que ella hace excepciones.
- En una clase que ya pasó, la app **no sugiere** (no sabe cuándo llegó el aviso): Pau elige.
- Se guarda `avisado_at` igual.
- Zona horaria: las clases son de Argentina (UTC−3) y la base está en UTC. El inicio de la clase se calcula con el desfase fijo `-03:00` (Argentina no tiene horario de verano desde 2009), así la sugerencia da igual aunque el dispositivo esté en otra zona. En SQL, siempre con `America/Argentina/Buenos_Aires`.
- Clase futura = **todavía no empezó** (hora de inicio). Desde que empieza se puede marcar Presente y No avisó.
- `avisado_at`: un aviso nuevo toma el momento en que se carga; pasar de C.T. a S.T. conserva el del primer aviso; los demás estados lo dejan en `null` (la base lo exige).

---

## 4. Migración única (entrega 2) — escrita el 22/10/2026

Archivo: **`supabase/migrations/20261022000001_tpa_faltas_y_lugares.sql`** (con rollback comentado al final). **Antes**: correr el script de la sección 5. Probada en un Postgres 14 local descartable con una copia del esquema real (leído con el MCP el 22/10/2026): aborta si hay estados viejos, aplica, 20 casos de checks y trigger dan lo esperado, el rollback vuelve al esquema anterior y se puede reaplicar.

Qué hace:
1. Guardas: aborta si quedan estados viejos o columnas vacías que pasan a obligatorias.
2. Estados definitivos (check) y sin default en `estado`.
3. `not null` en `asistencia_tpa` (`clase_id`, `paciente_id`, `estado`, `created_at`), `horarios_tpa` (`paciente_id`, `dia_semana`, `activo`, `created_at`) y `clases_tpa.created_at`.
4. `tipo`, `ocupa_lugar_de` (FK a la misma tabla, `on delete set null`, unique), `avisado_at`, `updated_at` (+ trigger `update_updated_at`), checks de estado según tipo, "solo los no fijos ocupan un lugar" y **`avisado_at` obligatorio en los avisos y solo en ellos**. Índice por `paciente_id`.
5. Trigger `validar_asistencia_tpa` (`set search_path = ''`, `execute` revocado a `public`, `anon` y `authenticated`): `ocupa_lugar_de` tiene que ser un **fijo de la misma clase que avisó** (C.T. o S.T.), y ese fijo no puede pasar a otro estado ni cambiar de clase mientras alguien ocupa su lugar. Mensajes sin datos de pacientes.
6. `clases_tpa.motivo_cancelacion` con check (`feriado`, `cancelada_por_pau`).
7. `horarios_tpa.fecha_alta` (desde `created_at` en hora argentina, `not null`, default hoy en Argentina) y check `fecha_baja >= fecha_alta`.

Diferencias con el borrador anterior:
- El trigger exige que el fijo **haya avisado** (antes, solo que fuera fijo de la misma clase): si no, el contador contaría dos personas en el mismo lugar.
- Check nuevo de `avisado_at` y `fecha_baja >= fecha_alta` (desinscribir un alta futura deja `fecha_baja = fecha_alta`: nunca fue fijo).
- `not null` también en `horarios_tpa` y en los `created_at`.

Notas:
- El trigger es una red de seguridad: la app ya valida lo mismo.
- "Clase cancelada" en el código = `motivo_cancelacion is not null`. Si más adelante Pau quiere anotar el detalle ("viaje"), se agrega una columna de texto libre aparte, sin tocar el motivo.
- Borrar la fila del fijo (vuelve a "Sin marcar" o se borra el paciente) deja a quien ocupaba su lugar en un lugar libre (`on delete set null`).
- `notas_evolucion` (entrega 4) y `guardar_clase_tpa` (entrega 3) van en migraciones propias: no cambian estados.

---

## 5. Script de borrado de la asistencia de prueba (no es una migración)

Archivo: **`supabase/scripts/20261022_borrar_asistencia_prueba.sql`** (fuera de `migrations/` para que `supabase db push` nunca lo corra). Lo corre Facu en el SQL Editor **inmediatamente antes** de la migración única. Borra todas las clases TPA (y sus asistencias, por cascada); no toca pacientes, horarios fijos, turnos ni pagos.

Protección (si algo no coincide, no borra nada):
- aborta si la migración de la entrega 2 ya está aplicada (desde ahí las asistencias pueden ser reales);
- aborta si hay más de **10 asistencias o 5 clases** (contadas con el MCP el 22/10/2026; si se cargaron más pruebas, actualizar los números con el `select` que trae el archivo);
- aborta si hay clases fuera del 12/10 al 26/10/2026 o filas creadas desde el 24/10/2026.

Los horarios de prueba del lunes 08:00 (fuera de los horarios reales) se desinscriben desde la app.

---

## 6. Otras piezas de base de datos

### 6.1 `guardar_clase_tpa` y `cambiar_cancelacion_tpa` (entrega 3) — escritas el 23/10/2026

Migración **`supabase/migrations/20261023000001_tpa_guardar_clase.sql`** (con rollback). Probada en un Postgres 14 local descartable con el esquema de la entrega 2: 19 casos + el formato exacto que manda la app, rollback y reaplicación.

- **`asistencia_tpa.cambio_de`** (FK a la misma tabla, `on delete set null`, unique, solo en `tipo = 'cambio'`). El trigger `validar_asistencia_tpa` (reemplazado) exige que apunte a un aviso del mismo alumno en otra clase, y no deja cambiarle el estado a ese aviso mientras el cambio exista (igual que con `ocupa_lugar_de`).
- **`guardar_clase_tpa(p_clases jsonb)`**: una o **varias** clases (el cambio de horario toca el origen y el destino) en una transacción. Cada cambio va por `paciente_id` (no por id de fila: así es reintentable y resuelve filas nuevas): `tipo`, `estado` (null = sin marcar / quitar), `avisado_at`, `ocupa_lugar_de_paciente` y `cambio_de: {fecha, hora}` (si la clave no está, se conserva). Orden fijo, sin importar cómo llega: crea y bloquea las clases (solo si se marca a alguien; una clase cancelada no admite cambios) → quita a quienes ocupaban y suelta los enlaces que cambian → fijos (avisos/estados, después "sin marcar") → quienes ocupan un lugar → borra las clases vacías salvo canceladas. Verifica `soy_autorizada()` (si no, con RLS todo afectaría 0 filas sin error).
- **`cambiar_cancelacion_tpa(p_fecha, p_horas, p_motivo)`**: cancela (motivo) o reactiva (null) una clase o un día entero en una sentencia; crea las clases que falten; no toca asistencias; al reactivar borra las que quedan vacías.
- Ambas `security invoker`, `set search_path = ''`, `execute` revocado a `public` y `anon`, concedido a `authenticated`. Sus mensajes (y los del trigger) empiezan con `"TPA: "`, no traen datos de pacientes y la app los muestra tal cual.
- Pendiente para la entrega 4: no borrar la clase vacía si tiene notas (la tabla todavía no existe).

### 6.2 `notas_evolucion` (entrega 4)

Tabla propia, **no** `asistencia_tpa.nota`: "Sin marcar" borra la fila de asistencia (y la clase si queda vacía) y la nota se perdería.

```sql
create table public.notas_evolucion (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references public.pacientes (id) on delete cascade,
  fecha        date not null,
  texto        text not null constraint notas_evolucion_texto_no_vacio check (btrim(texto) <> ''),
  clase_tpa_id uuid references public.clases_tpa (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- + unique (paciente_id, clase_tpa_id) where clase_tpa_id is not null (una nota por alumno por clase)
-- + índice (paciente_id, fecha desc), trigger updated_at
-- + RLS igual al resto: política "Solo usuaria autorizada" para authenticated; revoke a public y anon
-- + drop de asistencia_tpa.nota (con guarda: aborta si tiene texto)
```

- `clase_tpa_id` NULL = nota libre, cargada desde la historia clínica.
- `paciente_id on delete cascade` igual que el resto hoy; pasa a `restrict` junto con las demás antes de la carga real.
- Sin `sesion_rpg_id`: RPG no se toca y su nota sigue en `sesiones_rpg.nota`. La historia clínica muestra las dos fuentes juntas.

### 6.3 Para no complicar la fase 2 (pagos y calendario general)

- **Calendario general** (L/M/V × horarios × 4 lugares): sale de `horarios_tpa` más `CUPO_TPA`. Es la misma noción de "lugar" que la grilla semanal. El amarillo "LIBRE" de Pau es el mismo marcador "Libre".
- **Frecuencia** = cantidad de horarios fijos: la usan el tope de recuperaciones y, en la fase 2, el plan (1, 2 o 3 veces por semana).
- **Clase suelta** (`tipo = 'suelta'`) queda registrada para cobrarla.
- **Precios que cambian por mes y descuento del 1 al 10:** tabla `precios` en la fase 2. Nada de esto lo impide.

---

## 7. Cómo cambian las pantallas (compu primero)

### 7.1 Grilla TPA (compu) y lista (celular)

Cada card muestra **siempre los 4 lugares**:

```
10:30                         4/4
 ✓ Alumna A          Presente
 ⚠ Alumno B          Avisó C.T.    ← sigue en SU lugar, color de falta
   ↳ Alumna C        Recupera      ← en el lugar de B (azul)
 ✓ Alumno D          Presente
 ┄ Libre ┄┄┄┄┄┄┄┄┄┄┄ + Ocupar      ← lugar sin fijo o falta sin reemplazo
 [ Abrir clase ]
```

- Etiquetas cortas con las palabras de su Word: **Avisó C.T.**, **Avisó S.T.**, **No avisó**.
- Cambio de horario: en el origen "Avisó C.T. · viene Lun 18:00"; en el destino "Cambio de horario".
- **"+ Ocupar"** en un lugar libre abre el selector (7.3).
- Ícono de alerta junto al nombre si tiene 2 faltas seguidas sin avisar; ícono de nota si tiene nota en esa clase.
- Clase cancelada: card gris con "Cancelada · Feriado" o "Cancelada por Pau".
- Semanas futuras: se ven los avisos anticipados y los lugares libres.
- Arriba de la grilla: chip "7 pendientes de recuperar" que lleva a la pestaña Recuperaciones.
- En el celular: lo mismo, con el selector de día + cards.

### 7.2 Modal de la clase (compu: modal ancho; celular: pantalla completa)

Encabezado: "Lunes 26 de octubre · 10:30 · 3/4 · 1 libre". Una fila por lugar.

- **Fila de un fijo:** chips **Presente · Avisó · No avisó · Sin marcar**.
  - Al tocar **Avisó** aparece "Con tiempo / Sin tiempo" con la sugerencia y su motivo (3.4).
  - **En clases futuras**, "Presente" y "No avisó" deshabilitados: solo se cargan avisos.
  - Debajo del fijo que avisó: **"Ocupar su lugar"**.
  - **"+ Nota"**: textarea que se despliega; se guarda con el resto (entrega 4).
- **Fila de quien viene a ocupar:** nombre + qué es ("Recupera", "Cambio de horario", "Clase suelta") + chips **Presente · No vino · Sin marcar** + "Quitar de esta clase".
- **"Marcar el resto como presente"** (entrega 4): solo si la clase ya empezó; marca a los "Sin marcar" y no toca avisos ni "No avisó". Cambio local, se ve antes de guardar.
- **Avisos que no bloquean:** "2 faltas seguidas sin avisar"; "5/4: hay más personas que lugares"; "ya usó 2 de 2 recuperaciones de octubre".
- **Pie:** "Cancelar clase" a la izquierda; Cancelar y Guardar a la derecha. "Cancelar clase" pide el motivo con dos opciones y su consecuencia a la vista: **Feriado** ("recuperan solo si les quedan menos de 4 clases en el mes") / **Cancelada por mí** ("todos los fijos la recuperan, aunque sea el mes que viene"). Sin "Otro" (decisión 10.2.4).
- Para feriados, acción **"Cancelar el día"** (desde el encabezado del día): cancela con motivo Feriado todas las clases de esa fecha de una vez (crea las filas de `clases_tpa` que falten).
- La pestaña "Alumnos fijos" queda igual (+ fecha de alta en la entrega 2).

### 7.3 Selector "Ocupar lugar" (entrega 3, `TpaOcuparSelector` + `opcionesParaOcupar` en `src/lib/ocupar.ts`)

En este orden, cada persona con su motivo:

1. Pendientes por **clase cancelada por Pau** (incluye las de meses anteriores: "cancelé mié 30/9").
2. Pendientes con aviso **con tiempo** ("faltó lun 12/10 · usó 1 de 2").
3. Pendientes con aviso **sin tiempo**.
4. Pendientes por **feriado** ("si hay lugar").
5. **Adelantar:** fijos de otros horarios a los que les queda tope este mes.
6. **Cambio de horario esta semana:** fijos de otros horarios de esta misma semana (consume tope).
7. **Buscar otro paciente** (clase suelta).

Quien no avisó no aparece en 1–4. Si elegir a alguien lo pasa del tope, la app lo avisa y deja seguir.

Al elegir, el tipo se completa solo y se puede cambiar.

Cómo quedó (23/10/2026):
- Cada persona aparece **una vez** en 1–4, en el grupo de su recuperación de más prioridad ("cancelé el lun 5 (y 1 más)"); al guardar, el uso consume lo que vence antes (10.2.2).
- **Adelantar** = fijos (vigentes en la fecha de la clase) sin pendientes y con tope libre.
- **Cambio de horario** = fijos de otra clase **de 6 días antes a 6 días después** (no solo "esta semana": así entra el vie 30/10 → lun 2/11) que todavía no vinieron ni tienen ya un cambio. Si no había avisado, se elige ahí mismo C.T. o S.T. para su horario (con la sugerencia si esa clase todavía no empezó). "El aviso es de octubre: cuenta en octubre" si cruza el mes.
- **Otro paciente** = cualquier paciente activo, como clase suelta. El tipo (Recupera / Clase suelta) se puede cambiar en la fila mientras no esté guardado.
- El lugar: el del fijo elegido ("Ocupar su lugar") o, desde "+ Ocupar", el de un fijo que avisó y que nadie ocupa; si no hay, un lugar libre.
- Fijo con el lugar ocupado al que se le cambia el estado: la app pregunta "Sacarlo de la clase" / "Dejarlo en un lugar libre" (el trigger no deja hacerlo directo). Lo mismo con el origen de un cambio ("Quitar el cambio").

### 7.4 Pestaña "Recuperaciones" (dentro de TPA, entrega 3, `TpaRecuperaciones`)

TPA tiene dos pestañas: **Semana** | **Recuperaciones**. Por mes:

- **Pendientes de recuperar**, en cuatro grupos en el orden de prioridad (canceladas por Pau / con tiempo / sin tiempo / feriado): alumno, origen (fecha y horario), "usó 1 de 2" y **"Buscar lugar"** (lugares libres de esta semana y la siguiente; dentro del mes, salvo las de Pau, que pueden ser del mes siguiente). Las que vencen a fin de mes muestran "vence el 31/10".
- **Adelantos** (usó más de lo que faltó).
- **Sin derecho a recuperar** (no avisó, llegó al tope, o venció a fin de mes), solo informativo.
- **"Copiar lista"** en texto para WhatsApp (reemplaza la lista de los viernes). Si el portapapeles no está disponible (http desde la red local), muestra el texto seleccionable.
- Chip "N pendientes de recuperar" arriba de la grilla, que lleva a esta pestaña.
- "Buscar lugar" no se ofrece en meses que ya cerraron (lo que vencía se perdió y lo de Pau aparece en el mes actual).
- En el celular: cards en lugar de tabla.

### 7.5 Historia clínica

- **Ficha:** **Evaluación inicial** visible (✅ entrega 1).
- **Pestaña "Evolución"** (entrega 4, reemplaza a "Historial"): alerta de 2 faltas; resumen del mes ("Octubre: 3 faltas avisadas, 1 recuperada, le queda 1"); una línea de tiempo con notas de clase, notas libres, notas de RPG (`sesiones_rpg.nota`, sin tocar RPG) y asistencias TPA; botón **"+ Nota"**.
- **Alertas por palabra clave:** se sacan en la entrega 4 (dicen "recientes" pero buscan en todo el historial, y dependen de `asistencia_tpa.nota`, que se borra).

### 7.6 Paso a paso, desde el punto de vista de Pau

1. **Lunes 9 h, la Alumna A avisa que el miércoles no va.** TPA → Mié 10:30 → Abrir clase → en A, **Avisó** → la app propone "Con tiempo · faltan 49 h" → Guardar. En la grilla: A con "Avisó C.T." y un lugar **Libre**; 3/4.
2. **Ocupar ese lugar.** **+ Ocupar** → arriba figura el Alumno B (con tiempo, le queda 1) → Guardar → "A · Avisó C.T. / ↳ B · Recupera", 4/4.
3. **Al terminar la clase.** Abrir clase → **Marcar el resto como presente** → corrige a D a **No avisó** → en C, **+ Nota** → Guardar. Si era la segunda falta seguida de D, aparece el aviso.
4. **Viernes.** TPA → **Recuperaciones** → **Copiar lista** → WhatsApp.
5. **Feriado.** En el día → **Cancelar el día** → "Feriado". Cards grises. Solo recupera quien queda con menos de 4 clases en el mes.
6. **Pau se enferma el miércoles.** Abrir clase → **Cancelar clase** → "Cancelada por mí". Todos los fijos de esa clase aparecen primeros en Recuperaciones, aunque no la usen hasta el mes siguiente.
7. **Ficha.** Nombre → **Evolución**: alerta, saldo del mes, notas y asistencias en orden.

---

## 8. Plan: 4 entregas

Al final de cada una: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` y una lista de pruebas en compu y en 390px.

| Entrega | Rama | Qué | Base de datos |
|---|---|---|---|
| **1** ✅ | `fase-1/asistencia` | Evaluación inicial en la ficha. Guardados que no duplican (id generado al abrir el formulario en pacientes y turnos; `createClaseTPA` como upsert; inscripción reintentable). Timeout 15 s lecturas / 45 s escrituras con mensaje "no sabemos si se guardó". `estados.ts` tolerante a estados desconocidos. Sin el fallback de `fecha_baja`. Vitest + tests de `armarSemanaTPA`. | ninguna |
| **2** (escrita) | `fase-1/faltas-y-lugares` | Estados nuevos (Avisó C.T. / S.T. / No avisó), contador de lugares y "Libre", avisos anticipados con sugerencia C.T./S.T., sin "Presente" ni "No avisó" a futuro, `fecha_alta` editable al inscribir. `eliminarClaseTPASiVacia` protegida (cancelada / quien ocupa). `npm audit fix`. | Script de borrado + **migración única** (sección 4) |
| **3** (escrita) | `fase-1/recuperaciones` | Ocupar lugar con sugerencias (recupera / cambio / suelta), `guardar_clase_tpa`, `calcularRecuperaciones` + tests, pestaña Recuperaciones, "Buscar lugar", "Copiar lista". **Cancelar clase y "Cancelar el día"** (con "Reactivar"). Casos borde ya decididos (10.2). Compu primero en CLAUDE.md y DESIGN.md. | migración `20261023000001` (6.1) |
| **4** | (a definir) | "Marcar el resto como presente", notas de evolución (modal, pestaña Evolución, nota libre), alerta de 2 faltas + tests, sacar las alertas por palabra clave. | migración de `notas_evolucion` |

**Orden de aplicación de la entrega 2:** la entrega 1 tiene que estar **en producción** antes (para que la app de producción no se rompa al leer un estado nuevo). El día de la prueba: script de borrado → migración única → probar el preview → mergear. Entre la migración y el merge, producción puede guardar "Presente" y "Faltó" e inscribir fijos (con fecha de alta = hoy), pero **no** "Avisó", "Recupera", "De otro horario" ni "Cancelado" (el check lo rechaza y muestra "No se pudo guardar la asistencia"); los avisos que cargue el preview se ven en producción en gris ("Aviso con tiempo") y producción no los puede cambiar a "Presente" (el check de `avisado_at` lo rechaza). Conviene que Pau no cargue asistencia en ese rato. El preview **antes** de la migración muestra los fijos sin respetar la fecha de alta y no puede guardar (pide columnas que todavía no existen): no usarlo hasta aplicarla.

---

## 9. Riesgos y supuestos (por importancia)

1. 🟠 **Política de recuperaciones.** Las reglas principales están confirmadas por Pau (3.2); quedan casos borde (10.2). Si una regla está mal, el saldo está mal y Pau deja de confiar. Mitigación: tests con los casos de 3.2, cada pendiente muestra su origen ("cancelé mié 7", "avisó lun 12"), nada se bloquea.
1. 🟠 **Cancelaciones olvidadas.** Si Pau no marca un feriado o una cancelación suya, nadie recibe la recuperación que corresponde. Mitigación: "Cancelar el día" en un toque; las de Pau se pueden marcar después (el arrastre no vence).
2. 🔴 **Ventana entre la migración única y el merge.** Preview y producción comparten la base. Mitigación: entrega 1 en producción antes; migración y merge el mismo día.
3. 🟠 **"Con tiempo" mal sugerido** si Pau carga el aviso tarde. Mitigación: sugerencia visible, un toque para cambiarla, sin sugerencia en clases pasadas.
4. 🟠 **Zona horaria.** Base en UTC, clases en hora de Argentina. Se supone el dispositivo de Pau en hora argentina. El SQL usa `America/Argentina/Buenos_Aires`.
5. 🟠 **`eliminarClaseTPASiVacia`** borraría clases canceladas, con notas o con quien viene a ocupar si no se ajusta (entrega 2 y 4).
6. 🟡 **Guardado a medias** (varias peticiones en paralelo) se agrava con quien viene a ocupar. Mitigación: `guardar_clase_tpa` (entrega 3).
7. 🟡 **Frecuencia = cantidad de horarios fijos.** Si alguien paga un plan distinto de lo que tiene inscripto, el tope no coincide. Se alinea en la fase 2.
8. 🟡 **Desinscribir con avisos futuros** deja filas de fijo en fechas posteriores a la baja. Mitigación: avisar al desinscribir y ofrecer borrarlas.
9. 🟡 **Rendimiento:** el saldo lee de todo el historial las filas que cuentan (avisos, no avisó, quienes ocupan; no las "Presente" de los fijos), de a 1000, cada vez que se abre TPA. Son cientos por año: alcanza por varios años. Si crece, calcularlo en la base o limitar el arrastre de las de Pau.
10. 🟡 **Tope en el selector para un cambio que cruza el mes:** el aviso de tope usa el saldo del mes de la clase de destino, no el del mes de la falta.

---

## 10. Preguntas a Pau

### 10.1 Respondidas (21/10/2026)

1. ✅ Clase que cancela **ella**: depende del motivo. **Cancelada por Pau** (enfermedad, viaje): se recupera siempre, no cuenta en el tope y puede pasar al mes siguiente. **Feriado**: no cuenta en el tope y solo se recupera si por el feriado queda con menos de 4 clases en el mes por cada vez por semana, dentro del mes.
2. ✅ **Cambio de horario** y **adelanto**: sí, cuentan como recuperación.
3. ✅ **Fin de mes**: se recupera dentro del mes; si no, se pierde (salvo las canceladas por Pau).
4. ✅ **Anotado para recuperar y no viene**: la pierde (cuenta como usada).
5. ✅ **24 h**: la app sugiere con tiempo / sin tiempo y nunca bloquea; Pau hace excepciones.
6. ✅ **Tope**: 1 por mes por cada vez por semana; aplica también a los que avisaron sin tiempo.

Además: prioridad 1) canceladas por Pau, 2) avisó con tiempo, 3) avisó sin tiempo, 4) feriado (si hay lugar); el que no avisó no recupera.

### 10.2 Casos borde — decididos por Facu (22/10/2026)

No se le preguntan a Pau: son criterios por defecto que ella puede corregir cuando lo vea en uso. Aplicados en la sección 3.2.

1. **Feriado: en total**, no por horario. Alumno de lunes y viernes en un mes con 5 lunes sin feriado y 4 viernes con 1 feriado: 5 + 3 = 8 clases = 4 × 2 → no recupera.
2. **Qué crédito se usa primero: el que vence antes.** Si tiene una de Pau (no vence) y una avisada (vence a fin de mes) y viene una vez, se usa la avisada y le queda la de Pau. Reemplaza "seguir la prioridad de Pau" para esta lectura: la prioridad sigue valiendo para **a quién se le ofrece primero un lugar**.
3. **Adelanto sin falta después:** la app lo muestra ("adelantó 1 y no faltó en octubre") y decide Pau.
4. **Otros motivos de cancelación** (corte de luz, paro): `cancelada_por_pau`. Sin opción "Otro".
5. **Cambio de horario que cruza el mes** (avisa el viernes 30/10 y viene el lunes 2/11): consume el crédito **del mes de la falta** (octubre), con un aviso en la app ("el aviso es de octubre").
6. **Alta a mitad de mes y feriado:** por feriado recupera como máximo los feriados que le tocaron.

Además: **cada pendiente de recuperar muestra su origen** ("cancelé el mié 7", "avisó con tiempo el lun 12").
