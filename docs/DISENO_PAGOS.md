# Diseño: pagos y calendario general (Fase 2)

_Escrito el 12/11/2026 sobre la rama `fase-2/pagos`. Sale de leer la pantalla de Pagos actual, sus queries, la tabla `pagos` en la base (MCP de solo lectura) y las reglas de Pau de octubre 2026 (`REQUISITOS.md`, sección 4). En los ejemplos se usan "Alumna A", "Alumno B": no son datos reales._

**Estado:** entregas 1 y 2 unidas en una sola tanda (rama `fase-2/pagos-completo`, 13/11/2026): todo pagos salvo "mantener activo", que va al final del proyecto. Las decisiones de Facu del 13/11 (abajo) mandan sobre lo que diga el resto del documento; donde cambian algo, está corregido en su sección.

### Decisiones de Facu (13/11/2026)

1. **Importe sugerido: siempre el plan** según las veces por semana. Si la fecha de pago es posterior al 10, solo un aviso al lado: "Después del 10: por clase serían 4 × $18.000 = $72.000 · Usar" (un clic lo aplica). Al cambiar la fecha se recalcula el aviso. Reemplaza el supuesto 1 (sección 3.2).
2. **`pagos_tpa`:** el unique `(paciente_id, mes)` vale **solo para `concepto = 'cuota'`** (índice único parcial). Cada pago de clases sueltas va en **su propia fila**, con `nuevoId()` + `insertarSinDuplicar()`. Reemplaza "una fila de sueltas por persona y mes" (2.3).
3. TPA abre en la pestaña **Calendario** la primera vez; después, en la **última que se usó**.
4. En el Calendario, cada "Libre" tiene **"+ Inscribir fijo"** (el mismo `TpaInscripcion`, con ese día y hora y "Fijo desde"): Pau va a cargar sus fijos desde ahí.
5. Calendario como **pestaña de TPA**; "pendiente" en **rosa en toda la app** (también RPG); si no hay precios de un mes, se usan los del anterior **con aviso** y Pau los carga desde la app.
6. **No se borra la tabla `pagos`** en esta tanda (va en la tanda de datos reales). La pantalla vieja sí se reemplaza entera.
7. Pregunta de los 5 lunes: **respondida, la cuota cubre el mes entero**. Pagos en partes: supuesto "no pasa", se anota en la nota. Después del 10, alta a mitad de mes y sueltas: los supuestos del diseño, con el importe siempre a la vista y editable.
8. Pruebas más cortas: un SQL de escenario, hasta 6 cosas para mirar (unos 5 minutos, en la compu salvo que algo sea propio del celular) y el SQL de borrado (CLAUDE.md, paso 4).

---

## 1. Diagnóstico de lo que hay hoy

### 1.1 La tabla `pagos` (leída el 12/11/2026)

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `paciente_id` | uuid | **sí** | — |
| `mes` | integer | no | — (check 1–12) |
| `año` | integer | no | — |
| `plan` | text | sí | — (texto libre: hoy "RPG", "TPA" o "ambos") |
| `precio` | numeric | sí | — |
| `estado` | text | **sí** | `'pendiente'` (check `pagado`/`pendiente`) |
| `fecha_pago` | date | sí | — |
| `created_at` | timestamptz | sí | `now()` |

- Constraints: PK `id`, **unique `(paciente_id, mes, año)`**, FK a `pacientes` con `on delete cascade`.
- RLS activo con la política "Solo usuaria autorizada" (`authenticated`). Sin trigger de `updated_at` (no tiene la columna).
- **2 filas**, las dos de prueba y armadas con los precios inventados del código: octubre ($12.000, plan "ambos", pendiente, de un paciente de RPG) y noviembre ($8.000, "TPA", pagado el 22/10). No sirven: se borran.

### 1.2 Qué sirve

- El **unique `(paciente_id, mes, año)`**: la idea de "un pago de cuota por alumno por mes" es la de Pau.
- RLS y la política, igual que el resto.
- `ESTADOS_PAGO` en `estados.ts` (etiqueta y colores en un solo lugar).
- `sesiones_rpg.estado_pago` (pagado/pendiente por sesión): es el modelo correcto para RPG y ya lo usan `TurnoModal` y `TurnoCard`.
- `asistencia_tpa.tipo = 'suelta'`: las clases sueltas ya quedan registradas al ocupar un lugar.
- `horarios_tpa` con `fecha_alta` / `fecha_baja` y `eraFijoEn()`: alcanza para saber quién debe la cuota de cada mes y con qué frecuencia.

