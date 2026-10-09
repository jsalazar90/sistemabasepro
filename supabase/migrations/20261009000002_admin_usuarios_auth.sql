-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD: GESTIÓN DE USUARIOS Y CONTRASEÑAS EN SERVIDOR
-- Archivo: 20261009000002_admin_usuarios_auth.sql
-- ==============================================================================
-- Antes: el navegador creaba usuarios con auth.signUp (podía cambiar la sesión del
--        Master), "cambiar contraseña" solo tocaba usuarios.password_hash (sin efecto
--        real en el login) y cada inicio de sesión subía un hash a public.usuarios.
-- Ahora: solo un Master crea usuarios y cambia contraseñas mediante funciones del
--        servidor que escriben en Supabase Auth. public.usuarios deja de guardar hashes.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 1. Crear usuario (solo Master). Devuelve el id del usuario en public.usuarios
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_crear_usuario(
  p_email    TEXT,
  p_password TEXT,
  p_nombre   TEXT,
  p_role     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email   TEXT := lower(btrim(COALESCE(p_email, '')));
  v_nombre  TEXT := btrim(COALESCE(p_nombre, ''));
  v_role    TEXT := btrim(COALESCE(p_role, 'Operador'));
  v_auth_id UUID;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Solo un Administrador Master puede crear usuarios.';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Correo electrónico inválido.';
  END IF;
  IF length(COALESCE(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
  END IF;
  IF v_role NOT IN ('Operador', 'Contador', 'Vendedor', 'SuperAdmin', 'Master') THEN
    RAISE EXCEPTION 'Rol inválido.';
  END IF;
  IF v_nombre = '' THEN
    v_nombre := split_part(v_email, '@', 1);
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese correo. Use "cambiar contraseña" si necesita restablecerla.';
  END IF;

  v_auth_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, v_auth_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('nombre', v_nombre),
    now(), now(),
    '', '', '', ''
  );

  BEGIN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_auth_id,
            jsonb_build_object('sub', v_auth_id::text, 'email', v_email),
            'email', v_auth_id::text, now(), now(), now());
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_auth_id,
            jsonb_build_object('sub', v_auth_id::text, 'email', v_email),
            'email', now(), now(), now());
  END;

  INSERT INTO public.usuarios (id, email, nombre, role, activo)
  VALUES (v_auth_id, v_email, v_nombre, v_role, TRUE)
  ON CONFLICT (email) DO UPDATE
    SET nombre = EXCLUDED.nombre, role = EXCLUDED.role, activo = TRUE
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Cambiar la contraseña de un usuario (solo Master) y cerrar sus sesiones
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cambiar_password(p_usuario_id UUID, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email   TEXT;
  v_auth_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Solo un Administrador Master puede cambiar contraseñas.';
  END IF;
  IF length(COALESCE(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
  END IF;

  SELECT lower(email) INTO v_email FROM public.usuarios WHERE id = p_usuario_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_email;
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Este usuario no tiene cuenta de acceso en Supabase Auth.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_auth_id;

  -- Cierra las sesiones abiertas de ese usuario para que deba entrar con la nueva contraseña
  DELETE FROM auth.sessions WHERE user_id = v_auth_id;

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. public.usuarios deja de guardar hashes de contraseña
-- ------------------------------------------------------------------------------
UPDATE public.usuarios SET password_hash = NULL WHERE password_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_usuarios_sin_password_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.password_hash := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_sin_password_hash ON public.usuarios;
CREATE TRIGGER trg_usuarios_sin_password_hash
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_usuarios_sin_password_hash();

-- ------------------------------------------------------------------------------
-- 4. Permisos
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_crear_usuario(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cambiar_password(UUID, TEXT)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crear_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_password(UUID, TEXT)          TO authenticated;
