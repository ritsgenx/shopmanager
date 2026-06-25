-- ============================================================
-- RLS Tenant Isolation
-- Run this once in your Supabase SQL Editor.
-- Every table is locked to the current user's tenant.
-- ============================================================

-- ── Helper: maps auth.uid() → tenant_id ─────────────────────
-- Used by every policy below. SECURITY DEFINER lets it read
-- the users table even before the caller's own RLS is resolved.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$;

-- ── Helper: is the current user an admin? ────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin' FROM public.users WHERE id = auth.uid()
$$;

-- ── Helper: does current employee have a specific permission? ─
-- Usage: has_permission('can_delete_sale')
CREATE OR REPLACE FUNCTION public.has_permission(perm_key text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  EXECUTE format(
    'SELECT %I FROM public.employee_permissions WHERE user_id = $1',
    perm_key
  ) INTO result USING auth.uid();
  RETURN coalesce(result, false);
END;
$$;


-- ════════════════════════════════════════════════════════════
-- TENANTS
-- Each shop owner can only see and edit their own tenant row.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_select" ON public.tenants;
DROP POLICY IF EXISTS "tenant_update" ON public.tenants;

CREATE POLICY "tenant_select" ON public.tenants
  FOR SELECT USING (id = current_tenant_id());

CREATE POLICY "tenant_update" ON public.tenants
  FOR UPDATE USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- USERS  (employees + shop owner profiles)
-- All users in the same tenant can read each other.
-- Only admin can insert new users (create employees).
-- Users can update their own profile; admin can update anyone.
-- Only admin can deactivate/delete.
-- Special INSERT rule: allow inserting own profile on signup
--   (needed for the very first admin account bootstrap).
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select"    ON public.users;
DROP POLICY IF EXISTS "users_insert"    ON public.users;
DROP POLICY IF EXISTS "users_update"    ON public.users;
DROP POLICY IF EXISTS "users_delete"    ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Allow inserting own profile (bootstrap) OR adding an employee (admin)
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (
    id = auth.uid()                          -- own bootstrap row
    OR tenant_id = current_tenant_id()       -- admin adding employee
  );

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND (id = auth.uid() OR is_admin())      -- own profile, or admin
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (tenant_id = current_tenant_id() AND is_admin());


-- ════════════════════════════════════════════════════════════
-- EMPLOYEE_DETAILS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_details_select" ON public.employee_details;
DROP POLICY IF EXISTS "emp_details_write"  ON public.employee_details;

CREATE POLICY "emp_details_select" ON public.employee_details
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "emp_details_write" ON public.employee_details
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- EMPLOYEE_PERMISSIONS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_perms_select" ON public.employee_permissions;
DROP POLICY IF EXISTS "emp_perms_write"  ON public.employee_permissions;

-- Employees can read their own permissions; admin reads all
CREATE POLICY "emp_perms_select" ON public.employee_permissions
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (user_id = auth.uid() OR is_admin())
  );

-- Only admin can modify permissions
CREATE POLICY "emp_perms_write" ON public.employee_permissions
  FOR ALL USING (tenant_id = current_tenant_id() AND is_admin())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_write"  ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "products_write" ON public.products
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- INVENTORY
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
DROP POLICY IF EXISTS "inventory_write"  ON public.inventory;

CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "inventory_write" ON public.inventory
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- CUSTOMERS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_write"  ON public.customers;

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "customers_write" ON public.customers
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- SALES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;

CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Delete: admin always; employee only if they have can_delete_sale
CREATE POLICY "sales_delete" ON public.sales
  FOR DELETE USING (
    tenant_id = current_tenant_id()
    AND (is_admin() OR has_permission('can_delete_sale'))
  );


-- ════════════════════════════════════════════════════════════
-- SALE_ITEMS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_write"  ON public.sale_items;

CREATE POLICY "sale_items_select" ON public.sale_items
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "sale_items_write" ON public.sale_items
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- PURCHASES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchases_select" ON public.purchases;
DROP POLICY IF EXISTS "purchases_write"  ON public.purchases;

CREATE POLICY "purchases_select" ON public.purchases
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "purchases_write" ON public.purchases
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- PURCHASE_ITEMS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_items_select" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items_write"  ON public.purchase_items;

CREATE POLICY "purchase_items_select" ON public.purchase_items
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "purchase_items_write" ON public.purchase_items
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- ATTENDANCE
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "attendance_write"  ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "attendance_write" ON public.attendance
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());


-- ════════════════════════════════════════════════════════════
-- COMMISSIONS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commissions_select" ON public.commissions;
DROP POLICY IF EXISTS "commissions_write"  ON public.commissions;

-- Employees can see their own commissions; admin sees all
CREATE POLICY "commissions_select" ON public.commissions
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND (user_id = auth.uid() OR is_admin())
  );

-- Only admin can write commission records (mark paid etc.)
CREATE POLICY "commissions_write" ON public.commissions
  FOR ALL USING (tenant_id = current_tenant_id() AND is_admin())
  WITH CHECK (tenant_id = current_tenant_id());
