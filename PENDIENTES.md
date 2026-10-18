# PENDIENTES.md — Estado y plan de trabajo

_Última revisión: 17/10/2026 — análisis completo del código (commit `a665aa3`, "v0.2") contra el instructivo de Pau, y lectura de la base Supabase `pau` (`dmwtoozbctnwccaaitos`, org de gaiozavaleta, Postgres 17)._

## Estado actual (resumen)

**Hecho y funcionando en lo básico:**
- Navegación (sidebar en desktop, barra inferior en celular), estética teal/stone.
- Agenda RPG mensual: crear y editar turnos, estado de pago y de sesión, nota.
- Agenda TPA semanal: grilla de horarios fijos, inscribir/desinscribir alumnos fijos, marcar asistencia y colorear.
- Historia clínica en modal (solo lectura): ficha, historial RPG + TPA, alertas por palabra clave.
- Pacientes: listado, búsqueda local, alta y edición de ficha.
- Pagos: lista mensual, toggle pagado/pendiente, plan e importe.
- `tsc` compila sin errores. `npm run lint`: **22 errores y 8 warnings** (casi todos `any`).

**Lo más importante que falta:** las **notas de evolución clase a clase** (el pedido central de Pau), poder agregar a una clase a quien **recupera o viene de otro horario**, y la **seguridad** (hoy no hay login).

---

## Fase 0 — Bloqueantes (antes de que Pau cargue un solo paciente real)

- [ ] **Autenticación.** Hoy no hay login: cualquiera que abra la URL ve y edita historias clínicas. Implementar Supabase Auth (email + contraseña o magic link, una sola usuaria) con `@supabase/ssr`, middleware/proxy que proteja todas las rutas y pantalla de login.
- [ ] **Reemplazar las políticas RLS.** ✅ Verificado el 17/10: RLS está activo, pero cada tabla tiene la política *"Permitir todo a publico"* (`for all to public using (true) with check (true)`). En la práctica es como no tener RLS: cualquiera con la anon key (que viaja en el JS de la app) lee, modifica y borra todo. Reemplazar por políticas solo para `authenticated` (idealmente solo el UID de Pau). `lista_espera` tiene RLS sin políticas (nadie la puede leer): definir las suyas cuando se use.
- [x] **Versionar el esquema.** Línea base en `supabase/migrations/20260520000000_esquema_inicial.sql`, reconstruida leyendo la base. **No ejecutarla** contra el proyecto existente; los cambios van en migraciones nuevas.
- [x] **Constraints clave:** ✅ existen `unique (clase_id, paciente_id)` en `asistencia_tpa`, `unique (fecha, hora)` en `clases_tpa` y `unique (paciente_id, mes, año)` en `pagos`.
- [ ] **Normalizar horas.** ✅ Bug confirmado: las columnas `hora` son `time` y la base devuelve `"08:00:00"`, mientras la grilla TPA genera `"08:00"`. Efectos reales: (a) los alumnos fijos aparecen en una fila `08:00:00` aparte y la fila `08:00` queda vacía; (b) la clase guardada a las `20:00:00` no se encuentra al comparar con `"20:00"`, así que la asistencia **se guarda pero no se ve**, y al volver a guardar se intenta crear la clase otra vez y **choca con el unique** → error. Crear `normalizarHora()` y usarla en todas las comparaciones.
- [ ] **Advisors de seguridad de Supabase:** `update_updated_at` sin `search_path` fijo; `rls_auto_enable()` ejecutable por `anon` y `authenticated` vía RPC (revocar `execute`).
- [ ] **Datos actuales:** la base tiene 3 pacientes, 5 turnos RPG, 3 horarios TPA, 1 clase y 1 pago, con fechas de mayo 2026 y horas como 08:00 y 00:00. Parecen de prueba: confirmar con Facu y limpiarlos antes de la carga real. Hay 0 usuarios en Auth.
- [ ] Revisar que el repo público no contenga datos reales ni claves (hoy `.env*` está en `.gitignore`, bien). Evaluar pasar el repo a privado.

## Fase 1 — Núcleo de lo que pidió Pau

### Notas de evolución (prioridad #1)
- [ ] Decidir modelo (ver Preguntas): recomendado tabla `notas_evolucion` (`paciente_id`, `fecha`, `texto`, `origen` rpg/tpa/libre, `sesion_rpg_id` / `clase_tpa_id` opcionales, flags `presion`, `dolor`, `lesion`).
- [ ] En el modal de asistencia TPA: campo de nota por alumno (hoy `asistencia_tpa.nota` existe pero **no hay forma de escribirla**).
- [ ] En el turno RPG: la nota existe; mostrarla como "evolución" y no como "observación del turno".
- [ ] Poder agregar una nota libre desde la historia clínica.
- [ ] Pestaña "Evolución" en la historia clínica: notas + asistencias en una sola línea de tiempo.

### TPA
- [ ] **Agregar alumno no fijo a una clase** (recupera / viene de otro horario). Hoy los estados `recupera` y `vino_otra_clase` solo se pueden asignar a alumnos fijos de ese horario, lo cual no tiene sentido. Debe mostrarse en la grilla de esa semana.
- [ ] **Horarios reales configurables** en lugar de 08:00–20:00 fijo + los de la DB. Los de Pau: L y M 10:30, 11:30, 12:30, 16, 17, 18, 19; V igual sin 19.
- [ ] **Cupo configurable** (hoy hardcodeado en 5; su grilla tiene 4).
- [ ] Poder volver un estado a "sin marcar" (hoy si se elige `pendiente` después de haber guardado otro estado, no se guarda nada y queda el anterior).
- [ ] Botón "Todos presentes" en el registro rápido.
- [ ] Cancelar una clase entera (feriado, enfermedad) en un toque.
- [ ] Mostrar en la grilla general quién pagó el mes (el "verde" de su Word).
- [ ] Vista para celular: selector de día + lista de horarios (la grilla de 4 columnas no entra en 390px).

