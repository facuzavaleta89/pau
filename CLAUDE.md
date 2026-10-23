# CLAUDE.md — PAU Kinesio

App web de gestión para el consultorio de **Pau, kinesióloga**. Reemplaza los Word mensuales donde anota turnos, asistencia, pagos y observaciones clínicas.

Antes de trabajar, leé en este orden:
1. **PENDIENTES.md** — qué falta, en qué fase estamos y preguntas abiertas.
2. **REQUISITOS.md** — qué pidió Pau, con sus palabras.
3. **DESIGN.md** — sistema de diseño (obligatorio para cualquier cambio visual).
4. **docs/DISENO_ASISTENCIA_TPA.md** — diseño y decisiones de asistencia TPA (faltas, lugares, recuperaciones, notas), si la tarea toca TPA.

---

## Usuaria y contexto

- Una sola usuaria: Pau. Usa la app **sobre todo desde la compu**; el celular tiene que seguir andando bien (lo usa entre clases).
- Lo que más le importa: **las faltas y las recuperaciones** (quién avisó, quién recupera, qué lugares quedan libres). Que cargar una falta, ocupar un lugar o marcar una clase lleve **segundos**, con pocos clics.
- La app guarda **datos de salud** (historia clínica). Son datos sensibles: nunca exponerlos sin autenticación, nunca loguearlos en consola en producción, nunca commitear datos reales ni claves.

## Dominio

| Término | Significado |
|---|---|
| **RPG** | Reeducación Postural Global. Sesiones **individuales**, martes y jueves. Se paga **por sesión**. Tipos: RPG, masajes, evaluación inicial. |
| **TPA** | Terapia Postural Activa. Clases **grupales**, lunes, miércoles y viernes, horarios fijos con cupo (hoy 4). Se paga **plan mensual** según veces por semana. |
| **Horario fijo** | Alumno inscripto todas las semanas en un día/hora de TPA (`horarios_tpa`). |
| **Clase** | Una ocurrencia concreta de TPA en una fecha (`clases_tpa`). Se crea al registrar asistencia, al ocupar un lugar o al cancelarla. |
| **Falta de un fijo** | Avisó C.T. (con tiempo, 24 h o más antes), Avisó S.T. (sin tiempo) o No avisó. El que avisó **libera su lugar**; el que no avisó no recupera. |
| **Lugar** | Cada clase tiene `CUPO_TPA` (4) lugares. Ocupados = fijos que no avisaron + quienes vienen a ocupar un lugar; el resto, **Libre**. |
| **Quien ocupa un lugar** | Alguien que no es fijo de ese horario y viene solo a esa clase (`asistencia_tpa.tipo`): **Recupera** (usa una recuperación), **Cambio de horario** (falta en su horario y viene a este; se marcan juntos) o **Clase suelta** (paga aparte, no usa recuperaciones). Puede ocupar el lugar de un fijo que avisó (`ocupa_lugar_de`) o un lugar libre. |
| **Clase cancelada** | `clases_tpa.motivo_cancelacion`: **Feriado** (recupera solo si le quedan menos de 4 clases en el mes por cada vez por semana) o **Cancelada por Pau** (enfermedad, viaje, corte de luz: todos los fijos la recuperan, sin tope y sin vencimiento). |
| **Recuperación** | Saldo calculado (no guardado) por alumno y por mes: `calcularRecuperaciones()` (`src/lib/recuperaciones.ts`). Reglas en `docs/DISENO_ASISTENCIA_TPA.md`, sección 3.2. |
| **Nota de evolución** | Observación clínica clase a clase (bajó la presión, dolor, avance en un ejercicio). Va en `notas_evolucion` (entrega 4), nunca en `asistencia_tpa.nota`. |

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript estricto
- Tailwind CSS v4 (config en `src/app/globals.css`, no hay `tailwind.config`)
- Supabase (PostgreSQL + Auth) vía `@supabase/supabase-js` y `@supabase/ssr`:
  - **Datos:** desde el navegador, con `createBrowserClient` (`src/lib/supabase.ts`). La sesión vive en cookies.
  - **Sesión:** `src/proxy.ts` (en Next 16 `middleware` pasó a llamarse `proxy`) refresca el token en cada request y redirige a `/login` si no hay sesión. Es un chequeo optimista: **la protección real de los datos es RLS**.
  - Login con email + contraseña, una sola usuaria. Configuración del dashboard en `supabase/AUTH.md`.
