-- Roll the Free period forward by whole calendar months. The first version counted
-- 30-day blocks and added calendar months, which could move period_start into the future.
create or replace function public._roll_period(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set period_start = period_start + make_interval(months =>
           (extract(year from age(now(), period_start)) * 12
            + extract(month from age(now(), period_start)))::int)
   where user_id = p_user
     and plan = 'free'
     and period_start + interval '1 month' <= now();
end $$;

-- Stripe does not guarantee event order: remember the newest applied event per profile
-- and ignore older ones, so a late "paid" event cannot undo a cancellation.
alter table public.profiles add column stripe_event_at timestamptz;

drop function public.apply_subscription(text, text, timestamptz);

create function public.apply_subscription(
  p_customer text, p_plan text, p_period_start timestamptz, p_event_at timestamptz
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
begin
  select stripe_event_at into v_last
    from public.profiles where stripe_customer_id = p_customer
    for update;
  if not found then
    return 'unknown';
  end if;
  if v_last is not null and p_event_at < v_last then
    return 'stale';
  end if;

  update public.profiles
     set plan = p_plan,
         monthly_limit = case p_plan when 'pro' then 30 else 3 end,
         period_start = coalesce(p_period_start, period_start),
         stripe_event_at = p_event_at
   where stripe_customer_id = p_customer;
  return 'applied';
end $$;

revoke execute on function public.apply_subscription(text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription(text, text, timestamptz, timestamptz) to service_role;
