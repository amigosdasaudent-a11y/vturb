-- As Edge Functions usam service_role somente no servidor.
grant select, insert, update, delete on public.veturb_public_players to service_role;
grant select, insert on public.veturb_events to service_role;
grant select, insert on public.veturb_leads to service_role;
