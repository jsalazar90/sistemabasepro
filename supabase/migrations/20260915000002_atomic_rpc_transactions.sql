-- ============================================================================
-- MIGRATION: 20260915000002_atomic_rpc_transactions.sql
-- DESCRIPCIÓN: Procedimientos almacenados (RPC) con bloqueos pesimistas (FOR UPDATE)
--              para correlativos libres de colisión e integridad transaccional atómica.
-- ============================================================================

-- 1. FUNCIÓN: obtener_siguiente_correlativo
CREATE OR REPLACE FUNCTION public.obtener_siguiente_correlativo(
    p_empresa_id UUID,
    p_tipo_documento TEXT DEFAULT 'factura'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefijo TEXT := '';
    v_correlativo_str TEXT := '1';
    v_correlativo_int INTEGER := 1;
    v_next_int INTEGER := 2;
    v_numero_formateado TEXT;
    v_padding INTEGER := 6;
BEGIN
    IF p_empresa_id IS NULL THEN
        RAISE EXCEPTION 'p_empresa_id no puede ser nulo';
    END IF;

    -- Bloqueo pesimista FOR UPDATE en la empresa para evitar concurrencia
    PERFORM 1 FROM configuracion_contable WHERE empresa_id = p_empresa_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO configuracion_contable (
            empresa_id,
            working_year,
            prefijo_factura,
            correlativo_factura,
            prefijo_cotizacion,
            correlativo_cotizacion,
            prefijo_nota_entrega,
            correlativo_nota_entrega,
            prefijo_recibo,
            correlativo_recibo
        ) VALUES (
            p_empresa_id,
            to_char(CURRENT_DATE, 'YYYY'),
            '',
            '000001',
            '',
            '000001',
            '',
            '000001',
            'REC-',
            '000001'
        )
        ON CONFLICT (empresa_id) DO NOTHING;

        PERFORM 1 FROM configuracion_contable WHERE empresa_id = p_empresa_id FOR UPDATE;
    END IF;

    -- Según el tipo de documento, bloquear e incrementar
    IF p_tipo_documento = 'nota_entrega' THEN
        SELECT COALESCE(prefijo_nota_entrega, ''), COALESCE(correlativo_nota_entrega::TEXT, '1')
        INTO v_prefijo, v_correlativo_str
        FROM configuracion_contable
        WHERE empresa_id = p_empresa_id;

        v_correlativo_int := COALESCE(NULLIF(regexp_replace(v_correlativo_str, '\D', '', 'g'), '')::INTEGER, 1);
        v_next_int := v_correlativo_int + 1;

        UPDATE configuracion_contable
        SET correlativo_nota_entrega = LPAD(v_next_int::TEXT, v_padding, '0'), updated_at = NOW()
        WHERE empresa_id = p_empresa_id;

    ELSIF p_tipo_documento = 'cotizacion' THEN
        SELECT COALESCE(prefijo_cotizacion, ''), COALESCE(correlativo_cotizacion::TEXT, '1')
        INTO v_prefijo, v_correlativo_str
        FROM configuracion_contable
        WHERE empresa_id = p_empresa_id;

        v_correlativo_int := COALESCE(NULLIF(regexp_replace(v_correlativo_str, '\D', '', 'g'), '')::INTEGER, 1);
        v_next_int := v_correlativo_int + 1;

        UPDATE configuracion_contable
        SET correlativo_cotizacion = LPAD(v_next_int::TEXT, v_padding, '0'), updated_at = NOW()
        WHERE empresa_id = p_empresa_id;

    ELSIF p_tipo_documento = 'recibo' THEN
        SELECT COALESCE(prefijo_recibo, 'REC-'), COALESCE(correlativo_recibo::TEXT, '1')
        INTO v_prefijo, v_correlativo_str
        FROM configuracion_contable
        WHERE empresa_id = p_empresa_id;

        v_correlativo_int := COALESCE(NULLIF(regexp_replace(v_correlativo_str, '\D', '', 'g'), '')::INTEGER, 1);
        v_next_int := v_correlativo_int + 1;

        UPDATE configuracion_contable
        SET correlativo_recibo = LPAD(v_next_int::TEXT, v_padding, '0'), updated_at = NOW()
        WHERE empresa_id = p_empresa_id;

    ELSE
        -- 'factura', 'nota_credito', 'nota_debito'
        SELECT COALESCE(prefijo_factura, ''), COALESCE(correlativo_factura::TEXT, '1')
        INTO v_prefijo, v_correlativo_str
        FROM configuracion_contable
        WHERE empresa_id = p_empresa_id;

        IF p_tipo_documento = 'nota_credito' THEN
            v_prefijo := 'NC-';
        ELSIF p_tipo_documento = 'nota_debito' THEN
            v_prefijo := 'ND-';
        END IF;

        v_correlativo_int := COALESCE(NULLIF(regexp_replace(v_correlativo_str, '\D', '', 'g'), '')::INTEGER, 1);
        v_next_int := v_correlativo_int + 1;

        UPDATE configuracion_contable
        SET correlativo_factura = LPAD(v_next_int::TEXT, v_padding, '0'), updated_at = NOW()
        WHERE empresa_id = p_empresa_id;
    END IF;

    -- Formatear número final: PREFIJO + correlativo con padding
    v_numero_formateado := v_prefijo || LPAD(v_correlativo_int::TEXT, v_padding, '0');

    RETURN jsonb_build_object(
        'prefijo', v_prefijo,
        'correlativo_asignado', v_correlativo_int,
        'numero_formateado', v_numero_formateado,
        'siguiente_correlativo', v_next_int,
        'siguiente_correlativo_str', LPAD(v_next_int::TEXT, v_padding, '0')
    );
END;
$$;

-- 2. FUNCIÓN: registrar_factura_venta_atomica
CREATE OR REPLACE FUNCTION public.registrar_factura_venta_atomica(
    p_factura JSONB,
    p_items JSONB,
    p_cxc JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_factura_id UUID;
    v_tipo_documento TEXT;
    v_numero TEXT;
    v_correlativo_data JSONB;
    v_item RECORD;
    v_prod_stock NUMERIC;
    v_cant NUMERIC;
    v_item_id UUID;
BEGIN
    v_empresa_id := (p_factura->>'empresa_id')::UUID;
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'empresa_id es requerido en p_factura';
    END IF;

    v_tipo_documento := COALESCE(p_factura->>'tipo_documento', 'factura');
    v_factura_id := COALESCE((p_factura->>'id')::UUID, uuid_generate_v4());

    IF (p_factura->>'numero') IS NULL OR (p_factura->>'numero') = '' OR (p_factura->>'auto_correlativo')::BOOLEAN = true THEN
        v_correlativo_data := public.obtener_siguiente_correlativo(v_empresa_id, v_tipo_documento);
        v_numero := v_correlativo_data->>'numero_formateado';
    ELSE
        v_numero := p_factura->>'numero';
    END IF;

    -- 1. Insertar Cabecera de Factura de Venta
    INSERT INTO facturas_venta (
        id, empresa_id, numero, control_numero, tipo_documento, condicion, dias_credito,
        cliente_id, vendedor_id, fecha_emision, fecha_vencimiento, moneda, tasa_cambio,
        subtotal, subtotal_bs, base_imponible, base_imponible_bs, monto_exento, monto_exento_bs,
        iva_porcentaje, iva_monto, iva_monto_bs, igtf_porcentaje, igtf_monto, igtf_monto_bs,
        retencion_iva_porcentaje, retencion_iva_monto, retencion_iva_monto_bs,
        comprobante_retencion_iva_numero, comprobante_retencion_iva_fecha,
        retencion_islr_porcentaje, retencion_islr_monto, retencion_islr_monto_bs,
        comprobante_retencion_islr_numero, comprobante_retencion_islr_fecha,
        neto_cobrar, total, total_bs, saldo_pendiente, estado, banco_id, comprobante_id,
        monto_recibido, vuelto, notas, created_at
    ) VALUES (
        v_factura_id, v_empresa_id, v_numero, p_factura->>'control_numero', v_tipo_documento,
        COALESCE(p_factura->>'condicion', 'contado'), COALESCE((p_factura->>'dias_credito')::INTEGER, 0),
        (p_factura->>'cliente_id')::UUID, (p_factura->>'vendedor_id')::UUID,
        (p_factura->>'fecha_emision')::DATE, COALESCE((p_factura->>'fecha_vencimiento')::DATE, (p_factura->>'fecha_emision')::DATE),
        COALESCE(p_factura->>'moneda', 'USD'), COALESCE((p_factura->>'tasa_cambio')::NUMERIC, 1.0),
        COALESCE((p_factura->>'subtotal')::NUMERIC, 0), (p_factura->>'subtotal_bs')::NUMERIC,
        COALESCE((p_factura->>'base_imponible')::NUMERIC, 0), (p_factura->>'base_imponible_bs')::NUMERIC,
        COALESCE((p_factura->>'monto_exento')::NUMERIC, 0), (p_factura->>'monto_exento_bs')::NUMERIC,
        COALESCE((p_factura->>'iva_porcentaje')::NUMERIC, 16), COALESCE((p_factura->>'iva_monto')::NUMERIC, 0),
        (p_factura->>'iva_monto_bs')::NUMERIC, COALESCE((p_factura->>'igtf_porcentaje')::NUMERIC, 0),
        COALESCE((p_factura->>'igtf_monto')::NUMERIC, 0), (p_factura->>'igtf_monto_bs')::NUMERIC,
        (p_factura->>'retencion_iva_porcentaje')::NUMERIC, (p_factura->>'retencion_iva_monto')::NUMERIC,
        (p_factura->>'retencion_iva_monto_bs')::NUMERIC, p_factura->>'comprobante_retencion_iva_numero',
        (p_factura->>'comprobante_retencion_iva_fecha')::DATE, (p_factura->>'retencion_islr_porcentaje')::NUMERIC,
        (p_factura->>'retencion_islr_monto')::NUMERIC, (p_factura->>'retencion_islr_monto_bs')::NUMERIC,
        p_factura->>'comprobante_retencion_islr_numero', (p_factura->>'comprobante_retencion_islr_fecha')::DATE,
        COALESCE((p_factura->>'neto_cobrar')::NUMERIC, (p_factura->>'total')::NUMERIC),
        COALESCE((p_factura->>'total')::NUMERIC, 0), (p_factura->>'total_bs')::NUMERIC,
        COALESCE((p_factura->>'saldo_pendiente')::NUMERIC, 0), COALESCE(p_factura->>'estado', 'emitida'),
        (p_factura->>'banco_id')::UUID, (p_factura->>'comprobante_id')::UUID,
        (p_factura->>'monto_recibido')::NUMERIC, (p_factura->>'vuelto')::NUMERIC,
        p_factura->>'notas', NOW()
    );

    -- 2. Procesar Items y descontar Inventario de forma atómica
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
            id UUID, producto_id UUID, descripcion TEXT, cantidad NUMERIC,
            precio_unitario NUMERIC, exento BOOLEAN, subtotal NUMERIC,
            iva_monto NUMERIC, total NUMERIC, cuenta_ingreso_id UUID,
            cuenta_costo_id UUID, cuenta_inventario_id UUID
        )
        LOOP
            v_item_id := COALESCE(v_item.id, uuid_generate_v4());
            v_cant := COALESCE(v_item.cantidad, 1);

            INSERT INTO facturas_venta_items (
                id, factura_id, producto_id, descripcion, cantidad,
                precio_unitario, exento, subtotal, iva_monto, total,
                cuenta_ingreso_id, cuenta_costo_id, cuenta_inventario_id
            ) VALUES (
                v_item_id, v_factura_id, v_item.producto_id, COALESCE(v_item.descripcion, 'Artículo'),
                v_cant, COALESCE(v_item.precio_unitario, 0), COALESCE(v_item.exento, FALSE),
                COALESCE(v_item.subtotal, 0), COALESCE(v_item.iva_monto, 0), COALESCE(v_item.total, 0),
                v_item.cuenta_ingreso_id, v_item.cuenta_costo_id, v_item.cuenta_inventario_id
            );

            IF v_item.producto_id IS NOT NULL THEN
                SELECT stock_actual INTO v_prod_stock 
                FROM productos 
                WHERE id = v_item.producto_id AND empresa_id = v_empresa_id 
                FOR UPDATE;

                IF FOUND THEN
                    UPDATE productos 
                    SET stock_actual = stock_actual - v_cant, updated_at = NOW() 
                    WHERE id = v_item.producto_id;

                    INSERT INTO movimientos_inventario (
                        id, empresa_id, producto_id, tipo, cantidad, stock_anterior,
                        stock_resultante, costo_unitario, referencia, fecha, usuario, created_at
                    ) VALUES (
                        uuid_generate_v4(), v_empresa_id, v_item.producto_id, 'venta',
                        v_cant, COALESCE(v_prod_stock, 0), COALESCE(v_prod_stock, 0) - v_cant,
                        COALESCE(v_item.precio_unitario, 0), 'Venta Factura ' || v_numero,
                        (p_factura->>'fecha_emision')::DATE, 'Sistema ERP (RPC Atómico)', NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Si se pasó payload de CxC, insertar registro en cuentas_cobrar_cxc
    IF p_cxc IS NOT NULL AND (p_cxc->>'total')::NUMERIC > 0 THEN
        INSERT INTO cuentas_cobrar_cxc (
            id, empresa_id, factura_id, cliente_id, categoria, fecha, vencimiento,
            descripcion, tipo, total, saldo, moneda, tasa, created_at
        ) VALUES (
            COALESCE((p_cxc->>'id')::UUID, uuid_generate_v4()), v_empresa_id, v_factura_id,
            (p_factura->>'cliente_id')::UUID, COALESCE(p_cxc->>'categoria', 'clientes'),
            (p_factura->>'fecha_emision')::DATE, COALESCE((p_factura->>'fecha_vencimiento')::DATE, (p_factura->>'fecha_emision')::DATE),
            'Factura de Venta ' || v_numero, 'factura',
            COALESCE((p_cxc->>'total')::NUMERIC, (p_factura->>'total')::NUMERIC),
            COALESCE((p_cxc->>'saldo')::NUMERIC, (p_factura->>'saldo_pendiente')::NUMERIC),
            COALESCE(p_factura->>'moneda', 'USD'), COALESCE((p_factura->>'tasa_cambio')::NUMERIC, 1.0), NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'factura_id', v_factura_id,
        'numero', v_numero,
        'correlativo_info', v_correlativo_data
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_siguiente_correlativo(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.registrar_factura_venta_atomica(JSONB, JSONB, JSONB) TO authenticated, anon;
