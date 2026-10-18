# AUTH.md — Configuración de Supabase Auth (proyecto `pau`)

La configuración de Auth vive en el **dashboard** de Supabase y no queda versionada en las migraciones. Este archivo es la fuente de verdad: si se cambia algo en el dashboard, se actualiza acá.

> ⚠️ El repo es público: **no** escribir acá emails, UIDs, contraseñas ni claves reales.

## Modelo

- Login con **email + contraseña**. Una sola usuaria: Pau.
- Dos capas de protección (decisión del 17/10/2026, "opción 3"):
  1. **Registro público deshabilitado:** nadie puede crearse una cuenta desde la app ni desde la API.
  2. **Lista de autorizadas en la base:** las políticas RLS exigen que el UID esté en `private.usuarias_autorizadas` (migración `20261017000001_rls_solo_usuaria_autorizada.sql`). Aunque alguien consiguiera una cuenta, no vería nada.
- Logout con `scope: 'local'`: salir en un dispositivo no cierra la sesión en los demás.

## Configuración del dashboard

### Authentication → Sign In / Providers
| Opción | Valor |
|---|---|
| Allow new users to sign up | **Desactivado** |
| Allow anonymous sign-ins | **Desactivado** (el sign-in anónimo da rol `authenticated`) |
| Email provider | Activado |
| Confirm email | Indiferente: los usuarios se crean ya confirmados desde el dashboard |
| Minimum password length | 12 o más, si la opción está disponible |
| Otros proveedores (Google, GitHub, etc.) | **Todos desactivados** |

> ⚠️ **"Allow new users to sign up" y "Allow anonymous sign-ins" son dos interruptores distintos.** Desactivar uno no desactiva el otro. En la primera prueba (18/10/2026) los anónimos estaban desactivados pero el registro seguía habilitado, y se pudo crear una cuenta con la anon key. Después de tocar cualquiera de los dos, **verificar ambos con `curl`** (abajo).

### Verificar con `curl` que estén desactivados

```bash
export URL=https://<ref-del-proyecto>.supabase.co
export ANON=<anon key>

# 1. Registro público ("Allow new users to sign up")
curl -s -w "\nHTTP %{http_code}\n" -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"email":"prueba-registro@example.com","password":"una-clave-larga-123"}'
# Esperado: HTTP 422 con "error_code":"signup_disabled"
# ❌ Si devuelve 200 con un usuario: el registro está HABILITADO. Desactivarlo y borrar
#    ese usuario en Authentication → Users.

# 2. Ingreso anónimo ("Allow anonymous sign-ins")
curl -s -w "\nHTTP %{http_code}\n" -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{}'
# Esperado: HTTP 422 con "error_code":"anonymous_provider_disabled"
# ❌ Si devuelve 200 con un access_token: los anónimos están HABILITADOS. Desactivarlos y
#    borrar el usuario anónimo creado.

# 3. Datos sin sesión (RLS + permisos de anon)
curl -s -w "\nHTTP %{http_code}\n" "$URL/rest/v1/pacientes?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# Esperado: HTTP 401 con "code":"42501" (permission denied)
```

Aunque alguno de los dos quedara habilitado por error, la segunda capa (lista de autorizadas) impide que esa cuenta vea datos. Igual hay que corregirlo: las cuentas basura ocupan Auth y la app le mostraría a esa persona el aviso de "no autorizado".

### Authentication → URL Configuration
| Opción | Valor |
|---|---|
| Site URL | `http://localhost:3000` mientras no haya deploy; después, la URL de producción de Vercel (`https://<proyecto>.vercel.app`) |
| Redirect URLs | `http://localhost:3000/**` y `https://<proyecto>.vercel.app/**` |

Con email + contraseña no se usan links por mail, pero conviene tenerlas bien para un futuro "olvidé mi contraseña".

### Settings → API → Exposed schemas
Solo `public` y `graphql_public`. **`private` no tiene que estar expuesto.**

## Crear la usuaria y autorizarla

1. **Authentication → Users → Add user → Create new user**
   - Email de la usuaria y una contraseña **larga** (16+ caracteres; se recomienda un gestor de contraseñas).
   - Tildar **"Auto Confirm User"**.
2. **Autorizarla en la base** (SQL Editor). Requiere la migración `20261017000001` aplicada:
   ```sql
   insert into private.usuarias_autorizadas (user_id, nota)
   select id, 'Pau' from auth.users where email = '<email de la usuaria>';
   -- tiene que decir "INSERT 0 1"; si dice "INSERT 0 0", el email no coincide
   ```
3. Verificar:
   ```sql
   select a.user_id, u.email, a.nota
   from private.usuarias_autorizadas a
   join auth.users u on u.id = a.user_id;
   ```

4. **Verificar desde la app** (con la migración `20261018000001_funcion_soy_autorizada.sql` aplicada): un usuario logueado que no está en la lista ve el aviso "Tu usuario no está autorizado" en lugar de pantallas vacías. Desde SQL, como ese usuario, `select public.soy_autorizada();` devuelve `true`/`false`; solo la puede ejecutar `authenticated`.

**Quitar el acceso** a alguien: `delete from private.usuarias_autorizadas where user_id = '<uid>';` Su sesión sigue existiendo, pero deja de ver datos de inmediato. Para cerrarle la sesión también, borrar o banear el usuario en Authentication → Users.

## Contraseña olvidada

No hay "Olvidé mi contraseña" en la app. El SMTP por defecto del plan Free solo envía mails a direcciones del equipo de la organización y con un límite muy bajo por hora, así que el mail de recuperación probablemente no le llegaría a Pau.

Procedimiento: Facu entra a **Authentication → Users → (usuaria) → Reset password / Update user** y le pone una contraseña nueva. Para dar autoservicio hace falta configurar un SMTP propio (Authentication → Emails → SMTP Settings) y agregar la pantalla.

## Variables de entorno

| Variable | Dónde | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel (Production + Preview) | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` y Vercel (Production + Preview) | Clave pública (va en el JS de la app; la seguridad la da RLS) |

**Nunca** usar la `service_role` key en la app ni en Vercel: saltea RLS.

## Pendiente (después de la Fase 0)

- Migrar las claves de firma JWT a **asimétricas** (dashboard → JWT Keys) para que `getClaims()` en `proxy.ts` valide el token localmente, sin consultar al servidor de Auth en cada navegación.
- Pasar de la anon key vieja (`eyJ…`) a la **publishable key** nueva (`sb_publishable_…`).
