# Diseño: asistencia TPA, faltas, recuperaciones y notas

_Referencia para las entregas de la Fase 1 (asistencia). Sale del diagnóstico del 20/10/2026 con las decisiones de Facu del 21/10/2026 aplicadas. En los ejemplos se usan "Alumna A", "Alumno B", etc.: no son datos reales._

**Estado:** entrega 1 hecha (rama `fase-1/asistencia`). Las entregas 2 a 4 están pendientes; la 3 está bloqueada por las preguntas a Pau (sección 10).

---

## 1. Decisiones tomadas (Facu, 21/10/2026)

1. **Sin `falta_id`.** No se vincula cada recuperación con una falta concreta: el saldo se calcula **contando** por alumno y por mes (sección 3.2). "Adelanta" no es un tipo propio: es una recuperación usada antes de faltar en ese mes.
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

---

## 2. Modelo de datos

### 2.1 Cómo se guarda cada concepto de Pau

| Concepto de Pau | Cómo se guarda |
|---|---|
| Fijo | `horarios_tpa` (+ `fecha_alta` editable, entrega 2) |
| Presente / Avisó C.T. / Avisó S.T. / No avisó (de un fijo) | `asistencia_tpa.estado` con `tipo = 'fijo'`: `presente`, `aviso_con_tiempo`, `aviso_sin_tiempo`, `falto_sin_avisar` |
| Sin marcar | **sin fila** (como hoy) |
| Cuándo llegó el aviso | `asistencia_tpa.avisado_at` (lo completa la app al marcar el aviso) |
| Clase cancelada (feriado, Pau no puede) | `clases_tpa.cancelada = true` + `motivo_cancelacion` (**de la clase**, no de cada alumno) |
| Quien viene a ocupar un lugar | fila de `asistencia_tpa` con `tipo` ≠ `fijo` |
| "Recupera" | `tipo = 'recupera'` |
| "Viene a las 18" (cambio puntual de horario) | `tipo = 'cambio'` en el destino + aviso del fijo en el origen (la app marca las dos cosas juntas) |
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

Lo calcula `armarSemanaTPA()` (`src/lib/tpa.ts`), que sigue siendo la única fuente de quién está en cada horario.

### 3.2 Saldo de recuperaciones (entrega 3): se calcula, no se guarda

Función pura nueva `calcularRecuperaciones()` en `src/lib/recuperaciones.ts`. Por alumno y por mes:

1. **Frecuencia (tope)** = cantidad de horarios fijos que tiene (1, 2 o 3). _Supuesto:_ los vigentes el último día del mes, o hoy si el mes está en curso. En la fase 2 puede salir del plan pagado.
2. **Avisadas** = sus filas `tipo = 'fijo'` con `aviso_con_tiempo` o `aviso_sin_tiempo` en clases del mes, ordenadas: **primero las C.T.**, después las S.T.; dentro de cada grupo, la más vieja primero.
3. **Derecho** = `min(avisadas, frecuencia)`: las primeras de esa lista. El resto figura como "sin derecho (llegó al tope)".
4. **Usadas** = veces que ocupó un lugar en el mes con `tipo = 'recupera'` o `'cambio'`. Las `suelta` no cuentan.
5. **Pendientes** = `max(0, derecho − usadas)`. Las usadas consumen la lista del punto 2 desde el principio, o sea **primero las avisadas con tiempo**; las que quedan son las pendientes.
6. **Adelantó** = `max(0, usadas − derecho)`: recuperaciones usadas antes de faltar.

Nada se bloquea: si Pau hace una excepción ("ya usó 2 de 2", "es de otro mes"), la app avisa y la deja seguir.

**Depende de las respuestas de Pau** (sección 10): si las clases que cancela ella suman al derecho, si cambio y adelanto cuentan como usadas, el borde de mes, si quien queda anotado y no viene la pierde, las 24 h y el tope de los S.T.

### 3.3 Alerta de 2 faltas seguidas sin aviso (entrega 4)

Función pura en `src/lib/alertas.ts`. Con las asistencias del alumno **como fijo**, en **cualquiera de sus horarios**, ordenadas por fecha y hora:

