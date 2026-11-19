# Diseño: agenda unificada, horarios editables y estudios complementarios

_18/11/2026. Diagnóstico y diseño. **19/11/2026: la entrega 1 (agenda Día / Semana / Mes, 1.6) está hecha** en `fase-3/agenda-unificada`: `src/lib/agenda.ts` y `src/components/agenda/`. Se dejó para después el filtro Todo · Turnos · TPA. El resto no está implementado. Pedidos de Pau del 18/11/2026 (`REQUISITOS.md`, sección 6). Los pedidos 4 y 5 ya se hicieron en la rama `fase-3/agenda-pacientes`._

Datos reales mirados con el MCP de solo lectura (solo cantidades): 37 pacientes, 37 horarios fijos, 16 turnos individuales (15 en martes o jueves y 1 en viernes), 8 clases guardadas (7 canceladas), 1 asistencia, base de 12 MB, Storage sin buckets ni archivos.

---

## Parte 1. Agenda día / semana / mes y horarios editables (pedidos 1 y 2)

### 1.1 Qué depende hoy de los horarios fijos

La buena noticia: **lo que ya pasó no depende de las constantes.** Una clase guardada es `(fecha, hora)` (`clases_tpa`, unique), y las asistencias y notas cuelgan de ella. Las funciones `guardar_clase_tpa` y `cambiar_cancelacion_tpa` aceptan cualquier fecha y hora. El problema está en cómo se **arma** lo que se muestra.

| Qué | Dónde | Qué supone | Qué hay que cambiar |
|---|---|---|---|
| `HORARIOS_TPA` | `armarCelda` y `armarSemanaTPA` (`tpa.ts`), `calendarioDelMes` (`pagos.ts`) | Las horas de cada día son fijas para siempre | Leer los horarios vigentes **en esa fecha** |
| `DIAS_TPA` y el tipo `DiaSemana` | `tpa.ts`, `pagos.ts` (`ordenDia`, calendario), `TpaAgenda`, `TpaGrillaSemana`, `TpaListaDia`, `TpaCalendario`, `TpaInscripcion`, `TpaInscribirFijo` | Solo lunes, miércoles y viernes; 3 columnas | Días que salen de los datos; grilla con columnas variables |
| Check de `horarios_tpa.dia_semana` | Base | Solo esos 3 días | Ampliarlo a los 7 días (compatible con `main`) |
| `CUPO_TPA` | `armarCelda`, `calendarioDelMes` | 4 lugares siempre | Cupo por horario, con vigencia, para que "3/4" de una semana vieja no cambie |
| `diaSemanaDeFecha` | `recuperaciones.ts` (fijo de la clase, clases del mes para el feriado), `pagos.ts` (clases del mes, alta a mitad de mes) | Devuelve `null` en martes y jueves | Devolver los 7 días |
| `diaTPAInicial` | Celular y Calendario | El próximo L/M/V | El próximo día con clases |
| `enHorarioHabitual` | `TpaHorarioCard`, `TpaCalendarioCelda` | Comparar contra la constante | Comparar contra los horarios vigentes en esa fecha |
| `fijosActuales` | `armarCelda`, `calendarioDelMes` | `activo = true` significa "fijo hoy" | Calcularlo por fecha (ver 1.4) |

**No dependen:** la alerta de faltas (`alertas.ts`, trabaja sobre filas de asistencia), los saldos por crédito (`id` = origen + fecha + hora), las cuotas ya cobradas y las notas.

**Turnos individuales:** desde la parte A ya no hay nada atado a martes y jueves. Lo que no existe es la duración (`sesiones_rpg` guarda solo la hora de inicio) ni un control de turnos superpuestos.

### 1.2 Modelo propuesto

Hoy `horarios_tpa` significa "este alumno es fijo en este día y hora". Falta el concepto de **la clase como oferta**, que exista aunque no tenga alumnos. Se agrega una tabla y `horarios_tpa` no cambia de significado.

