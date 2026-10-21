ALTER TABLE public.income ADD COLUMN IF NOT EXISTS category_label text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category_label text;
CREATE TABLE public.ai_access_state (id text PRIMARY KEY, status integer NOT NULL, message text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_access_state TO service_role;
ALTER TABLE public.ai_access_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.save_financial_entry(p_type text, p_name text, p_amount numeric, p_date date, p_category text, p_label text, p_owner text, p_recurring boolean, p_realized boolean, p_note text DEFAULT NULL, p_installment_current integer DEFAULT NULL, p_installment_total integer DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); entry_id uuid; signed_amount numeric;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
IF p_type NOT IN ('receita','despesa') OR p_owner NOT IN ('ele','ela') OR p_amount <= 0 OR length(trim(p_name)) = 0 OR length(p_name) > 200 OR length(p_label) > 80 THEN RAISE EXCEPTION 'Lançamento inválido'; END IF;
IF p_realized AND p_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Lançamento futuro não pode ser realizado'; END IF;
IF p_type = 'receita' THEN
IF p_category NOT IN ('salario','plantao','comissao','extra') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
INSERT INTO public.income(user_id,name,amount,reference_month,kind,category_label,owner,recurring,status,received_at) VALUES(uid,trim(p_name),p_amount,p_date,p_category,p_label,p_owner,p_recurring,CASE WHEN p_realized THEN 'recebido' ELSE 'previsto' END,CASE WHEN p_realized THEN p_date::timestamp AT TIME ZONE 'America/Sao_Paulo' ELSE NULL END) RETURNING id INTO entry_id;
signed_amount := p_amount;
ELSE
IF p_category NOT IN ('fixa','variavel','parcelada','extra') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
INSERT INTO public.expenses(user_id,name,amount,due_date,due_day,category,category_label,owner,status,note,installment_current,installment_total) VALUES(uid,trim(p_name),p_amount,p_date,extract(day FROM p_date),p_category,p_label,p_owner,CASE WHEN p_realized THEN 'pago' ELSE 'pendente' END,p_note,p_installment_current,p_installment_total) RETURNING id INTO entry_id;
signed_amount := -p_amount;
END IF;
IF p_realized THEN
INSERT INTO public.transactions(user_id,kind,description,amount,occurred_at,owner,reference_id) VALUES(uid,p_type,trim(p_name),signed_amount,p_date::timestamp AT TIME ZONE 'America/Sao_Paulo',p_owner,entry_id);
END IF;
RETURN entry_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_financial_entry(text,text,numeric,date,text,text,text,boolean,boolean,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_financial_entry(text,text,numeric,date,text,text,text,boolean,boolean,text,integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.remove_entry_movements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN DELETE FROM public.transactions WHERE user_id=OLD.user_id AND reference_id=OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER remove_income_movements AFTER DELETE ON public.income FOR EACH ROW EXECUTE FUNCTION public.remove_entry_movements();
CREATE TRIGGER remove_expense_movements AFTER DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.remove_entry_movements();