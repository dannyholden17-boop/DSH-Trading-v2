-- The desk writes the analysis provider's raw failure into
-- desk_rounds.meta->>'director_err'. desk_rounds carries a public SELECT
-- policy with qual true and the client fetches select=*, so that string --
-- an Anthropic billing message naming the account's credit state -- was
-- readable by anyone who opened the page. desk_floor() passed it through as
-- stall_reason as well.
--
-- Rather than filter it in every reader, the raw text stops being stored: a
-- trigger classifies it into a safe code on write and drops the original, so
-- the value does not exist in the database for any consumer to leak.
create or replace function public.desk_classify_provider_error(msg text)
returns text language sql immutable as $$
  select case
    when msg is null or btrim(msg) = '' then null
    when msg ~* 'credit balance|billing|insufficient[_ ]quota|payment' then 'provider_credit'
    when msg ~* 'rate.?limit|429|overloaded|too many requests'         then 'provider_rate_limit'
    when msg ~* '\mapi[_ ]?key|unauthor|forbidden|\m401\M|\m403\M'      then 'provider_auth'
    when msg ~* 'timed? ?out|timeout|ETIMEDOUT|ECONNRESET'             then 'provider_timeout'
    else 'provider_error'
  end
$$;

create or replace function public.desk_rounds_redact()
returns trigger language plpgsql as $$
declare raw text;
begin
  if new.meta is null then return new; end if;
  raw := new.meta->>'director_err';
  if raw is not null then
    new.meta := (new.meta - 'director_err')
      || jsonb_build_object('director_code', public.desk_classify_provider_error(raw));
  end if;
  if new.error is not null and new.error ~* 'credit balance|billing|api[_ ]?key|token|password|secret' then
    new.error := public.desk_classify_provider_error(new.error);
  end if;
  return new;
end;
$$;

drop trigger if exists desk_rounds_redact_t on public.desk_rounds;
create trigger desk_rounds_redact_t
  before insert or update on public.desk_rounds
  for each row execute function public.desk_rounds_redact();

update public.desk_rounds
set meta = (meta - 'director_err')
        || jsonb_build_object('director_code',
             public.desk_classify_provider_error(meta->>'director_err'))
where meta ? 'director_err';

update public.desk_rounds
set error = public.desk_classify_provider_error(error)
where error is not null
  and error ~* 'credit balance|billing|api[_ ]?key|token|password|secret';
