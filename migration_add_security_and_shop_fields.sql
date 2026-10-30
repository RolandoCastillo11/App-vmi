-- ==============================================================================
-- MIGRACIÓN: SEGURIDAD Y CAMPOS ADICIONALES PARA REGISTRO DE TIENDAS VMI
-- ==============================================================================

-- 1. Tabla de Códigos de Invitación / Folios CEDIS Ibarra
CREATE TABLE IF NOT EXISTS invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    max_uses INTEGER DEFAULT 1,
    times_used INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en códigos de invitación
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public check invitation_codes" ON invitation_codes;
CREATE POLICY "Public check invitation_codes" ON invitation_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify invitation_codes" ON invitation_codes;
CREATE POLICY "Public modify invitation_codes" ON invitation_codes FOR ALL USING (true) WITH CHECK (true);

-- Insertar folios de demostración y activación para CEDIS Altamira
INSERT INTO invitation_codes (code, description, max_uses) VALUES
('IBARRA-VMI-2026', 'Folio General Piloto VMI Almacenes Ibarra', 100),
('CEDIS-ALT-7701', 'Folio Exclusivo Zona Altamira Centro', 5),
('CEDIS-TAM-8802', 'Folio Exclusivo Zona Tampico Cascajal', 5),
('CEDIS-MAD-9903', 'Folio Exclusivo Zona Cd. Madero Miramar', 5)
ON CONFLICT (code) DO NOTHING;

-- 2. Agregar campos adicionales a la tabla `profiles`
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rfc TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_reference TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 3. Agregar campos adicionales a la tabla `shops`
ALTER TABLE shops ADD COLUMN IF NOT EXISTS rfc TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_reference TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. Agregar campos para Prueba de Entrega (POD - Firma digital) a la tabla `orders`
ALTER TABLE orders ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receiver_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 5. Personal Corporativo Oficial Preestablecido (Choferes y CEDIS)
-- Nota: La tabla `profiles` tiene una llave foránea que exige que el ID exista previamente en `auth.users`.
-- Creamos primero las cuentas en `auth.users` (contraseña: ibarra2026) y luego sus registros en `public.profiles`.

DO $$
BEGIN
    -- Asegurar extensión para hashing seguro bcrypt
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- 5.1 Chofer #402 (Carlos Mendoza) en auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'chofer402@ibarra.com.mx') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            'd0000000-0000-0000-0000-000000000402',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'chofer402@ibarra.com.mx',
            crypt('ibarra2026', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Carlos Mendoza","role":"driver"}'::jsonb,
            NOW(),
            NOW()
        );
    END IF;

    -- 5.2 Administrador CEDIS Altamira (Ing. Roberto Garza) en auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cedis.altamira@ibarra.com.mx') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            'c0000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'cedis.altamira@ibarra.com.mx',
            crypt('ibarra2026', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Ing. Roberto Garza","role":"cedis"}'::jsonb,
            NOW(),
            NOW()
        );
    END IF;

    -- 5.3 Vincular identidades para inicio de sesión por email en Supabase Auth
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES 
    (
        'd0000000-0000-0000-0000-000000000402',
        'd0000000-0000-0000-0000-000000000402',
        jsonb_build_object('sub', 'd0000000-0000-0000-0000-000000000402', 'email', 'chofer402@ibarra.com.mx'),
        'email',
        'chofer402@ibarra.com.mx',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        'c0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000001', 'email', 'cedis.altamira@ibarra.com.mx'),
        'email',
        'cedis.altamira@ibarra.com.mx',
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

    -- 5.4 Insertar en public.profiles (garantizado con la llave foránea de auth.users)
    INSERT INTO public.profiles (id, email, full_name, role, is_verified, phone) VALUES
    ('d0000000-0000-0000-0000-000000000402', 'chofer402@ibarra.com.mx', 'Carlos Mendoza (Chofer #402)', 'driver', true, '8334021100'),
    ('c0000000-0000-0000-0000-000000000001', 'cedis.altamira@ibarra.com.mx', 'Ing. Roberto Garza (Jefe CEDIS Altamira)', 'cedis', true, '8332601000')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_verified = EXCLUDED.is_verified,
        phone = EXCLUDED.phone;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Aviso al registrar usuarios corporativos: %', SQLERRM;
END $$;

-- ==============================================================================
-- 6. CAMPOS DE COBRANZA, LIQUIDACIÓN Y LOGÍSTICA INVERSA (MERMAS) EN `orders`
-- ==============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_collected NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_items_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- ==============================================================================
-- 7. TABLA `driver_locations` PARA RASTREO GPS EN VIVO DE UNIDADES DE REPARTO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS driver_locations (
    driver_id TEXT PRIMARY KEY,
    driver_name TEXT NOT NULL DEFAULT 'Carlos Mendoza (Chofer #402)',
    unit_number TEXT NOT NULL DEFAULT 'Camión #402 - Ford Cargo',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION DEFAULT 0,
    speed_kmh DOUBLE PRECISION DEFAULT 0,
    current_stop_id TEXT,
    current_stop_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read driver_locations" ON driver_locations;
CREATE POLICY "Public read driver_locations" ON driver_locations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write driver_locations" ON driver_locations;
CREATE POLICY "Public write driver_locations" ON driver_locations FOR ALL USING (true) WITH CHECK (true);

INSERT INTO driver_locations (driver_id, driver_name, unit_number, lat, lng, speed_kmh, current_stop_id, current_stop_name, is_active)
VALUES ('chofer-402', 'Carlos Mendoza (Chofer #402)', 'Camión #402 • Ford Cargo', 22.3385, -97.9042, 0, 'shp-6', 'Miscelánea Laguna', true)
ON CONFLICT (driver_id) DO NOTHING;

-- ==============================================================================
-- 8. TABLA `route_settlements` PARA ARQUEO Y CORTE DE CAJA DEL CHOFER EN CEDIS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS route_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id TEXT NOT NULL DEFAULT 'chofer-402',
    driver_name TEXT NOT NULL DEFAULT 'Carlos Mendoza (Chofer #402)',
    route_date DATE DEFAULT CURRENT_DATE,
    total_cash NUMERIC(10,2) DEFAULT 0,
    total_transfer NUMERIC(10,2) DEFAULT 0,
    total_credit NUMERIC(10,2) DEFAULT 0,
    total_returns NUMERIC(10,2) DEFAULT 0,
    net_total NUMERIC(10,2) DEFAULT 0,
    stops_completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE route_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access route_settlements" ON route_settlements;
CREATE POLICY "Public access route_settlements" ON route_settlements FOR ALL USING (true) WITH CHECK (true);



    