# DESIGN.md — Sistema de diseño PAU Kinesio

## Principios

1. **Funcionalidad primero.** Nada decorativo puede esconder, demorar o complicar una acción.
2. **Compu primero, celular que ande bien.** Pau usa la app sobre todo desde la compu: cada pantalla se diseña primero para un ancho de compu (modales anchos, tablas, la grilla de la semana a la vista). Lo que más usa son las faltas y las recuperaciones: cargar un aviso, ocupar un lugar o marcar una clase tiene que estar a 1–2 clics. En el celular todo tiene que seguir funcionando, con objetivos táctiles de **mínimo 44 × 44 px** y sin desplazamiento lateral en 390px.
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

Definidos **una sola vez** en `src/lib/estados.ts` (label, clases de color, ícono) y usados en grilla, modal e historia clínica. Si esta tabla cambia, se cambia `estados.ts` (y viceversa). Las etiquetas son las palabras del Word de Pau.

| Estado | Label | Clases | Ícono |
|---|---|---|---|
| `presente` | Presente | `bg-emerald-50 text-emerald-700 border-emerald-200` | `Check` |
| `aviso_con_tiempo` | Avisó C.T. | `bg-amber-50 text-amber-700 border-amber-200` | `MessageSquare` |
| `aviso_sin_tiempo` | Avisó S.T. | `bg-amber-50 text-amber-700 border-amber-200` | `MessageSquareWarning` |
| `falto_sin_avisar` | No avisó (en quien viene a ocupar un lugar: **No vino**) | `bg-red-50 text-red-700 border-red-200` | `X` |
| `pendiente` | Sin marcar | `bg-white text-stone-600 border-dashed border-stone-400` | `CircleDashed` |

- **Ámbar = avisó, rojo = no avisó** (criterio por defecto; Pau lo puede cambiar solo en `estados.ts`). C.T. y S.T. comparten color y se distinguen por la etiqueta y el ícono.
- Un fijo usa los 5; quien viene a ocupar un lugar usa Presente · No vino · Sin marcar (`ORDEN_ESTADOS_FIJO` / `ORDEN_ESTADOS_OCUPANTE`).
- Un estado que esta versión no conoce se muestra en gris (`bg-stone-50 text-stone-600 border-stone-300`, ícono `CircleHelp`) con su nombre: no rompe la pantalla.
- "Sin marcar" usa **borde punteado** sobre blanco: tiene que distinguirse a simple vista del fondo de las cards.

**Quien viene a ocupar un lugar** (`TIPOS_OCUPANTE`): el color lo da su estado; la etiqueta dice qué es — Recupera (`RotateCcw`), Cambio de horario (`ArrowLeftRight`), Clase suelta (`Ticket`). Si ocupa el lugar de un fijo, va **justo debajo** de ese fijo, con sangría e ícono `CornerDownRight`.

**Lugar libre** (`LUGAR_LIBRE`): fila "Libre · + Ocupar" con `bg-teal-50 text-teal-700 border-dashed border-teal-200` (hover `bg-teal-100`) e ícono `SquareDashed`, del mismo alto que una fila de alumno. Es un botón: abre la clase con el selector "Ocupar lugar". Es el amarillo "LIBRE" del Word de Pau (en ámbar se confundiría con los avisos; confirmado por Facu, 23/10/2026).

**Clase cancelada** (`MOTIVOS_CANCELACION`, `CLASES_CANCELADA`): card `bg-stone-50 border-stone-300`, badge `bg-stone-100 text-stone-500 border-stone-300` con ícono `Ban`: "Cancelada · Feriado" o "Cancelada por Pau". Sin lugares libres; los alumnos se ven atenuados.

### Estados de sesión RPG
| Estado | Label | Clases | Ícono |
|---|---|---|---|
| `pendiente` | Pendiente | `bg-white text-stone-700 border-stone-200` | `Clock` |
| `realizada` | Realizada | `bg-emerald-50 text-emerald-700 border-emerald-200` | `CircleCheck` |
| `cancelada` | Cancelada | `bg-stone-100 text-stone-500 border-stone-300` | `CircleX` |

