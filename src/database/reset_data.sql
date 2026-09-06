-- ==============================================================================
-- SCRIPT DE LIMPIEZA / RESET TOTAL DE DATOS - HALLEY ERP & NIIF
-- ==============================================================================
-- Este script vacía todas las tablas respetando la integridad referencial y las 
-- claves foráneas (Foreign Keys), dejando la estructura del esquema lista para producción.

TRUNCATE TABLE 
    cobranzas,
    pagos_realizados,
    cuentas_cobrar_cxc,
    cuentas_pagar_cxp,
    facturas_venta,
    movimientos_bancos,
    bancos,
    contactos,
    lineas_comprobante,
    comprobantes_diario,
    cuentas_contables,
    configuracion_contable,
    plantillas_documentos,
    auditoria_configuracion,
    servicios,
    usuario_empresas,
    usuarios,
    empresas
CASCADE;

-- Confirmación de limpieza
SELECT 'Base de datos limpiada exitosamente. Todas las tablas han sido vaciadas.' AS resultado;
