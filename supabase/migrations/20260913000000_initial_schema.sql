-- Migración Inicial: Sistema Base Pro ERP NIIF
-- Archivo generado para PostgreSQL (Supabase)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONFIGURACIÓN Y CORE
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    rif VARCHAR(50) NOT NULL UNIQUE,
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(150),
    logo TEXT,
    moneda_principal VARCHAR(3) DEFAULT 'USD',
    moneda_secundaria VARCHAR(3) DEFAULT 'VES',
    tipo_contribuyente VARCHAR(50) DEFAULT 'ordinario',
    tipo_empresa VARCHAR(50) DEFAULT 'comercial',
    habilitar_pos BOOLEAN DEFAULT TRUE,
    habilitar_vendedores BOOLEAN DEFAULT TRUE,
    habilitar_pedidos BOOLEAN DEFAULT TRUE,
    habilitar_tasa_referencial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT,
    nombre VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Operador',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE usuario_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    vendedor_id UUID,
    vendedor_nombre VARCHAR(255),
    permissions JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, empresa_id)
);

CREATE TABLE configuracion_contable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
    cuenta_inventario UUID,
    cuenta_costo_ventas UUID,
    cuenta_ventas UUID,
    cuenta_gastos UUID,
    cuenta_anticipo_recibido UUID,
    cuenta_anticipo_otorgado UUID,
    cuenta_cxc UUID,
    cuenta_cxp UUID,
    cuenta_debito_fiscal UUID,
    cuenta_credito_fiscal UUID,
    cuenta_iva_retenido_ventas UUID,
    cuenta_iva_retenido_compras UUID,
    cuenta_islr_retenido_ventas UUID,
    cuenta_islr_retenido_compras UUID,
    cuenta_ganancia_diferencial UUID,
    cuenta_perdida_diferencial UUID,
    cuenta_utilidad_anteriores UUID,
    mes_cierre VARCHAR(2) DEFAULT '12',
    working_year VARCHAR(4) NOT NULL,
    iva NUMERIC(5,2) DEFAULT 16.00,
    igtf NUMERIC(5,2) DEFAULT 3.00,
    retencion_iva NUMERIC(5,2) DEFAULT 75.00,
    retencion_islr NUMERIC(5,2) DEFAULT 2.00,
    prefijo_factura VARCHAR(10),
    correlativo_factura INTEGER DEFAULT 1,
    prefijo_cotizacion VARCHAR(10),
    correlativo_cotizacion INTEGER DEFAULT 1,
    prefijo_nota_entrega VARCHAR(10),
    correlativo_nota_entrega INTEGER DEFAULT 1,
    prefijo_recibo VARCHAR(10),
    correlativo_recibo INTEGER DEFAULT 1,
    dias_vencimiento_default INTEGER DEFAULT 0,
    notas_default TEXT,
    comision_mode VARCHAR(20) DEFAULT 'emitidas',
    active_service_template TEXT,
    active_inventory_template TEXT,
    usa_maquina_fiscal BOOLEAN DEFAULT FALSE,
    marca_maquina_fiscal VARCHAR(100),
    puerto_maquina_fiscal VARCHAR(50),
    formato_impresion VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CONTABILIDAD
CREATE TABLE cuentas_contables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- Movimiento | Grupo
    naturaleza VARCHAR(50) NOT NULL, -- Deudora | Acreedora
    grupo VARCHAR(50) NOT NULL, -- Activo | Pasivo...
    nivel INTEGER NOT NULL,
    cuenta_padre_id UUID REFERENCES cuentas_contables(id),
    saldo_actual NUMERIC(18,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, codigo)
);

CREATE TABLE comprobantes_diario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    referencia VARCHAR(100),
    total NUMERIC(18,2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Contabilizado',
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, numero)
);

CREATE TABLE lineas_comprobante (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comprobante_id UUID REFERENCES comprobantes_diario(id) ON DELETE CASCADE,
    cuenta_id UUID REFERENCES cuentas_contables(id),
    descripcion TEXT,
    debe NUMERIC(18,2) DEFAULT 0,
    haber NUMERIC(18,2) DEFAULT 0,
    orden INTEGER DEFAULT 0
);

-- 3. CONTACTOS (Clientes, Proveedores, Empleados)
CREATE TABLE contactos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- customer, supplier, employee...
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    tipo_contribuyente VARCHAR(50) DEFAULT 'ordinario',
    saldo NUMERIC(18,2) DEFAULT 0,
    saldo_cxp NUMERIC(18,2) DEFAULT 0,
    debit_account UUID REFERENCES cuentas_contables(id),
    credit_account UUID REFERENCES cuentas_contables(id),
    expense_account UUID REFERENCES cuentas_contables(id),
    employee_type VARCHAR(50),
    comision_porcentaje NUMERIC(5,2) DEFAULT 0,
    codigo_iata VARCHAR(50),
    codigo_dos_letras VARCHAR(5),
    terminal_agente VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, tax_id, type)
);