```sql
create table public.franjas_tpa (
  id             uuid primary key default gen_random_uuid(),
  dia_semana     text not null,      -- lunes … domingo
  hora           time not null,
  cupo           smallint not null default 4 check (cupo between 1 and 20),
  vigente_desde  date not null,      -- inclusive
  vigente_hasta  date,               -- exclusive; null = sigue
  created_at     timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta > vigente_desde)
);
-- Sin dos franjas del mismo día y hora vigentes a la vez:
-- exclude using gist (dia_semana with =, hora with =, daterange(vigente_desde, vigente_hasta) with &&)
-- (necesita la extensión btree_gist; si no, se valida en la función que escribe).
```

Se carga con los 20 horarios actuales, cupo 4 y `vigente_desde` anterior a la primera clase. Misma regla que `eraFijoEn`: desde inclusive, hasta exclusive.

| Alternativa | Por qué no |
|---|---|
| Editar la constante o guardar una lista sin fechas | Cambiar un horario reescribe las semanas pasadas y los meses ya cobrados |
| Crear por adelantado una fila en `clases_tpa` por cada clase futura | Hoy una clase existe solo si tiene algo cargado. Habría que regenerar filas ante cada cambio y las "clases vacías" ya dieron problemas (bug #2) |

### 1.3 Qué ve y qué puede hacer Pau

Pantalla **TPA → Horarios**: la grilla de días y horas con su cupo y sus fijos, y cuatro acciones. Toda acción pide **"Desde cuándo"**, y lo anterior a esa fecha nunca cambia.

| Acción | Efecto | Si hay fijos |
|---|---|---|
| Agregar horario | Franja nueva | No aplica |
| Cambiar cupo | Cierra la franja y abre otra con el cupo nuevo | Si quedan más fijos que lugares, se avisa y no se bloquea (como "5/4") |
| Cambiar día u hora | Cierra la franja y abre otra | Se ofrece **mover a los fijos** (1.4) |
| Quitar horario | Pone `vigente_hasta`. **Nunca se borra la fila** | Hay que elegir: moverlos a otro horario o darlos de baja de ese horario en esa fecha |

### 1.4 Qué pasa con los fijos y el historial

Mover a un fijo **nunca edita su fila**: se cierra (`fecha_baja = X`) y se crea otra (`fecha_alta = X`), en una sola transacción, con una función `mover_horario_tpa(...)` igual a las actuales (security invoker, `execute` solo `authenticated`, mensajes con prefijo `"TPA: "`). Editar la fila cambiaría quién fue fijo en el pasado, y con eso las recuperaciones y las cuotas.

Comprobado leyendo el código, con baja exclusive y alta inclusive:

- **Grilla:** cada semana muestra a cada alumno en el horario correcto.
- **Recuperaciones:** `frecuencia` sigue en 1 (nunca cuenta los dos horarios a la vez). Las clases del mes para la regla del feriado suman las de los dos horarios, cada una en su fecha.
- **Cuotas:** `vecesPorSemana` no sube, porque `aLaVez` nunca ve dos horarios juntos. No se toma como alta a mitad de mes: `desde` exige que **todos** sus horarios del mes empiecen dentro del mes, y el viejo no. El calendario lo muestra en los dos horarios con "baja 2/12" y "desde 2/12".
- **Por clase:** suma las clases de los dos horarios. Es correcto.

Puntos que hay que resolver en la implementación:

1. **Clases futuras con datos.** Si en el horario viejo, desde la fecha X, ya hay avisos, recuperaciones o notas, la función **no mueve** y lista esas clases. La pantalla sugiere la primera fecha sin datos. Es más seguro que trasladar asistencias automáticamente.
2. **`fijosActuales` usa `activo`.** Con una baja a futuro, el alumno desaparecería de "fijos de hoy" antes de tiempo. Hay que calcularlo con `eraFijoEn(h, hoy)` o con las altas futuras aparte.
3. **Índice único** `(paciente_id, dia_semana, hora) where activo`: si el alumno ya es fijo en el destino, se avisa.
4. **Tope de lugares en el destino:** se avisa y no se bloquea, como en el resto de la app.
5. **Tests obligatorios:** mover a mitad de mes, en recuperaciones (feriado incluido) y en `fijosDelMes`, antes de tocar pantallas.

Feriados y "Cancelar el día" no cambian: operan sobre las clases de esa fecha.

**Compatibilidad con `main`:** la tabla nueva no le afecta y ampliar el check tampoco. `main` ignora filas de días que no conoce. Mover fijos reales desde un preview sí se vería en producción como "fuera de horario", así que esa parte se prueba solo con pacientes "Prueba …".

### 1.5 Turnos individuales: días y horarios

Ya se puede dar un turno cualquier día y a cualquier hora. Si Pau quiere además **definir su horario de atención**, alcanza con una tabla parecida (`franjas_atencion`: día, desde, hasta, vigencia), que serviría solo para dibujar la vista y sugerir horas libres, **sin bloquear**. Depende de su respuesta (ya preguntada), así que queda para el final.

Para mostrar turnos en una grilla de horas hace falta la duración: `sesiones_rpg.duracion_minutos` (nullable, 60 por defecto en la app). Depende de la pregunta 1.

### 1.6 Agenda unificada

Pantalla **Agenda** (`/agenda`) con `Pestanias` **Día | Semana | Mes**. Reemplaza a "Turnos" en el menú (`/rpg` redirige). TPA sigue con sus pestañas Calendario y Recuperaciones, que son de gestión y no de agenda.

Una sola función pura, `eventosEntre(desde, hasta, datos)` en `src/lib/agenda.ts`, con tests. Devuelve una lista ordenada de eventos `turno` (con `SesionRPG`) y `clase` (con `CeldaTPA`, armada por `celdasEntre`, sin volver a filtrar horarios).

| Vista | Compu | Celular |
|---|---|---|
| **Día** | Columna por hora, con `TurnoCard` y `TpaHorarioCard`. Es lo mismo que `/hoy`, con navegación | Lista por hora |
| **Semana** | 7 columnas × horas. Turno: nombre y color. Clase: "TPA 3/4" compacta | Lista por día (como hoy) |
| **Mes** | Celda por día: los turnos con nombre y una línea "TPA: 5 clases · 3 libres" | Calendario con puntos; tocar un día abre la vista Día |

- Colores: los de `estados.ts`. Domicilio en violeta, y TPA en el teal de "Libre" o gris.
- Filtro **Todo · Turnos · TPA**, recordado con `useValorGuardado`.
- Un clic abre los modales que ya existen (`TurnoModal`, `TpaClaseModal`, historia clínica). `+` en un día u hora abre `TurnoModal` con esos datos.
- Las clases sin alumnos se muestran atenuadas o se ocultan en Semana y Mes: hoy son muchas y taparían los turnos.
- Carga: el rango visible. Un mes son pocos cientos de filas, sin problema con el plan Free.

### 1.7 Entregas

| # | Qué | Migración | Riesgo |
|---|---|---|---|
| 1 ✅ | Agenda Día / Semana / Mes con las constantes actuales (19/11) | No | Bajo. **Resuelve el pedido 2 solo** |
| 2 | `franjas_tpa` y pasar `armarSemanaTPA`, calendario y recuperaciones a leerla, **sin cambiar lo que se ve** | Sí | Medio: los tests existentes tienen que seguir igual |
| 3 | TPA → Horarios: agregar, quitar sin fijos, cambiar cupo. Días nuevos en la grilla | No | Medio |
| 4 | Cambiar día u hora con fijos (`mover_horario_tpa`) | Sí | Alto: toca recuperaciones y cuotas. Va sola |
| 5 | Horario de atención y duración de turnos (si Pau lo pide) | Sí | Bajo |

---

## Parte 2. Estudios complementarios (pedido 3)

### 2.1 Qué se ve

Tercera pestaña de la historia clínica: **Estudios**. Arriba, "+ Agregar estudio". Debajo, la lista del más nuevo al más viejo: fecha, tipo, descripción y tamaño, con "Ver" y borrar. El texto actual `estudios_imagenologicos` sigue en la Ficha y no se migra.

Agregar: elegir o sacar la foto, fecha (hoy por defecto), tipo (Radiografía, Resonancia, Tomografía, Ecografía, Laboratorio, Otro) y descripción opcional.

- **Compu:** `<input type="file" accept="image/*,application/pdf" multiple>` y arrastrar y soltar.
- **Celular:** dos botones, "Sacar foto" (`capture="environment"`) y "Elegir archivo".

### 2.2 Almacenamiento y seguridad

Bucket **privado** `estudios`, creado en la migración, con límite por archivo de **10 MB** y solo `image/jpeg`, `image/png`, `image/webp` y `application/pdf`.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estudios', 'estudios', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "Estudios: solo usuaria autorizada" on storage.objects
  for all to authenticated
  using (bucket_id = 'estudios' and (select private.es_usuaria_autorizada()))
  with check (bucket_id = 'estudios' and (select private.es_usuaria_autorizada()));
```

- **Ruta sin datos personales:** `{paciente_id}/{estudio_id}.jpg`. El nombre original del archivo suele traer el nombre del paciente: va solo en la tabla.
- **Ver un archivo:** URL firmada de **5 minutos**, creada al tocar "Ver". No se guarda ni se loguea. Supabase no permite revocar una URL firmada salvo pidiéndolo a soporte, por eso se usa un plazo corto y no hay botón de compartir.
- Con RLS, un borrado puede afectar 0 archivos sin dar error: hay que verificar lo que devuelve `remove()`, igual que `exigirUnaFila()`.

```sql
create table public.estudios_paciente (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes (id) on delete restrict,
  fecha           date not null,
  tipo            text not null check (tipo in ('radiografia','resonancia','tomografia','ecografia','laboratorio','otro')),
  descripcion     text check (char_length(descripcion) <= 500),
  ruta            text not null unique,
  nombre_original text,
  mime            text not null,
  bytes           integer not null check (bytes > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- RLS "Solo usuaria autorizada", revoke a public y anon, trigger updated_at, índice por paciente.
```

### 2.3 Subir y borrar sin dejar cosas a medias

Archivo y fila no comparten transacción, así que el orden importa.

- **Subir:** `id` generado al abrir (`nuevoId()`) → subir el archivo → insertar la fila con `insertarSinDuplicar`. Si el archivo ya estaba (reintento), se sigue. Si falla la fila, se intenta borrar el archivo.
- **Borrar** (con `ConfirmDialog` peligroso): primero el archivo, por la API de Storage, y después la fila. Si falla en el medio, queda una fila sin archivo que se ve como "No disponible" y se puede volver a borrar. Al revés quedaría un archivo invisible ocupando espacio. **Nunca se borra con SQL:** Supabase avisa que eso deja el archivo huérfano en el bucket.
- ⚠️ **Tiempo máximo:** `fetchConTiempoMaximo` corta toda escritura a los 45 s. Un PDF de 10 MB con señal mala tarda más. Hay que darle a `/storage/` un plazo mayor (3 minutos), con test.

### 2.4 Fotos comprimidas en el navegador

Sin dependencias nuevas: `createImageBitmap` y `canvas`, lado mayor de **2000 px**, JPEG calidad **0,8**. Una foto de celular de 3 a 8 MB queda en unos 300 a 800 KB (estimado, a medir con fotos reales). De paso se eliminan los metadatos EXIF, que pueden incluir la ubicación.

- Los PDF no se comprimen. Si pasan de 10 MB se avisa.
- Las imágenes transformadas de Supabase **no están disponibles en el plan Free**: no hay miniaturas automáticas. La primera versión es una lista sin miniaturas. Si hacen falta, se genera una de unos 30 KB al subir.
- HEIC (iPhone): al elegir desde Safari suele llegar como JPEG, pero hay que probarlo en un iPhone real. Si el navegador no puede abrirlo, se muestra un mensaje claro.

### 2.5 Espacio y costo

| Límite del plan Free | Valor | Con este uso |
|---|---|---|
| Almacenamiento | 1 GB | Unos **1.000 archivos** de 1 MB promedio. Con 37 pacientes y 5 estudios cada uno: unos 185 MB |
| Tamaño por archivo | 50 MB | Usamos 10 MB |
| Tráfico de salida | 5 GB por mes, sumando base y archivos | Unas 5.000 aperturas de 1 MB. Una copia completa de los archivos también cuenta |

- La suma de `bytes` permite mostrar "Usaste 185 MB de 1 GB" en la pestaña y **avisar al 80%**.
- **Costo: $0 mientras entre en el plan Free.** Si se pasa, Supabase avisa y da un período de gracia. La salida es el plan Pro, USD 25 por mes, con 100 GB (y además el proyecto deja de pausarse).

### 2.6 "Descargar copia" y baja lógica

- **La copia actual no alcanzaría.** El JSON guarda tablas, no archivos. `estudios_paciente` se agrega a `TABLAS_COPIA` y a `restaurar_copia.sql`, pero sin los archivos esas filas no sirven.
- **Propuesta:** botón aparte, **"Descargar estudios"**, que arma un ZIP en el navegador con `{paciente}/{fecha}-{tipo}.jpg`, solo con lo nuevo desde la última descarga para no gastar tráfico. Necesita una dependencia chica (`fflate`): **hay que aprobarla**. Se agrega `pau-kinesio-estudios-*.zip` a `.gitignore`. Conviene que esté **antes** de que Pau cargue muchos estudios.
- **Dar de baja:** no toca nada. Los estudios siguen visibles en su historia. Reactivar tampoco.
- **Eliminar paciente:** la FK `restrict` lo impide si tiene estudios, y `contarDatosPaciente` los suma al mensaje.
- **Proyecto pausado:** según Supabase, al reanudarlo vuelve con sus datos. Hay 90 días para hacerlo, y es otro motivo para resolver el "mantener activo".

### 2.7 Riesgos

| Riesgo | Medida |
|---|---|
| Imágenes de salud fuera del país (Supabase en Ohio) | Es la pregunta 13 de `PENDIENTES.md`, que sigue abierta y ahora pesa más. Conviene resolverla antes de subir estudios. No es asesoramiento legal |
| Borrar un estudio que hay que conservar | La historia clínica tiene plazos de guarda (Ley 26.529, art. 18). Confirmación clara, y consultarlo si hay dudas |
| Una URL firmada que se filtra | 5 minutos, sin compartir, sin logs |
| Foto ilegible por la compresión | Vista previa antes de guardar. Depende de la pregunta 3 |
| Archivos huérfanos | Orden de 2.3 y una consulta de control en `supabase/scripts/` |
| Datos reales en pruebas | Solo imágenes inventadas y pacientes "Prueba …", borradas **desde la app** |

### 2.8 Entregas

| # | Qué | Migración |
|---|---|---|
| 1 | Bucket, políticas, tabla, pestaña Estudios: subir, ver, borrar, espacio usado | Sí |
| 2 | "Descargar estudios" (ZIP) y restauración probada | No |
| 3 | Miniaturas, si hacen falta | No |

---

## Preguntas para Pau

1. **Si cambiás un horario, ¿tus alumnos fijos se mueven con él?** Por ejemplo: la clase del miércoles a las 18:00 pasa a las 18:30 desde el 1/12. ¿Pasan los 3 fijos solos a las 18:30, o preferís elegir uno por uno?
2. **¿Cuánto dura un turno individual y una clase a domicilio?** Por ejemplo: si tenés un domicilio a las 10:00, ¿podés tomar otro turno a las 11:00 o necesitás más tiempo por el viaje?
3. **¿Qué vas a subir a Estudios?** Por ejemplo: ¿una foto del informe, para leerlo, o la imagen de la placa, para hacer zoom y ver el detalle? Con lo segundo guardamos las fotos con más calidad y entran menos.
