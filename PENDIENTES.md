# PENDIENTES.md — Estado y plan de trabajo

_Última revisión: 21/10/2026 — Fases 0 y 0.5 completas; Fase 1: modelo de la grilla TPA y vistas de celular mergeados; **asistencia TPA en 4 entregas** (diseño en `docs/DISENO_ASISTENCIA_TPA.md`), entrega 1 hecha en la rama `fase-1/asistencia`. App en https://paukinesio.vercel.app. Base Supabase `pau` (`dmwtoozbctnwccaaitos`, Postgres 17, plan Free, región us-east-2)._

## Estado actual (resumen)

**Hecho y funcionando en lo básico:**
- Navegación (sidebar en desktop, barra inferior en celular), estética teal/stone.
- Agenda RPG: calendario mensual en la compu y lista semanal (martes y jueves) en el celular; crear y editar turnos, estado de pago y de sesión, nota.
- Agenda TPA: semana armada con los fijos de esa fecha + las asistencias registradas, horarios reales de Pau y cupo 4; grilla en la compu y selector de día + lista en el celular; inscribir/desinscribir fijos y registrar asistencia.
- Historia clínica en modal (solo lectura): ficha, historial RPG + TPA, alertas por palabra clave.
- Pacientes: listado, búsqueda local, alta y edición de ficha.
- Pagos: lista mensual, toggle pagado/pendiente, plan e importe.
- Seguridad (Fase 0): login, `proxy.ts`, RLS solo para la usuaria autorizada, Salir, borrado de pacientes con confirmación. Deployada en Vercel.
- Base técnica (Fase 0.5): horas normalizadas, `estados.ts`, Toast, `ConfirmDialog`, aviso de usuario no autorizado.
- Celular: ninguna pantalla con desplazamiento lateral, modales en hoja o pantalla completa con pie fijo, área segura del iPhone, aviso de sin conexión.
- Tests automáticos con **Vitest** (`npm test`) para las funciones puras de `src/lib/`.
- `tsc`, `build` y `npm test` sin errores. `npm run lint`: **10 errores y 2 warnings**, todos en código anterior (2 `no-explicit-any` y 1 `set-state-in-effect` en `pagos/page`, 1 `set-state-in-effect` en `TurnoModal`, 6 comillas sin escapar en `HistoriaClinicaModal`; warnings: `cn` sin usar en `TurnoModal` y una dependencia de `useEffect` en Pagos).

**Lo más importante que falta:** las **notas de evolución clase a clase** (el pedido central de Pau) y poder agregar a una clase a quien **recupera o viene de otro horario**.

**Decisiones tomadas (Facu, 17/10/2026):** login con email y contraseña, una sola usuaria (Pau); los datos actuales son de prueba y se borran; plan Supabase Free; el deploy de Vercel se borró y se rehace al final de la Fase 0; el repo es público (pasarlo a privado queda fuera de esta fase); borrado de pacientes real con confirmación por ahora, baja lógica antes de la carga real.

---

## Fase 0 — Seguridad ✅ completa (18/10/2026)

Migraciones 000001 a 000004 aplicadas por Facu, usuaria de Pau autorizada, pruebas de flujos (compu y celular) y de `curl` hechas, deploy en Vercel con Site URL y Redirect URLs configuradas. Configuración de Auth en `supabase/AUTH.md`.

