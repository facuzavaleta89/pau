# DESIGN.md — Sistema de diseño PAU Kinesio

## Principios

1. **Funcionalidad primero.** Nada decorativo puede esconder, demorar o complicar una acción.
2. **Rápido desde el celular.** Pau registra asistencia y notas entre clases: las acciones frecuentes tienen que estar a 1–2 toques, con objetivos táctiles de **mínimo 44 × 44 px**.
3. **Clínico y calmo.** Pulcritud, orden, confianza. Light mode, fondo hueso, acento teal.
4. **Consistencia sobre creatividad.** Antes de crear un componente, buscar si ya existe uno parecido y reutilizarlo.
5. **Siempre feedback.** Todo lo interactivo tiene hover/active; todo lo que guarda muestra carga y confirma éxito o error (toast).

---

## Paleta (Tailwind)

```
Fondos
  bg-stone-50    fondo raíz (nunca invertir)
  bg-white       cards, modales, paneles
  bg-stone-100   secundarios, hover suave

Texto
  text-stone-900 títulos y texto principal
  text-stone-600 secundario, labels
  text-stone-400 deshabilitado, placeholders

Acento teal
  bg-teal-600 / hover:bg-teal-700   primario, activo
  text-teal-600                     links, íconos activos
  bg-teal-50 / border-teal-200      fondos suaves de acento

Bordes
  border-stone-200 (reposo) · border-stone-300 (hover/foco) · divide-stone-100
```

### Estados de asistencia TPA — fuente única

Definidos **una sola vez** en `src/lib/estados.ts` (label, clases de color, ícono) y usados en grilla, modal e historia clínica. Si esta tabla cambia, se cambia `estados.ts` (y viceversa).

| Estado | Label | Clases |
|---|---|---|
| `presente` | Presente | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `aviso_ausencia` | Avisó | `bg-amber-50 text-amber-700 border-amber-200` |
| `falto_sin_avisar` | Faltó | `bg-red-50 text-red-700 border-red-200` |
| `recupera` | Recupera | `bg-blue-50 text-blue-700 border-blue-200` |
| `vino_otra_clase` | De otro horario | `bg-teal-50 text-teal-700 border-teal-200` |
| `cancelado` | Cancelado | `bg-stone-100 text-stone-500 border-stone-300` |
| `pendiente` | Sin marcar | `bg-white text-stone-600 border-dashed border-stone-400` |

> Pendiente de confirmar con Pau: en su Word usa **rojo para "faltó avisando"**. Si prefiere conservar su código de colores, se cambia solo en `estados.ts`.

Además del color, cada estado lleva **ícono o texto** (accesibilidad: no depender solo del color). Íconos: presente `Check`, avisó `MessageSquare`, faltó `X`, recupera `RotateCcw`, de otro horario `ArrowLeftRight`, cancelado `Ban`, sin marcar `CircleDashed`.

"Sin marcar" usa **borde punteado** sobre blanco: tiene que distinguirse a simple vista del fondo de las cards (`bg-white` / `bg-stone-50`). Antes era `bg-stone-50 text-stone-400` y casi no se veía. "Cancelado" pasó a `text-stone-500 border-stone-300` por contraste.

### Estados de sesión RPG
| Estado | Label | Clases | Ícono |
|---|---|---|---|
| `pendiente` | Pendiente | `bg-white text-stone-700 border-stone-200` | `Clock` |
| `realizada` | Realizada | `bg-emerald-50 text-emerald-700 border-emerald-200` | `CircleCheck` |
| `cancelada` | Cancelada | `bg-stone-100 text-stone-500 border-stone-300` | `CircleX` |

### Pago
- pagado → badge `bg-emerald-50 text-emerald-700 border-emerald-200`, punto `bg-emerald-500`
- pendiente → badge `bg-amber-50 text-amber-700 border-amber-200`, punto `bg-amber-500`
- En RPG el pago es **por sesión**: el texto es "Sesión: pagado / pendiente", nunca "Mes".