### Pago (`ESTADOS_PAGO`)
Los colores del calendario de Pau: **verde = pagó, rosa = todavía no pagó**, en toda la app (TPA, Pagos y RPG). El ámbar queda solo para "avisó" y para avisos.
- pagado → badge `bg-emerald-50 text-emerald-700 border-emerald-200`, punto `bg-emerald-500`, ícono `CircleCheck`. Con fecha y medio: "Pagó el 5/11 · Efectivo" (`EstadoPagoChip`).
- pendiente → badge `bg-pink-50 text-pink-700 border-pink-200`, punto `bg-pink-500`, ícono `Clock`. Pendiente que todavía no es deuda (sesión de RPG que no se hizo, sueltas sin nada para cobrar): gris `bg-stone-50 text-stone-500 border-stone-200`.
- Importes siempre con `formatoPesos()` (`src/lib/pagos.ts`): "$50.000", igual en cualquier navegador. Cifras con `tabular-nums`.
- En RPG el pago es **por sesión**: el texto es "Sesión: pagado / pendiente", nunca "Mes".

### Alertas clínicas
`bg-amber-50 text-amber-800 border-amber-200`, ícono `ShieldAlert`. **Sin `animate-pulse`**: una alerta que titila todo el tiempo cansa y pierde valor.

---

## Tipografía

Fuente: **Inter** (`next/font/google`, ya cargada en `layout.tsx`). Eliminar las variables Geist que quedaron en `globals.css`.

```
Título de página   text-2xl font-semibold text-stone-900
Título de sección  text-base font-semibold text-stone-900 (+ detalle al lado: text-sm text-stone-500)
Rótulo chico       text-xs font-semibold text-stone-400 uppercase tracking-wider (solo dentro de una card o un modal)
Título de card     text-base font-medium text-stone-900
Cuerpo             text-sm text-stone-700
Metadata / label   text-xs text-stone-500
```

Evitar tamaños arbitrarios como `text-[10px]`; mínimo `text-xs` para que se lea en el celular.

Las secciones de una pantalla (por ejemplo, Cuotas / Clases sueltas / RPG en `/pagos`) llevan **título de sección visible**: el rótulo chico en gris claro casi no se ve y Facu no encontró "Clases sueltas" (13/11/2026). El rótulo chico queda para agrupar campos dentro de una card o un modal.

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
- **Carga y error** (`EstadoCarga`): spinner teal mientras carga; si falla, card con borde rojo, **el mismo mensaje del Toast** (lo guarda `useDatos`: "No se pudo cargar la agenda TPA. Falta aplicar un cambio en la base de datos. Avisale a Facu.") y botón "Reintentar". Nunca una lista vacía que parezca "no hay datos".
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
- Turno (`TurnoCard`): hora, nombre (tocable → historia clínica), tipo de sesión, punto de pago (verde / rosa), color e ícono del estado.
- En el modal del turno, con Pago = Pagado aparece **Medio de pago** (Transferencia / Efectivo); el importe y la fecha se ven y se corrigen en Pagos.

### Pestañas de una pantalla (`Pestanias`, `src/components/ui/`)
- Para las **vistas principales** de una pantalla (TPA: Semana | Calendario | Recuperaciones). Tienen que verse a primera vista: el subrayado fino pasaba desapercibido.
- Control segmentado: contenedor `bg-stone-100 border-stone-200 rounded-xl p-1`; cada pestaña 44px con ícono (16px) y texto `text-sm font-semibold`; la activa `bg-white text-teal-700 shadow-sm ring-1 ring-stone-200` con el ícono teal; las otras `text-stone-600`, hover `bg-white/60`. Contador opcional en un círculo `bg-blue-600 text-white` (azul = recuperar, como el chip).
- En el celular ocupa todo el ancho (columnas iguales); en la compu, lo que necesita. Con 3 o más pestañas, en el celular van sin ícono y con el texto corto si hace falta (`corto`: "Recuperar") para que entren en 390px.
- Las pestañas **dentro de un modal** (Asistencia | Alumnos fijos) siguen con subrayado teal: ahí el modal ya enmarca.

