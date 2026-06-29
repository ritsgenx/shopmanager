-- ============================================================
-- Inventory Approval Workflow
-- Every inventory item added by an employee requires owner approval.
-- Owner-added items are auto-approved. Edits by employees reset
-- an approved item back to pending.
-- ============================================================

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);

-- Fast lookup for the pending-approvals dashboard widget and navbar badge
CREATE INDEX IF NOT EXISTS idx_inventory_pending
  ON public.inventory(tenant_id, approval_status)
  WHERE approval_status = 'pending';