- `date-fns` v4 con locale `es`, `lucide-react` para íconos

> Next 16 y Tailwind 4 tienen cambios respecto de versiones anteriores. Ante la duda, consultar la documentación en `node_modules/next/dist/docs/` o la oficial antes de asumir APIs viejas.

## Comandos

```bash
npm run dev          # desarrollo en localhost:3000
npm run build        # build de producción
npm run lint         # ESLint
npx tsc --noEmit     # chequeo de tipos
npm test             # Vitest: tests de las funciones puras de src/lib (*.test.ts)
```

Variables de entorno en `.env.local` (nunca commitear): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Estructura

```
src/
├── proxy.ts                  # sesión: refresca token y redirige a /login (Next 16)
├── app/
│   ├── layout.tsx            # raíz: solo html/body
│   ├── page.tsx              # / redirige a /rpg
│   ├── login/                # pantalla de login (pública)
│   └── (app)/                # grupo de rutas con sesión (no cambia las URLs)
│       ├── layout.tsx        # Navigation + Header + AvisoSinConexion + SesionWatcher + VerificadorAutorizacion
│       └── rpg/ tpa/ pacientes/ pagos/
├── components/
│   ├── auth/                 # LoginForm, SesionWatcher, VerificadorAutorizacion
│   ├── layout/               # Header (con Salir), Navigation, AvisoSinConexion
│   ├── pacientes/            # HistoriaClinicaModal, PacienteFormModal, PacientesTabla (compu),
│   │                         # PacientesListaCelular, EliminarPacienteDialog
│   ├── rpg/                  # AgendaRPG (carga + modales), CalendarMonthView (compu),
│   │                         # RpgSemanaLista (celular), TurnoCard, TurnoModal
│   ├── tpa/                  # TpaAgenda (carga + modales), TpaGrillaSemana (compu), TpaListaDia (celular),
│   │                         # TpaHorarioCard (ambas), TpaAccionesDia, TpaClaseModal (+ useBorradorClase),
│   │                         # TpaAsistenciaLista, TpaAsistenciaFila, TpaOcuparSelector, TpaCancelarDialog,
│   │                         # TpaInscripcion, TpaRecuperaciones, TpaPendientesGrupo, TpaBuscarLugar
│   └── ui/                   # base: Modal, ConfirmDialog, ToastProvider (useToast), ToastItem,
│                             # SemanaNav, EstadoCarga
├── hooks/
│   ├── useDatos.ts           # carga con clave + Toast y estado de error SIEMPRE que falla
│   ├── useEsCelular.ts       # true / false / null (< 768px), sin cargar las dos vistas
│   └── useConexion.ts        # navigator.onLine
├── lib/
│   ├── supabase.ts           # cliente de navegador (createBrowserClient)
│   ├── tiempo-maximo.ts      # fetch con corte: 15 s lecturas, 45 s escrituras
│   ├── supabase-proxy.ts     # cliente de servidor para proxy.ts (actualizarSesion)
│   ├── auth.ts               # TODAS las operaciones de autenticación
│   ├── queries.ts            # TODAS las operaciones con la DB
│   ├── errores.ts            # registrarError / mensajeError / mensajeErrorAlGuardar / ErrorApp
│   ├── estados.ts            # etiquetas, colores e íconos de TODOS los estados
│   ├── horas.ts              # normalizarHora ("HH:mm:ss" → "HH:mm")
│   ├── tpa.ts                # HORARIOS_TPA, CUPO_TPA, DIAS_TPA, armarSemanaTPA, eraFijoEn, contarLugares, celdasEntre
│   ├── avisos.ts             # clase futura, sugerencia C.T./S.T. (hora argentina), avisado_at
│   ├── recuperaciones.ts     # calcularRecuperaciones (saldo por alumno y mes), "Copiar lista"
│   ├── clase-tpa.ts          # borrador del modal de una clase → pedido a guardar_clase_tpa
│   ├── ocupar.ts             # opciones del selector "Ocupar lugar" y "Buscar lugar"
│   └── utils.ts              # cn(), nuevoId()
└── types/index.ts            # tipos mapeados a las tablas
```

