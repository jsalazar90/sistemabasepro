-- ==============================================================================
-- MIGRACIÓN: AGREGAR COLUMNA clave_operaciones A LA TABLA usuarios
-- ==============================================================================
ALTER TABLE IF EXISTS usuarios 
ADD COLUMN IF NOT EXISTS clave_operaciones TEXT DEFAULT '19072828';

COMMENT ON COLUMN usuarios.clave_operaciones IS 'Clave especial de seguridad requerida para autorizaciones críticas (anulaciones, eliminaciones)';