### Agenda TPA
- Pestañas arriba (`Pestanias`): **Semana** (`CalendarDays`) | **Calendario** (`CalendarRange`) | **Recuperaciones** (`RotateCcw`, con el contador de pendientes). Abre en **Calendario** la primera vez y después en la última pestaña usada (`useValorGuardado`, en este navegador).
- Junto a la navegación de la semana, chip **"N pendientes de recuperar"** (`bg-blue-50 text-blue-700 border-blue-200 rounded-full`, ícono `RotateCcw`) que lleva a la pestaña Recuperaciones. Solo si hay pendientes este mes.
- En el encabezado de cada día (grilla de la compu y lista del celular): **"Cancelar el día"** (texto `text-stone-500`, hover rojo, ícono `Ban`) y, si hay clases canceladas, **"Reactivar el día"** (hover teal, ícono `RotateCcw`). 32px en la compu, 44px en el celular.
- **Desktop** (`TpaGrillaSemana`): grilla de 3 días × horarios reales (`HORARIOS_TPA`). Si un día no tiene clase en esa hora (viernes 19:00), celda punteada "Sin clase".
- **Celular** (`TpaListaDia`): selector de día (Lun / Mié / Vie con la fecha, botones de 48px, el activo en teal) arriba y **lista de horarios** debajo. Al abrir, el día de hoy (o el próximo día de TPA).
- Cada horario es la misma card en las dos vistas (`TpaHorarioCard`): hora, contador `3/4`, alumnos con color + ícono del estado (y la etiqueta si ya están marcados), **siempre los 4 lugares** (los que sobran, como "Libre") y botón "Registrar asistencia" / "Ver asistencia" (44px en celular). Un horario que no es de los habituales muestra "(fuera de horario)".
- Junto al nombre, íconos de 14px: **alerta de faltas** (`ALERTA_FALTAS.icono` = `OctagonAlert`, `text-red-600`) si tiene 2 o más faltas seguidas sin avisar, y **nota** (`ICONO_NOTA` = `NotebookPen`) si tiene nota de evolución en esa clase. Los dos también en el `title` y en el texto para lectores de pantalla.
- **Contador:** ocupados = fijos que no avisaron (incluye Sin marcar y No avisó) + quienes vienen a ocupar un lugar. Badge `bg-stone-50 text-stone-600 border-stone-200`; completo, `bg-teal-50 text-teal-700 border-teal-200`; con más personas que lugares ("5/4"), `bg-amber-50 text-amber-800 border-amber-200` con `AlertTriangle` (avisa, no bloquea).
- Tocar el botón → registro rápido de asistencia; tocar un nombre → historia clínica.

### Calendario general del mes (TPA, `TpaCalendario`)
- Lo primero que mira Pau en TPA: el mes entero con los fijos y si pagaron. Navegación por mes (`SemanaNav` con "Mes anterior / siguiente") y al lado "Pagaron **12 de 18** · Falta cobrar **$430.000**" (solo cuotas; la cifra en `text-pink-700`).
- Si el mes no tiene precios propios, franja ámbar "Noviembre sin precios: se usan los de octubre" con el botón **"Cargar precios de noviembre"** (abre `PreciosMesModal` con los del mes anterior ya completos).
- **Compu:** grilla horarios (columna de 4rem a la izquierda, horas en `text-sm font-semibold text-stone-700`) × Lun / Mié / Vie (encabezados `text-base font-semibold text-stone-900`, no el rótulo chico), como la semana. Cada horario es una card blanca (`TpaCalendarioCelda`) con **sus 4 lugares** en filas de 36px: fijo en **verde** (pagó) o **rosa** (no pagó) con `ESTADOS_PAGO[…].clases`, "desde 15/11" o "baja 20/11" en chico si entra o sale en el mes; un clic abre **Cobrar** (2 clics para cobrar). Los lugares sin fijo: el mismo "Libre" teal punteado de la semana con **"+ Inscribir fijo"** (abre `TpaInscribirFijo`: el `TpaInscripcion` de siempre, con "Fijo desde" = el 1 del mes que se mira). Sin clase a esa hora (viernes 19:00): celda punteada "Sin clase".
- **Celular:** selector Lun / Mié / Vie (44px, el activo en teal) y una card por horario con la hora arriba y sus lugares en filas de 44px.

