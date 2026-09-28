-- Money is integer pence. Run this in the Supabase SQL editor.

create table if not exists lots (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  quantity integer not null check (quantity >= 0),
  sizes jsonb not null default '[]'::jsonb,
  condition text not null,
  floor_price integer not null check (floor_price >= 0),
  market_price_note text,
  days_unsold integer not null default 0 check (days_unsold >= 0),
  status text not null default 'open' check (status in ('open', 'negotiating', 'sold'))
);

create table if not exists bots (
  id text primary key,
  name text not null,
  role text not null check (role in ('merchant', 'reseller')),
  personality text not null,
  wants text not null,
  max_budget integer check (max_budget is null or max_budget >= 0)
);

create table if not exists negotiations (
  id text primary key,
  lot_id text not null references lots (id),
  round integer not null default 0 check (round >= 0),
  max_rounds integer not null default 3 check (max_rounds > 0),
  status text not null default 'running' check (status in ('running', 'awaiting_approval', 'closed'))
);

create table if not exists offers (
  id text primary key,
  negotiation_id text not null references negotiations (id),
  bot_id text not null references bots (id),
  round integer not null check (round >= 1),
  price integer not null check (price >= 0),
  message text not null default '',
  status text not null check (status in ('valid', 'below_floor', 'over_budget', 'walked_away')),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  negotiation_id text not null references negotiations (id),
  bot_id text not null references bots (id),
  price integer not null check (price >= 0),
  created_at timestamptz not null default now()
);

alter table offers replica identity full;

do $$
begin
  alter publication supabase_realtime add table offers;
exception
  when duplicate_object then null;
end $$;