-- 4. BANCOS Y TESORERÍA
CREATE TABLE bancos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    banco VARCHAR(255) NOT NULL,
    numero_cuenta VARCHAR(100) NOT NULL,
    moneda VARCHAR(50) NOT NULL,
    saldo NUMERIC(18,2) DEFAULT 0,
    tasa NUMERIC(18,4) DEFAULT 1,
    cuenta_contable_id UUID REFERENCES cuentas_contables(id),
    activo BOOLEAN DEFAULT TRUE,
    es_caja BOOLEAN DEFAULT FALSE,
    tipo_cuenta VARCHAR(50) DEFAULT 'nacional',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE movimientos_bancos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    banco_id UUID REFERENCES bancos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    ref VARCHAR(100),
    descripcion TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- ingreso | egreso | transferencia
    monto NUMERIC(18,2) NOT NULL,
    tasa NUMERIC(18,4) DEFAULT 1,
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    estado VARCHAR(50) DEFAULT 'conciliado',
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ALMACENES Y PRODUCTOS
CREATE TABLE almacenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    ubicacion TEXT,
    responsable VARCHAR(255),
    es_principal BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categorias_producto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    color VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    codigo_barra VARCHAR(100),
    referencia_fabrica VARCHAR(100),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    unidad_medida VARCHAR(50) DEFAULT 'UND',
    unidad_empaque VARCHAR(50),
    factor_empaque NUMERIC(10,2),
    ubicacion VARCHAR(100),
    costo_unitario NUMERIC(18,2) DEFAULT 0,
    costo_promedio NUMERIC(18,2) DEFAULT 0,
    precio_venta NUMERIC(18,2) DEFAULT 0,
    precio_mayor NUMERIC(18,2) DEFAULT 0,
    precio_vip NUMERIC(18,2) DEFAULT 0,
    precio_minimo NUMERIC(18,2) DEFAULT 0,
    stock_actual NUMERIC(18,2) DEFAULT 0,
    stock_minimo NUMERIC(18,2) DEFAULT 0,
    stock_maximo NUMERIC(18,2),
    punto_reorden NUMERIC(18,2),
    almacen_id UUID REFERENCES almacenes(id),
    aplica_iva BOOLEAN DEFAULT TRUE,
    alicuota_iva VARCHAR(50) DEFAULT 'general',
    cuenta_inventario_id UUID REFERENCES cuentas_contables(id),
    cuenta_costo_id UUID REFERENCES cuentas_contables(id),
    cuenta_venta_id UUID REFERENCES cuentas_contables(id),
    cuenta_ingreso_id UUID REFERENCES cuentas_contables(id),
    activo BOOLEAN DEFAULT TRUE,
    imagen_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, codigo)
);

CREATE TABLE movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    almacen_origen_id UUID REFERENCES almacenes(id),
    almacen_destino_id UUID REFERENCES almacenes(id),
    cantidad NUMERIC(18,2) NOT NULL,
    stock_anterior NUMERIC(18,2) NOT NULL,
    stock_resultante NUMERIC(18,2) NOT NULL,
    costo_unitario NUMERIC(18,2) NOT NULL,
    referencia VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    usuario VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. FACTURACIÓN Y COMPRAS
CREATE TABLE facturas_venta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    control_numero VARCHAR(50),
    tipo_documento VARCHAR(50) NOT NULL,
    condicion VARCHAR(50) DEFAULT 'contado',
    dias_credito INTEGER,
    cliente_id UUID REFERENCES contactos(id),
    vendedor_id UUID REFERENCES contactos(id),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    moneda VARCHAR(10) NOT NULL,
    tasa_cambio NUMERIC(18,4) NOT NULL,
    subtotal NUMERIC(18,2) NOT NULL,
    subtotal_bs NUMERIC(18,2),
    base_imponible NUMERIC(18,2) NOT NULL,
    base_imponible_bs NUMERIC(18,2),
    monto_exento NUMERIC(18,2) DEFAULT 0,
    monto_exento_bs NUMERIC(18,2) DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) DEFAULT 16,
    iva_monto NUMERIC(18,2) DEFAULT 0,
    iva_monto_bs NUMERIC(18,2) DEFAULT 0,
    igtf_porcentaje NUMERIC(5,2) DEFAULT 3,
    igtf_monto NUMERIC(18,2) DEFAULT 0,
    igtf_monto_bs NUMERIC(18,2) DEFAULT 0,
    retencion_iva_porcentaje NUMERIC(5,2),
    retencion_iva_monto NUMERIC(18,2),
    retencion_iva_monto_bs NUMERIC(18,2),
    comprobante_retencion_iva_numero VARCHAR(50),
    comprobante_retencion_iva_fecha DATE,
    retencion_islr_porcentaje NUMERIC(5,2),
    retencion_islr_monto NUMERIC(18,2),
    retencion_islr_monto_bs NUMERIC(18,2),
    comprobante_retencion_islr_numero VARCHAR(50),
    comprobante_retencion_islr_fecha DATE,
    neto_cobrar NUMERIC(18,2),
    total NUMERIC(18,2) NOT NULL,
    total_bs NUMERIC(18,2),
    saldo_pendiente NUMERIC(18,2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'emitida',
    banco_id UUID REFERENCES bancos(id),
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    cxc_id UUID,
    monto_recibido NUMERIC(18,2),
    vuelto NUMERIC(18,2),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, numero, tipo_documento)
);

