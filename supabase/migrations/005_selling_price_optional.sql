-- Selling price is decided at sale time; inventory only carries an optional
-- "asking price". Allow NULL so stock can be added without one.
ALTER TABLE public.inventory
  ALTER COLUMN selling_price DROP NOT NULL;
