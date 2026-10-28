-- E-mail exibido pelo proprietário na captura; só passa a ter acesso após criar e confirmar a conta Supabase.
create table if not exists public.veturb_platform_admin_allowlist (
  email text primary key check (email = lower(trim(email)))
);
alter table public.veturb_platform_admin_allowlist enable row level security;
revoke all on public.veturb_platform_admin_allowlist from public, anon, authenticated, service_role;
insert into public.veturb_platform_admin_allowlist(email)
values ('amigosdasaude.nt@gmail.com')
on conflict (email) do nothing;

create or replace function public.veturb_is_platform_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    join public.veturb_platform_admin_allowlist a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.veturb_is_platform_admin() from public, anon;
grant execute on function public.veturb_is_platform_admin() to authenticated;

create or replace function public.veturb_mp_credentials_status()
returns table(public_key text, token_configured boolean)
language plpgsql stable security definer set search_path = public, vault as $$
begin
  if auth.uid() is null or not public.veturb_is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  return query select s.public_key, (s.access_secret_id is not null)
    from public.veturb_mp_platform_settings s where s.singleton = true;
end;
$$;
revoke all on function public.veturb_mp_credentials_status() from public, anon;
grant execute on function public.veturb_mp_credentials_status() to authenticated;

create or replace function public.veturb_store_mp_credentials(p_public_key text, p_access_token text)
returns boolean language plpgsql security definer set search_path = public, vault as $$
declare v_secret_id uuid;
begin
  if auth.uid() is null or not public.veturb_is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_public_key, ''))) < 10 or length(p_public_key) > 255 then
    raise exception 'Public Key inválida' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_access_token, ''))) < 20 or length(p_access_token) > 500 then
    raise exception 'Access Token inválido' using errcode = '22023';
  end if;
  select access_secret_id into v_secret_id from public.veturb_mp_platform_settings where singleton = true for update;
  if v_secret_id is null then
    v_secret_id := vault.create_secret(trim(p_access_token), 'veturb_mercadopago_platform_access_token', 'Token de produção da conta Mercado Pago vêTurb');
  else
    perform vault.update_secret(v_secret_id, trim(p_access_token), 'veturb_mercadopago_platform_access_token', 'Token de produção da conta Mercado Pago vêTurb');
  end if;
  insert into public.veturb_mp_platform_settings(singleton, public_key, access_secret_id, updated_at)
    values (true, trim(p_public_key), v_secret_id, now())
    on conflict (singleton) do update set public_key = excluded.public_key, access_secret_id = excluded.access_secret_id, updated_at = now();
  return true;
end;
$$;
revoke all on function public.veturb_store_mp_credentials(text, text) from public, anon;
grant execute on function public.veturb_store_mp_credentials(text, text) to authenticated;