### Alertas clínicas
`bg-amber-50 text-amber-800 border-amber-200`, ícono `ShieldAlert`. **Sin `animate-pulse`**: una alerta que titila todo el tiempo cansa y pierde valor.

---

## Tipografía

Fuente: **Inter** (`next/font/google`, ya cargada en `layout.tsx`). Eliminar las variables Geist que quedaron en `globals.css`.

```
Título de página   text-2xl font-semibold text-stone-900
Título de sección  text-xs font-semibold text-stone-400 uppercase tracking-wider
Título de card     text-base font-medium text-stone-900
Cuerpo             text-sm text-stone-700
Metadata / label   text-xs text-stone-500
```

Evitar tamaños arbitrarios como `text-[10px]`; mínimo `text-xs` para que se lea en el celular.

## Espaciado y forma

- Páginas: `px-4 py-6` mobile · `px-6 py-8` desktop
- Gap entre cards: `gap-3` mobile · `gap-4` desktop
- Padding de card: `p-4`
- Radios: `rounded-xl` cards · `rounded-2xl` modales · `rounded-lg` botones, inputs e internos
- Sombras: `shadow-sm` reposo · `shadow-md` hover · `shadow-xl` modales
- Solo escala de Tailwind (múltiplos de 4px)

---

## Componentes base

Extraer a `src/components/ui/` para no repetir clases larguísimas en cada archivo.

| Componente | Clases base |
|---|---|
| **Card** | `bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-stone-300 transition-all duration-150` |
| **Button primary** | `bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50` |
| **Button secondary** | `bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg border border-stone-200 hover:border-stone-300` |
| **Button danger** | `bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded-lg border border-red-200` — acciones que **abren** una confirmación o que se pueden deshacer (ej. "Eliminar paciente" en el formulario, "Quitar de la lista"). |
| **Button irreversible** | `bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 h-11 rounded-lg disabled:opacity-50` — **solo** dentro de un `ConfirmDialog`, para la acción que no tiene vuelta atrás ("Eliminar definitivamente"). Nunca como botón suelto en una pantalla. |
| **Input / Select / Textarea** | `bg-white border border-stone-200 text-stone-900 text-sm px-3 py-2 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20`. En formularios que se usan desde el celular, `text-base` (16px): con menos, iOS hace zoom al enfocar el campo. |
| **Badge de estado** | `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border` + colores de estado |
| **Modal** | overlay `fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50`; panel `bg-white border border-stone-200 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto` |
| **Toast** | para confirmar guardados y mostrar errores (reemplaza `alert()`). Ver detalle abajo. |
| **ConfirmDialog** | `src/components/ui/ConfirmDialog.tsx` (ya existe). Para acciones destructivas (reemplaza `confirm()`). Ver detalle abajo. |

### Toast (`src/components/ui/ToastProvider.tsx`, `useToast()`)
- **Posición:** celular, arriba al centro (`top-4 inset-x-4`), para no tapar la barra inferior ni el botón principal de los bottom sheets. Desktop, abajo a la derecha (`bottom-6 right-6`, `max-w-sm`).
- **Estilo:** `bg-white border rounded-xl shadow-md px-4 py-3 text-sm flex items-start gap-3`, con ícono a la izquierda:
  - éxito → `border-emerald-200`, ícono `CheckCircle2 text-emerald-600` ("Asistencia guardada")
  - error → `border-red-200`, ícono `AlertCircle text-red-600` (el texto sale de `mensajeError()`, nunca el error crudo)
  - aviso → `border-amber-200`, ícono `AlertTriangle text-amber-600`
- **Duración:** éxito 3 s; error y aviso quedan hasta que se cierran (botón ✕ de 44px). Máximo 3 a la vez; el más nuevo arriba.
- **Accesibilidad:** contenedor con `role="status"` (`aria-live="polite"`) para éxito y `role="alert"` para errores.
- Nada de toasts para acciones que ya muestran su resultado en pantalla (ej. un chip que cambia de color).

