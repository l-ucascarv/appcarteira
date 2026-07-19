
-- ============ TABLES ============

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Usuário',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checking',
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,               -- salario | plantao | comissao | extra
  amount NUMERIC(14,2) NOT NULL,
  reference_month DATE,             -- primeiro dia do mês de referência (para comissões)
  recurring BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'previsto', -- previsto | recebido
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  due_day INT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fixa',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago | atrasado
  installment_current INT,
  installment_total INT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- receita | despesa | reserva
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  balance_after NUMERIC(14,2),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 3,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reserves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.profiles, public.accounts, public.income, public.expenses,
             public.transactions, public.reserves, public.goals, public.insights,
             public.notifications TO service_role;

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"      ON public.profiles      FOR ALL USING (auth.uid() = id)      WITH CHECK (auth.uid() = id);
CREATE POLICY "own accounts"     ON public.accounts      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own income"       ON public.income        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own expenses"     ON public.expenses      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions" ON public.transactions  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reserves"     ON public.reserves      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals"        ON public.goals         FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own insights"     ON public.insights      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications"ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SEED FUNCTION + TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := NEW.id;
  yr  INT  := EXTRACT(YEAR FROM now())::INT;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (uid, COALESCE(NEW.raw_user_meta_data->>'name', 'Lucas'));

  INSERT INTO public.accounts (user_id, name, type, balance)
  VALUES (uid, 'Conta Principal', 'checking', 1250.00);

  -- Receitas fixas
  INSERT INTO public.income (user_id, name, kind, amount, recurring, status) VALUES
    (uid, 'Salário CLT (líquido)', 'salario', 2825.00, true, 'previsto'),
    (uid, 'Plantão mensal',        'plantao', 75.00,   true, 'previsto');

  -- Comissões previstas (ano corrente)
  INSERT INTO public.income (user_id, name, kind, amount, reference_month, status) VALUES
    (uid, 'Comissão Agosto',   'comissao', 4150.00,  make_date(yr,  8, 1), 'previsto'),
    (uid, 'Comissão Setembro', 'comissao', 11500.00, make_date(yr,  9, 1), 'previsto'),
    (uid, 'Comissão Outubro',  'comissao', 2500.00,  make_date(yr, 10, 1), 'previsto'),
    (uid, 'Comissão Novembro', 'comissao', 2500.00,  make_date(yr, 11, 1), 'previsto'),
    (uid, 'Comissão Dezembro', 'comissao', 2000.00,  make_date(yr, 12, 1), 'previsto');

  -- Receita extraordinária
  INSERT INTO public.income (user_id, name, kind, amount, status)
  VALUES (uid, 'Venda de sistema', 'extra', 1500.00, 'previsto');

  -- Despesas fixas
  INSERT INTO public.expenses (user_id, name, amount, due_day, category, status, installment_current, installment_total, note) VALUES
    (uid, 'Condomínio',      350.00,  10, 'fixa', 'pendente', NULL, NULL, NULL),
    (uid, 'Parcela do carro',1777.00, 12, 'fixa', 'atrasado', NULL, NULL, 'Paga normalmente dia 30 devido ao fluxo de caixa. Reservar assim que entrar comissão.'),
    (uid, 'Financiamento',   1100.00, 20, 'fixa', 'pendente', NULL, NULL, NULL),
    (uid, 'Energia',         100.00,  30, 'fixa', 'pendente', NULL, NULL, NULL),
    (uid, 'Empréstimo',      1400.00, 30, 'fixa', 'pendente', 3, 6, NULL);

  -- Reservas
  INSERT INTO public.reserves (user_id, name, goal_amount, current_amount, priority, color) VALUES
    (uid, 'Reserva Carro',         1777.00,  0,       1, '#3b82f6'),
    (uid, 'Reserva Emergência',    60000.00, 1200.00, 2, '#10b981'),
    (uid, 'Reserva Investimentos', 20000.00, 0,       3, '#8b5cf6'),
    (uid, 'Reserva Estabilidade',  10000.00, 0,       4, '#f59e0b');

  -- Meta principal
  INSERT INTO public.goals (user_id, name, target_amount, current_amount)
  VALUES (uid, 'Reserva de Emergência', 60000.00, 1200.00);

  -- Insights iniciais
  INSERT INTO public.insights (user_id, kind, title, message, severity) VALUES
    (uid, 'alerta',      'Parcela do carro em atraso recorrente', 'Reserve R$ 1.777 assim que a próxima comissão entrar para eliminar os juros.', 'warning'),
    (uid, 'oportunidade','Comissão de setembro',                   'Sua comissão prevista de R$ 11.500 em setembro pode zerar a reserva do carro e acelerar a Reserva de Emergência.', 'success'),
    (uid, 'projecao',    'Fluxo de caixa',                         'Mantendo o ritmo atual, sua Reserva de Emergência atinge R$ 60 mil em aproximadamente 24 meses.', 'info');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
