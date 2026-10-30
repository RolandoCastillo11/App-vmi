-- ==============================================================================
-- VMI RETAIL MÉXICO / ALMACENES IBARRA - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Invitation Codes / Folios Table (Control de seguridad de registros)
CREATE TABLE IF NOT EXISTS invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    max_uses INTEGER DEFAULT 1,
    times_used INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT CHECK (role IN ('shop', 'driver', 'cedis')) DEFAULT 'shop',
    shop_id TEXT,
    shop_name TEXT,
    phone TEXT,
    address TEXT,
    rfc TEXT,
    delivery_reference TEXT,
    invitation_code TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shops / Tiendas Table (Puntos de entrega para rutas VMI)
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY DEFAULT ('shp-' || substr(md5(random()::text), 1, 8)),
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    address TEXT,
    contact TEXT,
    phone TEXT,
    rfc TEXT,
    delivery_reference TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products Table (Almacena tanto el inventario en tienda como el catálogo del CEDIS)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT ('prod-' || substr(md5(random()::text), 1, 8)),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    category TEXT DEFAULT 'General',
    is_catalog BOOLEAN DEFAULT FALSE, -- FALSE = Inventario en Tienda, TRUE = Catálogo de CEDIS Ibarra
    shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Orders Table (Pedidos de reabastecimiento VMI)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT ('ORD-MX-' || floor(random() * 9000 + 1000)::text),
    shop_id TEXT REFERENCES shops(id) ON DELETE SET NULL,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered')) DEFAULT 'pending',
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    signature_url TEXT,
    receiver_name TEXT,
    delivery_notes TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT ('item-' || substr(md5(random()::text), 1, 8)),
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso Público / Anon y Autenticado (Permite lectura y escritura inmediata para desarrollo)
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify profiles" ON profiles;
CREATE POLICY "Public modify profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read shops" ON shops;
CREATE POLICY "Public read shops" ON shops FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify shops" ON shops;
CREATE POLICY "Public modify shops" ON shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify products" ON products;
CREATE POLICY "Public modify products" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read orders" ON orders;
CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify orders" ON orders;
CREATE POLICY "Public modify orders" ON orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read order_items" ON order_items;
CREATE POLICY "Public read order_items" ON order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public modify order_items" ON order_items;
CREATE POLICY "Public modify order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- REALTIME REPLICATION SETUP
-- ==============================================================================
-- Habilitar réplicas en tiempo real de forma segura (sin errores si ya existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  END IF;
END $$;

-- ==============================================================================
-- SEED DATA INICIAL (TAMPICO, MADERO Y ALTAMIRA - ALMACENES IBARRA)
-- ==============================================================================

-- Tiendas asociadas
INSERT INTO shops (id, name, lat, lng, address, contact) VALUES
('shp-1', 'Abarrotes Don Lupe', 22.2155, -97.8578, 'Zona Centro, Tampico', 'Don Lupe (833) 100-2030'),
('shp-2', 'Miscelánea La Fe', 22.2110, -97.8630, 'Col. Cascajal, Tampico', 'Doña María (833) 100-2031'),
('shp-3', 'Mini Súper Miramar', 22.2745, -97.8105, 'Cd. Madero Centro', 'Carlos R. (833) 100-2032'),
('shp-4', 'Abarrotes El Profe', 22.2470, -97.8340, 'Col. Árbol Grande, Cd. Madero', 'Profe Gómez (833) 100-2033'),
('shp-5', 'Tienda La Moderna', 22.2590, -97.8680, 'Col. Las Américas, Tampico', 'Sra. Patricia (833) 100-2034'),
('shp-6', 'Miscelánea Laguna', 22.3250, -97.8980, 'Col. Laguna de la Puerta, Altamira', 'Roberto M. (833) 100-2035')
ON CONFLICT (id) DO NOTHING;

-- Catálogo de Proveedor (CEDIS Ibarra)
INSERT INTO products (id, name, sku, stock, price, image_url, category, is_catalog) VALUES
('cat-1', 'Coca-Cola 600ml (Caja 24)', 'CC-600-X24', 120, 480.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200', 'Bebidas', TRUE),
('cat-2', 'Sabritas Sal 45g (Caja 30)', 'SAB-SAL-X30', 65, 360.00, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=200', 'Botanas', TRUE),
('cat-3', 'Leche Alpura 1L (Caja 12)', 'ALP-1L-X12', 90, 240.00, 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200', 'Lácteos', TRUE),
('cat-4', 'Pan Bimbo Blanco', 'BIM-BLA-10', 80, 45.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200', 'Panadería', TRUE),
('cat-5', 'Galletas Marías Gamesa (Caja 20)', 'GAM-MAR-X20', 70, 290.00, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=200', 'Galletas', TRUE),
('cat-6', 'Aceite 1-2-3 1L (Caja 12)', 'ACE-123-X12', 40, 420.00, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=200', 'Abarrotes', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Inventario de Tienda (Don Lupe)
INSERT INTO products (id, name, sku, stock, price, image_url, category, is_catalog) VALUES
('inv-1', 'Coca-Cola 600ml', 'CC-600-MX', 4, 20.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200', 'Bebidas', FALSE),
('inv-2', 'Barcel Chips Jalapeño', 'BC-JAL-120', 15, 22.00, 'https://images.unsplash.com/photo-1599599811450-2bcdd86fd596?auto=format&fit=crop&q=80&w=200', 'Botanas', FALSE),
('inv-3', 'Agua Ciel 1L', 'CIEL-1L', 42, 14.00, 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200', 'Bebidas', FALSE),
('inv-4', 'Leche Alpura 1L', 'ALP-1L', 6, 26.00, 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200', 'Lácteos', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Pedidos de Ejemplo
INSERT INTO orders (id, shop_id, total, status, created_at) VALUES
('ORD-MX-9821', 'shp-1', 1320.00, 'confirmed', NOW() - INTERVAL '3 hours'),
('ORD-MX-7734', 'shp-2', 720.00, 'delivered', NOW() - INTERVAL '1 day'),
('ORD-MX-6512', 'shp-3', 960.00, 'pending', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- Detalle de Pedidos
INSERT INTO order_items (id, order_id, product_id, name, quantity, price) VALUES
('item-1', 'ORD-MX-9821', 'cat-1', 'Coca-Cola 600ml (Caja 24)', 2, 480.00),
('item-2', 'ORD-MX-9821', 'cat-2', 'Sabritas Sal 45g (Caja 30)', 1, 360.00),
('item-3', 'ORD-MX-7734', 'cat-3', 'Leche Alpura 1L (Caja 12)', 3, 240.00),
('item-4', 'ORD-MX-6512', 'cat-1', 'Coca-Cola 600ml (Caja 24)', 2, 480.00)
ON CONFLICT (id) DO NOTHING;