### Cobrar (`CobrarCuota`, `CobrarSueltas`, `CobrarSesionRPG`)
- Modal `md` (hoja desde abajo en el celular). Título: el nombre; subtítulo: "Cuota de noviembre · 1 vez por semana (lun 10:30)".
- Todo viene completo con lo sugerido: **plan** (control segmentado 1 vez / 2 veces / 3 veces, el activo `bg-teal-50 border-teal-500`), **importe** (`$` adentro del campo, editable), **fecha de pago** (hoy), **medio** (Transferencia / Efectivo, el activo `bg-teal-600 text-white`; arranca en el de su último pago) y **nota** opcional. En el caso normal: abrir → **Guardar**.
- Importe sugerido (respuestas de Pau, 13/11/2026): el **plan**, pague cuando pague (debajo, "Plan 1 vez por semana." en `text-stone-600`). **Alta a mitad de mes:** arranca por clase, "Empieza el 15/11: por clase, 2 × $18.000 = $36.000 · **Volver al plan**" (link teal subrayado); en el plan, "Plan 1 vez por semana. Empieza el 15/11: por clase serían … · **Usar**".
- Avisos en franja ámbar con `AlertTriangle`: plan distinto de sus horarios, más de 3 horarios, ya no es fijo.
- **Ya pagado:** caja verde "Pagó el 5/11 · Transferencia · $50.000" (+ plan y nota), y en el pie **"Deshacer"** (texto rojo, a la izquierda en la compu, con `ConfirmDialog` danger) y **"Editar"**.
- Clases sueltas: lista de los pagos del mes (caja verde por pago con "Deshacer") y el formulario con **Clases** (importe = clases × suelta, editable). Cada pago es una fila nueva.
- Link "Ver historia clínica" (`User`, `text-stone-600`, hover teal) al pie del contenido.

### Pagos del mes (`/pagos`, `PagosDelMes`)
- Arriba: navegación de mes y **"Copiar pendientes"** (botón secundario con `Copy`; texto para WhatsApp; sin portapapeles, modal con el texto para copiar a mano, como en Recuperaciones).
- **Cuatro cifras** (`PagosCifras`), cards blancas en 2 columnas en el celular y 4 en la compu: Cobrado (`text-emerald-700`) · Falta cobrar (`text-pink-700`) · Total del mes · Efectivo / Transferencia (y "Sin medio (RPG)" en gris si hay).
- **Precios** en una línea ("1 vez $50.000 · 2 veces $80.000 · … · RPG $46.000") con "Editar"; si son heredados, la franja ámbar de arriba con "Cargar precios de noviembre".
- Secciones (`TablaPagos`), con **título de sección visible** (`text-base font-semibold text-stone-900`) y el detalle al lado en gris: **Cuotas TPA por plan** ("Cuotas TPA · 1 vez por semana" · "pagaron 2 de 3"; solo los planes con alumnos): Alumno · Horarios · Estado · Importe · Cobrar/Ver), **Clases sueltas TPA** (Persona · Clases "× 3 (vino 3 · 1 no vino)" · Estado · Importe · Cobrar/Ver) y **RPG** (Paciente · Fecha · Tipo · Estado · Importe · Cobrar/Ver). Al pie de cada una, "Cobrado $X · Falta cobrar $Y". **Clases sueltas** y **RPG** se muestran siempre: sin filas, caja punteada con cómo se cargan ("Se anotan desde TPA → Semana → Ocupar lugar → Clase suelta"). Compu: tabla `bg-white border-stone-200 rounded-xl`; celular: una card por fila con los datos en dos columnas y el botón de ancho completo (44px). Botón "Cobrar" primario teal; "Ver" (ya pagado) secundario.
- Nombre tocable → historia clínica.