- se ignoran las clases canceladas y las **sin marcar** (no cortan la racha);
- si las dos últimas marcadas son `falto_sin_avisar` → alerta en la grilla, en el modal y en la ficha;
- el lugar no se libera solo (Pau dijo que no).

### 3.4 Con tiempo / sin tiempo (entrega 2)

- Sugerencia **visible** y que se cambia con un toque: "Faltan 49 h para la clase → con tiempo".
- Con tiempo = el aviso se carga **24 h o más** antes del inicio de la clase (pregunta abierta: si son exactas).
- En una clase que ya pasó, la app **no sugiere** (no sabe cuándo llegó el aviso): Pau elige.
- Se guarda `avisado_at` igual.
- Zona horaria: las clases son de Argentina (UTC−3) y la base está en UTC. En el navegador se calcula en la hora del dispositivo; en SQL, siempre con `America/Argentina/Buenos_Aires`.

---

## 4. Migración única (entrega 2)

Archivo: `supabase/migrations/AAAAMMDD000001_tpa_faltas_y_lugares.sql` (la fecha se fija al escribirla). **Antes**: correr el script de borrado (sección 5). Borrador:

```sql
-- =====================================================================
-- Fase 1 — Asistencia TPA: estados nuevos definitivos, quién ocupa cada
-- lugar, avisos con fecha, clases canceladas y fecha de alta de los fijos.
-- Diseño: docs/DISENO_ASISTENCIA_TPA.md.
--
-- Una sola migración (sin expandir/contraer): se aplica justo antes de
-- probar el preview y se mergea el mismo día. Mientras tanto, la app de
-- producción (entrega 1) lee los estados nuevos sin romperse, pero no puede
-- guardar "Avisó", "Recupera" ni "De otro horario" (los rechaza el check).
-- =====================================================================

begin;

-- 0. Solo sobre datos limpios: correr antes el script de borrado
do $$
begin
  if exists (
    select 1 from public.asistencia_tpa
    where estado is null or estado not in ('presente', 'falto_sin_avisar')
  ) then
    raise exception 'Hay asistencias con estados viejos: correr antes el script de borrado (docs/DISENO_ASISTENCIA_TPA.md, sección 5).';
  end if;
end;
$$;

-- 1. Estados definitivos
alter table public.asistencia_tpa drop constraint asistencia_tpa_estado_check;
alter table public.asistencia_tpa add constraint asistencia_tpa_estado_check
  check (estado = any (array['presente', 'aviso_con_tiempo', 'aviso_sin_tiempo', 'falto_sin_avisar', 'pendiente']));
alter table public.asistencia_tpa alter column estado drop default;

-- 2. Nulos que no tienen sentido
alter table public.asistencia_tpa
  alter column clase_id    set not null,
  alter column paciente_id set not null,
  alter column estado      set not null;

-- 3. Quién ocupa cada lugar
alter table public.asistencia_tpa
  add column tipo           text not null default 'fijo',
  add column ocupa_lugar_de uuid,
  add column avisado_at     timestamptz,
  add column updated_at     timestamptz not null default now();

alter table public.asistencia_tpa
  add constraint asistencia_tpa_tipo_check
    check (tipo = any (array['fijo', 'recupera', 'cambio', 'suelta'])),
  add constraint asistencia_tpa_ocupa_lugar_de_fkey
    foreign key (ocupa_lugar_de) references public.asistencia_tpa (id) on delete set null,
  -- un lugar lo ocupa una sola persona
  add constraint asistencia_tpa_ocupa_lugar_de_key unique (ocupa_lugar_de),
  add constraint asistencia_tpa_ocupa_solo_no_fijos
    check (ocupa_lugar_de is null or tipo <> 'fijo'),
  -- fijo: nunca 'pendiente' (sin marcar = sin fila);
  -- quien viene a ocupar: 'pendiente' hasta la clase, después presente o no vino
  add constraint asistencia_tpa_estado_segun_tipo
    check (
      (tipo = 'fijo' and estado <> 'pendiente')
      or (tipo <> 'fijo' and estado = any (array['pendiente', 'presente', 'falto_sin_avisar']))
    );

comment on column public.asistencia_tpa.tipo is
  'fijo = alumno fijo de este horario; recupera / cambio / suelta = viene a ocupar un lugar solo en esta clase.';
comment on column public.asistencia_tpa.ocupa_lugar_de is
  'Fila del fijo (misma clase) cuyo lugar ocupa. NULL = ocupa un lugar libre.';
comment on column public.asistencia_tpa.avisado_at is
  'Momento en que se cargó el aviso de falta (para con tiempo / sin tiempo).';

create index asistencia_tpa_paciente_id_idx on public.asistencia_tpa (paciente_id);

create trigger asistencia_tpa_updated_at
  before update on public.asistencia_tpa
  for each row execute function public.update_updated_at();

-- 4. ocupa_lugar_de tiene que ser un fijo de la misma clase (un check no
--    puede mirar otras filas). Mensaje sin datos de pacientes.
create function public.validar_asistencia_tpa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ocupa_lugar_de is not null and not exists (
    select 1 from public.asistencia_tpa f
    where f.id = new.ocupa_lugar_de and f.clase_id = new.clase_id and f.tipo = 'fijo'
  ) then
    raise exception 'ocupa_lugar_de tiene que ser un fijo de la misma clase' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Solo la usa el trigger: nadie la ejecuta por la API.
revoke all on function public.validar_asistencia_tpa() from public, anon, authenticated;

create trigger asistencia_tpa_validar
  before insert or update of clase_id, ocupa_lugar_de
  on public.asistencia_tpa
  for each row execute function public.validar_asistencia_tpa();

-- 5. Clase cancelada (feriado, Pau no puede dar la clase). La UI llega en la entrega 4.
alter table public.clases_tpa
  add column cancelada          boolean not null default false,
  add column motivo_cancelacion text;

-- 6. Desde cuándo es fijo (editable; reemplaza a created_at en eraFijoEn)
alter table public.horarios_tpa add column fecha_alta date;

update public.horarios_tpa
set fecha_alta = (coalesce(created_at, now()) at time zone 'America/Argentina/Buenos_Aires')::date;

alter table public.horarios_tpa
  alter column fecha_alta set not null,
  alter column fecha_alta set default ((now() at time zone 'America/Argentina/Buenos_Aires')::date);

comment on column public.horarios_tpa.fecha_alta is
  'Desde qué fecha es fijo de este horario (inclusive).';

commit;

-- =====================================================================
-- ROLLBACK (pierde C.T./S.T., quién ocupa y las cancelaciones)
-- =====================================================================
-- begin;
-- alter table public.horarios_tpa drop column if exists fecha_alta;
-- alter table public.clases_tpa drop column if exists motivo_cancelacion, drop column if exists cancelada;
-- drop trigger if exists asistencia_tpa_validar on public.asistencia_tpa;
-- drop function if exists public.validar_asistencia_tpa();
-- drop trigger if exists asistencia_tpa_updated_at on public.asistencia_tpa;
-- drop index if exists public.asistencia_tpa_paciente_id_idx;
-- delete from public.asistencia_tpa where tipo <> 'fijo' or estado not in ('presente', 'falto_sin_avisar');
-- alter table public.asistencia_tpa
--   drop constraint if exists asistencia_tpa_estado_segun_tipo,
--   drop column if exists updated_at, drop column if exists avisado_at,
--   drop column if exists ocupa_lugar_de, drop column if exists tipo;
-- alter table public.asistencia_tpa drop constraint asistencia_tpa_estado_check;
-- alter table public.asistencia_tpa add constraint asistencia_tpa_estado_check check (estado = any (array[
--   'presente', 'aviso_ausencia', 'falto_sin_avisar', 'recupera', 'vino_otra_clase', 'cancelado', 'pendiente']));
-- alter table public.asistencia_tpa alter column estado set default 'pendiente';
-- alter table public.asistencia_tpa
--   alter column clase_id drop not null, alter column paciente_id drop not null, alter column estado drop not null;
-- commit;
```

