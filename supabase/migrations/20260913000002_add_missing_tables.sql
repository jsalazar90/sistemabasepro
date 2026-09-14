-- Script para agregar tablas faltantes y corregir foreign keys sin ON DELETE CASCADE

-- 1. SOLICITUDES DE BANCO
CREATE TABLE IF NOT EXISTS solicitudes_banco (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50),
    estado VARCHAR(50),
    fecha DATE,
    fecha_requerida DATE,
    contacto_id UUID,
    contacto_nombre VARCHAR(255),
    contacto_tipo VARCHAR(50),
    banco_id UUID REFERENCES bancos(id) ON DELETE CASCADE,
    banco_nombre VARCHAR(255),
    monto NUMERIC(18,2) DEFAULT 0,
    moneda VARCHAR(10) DEFAULT 'USD',
    tasa NUMERIC(18,4) DEFAULT 1.0,
    monto_ves NUMERIC(18,2) DEFAULT 0,
    referencia VARCHAR(255),
    metodo_pago VARCHAR(50),
    descripcion TEXT,
    categoria_concepto VARCHAR(100),
    comprobante_adjunto TEXT,
    datos_pago_beneficiario JSONB,
    fecha_resolucion DATE,
    usuario_resolucion VARCHAR(100),
    banco_resolucion_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
    referencia_resolucion VARCHAR(255),
    nota_resolucion TEXT,
    movimiento_banco_id UUID,
    comprobante_contable_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CATEGORIAS DE ACTIVOS
CREATE TABLE IF NOT EXISTS categorias_activos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    color VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DEPRECIACIONES
CREATE TABLE IF NOT EXISTS depreciaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    activo_id UUID REFERENCES activos_fijos(id) ON DELETE CASCADE,
    fecha DATE,
    monto NUMERIC(18,2) DEFAULT 0,
    comprobante_id UUID,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PEDIDOS
CREATE TABLE IF NOT EXISTS pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    numero VARCHAR(50),
    fecha DATE,
    cliente_id UUID REFERENCES contactos(id) ON DELETE CASCADE,
    cliente_nombre VARCHAR(255),
    vendedor_id UUID,
    vendedor_nombre VARCHAR(255),
    subtotal NUMERIC(18,2) DEFAULT 0,
    iva_monto NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    moneda VARCHAR(10) DEFAULT 'USD',
    notas TEXT,
    detalles JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CORREGIR FOREIGN KEYS EXISTENTES
-- Si servicios y activos_fijos fueron creados sin ON DELETE CASCADE, los alteramos.

DO $$ 
BEGIN
  -- Intentar eliminar la constraint de empresa_id en servicios si existe
  BEGIN
    ALTER TABLE servicios DROP CONSTRAINT IF EXISTS servicios_empresa_id_fkey;
  EXCEPTION
    WHEN undefined_table THEN
      -- do nothing
  END;
  
  BEGIN
    ALTER TABLE servicios ADD CONSTRAINT servicios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN undefined_table THEN
      -- do nothing
  END;

  -- Intentar eliminar la constraint de empresa_id en activos_fijos si existe
  BEGIN
    ALTER TABLE activos_fijos DROP CONSTRAINT IF EXISTS activos_fijos_empresa_id_fkey;
  EXCEPTION
    WHEN undefined_table THEN
      -- do nothing
  END;
  
  BEGIN
    ALTER TABLE activos_fijos ADD CONSTRAINT activos_fijos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN undefined_table THEN
      -- do nothing
  END;
END $$;