## Base de datos (Supabase)

| Tabla | Uso |
|---|---|
| `pacientes` | Ficha / historia clínica |
| `sesiones_rpg` | Turnos individuales (estado_pago, estado_sesion, nota) |
| `horarios_tpa` | Horario fijo semanal por alumno (dia_semana, hora, activo) |
| `clases_tpa` | Clase concreta (fecha, hora) |
| `asistencia_tpa` | Estado por alumno por clase (+ nota). Unique esperado: `(clase_id, paciente_id)` |
| `pagos` | Pago mensual (mes, año, plan, precio, estado) |
| `lista_espera` | Cola de espera (tabla creada, sin UI todavía) |

Proyecto Supabase: **`pau`** (ref `dmwtoozbctnwccaaitos`, región `us-east-2`, plan Free).

Los cambios de **datos** que se corren una sola vez (borrar pruebas) van en `supabase/scripts/`, fuera de `migrations/`, para que `supabase db push` nunca los ejecute.

El esquema actual está en **`supabase/migrations/20260520000000_esquema_inicial.sql`** (línea base reconstruida leyendo la base; **no se ejecuta** contra el proyecto existente). **Todo cambio de esquema va en un archivo de migración nuevo** con fecha posterior, nunca a mano en el dashboard sin registrarlo.

⚠️ Las columnas `hora` son tipo `time`: la base devuelve `"HH:mm:ss"`.

**RLS** (migración `20261017000001_rls_solo_usuaria_autorizada.sql`, aplicada): cada tabla tiene una sola política (`"Solo usuaria autorizada"`): solo el rol `authenticated` y solo si el UID está en `private.usuarias_autorizadas`. `anon` no tiene permisos de tabla. Las políticas de la línea base ya no existen. `public.soy_autorizada()` (migración `20261018000001`) le dice a la app si la usuaria logueada está autorizada. Consecuencias para el código:
- Sin sesión válida (o con un usuario no autorizado) un `select` devuelve `[]` y un `update`/`delete` afecta **0 filas sin error**. Por eso toda escritura en `queries.ts` termina en `.select()` y verifica las filas con `exigirUnaFila()`; no usar `.single()` en escrituras.
- Funciones nuevas en la base: revocar siempre `execute` también `from public`, no solo de `anon`/`authenticated`.

Estados válidos (migración `20261022000001_tpa_faltas_y_lugares.sql`):
- `asistencia_tpa.tipo`: `fijo | recupera | cambio | suelta`
- `asistencia_tpa.estado`: fijo → `presente | aviso_con_tiempo | aviso_sin_tiempo | falto_sin_avisar` (sin marcar = sin fila); quien ocupa un lugar → `pendiente | presente | falto_sin_avisar`. `avisado_at` obligatorio en los avisos y solo en ellos. `ocupa_lugar_de` = fila del fijo de la misma clase que avisó (trigger `validar_asistencia_tpa`).
- `asistencia_tpa.cambio_de` (migración `20261023000001`): solo en `tipo = 'cambio'`, la fila del aviso del mismo alumno en su horario de origen.
- `clases_tpa.motivo_cancelacion`: `null` (se da) `| feriado | cancelada_por_pau`
- Funciones (migración `20261023000001`, security invoker, `execute` solo `authenticated`): `guardar_clase_tpa(p_clases jsonb)` guarda una o varias clases en una transacción; `cambiar_cancelacion_tpa(p_fecha, p_horas, p_motivo)` cancela o reactiva. Sus mensajes de error empiezan con `"TPA: "` y la app los muestra tal cual (`mensajeError`).
- `horarios_tpa.fecha_alta`: desde qué fecha es fijo (inclusive); `fecha_baja` exclusive y `>= fecha_alta`
- `sesiones_rpg.estado_pago`: `pagado | pendiente`
- `sesiones_rpg.estado_sesion`: `realizada | cancelada | pendiente`