Notas:
- El trigger `validar_asistencia_tpa` es una red de seguridad: la app ya valida lo mismo.
- Antes de escribirla en la entrega 2, volver a verificar con el MCP (solo lectura) el nombre del check de `estado` y su default actual.
- `notas_evolucion` (entrega 4) y `guardar_clase_tpa` (entrega 3) van en migraciones propias: no cambian estados.

---

## 5. Script de borrado de la asistencia de prueba (no es una migración)

Lo corre Facu en el SQL Editor **inmediatamente antes** de la migración única. Protegido: si hay más filas que las de prueba conocidas, no borra nada. **Actualizar los números** con un `select count(*)` justo antes de correrlo.

```sql
do $$
begin
  if (select count(*) from public.asistencia_tpa) > 8 or (select count(*) from public.clases_tpa) > 4 then
    raise exception 'Hay más filas que las de prueba conocidas (8 asistencias, 4 clases): no se borra nada.';
  end if;
  delete from public.clases_tpa;  -- borra también sus asistencias (on delete cascade)
end;
$$;
```

Los horarios de prueba del lunes 08:00 (fuera de los horarios reales) se desinscriben desde la app.

---

## 6. Otras piezas de base de datos

### 6.1 `guardar_clase_tpa` (entrega 3)

Guarda una clase entera en una sola transacción: hoy cada alumno es una petición aparte y, si falla una, queda guardada la mitad. Con quien viene a ocupar, el orden importa (primero el aviso del fijo, después quien ocupa su lugar).

