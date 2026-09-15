-- ============================================================================
-- MIGRATION: 20260915000003_audit_trail_system.sql
-- DESCRIPCIÓN: Pista de Auditoría Forense Empresarial (audit_logs) con disparadores
--              automáticos para tracking inmutable de transacciones críticas.
-- ============================================================================

-- 1. TABLA INMUTABLE DE AUDITORÍA
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    tabla VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    registro_id UUID,
    usuario_id UUID,
    usuario_email VARCHAR(255),
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    detalles TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de alto rendimiento para filtros forenses
CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_fecha ON public.auditoria_logs(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_op ON public.auditoria_logs(tabla, operacion);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON public.auditoria_logs(registro_id);

-- 2. FUNCIÓN DISPARADORA GENÉRICA (TRIGGER FUNCTION)
CREATE OR REPLACE FUNCTION public.fn_auditoria_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID := NULL;
    v_registro_id UUID := NULL;
    v_user_id UUID;
    v_user_email TEXT;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_detalles TEXT := '';
BEGIN
    v_user_id := auth.uid();
    v_user_email := COALESCE(auth.jwt() ->> 'email', 'sistema@erp.local');

    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        IF v_old_data ? 'password' THEN v_old_data := v_old_data - 'password'; END IF;
        IF v_old_data ? 'claveOperaciones' THEN v_old_data := v_old_data - 'claveOperaciones'; END IF;
        IF v_old_data ? 'clave_operaciones' THEN v_old_data := v_old_data - 'clave_operaciones'; END IF;

        IF v_old_data ? 'empresa_id' AND (v_old_data->>'empresa_id') IS NOT NULL AND (v_old_data->>'empresa_id') <> '' THEN 
            v_empresa_id := (v_old_data->>'empresa_id')::UUID; 
        END IF;
        IF v_old_data ? 'id' AND (v_old_data->>'id') IS NOT NULL AND (v_old_data->>'id') <> '' THEN 
            v_registro_id := (v_old_data->>'id')::UUID; 
        END IF;
        v_detalles := 'Eliminación en tabla ' || TG_TABLE_NAME || ' [ID: ' || COALESCE(v_registro_id::TEXT, 'N/A') || ']';

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);

        IF v_old_data ? 'password' THEN v_old_data := v_old_data - 'password'; END IF;
        IF v_old_data ? 'claveOperaciones' THEN v_old_data := v_old_data - 'claveOperaciones'; END IF;
        IF v_old_data ? 'clave_operaciones' THEN v_old_data := v_old_data - 'clave_operaciones'; END IF;
        IF v_new_data ? 'password' THEN v_new_data := v_new_data - 'password'; END IF;
        IF v_new_data ? 'claveOperaciones' THEN v_new_data := v_new_data - 'claveOperaciones'; END IF;
        IF v_new_data ? 'clave_operaciones' THEN v_new_data := v_new_data - 'clave_operaciones'; END IF;

        IF v_new_data ? 'empresa_id' AND (v_new_data->>'empresa_id') IS NOT NULL AND (v_new_data->>'empresa_id') <> '' THEN
            v_empresa_id := (v_new_data->>'empresa_id')::UUID;
        ELSIF v_old_data ? 'empresa_id' AND (v_old_data->>'empresa_id') IS NOT NULL AND (v_old_data->>'empresa_id') <> '' THEN
            v_empresa_id := (v_old_data->>'empresa_id')::UUID;
        END IF;

        IF v_new_data ? 'id' AND (v_new_data->>'id') IS NOT NULL AND (v_new_data->>'id') <> '' THEN 
            v_registro_id := (v_new_data->>'id')::UUID; 
        END IF;
        v_detalles := 'Modificación en tabla ' || TG_TABLE_NAME || ' [ID: ' || COALESCE(v_registro_id::TEXT, 'N/A') || ']';

    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        IF v_new_data ? 'password' THEN v_new_data := v_new_data - 'password'; END IF;
        IF v_new_data ? 'claveOperaciones' THEN v_new_data := v_new_data - 'claveOperaciones'; END IF;
        IF v_new_data ? 'clave_operaciones' THEN v_new_data := v_new_data - 'clave_operaciones'; END IF;

        IF v_new_data ? 'empresa_id' AND (v_new_data->>'empresa_id') IS NOT NULL AND (v_new_data->>'empresa_id') <> '' THEN 
            v_empresa_id := (v_new_data->>'empresa_id')::UUID; 
        END IF;
        IF v_new_data ? 'id' AND (v_new_data->>'id') IS NOT NULL AND (v_new_data->>'id') <> '' THEN 
            v_registro_id := (v_new_data->>'id')::UUID; 
        END IF;
        v_detalles := 'Creación en tabla ' || TG_TABLE_NAME || ' [ID: ' || COALESCE(v_registro_id::TEXT, 'N/A') || ']';
    END IF;

    -- Solo registrar si hay empresa_id asociada
    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.auditoria_logs (
            empresa_id,
            tabla,
            operacion,
            registro_id,
            usuario_id,
            usuario_email,
            valores_anteriores,
            valores_nuevos,
            detalles,
            created_at
        ) VALUES (
            v_empresa_id,
            TG_TABLE_NAME,
            TG_OP,
            v_registro_id,
            v_user_id,
            v_user_email,
            v_old_data,
            v_new_data,
            v_detalles,
            NOW()
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 3. ASIGNACIÓN DE TRIGGERS A TABLAS CLAVE
DROP TRIGGER IF EXISTS trg_audit_facturas_venta ON public.facturas_venta;
CREATE TRIGGER trg_audit_facturas_venta
AFTER INSERT OR UPDATE OR DELETE ON public.facturas_venta
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_audit_cuentas_cobrar_cxc ON public.cuentas_cobrar_cxc;
CREATE TRIGGER trg_audit_cuentas_cobrar_cxc
AFTER INSERT OR UPDATE OR DELETE ON public.cuentas_cobrar_cxc
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_audit_cuentas_pagar_cxp ON public.cuentas_pagar_cxp;
CREATE TRIGGER trg_audit_cuentas_pagar_cxp
AFTER INSERT OR UPDATE OR DELETE ON public.cuentas_pagar_cxp
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_audit_comprobantes_diario ON public.comprobantes_diario;
CREATE TRIGGER trg_audit_comprobantes_diario
AFTER INSERT OR UPDATE OR DELETE ON public.comprobantes_diario
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_audit_productos ON public.productos;
CREATE TRIGGER trg_audit_productos
AFTER INSERT OR UPDATE OR DELETE ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_audit_configuracion_contable ON public.configuracion_contable;
CREATE TRIGGER trg_audit_configuracion_contable
AFTER INSERT OR UPDATE OR DELETE ON public.configuracion_contable
FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

-- 4. SEGURIDAD Y POLÍTICAS RLS PARA AUDITORÍA
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_select_tenant" ON public.auditoria_logs;
CREATE POLICY "auditoria_select_tenant" ON public.auditoria_logs
FOR SELECT TO authenticated
USING (
    empresa_id IN (
        SELECT ue.empresa_id 
        FROM usuario_empresas ue 
        WHERE ue.usuario_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM usuarios u 
        WHERE u.id = auth.uid() AND u.role = 'Master'
    )
);

GRANT SELECT ON public.auditoria_logs TO authenticated;
