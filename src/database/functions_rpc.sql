-- ==============================================================================
-- FUNCIONES RPC Y PROCEDIMIENTOS ALMACENADOS ATÓMICOS PARA POSTGRESQL / SUPABASE
-- Halley ERP Pro - Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. ASIGNACIÓN ATÓMICA DE CORRELATIVOS FISCALES CON BLOQUEO FOR UPDATE
CREATE OR REPLACE FUNCTION obtener_siguiente_correlativo(
    p_empresa_id VARCHAR,
    p_tipo_documento VARCHAR DEFAULT 'factura'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_config configuracion_contable%ROWTYPE;
    v_prefijo VARCHAR(20) := '';
    v_correlativo_actual INTEGER := 1;
    v_siguiente INTEGER := 2;
    v_formateado VARCHAR(50);
BEGIN
    -- Bloqueo pesimista de la fila para evitar concurrencia y duplicados
    SELECT * INTO v_config 
    FROM configuracion_contable 
    WHERE empresa_id = p_empresa_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO configuracion_contable (id, empresa_id, correlativo_factura)
        VALUES (p_empresa_id, p_empresa_id, '000001')
        RETURNING * INTO v_config;
    END IF;

    IF p_tipo_documento = 'nota_entrega' THEN
        v_prefijo := COALESCE(v_config.prefijo_nota_entrega, '');
        v_correlativo_actual := COALESCE(NULLIF(regexp_replace(v_config.correlativo_nota_entrega, '\D', '', 'g'), '')::integer, 1);
        v_siguiente := v_correlativo_actual + 1;
        UPDATE configuracion_contable 
        SET correlativo_nota_entrega = LPAD(v_siguiente::text, 6, '0') 
        WHERE empresa_id = p_empresa_id;
    ELSIF p_tipo_documento = 'cotizacion' THEN
        v_prefijo := COALESCE(v_config.prefijo_cotizacion, '');
        v_correlativo_actual := COALESCE(NULLIF(regexp_replace(v_config.correlativo_cotizacion, '\D', '', 'g'), '')::integer, 1);
        v_siguiente := v_correlativo_actual + 1;
        UPDATE configuracion_contable 
        SET correlativo_cotizacion = LPAD(v_siguiente::text, 6, '0') 
        WHERE empresa_id = p_empresa_id;
    ELSIF p_tipo_documento = 'recibo' THEN
        v_prefijo := COALESCE(v_config.prefijo_recibo, 'REC-');
        v_correlativo_actual := COALESCE(NULLIF(regexp_replace(v_config.correlativo_recibo, '\D', '', 'g'), '')::integer, 1);
        v_siguiente := v_correlativo_actual + 1;
        UPDATE configuracion_contable 
        SET correlativo_recibo = LPAD(v_siguiente::text, 6, '0') 
        WHERE empresa_id = p_empresa_id;
    ELSE
        v_prefijo := CASE 
            WHEN p_tipo_documento = 'nota_credito' THEN 'NC-' 
            WHEN p_tipo_documento = 'nota_debito' THEN 'ND-' 
            ELSE COALESCE(v_config.prefijo_factura, '') 
        END;
        v_correlativo_actual := COALESCE(NULLIF(regexp_replace(v_config.correlativo_factura, '\D', '', 'g'), '')::integer, 1);
        v_siguiente := v_correlativo_actual + 1;
        UPDATE configuracion_contable 
        SET correlativo_factura = LPAD(v_siguiente::text, 6, '0') 
        WHERE empresa_id = p_empresa_id;
    END IF;

    v_formateado := v_prefijo || LPAD(v_correlativo_actual::text, 6, '0');

    RETURN jsonb_build_object(
        'prefijo', v_prefijo,
        'correlativo_asignado', v_correlativo_actual,
        'numero_formateado', v_formateado,
        'siguiente_correlativo', v_siguiente,
        'siguiente_correlativo_str', LPAD(v_siguiente::text, 6, '0')
    );
END;
$$;

-- 2. REGISTRO ATÓMICO TRANSACCIONAL DE FACTURA, RENGLONES Y CUENTA POR COBRAR
CREATE OR REPLACE FUNCTION registrar_factura_venta_atomica(
    p_factura JSONB,
    p_items JSONB,
    p_cxc JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_factura_id VARCHAR(64);
    v_numero VARCHAR(50);
    v_empresa_id VARCHAR(64);
    v_item JSONB;
BEGIN
    v_factura_id := COALESCE(p_factura->>'id', gen_random_uuid()::text);
    v_numero := p_factura->>'numero';
    v_empresa_id := p_factura->>'empresa_id';

    -- 1. Insertar o actualizar cabecera de Factura
    INSERT INTO facturas_venta (
        id, empresa_id, numero, control_numero, tipo_documento, condicion, dias_credito,
        cliente_id, cliente_nombre, cliente_rif, cliente_direccion, cliente_telefono, cliente_email,
        vendedor_id, fecha_emision, fecha_vencimiento, moneda, moneda_presentacion, tasa_cambio,
        subtotal, base_imponible, monto_exento, iva_porcentaje, iva_monto,
        igtf_porcentaje, igtf_monto, retencion_iva_porcentaje, retencion_iva_monto,
        retencion_islr_porcentaje, retencion_islr_monto, neto_cobrar, total, saldo_pendiente,
        subtotal_bs, base_imponible_bs, monto_exento_bs, iva_monto_bs, igtf_monto_bs,
        retencion_iva_monto_bs, retencion_islr_monto_bs, neto_cobrar_bs, total_bs, saldo_pendiente_bs,
        estado, banco_id, comprobante_id, cxc_id, monto_recibido, monto_recibido_bs, vuelto, vuelto_bs, notas
    ) VALUES (
        v_factura_id,
        v_empresa_id,
        v_numero,
        p_factura->>'control_numero',
        COALESCE(p_factura->>'tipo_documento', 'factura'),
        COALESCE(p_factura->>'condicion', 'contado'),
        COALESCE((p_factura->>'dias_credito')::integer, 0),
        p_factura->>'cliente_id',
        COALESCE(p_factura->>'cliente_nombre', 'Cliente'),
        p_factura->>'cliente_rif',
        p_factura->>'cliente_direccion',
        p_factura->>'cliente_telefono',
        p_factura->>'cliente_email',
        p_factura->>'vendedor_id',
        (p_factura->>'fecha_emision')::date,
        (p_factura->>'fecha_vencimiento')::date,
        COALESCE(p_factura->>'moneda', 'USD'),
        COALESCE(p_factura->>'moneda_presentacion', 'USD'),
        COALESCE((p_factura->>'tasa_cambio')::numeric, 1.0000),
        COALESCE((p_factura->>'subtotal')::numeric, 0.00),
        COALESCE((p_factura->>'base_imponible')::numeric, 0.00),
        COALESCE((p_factura->>'monto_exento')::numeric, 0.00),
        COALESCE((p_factura->>'iva_porcentaje')::numeric, 16.00),
        COALESCE((p_factura->>'iva_monto')::numeric, 0.00),
        COALESCE((p_factura->>'igtf_porcentaje')::numeric, 0.00),
        COALESCE((p_factura->>'igtf_monto')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_iva_porcentaje')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_iva_monto')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_islr_porcentaje')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_islr_monto')::numeric, 0.00),
        COALESCE((p_factura->>'neto_cobrar')::numeric, 0.00),
        COALESCE((p_factura->>'total')::numeric, 0.00),
        COALESCE((p_factura->>'saldo_pendiente')::numeric, 0.00),
        COALESCE((p_factura->>'subtotal_bs')::numeric, 0.00),
        COALESCE((p_factura->>'base_imponible_bs')::numeric, 0.00),
        COALESCE((p_factura->>'monto_exento_bs')::numeric, 0.00),
        COALESCE((p_factura->>'iva_monto_bs')::numeric, 0.00),
        COALESCE((p_factura->>'igtf_monto_bs')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_iva_monto_bs')::numeric, 0.00),
        COALESCE((p_factura->>'retencion_islr_monto_bs')::numeric, 0.00),
        COALESCE((p_factura->>'neto_cobrar_bs')::numeric, 0.00),
        COALESCE((p_factura->>'total_bs')::numeric, 0.00),
        COALESCE((p_factura->>'saldo_pendiente_bs')::numeric, 0.00),
        COALESCE(p_factura->>'estado', 'emitida'),
        p_factura->>'banco_id',
        p_factura->>'comprobante_id',
        p_factura->>'cxc_id',
        (p_factura->>'monto_recibido')::numeric,
        (p_factura->>'monto_recibido_bs')::numeric,
        COALESCE((p_factura->>'vuelto')::numeric, 0.00),
        COALESCE((p_factura->>'vuelto_bs')::numeric, 0.00),
        p_factura->>'notas'
    )
    ON CONFLICT (id) DO UPDATE SET
        total = EXCLUDED.total,
        saldo_pendiente = EXCLUDED.saldo_pendiente,
        estado = EXCLUDED.estado;

    -- 2. Insertar renglones en facturas_venta_items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        DELETE FROM facturas_venta_items WHERE factura_id = v_factura_id;
        
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO facturas_venta_items (
                id, factura_id, producto_id, descripcion, cantidad, precio_unitario,
                exento, subtotal, iva_monto, total, cuenta_ingreso_id, cuenta_costo_id, cuenta_inventario_id
            ) VALUES (
                COALESCE(v_item->>'id', gen_random_uuid()::text),
                v_factura_id,
                v_item->>'producto_id',
                COALESCE(v_item->>'descripcion', 'Artículo'),
                COALESCE((v_item->>'cantidad')::numeric, 1.0),
                COALESCE((v_item->>'precio_unitario')::numeric, 0.00),
                COALESCE((v_item->>'exento')::boolean, false),
                COALESCE((v_item->>'subtotal')::numeric, 0.00),
                COALESCE((v_item->>'iva_monto')::numeric, 0.00),
                COALESCE((v_item->>'total')::numeric, 0.00),
                v_item->>'cuenta_ingreso_id',
                v_item->>'cuenta_costo_id',
                v_item->>'cuenta_inventario_id'
            );
        END LOOP;
    END IF;

    -- 3. Si aplica crédito, insertar o actualizar cuenta por cobrar
    IF p_cxc IS NOT NULL AND (p_cxc->>'id') IS NOT NULL THEN
        INSERT INTO cuentas_cobrar_cxc (
            id, empresa_id, factura_id, cliente_id, cliente, categoria,
            fecha, vencimiento, descripcion, tipo, total, saldo, moneda, tasa
        ) VALUES (
            p_cxc->>'id',
            v_empresa_id,
            v_factura_id,
            p_cxc->>'cliente_id',
            COALESCE(p_cxc->>'cliente', p_factura->>'cliente_nombre'),
            COALESCE(p_cxc->>'categoria', 'clientes'),
            (p_cxc->>'fecha')::date,
            (p_cxc->>'vencimiento')::date,
            p_cxc->>'descripcion',
            COALESCE(p_cxc->>'tipo', 'factura'),
            COALESCE((p_cxc->>'total')::numeric, 0.00),
            COALESCE((p_cxc->>'saldo')::numeric, 0.00),
            COALESCE(p_cxc->>'moneda', 'USD'),
            COALESCE((p_cxc->>'tasa')::numeric, 1.0000)
        )
        ON CONFLICT (id) DO UPDATE SET
            saldo = EXCLUDED.saldo,
            total = EXCLUDED.total;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'factura_id', v_factura_id,
        'numero', v_numero
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 3. ACTUALIZACIÓN ATÓMICA DE STOCK INDIVIDUAL CON BLOQUEO PESIMISTA (FOR UPDATE)
CREATE OR REPLACE FUNCTION actualizar_stock_atomico(
    p_empresa_id VARCHAR,
    p_producto_id VARCHAR,
    p_cantidad NUMERIC,
    p_tipo VARCHAR DEFAULT 'venta', -- 'venta', 'salida', 'entrada', 'compra', 'ajuste'
    p_costo_unitario NUMERIC DEFAULT NULL,
    p_actualizar_costo BOOLEAN DEFAULT FALSE,
    p_almacen_origen_id VARCHAR DEFAULT NULL,
    p_almacen_destino_id VARCHAR DEFAULT NULL,
    p_referencia VARCHAR DEFAULT '',
    p_usuario VARCHAR DEFAULT 'Sistema',
    p_permitir_negativo BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_prod productos%ROWTYPE;
    v_stock_anterior NUMERIC(18, 4);
    v_stock_resultante NUMERIC(18, 4);
    v_nuevo_costo_unitario NUMERIC(18, 4);
    v_nuevo_costo_promedio NUMERIC(18, 4);
    v_mov_id VARCHAR(64);
    v_cant_abs NUMERIC(18, 4);
    v_es_salida BOOLEAN;
BEGIN
    v_cant_abs := ABS(p_cantidad);
    v_es_salida := (p_tipo IN ('venta', 'salida', 'traslado_salida'));

    -- Bloqueo pesimista FOR UPDATE del producto
    SELECT * INTO v_prod 
    FROM productos 
    WHERE id = p_producto_id AND empresa_id = p_empresa_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Producto no encontrado: ' || p_producto_id
        );
    END IF;

    v_stock_anterior := COALESCE(v_prod.stock_actual, 0.0000);
    v_nuevo_costo_unitario := COALESCE(v_prod.costo_unitario, 0.0000);
    v_nuevo_costo_promedio := COALESCE(v_prod.costo_promedio, v_nuevo_costo_unitario);

    IF v_es_salida THEN
        v_stock_resultante := v_stock_anterior - v_cant_abs;
        IF v_stock_resultante < 0 AND NOT p_permitir_negativo THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stock insuficiente para ' || v_prod.nombre || '. Disponible: ' || v_stock_anterior || ', Requerido: ' || v_cant_abs
            );
        END IF;
    ELSE
        -- Entrada, compra, o ajuste positivo
        v_stock_resultante := v_stock_anterior + v_cant_abs;
        IF p_costo_unitario IS NOT NULL AND p_costo_unitario > 0 THEN
            IF p_actualizar_costo THEN
                v_nuevo_costo_unitario := p_costo_unitario;
            END IF;
            -- Recalcular Costo Promedio Ponderado
            IF v_stock_resultante > 0 THEN
                v_nuevo_costo_promedio := ((GREATEST(0, v_stock_anterior) * v_nuevo_costo_promedio) + (v_cant_abs * p_costo_unitario)) / (GREATEST(0, v_stock_anterior) + v_cant_abs);
            END IF;
        END IF;
    END IF;

    -- Actualizar el producto atómicamente
    UPDATE productos SET
        stock_actual = v_stock_resultante,
        costo_unitario = v_nuevo_costo_unitario,
        costo_promedio = v_nuevo_costo_promedio,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_producto_id;

    -- Registrar el movimiento en Kardex
    v_mov_id := gen_random_uuid()::text;
    INSERT INTO movimientos_inventario (
        id, empresa_id, producto_id, tipo,
        almacen_origen_id, almacen_destino_id,
        cantidad, stock_anterior, stock_resultante, costo_unitario,
        referencia, fecha, usuario, created_at
    ) VALUES (
        v_mov_id,
        p_empresa_id,
        p_producto_id,
        p_tipo,
        p_almacen_origen_id,
        p_almacen_destino_id,
        v_cant_abs,
        v_stock_anterior,
        v_stock_resultante,
        COALESCE(p_costo_unitario, v_nuevo_costo_unitario),
        p_referencia,
        CURRENT_DATE,
        p_usuario,
        CURRENT_TIMESTAMP
    );

    RETURN jsonb_build_object(
        'success', true,
        'producto_id', p_producto_id,
        'stock_anterior', v_stock_anterior,
        'stock_resultante', v_stock_resultante,
        'costo_promedio', v_nuevo_costo_promedio,
        'movimiento_id', v_mov_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 4. ACTUALIZACIÓN ATÓMICA DE STOCK EN LOTE (BATCH INVENTORY)
CREATE OR REPLACE FUNCTION actualizar_stock_lote_atomico(
    p_empresa_id VARCHAR,
    p_items JSONB,
    p_tipo VARCHAR DEFAULT 'venta',
    p_referencia VARCHAR DEFAULT '',
    p_usuario VARCHAR DEFAULT 'Sistema',
    p_permitir_negativo BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_item JSONB;
    v_res JSONB;
    v_prod_id VARCHAR(64);
    v_cantidad NUMERIC;
    v_costo NUMERIC;
    v_act_costo BOOLEAN;
    v_alm_orig VARCHAR(64);
    v_alm_dest VARCHAR(64);
    v_procesados INTEGER := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := v_item->>'producto_id';
        v_cantidad := (v_item->>'cantidad')::numeric;
        v_costo := (v_item->>'costo_unitario')::numeric;
        v_act_costo := COALESCE((v_item->>'actualizar_costo')::boolean, false);
        v_alm_orig := v_item->>'almacen_origen_id';
        v_alm_dest := v_item->>'almacen_destino_id';

        IF v_prod_id IS NOT NULL AND v_cantidad > 0 THEN
            v_res := actualizar_stock_atomico(
                p_empresa_id,
                v_prod_id,
                v_cantidad,
                p_tipo,
                v_costo,
                v_act_costo,
                v_alm_orig,
                v_alm_dest,
                p_referencia,
                p_usuario,
                p_permitir_negativo
            );

            IF NOT (v_res->>'success')::boolean THEN
                RAISE EXCEPTION '%', v_res->>'error';
            END IF;

            v_procesados := v_procesados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'items_procesados', v_procesados
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
