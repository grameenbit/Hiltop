-- Supabase SQL Schema for Dokan Sathi / ClothShop
-- Run this in the Supabase SQL Editor

-- 1. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    items_details TEXT,
    total_amount DECIMAL NOT NULL DEFAULT 0,
    paid_amount DECIMAL NOT NULL DEFAULT 0,
    due_amount DECIMAL NOT NULL DEFAULT 0,
    profit DECIMAL NOT NULL DEFAULT 0,
    worker_name TEXT,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount DECIMAL NOT NULL DEFAULT 0,
    description TEXT,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    balance DECIMAL NOT NULL DEFAULT 0,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Stock Table
CREATE TABLE IF NOT EXISTS public.stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price DECIMAL NOT NULL DEFAULT 0,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    outstanding DECIMAL NOT NULL DEFAULT 0,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Profiles (Employees) Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    pin TEXT,
    role TEXT DEFAULT 'staff',
    position TEXT DEFAULT 'Salesman',
    commission_rate DECIMAL DEFAULT 5,
    salary DECIMAL DEFAULT 0,
    advance DECIMAL DEFAULT 0,
    sales_amount DECIMAL DEFAULT 0,
    business_id TEXT DEFAULT 'temp-id',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- MIGRATION: In case the table already exists but lacks these columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='display_name') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='position') THEN
        ALTER TABLE public.profiles ADD COLUMN position TEXT DEFAULT 'Salesman';
    END IF;
END
$$;

-- ENABLE RLS (Row Level Security)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- CLEANUP OLD POLICIES (to avoid "already exists" errors)
DO $$
BEGIN
    -- Sales
    DROP POLICY IF EXISTS "Public Read" ON public.sales;
    DROP POLICY IF EXISTS "Public Insert" ON public.sales;
    DROP POLICY IF EXISTS "Public Update" ON public.sales;
    -- Expenses
    DROP POLICY IF EXISTS "Public Read" ON public.expenses;
    DROP POLICY IF EXISTS "Public Insert" ON public.expenses;
    DROP POLICY IF EXISTS "Public Update" ON public.expenses;
    -- Customers
    DROP POLICY IF EXISTS "Public Read" ON public.customers;
    DROP POLICY IF EXISTS "Public Insert" ON public.customers;
    DROP POLICY IF EXISTS "Public Update" ON public.customers;
    -- Stock
    DROP POLICY IF EXISTS "Public Read" ON public.stock;
    DROP POLICY IF EXISTS "Public Insert" ON public.stock;
    DROP POLICY IF EXISTS "Public Update" ON public.stock;
    -- Suppliers
    DROP POLICY IF EXISTS "Public Read" ON public.suppliers;
    DROP POLICY IF EXISTS "Public Insert" ON public.suppliers;
    DROP POLICY IF EXISTS "Public Update" ON public.suppliers;
    -- Profiles
    DROP POLICY IF EXISTS "Public Read" ON public.profiles;
    DROP POLICY IF EXISTS "Public Insert" ON public.profiles;
    DROP POLICY IF EXISTS "Public Update" ON public.profiles;
END
$$;

-- CREATE POLICIES (Allow All Operations for now - Harden these later!)
CREATE POLICY "Public Read" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.sales FOR DELETE USING (true);

CREATE POLICY "Public Read" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.expenses FOR DELETE USING (true);

CREATE POLICY "Public Read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Public Read" ON public.stock FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.stock FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.stock FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.stock FOR DELETE USING (true);

CREATE POLICY "Public Read" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.suppliers FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.suppliers FOR DELETE USING (true);

CREATE POLICY "Public Read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON public.profiles FOR DELETE USING (true);

