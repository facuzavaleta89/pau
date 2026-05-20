<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md — Sistema de Gestión Consultorio PAU

Este archivo define el contexto, estructura y reglas del proyecto para cualquier agente de IA que trabaje sobre el código.

---

## Descripción del proyecto

App web para gestión de consultorio kinesiológico. La profesional maneja dos tipos de actividad:

- **RPG**: sesiones individuales, martes y jueves.
- **TPA**: clases grupales, lunes, miércoles y viernes.

La app cubre agenda, asistencia, historia clínica y pagos, todo conectado entre sí.

---

## Stack tecnológico

- **Framework**: Next.js (App Router)
- **Lenguaje**: TypeScript (estricto)
- **Estilos**: Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL)
- **Cliente DB**: `@supabase/supabase-js`
- **Fechas**: `date-fns`

---

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx           # Layout raíz con navegación
│   ├── page.tsx             # Pantalla principal / redirect
│   ├── rpg/
│   │   └── page.tsx         # Módulo agenda RPG
│   └── tpa/
│       └── page.tsx         # Módulo agenda TPA
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Navigation.tsx
│   ├── pacientes/
│   │   └── HistoriaClinicaModal.tsx  # Modal historia clínica (compartido)
│   ├── rpg/
│   │   ├── CalendarMonthView.tsx
│   │   ├── TurnoCard.tsx
│   │   └── TurnoModal.tsx
│   └── tpa/
│       └── TpaWeeklyView.tsx
├── lib/
│   ├── supabase.ts          # Cliente Supabase (no modificar)
│   └── queries.ts           # Todas las operaciones con la DB
└── types/
    └── index.ts             # Tipos TypeScript mapeados a tablas Supabase
```

---

## Base de datos (Supabase)

### Tablas disponibles

| Tabla | Descripción |
|---|---|
| `pacientes` | Ficha completa del paciente |
| `sesiones_rpg` | Turnos individuales (mar/jue) |
| `horarios_tpa` | Horario fijo semanal por alumno |
| `clases_tpa` | Cada clase real generada |
| `asistencia_tpa` | Estado de asistencia por alumno por clase |
| `pagos` | Plan, precio y estado de pago mensual |
| `lista_espera` | Cola de espera por tipo de clase |

### Estados válidos — asistencia_tpa

```
'presente' | 'aviso_ausencia' | 'falto_sin_avisar' |
'recupera' | 'vino_otra_clase' | 'cancelado' | 'pendiente'
```

### Estados válidos — sesiones_rpg

```
estado_pago:   'pagado' | 'pendiente'
estado_sesion: 'realizada' | 'cancelada' | 'pendiente'
```

---

## Convenciones de código

### General
- Siempre TypeScript estricto. Sin `any`.
- Todos los tipos van en `src/types/index.ts`.
- Todas las queries a Supabase van en `src/lib/queries.ts`. Nunca llamar a Supabase directamente desde componentes o páginas.
- Importar el cliente siempre desde `@/lib/supabase`.

### Componentes
- Componentes funcionales con hooks. Sin class components.
- Props tipadas con `interface`, no `type`.
- Un componente por archivo.
- Si un componente supera las 150 líneas, dividirlo.

### Estilos
- Solo Tailwind CSS. Sin CSS modules ni estilos inline salvo casos excepcionales.
- La app debe ser **responsive y usable desde celular** en todo momento.

### Estructura de archivos nuevos
- Componentes de un módulo van en `src/components/[modulo]/`.
- Páginas nuevas van en `src/app/[ruta]/page.tsx`.
- No crear carpetas nuevas de primer nivel sin consultar.

---

## Módulos de la app

### 1. Agenda RPG (`/rpg`)
- Vista mensual navegable (mes anterior / siguiente).
- Días activos: martes y jueves.
- Cada turno: hora, paciente, tipo de sesión, estado de pago, estado de sesión.
- Tocar nombre → abre `HistoriaClinicaModal`.
- Tocar turno → abre `TurnoModal` para editar.
- Botón para agregar nuevo turno.

### 2. Agenda TPA (`/tpa`)
- Vista semanal con grilla: filas = horarios, columnas = alumnos por horario.
- Días activos: lunes, miércoles y viernes.
- Colores por estado de asistencia (ver estados válidos arriba).
- Tocar horario → modal con checklist rápido de asistencia.
- Tocar nombre → abre `HistoriaClinicaModal`.
- Toggle a vista mensual tipo calendario.
- Lista de espera por turno.

### 3. Historia Clínica (modal compartido)
- Se abre desde cualquier módulo al tocar un nombre.
- Secciones: datos básicos, datos clínicos, historial de sesiones, alertas.
- El historial se genera desde `sesiones_rpg` y `asistencia_tpa`.
- Alertas automáticas:
  - ⚠️ Faltó 3 veces seguidas.
  - ⚠️ Nota reciente contiene "presión".
  - ⚠️ Nota reciente contiene "lesión" o "dolor".

### 4. Pagos (`/pagos`)
- Lista de pacientes con plan, precio y estado del mes.
- Toggle rápido pagado/pendiente.
- Resumen del mes: total cobrado, total pendiente, deudores.

---

## Sistema de diseño

### Principio fundamental
**La funcionalidad es prioridad absoluta.** Nada decorativo puede romper, esconder o complicar una acción del usuario. Dicho esto, el diseño no es opcional: esta app debe sentirse **premium, moderna y profesional** en cada pantalla.

La app es para un consultorio de kinesiología. El diseño debe transmitir **pulcritud, orden, confianza y profesionalismo clínico**. La paleta es light mode con fondo hueso/tiza y acento teal, que es el color dominante en el rubro kinesiológico/fisioterapéutico: transmite calma, claridad mental y salud.

La consistencia visual es la regla de oro. Antes de crear cualquier componente nuevo, revisar si ya existe uno similar y reutilizarlo o extenderlo. **Nunca inventar un patrón visual nuevo si ya hay uno establecido.**

---

### Paleta de colores

Usar exclusivamente estos tokens. No introducir colores fuera de esta paleta sin consultar.

```
// Fondos (light mode — nunca bg-white puro)
bg-stone-50        → fondo raíz de la app (blanco hueso/tiza)
bg-white           → fondo de cards, modales y paneles elevados
bg-stone-100       → fondo de elementos secundarios, hover suave, inputs

