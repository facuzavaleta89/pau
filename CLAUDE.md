# CLAUDE.md — PAU Kinesio

App web de gestión para el consultorio de **Pau, kinesióloga**. Reemplaza los Word mensuales donde anota turnos, asistencia, pagos y observaciones clínicas.

Antes de trabajar, leé en este orden:
1. **PENDIENTES.md** — qué falta, en qué fase estamos y preguntas abiertas.
2. **REQUISITOS.md** — qué pidió Pau, con sus palabras.
3. **DESIGN.md** — sistema de diseño (obligatorio para cualquier cambio visual).

---

## Usuaria y contexto

- Una sola usuaria: Pau. Usa la app **principalmente desde el celular**, entre clases.
- Prioridad: que registrar una clase o una nota lleve **segundos**, con pocos toques.
- La app guarda **datos de salud** (historia clínica). Son datos sensibles: nunca exponerlos sin autenticación, nunca loguearlos en consola en producción, nunca commitear datos reales ni claves.

## Dominio

| Término | Significado |
|---|---|
| **RPG** | Reeducación Postural Global. Sesiones **individuales**, martes y jueves. Se paga **por sesión**. Tipos: RPG, masajes, evaluación inicial. |
| **TPA** | Terapia Postural Activa. Clases **grupales**, lunes, miércoles y viernes, horarios fijos con cupo (hoy 4). Se paga **plan mensual** según veces por semana. |
| **Horario fijo** | Alumno inscripto todas las semanas en un día/hora de TPA (`horarios_tpa`). |
| **Clase** | Una ocurrencia concreta de TPA en una fecha (`clases_tpa`). Se crea al registrar asistencia. |
| **Recupera** | Alumno que faltó otro día y viene a este horario a recuperar. **No es fijo de este horario.** |
| **Vino de otra clase** | Alumno que cambió su horario puntualmente esta semana. **No es fijo de este horario.** |
| **Nota de evolución** | Observación clínica clase a clase (bajó la presión, dolor, avance en un ejercicio). Es lo más importante que pidió Pau. |

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript estricto
- Tailwind CSS v4 (config en `src/app/globals.css`, no hay `tailwind.config`)
- Supabase (PostgreSQL) vía `@supabase/supabase-js`, hoy **solo desde el cliente**
- `date-fns` v4 con locale `es`, `lucide-react` para íconos

> Next 16 y Tailwind 4 tienen cambios respecto de versiones anteriores. Ante la duda, consultar la documentación en `node_modules/next/dist/docs/` o la oficial antes de asumir APIs viejas.

## Comandos

```bash
npm run dev          # desarrollo en localhost:3000
npm run build        # build de producción
npm run lint         # ESLint
npx tsc --noEmit     # chequeo de tipos
```

Variables de entorno en `.env.local` (nunca commitear): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Estructura

```
src/
├── app/                      # rutas: /rpg, /tpa, /pacientes, /pagos ( / redirige a /rpg )
├── components/
│   ├── layout/               # Header, Navigation
│   ├── pacientes/            # HistoriaClinicaModal (compartido entre módulos)
│   ├── rpg/                  # CalendarMonthView, TurnoCard, TurnoModal
│   └── tpa/                  # TpaWeeklyView, TpaClaseModal
├── lib/
│   ├── supabase.ts           # cliente Supabase
│   └── queries.ts            # TODAS las operaciones con la DB
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

Proyecto Supabase: **`pau`** (ref `dmwtoozbctnwccaaitos`), en la organización de gaiozavaleta@gmail.com.

El esquema actual está en **`supabase/migrations/20260520000000_esquema_inicial.sql`** (línea base reconstruida leyendo la base; **no se ejecuta** contra el proyecto existente). **Todo cambio de esquema va en un archivo de migración nuevo** con fecha posterior, nunca a mano en el dashboard sin registrarlo.

⚠️ Las columnas `hora` son tipo `time`: la base devuelve `"HH:mm:ss"`. ⚠️ Hoy las políticas RLS permiten todo a cualquiera (ver PENDIENTES.md, Fase 0).

Estados válidos:
- `asistencia_tpa.estado`: `presente | aviso_ausencia | falto_sin_avisar | recupera | vino_otra_clase | cancelado | pendiente`
- `sesiones_rpg.estado_pago`: `pagado | pendiente`
- `sesiones_rpg.estado_sesion`: `realizada | cancelada | pendiente`

## Convenciones de código

- TypeScript estricto, **sin `any`** (usar `unknown` + narrowing para errores).
- Tipos en `src/types/index.ts`. Queries solo en `src/lib/queries.ts`; nunca llamar a Supabase desde componentes.
- Utilidades compartidas en `src/lib/` (por ejemplo `cn()` va en `src/lib/utils.ts`, no en Navigation).
- Etiquetas y colores de estados definidos **una sola vez** (`src/lib/estados.ts`) y reutilizados en toda la app.
- Horas siempre normalizadas a `"HH:mm"` antes de comparar (Postgres `time` devuelve `"HH:mm:ss"`).
- Fechas con `date-fns` (`addDays`, no sumar milisegundos).
- Componentes funcionales, props con `interface`, un componente por archivo, idealmente < 150 líneas.
- Nada de `alert()` / `confirm()` nativos: usar componentes de toast y de confirmación propios.
- Todo lo visual sigue **DESIGN.md**.

## ⚠️ Cómo responder: siempre en `respuesta.md`

Facu no puede copiar texto desde la consola. Por eso **toda respuesta, informe, plan, pregunta o devolución va escrita en el archivo `respuesta.md` en la raíz del repo**, que se **sobreescribe completo** en cada respuesta (no se acumula historial).

- Lo que escribas en la consola no lo va a leer: si algo es importante, tiene que estar en `respuesta.md`.
- El archivo tiene que entenderse solo, sin el contexto de la consola: qué hiciste, qué encontraste, qué archivos tocaste, qué tiene que hacer él y qué preguntas le hacés.
- Formato: Markdown, con títulos y listas cortas. Las preguntas, numeradas, para que pueda responderlas por número.
- En consola alcanza con una línea: "Listo, ver respuesta.md".
- `respuesta.md` está en `.gitignore`: no se commitea.

## Flujo de trabajo para el agente

1. Al empezar una sesión, leer PENDIENTES.md y decir (en `respuesta.md`) en qué tarea vas a trabajar.
2. Trabajar **una fase o tarea por vez**. Para tareas grandes, presentar un plan corto antes de tocar código.
3. Ante decisiones de producto o de arquitectura (sobre todo si dependen de Pau), plantear opciones con pros y contras y **preguntar**; no inventar reglas de negocio.
4. Antes de dar una tarea por terminada: `npx tsc --noEmit` y `npm run lint` sin errores nuevos, y probar el flujo en viewport de celular (390px).
5. Al terminar: actualizar PENDIENTES.md (tildar lo hecho, agregar lo descubierto) y reportar en `respuesta.md` qué funciona, qué no y qué se podría mejorar.
6. No instalar dependencias nuevas sin decir cuáles y para qué.
7. Si ves algo mal en código existente, mencionarlo aunque no sea parte de la tarea.
