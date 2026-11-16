-- Execute no SQL Editor de um projeto Supabase NOVO.
create table public.groups(id text primary key,name text not null,win_points numeric not null,goal_points numeric not null,assist_points numeric not null);
insert into public.groups values ('goleiros','Goleiros',3,1,0.5),('linha','Jogadores de linha',3,1,0.5);
-- Os pesos dos jogadores de linha são provisórios e devem ser confirmados antes do uso.
create table public.players(id uuid primary key default gen_random_uuid(),group_id text not null references public.groups(id),name text not null,active boolean not null default true,created_at timestamptz not null default now(),unique(group_id,name));
create table public.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.entries(id uuid primary key default gen_random_uuid(),player_id uuid not null references public.players(id),wins integer not null default 0,goals integer not null default 0,assists integer not null default 0,note text,created_by uuid references auth.users(id),created_at timestamptz not null default now(),reverses_entry uuid unique references public.entries(id),constraint integer_bounds check (abs(wins)<=100000 and abs(goals)<=100000 and abs(assists)<=100000));
create index entries_player_idx on public.entries(player_id);
create index entries_date_idx on public.entries(created_at desc);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admins where user_id=(select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated,anon;
alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.admins enable row level security;
alter table public.entries enable row level security;
create policy groups_public_read on public.groups for select to anon,authenticated using(true);
create policy players_public_read on public.players for select to anon,authenticated using(true);
create policy entries_public_read on public.entries for select to anon,authenticated using(true);
create policy admins_self_read on public.admins for select to authenticated using(user_id=(select auth.uid()));
create policy players_admin_insert on public.players for insert to authenticated with check(public.is_admin());
create policy players_admin_update on public.players for update to authenticated using(public.is_admin()) with check(public.is_admin());
-- Lançamentos são imutáveis; somente RPCs controladas podem inserir.
create or replace function public.add_result(p_player_id uuid,p_wins integer,p_goals integer,p_assists integer,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.is_admin() then raise exception 'Sem permissão'; end if;
 if p_wins is null or p_goals is null or p_assists is null or p_wins<0 or p_goals<0 or p_assists<0 or p_wins>100000 or p_goals>100000 or p_assists>100000 or (p_wins+p_goals+p_assists)=0 then raise exception 'Valores inválidos'; end if;
 if not exists(select 1 from public.players where id=p_player_id and active) then raise exception 'Jogador não encontrado'; end if;
 insert into public.entries(player_id,wins,goals,assists,note,created_by) values(p_player_id,p_wins,p_goals,p_assists,left(p_note,250),(select auth.uid())) returning id into v_id;
 return v_id;
end $$;
create or replace function public.reverse_result(p_entry_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.entries%rowtype;v_id uuid;
begin
 if not public.is_admin() then raise exception 'Sem permissão'; end if;
 select * into v_entry from public.entries where id=p_entry_id for update;
 if not found or v_entry.reverses_entry is not null then raise exception 'Lançamento inválido'; end if;
 if exists(select 1 from public.entries where reverses_entry=p_entry_id) then raise exception 'Já estornado'; end if;
 insert into public.entries(player_id,wins,goals,assists,note,created_by,reverses_entry) values(v_entry.player_id,-v_entry.wins,-v_entry.goals,-v_entry.assists,'ESTORNO '||p_entry_id::text,(select auth.uid()),p_entry_id) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.add_result(uuid,integer,integer,integer,text) from public;
revoke all on function public.reverse_result(uuid) from public;
grant execute on function public.add_result(uuid,integer,integer,integer,text) to authenticated;
grant execute on function public.reverse_result(uuid) to authenticated;
-- Base histórica: usar somente depois de confirmar a hipótese de assistências.
-- Arthur: 24 V, 3 G, 1 A; Décio: 32 V, 3 G, 1 A; Isaac: 3 V, 0 G, 0 A.
-- Os novos resultados (Arthur +11 V +2 G; Isaac +3 V) ainda NÃO estão importados.
insert into public.players(group_id,name) values ('goleiros','Arthur'),('goleiros','Décio'),('goleiros','Isaac');
insert into public.entries(player_id,wins,goals,assists,note) select id,case name when 'Arthur' then 24 when 'Décio' then 32 else 3 end,case name when 'Isaac' then 0 else 3 end,case name when 'Isaac' then 0 else 1 end,'BASE HISTÓRICA — conferir assistências' from public.players where group_id='goleiros';
-- Habilite Realtime para public.entries e public.players no painel Supabase.