- [x] **Autenticación (código).** `@supabase/ssr` (N14) con `createBrowserClient`; `src/proxy.ts` + `src/lib/supabase-proxy.ts` (refresca la sesión y redirige a `/login?next=…`); grupo de rutas `(app)`; `/login`; `SesionWatcher` (sesión cerrada sola → login con aviso); botón Salir con `scope: 'local'`; auth centralizada en `src/lib/auth.ts`.
- [x] **Reemplazar las políticas RLS** (`20261017000001_rls_solo_usuaria_autorizada.sql`, aplicada + `insert` de Pau): políticas solo para `authenticated` y solo si el UID está en `private.usuarias_autorizadas`; `anon` sin permisos de tabla; `lista_espera` con la misma política.
- [x] **Deshabilitar el registro público y el sign-in anónimo** en Supabase Auth y crear el usuario de Pau (Facu, 18/10/2026). ⚠️ En la primera prueba el registro seguía habilitado (son dos interruptores distintos); se corrigió y se borró la cuenta creada. Ver `supabase/AUTH.md`.
- [x] **Advisors de seguridad** (aplicada por Facu) (`20261017000002_endurecer_funciones.sql`): `search_path` fijo en `update_updated_at`; revocar `execute` de `rls_auto_enable()` a `public`, `anon` y `authenticated`.
- [x] **Unique en `horarios_tpa`** (aplicada por Facu) (`20261017000003_unique_horarios_tpa.sql`): índice único parcial `(paciente_id, dia_semana, hora) where activo` (N7).
- [x] **Borrar los datos de prueba** (aplicada por Facu) (`20261017000004_borrar_datos_prueba.sql`, con protección: aborta si hay filas posteriores al 20/05/2026).
- [x] **Borrado de pacientes con confirmación.** Borrado real (FK `ON DELETE CASCADE`). Botón "Eliminar paciente" en el formulario de edición → `EliminarPacienteDialog` (usa `ConfirmDialog` de `src/components/ui/`) con contadores de turnos, asistencias, pagos y horarios. Lógica en `eliminarPaciente` + `contarDatosPaciente` de `queries.ts`.
- [x] **Probar** (Facu, 18/10/2026): flujos con RLS activo en compu y celular (login, pacientes, RPG, TPA, pagos, borrado, salir, sesión cerrada en otra pestaña, cookies borradas); `curl` sin sesión → `42501`, registro → `signup_disabled`, anónimo → `anonymous_provider_disabled`.
- [x] **Fallas silenciosas por RLS:** todas las escrituras de `queries.ts` terminan en `.select()` y verifican con `exigirUnaFila()` (sin `.single()`); `SesionWatcher` y el proxy llevan al login si la sesión se cae. Para las lecturas, el aviso de usuario no autorizado (Fase 0.5).
- [x] **No loguear datos de salud:** todos los `console.error` reemplazados por `registrarError()` (en producción solo contexto + código) y los `alert()` muestran `mensajeError()` en vez de `error.details` (`src/lib/errores.ts`).
- [x] **Documentar la configuración de Auth** (`supabase/AUTH.md`) y actualizar CLAUDE.md (RLS, `proxy.ts`, `(app)`, `auth.ts`, `errores.ts`, `git add .`) y DESIGN.md (login, Toast, botón irreversible).
- [x] **Volver a deployar en Vercel**, con login funcionando y las variables de entorno cargadas; Site URL y Redirect URLs actualizadas en Supabase (Facu, 18/10/2026).
- [x] **Versionar el esquema.** Línea base `supabase/migrations/20260520000000_esquema_inicial.sql`, corregida con los `ON DELETE CASCADE` reales (N1). **No ejecutarla** contra el proyecto existente; los cambios van en migraciones nuevas.
- [x] **Constraints clave:** existen `unique (clase_id, paciente_id)` en `asistencia_tpa`, `unique (fecha, hora)` en `clases_tpa` y `unique (paciente_id, mes, año)` en `pagos`.
- [x] **`.gitignore` corregido** (N13): incluye `respuesta.md`; `gitignore` (sin punto) y `respuesta.md` fuera del repo.
- [x] Sin claves ni `.env` en el historial de git (verificado en el diagnóstico).

