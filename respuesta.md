# ¿Puedo leer las tablas del proyecto `pau`? — Sí ✅

Ya estoy conectado a Supabase por MCP y apunta al proyecto correcto:
`https://dmwtoozbctnwccaaitos.supabase.co` (ref `dmwtoozbctnwccaaitos`).

## Tablas en `public`

| Tabla | Filas | RLS activado |
|---|---|---|
| `pacientes` | 3 | sí |
| `sesiones_rpg` | 5 | sí |
| `horarios_tpa` | 3 | sí |
| `clases_tpa` | 1 | sí |
| `asistencia_tpa` | 0 | sí |
| `pagos` | 1 | sí |
| `lista_espera` | 0 | sí |

Son las 7 tablas que figuran en CLAUDE.md. Parecen datos de prueba (muy pocas filas).

## Qué hice
- Solo lectura: listé las tablas y conté filas. No modifiqué nada ni leí el contenido de los registros (son datos de salud).
- RLS está **activado** en todas, pero según PENDIENTES.md las políticas permiten todo a cualquiera, así que en la práctica siguen abiertas.

## Qué puedo hacer ahora
1. ¿Querés que compare el esquema real (columnas, constraints, políticas RLS) con la migración `supabase/migrations/20260520000000_esquema_inicial.sql` para confirmar que coinciden?
2. ¿Querés que revise los advisors de seguridad de Supabase (políticas abiertas, etc.) como paso previo a la Fase 0?
3. ¿Sigo con alguna tarea concreta de PENDIENTES.md?
