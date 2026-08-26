-- Admin comp / entitlement (applied as migration: admin_comp_entitlement)
--
-- Model: "admin" == a permanently comped subscription. Emails in admin_emails
-- are auto-granted a "desk" (top-tier) active plan on signup, so every paid
-- feature that checks subscriptions treats them as fully paid — they never pay,
-- while everyone else goes through Stripe checkout as normal.
--
-- To add another admin later:
--   insert into public.admin_emails(email, note) values ('someone@x.com','staff');
--   select public.flux_comp_if_admin(u.id, u.email)
--     from auth.users u where lower(u.email) = 'someone@x.com';   -- comp them now
-- To revoke:
--   delete from public.admin_emails where email = 'someone@x.com';
--   update public.subscriptions set status='canceled'
--     where user_id = (select id from auth.users where lower(email)='someone@x.com');

create table if not exists public.admin_emails (
  email text primary key,
  note text,
  created_at timestamptz default now()
);
alter table public.admin_emails enable row level security;
-- No policies: only the service role and SECURITY DEFINER functions can read it.

insert into public.admin_emails(email, note)
values ('<OWNER_EMAIL — set in the live DB; redacted from this public repo>', 'owner')
on conflict (email) do nothing;

create or replace function public.flux_comp_if_admin(uid uuid, mail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if mail is null then return; end if;
  if not exists (select 1 from public.admin_emails a where lower(a.email) = lower(mail)) then
    return;
  end if;
  update public.subscriptions
     set plan = 'desk', status = 'active',
         current_period_end = timestamptz '2099-12-31 00:00:00+00', updated_at = now()
   where user_id = uid;
  if not found then
    insert into public.subscriptions(user_id, plan, status, current_period_end, updated_at)
    values (uid, 'desk', 'active', timestamptz '2099-12-31 00:00:00+00', now());
  end if;
end;
$$;

create or replace function public.flux_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.flux_comp_if_admin(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists flux_admin_comp on auth.users;
create trigger flux_admin_comp
  after insert on auth.users
  for each row execute function public.flux_on_auth_user_created();

-- Comp any admin users that already exist.
select public.flux_comp_if_admin(u.id, u.email)
from auth.users u
join public.admin_emails a on lower(a.email) = lower(u.email);

-- ============================================================
-- Admin management RPCs (migration: admin_management_rpcs)
-- Site-callable, JWT-verified: every function checks the caller's
-- email against admin_emails. Owner (email held in the live DB only; redacted here) is
-- immutable. flux_admin_add comps the new admin immediately if
-- they already have an account (otherwise the signup trigger does).
--   flux_is_admin()        -> boolean
--   flux_admin_list()      -> (email, note, created_at)
--   flux_admin_add(mail)   -> void
--   flux_admin_remove(mail)-> void  (also cancels their comped plan)
-- ============================================================
