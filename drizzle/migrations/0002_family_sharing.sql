-- Famílias: grupos de usuários que compartilham todos os dados financeiros
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Minha família',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.families to authenticated;
grant all on public.families to service_role;

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
grant select, insert, update, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);
grant select, insert, update, delete on public.family_invites to authenticated;
grant all on public.family_invites to service_role;

-- Coluna family_id nas tabelas financeiras
alter table public.income add column family_id uuid references public.families(id);
alter table public.expenses add column family_id uuid references public.families(id);
alter table public.transactions add column family_id uuid references public.families(id);
alter table public.accounts add column family_id uuid references public.families(id);
alter table public.reserves add column family_id uuid references public.families(id);
alter table public.goals add column family_id uuid references public.families(id);

-- Verificação de membresia sem recursão de RLS
create or replace function public.is_family_member(p_family uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = p_family and user_id = p_user)
$$;
grant execute on function public.is_family_member(uuid, uuid) to authenticated;

create or replace function public.shares_family(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members a
    join public.family_members b using (family_id)
    where a.user_id = auth.uid() and b.user_id = p_user)
$$;
grant execute on function public.shares_family(uuid) to authenticated;

-- Backfill: uma família por usuário existente, com todos os seus dados
do $$
declare r record; f uuid;
begin
  for r in select id, name from public.profiles
           union select user_id as id, 'Usuário' as name from public.accounts
  loop
    if not exists (select 1 from public.family_members where user_id = r.id) then
      insert into public.families (name, created_by) values ('Família de ' || coalesce(nullif(trim(r.name), ''), 'Usuário'), r.id) returning id into f;
      insert into public.family_members (family_id, user_id) values (f, r.id);
      update public.income set family_id = f where user_id = r.id and family_id is null;
      update public.expenses set family_id = f where user_id = r.id and family_id is null;
      update public.transactions set family_id = f where user_id = r.id and family_id is null;
      update public.accounts set family_id = f where user_id = r.id and family_id is null;
      update public.reserves set family_id = f where user_id = r.id and family_id is null;
      update public.goals set family_id = f where user_id = r.id and family_id is null;
    end if;
  end loop;
end $$;

-- RLS das novas tabelas
alter table public.families enable row level security;
create policy "members view family" on public.families for select to authenticated using (public.is_family_member(id));
create policy "creator inserts family" on public.families for insert to authenticated with check (created_by = auth.uid());

alter table public.family_members enable row level security;
create policy "members view members" on public.family_members for select to authenticated using (public.is_family_member(family_id));

alter table public.family_invites enable row level security;
create policy "members view invites" on public.family_invites for select to authenticated using (public.is_family_member(family_id));
create policy "members create invites" on public.family_invites for insert to authenticated with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy "members revoke invites" on public.family_invites for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

-- Perfis visíveis entre membros da mesma família
create policy "family members view profiles" on public.profiles for select to authenticated using (public.shares_family(id));

-- Tabelas financeiras passam a ser compartilhadas pela família
drop policy if exists "own income" on public.income;
create policy "family income" on public.income for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "own expenses" on public.expenses;
create policy "family expenses" on public.expenses for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "own transactions" on public.transactions;
create policy "family transactions" on public.transactions for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "own accounts" on public.accounts;
create policy "family accounts" on public.accounts for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "own reserves" on public.reserves;
create policy "family reserves" on public.reserves for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "own goals" on public.goals;
create policy "family goals" on public.goals for all to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

-- Preenche family_id automaticamente em qualquer inserção
create or replace function public.set_entry_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.family_id is null then
    select family_id into new.family_id from public.family_members where user_id = new.user_id limit 1;
  end if;
  if new.family_id is null then raise exception 'Usuário sem família'; end if;
  return new;
end $$;

create trigger set_family before insert on public.income for each row execute function public.set_entry_family();
create trigger set_family before insert on public.expenses for each row execute function public.set_entry_family();
create trigger set_family before insert on public.transactions for each row execute function public.set_entry_family();
create trigger set_family before insert on public.accounts for each row execute function public.set_entry_family();
create trigger set_family before insert on public.reserves for each row execute function public.set_entry_family();
create trigger set_family before insert on public.goals for each row execute function public.set_entry_family();

