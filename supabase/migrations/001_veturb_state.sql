-- Base inicial da persistência de cada conta autenticada.
-- Execute no SQL Editor do seu projeto Supabase.
create table if not exists public.veturb_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.veturb_state enable row level security;

-- Cada conta só pode ler/gravar o próprio estado.
drop policy if exists "Conta lê seu estado" on public.veturb_state;
create policy "Conta lê seu estado"
  on public.veturb_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Conta cria seu estado" on public.veturb_state;
create policy "Conta cria seu estado"
  on public.veturb_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Conta atualiza seu estado" on public.veturb_state;
create policy "Conta atualiza seu estado"
  on public.veturb_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
