# PENDIENTES.md — Estado y plan de trabajo

_Última revisión: 17/10/2026 — diagnóstico completo (código `a665aa3` "v0.2" + base Supabase `pau`, `dmwtoozbctnwccaaitos`, Postgres 17, plan Free) y plan de la Fase 0 (rama `fase-0/plan-seguridad`)._

## Estado actual (resumen)

**Hecho y funcionando en lo básico:**
- Navegación (sidebar en desktop, barra inferior en celular), estética teal/stone.
- Agenda RPG mensual: crear y editar turnos, estado de pago y de sesión, nota.
- Agenda TPA semanal: grilla de horarios fijos, inscribir/desinscribir alumnos fijos, marcar asistencia y colorear.
- Historia clínica en modal (solo lectura): ficha, historial RPG + TPA, alertas por palabra clave.
- Pacientes: listado, búsqueda local, alta y edición de ficha.
- Pagos: lista mensual, toggle pagado/pendiente, plan e importe.
- `tsc` y `build` sin errores. `npm run lint`: **22 errores y 8 warnings** (11 `no-explicit-any`, 5 `set-state-in-effect`, 6 comillas sin escapar; warnings: 6 imports sin usar y 2 dependencias de `useEffect`).

**Lo más importante que falta:** la **seguridad** (hoy no hay login y la base está abierta), las **notas de evolución clase a clase** (el pedido central de Pau), poder agregar a una clase a quien **recupera o viene de otro horario**, y que la app **se pueda usar en el celular**.

**Decisiones tomadas (Facu, 17/10/2026):** login con email y contraseña, una sola usuaria (Pau); los datos actuales son de prueba y se borran; plan Supabase Free; el deploy de Vercel se borró y se rehace al final de la Fase 0; el repo es público (pasarlo a privado queda fuera de esta fase); borrado de pacientes real con confirmación por ahora, baja lógica antes de la carga real.

---

## Fase 0 — Seguridad (bloqueante antes de que Pau cargue un solo paciente real)

Plan detallado en `respuesta.md` (sesión del 17/10/2026). Migraciones escritas en `supabase/migrations/20261017*`, **sin aplicar**.

- [ ] **Autenticación.** Supabase Auth con email + contraseña, una sola usuaria, usando `@supabase/ssr` (ya instalado, N14). `src/proxy.ts` (en Next 16 `middleware` pasó a llamarse `proxy`) que refresca la sesión y redirige a `/login`; pantalla de login; logout; manejo de sesión vencida.
- [ ] **Reemplazar las políticas RLS** (`20261017000001_rls_solo_usuaria_autorizada.sql`). Hoy cada tabla tiene *"Permitir todo a publico"*: cualquiera con la anon key lee, modifica y borra todo. Nuevo: políticas solo para `authenticated` y solo si el UID está en `private.usuarias_autorizadas`; se le quitan a `anon` los permisos de tabla. `lista_espera` recibe la misma política.
- [ ] **Deshabilitar el registro público** en Supabase Auth (dashboard) y crear el usuario de Pau a mano.
- [ ] **Advisors de seguridad** (`20261017000002_endurecer_funciones.sql`): `search_path` fijo en `update_updated_at`; revocar `execute` de `rls_auto_enable()` a `public`, `anon` y `authenticated`.
- [ ] **Unique en `horarios_tpa`** (`20261017000003_unique_horarios_tpa.sql`): índice único parcial `(paciente_id, dia_semana, hora) where activo` (N7).
- [ ] **Borrar los datos de prueba** (`20261017000004_borrar_datos_prueba.sql`, con protección: aborta si hay filas posteriores al 20/05/2026).
- [ ] **Borrado de pacientes con confirmación.** Borrado real (las FK siguen `ON DELETE CASCADE`), con `ConfirmDialog` que avise que es irreversible y que borra turnos, asistencias y pagos. Toda la lógica en **una sola función** de `queries.ts` (`eliminarPaciente`) para poder cambiarla después sin tocar pantallas.
- [ ] **Probar la seguridad**: sin sesión no se lee ni escribe nada; un usuario que no es Pau tampoco; con la sesión de Pau todo funciona (plan de pruebas en `respuesta.md`).
- [ ] **Fallas silenciosas por RLS:** sin sesión válida un `select` devuelve `[]` y un `update`/`delete` afecta 0 filas **sin error**. Las funciones de `queries.ts` que escriben tienen que verificar las filas afectadas, y la app tiene que redirigir al login si la sesión se cae.
- [ ] **No loguear datos de salud:** los `console.error(error)` actuales pueden imprimir filas completas (Postgres incluye "Failing row contains (…)" en algunos errores). Pasar por un helper que en producción no loguee el detalle.
- [ ] **Documentar la configuración de Auth** del dashboard (no queda versionada en las migraciones) y actualizar CLAUDE.md al cerrar la fase (RLS, `proxy.ts`, grupo de rutas `(app)`, cliente de Supabase).
- [ ] **Volver a deployar en Vercel** al final de la fase, con login funcionando y las variables de entorno cargadas.
- [x] **Versionar el esquema.** Línea base `supabase/migrations/20260520000000_esquema_inicial.sql`, corregida con los `ON DELETE CASCADE` reales (N1). **No ejecutarla** contra el proyecto existente; los cambios van en migraciones nuevas.
- [x] **Constraints clave:** existen `unique (clase_id, paciente_id)` en `asistencia_tpa`, `unique (fecha, hora)` en `clases_tpa` y `unique (paciente_id, mes, año)` en `pagos`.
- [x] **`.gitignore` corregido** (N13): ahora incluye `respuesta.md`. Falta que Facu saque del repo `gitignore` (sin punto) y `respuesta.md` con `git rm`.
- [x] Sin claves ni `.env` en el historial de git (verificado en el diagnóstico).

