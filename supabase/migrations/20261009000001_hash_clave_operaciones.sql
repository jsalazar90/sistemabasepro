-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD: CLAVE DE OPERACIONES CON HASH Y VERIFICACIÓN EN SERVIDOR
-- Archivo: 20261009000001_hash_clave_operaciones.sql
-- ==============================================================================
-- Antes: usuarios.clave_operaciones guardaba la clave en texto plano (con un
--        valor por defecto fijo) y el navegador la comparaba localmente.
-- Ahora: la clave vive como hash bcrypt en una tabla sin acceso directo y solo
--        se verifica/cambia mediante funciones SECURITY DEFINER, con límite de
--        intentos fallidos.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 1. Tabla de hashes (RLS activado y SIN políticas: nadie la lee desde el cliente)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios_claves_operaciones (
  usuario_id     UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  clave_hash     TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.usuarios_claves_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usuarios_claves_operaciones FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Registro de intentos (para bloqueo por fuerza bruta y trazabilidad)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clave_operaciones_intentos (
  id         BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL,
  exitoso    BOOLEAN NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clave_intentos_usuario_fecha
  ON public.clave_operaciones_intentos (usuario_id, creado_en DESC);
ALTER TABLE public.clave_operaciones_intentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clave_operaciones_intentos FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.clave_operaciones_intentos_id_seq FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Migrar claves existentes a hash y eliminar la columna en texto plano
--    La clave por defecto histórica NO se migra: obliga a definir una nueva.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'clave_operaciones'
  ) THEN
    EXECUTE $q$
      INSERT INTO public.usuarios_claves_operaciones (usuario_id, clave_hash)
      SELECT id, extensions.crypt(btrim(clave_operaciones), extensions.gen_salt('bf', 10))
      FROM public.usuarios
      WHERE (role = 'Master' OR lower(email) = 'jhoansg@gmail.com')
        AND clave_operaciones IS NOT NULL
        AND btrim(clave_operaciones) <> ''
        AND btrim(clave_operaciones) <> '19072828'
      ON CONFLICT (usuario_id) DO NOTHING
    $q$;
    EXECUTE 'ALTER TABLE public.usuarios DROP COLUMN clave_operaciones';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Definir / cambiar la clave de un usuario Master (solo Master)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_clave_operaciones(p_usuario_id UUID, p_nueva TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clave TEXT := btrim(COALESCE(p_nueva, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Solo un Administrador Master puede definir la clave de operaciones.';
  END IF;
  IF length(v_clave) < 6 THEN
    RAISE EXCEPTION 'La clave de operaciones debe tener al menos 6 caracteres.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id AND (u.role = 'Master' OR lower(u.email) = 'jhoansg@gmail.com')
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no es Master.';
  END IF;

  INSERT INTO public.usuarios_claves_operaciones (usuario_id, clave_hash, actualizado_en)
  VALUES (p_usuario_id, extensions.crypt(v_clave, extensions.gen_salt('bf', 10)), now())
  ON CONFLICT (usuario_id) DO UPDATE
    SET clave_hash = EXCLUDED.clave_hash, actualizado_en = now();

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Verificar la clave (cualquier usuario autenticado; compara contra Masters activos)
--    Bloquea tras 5 intentos fallidos en 15 minutos.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_clave_operaciones(p_clave TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_fallos INT;
  v_ok     BOOLEAN;
  v_clave  TEXT := btrim(COALESCE(p_clave, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  IF v_clave = '' THEN
    RETURN FALSE;
  END IF;

  SELECT count(*) INTO v_fallos
  FROM public.clave_operaciones_intentos
  WHERE usuario_id = v_uid AND NOT exitoso AND creado_en > now() - interval '15 minutes';

  IF v_fallos >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos fallidos. Espere 15 minutos para volver a intentar.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_claves_operaciones c
    JOIN public.usuarios u ON u.id = c.usuario_id
    WHERE u.activo = TRUE
      AND (u.role = 'Master' OR lower(u.email) = 'jhoansg@gmail.com')
      AND c.clave_hash = extensions.crypt(v_clave, c.clave_hash)
  ) INTO v_ok;

  INSERT INTO public.clave_operaciones_intentos (usuario_id, exitoso) VALUES (v_uid, v_ok);
  DELETE FROM public.clave_operaciones_intentos WHERE creado_en < now() - interval '30 days';

  RETURN v_ok;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ¿Tiene clave configurada? (solo Master; no revela la clave ni el hash)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clave_operaciones_configurada(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_master_admin()
     AND EXISTS (SELECT 1 FROM public.usuarios_claves_operaciones WHERE usuario_id = p_usuario_id);
$$;

-- ------------------------------------------------------------------------------
-- 7. Permisos: solo usuarios autenticados pueden ejecutar las funciones
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_clave_operaciones(UUID, TEXT)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_clave_operaciones(TEXT)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clave_operaciones_configurada(UUID)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clave_operaciones(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_clave_operaciones(TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.clave_operaciones_configurada(UUID)  TO authenticated;