### Bloqueantes antes de la carga real de pacientes (antes de Fase 5)
- [ ] 🔴 **Mantener activo el proyecto de Supabase** (decidido: Vercel Cron + `public.ping()`). El plan Free lo pausa tras 7 días sin actividad (por ejemplo, vacaciones de Pau). Plan: un **Vercel Cron Job** diario (el plan Hobby permite uno por día) que llame a una ruta `src/app/api/mantener-activo/route.ts`. La ruta (a) exige el header `Authorization: Bearer ${CRON_SECRET}` que manda Vercel; (b) queda excluida del redirect del proxy; (c) llama a una función mínima `public.ping()` (`select 1`, sin datos, `execute` solo para `anon`) creada en una migración nueva. Alternativa sin código: GitHub Actions con `schedule`, pero GitHub desactiva los workflows programados tras 60 días sin commits. ⚠️ Sin verificar: qué cuenta exactamente como "actividad" para Supabase. Confirmarlo en su documentación antes de implementar.
- [ ] 🔴 **Usuario de prueba no autorizado** (creado a propósito por Facu el 18/10/2026 para probar el aviso): borrarlo o cambiarle la contraseña por una larga.
- [ ] 🔴 **Cambiar la contraseña de prueba de Pau por una larga** (16+ caracteres, en un gestor de contraseñas) desde Authentication → Users.
- [ ] 🔴 **Pasar a baja lógica** (archivar con `pacientes.activo`) y cambiar las FK a `ON DELETE RESTRICT`. Reemplazar el cuerpo de `eliminarPaciente` por "archivar", agregar "Dar de baja / Reactivar" en la ficha y una vista de archivados. Incluye N6 (editar fuerza `activo: true`; los inactivos no aparecen en el select de `TurnoModal`).
- [ ] 🔴 **Backup antes de la carga real.** El plan Free no da acceso a backups: exportación propia (`supabase db dump` o CSV por tabla) antes de cargar y después, periódicamente. Definir dónde se guarda (con datos de salud: nunca en el repo).
- [ ] 🔴 **Historial de migraciones:** `supabase_migrations.schema_migrations` está vacío porque se aplican a mano. Nunca correr `supabase db push` contra este proyecto sin antes marcar las migraciones aplicadas (`supabase migration repair`), o reejecutaría la línea base.

### Después de la Fase 0
- [ ] Migrar las claves de firma JWT de Supabase a **asimétricas** (dashboard → JWT Keys), para que `getClaims()` en `proxy.ts` valide el token localmente sin consultar al servidor de Auth en cada navegación.
- [ ] Pasar de la anon key vieja (`eyJ…`) a la **publishable key** nueva (`sb_publishable_…`) en `.env.local` y Vercel.

## Fase 0.5 — Base técnica mínima (antes de Fase 1)

Sacado de Fase 4 lo que Fase 1 necesita, para no multiplicar código duplicado y `alert()` en las pantallas nuevas.

Estado: ✅ **completa** (mergeada; migración `20261018000001` aplicada y probada por Facu el 18/10/2026).