### Bloqueantes antes de la carga real de pacientes (final de Fase 0 / antes de Fase 5)
- [ ] 🔴 **Pasar a baja lógica** (archivar con `pacientes.activo`) y cambiar las FK a `ON DELETE RESTRICT`. Reemplazar el cuerpo de `eliminarPaciente` por "archivar", agregar "Dar de baja / Reactivar" en la ficha y una vista de archivados. Incluye N6 (editar fuerza `activo: true`; los inactivos no aparecen en el select de `TurnoModal`).
- [ ] 🔴 **Backup antes de la carga real.** El plan Free no da acceso a backups: exportación propia (`supabase db dump` o CSV por tabla) antes de cargar y después, periódicamente. Definir dónde se guarda (con datos de salud: nunca en el repo).
- [ ] 🔴 **Historial de migraciones:** `supabase_migrations.schema_migrations` está vacío porque se aplican a mano. Nunca correr `supabase db push` contra este proyecto sin antes marcar las migraciones aplicadas (`supabase migration repair`), o reejecutaría la línea base.

## Fase 0.5 — Base técnica mínima (antes de Fase 1)

Sacado de Fase 4 lo que Fase 1 necesita, para no multiplicar código duplicado y `alert()` en las pantallas nuevas.

- [ ] **`normalizarHora()`** en `src/lib/` y usarla en todas las comparaciones y en los `<input type="time">` (bug #1 y N10).
- [ ] **`src/lib/estados.ts`**: etiquetas y colores de estados una sola vez (hoy duplicados en `TpaClaseModal`, `TpaWeeklyView`, `HistoriaClinicaModal`).
- [ ] **`cn()`** de `Navigation.tsx` a `src/lib/utils.ts`.
- [ ] **Toast + ConfirmDialog** en `src/components/ui/` y reemplazar `alert()` / `confirm()`. (El `ConfirmDialog` nace en Fase 0 con el borrado de pacientes.)
- [ ] **Sacar la campana falsa** del Header (punto rojo fijo, bug #6).

## Fase 1 — Núcleo de lo que pidió Pau

### Celular primero (Pau usa la app desde el teléfono)
- [ ] **TPA en celular:** selector de día (Lun / Mié / Vie) + lista de horarios (la grilla de 4 columnas no entra en 390px).
- [ ] **RPG en celular:** lista por día en vez de calendario de 7 columnas.
- [ ] Barra inferior respetando el área segura del iPhone (`pb-safe` no existe en Tailwind 4, N11).

### Notas de evolución (prioridad #1 funcional)
- [ ] Decidir modelo (ver Preguntas): recomendado tabla `notas_evolucion` (`paciente_id`, `fecha`, `texto`, `origen` rpg/tpa/libre, `sesion_rpg_id` / `clase_tpa_id` opcionales, flags `presion`, `dolor`, `lesion`).
- [ ] En el modal de asistencia TPA: campo de nota por alumno (hoy `asistencia_tpa.nota` existe pero **no hay forma de escribirla**).
- [ ] En el turno RPG: la nota existe; mostrarla como "evolución" y no como "observación del turno".
- [ ] Poder agregar una nota libre desde la historia clínica.
- [ ] Pestaña "Evolución" en la historia clínica: notas + asistencias en una sola línea de tiempo.
- [ ] **Ocultar las alertas por palabra clave** o cambiarles el texto (hoy dicen "sesiones más recientes" pero buscan en todo el historial, bug #5). Rehacerlas en Fase 3.

### TPA
- [ ] **Armar la grilla de cada semana desde las asistencias registradas** (y los fijos solo para semanas sin registrar), no desde los fijos de hoy (N2). Requisito previo del ítem siguiente.
- [ ] **Agregar alumno no fijo a una clase** (recupera / viene de otro horario). Hoy `recupera` y `vino_otra_clase` solo se pueden asignar a fijos de ese horario. Debe mostrarse en la grilla de esa semana.
- [ ] El modal de asistencia recibe una copia congelada de los alumnos y se resetea en cada render (N3).
- [ ] **Horarios reales configurables** en lugar de 08:00–20:00 fijo + los de la DB. Los de Pau: lunes y miércoles 10:30, 11:30, 12:30, 16, 17, 18, 19; viernes igual sin 19.
- [ ] **Cupo configurable** (hoy hardcodeado en 5 y solo visual; su grilla tiene 4) y controlarlo al inscribir (N7).
- [ ] Poder volver un estado a "sin marcar"; no crear una clase vacía si todo queda pendiente (bug #2).
- [ ] Botón "Todos presentes" en el registro rápido.
- [ ] Cancelar una clase entera (feriado, enfermedad) en un toque.

### RPG
- [ ] Tipo de sesión como lista (RPG, masajes, evaluación inicial; editable), no texto libre con default "RPG".
- [ ] Botón eliminar turno (la query `deleteSesionRPG` existe, no hay UI).
- [ ] El tooltip de `TurnoCard` dice "Mes pagado/pendiente", pero en RPG el pago es por sesión.
- [ ] Crear paciente nuevo rápido desde el modal de turno.

### Historia clínica
- [ ] Mostrar **Evaluación inicial** (bug #4).
- [ ] Editar la ficha desde el mismo modal.
- [ ] Teléfono tocable (llamar / WhatsApp).
- [ ] Evaluar guardar fecha de nacimiento en vez de edad (la edad queda desactualizada).

## Fase 2 — Pagos y planes

- [ ] Definir modelo con Pau: TPA = plan mensual por frecuencia; RPG = por sesión. Hoy Pagos lista a **todos** los activos, incluidos los de RPG, y los cuenta como deudores (bug #7).
- [ ] Tabla de planes/precios configurable (hoy defaults hardcodeados de $12.000 y $8.000; su ejemplo es TPA 1×/semana $40.000).
- [ ] Mostrar en la grilla TPA quién pagó el mes (el "verde" de su Word). Movido desde Fase 1: depende del modelo de pagos.
- [ ] Cambio de mes con `addMonths`/`subMonths` (hoy `setMonth()` saltea meses los días 29–31, N4).
- [ ] El `onBlur` del importe crea un pago sin cambios; precio `0` se trata como vacío (N5).
- [ ] `upsertPago` sin `onConflict`: puede chocar con el unique `(paciente_id, mes, año)`.
- [ ] Resumen del mes: cobrado, pendiente, deudores; separado RPG / TPA.

## Fase 3 — Extras sugeridos (después del núcleo)

- [ ] Búsqueda global funcional en el Header (hoy el input no hace nada).
- [ ] Alertas reales del día en el Header (si se quiere la campana).
- [ ] Alertas clínicas basadas en flags explícitos y en notas **recientes**; poder descartarlas.
- [ ] Lista de espera con UI y "Liberar cupo" (la tabla existe; ya tiene política RLS desde Fase 0).
- [ ] Vista mensual TPA (ocupación, huecos, cancelaciones).
- [ ] Estadísticas simples: activos, faltas del mes, ocupación, ingresos.

## Fase 4 — Calidad de código

- [ ] Corregir los 22 errores de lint: 11 `no-explicit-any` (tipar errores como `unknown`), 5 `set-state-in-effect` (carga de datos en `useEffect`), 6 comillas sin escapar en `HistoriaClinicaModal`; y los 8 warnings.
- [ ] Partir componentes > 300 líneas (`HistoriaClinicaModal`, `TpaClaseModal`, `pacientes/page`, `pagos/page`).
- [ ] Resto de componentes UI base en `src/components/ui/` (Button, Input, Modal, Badge).
- [ ] Instalar `tw-animate-css` o quitar las clases `animate-in` (bug #8).
- [ ] Limpiar `globals.css` (variables Geist sin uso) y el comentario suelto en `layout.tsx`.
- [ ] `TpaWeeklyView`: calcular fechas con `addDays` en lugar de sumar milisegundos.
- [ ] Manejo de errores visible en las cargas (hoy solo `console.error`).
- [ ] Historia clínica: datos del paciente anterior si falla la carga, estados en crudo, pestaña que no se resetea (N8).
- [ ] `CalendarMonthView`: refresco sin `catch`, esqueleto solo en una celda, días de relleno sin turnos (N9).
- [ ] `TpaClaseModal`: pasar el id del día (`miercoles`) en vez de derivarlo del texto (N12).
- [ ] Tipos de `src/types/index.ts` con la nulabilidad real de la base (o generarlos con Supabase).
- [ ] README propio (hoy es el de `create-next-app`).

## Fase 5 — Puesta en marcha

- [ ] Verificar que los bloqueantes de carga real (baja lógica, backup) estén hechos.
- [ ] Carga inicial: pacientes actuales y horarios fijos TPA (planilla CSV → script de importación).
- [ ] Probar con Pau una semana real en paralelo al Word antes de abandonarlo.
- [ ] Backup periódico (exportación programada) y prueba de restauración.
- [ ] Pasar el repo a privado.

---

## Preguntas para Pau (bloquean decisiones)

1. **Colores:** en tu Word el rojo es "faltó avisando". ¿Querés mantener ese código o usamos ámbar = avisó, rojo = faltó sin avisar?
2. **Cupo TPA:** ¿son 4 lugares por horario siempre?
3. **Recuperaciones:** ¿hay un límite (ej. recuperar dentro del mes)? ¿Querés que la app lleve la cuenta de clases a recuperar?
4. **Pagos TPA:** ¿qué planes existen (1, 2, 3 veces por semana) y a qué precio? ¿Se cobra igual si faltó?
5. **Pagos RPG:** ¿cada sesión se cobra suelta? ¿Precios de RPG, masajes y evaluación inicial?
6. **Notas:** ¿te sirve marcar con un toque "presión", "dolor", "lesión" además del texto libre?
7. **Historial viejo:** ¿hace falta pasar los 3 años de Word a la app, o arrancamos de cero con los pacientes actuales?
8. **Dispositivo:** ¿la usás más desde el celular o desde la compu?
9. **Semanas pasadas de TPA:** ¿querés ver quién vino realmente esa semana (aunque hoy ya no sea fijo) o los fijos actuales? Asumimos lo primero.
10. **RPG superpuesto:** ¿podés tener dos pacientes a la misma hora? Define si la base debe impedir turnos superpuestos.
11. **Alertas:** ¿las querés automáticas por palabras ("dolor", "presión") o solo a partir de marcas que hagas vos con un toque?
12. **Historia clínica en clase:** ¿la necesitás ver desde el celular en medio de la clase, o la mirás en la compu?

Para Fase 1 bloquean la 1, 2, 3, 6 y 9; para Fase 2, la 4 y la 5.

## Bugs detectados

| # | Fase | Dónde | Problema |
|---|---|---|---|
| N1 | 0 | base | Todas las FK son `ON DELETE CASCADE`: borrar un paciente borra toda su historia. ✅ Línea base corregida. Se mantiene por ahora (borrado con confirmación); 🔴 baja lógica + `RESTRICT` antes de la carga real. |
| 9 | 0 | Supabase | Políticas RLS "permitir todo a público": la anon key da acceso total. Migración escrita. |
| N7 | 0 / 1 | base (`horarios_tpa`) | Sin unique: se puede inscribir dos veces al mismo alumno (migración escrita). El cupo no se controla al inscribir (Fase 1). |
| N6 | 0 (bloqueante carga) | `pacientes/page.tsx:107` | No hay baja de pacientes; editar fuerza `activo: true`; inactivos no aparecen en `TurnoModal`. |
| N13 | 0 | raíz | `.gitignore` no ignoraba `respuesta.md`. ✅ Corregido; falta `git rm`. |
| N14 | 0 | `package.json` | `@supabase/ssr` ya instalado y sin usar: se usa para el login. |
| 1 | 0.5 | `TpaWeeklyView` / `TpaClaseModal` | **Confirmado:** horas `"HH:mm:ss"` de la base vs `"HH:mm"` de la grilla → filas duplicadas (una `08:00` vacía y otra `08:00:00` con los alumnos); si inscribís desde la fila `08:00`, el alumno "salta" a la otra. **Riesgo futuro (hoy no reproducible):** asistencia que se guarda pero no se ve, y error de unique al re-guardar una clase, en cuanto se puedan agregar no fijos o se normalice a medias. |
| N10 | 0.5 | `TurnoModal.tsx:50` | La hora llega como `"HH:mm:ss"` al `<input type="time">`. Mismo origen que #1. |
| 6 | 0.5 / 3 | `Header` | Campana con punto rojo fijo (sacarla en 0.5); buscador que no busca (Fase 3). |
| N2 | 1 | `TpaWeeklyView.tsx:161, 203-205` | Cualquier semana muestra los fijos **de hoy**, no quienes estuvieron. Las asistencias de no fijos nunca se verían. |
| N3 | 1 | `TpaWeeklyView` + `TpaClaseModal` | Modal con copia congelada de alumnos; el efecto se re-ejecuta en cada render y borra marcas sin guardar. |
| 2 | 1 | `TpaClaseModal.tsx:96` | Volver a "pendiente" no se guarda; si todo queda pendiente se crea igual una clase vacía. |
| 4 | 1 | `HistoriaClinicaModal` | No muestra `evaluacion_inicial`. |
| 5 | 1 / 3 | `HistoriaClinicaModal` | Alertas por palabra clave sobre **todo** el historial, aunque el texto dice "recientes". |
| N11 | 1 | `Navigation.tsx:26` | `pb-safe` no existe en Tailwind 4: en iPhone la barra queda sobre la barra de inicio. |
| 7 | 2 | `pagos/page` | Precios hardcodeados; mezcla RPG (por sesión) con mensual. |
| N4 | 2 | `pagos/page.tsx:43, 51` | `setMonth()` saltea meses los días 29–31. |
| N5 | 2 | `pagos/page.tsx:255` | `onBlur` crea un pago sin cambios; precio `0` = vacío. |
| 8 | 4 | Global | Clases `animate-in` sin plugin instalado → no animan. |
| N8 | 4 | `HistoriaClinicaModal` | Datos del paciente anterior si falla la carga; estados en crudo; pestaña no se resetea. |
| N9 | 4 | `CalendarMonthView` | Refresco sin `catch`; esqueleto solo en la celda 15; días de relleno sin turnos. |
| N12 | 4 | `TpaClaseModal.tsx:129-131` | Día derivado del texto "Miércoles"; frágil. |
| 3 | — | `TpaClaseModal` | ~~Clases duplicadas~~ **Descartado:** existe `unique (fecha, hora)`. |
