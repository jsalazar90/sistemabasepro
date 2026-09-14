-- ==============================================================================
-- Migración: Agregar columnas cliente_nombre a cobranzas y proveedor_nombre a pagos_realizados
-- ==============================================================================

ALTER TABLE IF EXISTS cobranzas 
  ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255);

ALTER TABLE IF EXISTS pagos_realizados 
  ADD COLUMN IF NOT EXISTS proveedor_nombre VARCHAR(255);

-- Asegurar políticas RLS
ALTER TABLE IF EXISTS cobranzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pagos_realizados ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir todo en cobranzas" ON cobranzas;
    CREATE POLICY "Permitir todo en cobranzas" ON cobranzas FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo en pagos_realizados" ON pagos_realizados;
    CREATE POLICY "Permitir todo en pagos_realizados" ON pagos_realizados FOR ALL USING (true) WITH CHECK (true);
END $$;
