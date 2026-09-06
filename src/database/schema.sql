-- ==============================================================================
-- SISTEMA ERP ADMINISTRATIVO & CONTABLE NIIF - ESQUEMA DE BASE DE DATOS RELACIONAL
-- Compatible con: PostgreSQL 14+, Supabase, SQLite, MySQL 8+
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

CREATE INDEX idx_empresas_rif ON empresas(rif);

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
    permissions JSONB DEFAULT '{}'::jsonb, -- { contactos: {view, create, delete}, facturacion: {...}, ... }
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuario_empresa UNIQUE (usuario_id, empresa_id)
);

CREATE INDEX idx_usuario_empresas_user ON usuario_empresas(usuario_id);
CREATE INDEX idx_usuario_empresas_comp ON usuario_empresas(empresa_id);

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

CREATE INDEX idx_cuentas_empresa_codigo ON cuentas_contables(empresa_id, codigo);

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

CREATE INDEX idx_comprobantes_empresa_fecha ON comprobantes_diario(empresa_id, fecha);
CREATE INDEX idx_comprobantes_numero ON comprobantes_diario(empresa_id, numero);

-- Líneas de Comprobante (Partida Doble)
CREATE TABLE IF NOT EXISTS lineas_comprobante (
    id VARCHAR(64) PRIMARY KEY,
    comprobante_id VARCHAR(64) NOT NULL REFERENCES comprobantes_diario(id) ON DELETE CASCADE,
    cuenta_id VARCHAR(64) NOT NULL,
    descripcion TEXT,
    debe NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    haber NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    orden INTEGER DEFAULT 0
);

CREATE INDEX idx_lineas_comprobante_id ON lineas_comprobante(comprobante_id);
CREATE INDEX idx_lineas_cuenta_id ON lineas_comprobante(cuenta_id);

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
    
    -- Series y Correlativos
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
    comision_mode VARCHAR(30) DEFAULT 'emitidas', -- emitidas, cobradas
    active_service_template VARCHAR(100) DEFAULT 'Estándar',
    active_inventory_template VARCHAR(100) DEFAULT 'Estándar',
    
    -- Máquina Fiscal
    usa_maquina_fiscal BOOLEAN DEFAULT FALSE,
    marca_maquina_fiscal VARCHAR(50) DEFAULT 'bixolon',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plantillas de Diseño de Documentos (Facturas, Notas de Entrega)
CREATE TABLE IF NOT EXISTS plantillas_documentos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'servicios', -- servicios, inventario
    diseno_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    es_predeterminada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empresa_plantilla_nombre UNIQUE (empresa_id, nombre)
);

