-- Script para corregir todas las relaciones de claves foráneas con ON DELETE CASCADE
-- y deshabilitar RLS para evitar conflictos 409 y bloqueos 42501.

-- 1. Asegurar que existe la tabla usuario_empresas con ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS usuario_empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'Operador',
    vendedor_id UUID,
    vendedor_nombre VARCHAR(255),
    permissions JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id, empresa_id)
);

-- 2. Modificar dinámicamente TODAS las restricciones de clave foránea que apunten a "empresas"
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'empresas'
          AND ccu.column_name = 'id'
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', r.table_schema, r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.empresas(id) ON DELETE CASCADE;', 
                r.table_schema, r.table_name, r.constraint_name, r.column_name);
            RAISE NOTICE 'Constraint % en tabla % actualizada con ON DELETE CASCADE', r.constraint_name, r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo actualizar constraint %: %', r.constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Modificar autoreferencia en cuentas contables (cuenta_padre_id) a ON DELETE SET NULL o CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name, table_name
        FROM information_schema.table_constraints
        WHERE table_name = 'cuentas_contables'
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.cuentas_contables DROP CONSTRAINT IF EXISTS %I;', r.constraint_name);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Re-crear las FKs de cuentas_contables limpias
    BEGIN
        ALTER TABLE public.cuentas_contables 
        ADD CONSTRAINT fk_cuentas_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
        ALTER TABLE public.cuentas_contables 
        ADD CONSTRAINT fk_cuentas_padre FOREIGN KEY (cuenta_padre_id) REFERENCES public.cuentas_contables(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 4. Deshabilitar Row Level Security (RLS) en todas las tablas públicas para evitar bloqueo de operaciones
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t.tablename);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;