// Textos
text-stone-900     → títulos y texto principal
text-stone-600     → texto secundario, labels, metadata
text-stone-400     → texto deshabilitado, placeholders

// Acento principal — TEAL
bg-teal-600        → botones primarios, elementos activos, highlights
hover:bg-teal-700
text-teal-600      → links, íconos activos, valores destacados
bg-teal-50         → fondos suaves con acento (chips, badges activos)
border-teal-200    → bordes con acento suave

// Bordes
border-stone-200   → bordes de cards y contenedores
border-stone-300   → bordes en hover o foco
divide-stone-100   → divisores internos en listas

// Estados de asistencia TPA (consistentes en toda la app)
presente          → bg-emerald-50   text-emerald-700  border-emerald-200
aviso_ausencia    → bg-amber-50     text-amber-700    border-amber-200
falto_sin_avisar  → bg-red-50       text-red-700      border-red-200
recupera          → bg-blue-50      text-blue-700     border-blue-200
vino_otra_clase   → bg-teal-50      text-teal-700     border-teal-200
cancelado         → bg-stone-100    text-stone-400    border-stone-200
pendiente         → bg-stone-50     text-stone-400    border-stone-200

// Estados de pago
pagado            → text-emerald-600
pendiente         → text-amber-600

// Alertas clínicas
⚠️ warning        → bg-amber-50    text-amber-800   border-amber-200
```

---

### Tipografía

```
// Fuente: Inter (sans-serif, ya incluida en Next.js)

// Jerarquía
Título de página   → text-2xl font-semibold text-stone-900
Título de sección  → text-xs font-semibold text-stone-400 uppercase tracking-wider
Título de card     → text-base font-medium text-stone-900
Texto de cuerpo    → text-sm text-stone-700
Metadata / label   → text-xs text-stone-400
```

---

### Espaciado y layout

- Padding de páginas: `px-4 py-6` en mobile, `px-6 py-8` en desktop.
- Gap entre cards: `gap-3` en mobile, `gap-4` en desktop.
- Padding interno de cards: `p-4` consistente.
- Bordes redondeados: `rounded-xl` para cards y modales, `rounded-lg` para elementos internos, `rounded-md` para botones e inputs.
- Sombras: `shadow-sm` para cards en reposo, `shadow-md` para cards en hover o modales. Preferir sombras suaves sobre bordes gruesos.

---

### Componentes base — patrones obligatorios

#### Cards
```
bg-white border border-stone-200 rounded-xl p-4 shadow-sm
hover:shadow-md hover:border-stone-300 transition-all duration-150
```

#### Botones primarios
```
bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium
px-4 py-2 rounded-lg transition-colors duration-150
```

#### Botones secundarios
```
bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium
px-4 py-2 rounded-lg border border-stone-200 hover:border-stone-300
transition-colors duration-150
```

#### Botones destructivos
```
bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium
px-4 py-2 rounded-lg border border-red-200 transition-colors duration-150
```

#### Inputs y selects
```
bg-white border border-stone-200 text-stone-900 text-sm
px-3 py-2 rounded-lg placeholder:text-stone-400
focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20
transition-colors duration-150
```

#### Modales
```
// Overlay
fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50

