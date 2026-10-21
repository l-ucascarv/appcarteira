CREATE OR REPLACE FUNCTION public.update_financial_entry(p_id uuid, p_type text, p_name text, p_amount numeric, p_date date, p_category text, p_label text, p_owner text, p_recurring boolean, p_realized boolean, p_note text DEFAULT NULL, p_installment_current integer DEFAULT NULL, p_installment_total integer DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); signed_amount numeric;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
IF p_type NOT IN ('receita','despesa') OR p_owner NOT IN ('ele','ela') OR p_amount <= 0 OR length(trim(p_name)) = 0 OR length(p_name) > 200 OR length(p_label) > 80 THEN RAISE EXCEPTION 'Lançamento inválido'; END IF;
IF p_realized AND p_date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Lançamento futuro não pode ser realizado'; END IF;
IF p_type = 'receita' THEN
IF p_category NOT IN ('salario','plantao','comissao','extra') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
UPDATE public.income SET name=trim(p_name),amount=p_amount,reference_month=p_date,kind=p_category,category_label=p_label,owner=p_owner,recurring=p_recurring,status=CASE WHEN p_realized THEN 'recebido' ELSE 'previsto' END,received_at=CASE WHEN p_realized THEN p_date::timestamp AT TIME ZONE 'America/Sao_Paulo' ELSE NULL END WHERE id=p_id AND user_id=uid;
signed_amount := p_amount;
ELSE
IF p_category NOT IN ('fixa','variavel','parcelada','extra') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
UPDATE public.expenses SET name=trim(p_name),amount=p_amount,due_date=p_date,due_day=extract(day FROM p_date),category=p_category,category_label=p_label,owner=p_owner,status=CASE WHEN p_realized THEN 'pago' ELSE 'pendente' END,note=p_note,installment_current=p_installment_current,installment_total=p_installment_total WHERE id=p_id AND user_id=uid;
signed_amount := -p_amount;
END IF;
IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;
DELETE FROM public.transactions WHERE user_id=uid AND reference_id=p_id;
IF p_realized THEN
INSERT INTO public.transactions(user_id,kind,description,amount,occurred_at,owner,reference_id) VALUES(uid,p_type,trim(p_name),signed_amount,p_date::timestamp AT TIME ZONE 'America/Sao_Paulo',p_owner,p_id);
END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_financial_entry(uuid,text,text,numeric,date,text,text,text,boolean,boolean,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_financial_entry(uuid,text,text,numeric,date,text,text,text,boolean,boolean,text,integer,integer) TO authenticated;