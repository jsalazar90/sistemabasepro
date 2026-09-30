-- ==============================================================================
-- SCRIPT DE LIMPIEZA / RESET TOTAL DE DATOS - HALLEY ERP & NIIF (31 TABLAS)
-- ==============================================================================
-- Este script vacía todas las tablas respetando la integridad referencial y las 
-- claves foráneas (Foreign Keys), dejando la estructura del esquema lista para producción.

TRUNCATE TABLE 
    -- 1. Tablas dependientes / Renglones / Transacciones (Hijos primero)
    lotes_pos_transacciones,
    lotes_pos,
    terminales_pos,
    facturas_venta_items,
    facturas_compra_items,
    movimientos_inventario,
    depreciaciones,
    lineas_comprobante,
    auditoria_logs,
    auditoria_configuracion,
    
    -- 2. Documentos principales y operaciones
    cobranzas,
    pagos_realizados,
    cuentas_cobrar_cxc,
    cuentas_pagar_cxp,
    facturas_venta,
    facturas_compra,
    solicitudes_banco,
    movimientos_bancos,
    comprobantes_diario,
    
    -- 3. Catálogos y maestros
    productos,
    categorias_producto,
    almacenes,
    servicios,
    activos_fijos,
    categorias_activos,
    bancos,
    contactos,
    cuentas_contables,
    plantillas_documentos,
    configuracion_contable,
    
    -- 4. Seguridad y Tenancy
    usuario_empresas,
    usuarios,
    empresas
CASCADE;

-- Confirmación de limpieza
SELECT 'Base de datos saneada y reseteada exitosamente. Las 31 tablas han sido vaciadas.' AS resultado;