## Convenciones de código

- TypeScript estricto, **sin `any`** (usar `unknown` + narrowing para errores).
- Tipos en `src/types/index.ts`. Queries solo en `src/lib/queries.ts` y autenticación solo en `src/lib/auth.ts`; nunca llamar a Supabase desde componentes.
- Errores: nunca `console.error(error)` directo (los errores de Postgres pueden traer filas con datos de salud). Usar `registrarError(contexto, error)` para loguear y `mensajeError(error)` para mostrarle algo a la usuaria; al fallar un guardado, `mensajeErrorAlGuardar('No se pudo guardar X.', error)` (si la escritura se cortó por tiempo, dice que no se sabe si se guardó); para mensajes propios, `throw new ErrorApp('…')` (todo en `src/lib/errores.ts`).
- **Guardados que no duplican:** toda alta nueva lleva un `id` generado al abrir el formulario con `nuevoId()` (`src/lib/utils.ts`) y se inserta con `insertarSinDuplicar()` en `queries.ts`; o un upsert sobre un unique natural. Así, tocar Guardar de nuevo después de un corte no crea dos registros.
- Utilidades compartidas en `src/lib/` (`cn()` en `src/lib/utils.ts`).
- Etiquetas, colores e íconos de estados definidos **una sola vez** en `src/lib/estados.ts` (`ESTADOS_ASISTENCIA`, `ESTADOS_SESION_RPG`, `ESTADOS_PAGO` y sus `ORDEN_*`). Nunca escribir clases de color de un estado a mano en un componente. Para mostrar un estado de asistencia leído de la base, `estadoAsistencia(estado)`: no se rompe con un estado que esta versión no conoce.
- Horas siempre `"HH:mm"` (Postgres `time` devuelve `"HH:mm:ss"`): toda función de `queries.ts` que lee filas con hora las pasa por `conHora()`; las consultas nuevas tienen que hacer lo mismo. Al comparar horas de otro origen, usar `normalizarHora()` (`src/lib/horas.ts`).
- Fechas con `date-fns` (`addDays`, no sumar milisegundos).
- Componentes funcionales, props con `interface`, un componente por archivo, idealmente < 150 líneas.
- **Compu primero.** Cada pantalla se diseña primero para la compu (modales anchos, tablas, grilla). El celular tiene que seguir andando bien: ninguna pantalla puede desplazarse de costado en 390px. Si una vista de compu no entra (grilla, calendario, tabla), se hace una vista de celular aparte y se elige con `useEsCelular()` (si cada vista carga datos distintos) o con `md:hidden` / `hidden md:block` (si usan los mismos datos). Modales con el componente `Modal` (centrado en la compu; hoja desde abajo o pantalla completa en celular, pie fijo).
- **Cargas de datos** con `useDatos()`: si falla, avisa con Toast y la pantalla muestra `EstadoCarga` con "Reintentar". Nunca una pantalla vacía que parezca "no hay datos".
- **TPA:** quién está en cada horario de una semana lo calcula **solo** `armarSemanaTPA()` (fijos de esa fecha + asistencias registradas). No volver a filtrar `horarios_tpa` a mano en un componente. Los saldos de recuperación salen **solo** de `calcularRecuperaciones()`. Una clase se guarda **siempre** con `guardarClasesTPA()` (función `guardar_clase_tpa` de la base, una transacción), nunca fila por fila.
- Nada de `alert()` / `confirm()` nativos: `useToast()` (`toast.exito / error / aviso`) y `ConfirmDialog`. Los errores que se muestran salen de `mensajeError(error)`.
- Todo lo visual sigue **DESIGN.md**.

## ⚠️ Cómo responder: siempre en `respuesta.md`

Facu no puede copiar texto desde la consola. Por eso **toda respuesta, informe, plan, pregunta o devolución va escrita en el archivo `respuesta.md` en la raíz del repo**, que se **sobreescribe completo** en cada respuesta (no se acumula historial).

