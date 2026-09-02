CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := NEW.id;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (uid, COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'));

  INSERT INTO public.accounts (user_id, name, type, balance)
  VALUES (uid, 'Conta Principal', 'checking', 0);

  RETURN NEW;
END;
$function$;