### Registro rápido de asistencia (modal)
- Modal `ancho="2xl"` en la compu (los 5 chips entran en una fila); pantalla completa en el celular. Subtítulo: "lunes 26 de octubre · 3/4 · 1 libre" (con las marcas sin guardar).
- Un alumno por fila, estados como **chips grandes** de un toque (44px de alto).
- **Clase futura** (todavía no empezó): franja `bg-stone-50 border-stone-200` con ícono `Info` teal: "La clase todavía no empezó: solo se cargan avisos. **Faltan 49 h para la clase → con tiempo**." Presente y No avisó deshabilitados (`opacity-40`, `cursor-not-allowed`, con `title` que explica por qué). El chip sugerido (C.T. o S.T.) lleva "(sugerido)" y borde `border-amber-300`; el otro está a un toque. En una clase que ya empezó no hay sugerencia: elige Pau.
- Más personas que lugares: franja `bg-amber-50 text-amber-800 border-amber-200` con `AlertTriangle`: "5/4: hay más personas que lugares. Se puede guardar igual."
- **Una fila por lugar:** fijos; debajo de cada fijo, con sangría y `CornerDownRight`, quien ocupa su lugar; después quienes ocupan un lugar libre; al final, los lugares libres como botón "Libre · + Ocupar". Si no queda ninguno, botón punteado `border-dashed border-stone-300 text-stone-600` "+ Agregar a alguien más (queda de más)": lugar lleno → se avisa, no se bloquea.
- **Fijo que avisó sin reemplazo:** botón "Ocupar su lugar" (`text-teal-700 bg-teal-50 border-teal-200`, ícono `UserPlus`).
- **Quien ocupa un lugar:** nombre + qué es (Recupera / Cambio de horario / Clase suelta; recién agregado, un select para pasar de Recupera a Clase suelta) + chips Presente · No vino · Sin marcar + "Quitar de esta clase" (`text-red-600 hover:bg-red-50`, ícono `X`). El cambio de horario muestra "Falta el vie 30/10 18:00"; el fijo de origen, "Viene el lun 2/11 18:00 (cambio de horario)".
- **Fijo con el lugar ocupado al que se le cambia el estado:** panel `bg-amber-50 border-amber-200` dentro de su fila: "Zoe ocupa su lugar. ¿Qué hacemos con Zoe?" → "Sacarlo de la clase" (rojo) · "Dejarlo en un lugar libre" · "No cambiar". Igual para el origen de un cambio de horario ("Quitar el cambio"). Mientras haya una pregunta abierta, Guardar está deshabilitado.
- **Cancelar clase:** botón danger (`bg-red-50 text-red-600 border-red-200`, ícono `Ban`) a la izquierda del pie en la compu y al final de la lista en el celular. Deshabilitado si hay cambios sin guardar. Abre `TpaCancelarDialog`: dos opciones grandes con su consecuencia a la vista (**Feriado** / **Cancelada por mí**), sin "Otro". El mismo diálogo sirve para "Cancelar el día".
- **Clase cancelada:** franja `bg-stone-100 text-stone-500 border-stone-300` con `Ban`: "Cancelada · Feriado. No se marca asistencia ni se ocupan lugares…" + botón secundario "Reactivar clase" (con `ConfirmDialog`). Los chips quedan deshabilitados y no hay lugares libres.
- El botón Guardar se habilita **solo si hay cambios** (incluido volver alguien a "Sin marcar"); si no, dice "Sin cambios". Las filas editadas muestran "Sin guardar".
- Pestaña "Alumnos fijos" para inscribir/desinscribir (fijos de hoy). Al inscribir se elige **"Fijo desde"** (`<input type="date">`, hoy por defecto; puede ser pasada o futura) y la lista muestra "desde dd/mm/aaaa" o, si todavía no empezó, "empieza el dd/mm/aaaa" en teal. Al inscribir o desinscribir, el modal **no cambia de pestaña ni pierde las marcas sin guardar**.
- **"Marcar el resto como presente (N)"**: botón secundario teal (`bg-teal-50 text-teal-700 border-teal-200`, ícono `CheckCheck`, 44px, ancho completo en el celular) arriba de la lista, solo si la clase ya empezó, no está cancelada y queda alguien en "Sin marcar". Marca Presente a los "Sin marcar" sin guardar (las filas muestran "Sin guardar"); después se corrigen las excepciones.
- **Nota de evolución por alumno** (`TpaNotaClase`), al final de cada fila: "+ Nota" (texto `text-stone-600`, hover teal) abre un `textarea` de 3 líneas (16px en el celular) con "Listo" y "Quitar nota"; con texto, la nota se ve en una caja blanca con `NotebookPen` teal y un lápiz para editar. Se guarda con el botón Guardar del modal. En una clase cancelada se ve y no se edita. Las notas de quien ya no está en la clase van al final: "Notas de quienes ya no están en esta clase".
- **Alerta de faltas** en la fila: debajo del nombre, `text-xs font-medium text-red-700` con `OctagonAlert`: "2 faltas seguidas sin avisar" (con las marcas sin guardar).

