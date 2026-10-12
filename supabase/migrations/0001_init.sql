-- Tables ---------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  monthly_limit int not null default 3,
  period_start timestamptz not null default now(),
  stripe_customer_id text unique
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_text text not null,
  output_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index reports_user_created_idx on public.reports (user_id, created_at desc);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  kind text not null check (kind in ('reserve', 'commit', 'refund', 'grant')),
  amount int not null,
  created_at timestamptz not null default now(),
  unique (report_id, kind)
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at);

create table public.stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- RLS: users read their own rows; nobody writes directly -----------------
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.stripe_events enable row level security;

create policy "own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "own reports" on public.reports for select using (auth.uid() = user_id);
create policy "own ledger" on public.credit_ledger for select using (auth.uid() = user_id);

-- New user -> Free profile ----------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers ----------------------------------------------------------------
-- Free plans roll forward one month at a time; Pro periods come from Stripe.
create function public._roll_period(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set period_start = period_start + interval '1 month'
                        * floor(extract(epoch from (now() - period_start)) / extract(epoch from interval '1 month'))
   where user_id = p_user
     and plan = 'free'
     and period_start + interval '1 month' <= now();
end $$;

-- Used = reserves in the current period whose report was not refunded.
create function public._used(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.credit_ledger r
    join public.profiles p on p.user_id = r.user_id
   where r.user_id = p_user
     and r.kind = 'reserve'
     and r.created_at >= p.period_start
     and not exists (
       select 1 from public.credit_ledger f
        where f.report_id = r.report_id and f.kind = 'refund'
     );
$$;

-- Ledger functions -------------------------------------------------------
create function public.start_report(p_user uuid, p_input text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
  v_id uuid;
begin
  perform 1 from public.profiles where user_id = p_user for update;
  if not found then
    raise exception 'no_profile';
  end if;

  perform public._roll_period(p_user);
  select monthly_limit into v_limit from public.profiles where user_id = p_user;

  if public._used(p_user) >= v_limit then
    raise exception 'insufficient_credits';
  end if;

  insert into public.reports (user_id, input_text) values (p_user, p_input)
    returning id into v_id;
  insert into public.credit_ledger (user_id, report_id, kind, amount)
    values (p_user, v_id, 'reserve', -1);
  return v_id;
end $$;

create function public.finish_report(p_report uuid, p_output jsonb, p_attempts int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  update public.reports
     set status = 'ready', output_json = p_output, attempts = p_attempts, finished_at = now()
   where id = p_report and status = 'pending'
   returning user_id into v_user;
  if v_user is null then
    return false;
  end if;
  insert into public.credit_ledger (user_id, report_id, kind, amount)
    values (v_user, p_report, 'commit', 0)
    on conflict (report_id, kind) do nothing;
  return true;
end $$;

create function public.fail_report(p_report uuid, p_attempts int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  update public.reports
     set status = 'failed', attempts = p_attempts, finished_at = now()
   where id = p_report and status = 'pending'
   returning user_id into v_user;
  if v_user is null then
    return false;
  end if;
  insert into public.credit_ledger (user_id, report_id, kind, amount)
    values (v_user, p_report, 'refund', 1)
    on conflict (report_id, kind) do nothing;
  return true;
end $$;

create function public.refund_stale_reports(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.reports
     where user_id = p_user and status = 'pending' and created_at < now() - interval '10 minutes'
  loop
    if public.fail_report(v_id, 0) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create function public.recent_report_stats(p_user uuid)
returns table (recent_count int, oldest_at timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*)::int, min(created_at)
    from public.reports
   where user_id = p_user and created_at > now() - interval '60 seconds';
$$;

create function public.usage_for(p_user uuid)
returns table (plan text, monthly_limit int, used int, remaining int, period_start timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_used int;
begin
  perform public._roll_period(p_user);
  v_used := public._used(p_user);
  return query
    select p.plan, p.monthly_limit, v_used, greatest(p.monthly_limit - v_used, 0), p.period_start
      from public.profiles p where p.user_id = p_user;
end $$;

create function public.get_my_usage()
returns table (plan text, monthly_limit int, used int, remaining int, period_start timestamptz)
language sql security definer set search_path = public as $$
  select * from public.usage_for(auth.uid());
$$;

-- Stripe -------------------------------------------------------------------
create function public.apply_subscription(p_customer text, p_plan text, p_period_start timestamptz)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = p_plan,
         monthly_limit = case p_plan when 'pro' then 30 else 3 end,
         period_start = coalesce(p_period_start, period_start)
   where stripe_customer_id = p_customer;
  return found;
end $$;

create function public.record_stripe_event(p_event_id text, p_type text) returns void
language sql security definer set search_path = public as $$
  insert into public.stripe_events (event_id, type) values (p_event_id, p_type)
  on conflict (event_id) do nothing;
$$;

create function public.stripe_event_seen(p_event_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stripe_events where event_id = p_event_id);
$$;

-- Grants -------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.get_my_usage() to authenticated;
