ALTER TABLE public.income ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'ele';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'ele';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'ele';