// Contenedor
bg-white border border-stone-200 rounded-2xl shadow-xl
w-full max-w-lg mx-4 (mobile) / max-w-2xl (desktop)
max-h-[90vh] overflow-y-auto
```

#### Badges de estado
```
inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
(aplicar colores según tabla de estados arriba)
```

---

### Íconos

Usar exclusivamente `lucide-react`. Tamaño estándar: `size={16}` para íconos inline, `size={20}` para íconos de acción. Color por defecto: `text-stone-400`, activo: `text-teal-600`. No mezclar con otras librerías de íconos.

---

### Animaciones y transiciones

- Todas las transiciones: `transition-all duration-150`.
- Aparición de modales: `animate-in fade-in-0 zoom-in-95 duration-200`.
- No usar animaciones complejas que puedan percibirse como lentas en mobile.

---

### Reglas de consistencia visual (no negociables)

1. **Un componente = un estilo.** Si `TurnoCard` tiene cierto look, todos los elementos similares deben verse igual. No crear variantes ad-hoc.
2. **Los colores de estado son globales.** El verde de "presente" en TPA es el mismo verde que "pagado" en pagos. No inventar nuevos colores para el mismo tipo de información.
3. **Light mode siempre.** El fondo raíz es `bg-stone-50`. Las cards van sobre `bg-white`. Nunca invertir esta jerarquía.
4. **Espaciado consistente.** No usar valores de padding/margin arbitrarios. Ceñirse a la escala de Tailwind (múltiplos de 4px).
5. **Siempre feedback visual.** Todo elemento interactivo debe tener estado hover y, si aplica, estado de carga (skeleton o spinner). El usuario nunca debe quedarse sin saber si algo está procesando.
6. **Mobile first.** Diseñar primero para pantalla de 390px, luego escalar a desktop. Nunca al revés.

---

## Reglas para el agente

### Flujo de trabajo
1. **Esperar confirmación entre tareas.** No avanzar al siguiente módulo o funcionalidad sin que el usuario lo indique.
2. **Archivos completos siempre.** Si modificás un archivo, devolvé el contenido completo, no fragmentos.
3. **Revisión obligatoria al terminar cada tarea.** Después de completar cualquier tarea, revisar el código producido y los archivos relacionados, y reportar al usuario: (a) si hay algo que no funciona correctamente, (b) si hay algo que puede mejorarse técnicamente, (c) si hay algo que puede mejorarse visualmente. No corregir nada sin aprobación, solo reportar.
4. **No modificar `lib/supabase.ts`** salvo que se lo pidan explícitamente.
5. **No instalar dependencias nuevas** sin mencionar cuáles y para qué.
6. **No crear rutas ni carpetas nuevas** fuera de la estructura definida sin consultar.
7. **Ante una duda de arquitectura**, plantear las opciones con pros y contras antes de implementar.
8. Si algo del código existente está mal o puede mejorar, **mencionarlo** aunque no haya sido pedido. No corregirlo sin avisar.

### Diseño
9. **Funcionalidad primero, siempre.** Ninguna decisión estética puede comprometer que algo funcione correctamente.
10. **Seguir el sistema de diseño al pie de la letra.** No introducir colores, tipografías, radios o espaciados fuera de los definidos en este archivo.
11. **Consistencia sobre creatividad.** Si ya existe un patrón visual en el proyecto, replicarlo. No inventar variantes nuevas.
12. **Light mode siempre.** El fondo raíz es `bg-stone-50`. Las cards van sobre `bg-white`. Sin excepciones.
13. **Todo elemento interactivo necesita estado hover y feedback de carga.** Sin excepción.
14. Antes de crear un componente visual nuevo, verificar si puede reutilizarse o extenderse uno existente.
<!-- END:nextjs-agent-rules -->