- Lo que escribas en la consola no lo va a leer: si algo es importante, tiene que estar en `respuesta.md`.
- El archivo tiene que entenderse solo, sin el contexto de la consola: qué hiciste, qué encontraste, qué archivos tocaste, qué tiene que hacer él y qué preguntas le hacés.
- Formato: Markdown, con títulos y listas cortas. Las preguntas, numeradas, para que pueda responderlas por número.
- En consola alcanza con una línea: "Listo, ver respuesta.md".
- `respuesta.md` está en `.gitignore`: no se commitea.

## ⚠️ Git: solo lectura

El control de versiones lo maneja **únicamente Facu**. El agente **nunca** ejecuta comandos de git que modifiquen algo: nada de `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`, `reset`, `checkout`, `switch`, `restore`, `branch`, `tag`, `stash`, `rm`, `mv`, `clean`, ni `gh`. Están bloqueados en `.claude/settings.json`; no intentes rodearlos con variantes (`git -C`, alias, scripts).

- Permitido: `git status`, `git diff`, `git log`, `git show`, `git blame`.
- Para mover o borrar archivos usá comandos del sistema (`mv`, `rm`), nunca `git mv` / `git rm`.

**Flujo de Facu:** trabaja en una rama por tarea (`fase-N/descripcion-corta`). Ejecuta él los comandos de git en su terminal; el pull request y el merge los hace en GitHub.

**Al terminar cada tarea**, cerrá `respuesta.md` con una sección **"Comandos git"** con un único bloque listo para copiar y pegar:

```bash
git status
git add .
git commit -m "<tipo>: <resumen en español>"
git push -u origin <rama-actual>
```

y debajo, en texto: "Después de hacer el merge del PR en GitHub:" con

```bash
git checkout main
git pull origin main
git checkout -b <rama-de-la-siguiente-tarea>
```

`git add .` es seguro porque `.gitignore` excluye `respuesta.md`, `.env*`, `.next/` y `node_modules/`. **Antes de armar los comandos**, corré `git status` (y `git status --ignored` si dudás) y `git branch --show-current`, y revisá que no haya nada que no deba subirse: archivos con datos reales (exportaciones, CSV, backups), claves, archivos temporales. Si aparece algo así, no lo incluyas: agregalo a `.gitignore` o avisale a Facu en `respuesta.md` antes de dar los comandos.

## Base de datos: solo lectura para el agente

- Para leer la base se usa **únicamente** el servidor MCP `supabase` (configurado con `read_only=true`). **Nunca** uses el conector "claude.ai Supabase", que tiene permiso de escritura.
- Los cambios de esquema se escriben como archivos en `supabase/migrations/` y **los aplica Facu** después de revisarlos. El agente nunca los ejecuta contra la base.

## Flujo de trabajo para el agente

1. Al empezar una sesión, leer PENDIENTES.md y decir (en `respuesta.md`) en qué tarea vas a trabajar.
2. Trabajar **una fase o tarea por vez**. Para tareas grandes, presentar un plan corto antes de tocar código.
3. Ante decisiones de producto o de arquitectura (sobre todo si dependen de Pau), plantear opciones con pros y contras y **preguntar**; no inventar reglas de negocio.
4. Antes de dar una tarea por terminada: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npm test` sin errores nuevos. Las funciones puras nuevas con reglas (cálculos de TPA, recuperaciones, alertas) llevan tests en un `*.test.ts` al lado. Si no tenés un navegador conectado para probar en viewport de celular (390px), **no digas que lo probaste**: dejá en `respuesta.md` una lista de pasos de prueba concretos para que Facu los haga en su celular o en el emulador del navegador.
5. Al terminar: actualizar PENDIENTES.md (tildar lo hecho, agregar lo descubierto) y reportar en `respuesta.md` qué funciona, qué no y qué se podría mejorar.
6. No instalar dependencias nuevas sin decir cuáles y para qué.
7. Si ves algo mal en código existente, mencionarlo aunque no sea parte de la tarea.