### Selector "Ocupar lugar" (`TpaOcuparSelector`, dentro del modal de la clase)
- Reemplaza el contenido del modal (no es un modal encima de otro): "← Volver a la clase" y "Lugar de Beto" / "Lugar libre".
- Buscador por nombre (sin acentos ni mayúsculas) arriba; si la clase está completa, franja ámbar "va a quedar de más. Se puede igual."
- Grupos en el orden de prioridad de Pau, con título de sección: Clases que cancelaste · Avisaron con tiempo · Avisaron sin tiempo · Por feriado (si hay lugar) · Adelantar · Cambio de horario · Otro paciente (clase suelta). Cada fila: nombre, motivo ("cancelé el lun 5 (y 1 más)"), saldo ("usó 0 de 1"), avisos en `text-amber-700` con `AlertTriangle` (tope, otro mes) y el botón "Elegir" (`bg-teal-50 text-teal-700 border-teal-200`). En un cambio de horario de alguien que todavía no avisó, en lugar de "Elegir" van dos botones "Avisó C.T." / "Avisó S.T." (el sugerido con "(sugerido)" y borde ámbar).
- Lista en una card (`divide-y divide-stone-100 border-stone-200 rounded-xl`); en la compu, el botón a la derecha; en el celular, debajo.

### Pestaña Recuperaciones (`TpaRecuperaciones`)
- Arriba: navegación de mes (la misma `SemanaNav`), resumen ("7 pendientes de recuperar") y botón secundario **"Copiar lista"** (ícono `Copy`). Si el navegador no deja copiar (por ejemplo, entrando por http desde la red local), modal "Copiá la lista" con el texto en un `textarea` de solo lectura que se selecciona al tocarlo.
- **Pendientes** en 4 grupos (títulos de sección): en la compu, tabla `bg-white border-stone-200 rounded-xl` con Alumno (tocable → historia clínica) · Origen · Tope del mes ("usó 1 de 2") · Vence ("vence el 31/10" / "no vence") · "Buscar lugar"; en el celular, una card por pendiente con los mismos datos.
- **"Buscar lugar"** (`TpaBuscarLugar`, modal `lg`): clases con lugar de esta semana y la siguiente, dentro del vencimiento, con "Elegir". Elegir abre la clase con la persona ya agregada ("Sin guardar"): Pau revisa y guarda. No aparece en meses que ya cerraron.
- **Adelantos** y **Sin derecho a recuperar**: listas informativas en una card. "Adelantó y no faltó en octubre: decidís vos" en `text-amber-700`.