-- Novo usuário já nasce com família própria
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := new.id;
  f uuid;
  display_name text := coalesce(new.raw_user_meta_data->>'name', 'Usuário');
begin
  insert into public.profiles (id, name) values (uid, display_name);
  insert into public.families (name, created_by) values ('Família de ' || display_name, uid) returning id into f;
  insert into public.family_members (family_id, user_id) values (f, uid);
  insert into public.accounts (user_id, name, type, balance, family_id) values (uid, 'Conta Principal', 'checking', 0, f);
  return new;
end $$;

-- Salvar lançamento passa a gravar a família
create or replace function public.save_financial_entry(p_type text, p_name text, p_amount numeric, p_date date, p_category text, p_label text, p_owner text, p_recurring boolean, p_realized boolean, p_note text default null::text, p_installment_current integer default null::integer, p_installment_total integer default null::integer)
returns uuid language plpgsql set search_path = public as $$
declare uid uuid := auth.uid(); entry_id uuid; signed_amount numeric; f uuid;
begin
  if uid is null then raise exception 'Sem sessão'; end if;
  select family_id into f from public.family_members where user_id = uid limit 1;
  if f is null then raise exception 'Usuário sem família'; end if;
  if p_type not in ('receita','despesa') or p_owner not in ('ele','ela') or p_amount <= 0 or length(trim(p_name)) = 0 or length(p_name) > 200 or length(p_label) > 80 then raise exception 'Lançamento inválido'; end if;
  if p_realized and p_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lançamento futuro não pode ser realizado'; end if;
  if p_type = 'receita' then
    if p_category not in ('salario','plantao','comissao','extra') then raise exception 'Tipo inválido'; end if;
    insert into public.income(user_id,family_id,name,amount,reference_month,kind,category_label,owner,recurring,status,received_at) values(uid,f,trim(p_name),p_amount,p_date,p_category,p_label,p_owner,p_recurring,case when p_realized then 'recebido' else 'previsto' end,case when p_realized then p_date::timestamp at time zone 'America/Sao_Paulo' else null end) returning id into entry_id;
    signed_amount := p_amount;
  else
    if p_category not in ('fixa','variavel','parcelada','extra') then raise exception 'Tipo inválido'; end if;
    insert into public.expenses(user_id,family_id,name,amount,due_date,due_day,category,category_label,owner,status,note,installment_current,installment_total) values(uid,f,trim(p_name),p_amount,p_date,extract(day from p_date),p_category,p_label,p_owner,case when p_realized then 'pago' else 'pendente' end,p_note,p_installment_current,p_installment_total) returning id into entry_id;
    signed_amount := -p_amount;
  end if;
  if p_realized then
    insert into public.transactions(user_id,family_id,kind,description,amount,occurred_at,owner,reference_id) values(uid,f,p_type,trim(p_name),signed_amount,p_date::timestamp at time zone 'America/Sao_Paulo',p_owner,entry_id);
  end if;
  return entry_id;
end $$;