CREATE TABLE facturas_venta_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factura_id UUID REFERENCES facturas_venta(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id),
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(18,2) NOT NULL,
    precio_unitario NUMERIC(18,2) NOT NULL,
    exento BOOLEAN DEFAULT FALSE,
    subtotal NUMERIC(18,2) NOT NULL,
    iva_monto NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) NOT NULL,
    cuenta_ingreso_id UUID REFERENCES cuentas_contables(id),
    cuenta_costo_id UUID REFERENCES cuentas_contables(id),
    cuenta_inventario_id UUID REFERENCES cuentas_contables(id)
);

CREATE TABLE facturas_compra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50) NOT NULL,
    control_numero VARCHAR(50),
    tipo_documento VARCHAR(50) NOT NULL,
    condicion VARCHAR(50) DEFAULT 'contado',
    proveedor_id UUID REFERENCES contactos(id),
    almacen_destino_id UUID REFERENCES almacenes(id),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    moneda VARCHAR(10) NOT NULL,
    tasa_cambio NUMERIC(18,4) NOT NULL,
    subtotal NUMERIC(18,2) NOT NULL,
    base_imponible NUMERIC(18,2) NOT NULL,
    monto_exento NUMERIC(18,2) DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) DEFAULT 16,
    iva_monto NUMERIC(18,2) DEFAULT 0,
    igtf_porcentaje NUMERIC(5,2) DEFAULT 3,
    igtf_monto NUMERIC(18,2) DEFAULT 0,
    retencion_iva_porcentaje NUMERIC(5,2),
    retencion_iva_monto NUMERIC(18,2),
    retencion_islr_porcentaje NUMERIC(5,2),
    retencion_islr_monto NUMERIC(18,2),
    total NUMERIC(18,2) NOT NULL,
    saldo_pendiente NUMERIC(18,2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'emitida',
    banco_id UUID REFERENCES bancos(id),
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    cxp_id UUID,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE facturas_compra_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factura_id UUID REFERENCES facturas_compra(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id),
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(18,2) NOT NULL,
    costo_unitario NUMERIC(18,2) NOT NULL,
    exento BOOLEAN DEFAULT FALSE,
    alicuota_iva NUMERIC(5,2) DEFAULT 16,
    subtotal NUMERIC(18,2) NOT NULL,
    iva_monto NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) NOT NULL,
    actualizar_costo BOOLEAN DEFAULT TRUE,
    nuevo_precio_venta NUMERIC(18,2),
    cuenta_inventario_id UUID REFERENCES cuentas_contables(id),
    cuenta_gasto_id UUID REFERENCES cuentas_contables(id)
);

