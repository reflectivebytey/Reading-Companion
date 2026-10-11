-- Include registered readers before their first session while preserving
-- dense ties and deterministic ordering. Public responses still omit user IDs.
create or replace function public.get_reading_companion_reader_rankings(p_period text)
returns table(
  user_id uuid,
  reader_name text,
  total_reading_seconds bigint,
  rank_position bigint,
  arena_avatar_path text,
  arena_show_photo boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ist_week_start date := date_trunc('week', now() at time zone 'Asia/Kolkata')::date;
begin
  if p_period not in ('weekly', 'all_time') then
    raise exception 'invalid_ranking_period';
  end if;

  return query
  with roster as (
    select
      u.id as reader_id,
      coalesce(
        nullif(nullif(btrim(l.reader_name), ''), 'Reader'),
        nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(l.reader_name), ''),
        'Reader'
      )::text as display_name,
      case
        when p_period = 'weekly' and l.ranking_week_start = ist_week_start
          then coalesce(l.weekly_reading_seconds, 0)
        when p_period = 'weekly' then 0
        else coalesce(l.total_reading_seconds, 0)
      end::bigint as reading_seconds,
      l.arena_avatar_path,
      coalesce(l.arena_show_photo, false) as show_photo
    from auth.users u
    left join public.reading_companion_session_limits l on l.user_id = u.id
  ),
  ranked as (
    select
      roster.*,
      dense_rank() over (order by roster.reading_seconds desc) as dense_position
    from roster
  )
  select
    ranked.reader_id,
    ranked.display_name,
    ranked.reading_seconds,
    ranked.dense_position,
    ranked.arena_avatar_path,
    ranked.show_photo
  from ranked
  order by ranked.reading_seconds desc, ranked.reader_id asc;
end;
$$;

revoke all on function public.get_reading_companion_reader_rankings(text) from public, anon, authenticated;
grant execute on function public.get_reading_companion_reader_rankings(text) to service_role;

notify pgrst, 'reload schema';