- [x] **`normalizarHora()`** en `src/lib/horas.ts`. `queries.ts` devuelve todas las horas como `"HH:mm"` (`conHora()`), y además se usa en las comparaciones de `armarSemanaTPA` y en el `<input type="time">` de `TurnoModal` (bug #1 y N10).
- [x] **`src/lib/estados.ts`**: etiquetas, colores e íconos de asistencia TPA, sesión RPG y pago, usados en grilla TPA, modal TPA, historia clínica, `TurnoCard`, `TurnoModal` y Pagos. "Sin marcar" ahora con borde punteado y texto más oscuro (antes casi no se veía).
- [x] **`cn()`** en `src/lib/utils.ts`.
- [x] **Toast** (`ToastProvider` + `ToastItem` en `src/components/ui/`, `useToast()`): reemplaza todos los `alert()`, confirma guardados y avisa errores de carga (antes solo `console.error`). Desinscribir usa `ConfirmDialog`.
- [x] **Sacar la campana falsa** del Header (bug #6).
- [x] **Volver a "Sin marcar" y no crear clases vacías** (bug #2): "sin marcar" = sin fila de asistencia; al guardar se marcan/desmarcan solo los cambios, no se crea la clase si nadie quedó marcado y se borra si quedó vacía.
- [x] **Modal TPA con datos vivos** (parte de N3): los alumnos, la clase y las asistencias del modal se derivan del estado actual, no de una copia congelada.
- [x] **Aviso de usuario no autorizado** (`VerificadorAutorizacion` + `public.soy_autorizada()`, migración aplicada y probada).
- [x] **Probar** (Facu, 18/10/2026). Lo que encontró se corrigió en Fase 1 (Guardar con cambios, pestaña y marcas que se perdían, carga sin conexión sin aviso).

## Fase 1 — Núcleo de lo que pidió Pau

### Asistencia TPA: faltas, lugares, recuperaciones y notas — 4 entregas

**Diseño completo y decisiones: [`docs/DISENO_ASISTENCIA_TPA.md`](docs/DISENO_ASISTENCIA_TPA.md)** (referencia para las entregas 2 a 4).

Decisiones (Facu, 21/10/2026):
- Sin `falta_id`: el saldo se calcula **contando** por alumno y por mes. Derecho = faltas avisadas (C.T. + S.T.) del mes, con tope = frecuencia (cantidad de horarios fijos); usadas = veces que ocupó un lugar en el mes (`recupera` o `cambio`); pendientes = derecho − usadas, consumiendo primero las avisadas con tiempo. "Adelanta" no es un tipo: es una recuperación usada antes de faltar.
- Tipos de quien ocupa un lugar: `fijo`, `recupera`, `cambio`, `suelta`. Se mantiene `ocupa_lugar_de`.
- Datos de prueba de asistencia: se borran (script). **Una sola migración** con los estados nuevos definitivos: Facu la aplica justo antes de probar el preview y mergea el mismo día.
- Vitest para las funciones puras. Función transaccional `guardar_clase_tpa` (security invoker, `execute` solo para `authenticated`). `fecha_alta` en `horarios_tpa` en la entrega 2.
- Criterios por defecto (Pau los puede cambiar): colores como están; lugar lleno → avisar, no bloquear; 2 faltas seguidas sin aviso → en cualquier horario del alumno, las clases sin marcar no cortan la racha; clases sueltas como quien ocupa un lugar (`tipo = 'suelta'`).

#### Entrega 1 — base (rama `fase-1/asistencia`) — ⏳ implementada, falta que Facu pruebe
- [x] Evaluación inicial visible en la ficha de la historia clínica (bug #4). De paso, etiquetas de la ficha en `text-xs` (antes `text-[10px]`).
- [x] Guardados que no duplican: id generado al abrir el formulario (`nuevoId()`) en pacientes y turnos RPG; 23505 con el mismo id = ya estaba guardado (`insertarSinDuplicar` en `queries.ts`). `createClaseTPA` como upsert sobre `(fecha, hora)`. `createHorarioTPA` reintentable (23505 = ya inscripto).
- [x] Timeout: 15 s lecturas, 45 s escrituras (`src/lib/tiempo-maximo.ts`). Si se corta una escritura: "La conexión tardó demasiado y no sabemos si se guardó…" (`mensajeErrorAlGuardar`). Verificado con tests contra el `postgrest-js` real.
- [x] `estadoAsistencia()` en `estados.ts`: un estado desconocido se muestra en gris con su nombre, no rompe (necesario para la ventana entre la migración única y el merge de la entrega 2).
- [x] Sin el fallback `PGRST204` de `deactivateHorarioTPA`.
- [x] Vitest (`npm test`) con tests de `armarSemanaTPA`, `diaTPAInicial`, cortes por tiempo, `nuevoId` y `estadoAsistencia`.
- [ ] **Probar** (Facu) y deployar a producción **antes** de aplicar la migración de la entrega 2.

#### Entrega 2 — faltas y lugares (rama `fase-1/faltas-y-lugares`)
- [ ] Estados nuevos: Avisó C.T. / Avisó S.T. / No avisó; contador de lugares (los que avisaron no ocupan) y marcador "Libre".
- [ ] Avisos anticipados en clases futuras con sugerencia C.T./S.T. visible (sin sugerencia en clases pasadas); sin "Presente" ni "No avisó" a futuro.
- [ ] `fecha_alta` editable al inscribir (reemplaza a `created_at` en `eraFijoEn`).
- [ ] `eliminarClaseTPASiVacia` no borra clases canceladas ni con quien ocupa un lugar.
- [ ] Script de borrado de la asistencia de prueba + **migración única** (diseño, secciones 4 y 5). Orden: entrega 1 en producción → script → migración → probar preview → merge el mismo día.
- [ ] Tests del contador.

#### Entrega 3 — ocupar lugares y recuperaciones (🔒 bloqueada por las preguntas a Pau)
- [ ] Ocupar lugar con sugerencias (recupera / cambio / suelta), cambio de horario como una sola acción.
- [ ] Función transaccional `guardar_clase_tpa` (migración propia).
- [ ] `calcularRecuperaciones()` + tests; pestaña Recuperaciones, "Buscar lugar", "Copiar lista".

#### Entrega 4 — cierre de clase, notas y alertas
- [ ] "Marcar el resto como presente" (solo clases que ya empezaron; no pisa avisos).
- [ ] Cancelar una clase entera (feriado, no puede) en un toque.
- [ ] Notas de evolución (`notas_evolucion`, migración propia): campo en el modal, pestaña Evolución, nota libre.
- [ ] Alerta de 2 faltas seguidas sin aviso + tests.
- [ ] Sacar las alertas por palabra clave (bug #5).

### Modelo de la grilla TPA + celular primero (rama `fase-1/vista-celular`) — ✅ mergeado
- [x] **Grilla de cada semana con lo que pasó esa semana** (N2): `armarSemanaTPA()` en `src/lib/tpa.ts` = fijos **de esa fecha** + quienes tienen asistencia registrada (recupera, vino de otro horario, ex fijos). Única función usada por la grilla de la compu y la lista del celular.
- [x] `20261019000001_horarios_tpa_fecha_baja.sql` **aplicada** (verificado con el MCP el 20/10/2026). El fallback de `deactivateHorarioTPA` se borró en la entrega 1.
- [x] **Horarios reales** en una constante (`HORARIOS_TPA`): lunes y miércoles 10:30, 11:30, 12:30, 16, 17, 18, 19; viernes igual sin 19. Un horario fuera de esa lista aparece solo si tiene fijos o una clase registrada ("fuera de horario").
- [x] **Cupo 4** en una constante (`CUPO_TPA`), mostrado como "3/4" (pendiente de confirmar con Pau, pregunta 2).
- [x] **TPA en celular:** selector de día (Lun / Mié / Vie, abre en el día de hoy o el próximo) + lista de horarios como cards.
- [x] **RPG en celular:** lista de la semana (martes y jueves) con navegación por semana; calendario mensual solo en la compu.
- [x] **Pacientes en celular:** cards en lugar de la tabla; ficha en pantalla completa con Guardar fijo abajo (`PacienteFormModal`).
- [x] **Modales** (paciente, turno, clase TPA, historia clínica) en hoja desde abajo o pantalla completa, con pie fijo (`src/components/ui/Modal.tsx`).
- [x] Ninguna página con desplazamiento lateral en 390px (`min-w-0` en la columna de contenido, márgenes de DESIGN.md, contenido centrado).
- [x] Barra inferior respetando el área segura del iPhone (N11): `viewportFit: cover` + `env(safe-area-inset-bottom)`.
- [x] Modal TPA: el botón Guardar se habilita solo si hay cambios (incluido pasar todos a "Sin marcar"); al inscribir/desinscribir no cambia de pestaña ni pierde las marcas (resto de N3).
- [x] Cargas que fallan siempre avisan (`useDatos` + `EstadoCarga` con "Reintentar"), timeout de 15 s en las peticiones, franja "Sin conexión" y recarga al volver con "atrás" a una página guardada por el navegador (bfcache).
- [ ] Pagos en celular: la tabla se desplaza dentro de su card (la página no). Rediseño con el modelo de pagos (Fase 2).

### Decisión: notas de evolución en una tabla propia (Facu, 19/10/2026)
Las notas van en **`notas_evolucion`**, **nunca en `asistencia_tpa.nota`**. Motivo: "Sin marcar" borra la fila de asistencia (y la clase si queda vacía), así que una nota guardada ahí se perdería. `asistencia_tpa.nota` queda sin uso (se puede borrar más adelante, previa revisión de que no tenga datos).

### Notas de evolución (prioridad #1 funcional) — van en la entrega 4 de asistencia TPA
- [x] Diseño de la tabla `notas_evolucion` (diseño, sección 6.2). Pau no quiere marcas rápidas (presión, dolor): solo texto libre.
- [ ] En el modal de asistencia TPA: campo de nota por alumno, guardado en `notas_evolucion` (no en `asistencia_tpa.nota`).
- [ ] En el turno RPG: la nota existe; mostrarla como "evolución" en la historia clínica (sin tocar RPG).
- [ ] Poder agregar una nota libre desde la historia clínica.
- [ ] Pestaña "Evolución" en la historia clínica: notas + asistencias en una sola línea de tiempo.
- [ ] **Sacar las alertas por palabra clave** (hoy dicen "sesiones más recientes" pero buscan en todo el historial, bug #5). Rehacerlas en Fase 3.

### Pantalla "Inicio" (después de las notas de evolución)
Reemplaza a `/rpg` como entrada de la app (`/` y el destino después del login). La sección "Hoy" se puede adelantar si conviene.
- [ ] **(a) Hoy:** martes y jueves, los turnos RPG del día; lunes, miércoles y viernes, las clases TPA del día con su ocupación ("3/4") y botón "Registrar asistencia" (abre el mismo modal). Las clases de hoy que ya pasaron y no tienen asistencia, destacadas.
- [ ] **(b) Para atender:** clases de días anteriores sin asistencia registrada, pagos pendientes del mes y alertas clínicas recientes (cuando existan las notas de evolución).
- [ ] **(c) Esta semana:** turnos RPG, lugares libres en TPA y pacientes activos RPG / TPA.
- Reutilizar `armarSemanaTPA` / `TpaHorarioCard` y `TurnoCard`; en el celular, una sola columna en ese orden.
### TPA
- [ ] **Agregar alumno no fijo a una clase** (recupera / viene de otro horario / suelta): entrega 3 de asistencia TPA. Hoy `recupera` y `vino_otra_clase` solo se pueden asignar a fijos de ese horario.
- [ ] Horarios y cupo **editables por Pau** desde la app (hoy constantes en `src/lib/tpa.ts`; alcanza si no cambian seguido).
- [ ] **Controlar el cupo al inscribir** (N7): hoy solo se avisa en la pestaña "Alumnos fijos" cuando ya hay 4 fijos; no se impide.
- [x] Poder volver un estado a "sin marcar"; no crear una clase vacía si todo queda pendiente (bug #2, Fase 0.5).
- [ ] Botón "Marcar el resto como presente" en el registro rápido (entrega 4).
- [ ] Cancelar una clase entera (feriado, enfermedad) en un toque (entrega 4).

### RPG
- [ ] Tipo de sesión como lista (RPG, masajes, evaluación inicial; editable), no texto libre con default "RPG".
- [ ] Botón eliminar turno (la query `deleteSesionRPG` existe, no hay UI).
- [x] El tooltip de `TurnoCard` decía "Mes pagado/pendiente"; ahora "Sesión: pagado/pendiente" (Fase 0.5).
- [ ] Crear paciente nuevo rápido desde el modal de turno.

### Historia clínica
- [x] Mostrar **Evaluación inicial** (bug #4, entrega 1).
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
- [ ] Partir componentes > 300 líneas: quedan `HistoriaClinicaModal` y `pagos/page` (`TpaClaseModal` y `pacientes/page` se partieron en Fase 1).
- [ ] Resto de componentes UI base en `src/components/ui/` (Button, Input, Modal, Badge).
- [ ] Instalar `tw-animate-css` o quitar las clases `animate-in` (bug #8).
- [ ] Limpiar `globals.css` (variables Geist sin uso) y el comentario suelto en `layout.tsx`.
- [x] `TpaWeeklyView`: calcular fechas con `addDays` en lugar de sumar milisegundos (Fase 0.5).
- [x] Manejo de errores visible en las cargas: Toast de error en todas las pantallas (Fase 0.5).
- [ ] Historia clínica: datos del paciente anterior si falla la carga y pestaña que no se resetea (N8). Los estados ya no se muestran en crudo (Fase 0.5).
- [x] `CalendarMonthView`: refresco sin `catch`, esqueleto solo en una celda, días de relleno sin turnos (N9) — corregido en Fase 1.
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
13. **Aviso a tus pacientes:** la app guarda sus datos de salud en un servicio en la nube **fuera del país** (Supabase, servidores en Ohio, EE.UU.). En Argentina son datos sensibles (Ley 25.326). ¿Les avisás o les pedís consentimiento (por ejemplo, una línea en la ficha de ingreso)? Conviene resolverlo antes de cargar pacientes reales. No es asesoramiento legal: si hay dudas, consultarlo con un profesional.

14. **Cupo "3/4":** ¿cuenta a quien avisó que falta? Hoy el número suma a todos los que figuran en el horario esa semana (fijos + recuperaciones), aunque hayan avisado o faltado. Si querés ver "lugares libres para recuperar", habría que descontar a los que avisaron.

Para Fase 1 bloquean la 1, 2, 3, 6 y 9; para Fase 2, la 4 y la 5. La 1, la 6 y la 14 tienen criterio por defecto desde el 21/10/2026 (colores como están; sin marcas rápidas en las notas; los que avisaron no ocupan lugar).

### Recuperaciones (21/10/2026) — 🔒 bloquean la entrega 3 de asistencia TPA

Detalle en `docs/DISENO_ASISTENCIA_TPA.md`, sección 10.

15. Cuando **vos** cancelás la clase (feriado, no podés), ¿los fijos tienen derecho a recuperarla? ¿Cuenta dentro del tope del mes (1, 2 o 3)?
16. El **cambio de horario puntual** ("viene a las 18") y el **adelanto** (recuperar antes de faltar), ¿cuentan como recuperaciones del mes?
17. Una falta de **fin de mes**, ¿se puede recuperar el mes siguiente?
18. Si alguien queda **anotado para recuperar y no viene**, ¿pierde esa recuperación?
19. Las **24 h** para "con tiempo", ¿son exactas desde la hora de la clase, o alcanza con avisar el día anterior?
20. El **tope** (según cuántas veces por semana viene), ¿aplica igual a los que avisaron **sin tiempo**?

## Bugs detectados

| # | Fase | Dónde | Problema |
|---|---|---|---|
| N1 | 0 | base | Todas las FK son `ON DELETE CASCADE`: borrar un paciente borra toda su historia. ✅ Línea base corregida. Se mantiene por ahora (borrado con confirmación); 🔴 baja lógica + `RESTRICT` antes de la carga real. |
| 9 | 0 | Supabase | Políticas RLS "permitir todo a público": la anon key da acceso total. Migración escrita, falta aplicarla. |
| N7 | 0 ✅ / 1 | base (`horarios_tpa`) | Unique parcial aplicado en Fase 0. El cupo todavía no se controla al inscribir (solo aviso, Fase 1). |
| N6 | 0 (bloqueante carga) | `pacientes/page.tsx:107` | No hay baja de pacientes; editar fuerza `activo: true`; inactivos no aparecen en `TurnoModal`. |
| N13 | 0 | raíz | `.gitignore` no ignoraba `respuesta.md`. ✅ Corregido. |
| N14 | 0 | `package.json` | `@supabase/ssr` ya instalado y sin usar: se usa para el login. |
| 1 | 0.5 ✅ | `TpaWeeklyView` / `TpaClaseModal` | **Corregido en Fase 0.5** (`normalizarHora` + `conHora` en queries). Era: horas `"HH:mm:ss"` de la base vs `"HH:mm"` de la grilla → filas duplicadas (una `08:00` vacía y otra `08:00:00` con los alumnos); si inscribís desde la fila `08:00`, el alumno "salta" a la otra. **Riesgo futuro (hoy no reproducible):** asistencia que se guarda pero no se ve, y error de unique al re-guardar una clase, en cuanto se puedan agregar no fijos o se normalice a medias. |
| N10 | 0.5 ✅ | `TurnoModal.tsx:50` | La hora llega como `"HH:mm:ss"` al `<input type="time">`. Mismo origen que #1. |
| 6 | 0.5 ✅ / 3 | `Header` | Campana falsa: sacada en 0.5. Buscador que no busca: Fase 3. |
| N2 | 1 ✅ | TPA | Cualquier semana mostraba los fijos **de hoy**. Corregido con `armarSemanaTPA` (+ `20261019000001`, aplicada). |
| N3 | 1 ✅ | `TpaClaseModal` | Copia congelada (0.5) y pérdida de pestaña/marcas al inscribir (Fase 1): corregidos. |
| 2 | 0.5 ✅ | `TpaClaseModal` | Volver a "pendiente" no se guardaba y se creaba una clase vacía. Corregido en 0.5. |
| 4 | 1 ✅ | `HistoriaClinicaModal` | No mostraba `evaluacion_inicial`. Corregido en la entrega 1 de asistencia. |
| N15 | 1 ✅ | `queries.ts` / `supabase.ts` | Timeout de 15 s en todo: con mala señal, un alta podía llegar a la base, la app decía "No se pudo guardar" y al reintentar se duplicaba el paciente o el turno. Corregido en la entrega 1 (ids generados al abrir + 45 s para escrituras). |
| N16 | — | `package.json` | `npm audit`: `next` 16.2.6 tiene un aviso **crítico** (corregido en ≥ 16.3.8) y hay 12 altos en dependencias de compilación. Actualizar Next en una tarea aparte (probar build y deploy). |
| 5 | 1 / 3 | `HistoriaClinicaModal` | Alertas por palabra clave sobre **todo** el historial, aunque el texto dice "recientes". |
| N11 | 1 ✅ | `Navigation` | Área segura del iPhone con `env(safe-area-inset-bottom)` + `viewportFit: cover`. |
| 7 | 2 | `pagos/page` | Precios hardcodeados; mezcla RPG (por sesión) con mensual. |
| N4 | 2 | `pagos/page.tsx:43, 51` | `setMonth()` saltea meses los días 29–31. |
| N5 | 2 | `pagos/page.tsx:255` | `onBlur` crea un pago sin cambios; precio `0` = vacío. |
| 8 | 4 | Global | Clases `animate-in` sin plugin instalado → no animan. |
| N8 | 4 | `HistoriaClinicaModal` | Datos del paciente anterior si falla la carga; estados en crudo; pestaña no se resetea. |
| N9 | 1 ✅ | `CalendarMonthView` | Refresco sin `catch`, esqueleto en una celda, días de relleno sin turnos: corregidos al pasar la carga a `AgendaRPG` + `useDatos`. |
| N12 | 4 | `TpaClaseModal.tsx:129-131` | Día derivado del texto "Miércoles"; frágil. |
| 3 | — | `TpaClaseModal` | ~~Clases duplicadas~~ **Descartado:** existe `unique (fecha, hora)`. |
