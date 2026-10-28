-- Dados públicos do player ficam separados do estado privado da conta.
create table if not exists public.veturb_public_players (
  player_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.veturb_public_players enable row level security;
grant select on public.veturb_public_players to anon, authenticated;
grant insert, update, delete on public.veturb_public_players to authenticated;
grant select, insert, update, delete on public.veturb_public_players to service_role;
drop policy if exists "Player publicado ou do próprio dono pode ser lido" on public.veturb_public_players;
create policy "Player publicado ou do próprio dono pode ser lido" on public.veturb_public_players
  for select to anon, authenticated using (published = true or owner_id = auth.uid());
drop policy if exists "Dono cria seus players públicos" on public.veturb_public_players;
create policy "Dono cria seus players públicos" on public.veturb_public_players
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Dono atualiza seus players públicos" on public.veturb_public_players;
create policy "Dono atualiza seus players públicos" on public.veturb_public_players
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Dono exclui seus players públicos" on public.veturb_public_players;
create policy "Dono exclui seus players públicos" on public.veturb_public_players
  for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.veturb_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null references public.veturb_public_players(player_id) on delete cascade,
  event_type text not null check (event_type in ('view','play','progress','cta','conversion')),
  pct smallint check (pct is null or pct between 0 and 100),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists veturb_events_owner_created_idx on public.veturb_events(owner_id, created_at desc);
create index if not exists veturb_events_player_type_idx on public.veturb_events(player_id, event_type, created_at desc);
alter table public.veturb_events enable row level security;
grant select, delete on public.veturb_events to authenticated;
grant select, insert on public.veturb_events to service_role;
drop policy if exists "Dono lê eventos dos seus players" on public.veturb_events;
create policy "Dono lê eventos dos seus players" on public.veturb_events
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Dono exclui eventos dos seus players" on public.veturb_events;
create policy "Dono exclui eventos dos seus players" on public.veturb_events
  for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.veturb_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null references public.veturb_public_players(player_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  whatsapp text not null default '' check (char_length(whatsapp) <= 32),
  consent boolean not null default false check (consent = true),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists veturb_leads_owner_created_idx on public.veturb_leads(owner_id, created_at desc);
create index if not exists veturb_leads_player_created_idx on public.veturb_leads(player_id, created_at desc);
alter table public.veturb_leads enable row level security;
grant select, delete on public.veturb_leads to authenticated;
grant select, insert on public.veturb_leads to service_role;
drop policy if exists "Dono lê leads dos seus players" on public.veturb_leads;
create policy "Dono lê leads dos seus players" on public.veturb_leads
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Dono exclui leads dos seus players" on public.veturb_leads;
create policy "Dono exclui leads dos seus players" on public.veturb_leads
  for delete to authenticated using (owner_id = auth.uid());

-- Limitador simples por janela para Edge Functions públicas; chave é hash, não IP em texto.
create table if not exists public.veturb_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null,
  hit_count integer not null default 1
);
alter table public.veturb_rate_limits enable row level security;
revoke all on public.veturb_rate_limits from anon, authenticated;

create or replace function public.consume_veturb_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_window_seconds < 1 or p_max < 1 then return false; end if;
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.veturb_rate_limits(rate_key, window_start, hit_count)
  values (p_key, v_window, 1)
  on conflict (rate_key) do update
    set window_start = case when public.veturb_rate_limits.window_start < excluded.window_start then excluded.window_start else public.veturb_rate_limits.window_start end,
        hit_count = case when public.veturb_rate_limits.window_start < excluded.window_start then 1 else public.veturb_rate_limits.hit_count + 1 end
  returning hit_count into v_hits;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.consume_veturb_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_veturb_rate_limit(text, integer, integer) to service_role;