### Pacientes (`/pacientes`)
- Encabezado: título, y a la derecha **"Descargar copia"** (botón secundario con `Download`; mientras arma el archivo, `Loader2` y "Preparando la copia…") con una línea debajo: "Última copia en esta compu: 13/11/2026 (hoy)" en `text-xs text-stone-500`; si nunca se hizo o pasó más de una semana, en `text-amber-700 font-medium` con `AlertTriangle`. Al lado, **"Nuevo paciente"** (primario).
- Pestañas (`Pestanias`) **Activos (N) · Dados de baja (M)** y al lado el buscador. En "Dados de baja", debajo del nombre "Dado de baja el 13/11/2026" en lugar de la edad.
- **Dar de baja** (`DarDeBajaDialog`, `ConfirmDialog` no peligroso): qué pasa (deja las listas, la historia y los pagos quedan, los horarios fijos se cierran en esa fecha) y el campo **Fecha de baja** (hoy por defecto).
- **Eliminar** (desde "Editar ficha", botón danger): si tiene **cualquier dato**, no se elimina: "X tiene historial" con lo que tiene ("3 turnos RPG, 12 asistencias TPA…") y el botón **"Dar de baja"**. Solo sin ningún dato: `ConfirmDialog` danger "Eliminar definitivamente".

### Historia clínica
- Encabezado con nombre, edad, tipo (RPG/TPA), alertas activas y teléfono tocable (`tel:` / WhatsApp). La alerta de faltas es un chip `ALERTA_FALTAS.clases` ("2 faltas seguidas sin avisar") que lleva a Evolución.
- Pestañas: **Ficha** · **Evolución** (desde la entrega 4; la de Alertas por palabra clave se sacó). En la compu, columna a la izquierda; en el celular, dos pestañas de ancho igual arriba. La activa `bg-teal-600 text-white`.
- **Evolución:** arriba la alerta (franja `ALERTA_FALTAS.clases` con `OctagonAlert`), el resumen del mes en una card blanca con `CalendarCheck` teal ("Octubre: 3 faltas avisadas, 1 recuperada, le queda 1") y el botón primario **"+ Nota"** (nota libre: fecha + `textarea` de 4 líneas, "Cancelar" / "Guardar nota"). Debajo, la línea de tiempo (lo más nuevo arriba): una card por clase de TPA (fecha, hora, "TPA", chip del estado; la nota de esa clase adentro), por nota libre ("Nota") y por sesión de RPG (tipo, chips de sesión y pago, su nota en gris). Las notas de evolución en una caja `bg-teal-50/40 border-teal-100` con `NotebookPen`, lápiz para editar y tacho (`Trash2`, hover rojo) para borrar con `ConfirmDialog` danger.
- La ficha se **edita en el mismo lugar** (no hay que ir a otra pantalla).
- Al pie de la Ficha, card con el estado: activo → texto "Si ya no viene, dalo de baja…" y botón secundario **"Dar de baja"** (`Archive`); dado de baja → "Dado de baja el 13/11/2026. No aparece en las listas…" y botón **"Reactivar"** (`RotateCcw`, `bg-teal-50 text-teal-700 border-teal-200`). En el encabezado, chip gris `bg-stone-100 text-stone-600` "Dado de baja el 13/11/2026".
- En celular, pestañas horizontales arriba con scroll.

---

## Íconos y movimiento

- Solo `lucide-react`. `size={16}` inline, `size={20}` acciones. Reposo `text-stone-400`, activo `text-teal-600`.
- Transiciones `duration-150`. Nada de animaciones largas.
- ⚠️ Las clases `animate-in`, `fade-in`, `zoom-in-95` que hay en el código **no hacen nada** porque no está instalado el plugin `tw-animate-css`. Instalarlo (es la opción estándar para Tailwind v4) o quitar esas clases.

## Checklist visual antes de cerrar una tarea

- [ ] Se ve y se usa bien en la compu (primero) y a 390px de ancho
- [ ] Objetivos táctiles ≥ 44px en acciones frecuentes
- [ ] Estados de carga, vacío y error contemplados
- [ ] Colores de estado tomados de `estados.ts`
- [ ] Sin colores, radios ni tamaños fuera de este documento
