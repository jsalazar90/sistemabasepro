-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD: PREVENCIÓN DE ESCALADA DE PRIVILEGIOS EN USUARIOS
-- Archivo: 20261008000001_prevent_privilege_escalation.sql
-- ==============================================================================
-- 1. Impide que usuarios no autorizados modifiquen el campo 'role' o 'activo'
-- 2. Asegura que únicamente los Administradores Master puedan cambiar roles
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_prevent_user_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el usuario no es Master Admin, bloquear cualquier alteración a 'role' o 'activo'
  IF NOT public.is_master_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Violación de Seguridad: No posee privilegios para modificar roles de usuario.';
    END IF;
    IF NEW.activo IS DISTINCT FROM OLD.activo THEN
      RAISE EXCEPTION 'Violación de Seguridad: No posee privilegios para modificar el estado de activación.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_role_escalation ON public.usuarios;
CREATE TRIGGER trg_prevent_user_role_escalation
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_user_role_escalation();