### RPG
- [ ] Tipo de sesión como lista (RPG, masajes, evaluación inicial; editable), no texto libre con default "RPG".
- [ ] Botón eliminar turno (la query `deleteSesionRPG` existe, no hay UI).
- [ ] Vista celular: lista por día en vez de calendario de 7 columnas.
- [ ] El tooltip de `TurnoCard` dice "Mes pagado/pendiente", pero en RPG el pago es por sesión.
- [ ] Crear paciente nuevo rápido desde el modal de turno.

### Historia clínica
- [ ] Mostrar **Evaluación inicial** (se carga en el formulario pero no aparece en el modal).
- [ ] Editar la ficha desde el mismo modal.
- [ ] Teléfono tocable (llamar / WhatsApp).
- [ ] Evaluar guardar fecha de nacimiento en vez de edad (la edad queda desactualizada).

## Fase 2 — Pagos y planes

- [ ] Definir modelo con Pau: TPA = plan mensual por frecuencia; RPG = por sesión. Hoy la pantalla Pagos lista a **todos** los pacientes activos con un pago mensual, incluidos los de RPG → mezcla y posible doble conteo.
- [ ] Tabla de planes/precios configurable (hoy hay defaults hardcodeados de $12.000 y $8.000; su ejemplo es TPA 1×/semana $40.000).
- [ ] Resumen del mes: cobrado, pendiente, deudores; separado RPG / TPA.

## Fase 3 — Extras sugeridos (después del núcleo)

- [ ] Búsqueda global funcional en el Header (hoy el input no hace nada).
- [ ] Quitar la campana con punto rojo fijo o hacerla real (alertas del día).
- [ ] Alertas mejoradas: basadas en flags explícitos y en notas **recientes** (hoy un "dolor" escrito hace un año dispara la alerta para siempre); poder descartarlas.
- [ ] Lista de espera con UI y "Liberar cupo" (la tabla existe, no hay pantalla).
- [ ] Vista mensual TPA (ocupación, huecos, cancelaciones).
- [ ] Estadísticas simples: activos, faltas del mes, ocupación, ingresos.

## Fase 4 — Calidad de código

- [ ] Corregir los 22 errores de lint (tipar errores como `unknown`, quitar `any` de `queries.ts` y páginas).
- [ ] Mover `cn()` de `Navigation.tsx` a `src/lib/utils.ts`.
- [ ] Centralizar estados en `src/lib/estados.ts` (hoy duplicados en `TpaClaseModal`, `TpaWeeklyView`, `HistoriaClinicaModal`).
- [ ] Componentes UI base en `src/components/ui/` (Button, Input, Modal, Badge, Toast, ConfirmDialog).
- [ ] Reemplazar `alert()` / `confirm()` por toast y diálogo propios.
- [ ] Partir componentes > 300 líneas (`HistoriaClinicaModal`, `TpaClaseModal`, `pacientes/page`, `pagos/page`).
- [ ] Instalar `tw-animate-css` o quitar las clases `animate-in` (hoy no tienen efecto).
- [ ] Limpiar `globals.css` (variables Geist sin uso) y el comentario suelto en `layout.tsx`.
- [ ] `TpaWeeklyView`: calcular fechas con `addDays` en lugar de sumar milisegundos.
- [ ] Manejo de errores visible en las cargas (hoy solo `console.error`, la usuaria no se entera).
- [ ] README propio (hoy es el de `create-next-app`).

## Fase 5 — Puesta en marcha

- [ ] Carga inicial: pacientes actuales y horarios fijos TPA (planilla CSV → script de importación).
- [ ] Deploy en Vercel con variables de entorno.
- [ ] Probar con Pau una semana real en paralelo al Word antes de abandonarlo.
- [ ] Backup: confirmar backups de Supabase o exportación periódica.

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

## Bugs detectados

| # | Dónde | Problema |
|---|---|---|
| 1 | `TpaWeeklyView` / `TpaClaseModal` | **Confirmado.** Horas `"HH:mm"` vs `"HH:mm:ss"`: filas duplicadas, asistencia que no se ve y error de unique al re-guardar una clase. |
| 2 | `TpaClaseModal` | Volver un alumno a "pendiente" no se guarda. |
| 3 | `TpaClaseModal` | ~~Clases duplicadas~~ **Descartado:** existe `unique (fecha, hora)`. Pero ver #1: el unique hace fallar el segundo guardado. |
| 9 | Supabase | **Confirmado.** Políticas RLS "permitir todo a público": la anon key da acceso total. |
| 4 | `HistoriaClinicaModal` | No muestra `evaluacion_inicial`. |
| 5 | `HistoriaClinicaModal` | Alertas por palabra clave sobre **todo** el historial, no lo reciente. |
| 6 | `Header` | El buscador no busca nada; campana con notificación falsa. |
| 7 | `pagos/page` | Precios por defecto hardcodeados; mezcla RPG (por sesión) con mensual. |
| 8 | Global | Clases `animate-in` sin plugin instalado → no animan. |