- Recibe la fecha, la hora y la lista de cambios (marcar / desmarcar, con `tipo`, `estado`, `ocupa_lugar_de`, `avisado_at`).
- Crea la clase si no existe (`on conflict (fecha, hora)`), aplica los cambios en orden y borra la clase si quedó vacía (salvo cancelada o con notas).
- `security invoker` (respeta RLS), `set search_path = ''`, `revoke execute ... from public, anon` y `grant execute ... to authenticated`.
- Reintentable: llamarla dos veces con lo mismo deja el mismo resultado.
- El SQL completo se escribe en la entrega 3, con las respuestas de Pau.

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
- Clase cancelada: card gris con "Cancelada · Feriado".
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
- **Pie:** "Cancelar clase" (con `ConfirmDialog` y motivo: Feriado / No puedo dar la clase / Otro) a la izquierda; Cancelar y Guardar a la derecha.
- La pestaña "Alumnos fijos" queda igual (+ fecha de alta en la entrega 2).

### 7.3 Selector "Ocupar lugar" (entrega 3)

En este orden, cada persona con su motivo:

1. Pendientes con aviso **con tiempo** ("faltó lun 12/10 · le queda 1 de 2").
2. Pendientes con aviso **sin tiempo**.
3. **Adelantar:** fijos de otros horarios con recuperaciones disponibles este mes.
4. **Cambio de horario esta semana:** fijos de otros horarios de esta misma semana.
5. **Buscar otro paciente** (clase suelta).

Al elegir, el tipo se completa solo y se puede cambiar.

### 7.4 Pestaña "Recuperaciones" (dentro de TPA, entrega 3)

TPA tiene dos pestañas: **Semana** | **Recuperaciones**. Por mes:

- **Pendientes de recuperar**, en dos grupos (con tiempo / sin tiempo): alumno, falta (fecha y horario), "usó 1 de 2" y **"Buscar lugar"** (lugares libres de esta semana y la siguiente, dentro del mes).
- **Adelantos** (usó más de lo que faltó).
- **Faltas sin derecho a recuperar** (no avisó o llegó al tope), solo informativo.
- **"Copiar lista"** en texto para WhatsApp (reemplaza la lista de los viernes).
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
5. **Feriado.** Abrir clase → **Cancelar clase** → "Feriado". Card gris.
6. **Ficha.** Nombre → **Evolución**: alerta, saldo del mes, notas y asistencias en orden.

---

## 8. Plan: 4 entregas

