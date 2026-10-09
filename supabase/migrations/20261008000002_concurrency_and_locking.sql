-- ==============================================================================
-- MIGRACIÓN 20261008000002: FUNCIONES ATÓMICAS Y PROTECCIÓN CONTRA RACE CONDITIONS
-- Halley ERP Pro / Concurrencia y Bloqueo Pesimista Multi-Usuario
-- ==============================================================================

-- 1. REGISTRO ATÓMICO DE ABONO A CUENTA POR COBRAR (CXC) CON BLOQUEO FOR UPDATE
CREATE OR REPLACE FUNCTION registrar_abono_cxc_atomico(
    p_empresa_id VARCHAR,
    p_cxc_id VARCHAR,
    p_monto NUMERIC,
    p_fecha DATE DEFAULT CURRENT_DATE,
    p_recibo_numero VARCHAR DEFAULT '',
    p_notas VARCHAR DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_cxc cuentas_cobrar_cxc%ROWTYPE;
    v_nuevo_saldo NUMERIC(18, 4);
    v_nuevo_estado VARCHAR(20);
    v_monto_abs NUMERIC(18, 4);
BEGIN
    v_monto_abs := ABS(p_monto);

    -- Bloqueo pesimista de la cuenta por cobrar para evitar sobreescritura de saldo
    SELECT * INTO v_cxc
    FROM cuentas_cobrar_cxc
    WHERE id = p_cxc_id AND empresa_id = p_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cuenta por cobrar no encontrada: ' || p_cxc_id
        );
    END IF;

    v_nuevo_saldo := GREATEST(0.0000, COALESCE(v_cxc.saldo, 0.0000) - v_monto_abs);
    v_nuevo_estado := CASE WHEN v_nuevo_saldo <= 0.009 THEN 'pagada' ELSE 'parcial' END;

    UPDATE cuentas_cobrar_cxc SET
        saldo = v_nuevo_saldo,
        estado = v_nuevo_estado,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_cxc_id;

    -- Sincronizar factura de venta asociada si existe
    IF v_cxc.factura_id IS NOT NULL AND v_cxc.factura_id <> '' THEN
        UPDATE facturas_venta SET
            saldo_pendiente = v_nuevo_saldo,
            saldo_pendiente_bs = ROUND((v_nuevo_saldo * COALESCE(tasa_cambio, 1.0))::numeric, 2),
            estado = CASE WHEN v_nuevo_saldo <= 0.009 THEN 'cobrada' ELSE 'parcial' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE (id = v_cxc.factura_id OR numero = v_cxc.factura_id)
          AND empresa_id = p_empresa_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'cxc_id', p_cxc_id,
        'saldo_anterior', v_cxc.saldo,
        'saldo_resultante', v_nuevo_saldo,
        'estado', v_nuevo_estado
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 2. ACUMULACIÓN ATÓMICA DE TRANSACCIÓN EN LOTE POS CON BLOQUEO FOR UPDATE
CREATE OR REPLACE FUNCTION acumular_transaccion_lote_pos_atomico(
    p_empresa_id VARCHAR,
    p_terminal_id VARCHAR,
    p_transaccion JSONB,
    p_monto_bs NUMERIC DEFAULT 0,
    p_monto_usd NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_lote lotes_pos%ROWTYPE;
    v_tx_actuales JSONB;
    v_nuevas_tx JSONB;
    v_total_ops INTEGER;
    v_nuevo_monto_bs NUMERIC(18, 2);
    v_nuevo_monto_usd NUMERIC(18, 2);
BEGIN
    -- Bloquear lote abierto de este terminal
    SELECT * INTO v_lote
    FROM lotes_pos
    WHERE empresa_id = p_empresa_id 
      AND terminal_id = p_terminal_id 
      AND estado = 'abierto'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Crear lote en curso si no existe
        INSERT INTO lotes_pos (
            id, empresa_id, terminal_id, lote_numero, estado,
            fecha_apertura, total_operaciones, monto_bruto_sistema, monto_bruto_usd,
            transacciones, created_at
        ) VALUES (
            gen_random_uuid()::text,
            p_empresa_id,
            p_terminal_id,
            'EN CURSO',
            'abierto',
            CURRENT_DATE,
            1,
            ROUND(p_monto_bs::numeric, 2),
            ROUND(p_monto_usd::numeric, 2),
            jsonb_build_array(p_transaccion),
            CURRENT_TIMESTAMP
        )
        RETURNING * INTO v_lote;

        RETURN jsonb_build_object(
            'success', true,
            'lote_id', v_lote.id,
            'total_operaciones', 1,
            'monto_bruto_sistema', v_lote.monto_bruto_sistema,
            'monto_bruto_usd', v_lote.monto_bruto_usd
        );
    END IF;

    v_tx_actuales := COALESCE(v_lote.transacciones, '[]'::jsonb);
    IF jsonb_typeof(v_tx_actuales) <> 'array' THEN
        v_tx_actuales := '[]'::jsonb;
    END IF;

    v_nuevas_tx := v_tx_actuales || jsonb_build_array(p_transaccion);
    v_total_ops := jsonb_array_length(v_nuevas_tx);
    v_nuevo_monto_bs := ROUND((COALESCE(v_lote.monto_bruto_sistema, 0) + p_monto_bs)::numeric, 2);
    v_nuevo_monto_usd := ROUND((COALESCE(v_lote.monto_bruto_usd, 0) + p_monto_usd)::numeric, 2);

    UPDATE lotes_pos SET
        transacciones = v_nuevas_tx,
        total_operaciones = v_total_ops,
        monto_bruto_sistema = v_nuevo_monto_bs,
        monto_bruto_usd = v_nuevo_monto_usd,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_lote.id;

    RETURN jsonb_build_object(
        'success', true,
        'lote_id', v_lote.id,
        'total_operaciones', v_total_ops,
        'monto_bruto_sistema', v_nuevo_monto_bs,
        'monto_bruto_usd', v_nuevo_monto_usd
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
