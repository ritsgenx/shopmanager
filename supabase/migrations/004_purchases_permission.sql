-- Add UNIQUE constraint on user_id so upsert onConflict works correctly
ALTER TABLE public.employee_permissions
  DROP CONSTRAINT IF EXISTS employee_permissions_user_id_key;
ALTER TABLE public.employee_permissions
  ADD CONSTRAINT employee_permissions_user_id_key UNIQUE (user_id);

-- Add per-employee toggle to control access to the Purchases module
ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS can_access_purchases BOOLEAN NOT NULL DEFAULT false;