-- 7. CUENTAS POR COBRAR Y PAGAR
CREATE TABLE cuentas_cobrar_cxc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id UUID REFERENCES facturas_venta(id),
    cliente_id UUID REFERENCES contactos(id),
    categoria VARCHAR(100),
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL,
    total NUMERIC(18,2) NOT NULL,
    saldo NUMERIC(18,2) NOT NULL,
    moneda VARCHAR(10) NOT NULL,
    tasa NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cobranzas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    recibo_numero VARCHAR(50) NOT NULL,
    cliente_id UUID REFERENCES contactos(id),
    fecha DATE NOT NULL,
    monto_total NUMERIC(18,2) NOT NULL,
    banco_id UUID REFERENCES bancos(id),
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    retencion_iva NUMERIC(18,2) DEFAULT 0,
    retencion_islr NUMERIC(18,2) DEFAULT 0,
    diferencial_cambiario NUMERIC(18,2) DEFAULT 0,
    detalles JSONB DEFAULT '[]'::jsonb,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cuentas_pagar_cxp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    factura_id UUID REFERENCES facturas_compra(id),
    proveedor_id UUID REFERENCES contactos(id),
    categoria VARCHAR(100),
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL,
    total NUMERIC(18,2) NOT NULL,
    saldo NUMERIC(18,2) NOT NULL,
    moneda VARCHAR(10) NOT NULL,
    tasa NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE pagos_realizados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    comprobante_pago VARCHAR(50) NOT NULL,
    proveedor_id UUID REFERENCES contactos(id),
    fecha DATE NOT NULL,
    monto_total NUMERIC(18,2) NOT NULL,
    banco_id UUID REFERENCES bancos(id),
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    retencion_iva NUMERIC(18,2) DEFAULT 0,
    retencion_islr NUMERIC(18,2) DEFAULT 0,
    diferencial_cambiario NUMERIC(18,2) DEFAULT 0,
    detalles JSONB DEFAULT '[]'::jsonb,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. COMPROBANTES DE RETENCION (FISCAL)
CREATE TABLE comprobantes_retencion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL, -- IVA o ISLR
    numero_comprobante VARCHAR(50) NOT NULL,
    periodo_fiscal VARCHAR(10) NOT NULL,
    fecha_emision DATE NOT NULL,
    origen VARCHAR(20) NOT NULL, -- compra o venta
    sujeto_id UUID REFERENCES contactos(id),
    factura_id UUID,
    factura_numero VARCHAR(50),
    factura_control VARCHAR(50),
    factura_fecha DATE,
    monto_total NUMERIC(18,2) NOT NULL,
    base_imponible NUMERIC(18,2) NOT NULL,
    exento NUMERIC(18,2) DEFAULT 0,
    alicuota NUMERIC(5,2) DEFAULT 16,
    impuesto_monto NUMERIC(18,2) DEFAULT 0,
    porcentaje_retencion NUMERIC(5,2) NOT NULL,
    monto_retenido NUMERIC(18,2) NOT NULL,
    monto_retenido_bs NUMERIC(18,2),
    tasa_cambio NUMERIC(18,4) NOT NULL,
    concepto_islr VARCHAR(255),
    estado VARCHAR(50) DEFAULT 'emitido',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TERMINALES Y LOTES POS
CREATE TABLE terminales_pos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    banco_id UUID REFERENCES bancos(id),
    cuenta_transitoria_id UUID REFERENCES cuentas_contables(id),
    cuenta_comision_id UUID REFERENCES cuentas_contables(id),
    comision_estimada NUMERIC(5,2) DEFAULT 0,
    tipo_cuenta VARCHAR(50) DEFAULT 'nacional',
    moneda VARCHAR(10) DEFAULT 'VES',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE lotes_pos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    terminal_id UUID REFERENCES terminales_pos(id) ON DELETE CASCADE,
    banco_id UUID REFERENCES bancos(id),
    lote_numero VARCHAR(50) NOT NULL,
    fecha_apertura TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    fecha_acreditacion TIMESTAMP WITH TIME ZONE,
    total_operaciones INTEGER DEFAULT 0,
    monto_bruto_sistema NUMERIC(18,2) DEFAULT 0,
    monto_bruto_ticket NUMERIC(18,2) DEFAULT 0,
    diferencia NUMERIC(18,2) DEFAULT 0,
    comision_porcentaje NUMERIC(5,2) DEFAULT 0,
    comision_monto NUMERIC(18,2) DEFAULT 0,
    retencion_iva_monto NUMERIC(18,2) DEFAULT 0,
    retencion_islr_monto NUMERIC(18,2) DEFAULT 0,
    monto_neto_banco NUMERIC(18,2) DEFAULT 0,
    tasa_cambio NUMERIC(18,4),
    estado VARCHAR(50) DEFAULT 'abierto',
    referencia_banco VARCHAR(100),
    movimiento_banco_id UUID REFERENCES movimientos_bancos(id),
    comprobante_id UUID REFERENCES comprobantes_diario(id),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE lotes_pos_transacciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID REFERENCES lotes_pos(id) ON DELETE CASCADE,
    factura_id UUID REFERENCES facturas_venta(id),
    referencia VARCHAR(100) NOT NULL,
    monto_bs NUMERIC(18,2),
    monto_usd NUMERIC(18,2),
    hora TIME,
    fecha DATE
);

-- 10. POLÍTICAS DE SEGURIDAD (RLS) - Opcional para Supabase
-- Habilitar RLS en tablas clave si es necesario:
-- ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE facturas_venta ENABLE ROW LEVEL SECURITY;
-- etc.