### ConfirmDialog
- Celular: bottom sheet (`rounded-t-2xl`, botones apilados al pie, Cancelar abajo). Desktop: modal centrado `max-w-md`.
- El foco arranca en **Cancelar**. Escape y tocar afuera cancelan (salvo mientras procesa).
- Título en pregunta ("¿Eliminar a Juana Pérez?"), mensaje que diga **qué se pierde** (con cantidades si se puede) y "No se puede deshacer." en `font-semibold text-red-700` cuando corresponda.
- Acción irreversible: prop `peligroso` → ícono `AlertTriangle` en círculo `bg-red-50` y botón **irreversible** (rojo sólido). El texto del botón nombra la acción ("Eliminar definitivamente"), nunca "Aceptar" o "Sí".
- Los errores se muestran dentro del diálogo (no se cierra si falla).

### Modales en celular (`src/components/ui/Modal.tsx`)
En pantallas < 768px los modales se muestran como **hoja desde abajo** (ancho completo, `rounded-t-2xl`, hasta 92% del alto) o, si son largos (ficha de paciente, clase TPA, historia clínica), en **pantalla completa** (`h-[100dvh]`). En ambos casos:
- Título arriba con ✕ de 44px; contenido con scroll propio; **pie fijo** con los botones.
- En el pie, en celular, Cancelar y Guardar ocupan mitad y mitad (`BOTON_PIE_SECUNDARIO` / `BOTON_PIE_PRIMARIO`); el principal queda a la derecha, al alcance del pulgar.
- Respetan el área segura del iPhone (`env(safe-area-inset-*)`) arriba y abajo.
- Tocar afuera **no** cierra (se perdería lo escrito); se cierra con ✕ o Cancelar.
- Campos de formulario `text-base md:text-sm` (sin zoom en iOS) y de 44px de alto.

### Layout general
- Contenido con `px-4 py-6` en celular y `px-6 py-8` en compu, centrado con `max-w-7xl mx-auto`.
- La columna de contenido lleva `min-w-0`: sin eso, cualquier hijo ancho estira la página y aparece el desplazamiento lateral.
- Barra inferior del celular con `pb-[env(safe-area-inset-bottom)]` y textos cortos (`RPG`, `TPA`, `Pacientes`, `Pagos`) en `text-xs`.
- **Sin conexión:** franja `bg-amber-50 text-amber-800 border-amber-200` con ícono `WifiOff` debajo del Header: "Sin conexión. Lo que ves puede no estar actualizado y no se puede guardar."
- **Carga y error** (`EstadoCarga`): spinner teal mientras carga; si falla, card con borde rojo, "No se pudieron cargar los datos. Revisá la conexión." y botón "Reintentar". Nunca una lista vacía que parezca "no hay datos".
- Navegación de semana/mes (`SemanaNav`): ‹ · etiqueta · Hoy · ›, botones de 44px, sobre `bg-stone-100 rounded-xl`.

---

## Patrones por pantalla

### Login
- Pantalla propia, **sin** navegación ni header. Fondo `bg-stone-50`, contenido centrado vertical y horizontalmente, columna `max-w-sm` con `px-4`.
- Arriba, la marca igual que en la sidebar (cuadrado teal con `LayoutGrid` + "Pau**Kinesio**").
- Card `bg-white border border-stone-200 rounded-2xl shadow-sm p-6` con: título "Ingresar" (título de página), email, contraseña con botón de 44px para mostrar/ocultar (`Eye`/`EyeOff`), y botón primario de ancho completo y `h-11`, con spinner y texto "Ingresando…" mientras carga.
- Campos `h-11` y `text-base`. `autocomplete="email"` y `"current-password"` para que el celular ofrezca la contraseña guardada.
- Mensajes arriba de los campos: error `bg-red-50 text-red-700 border-red-200` ("Email o contraseña incorrectos.", siempre genérico); sesión cerrada `bg-amber-50 text-amber-800 border-amber-200` ("Tu sesión se cerró. Volvé a entrar.").
- No hay "Registrarse". "Olvidé mi contraseña" no existe por ahora (ver `supabase/AUTH.md`).