-- Bitácora / Auditoría de Cambios de Configuración
CREATE TABLE IF NOT EXISTS auditoria_configuracion (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_email VARCHAR(150) NOT NULL,
    seccion VARCHAR(100) NOT NULL, -- empresa, contabilidad, impuestos, correlativos, facturacion, usuarios
    cambio_detalle JSONB NOT NULL,
    ip_origen VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_empresa ON auditoria_configuracion(empresa_id, created_at DESC);

-- ==============================================================================
-- 4. TERCEROS & CONTACTOS (CLIENTES, PROVEEDORES, VENDEDORES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS contactos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) NOT NULL, -- RIF / CI
    type VARCHAR(30) NOT NULL DEFAULT 'customer', -- customer, supplier, both, employee
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    tipo_contribuyente VARCHAR(50) DEFAULT 'ordinario', -- ordinario, especial, formal
    saldo NUMERIC(18, 2) DEFAULT 0.00,
    saldo_cxp NUMERIC(18, 2) DEFAULT 0.00,
    debit_account VARCHAR(64),   -- Cuenta contable personalizada CxC
    credit_account VARCHAR(64),  -- Cuenta contable personalizada CxP
    expense_account VARCHAR(64), -- Cuenta de Gasto personalizada
    employee_type VARCHAR(50),   -- vendedor, administrativo, etc.
    comision_porcentaje NUMERIC(6, 2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contactos_empresa_taxid ON contactos(empresa_id, tax_id);
CREATE INDEX idx_contactos_tipo ON contactos(empresa_id, type);

-- ==============================================================================
-- 5. TESORERÍA, BANCOS & MOVIMIENTOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bancos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    banco VARCHAR(150) NOT NULL,
    numero_cuenta VARCHAR(50) NOT NULL,
    moneda VARCHAR(20) DEFAULT 'Bolivares', -- Bolivares, Dolares, Euros
    saldo NUMERIC(18, 2) DEFAULT 0.00,
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    cuenta_contable_id VARCHAR(64) DEFAULT '1.1.3',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
    estado VARCHAR(30) DEFAULT 'conciliado', -- conciliado, cuarentena, anulado
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movimientos_banco_fecha ON movimientos_bancos(banco_id, fecha);

-- ==============================================================================
-- 6. VENTAS, FACTURACIÓN & CUENTAS POR COBRAR (CXC)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS facturas_venta (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    tipo_documento VARCHAR(30) DEFAULT 'factura', -- factura, nota_entrega, cotizacion
    cliente_id VARCHAR(64) NOT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_rif VARCHAR(50),
    vendedor_id VARCHAR(64),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa_cambio NUMERIC(18, 4) DEFAULT 1.0000,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    base_imponible NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    monto_exento NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    iva_porcentaje NUMERIC(6, 2) DEFAULT 16.00,
    iva_monto NUMERIC(18, 2) DEFAULT 0.00,
    igtf_monto NUMERIC(18, 2) DEFAULT 0.00,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    saldo_pendiente NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'Pendiente', -- Pendiente, Cobrada, Parcial, Anulada
    comprobante_id VARCHAR(64),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cuentas_cobrar_cxc (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id VARCHAR(64) NOT NULL,
    cliente_id VARCHAR(64) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'clientes',
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(30) DEFAULT 'factura', -- factura, saldo_inicial, anticipo
    total NUMERIC(18, 2) NOT NULL,
    saldo NUMERIC(18, 2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cobranzas (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    recibo_numero VARCHAR(50) NOT NULL,
    cliente_id VARCHAR(64) NOT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    monto_total NUMERIC(18, 2) NOT NULL,
    banco_id VARCHAR(64) REFERENCES bancos(id),
    comprobante_id VARCHAR(64),
    retencion_iva NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr NUMERIC(18, 2) DEFAULT 0.00,
    diferencial_cambiario NUMERIC(18, 2) DEFAULT 0.00,
    detalles JSONB DEFAULT '[]'::jsonb, -- [{cxc_id, monto_abonado}, ...]
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. COMPRAS, GASTOS & CUENTAS POR PAGAR (CXP)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cuentas_pagar_cxp (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id VARCHAR(64) NOT NULL,
    proveedor_id VARCHAR(64) NOT NULL,
    proveedor VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'proveedores',
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(30) DEFAULT 'factura', -- factura, saldo_inicial, anticipo
    total NUMERIC(18, 2) NOT NULL,
    saldo NUMERIC(18, 2) NOT NULL,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18, 4) DEFAULT 1.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagos_realizados (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    comprobante_pago VARCHAR(50) NOT NULL,
    proveedor_id VARCHAR(64) NOT NULL,
    proveedor_nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    monto_total NUMERIC(18, 2) NOT NULL,
    banco_id VARCHAR(64) REFERENCES bancos(id),
    comprobante_id VARCHAR(64),
    retencion_iva NUMERIC(18, 2) DEFAULT 0.00,
    retencion_islr NUMERIC(18, 2) DEFAULT 0.00,
    diferencial_cambiario NUMERIC(18, 2) DEFAULT 0.00,
    detalles JSONB DEFAULT '[]'::jsonb,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. CATÁLOGO DE ARTÍCULOS Y SERVICIOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS servicios (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50),
    descripcion TEXT,
    precio NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    tipo VARCHAR(50) DEFAULT 'Servicio', -- Servicio, Producto / Inventario
    exento_iva BOOLEAN DEFAULT FALSE,
    cuenta_ingreso_id VARCHAR(64),
    cuenta_costo_id VARCHAR(64),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 9. ACTIVOS FIJOS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS activos_fijos (
    id VARCHAR(64) PRIMARY KEY,
    empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    fecha_adquisicion DATE NOT NULL,
    valor_compra NUMERIC(18, 2) NOT NULL,
    vida_util_meses INTEGER NOT NULL DEFAULT 60,
    depreciacion_acumulada NUMERIC(18, 2) DEFAULT 0.00,
    cuenta_activo_id VARCHAR(64),
    cuenta_gasto_deprec_id VARCHAR(64),
    estado VARCHAR(30) DEFAULT 'Activo', -- Activo, Desincorporado, Depreciado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 10. POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS) PARA SUPABASE
-- ==============================================================================
-- Permite lectura, inserción, actualización y eliminación para el cliente frontend (Anon / Authenticated)

ALTER TABLE IF EXISTS empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuario_empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activos_fijos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_contables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comprobantes_diario DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lineas_comprobante DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bancos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos_bancos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contactos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facturas_venta DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_cobrar_cxc DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cobranzas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cuentas_pagar_cxp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pagos_realizados DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuracion_contable DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plantillas_documentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria_configuracion DISABLE ROW LEVEL SECURITY;

-- Migraciones y actualización de columnas
ALTER TABLE IF EXISTS contactos ADD COLUMN IF NOT EXISTS debit_account VARCHAR(64);
ALTER TABLE IF EXISTS contactos ADD COLUMN IF NOT EXISTS credit_account VARCHAR(64);
ALTER TABLE IF EXISTS contactos ADD COLUMN IF NOT EXISTS expense_account VARCHAR(64);

-- ==============================================================================
-- FIN DEL ESQUEMA DDL - SISTEMA BASE
-- ==============================================================================


