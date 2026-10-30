create table if not exists public.opportunities (
 id text primary key,
 institution text not null,
 source_code text not null,
 title text not null,
 url text not null,
 uf text,
 category text not null default 'Edital',
 level text,
 published_at date,
 deadline date,
 amount_brl numeric(16,2),
 award_count integer,
 status text not null default 'nao_verificado',
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint positive_awards check (award_count is null or award_count >= 0),
 constraint positive_amount check (amount_brl is null or amount_brl >= 0)
);
create index if not exists opportunities_institution_idx on public.opportunities(institution);
create index if not exists opportunities_deadline_idx on public.opportunities(deadline);
create index if not exists opportunities_first_seen_idx on public.opportunities(first_seen);
create table if not exists public.opportunity_changes (
 id bigint generated always as identity primary key,
 opportunity_id text not null references public.opportunities(id),
 recorded_at timestamptz not null default now(),
 before jsonb,
 after jsonb not null
);
create table if not exists public.collection_runs (
 id bigint generated always as identity primary key,
 collected_at timestamptz not null default now(),
 source_code text not null,
 success boolean not null,
 discovered integer not null default 0,
 error text
);
alter table public.opportunities enable row level security;
alter table public.opportunity_changes enable row level security;
alter table public.collection_runs enable row level security;
-- Não criar policies públicas: backend escreve usando secret exclusivamente no Actions.
revoke all on public.opportunities, public.opportunity_changes, public.collection_runs from anon, authenticated;
