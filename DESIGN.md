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

Definirlos **una sola vez** en `src/lib/estados.ts` (label, clases de color, ícono) y usarlos en grilla, modal e historia clínica. Hoy están duplicados en 3 archivos.

| Estado | Label | Clases |
|---|---|---|
| `presente` | Presente | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `aviso_ausencia` | Avisó | `bg-amber-50 text-amber-700 border-amber-200` |
| `falto_sin_avisar` | Faltó | `bg-red-50 text-red-700 border-red-200` |
| `recupera` | Recupera | `bg-blue-50 text-blue-700 border-blue-200` |
| `vino_otra_clase` | De otro horario | `bg-teal-50 text-teal-700 border-teal-200` |
| `cancelado` | Cancelado | `bg-stone-100 text-stone-400 border-stone-200` |
| `pendiente` | Sin marcar | `bg-stone-50 text-stone-400 border-stone-200` |

> Pendiente de confirmar con Pau: en su Word usa **rojo para "faltó avisando"**. Si prefiere conservar su código de colores, se cambia solo en `estados.ts`.

Además del color, cada estado lleva **ícono o texto** (accesibilidad: no depender solo del color).

### Pago
- pagado → `text-emerald-600` (punto o badge verde)
- pendiente → `text-amber-600`

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
| **Button danger** | `bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded-lg border border-red-200` |
| **Input / Select / Textarea** | `bg-white border border-stone-200 text-stone-900 text-sm px-3 py-2 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20` |
| **Badge de estado** | `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border` + colores de estado |
| **Modal** | overlay `fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50`; panel `bg-white border border-stone-200 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto` |
| **Toast** | para confirmar guardados y mostrar errores (reemplaza `alert()`) |
| **ConfirmDialog** | para acciones destructivas (reemplaza `confirm()`) |

### Modales en celular
En pantallas < 768px los modales se muestran como **bottom sheet** (pegados abajo, ancho completo, `rounded-t-2xl`), con el botón principal fijo al pie y alcanzable con el pulgar.

---

## Patrones por pantalla

### Agenda RPG
- **Desktop:** calendario mensual (lunes a domingo, martes y jueves resaltados).
- **Celular:** el calendario de 7 columnas no entra. Mostrar **lista por día** (próximos martes/jueves) con navegación por semana, y el mensual como vista opcional.
- Turno: hora, nombre (tocable → historia clínica), tipo de sesión, punto de pago, estado.

### Agenda TPA
- **Desktop:** grilla de 3 días × horarios reales (no una lista fija de 08 a 20).
- **Celular:** selector de día (Lun / Mié / Vie) arriba y **lista de horarios** debajo; cada horario es una card con sus alumnos coloreados por estado y el cupo `3/4`.
- Tocar el horario → registro rápido de asistencia; tocar un nombre → historia clínica.
- Alumnos que recuperan o vienen de otro horario se muestran en la card con su estado (azul/teal) aunque no sean fijos.

### Registro rápido de asistencia (modal)
- Un alumno por fila, estados como **chips grandes** de un toque.
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
