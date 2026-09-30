-- ==============================================================================
-- SISTEMA ERP ADMINISTRATIVO & CONTABLE NIIF - ESQUEMA DE BASE DE DATOS COMPLETO
-- Versión: 2.0.0 (Producción Saneada & 31 Tablas Relacionales)
-- Compatible con: PostgreSQL 14+, Supabase
-- Estándar: Multiempresa (Tenant Isolation), Partida Doble NIIF, SENIAT Fiscal
-- ==============================================================================

-- Habilitar extensión UUID (en caso de PostgreSQL / Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ORGANIZACIÓN, EMPRESAS & MULTITENANT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS empresas (
    id VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    rif VARCHAR(50) NOT NULL UNIQUE,
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(150),
    logo TEXT,
    moneda_principal VARCHAR(10) DEFAULT 'USD',
    moneda_secundaria VARCHAR(10) DEFAULT 'VES',
    tipo_contribuyente VARCHAR(50) DEFAULT 'ordinario', -- ordinario, especial, formal
    tipo_empresa VARCHAR(50) DEFAULT 'comercial',      -- comercial, servicios, manufacturera, mixta
    habilitar_pos BOOLEAN DEFAULT TRUE,
    habilitar_vendedores BOOLEAN DEFAULT TRUE,
    habilitar_pedidos BOOLEAN DEFAULT TRUE,
    habilitar_tasa_referencial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_empresas_rif ON empresas(rif);

-- ==============================================================================
-- 2. USUARIOS, SEGURIDAD & RBAC (ROLE-BASED ACCESS CONTROL)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    nombre VARCHAR(150),
    role VARCHAR(50) DEFAULT 'Operador', -- Master, SuperAdmin, Contador, Operador, Vendedor
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuario_empresas (
    id VARCHAR(64) PRIMARY KEY,
    usuario_id VARCHAR(64) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Operador',
    vendedor_id VARCHAR(64),
    vendedor_nombre VARCHAR(150),
    permissions JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuario_empresa UNIQUE (usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_empresas_user ON usuario_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_empresas_comp ON usuario_empresas(empresa_id);

-- ==============================================================================
-- 3. PLAN DE CUENTAS & CONTABILIDAD NIIF / VEN-NIF
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cuentas_contables (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Movimiento', -- Movimiento, Grupo / Totalizadora
    naturaleza VARCHAR(20) DEFAULT 'Deudora', -- Deudora, Acreedora
    grupo VARCHAR(50) NOT NULL, -- Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos
    nivel INTEGER DEFAULT 1,
    cuenta_padre_id VARCHAR(64),
    saldo_actual NUMERIC(18, 4) DEFAULT 0.0000,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empresa_codigo_cuenta UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_cuentas_empresa_codigo ON cuentas_contables(empresa_id, codigo);

-- Comprobantes de Diario (Asientos Contables)
CREATE TABLE IF NOT EXISTS comprobantes_diario (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Diario', -- Diario, Ingreso, Egreso, Cierre, Ajuste
    descripcion TEXT NOT NULL,
    referencia VARCHAR(100),
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'Contabilizado', -- Contabilizado, Borrador, Anulado, Descuadrado
    created_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_empresa_fecha ON comprobantes_diario(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_comprobantes_numero ON comprobantes_diario(empresa_id, numero);

-- Líneas de Comprobante (Partida Doble NIIF)
CREATE TABLE IF NOT EXISTS lineas_comprobante (
    id VARCHAR(64) PRIMARY KEY,
    comprobante_id VARCHAR(64) NOT NULL REFERENCES comprobantes_diario(id) ON DELETE CASCADE,
    cuenta_id VARCHAR(64),
    descripcion TEXT,
    debe NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    haber NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    orden INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lineas_comprobante_id ON lineas_comprobante(comprobante_id);
CREATE INDEX IF NOT EXISTS idx_lineas_cuenta_id ON lineas_comprobante(cuenta_id);

-- Configuración y Mapeo de Enlaces Contables NIIF
CREATE TABLE IF NOT EXISTS configuracion_contable (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
    cuenta_inventario VARCHAR(64),
    cuenta_costo_ventas VARCHAR(64),
    cuenta_ventas VARCHAR(64) DEFAULT '41',
    cuenta_gastos VARCHAR(64) DEFAULT '51',
    cuenta_anticipo_recibido VARCHAR(64),
    cuenta_anticipo_otorgado VARCHAR(64),
    cuenta_cxc VARCHAR(64) DEFAULT '11',
    cuenta_cxp VARCHAR(64) DEFAULT '21',
    cuenta_debito_fiscal VARCHAR(64) DEFAULT '22',
    cuenta_credito_fiscal VARCHAR(64),
    cuenta_iva_retenido_ventas VARCHAR(64),
    cuenta_iva_retenido_compras VARCHAR(64),
    cuenta_islr_retenido_ventas VARCHAR(64),
    cuenta_islr_retenido_compras VARCHAR(64),
    cuenta_ganancia_diferencial VARCHAR(64) DEFAULT '4.1.1',
    cuenta_perdida_diferencial VARCHAR(64) DEFAULT '5.2.1',
    cuenta_utilidad_anteriores VARCHAR(64),
    mes_cierre VARCHAR(10) DEFAULT '12',
    working_year VARCHAR(10) DEFAULT '2026',
    
    -- Parámetros Fiscales & Alícuotas
    iva NUMERIC(6, 2) DEFAULT 16.00,
    igtf NUMERIC(6, 2) DEFAULT 3.00,
    retencion_iva NUMERIC(6, 2) DEFAULT 75.00,
    retencion_islr NUMERIC(6, 2) DEFAULT 2.00,
    
    -- Series y Correlativos (Almacenados como texto para preservar ceros a la izquierda)
    prefijo_factura VARCHAR(20) DEFAULT '',
    correlativo_factura VARCHAR(20) DEFAULT '00001',
    prefijo_cotizacion VARCHAR(20) DEFAULT '',
    correlativo_cotizacion VARCHAR(20) DEFAULT '00001',
    prefijo_nota_entrega VARCHAR(20) DEFAULT '',
    correlativo_nota_entrega VARCHAR(20) DEFAULT '00001',
    prefijo_recibo VARCHAR(20) DEFAULT 'REC-',
    correlativo_recibo VARCHAR(20) DEFAULT '00001',
    
    -- Términos y Parámetros Comerciales
    dias_vencimiento_default INTEGER DEFAULT 15,
    notas_default TEXT,
    comision_mode VARCHAR(30) DEFAULT 'emitidas',
    active_service_template VARCHAR(100) DEFAULT 'Estándar',
    active_inventory_template VARCHAR(100) DEFAULT 'Estándar',
    
    -- Máquina Fiscal
    usa_maquina_fiscal BOOLEAN DEFAULT FALSE,
    marca_maquina_fiscal VARCHAR(50) DEFAULT 'bixolon',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de Diseño de Documentos
CREATE TABLE IF NOT EXISTS plantillas_documentos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'servicios',
    diseno_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    es_predeterminada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empresa_plantilla_nombre UNIQUE (empresa_id, nombre)
);

-- Auditoría de Cambios de Configuración
CREATE TABLE IF NOT EXISTS auditoria_configuracion (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_email VARCHAR(150) NOT NULL,
    seccion VARCHAR(100) NOT NULL,
    cambio_detalle JSONB NOT NULL,
    ip_origen VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_empresa ON auditoria_configuracion(empresa_id, created_at DESC);

-- Auditoría Forense General del Sistema
CREATE TABLE IF NOT EXISTS auditoria_logs (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tabla VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    registro_id VARCHAR(64),
    usuario_id VARCHAR(64),
    usuario_email VARCHAR(150),
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    detalles TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_logs_empresa_fecha ON auditoria_logs(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_tabla ON auditoria_logs(tabla, registro_id);

-- ==============================================================================
-- 4. TERCEROS & CONTACTOS (CLIENTES, PROVEEDORES, VENDEDORES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS contactos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'customer', -- customer, supplier, both, employee
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    tipo_contribuyente VARCHAR(50) DEFAULT 'ordinario',
    saldo NUMERIC(18, 2) DEFAULT 0.00,
    saldo_cxp NUMERIC(18, 2) DEFAULT 0.00,
    debit_account VARCHAR(64),
    credit_account VARCHAR(64),
    expense_account VARCHAR(64),
    employee_type VARCHAR(50),
    comision_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contactos_empresa_taxid ON contactos(empresa_id, tax_id);
CREATE INDEX IF NOT EXISTS idx_contactos_tipo ON contactos(empresa_id, type);

-- ==============================================================================
-- 5. TESORERÍA, BANCOS, MOVIMIENTOS & SOLICITUDES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bancos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    banco VARCHAR(150) NOT NULL,
    numero_cuenta VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Corriente',
    moneda VARCHAR(20) DEFAULT 'Bolivares',
    saldo NUMERIC(18, 2) DEFAULT 0.00,
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    cuenta_contable_id VARCHAR(64) DEFAULT '1.1.3',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bancos_empresa ON bancos(empresa_id);

CREATE TABLE IF NOT EXISTS movimientos_bancos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    banco_id VARCHAR(64) NOT NULL REFERENCES bancos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    ref VARCHAR(100),
    descripcion TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- ingreso, egreso, transferencia
    monto NUMERIC(18, 2) NOT NULL,
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    comprobante_id VARCHAR(64),
    estado VARCHAR(30) DEFAULT 'conciliado',
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movimientos_banco_fecha ON movimientos_bancos(banco_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa_fecha ON movimientos_bancos(empresa_id, fecha DESC);

-- Solicitudes de Banco (Confirmaciones de Ingreso y Solicitudes de Pago)
CREATE TABLE IF NOT EXISTS solicitudes_banco (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL, -- ingreso, pago
    estado VARCHAR(30) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada
    fecha DATE NOT NULL,
    fecha_requerida DATE,
    contacto_id VARCHAR(64),
    contacto_nombre VARCHAR(255),
    contacto_tipo VARCHAR(50),
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    banco_nombre VARCHAR(150),
    monto NUMERIC(18, 2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    monto_ves NUMERIC(18, 2) DEFAULT 0.00,
    referencia VARCHAR(100),
    metodo_pago VARCHAR(50) DEFAULT 'Transferencia',
    descripcion TEXT,
    categoria_concepto VARCHAR(100),
    comprobante_adjunto TEXT,
    datos_pago_beneficiario JSONB,
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    usuario_resolucion VARCHAR(150),
    banco_resolucion_id VARCHAR(64),
    referencia_resolucion VARCHAR(100),
    nota_resolucion TEXT,
    movimiento_banco_id VARCHAR(64),
    comprobante_contable_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_banco_empresa ON solicitudes_banco(empresa_id, estado);

-- ==============================================================================
-- 6. ALMACENES, CATEGORÍAS & INVENTARIO DE MERCANCÍA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS almacenes (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    ubicacion TEXT,
    responsable VARCHAR(150),
    es_principal BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_almacenes_empresa ON almacenes(empresa_id);

CREATE TABLE IF NOT EXISTS categorias_producto (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    color VARCHAR(50) DEFAULT 'indigo',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categorias_producto_empresa ON categorias_producto(empresa_id);

CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    codigo_barra VARCHAR(100),
    referencia_fabrica VARCHAR(100),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100) DEFAULT 'General',
    subcategoria VARCHAR(100),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    unidad_medida VARCHAR(20) DEFAULT 'UND',
    unidad_empaque VARCHAR(50),
    factor_empaque NUMERIC(18, 4) DEFAULT 1.0,
    ubicacion VARCHAR(100),
    costo_unitario NUMERIC(18, 4) DEFAULT 0.0000,
    costo_promedio NUMERIC(18, 4) DEFAULT 0.0000,
    precio_venta NUMERIC(18, 4) DEFAULT 0.0000,
    precio_mayor NUMERIC(18, 4) DEFAULT 0.0000,
    precio_vip NUMERIC(18, 4) DEFAULT 0.0000,
    precio_minimo NUMERIC(18, 4) DEFAULT 0.0000,
    stock_actual NUMERIC(18, 4) DEFAULT 0.0000,
    stock_minimo NUMERIC(18, 4) DEFAULT 0.0000,
    stock_maximo NUMERIC(18, 4) DEFAULT 0.0000,
    punto_reorden NUMERIC(18, 4) DEFAULT 0.0000,
    almacen_id VARCHAR(64) REFERENCES almacenes(id) ON DELETE SET NULL,
    aplica_iva BOOLEAN DEFAULT TRUE,
    alicuota_iva VARCHAR(50) DEFAULT 'general',
    cuenta_inventario_id VARCHAR(64),
    cuenta_costo_id VARCHAR(64),
    cuenta_venta_id VARCHAR(64),
    cuenta_ingreso_id VARCHAR(64),
    activo BOOLEAN DEFAULT TRUE,
    imagen_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empresa_codigo_producto UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_productos_empresa_codigo ON productos(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_productos_empresa_nombre ON productos(empresa_id, nombre);

-- Kardex de Movimientos de Inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    producto_id VARCHAR(64) REFERENCES productos(id) ON DELETE SET NULL,
    tipo VARCHAR(30) NOT NULL, -- entrada, salida, venta, compra, ajuste, traslado
    almacen_origen_id VARCHAR(64) REFERENCES almacenes(id) ON DELETE SET NULL,
    almacen_destino_id VARCHAR(64) REFERENCES almacenes(id) ON DELETE SET NULL,
    cantidad NUMERIC(18, 4) NOT NULL,
    stock_anterior NUMERIC(18, 4) DEFAULT 0.0000,
    stock_resultante NUMERIC(18, 4) DEFAULT 0.0000,
    costo_unitario NUMERIC(18, 4) DEFAULT 0.0000,
    referencia VARCHAR(150),
    fecha DATE NOT NULL,
    usuario VARCHAR(150) DEFAULT 'Sistema',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movimientos_inv_empresa_prod ON movimientos_inventario(empresa_id, producto_id, fecha DESC);

-- Catálogo de Servicios
CREATE TABLE IF NOT EXISTS servicios (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50),
    descripcion TEXT,
    precio NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    precio_base NUMERIC(18, 2) DEFAULT 0.00,
    tipo VARCHAR(50) DEFAULT 'Servicio',
    exento_iva BOOLEAN DEFAULT FALSE,
    cuenta_ingreso_id VARCHAR(64),
    cuenta_costo_id VARCHAR(64),
    cuenta_contable_id VARCHAR(64),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servicios_empresa ON servicios(empresa_id);

-- ==============================================================================
-- 7. VENTAS, FACTURACIÓN & CUENTAS POR COBRAR (CXC)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS facturas_venta (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    control_numero VARCHAR(50),
    tipo_documento VARCHAR(30) DEFAULT 'factura', -- factura, nota_entrega, cotizacion, nota_credito, nota_debito
    condicion VARCHAR(20) DEFAULT 'contado',      -- contado, credito
    dias_credito INTEGER DEFAULT 0,
    cliente_id VARCHAR(64) NOT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_rif VARCHAR(50),
    cliente_direccion TEXT,
    cliente_telefono VARCHAR(50),
    cliente_email VARCHAR(150),
    vendedor_id VARCHAR(64),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    moneda_presentacion VARCHAR(10) DEFAULT 'USD',
    tasa_cambio NUMERIC(18, 4) DEFAULT 1.0000,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    base_imponible NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    monto_exento NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    iva_porcentaje NUMERIC(6, 2) DEFAULT 16.00,
    iva_monto NUMERIC(18, 2) DEFAULT 0.00,
    igtf_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    igtf_monto NUMERIC(18, 2) DEFAULT 0.00,
    retencion_iva_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    retencion_iva_monto NUMERIC(18, 2) DEFAULT 0.00,
    comprobante_retencion_iva_numero VARCHAR(50),
    comprobante_retencion_iva_fecha DATE,
    retencion_islr_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    retencion_islr_monto NUMERIC(18, 2) DEFAULT 0.00,
    comprobante_retencion_islr_numero VARCHAR(50),
    comprobante_retencion_islr_fecha DATE,
    neto_cobrar NUMERIC(18, 2) DEFAULT 0.00,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    saldo_pendiente NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    subtotal_bs NUMERIC(18, 2) DEFAULT 0.00,
    base_imponible_bs NUMERIC(18, 2) DEFAULT 0.00,
    monto_exento_bs NUMERIC(18, 2) DEFAULT 0.00,
    iva_monto_bs NUMERIC(18, 2) DEFAULT 0.00,
    igtf_monto_bs NUMERIC(18, 2) DEFAULT 0.00,
    retencion_iva_monto_bs NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr_monto_bs NUMERIC(18, 2) DEFAULT 0.00,
    neto_cobrar_bs NUMERIC(18, 2) DEFAULT 0.00,
    total_bs NUMERIC(18, 2) DEFAULT 0.00,
    saldo_pendiente_bs NUMERIC(18, 2) DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'emitida', -- emitida, cobrada, parcial, anulada
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    comprobante_id VARCHAR(64),
    cxc_id VARCHAR(64),
    monto_recibido NUMERIC(18, 2),
    monto_recibido_bs NUMERIC(18, 2),
    vuelto NUMERIC(18, 2) DEFAULT 0.00,
    vuelto_bs NUMERIC(18, 2) DEFAULT 0.00,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empresa_factura_numero UNIQUE (empresa_id, numero, tipo_documento)
);

CREATE INDEX IF NOT EXISTS idx_facturas_venta_empresa_fecha ON facturas_venta(empresa_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_venta_cliente ON facturas_venta(cliente_id);

-- Renglones / Items de Factura de Venta
CREATE TABLE IF NOT EXISTS facturas_venta_items (
    id VARCHAR(64) PRIMARY KEY,
    factura_id VARCHAR(64) NOT NULL REFERENCES facturas_venta(id) ON DELETE CASCADE,
    producto_id VARCHAR(64) REFERENCES productos(id) ON DELETE SET NULL,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(18, 4) NOT NULL DEFAULT 1.0,
    precio_unitario NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    exento BOOLEAN DEFAULT FALSE,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    iva_monto NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    cuenta_ingreso_id VARCHAR(64),
    cuenta_costo_id VARCHAR(64),
    cuenta_inventario_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_venta_items_factura ON facturas_venta_items(factura_id);
CREATE INDEX IF NOT EXISTS idx_facturas_venta_items_producto ON facturas_venta_items(producto_id);

-- Cuentas por Cobrar (CxC)
CREATE TABLE IF NOT EXISTS cuentas_cobrar_cxc (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id VARCHAR(64),
    cliente_id VARCHAR(64) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'clientes',
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(30) DEFAULT 'factura',
    total NUMERIC(18, 2) NOT NULL,
    saldo NUMERIC(18, 2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxc_empresa_cliente ON cuentas_cobrar_cxc(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cxc_empresa_saldo ON cuentas_cobrar_cxc(empresa_id, saldo);

-- Cobranzas y Recibos
CREATE TABLE IF NOT EXISTS cobranzas (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    recibo_numero VARCHAR(50) NOT NULL,
    cliente_id VARCHAR(64) NOT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    monto_total NUMERIC(18, 2) NOT NULL,
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    comprobante_id VARCHAR(64),
    retencion_iva NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr NUMERIC(18, 2) DEFAULT 0.00,
    diferencial_cambiario NUMERIC(18, 2) DEFAULT 0.00,
    detalles JSONB DEFAULT '[]'::jsonb,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cobranzas_empresa_fecha ON cobranzas(empresa_id, fecha DESC);

-- ==============================================================================
-- 8. COMPRAS, GASTOS & CUENTAS POR PAGAR (CXP)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS facturas_compra (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    control_numero VARCHAR(50),
    tipo_documento VARCHAR(30) DEFAULT 'factura_compra',
    proveedor_id VARCHAR(64) REFERENCES contactos(id) ON DELETE SET NULL,
    proveedor_nombre VARCHAR(255),
    proveedor_rif VARCHAR(50),
    proveedor_telefono VARCHAR(50),
    proveedor_direccion TEXT,
    condicion VARCHAR(20) DEFAULT 'contado',
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa_cambio NUMERIC(18, 4) DEFAULT 1.0000,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    base_imponible NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    monto_exento NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    iva_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    iva_monto NUMERIC(18, 2) DEFAULT 0.00,
    igtf_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    igtf_monto NUMERIC(18, 2) DEFAULT 0.00,
    retencion_iva_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    retencion_iva_monto NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    retencion_islr_monto NUMERIC(18, 2) DEFAULT 0.00,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    saldo_pendiente NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'emitida',
    almacen_destino_id VARCHAR(64) REFERENCES almacenes(id) ON DELETE SET NULL,
    comprobante_id VARCHAR(64),
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_compra_empresa_fecha ON facturas_compra(empresa_id, fecha_emision DESC);

CREATE TABLE IF NOT EXISTS facturas_compra_items (
    id VARCHAR(64) PRIMARY KEY,
    factura_id VARCHAR(64) NOT NULL REFERENCES facturas_compra(id) ON DELETE CASCADE,
    producto_id VARCHAR(64) REFERENCES productos(id) ON DELETE SET NULL,
    codigo VARCHAR(50),
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(18, 4) NOT NULL DEFAULT 1.0,
    costo_unitario NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    exento BOOLEAN DEFAULT FALSE,
    alicuota_iva NUMERIC(6, 2) DEFAULT 0.00,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    iva_monto NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    actualizar_costo BOOLEAN DEFAULT TRUE,
    nuevo_precio_venta NUMERIC(18, 2),
    cuenta_inventario_id VARCHAR(64),
    cuenta_gasto_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_compra_items_factura ON facturas_compra_items(factura_id);

-- Cuentas por Pagar (CxP)
CREATE TABLE IF NOT EXISTS cuentas_pagar_cxp (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id VARCHAR(64),
    proveedor_id VARCHAR(64) NOT NULL,
    proveedor VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'proveedores',
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(30) DEFAULT 'factura',
    total NUMERIC(18, 2) NOT NULL,
    saldo NUMERIC(18, 2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxp_empresa_proveedor ON cuentas_pagar_cxp(empresa_id, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_cxp_empresa_saldo ON cuentas_pagar_cxp(empresa_id, saldo);

-- Pagos Realizados
CREATE TABLE IF NOT EXISTS pagos_realizados (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    comprobante_pago VARCHAR(50) NOT NULL,
    proveedor_id VARCHAR(64) NOT NULL,
    proveedor_nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    monto_total NUMERIC(18, 2) NOT NULL,
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    comprobante_id VARCHAR(64),
    retencion_iva NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr NUMERIC(18, 2) DEFAULT 0.00,
    diferencial_cambiario NUMERIC(18, 2) DEFAULT 0.00,
    detalles JSONB DEFAULT '[]'::jsonb,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_realizados_empresa_fecha ON pagos_realizados(empresa_id, fecha DESC);

-- ==============================================================================
-- 9. PUNTO DE VENTA (POS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS terminales_pos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    serial VARCHAR(100),
    banco_id VARCHAR(64) REFERENCES bancos(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_terminales_pos_empresa ON terminales_pos(empresa_id);

CREATE TABLE IF NOT EXISTS lotes_pos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    terminal_id VARCHAR(64) REFERENCES terminales_pos(id) ON DELETE SET NULL,
    numero_lote VARCHAR(50) NOT NULL,
    fecha_apertura TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    total_monto NUMERIC(18, 2) DEFAULT 0.00,
    total_transacciones INTEGER DEFAULT 0,
    estado VARCHAR(30) DEFAULT 'abierto', -- abierto, cerrado, auditado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lotes_pos_empresa ON lotes_pos(empresa_id, estado);

CREATE TABLE IF NOT EXISTS lotes_pos_transacciones (
    id VARCHAR(64) PRIMARY KEY,
    lote_id VARCHAR(64) NOT NULL REFERENCES lotes_pos(id) ON DELETE CASCADE,
    factura_id VARCHAR(64),
    monto NUMERIC(18, 2) NOT NULL,
    referencia VARCHAR(100),
    tipo_tarjeta VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lotes_pos_trans_lote ON lotes_pos_transacciones(lote_id);

-- ==============================================================================
-- 10. ACTIVOS FIJOS & DEPRECIACIONES NIIF
-- ==============================================================================

CREATE TABLE IF NOT EXISTS categorias_activos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    vida_util INTEGER DEFAULT 5,
    metodo VARCHAR(50) DEFAULT 'Línea Recta',
    cuenta_activo VARCHAR(64),
    cuenta_deprec_acumulada VARCHAR(64),
    cuenta_gasto_deprec VARCHAR(64),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categorias_activos_empresa ON categorias_activos(empresa_id);

CREATE TABLE IF NOT EXISTS activos_fijos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    categoria_id VARCHAR(64) REFERENCES categorias_activos(id) ON DELETE SET NULL,
    fecha_adquisicion DATE NOT NULL,
    valor_compra NUMERIC(18, 2) NOT NULL,
    vida_util_meses INTEGER NOT NULL DEFAULT 60,
    depreciacion_acumulada NUMERIC(18, 2) DEFAULT 0.00,
    cuenta_activo_id VARCHAR(64),
    cuenta_gasto_deprec_id VARCHAR(64),
    cuenta_deprec_acum_id VARCHAR(64),
    estado VARCHAR(30) DEFAULT 'Activo', -- Activo, Desincorporado, Depreciado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activos_fijos_empresa ON activos_fijos(empresa_id);

CREATE TABLE IF NOT EXISTS depreciaciones (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    activo_id VARCHAR(64) REFERENCES activos_fijos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    monto NUMERIC(18, 2) NOT NULL,
    depreciacion_acumulada NUMERIC(18, 2) NOT NULL,
    valor_en_libros NUMERIC(18, 2) NOT NULL,
    comprobante_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_depreciaciones_activo ON depreciaciones(activo_id, fecha DESC);

-- ==============================================================================
-- 11. PROCEDIMIENTOS ALMACENADOS Y FUNCIONES RPC ATÓMICAS (POSTGRESQL)
-- ==============================================================================

-- 11.1 ASIGNACIÓN ATÓMICA DE CORRELATIVOS FISCALES CON BLOQUEO PESIMISTA (FOR UPDATE)
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
    v_columna VARCHAR(50);
BEGIN
    -- Bloqueo pesimista para evitar condiciones de carrera (Race Condition)
    SELECT * INTO v_config 
    FROM configuracion_contable 
    WHERE empresa_id = p_empresa_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Crear configuración inicial si no existe
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
        -- Factura regular, nota de débito, crédito
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

-- 11.2 REGISTRO ATÓMICO TRANSACCIONAL DE FACTURA, RENGLONES Y CUENTA POR COBRAR
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

    -- 1. Insertar Encabezado de Factura
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

    -- 2. Insertar Renglones de Factura
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

    -- 3. Si se proveyó objeto CxC (condición crédito), insertar atómicamente
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

-- 11.3 ACTUALIZACIÓN ATÓMICA DE STOCK INDIVIDUAL CON BLOQUEO PESIMISTA (FOR UPDATE)
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

-- 11.4 ACTUALIZACIÓN ATÓMICA DE STOCK EN LOTE (BATCH INVENTORY)
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


-- ==============================================================================
-- 12. POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ==============================================================================
-- Permite lectura, inserción, actualización y eliminación para el cliente frontend (Anon / Authenticated)

ALTER TABLE IF EXISTS empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuario_empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_contables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comprobantes_diario DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lineas_comprobante DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuracion_contable DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plantillas_documentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_configuracion DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contactos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bancos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos_bancos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS solicitudes_banco DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS almacenes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias_producto DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facturas_venta DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facturas_venta_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_cobrar_cxc DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cobranzas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facturas_compra DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facturas_compra_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_pagar_cxp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pagos_realizados DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS terminales_pos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lotes_pos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lotes_pos_transacciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias_activos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activos_fijos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS depreciaciones DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- FIN DEL ESQUEMA DDL SANEADO - SISTEMA HALLEY ERP PRO (31 TABLAS)
-- ==============================================================================