-- Atualizar lançamento permitido a qualquer membro da família
create or replace function public.update_financial_entry(p_id uuid, p_type text, p_name text, p_amount numeric, p_date date, p_category text, p_label text, p_owner text, p_recurring boolean, p_realized boolean, p_note text default null::text, p_installment_current integer default null::integer, p_installment_total integer default null::integer)
returns void language plpgsql set search_path = public as $$
declare uid uuid := auth.uid(); signed_amount numeric; f uuid;
begin
  if uid is null then raise exception 'Sem sessão'; end if;
  if p_type not in ('receita','despesa') or p_owner not in ('ele','ela') or p_amount <= 0 or length(trim(p_name)) = 0 or length(p_name) > 200 or length(p_label) > 80 then raise exception 'Lançamento inválido'; end if;
  if p_realized and p_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lançamento futuro não pode ser realizado'; end if;
  if p_type = 'receita' then
    if p_category not in ('salario','plantao','comissao','extra') then raise exception 'Tipo inválido'; end if;
    update public.income set name=trim(p_name),amount=p_amount,reference_month=p_date,kind=p_category,category_label=p_label,owner=p_owner,recurring=p_recurring,status=case when p_realized then 'recebido' else 'previsto' end,received_at=case when p_realized then p_date::timestamp at time zone 'America/Sao_Paulo' else null end where id=p_id and public.is_family_member(family_id) returning family_id into f;
    signed_amount := p_amount;
  else
    if p_category not in ('fixa','variavel','parcelada','extra') then raise exception 'Tipo inválido'; end if;
    update public.expenses set name=trim(p_name),amount=p_amount,due_date=p_date,due_day=extract(day from p_date),category=p_category,category_label=p_label,owner=p_owner,status=case when p_realized then 'pago' else 'pendente' end,note=p_note,installment_current=p_installment_current,installment_total=p_installment_total where id=p_id and public.is_family_member(family_id) returning family_id into f;
    signed_amount := -p_amount;
  end if;
  if not found then raise exception 'Lançamento não encontrado'; end if;
  delete from public.transactions where reference_id=p_id and public.is_family_member(family_id);
  if p_realized then
    insert into public.transactions(user_id,family_id,kind,description,amount,occurred_at,owner,reference_id) values(uid,f,p_type,trim(p_name),signed_amount,p_date::timestamp at time zone 'America/Sao_Paulo',p_owner,p_id);
  end if;
end $$;

-- Convites
create or replace function public.create_family_invite()
returns text language plpgsql security invoker set search_path = public as $$
declare f uuid; t text;
begin
  select family_id into f from public.family_members where user_id = auth.uid() limit 1;
  if f is null then raise exception 'Você ainda não pertence a uma família'; end if;
  insert into public.family_invites (family_id, created_by) values (f, auth.uid()) returning token into t;
  return t;
end $$;
grant execute on function public.create_family_invite() to authenticated;

create or replace function public.invite_info(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'family', f.name,
    'inviter', p.name,
    'valid', i.revoked_at is null and i.expires_at > now())
  from public.family_invites i
  join public.families f on f.id = i.family_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token
$$;
grant execute on function public.invite_info(text) to anon, authenticated;

create or replace function public.accept_family_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv record; old_f uuid; member_count int;
begin
  if uid is null then raise exception 'Sem sessão'; end if;
  select * into inv from public.family_invites where token = p_token;
  if inv is null or inv.revoked_at is not null or inv.expires_at <= now() then raise exception 'Convite inválido ou expirado'; end if;
  if exists (select 1 from public.family_members where family_id = inv.family_id and user_id = uid) then return inv.family_id; end if;
  select m.family_id into old_f from public.family_members m where m.user_id = uid limit 1;
  if old_f is not null then
    select count(*) into member_count from public.family_members where family_id = old_f;
    if member_count > 1 then raise exception 'Você já pertence a outra família'; end if;
    update public.income set family_id = inv.family_id where user_id = uid;
    update public.expenses set family_id = inv.family_id where user_id = uid;
    update public.transactions set family_id = inv.family_id where user_id = uid;
    update public.accounts set family_id = inv.family_id where user_id = uid;
    update public.reserves set family_id = inv.family_id where user_id = uid;
    update public.goals set family_id = inv.family_id where user_id = uid;
    delete from public.family_members where family_id = old_f and user_id = uid;
    delete from public.families where id = old_f;
  end if;
  insert into public.family_members (family_id, user_id) values (inv.family_id, uid);
  return inv.family_id;
end $$;
grant execute on function public.accept_family_invite(text) to authenticated;

-- Visão geral da família para a tela de perfil
create or replace function public.family_overview()
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'family', (select json_build_object('id', f.id, 'name', f.name)
               from public.families f join public.family_members m on m.family_id = f.id
               where m.user_id = auth.uid() limit 1),
    'members', coalesce((select json_agg(json_build_object('user_id', p.id, 'name', p.name, 'joined_at', m.joined_at) order by m.joined_at)
               from public.family_members m join public.profiles p on p.id = m.user_id), '[]'::json),
    'invites', coalesce((select json_agg(json_build_object('token', i.token, 'expires_at', i.expires_at) order by i.created_at desc)
               from public.family_invites i where i.revoked_at is null and i.expires_at > now()), '[]'::json))
$$;
grant execute on function public.family_overview() to authenticated;