### Usuario no autorizado
- Si la usuaria logueada no está autorizada (`public.soy_autorizada()` = false), el contenido de la página se reemplaza por una card `bg-white border border-amber-200 rounded-2xl p-6` con ícono `ShieldX` (círculo `bg-amber-50`), título "Tu usuario no está autorizado", explicación en lenguaje simple ("no se muestra ningún paciente ni turno") y botón secundario "Salir" de ancho completo. Navegación y Header siguen visibles.

### Salir
- Botón de ícono `LogOut` (44 × 44 px) en el Header, en celular y desktop, con `aria-label="Salir"`. Sin confirmación: salir no pierde datos y volver a entrar es rápido.

### Agenda RPG
- **Desktop:** calendario mensual (lunes a domingo, martes y jueves resaltados).
- **Celular** (`RpgSemanaLista`): la semana como **lista por día**: martes y jueves siempre (otro día solo si tiene turnos), con "+ Turno" por día y navegación por semana. El calendario mensual no se muestra en celular.
- Turno (`TurnoCard`): hora, nombre (tocable → historia clínica), tipo de sesión, punto de pago, color e ícono del estado.

### Agenda TPA
- **Desktop** (`TpaGrillaSemana`): grilla de 3 días × horarios reales (`HORARIOS_TPA`). Si un día no tiene clase en esa hora (viernes 19:00), celda punteada "Sin clase".
- **Celular** (`TpaListaDia`): selector de día (Lun / Mié / Vie con la fecha, botones de 48px, el activo en teal) arriba y **lista de horarios** debajo. Al abrir, el día de hoy (o el próximo día de TPA).
- Cada horario es la misma card en las dos vistas (`TpaHorarioCard`): hora, cupo `3/4` (teal si está completo), alumnos con color + ícono del estado, y botón "Registrar asistencia" / "Ver asistencia" (44px en celular). Un horario que no es de los habituales muestra "(fuera de horario)".
- Tocar el botón → registro rápido de asistencia; tocar un nombre → historia clínica.
- Alumnos que recuperan o vienen de otro horario se muestran en la card con su estado (azul/teal) aunque no sean fijos.

### Registro rápido de asistencia (modal)
- Un alumno por fila, estados como **chips grandes** de un toque (44px de alto).
- El botón Guardar se habilita **solo si hay cambios** (incluido volver alguien a "Sin marcar"); si no, dice "Sin cambios". Las filas editadas muestran "Sin guardar".
- Pestaña "Alumnos fijos" para inscribir/desinscribir (fijos de hoy). Al inscribir o desinscribir, el modal **no cambia de pestaña ni pierde las marcas sin guardar**.
- Acción "Todos presentes" para el caso más común, y después se corrigen excepciones.
- Botón "+ Agregar alumno" (recupera / viene de otro horario).
- Campo de **nota de evolución por alumno** (expandible) — ej. "bajó la presión a mitad de clase".

### Historia clínica
- Encabezado con nombre, edad, tipo (RPG/TPA), alertas activas y teléfono tocable (`tel:` / WhatsApp).
- Pestañas: Ficha · Evolución (notas + asistencias, en orden cronológico) · Alertas.
- La ficha se **edita en el mismo lugar** (no hay que ir a otra pantalla).
- En celular, pestañas horizontales arriba con scroll.

---

## Íconos y movimiento

- Solo `lucide-react`. `size={16}` inline, `size={20}` acciones. Reposo `text-stone-400`, activo `text-teal-600`.
- Transiciones `duration-150`. Nada de animaciones largas.
- ⚠️ Las clases `animate-in`, `fade-in`, `zoom-in-95` que hay en el código **no hacen nada** porque no está instalado el plugin `tw-animate-css`. Instalarlo (es la opción estándar para Tailwind v4) o quitar esas clases.

## Checklist visual antes de cerrar una tarea

- [ ] Se ve y se usa bien a 390px de ancho
- [ ] Objetivos táctiles ≥ 44px en acciones frecuentes
- [ ] Estados de carga, vacío y error contemplados
- [ ] Colores de estado tomados de `estados.ts`
- [ ] Sin colores, radios ni tamaños fuera de este documento
