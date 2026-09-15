ALTER TABLE public.expenses
ADD COLUMN due_date date NOT NULL DEFAULT CURRENT_DATE;

UPDATE public.expenses
SET due_date = make_date(
  EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  EXTRACT(MONTH FROM CURRENT_DATE)::integer,
  LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day'))::integer)
);