### 1.3 Qué no sirve

- **Mezcla RPG con TPA** (bug #7): lista a **todos** los pacientes activos y a los de RPG les pide una cuota mensual que no existe. Los cuenta como "deudores".
- **Precios inventados** en el código ($12.000 y $8.000) en tres lugares; no hay precios por mes ni historial.
- El **plan** es texto libre ("RPG", "TPA", "Tratamiento completo") y no dice cuántas veces por semana.
- No lee **`sesiones_rpg`** ni las **clases sueltas**: el total del mes no es el total real.
- No registra **efectivo o transferencia**, ni si pagó con el descuento del 1 al 10.
- Columna `año` con ñ: funciona, pero obliga a comillas en SQL y es fácil equivocarse. Las tablas nuevas usan `mes date` (primer día del mes).

### 1.4 Qué se rompe

| # | Dónde | Problema |
|---|---|---|
| 7 | `pagos/page.tsx:71, 130, 230` | Precios por defecto inventados; RPG mezclado con mensual; el resumen suma esos precios inventados como "pendiente". |
| N4 | `pagos/page.tsx:43–58` | `setMonth()` saltea meses los días 29–31 (el 31/10 → "siguiente" da diciembre). |
| N5 | `pagos/page.tsx:255–276` | El `onBlur` del importe guarda aunque no cambió nada, y **crea un pago** para cualquiera al que se le pase por el campo. Precio `0` se trata como vacío (`||`) y vuelve al precio inventado. |
| — | `queries.ts:453` `upsertPago` | `upsert` sin `onConflict`: si la pantalla no tiene el `id` (otra pestaña, doble clic, carga vieja), choca con el unique y muestra "Ya existe un registro igual". |
| — | `pagos/page.tsx:41` | Carga sin `useDatos`: si falla, la tabla queda vacía y dice "No hay pacientes registrados" (parece que no hay datos). |
| — | `pagos/page.tsx:66, 96` | `any` (2 errores de lint), `set-state-in-effect` y una dependencia de `useEffect` (el resto de los errores de lint del proyecto). |
| — | `pagos/page.tsx:217` | En el celular la tabla se desplaza de costado dentro de su card. |
| — | `getPacientesConPagos` | Un paciente dado de baja con un pago de ese mes desaparece de los totales del mes. |
| — | `pagos/page.tsx:180` | `toLocaleString()` sin `'es-AR'`: el formato depende del navegador. |

**Conclusión:** la pantalla y `upsertPago` se reemplazan enteros; la tabla `pagos` se deja de usar y se borra cuando la nueva esté en producción (sección 5).

---

## 2. Modelo de datos propuesto

### 2.1 Qué se guarda y qué se calcula

| Concepto | ¿Se guarda o se calcula? | Dónde |
|---|---|---|
| Precios de cada mes (con historial) | **Se guarda** | `precios_mes` (nueva) |
| Quién debe la cuota de TPA de un mes | Se calcula | fijos de `horarios_tpa` vigentes en ese mes (`eraFijoEn`) |
| Plan sugerido (1, 2 o 3 veces por semana) | Se calcula | cantidad de horarios fijos del alumno en el mes |
| Importe sugerido (plan o por clase) | Se calcula | precios del mes + fecha de pago (1 al 10) |
| **Lo que pagó** (importe real, plan, fecha, medio) | **Se guarda** | `pagos_tpa` (nueva). El importe se congela: si el mes que viene cambian los precios, lo cobrado no cambia |
| Clases sueltas del mes (persona × cantidad) | Se calcula | `asistencia_tpa` con `tipo = 'suelta'` |
| Pago de las clases sueltas | **Se guarda** | `pagos_tpa` con `concepto = 'sueltas'` |
| Pago de una sesión de RPG | **Se guarda** | `sesiones_rpg.estado_pago` (ya existe) + importe, fecha y medio (columnas nuevas) |
| Totales (por plan, sueltas, RPG, cobrado, pendiente, efectivo / transferencia) | Se calcula | funciones puras (sección 3) |
| Color del calendario general | Se calcula | verde / rosa / Libre (sección 4.2) |

Regla general: **pendiente = no hay pago guardado**. No se crean filas "pendiente" para todos al empezar el mes: así no hay que generar nada cada mes, y un alta nueva aparece sola como pendiente.

### 2.2 `precios_mes`

```sql
create table public.precios_mes (
  mes          date primary key,                    -- primer día del mes: '2026-10-01'
  tpa_1_vez    integer not null check (tpa_1_vez > 0),
  tpa_2_veces  integer not null check (tpa_2_veces > 0),
  tpa_3_veces  integer not null check (tpa_3_veces > 0),
  tpa_suelta   integer not null check (tpa_suelta > 0),
  rpg_sesion   integer not null check (rpg_sesion > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint precios_mes_primer_dia check (extract(day from mes) = 1)
);
-- + trigger update_updated_at, RLS "Solo usuaria autorizada", revoke a public y anon
-- + insert de septiembre y octubre 2026 (son precios de Pau, no datos de pacientes)
```

- Pesos enteros (**supuesto**: sin centavos).
- **Precio vigente** de un mes = la fila de ese mes o, si no hay, la del **último mes anterior** con precios, con aviso a la vista: "Noviembre sin precios: se usan los de octubre · Cargar precios de noviembre". Así un mes sin cambios no obliga a cargar nada, y el aviso recuerda que cambian seguido.
- "Cargar precios de noviembre" abre el formulario con los del mes anterior ya completos: si cambia uno, se edita ese.
- Un solo precio de RPG para RPG, masajes y evaluación inicial (Pau). Si algún día cambian por tipo, se agrega una columna.

### 2.3 `pagos_tpa`

Una fila = **un pago ya hecho** de un alumno en un mes.

```sql
create table public.pagos_tpa (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null references public.pacientes (id) on delete cascade,
  mes               date not null,                  -- primer día del mes que paga
  concepto          text not null,                  -- 'cuota' | 'sueltas'
  veces_por_semana  smallint,                       -- solo cuota: 1, 2 o 3
  modalidad         text,                           -- solo cuota: 'plan' (del 1 al 10) | 'por_clase'
  clases            smallint,                       -- por_clase y sueltas: cuántas clases paga
  importe           integer not null check (importe >= 0),
  pagado_el         date not null,
  medio             text not null,                  -- 'efectivo' | 'transferencia'
  nota              text check (char_length(nota) <= 500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pagos_tpa_mes_primer_dia check (extract(day from mes) = 1),
  constraint pagos_tpa_concepto check (concepto in ('cuota', 'sueltas')),
  constraint pagos_tpa_medio check (medio in ('efectivo', 'transferencia')),
  constraint pagos_tpa_cuota check (
    (concepto = 'cuota'   and veces_por_semana between 1 and 3 and modalidad in ('plan', 'por_clase')
                          and (modalidad = 'plan') = (clases is null))
    or
    (concepto = 'sueltas' and veces_por_semana is null and modalidad is null and clases >= 1)
  ),
  constraint pagos_tpa_clases check (clases is null or clases >= 1)
);
-- Una cuota por alumno y mes; las sueltas pueden tener varias filas (decisión 2 de Facu):
create unique index pagos_tpa_una_cuota_por_mes on public.pagos_tpa (paciente_id, mes) where concepto = 'cuota';
-- + índices (mes) y (paciente_id), trigger update_updated_at, RLS "Solo usuaria autorizada", revoke a public y anon
```

_Implementado en `supabase/migrations/20261113000001_pagos.sql` (13/11/2026)._

- **Guardar sin duplicar:** cada pago nuevo lleva un `id` generado al abrir el panel (`nuevoId()`) y se inserta con `insertarSinDuplicar()` (`crearPagoTPA`); editar es un `update` por `id`. Tocar Guardar de nuevo después de un corte no crea dos pagos. Una segunda cuota del mismo alumno y mes (por ejemplo, desde otra pestaña) choca con el índice único parcial y la app avisa "Ya hay un pago de la cuota de ese mes…". (PostgREST no puede hacer upsert sobre un índice parcial: por eso no es un upsert.)
- **Deshacer un pago** (marcado por error) = borrar la fila, con `ConfirmDialog` y verificando que se borró 1 fila (RLS).
- **Clases sueltas:** **cada pago es una fila** (decisión 2). Si vino el 5 y pagó, y vino el 20 y pagó, son dos filas con `clases = 1`. Pendiente de sueltas = sueltas Presente del mes − suma de `clases` pagadas.
- **Supuesto (decisión 7):** un solo pago de cuota por alumno y mes; si alguna vez paga en partes, se anota cuando completa y se escribe en la nota.
- Se usa el `nombre` del paciente para mostrar; el plan pagado (`veces_por_semana`) queda guardado aunque después cambien sus horarios.
- `on delete cascade` como el resto; pasa a `restrict` junto con las demás tablas antes de la carga real (bloqueante ya anotado).

### 2.4 RPG

Se mantiene `sesiones_rpg.estado_pago` y se agregan tres columnas que se completan al marcar "Pagado":

```sql
alter table public.sesiones_rpg
  add column importe     integer check (importe >= 0),
  add column pagado_el   date,
  add column medio_pago  text check (medio_pago in ('efectivo', 'transferencia'));
-- trigger limpiar_pago_sesion_rpg: si no está pagada, las tres quedan en null
-- check sesiones_rpg_pago_solo_si_pagado (nunca falla: el trigger corre antes)
```

- **Por qué un trigger y no solo un check:** entre que Facu aplica la migración y hace el merge, producción (`main`) sigue pasando sesiones a "pendiente" sin mandar estas columnas. Un check solo rechazaría ese guardado; el trigger las limpia y el check queda como garantía.
- Desde el modal del turno, al marcar Pagado se elige el medio (la fecha queda la de antes o hoy); importe y fecha se corrigen en Pagos.

- Las sesiones viejas pagadas sin importe se cuentan con el precio de RPG de su mes.
- **Supuesto:** una sesión **cancelada** no se cobra y no figura como pendiente; una sesión **pendiente** (todavía no se hizo) figura como "a cobrar" recién cuando pasa su fecha. Lo que cuenta como deuda de RPG = sesiones del mes no canceladas, ya pasadas, sin pagar.

### 2.5 Cómo se relaciona con lo que ya existe

```
precios_mes (mes) ─────────────┐ precio vigente del mes
                               ▼
horarios_tpa ──► fijos del mes + veces por semana ──► cuota sugerida ──► pagos_tpa (concepto 'cuota')
asistencia_tpa (tipo 'suelta') ──► sueltas del mes (persona × cantidad) ──► pagos_tpa (concepto 'sueltas')
sesiones_rpg (estado_pago + importe/medio) ──► RPG del mes
```

- **Recuperaciones:** no cambian. El tope sigue saliendo de la cantidad de horarios fijos (`calcularRecuperaciones`). Si un alumno paga un plan distinto de los horarios que tiene, la app lo avisa al cobrar ("tiene 2 horarios y paga 1 vez por semana"); hacer que el tope salga del plan pagado queda para después, si Pau lo pide.
- La tabla `pagos` vieja se deja quieta (producción la sigue usando hasta el merge) y **se borra en la tanda de datos reales** (decisión 6), con guarda.

---

## 3. Reglas de cálculo (funciones puras en `src/lib/pagos.ts`, con tests)

Fechas y "hoy" siempre en hora argentina (como `avisos.ts`). Meses como `'yyyy-MM'`.

### 3.1 Funciones (implementadas en `src/lib/pagos.ts`, 43 tests en `pagos.test.ts`)

| Función | Qué devuelve |
|---|---|
| `preciosDelMes(precios, mes)` | Los precios del mes o, si no hay, los del último mes anterior, con `heredadoDe: '2026-10'`. `null` si no hay ninguno anterior. |
| `fijosDelMes(horarios, mes)` | Por alumno: horarios fijos que tuvo en el mes (`eraFijoEn` en alguna fecha de clase del mes), `vecesPorSemana` (máximo de horarios vigentes a la vez, tope 3), `horariosDeMas`, `desde` / `baja` si entra o sale en el mes y `clases` (las que le tocan en el mes). |
| `cuotasDelMes(horarios, pagos, mes, precios)` | Una fila por fijo del mes (con su pago o `null` = pendiente y el importe pendiente = precio del plan) + quien pagó la cuota sin ser fijo del mes. |
| `avisoPorClase({ veces, precios, pagadoEl, mes, fijo })` | El importe sugerido es **siempre el plan**; esto es la alternativa por clase para el aviso "· Usar": alta en el mes (clases que le tocan × suelta, solo si es más barato) o, si no, pago después del 10 (4 × veces × suelta). `null` si no corresponde. |
| `sueltasDelMes(asistencias, pagos, mes, precios, hoy)` | Por persona: sueltas en clases no canceladas (Presente = para cobrar, sin marcar, por venir, no vino), sus pagos (una fila cada uno) y lo pendiente. |
| `sesionesRPGDelMes(sesiones, mes, precios, hoy)` | Sesiones del mes no canceladas: pagada, importe (guardado o precio del mes), futura, a cobrar. |
| `resumenDelMes(cuotas, sueltas, sesiones)` | Por plan (alumnos, pagaron, cobrado, pendiente), sueltas, RPG y totales: cobrado, falta cobrar, total, efectivo, transferencia y sin medio. |
| `textoPendientes(...)` | Texto para WhatsApp ("Copiar pendientes"). |
| `calendarioDelMes(horarios, cuotas, mes)` | Para cada horario × día, los lugares: fijos del mes (pagado o no, "desde" / "baja") y los libres hasta el cupo. |
| `calcularPagosDelMes(datos, hoy)`, `medioSugerido(pagos, paciente)` | Todo el mes junto (para `/pagos` y el Calendario) y el medio de su último pago. |

### 3.2 Supuestos que usan las funciones (Pau los puede corregir)

1. **Pago después del 10:** se sugiere **el plan** (decisión 1 de Facu) y al lado el aviso "Después del 10: por clase serían 4 × $18.000 = $72.000 · Usar". _Antes decía sugerir por clase._
2. **Meses con 5 lunes:** la cuota cubre el mes entero; la 5.ª clase no se cobra aparte. ✅ **Respondida** (decisión 7).
3. **Alta a mitad de mes:** se sugiere el plan, y si las clases que le quedan desde su alta salen más baratas, el aviso "Empieza el 15/11: por clase serían 2 × $18.000 = $36.000 · Usar". No se combina con el aviso de después del 10 (paga cuando empieza).
4. **Baja a mitad de mes:** debe la cuota completa del mes (lo normal es que ya la haya pagado del 1 al 10).
5. **Feriados y clases que canceló Pau:** no cambian la cuota (se compensan con recuperaciones).
6. **Clase suelta "No vino":** no se cobra. "Sin marcar" se muestra aparte para que Pau la marque.
7. Pagar **antes** del mes (por ejemplo, el 30/10 la cuota de noviembre) cuenta como "del 1 al 10".
8. **"+ Inscribir fijo" desde el Calendario:** "Fijo desde" arranca en el **1 del mes que se mira** (Pau está cargando a quienes ya vienen); se cambia a mano.
9. Precios de **RPG de septiembre**: $46.000, igual que octubre (no estaba en su tabla).

### 3.3 Casos para los tests

Precios de octubre 2026: 1 vez $50.000 · 2 veces $80.000 · 3 veces $110.000 · suelta $18.000. Septiembre: $46.000 · $74.000 · $100.000 · $16.000.

| Caso | Resultado esperado |
|---|---|
| Precios: hay octubre, se pide octubre | Los de octubre, sin aviso |
| Precios: hay septiembre y octubre, se pide noviembre | Los de octubre, `heredadoDe: '2026-10'` |
| Precios: se pide agosto (no hay ninguno anterior) | `null` → "Cargá los precios de agosto" |
| Alumna A, fija lunes 10:30, todo octubre | 1 vez por semana; debe la cuota de octubre |
| Alumno B, fijo lunes y miércoles | 2 veces; plan $80.000 |
| Alumna C con 4 horarios (error de carga) | 3 veces (tope) y aviso |
| Paga el 10/10 la cuota de octubre | Modalidad plan; $50.000 (1 vez) |
| Paga el 11/10 | Plan $50.000, con aviso "Después del 10: por clase serían 4 × $18.000 = $72.000 · Usar" (decisión 1) |
| Paga el 30/9 la cuota de octubre | Plan (supuesto 7) |
| Alta el 15/10, fija los lunes (19 y 26) | Plan, con aviso "Empieza el 15/10: por clase serían 2 × $18.000 = $36.000 · Usar" (supuesto 3) |
| Alta el 15/10, fija lunes, miércoles y viernes | Le quedan 2 + 2 + 3 = 7 clases → 7 × $18.000 = $126.000 > plan de 3 veces ($110.000) → sin aviso, queda el plan |
| Baja el 20/10 | Debe la cuota completa de octubre (supuesto 4) |
| Alumno con baja el 30/9 | No figura en octubre |
| Alta el 1/11 (futura) | No figura en octubre; sí en noviembre |
| Cambia de 1 a 2 veces el 15/10 | 2 veces (máximo a la vez en el mes) |
| Sueltas: Alumna D, 3 sueltas en octubre (2 Presente, 1 No vino) | Para cobrar 2 × $18.000 = $36.000; "1 no vino" informativo |
| Sueltas: paga 1 el 5/10, vuelve el 20/10 | Fila con `clases = 1` → pendiente 1 × $18.000; con un segundo pago (otra fila), nada pendiente |
| Suelta en una clase cancelada | No cuenta |
| Pago guardado con $50.000 en octubre; en noviembre sube a $55.000 | Octubre sigue mostrando $50.000 cobrado |
| Resumen octubre: 3 de 1 vez (2 pagaron en efectivo y transferencia), 1 de 2 veces sin pagar, 2 sueltas cobradas, 4 sesiones RPG (3 pagadas) | Cobrado = 2 × $50.000 + $36.000 + 3 × $46.000; falta cobrar = $50.000 + $80.000 + $46.000; efectivo / transferencia según cada pago |
| RPG: sesión cancelada sin pagar | No suma en pendiente |
| RPG: sesión del 28/10 sin pagar, hoy 20/10 | No figura como deuda todavía |
| Calendario: lunes 10:30 con 3 fijos (1 pagó) | Verde, rosa, rosa, Libre |
| Calendario: fijo con alta el 15 | Rosa o verde con "desde 15" |

---

## 4. Pantallas (compu primero)

### 4.1 Cobrar (el mismo panel en todos lados)

Componente `CobrarCuota` (modal angosto en la compu, hoja desde abajo en el celular; se descartó el popover anclado: el modal ya existe y anda igual en las dos). **Un clic para abrir, uno para guardar**:

```
Alumna A · noviembre · 1 vez por semana (lun 10:30)
 Importe     [$ 50.000 ]   Plan (pagó del 1 al 10)   · cambiar a por clase
 Medio       [Transferencia] [Efectivo]
 Fecha       [12/11/2026]
                                   [Cancelar] [Guardar]
```

- Todo viene completo con lo sugerido: importe (sección 3), medio = el de su último pago (si no, transferencia: **supuesto**, en su Word marca el efectivo), fecha = hoy. En el caso normal es **abrir → Guardar**.
- Si paga después del 10, el importe sigue siendo el plan y al lado aparece "Después del 10: por clase serían 4 × $18.000 = $72.000 · Usar" (decisión 1). "Usar" lo aplica (`modalidad = 'por_clase'`, `clases = 4`) y aparece "Volver al plan". Avisa, no bloquea.
- Ya pagado: muestra "Pagó el 5/11 · transferencia · $50.000", con "Editar" y "Deshacer el pago" (con `ConfirmDialog`).

### 4.2 Calendario general (TPA, pestaña nueva)

Es lo primero que mira Pau en TPA. Va como pestaña de TPA: **Semana | Calendario | Recuperaciones**. TPA abre en **Calendario** la primera vez y después en la última pestaña que usó (decisión 3).

Compu: grilla horarios (filas) × Lun / Mié / Vie (columnas), cada día con sus **4 lugares**:

```
Noviembre 2026            ‹ Noviembre ›     Pagaron 12 de 18 · Falta cobrar $430.000
          LUNES                                    MIÉRCOLES               VIERNES
10:30  [Alumna A ●] [Alumno B ●] [Libre] [Libre]   [...]                   [...]
11:30  ...
```

- **Verde** (`bg-emerald-50 text-emerald-700 border-emerald-200`) = pagó la cuota del mes. **Rosa** (`bg-pink-50 text-pink-700 border-pink-200`) = todavía no pagó. **Libre** = el mismo marcador teal punteado de la semana. _Supuesto:_ el amarillo "LIBRE" de su Word queda en teal, como se decidió el 23/10 (en amarillo se confunde con los avisos).
- Clic en un nombre → **Cobrar** (4.1), con "Ver historia clínica" abajo. Pagar desde el calendario: **2 clics**.
- Cada "Libre" tiene **"+ Inscribir fijo"** (decisión 4): abre el mismo `TpaInscripcion` del modal de la clase con ese día y hora y "Fijo desde" (supuesto 8). Pau va a cargar sus fijos desde ahí.
- Entra o sale en el mes: "desde 15" / "hasta 20" en chico.
- Navegación por mes (`addMonths`/`subMonths`, no `setMonth`: N4). Mes sin precios: franja con "Cargar precios de noviembre".
- Arriba: "Pagaron 12 de 18" y "Falta cobrar $430.000" (solo cuotas).
- Celular: selector de día (Lun / Mié / Vie) como en la semana, y cada horario como una card con sus 4 lugares en filas.

**Cambio de color en `estados.ts`:** `ESTADOS_PAGO.pendiente` pasa de ámbar a **rosa** (el color de Pau). También en RPG (punto de `TurnoCard` y badge de `TurnoModal`): el ámbar queda solo para "avisó". DESIGN.md se actualiza en la misma entrega.

### 4.3 Pagos del mes (`/pagos`, se rehace entera)

Compu, de arriba hacia abajo, como su Word:

1. Encabezado: "Pagos" + navegación de mes + **"Copiar pendientes"** (texto para WhatsApp, como en Recuperaciones).
2. Cuatro cifras: **Cobrado** · **Falta cobrar** · **Total del mes** · **Efectivo / Transferencia**.
3. **Precios del mes** en una línea ("1 vez $50.000 · 2 veces $80.000 · 3 veces $110.000 · suelta $18.000 · RPG $46.000") con "Editar".
4. **TPA por plan**: una tabla por plan (1 vez / 2 veces / 3 veces) con Alumno (tocable → historia clínica) · Horarios · Estado (verde "Pagó el 5/11 · efectivo" / rosa "Pendiente") · Importe · botón **Cobrar**. Al pie de cada tabla, el total del plan (cobrado y pendiente).
5. **Clases sueltas**: Persona · Cantidad ("× 3", con "1 no vino" / "1 sin marcar" en gris) · Importe · Estado · Cobrar.
6. **RPG**: sesiones del mes ya hechas: Fecha · Paciente · Tipo · Estado de pago (un clic: Pagado ↔ Pendiente, con el mismo panel de medio) · Importe.
7. Pie: totales por sección y total del mes.

Celular: las mismas secciones en cards (una por alumno, el botón Cobrar de 44px), sin tablas: nada se desplaza de costado.

### 4.4 Dónde se marca un pago (pocos clics)

| Desde | Clics |
|---|---|
| Calendario general → nombre → Guardar | 2 |
| Pagos del mes → Cobrar → Guardar | 2 |
| RPG: turno → "Pagado" en el modal (ya existe) | 2 + Guardar |

---

## 5. Plan en entregas

Al final de cada una: `tsc`, `lint`, `build`, `npm test` y las pruebas cortas de CLAUDE.md (escenario SQL + hasta 6 cosas para mirar + SQL de borrado).

| Tanda | Rama | Qué | Base de datos |
|---|---|---|---|
| **Pagos completo** (entregas 1 y 2 juntas, decisión de Facu del 13/11) | `fase-2/pagos-completo` | `src/lib/pagos.ts` + tests. Pestaña **Calendario** en TPA (verde / rosa / Libre con "+ Inscribir fijo") con **Cobrar** en 2 clics. Precios del mes (ver, cargar, usar los del anterior con aviso). `/pagos` completa: cifras, cuotas por plan, clases sueltas, RPG con importe / medio / fecha, "Copiar pendientes" (reemplaza la pantalla vieja: se van #7, N4, N5, N18, N19 y los errores de lint de Pagos). Rosa para "pendiente" en toda la app. | Migración `20261113000001_pagos.sql`: `precios_mes` (septiembre y octubre 2026), `pagos_tpa`, columnas de pago en `sesiones_rpg` (con trigger). **No toca `pagos`.** |
| **Datos reales** | — | Borrar la tabla `pagos` con guarda, los datos de prueba viejos y lo demás de "Bloqueantes antes de la carga real". | Migración con guarda. |
| **Mantener activo** (al final del proyecto) | `fase-2/mantener-activo` | **Bloqueante antes de la carga real:** función `public.ping()` + ruta `/api/mantener-activo` + Vercel Cron diario (ver PENDIENTES). | Migración: `ping()` |
| después | — | Punto de pago en la grilla de la semana; pagos pendientes en "Inicio" (Para atender); tope de recuperaciones desde el plan pagado, si Pau lo pide; "Exento este mes" (vacaciones, beca) si hace falta. | — |

## 6. Riesgos

1. 🟠 **Importe sugerido mal** (reglas después del 10, alta a mitad de mes, 5.ª clase sin confirmar). Mitigación: se sugiere siempre el plan, el importe está a la vista y es editable, y la alternativa por clase aparece como aviso con "Usar".
2. 🟠 **Mes sin precios cargados.** Mitigación: se usan los del mes anterior con aviso visible y "Cargar precios de noviembre" a un clic; lo cobrado queda guardado con su importe.
3. 🟠 **Dos tablas de pagos durante la transición** (`pagos` vieja y `pagos_tpa`). Mitigación: esta tanda reemplaza la pantalla vieja, nada escribe en `pagos` desde el merge, y la tanda de datos reales la borra con guarda.
4. 🟠 **Borrar un paciente borra sus pagos** (`on delete cascade`): se pierde el historial de ingresos. Ya está como bloqueante (baja lógica + `restrict`) antes de la carga real.
5. 🟠 **Proyecto pausado** (pasó el 12/11): la app deja de andar. Mitigación hoy: Facu entra una vez por semana; entrega 3 lo automatiza.
6. 🟡 **Plan pagado distinto de los horarios**: el tope de recuperaciones sigue los horarios. Mitigación: aviso al cobrar.
7. 🟡 **Pago marcado por error.** Mitigación: "Deshacer el pago" con confirmación; el pago muestra fecha y medio.
8. 🟡 **Fechas y zona horaria:** "del 1 al 10" en hora argentina; la fecha de pago se puede corregir.
9. 🟡 **RLS que devuelve 0 filas sin error** al guardar o deshacer: `.select()` + `exigirUnaFila()` en todas las escrituras, como el resto.
10. 🟡 **Datos personales:** los pagos no son datos de salud, pero son datos personales: misma RLS, nunca a la consola.

---

## 7. Preguntas para Pau

En orden de importancia. **Estado al 13/11/2026 (Facu):** la 2 respondida (la cuota cubre el mes entero); la 5, supuesto "no pasa" (se anota en la nota); la 1, 3 y 4 siguen con el supuesto del diseño, con el importe siempre a la vista y editable. Ninguna frena el uso.

1. **Si alguien paga después del 10, ¿cuánto le cobrás?**
   Ejemplo: Alumna A va 1 vez por semana y paga el 15 de noviembre. ¿Le cobrás 4 clases sueltas (4 × $18.000 = $72.000), solo las clases que le quedan en el mes, u otra cosa?
   _Decidido por Facu (13/11): se sugiere el plan, con el aviso "por clase serían 4 × $18.000 · Usar"._ Ya no bloquea: la respuesta de Pau solo cambia el aviso.
2. **En un mes con 5 lunes, ¿la 5.ª clase se cobra aparte?**
   Ejemplo: noviembre 2026 tiene 5 lunes. Alumna A paga $50.000 por 1 vez por semana. ¿Esa cuota incluye los 5 lunes, o el 5.º se paga como suelta?
   ✅ _Respondida (Facu, 13/11): incluye el mes entero._
3. **Si alguien empieza a mitad de mes, ¿cómo le cobrás ese primer mes?**
   Ejemplo: Alumno B empieza los lunes el 16 de noviembre (le quedan 3 lunes). ¿Paga 3 clases sueltas, la cuota entera, o una parte?
   _Supuesto: se sugiere el plan, con el aviso de las clases que le quedan como sueltas si sale más barato._ No bloquea.
4. **Las clases sueltas, ¿se pagan el mismo día o todas juntas a fin de mes?**
   Ejemplo: Alumna D vino 3 veces suelta en noviembre. ¿Te paga cada vez que viene, o te paga las 3 juntas?
   _Supuesto: se ven por persona y por mes (persona × cantidad, como en tu Word) y cada pago se anota aparte (de a una o todas juntas)._ No bloquea.
5. **¿Alguien te paga la cuota en partes?**
   Ejemplo: Alumno B (2 veces, $80.000) te da $40.000 el 5 y $40.000 el 20.
   _Supuesto (Facu, 13/11): no pasa; si pasa, se anota cuando completa y se escribe en la nota._ Si pasa seguido, cambia el modelo (pagos parciales).

**Supuestos que decidí y Pau puede corregir al verlos** (no se le preguntan): pesos sin centavos; el día 10 incluido en el descuento y pagar antes del mes también cuenta; la baja a mitad de mes debe el mes completo; feriados y clases canceladas no cambian la cuota; suelta "No vino" no se cobra; sesión de RPG cancelada no se cobra y la que todavía no se hizo no es deuda; medio por defecto = el de su último pago (si no, transferencia); "Libre" en teal (no amarillo); "Fijo desde" = el 1 del mes que se mira al inscribir desde el Calendario; RPG de septiembre a $46.000. Decididos por Facu (13/11): pendiente en **rosa** en toda la app; TPA abre en Calendario y después en la última pestaña usada.