Al final de cada una: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` y una lista de pruebas en compu y en 390px.

| Entrega | Rama | Qué | Base de datos |
|---|---|---|---|
| **1** ✅ | `fase-1/asistencia` | Evaluación inicial en la ficha. Guardados que no duplican (id generado al abrir el formulario en pacientes y turnos; `createClaseTPA` como upsert; inscripción reintentable). Timeout 15 s lecturas / 45 s escrituras con mensaje "no sabemos si se guardó". `estados.ts` tolerante a estados desconocidos. Sin el fallback de `fecha_baja`. Vitest + tests de `armarSemanaTPA`. | ninguna |
| **2** | `fase-1/faltas-y-lugares` | Estados nuevos (Avisó C.T. / S.T. / No avisó), contador de lugares y "Libre", avisos anticipados con sugerencia C.T./S.T., sin "Presente" a futuro, `fecha_alta` editable al inscribir. `eliminarClaseTPASiVacia` protegida (cancelada / quien ocupa). | Script de borrado + **migración única** (sección 4) |
| **3** | (a definir) | Ocupar lugar con sugerencias (recupera / cambio / suelta), `guardar_clase_tpa`, `calcularRecuperaciones` + tests, pestaña Recuperaciones, "Buscar lugar", "Copiar lista". **Bloqueada por las preguntas a Pau.** | migración de `guardar_clase_tpa` |
| **4** | (a definir) | "Marcar el resto como presente", cancelar clase, notas de evolución (modal, pestaña Evolución, nota libre), alerta de 2 faltas + tests, sacar las alertas por palabra clave. | migración de `notas_evolucion` |

**Orden de aplicación de la entrega 2:** la entrega 1 tiene que estar **en producción** antes (para que la app de producción no se rompa al leer un estado nuevo). El día de la prueba: script de borrado → migración única → probar el preview → mergear. Entre la migración y el merge, producción no puede guardar "Avisó" (el check lo rechaza y muestra un error): conviene que Pau no cargue asistencia en ese rato.

---

## 9. Riesgos y supuestos (por importancia)

1. 🔴 **Política de recuperaciones supuesta.** Si una regla está mal, el saldo está mal y Pau deja de confiar. Mitigación: preguntas de la sección 10 antes de la entrega 3; nada se bloquea.
2. 🔴 **Ventana entre la migración única y el merge.** Preview y producción comparten la base. Mitigación: entrega 1 en producción antes; migración y merge el mismo día.
3. 🟠 **"Con tiempo" mal sugerido** si Pau carga el aviso tarde. Mitigación: sugerencia visible, un toque para cambiarla, sin sugerencia en clases pasadas.
4. 🟠 **Zona horaria.** Base en UTC, clases en hora de Argentina. Se supone el dispositivo de Pau en hora argentina. El SQL usa `America/Argentina/Buenos_Aires`.
5. 🟠 **`eliminarClaseTPASiVacia`** borraría clases canceladas, con notas o con quien viene a ocupar si no se ajusta (entrega 2 y 4).
6. 🟡 **Guardado a medias** (varias peticiones en paralelo) se agrava con quien viene a ocupar. Mitigación: `guardar_clase_tpa` (entrega 3).
7. 🟡 **Frecuencia = cantidad de horarios fijos.** Si alguien paga un plan distinto de lo que tiene inscripto, el tope no coincide. Se alinea en la fase 2.
8. 🟡 **Desinscribir con avisos futuros** deja filas de fijo en fechas posteriores a la baja. Mitigación: avisar al desinscribir y ofrecer borrarlas.
9. 🟢 **Rendimiento:** el saldo necesita las asistencias del mes (decenas de filas).

---

## 10. Preguntas abiertas para Pau (bloquean la entrega 3)

1. Cuando **ella** cancela la clase (feriado, no puede), ¿los fijos tienen derecho a recuperarla? ¿Cuenta dentro del tope del mes?
2. El **cambio de horario puntual** y el **adelanto**, ¿cuentan como una de las recuperaciones del mes?
3. Una falta de **fin de mes**, ¿se puede recuperar el mes siguiente?
4. Si alguien queda **anotado para recuperar y no viene**, ¿pierde esa recuperación?
5. Las **24 h**, ¿son exactas desde la hora de la clase, o alcanza con avisar el día anterior?
6. El **tope** (1, 2 o 3 según la frecuencia), ¿aplica igual a los que avisaron **sin tiempo**?
