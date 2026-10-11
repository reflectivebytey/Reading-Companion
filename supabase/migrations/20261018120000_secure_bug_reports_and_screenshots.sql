-- Restrict reader access to reports and their screenshots. Existing ownerless
-- rows remain visible only through the service role.
alter table public.bug_reports
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

create index if not exists bug_reports_owner_created_idx
  on public.bug_reports (owner_user_id, created_at desc);

alter table public.bug_reports enable row level security;
revoke all on table public.bug_reports from anon;
revoke all on table public.bug_reports from authenticated;
grant select, insert on table public.bug_reports to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'bug_reports'
  loop
    execute format('drop policy %I on public.bug_reports', existing_policy.policyname);
  end loop;
end;
$$;

drop policy if exists bug_reports_select_owner on public.bug_reports;
create policy bug_reports_select_owner
  on public.bug_reports for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists bug_reports_insert_owner on public.bug_reports;
create policy bug_reports_insert_owner
  on public.bug_reports for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

do $$
declare
  report_id_column text;
  existing_policy record;
begin
  if to_regclass('public.bug_report_status_notes') is not null then
    alter table public.bug_report_status_notes enable row level security;
    revoke all on table public.bug_report_status_notes from anon;
    revoke all on table public.bug_report_status_notes from authenticated;
    grant select, insert on table public.bug_report_status_notes to authenticated;

    for existing_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'bug_report_status_notes'
    loop
      execute format('drop policy %I on public.bug_report_status_notes', existing_policy.policyname);
    end loop;

    select column_name into report_id_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bug_report_status_notes'
      and column_name in ('report_id', 'bug_report_id')
    order by case column_name when 'report_id' then 0 else 1 end
    limit 1;

    drop policy if exists bug_report_status_notes_select_owner on public.bug_report_status_notes;
    drop policy if exists bug_report_status_notes_insert_owner on public.bug_report_status_notes;
    if report_id_column is not null then
      execute format(
        'create policy bug_report_status_notes_select_owner on public.bug_report_status_notes for select to authenticated using (exists (select 1 from public.bug_reports r where r.id = %I and r.owner_user_id = (select auth.uid())))',
        report_id_column
      );
      execute format(
        'create policy bug_report_status_notes_insert_owner on public.bug_report_status_notes for insert to authenticated with check (exists (select 1 from public.bug_reports r where r.id = %I and r.owner_user_id = (select auth.uid())))',
        report_id_column
      );
    end if;
  end if;
end;
$$;

update storage.buckets
set public = false
where id = 'bug-report-screenshots';

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%bug-report-screenshots%'
        or coalesce(with_check, '') like '%bug-report-screenshots%')
  loop
    execute format('drop policy %I on storage.objects', existing_policy.policyname);
  end loop;
end;
$$;

drop policy if exists bug_report_screenshots_select_owner on storage.objects;
create policy bug_report_screenshots_select_owner
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bug-report-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists bug_report_screenshots_restrict_owner on storage.objects;
create policy bug_report_screenshots_restrict_owner
  on storage.objects as restrictive for all to public
  using (
    bucket_id <> 'bug-report-screenshots'
    or (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id <> 'bug-report-screenshots'
    or (select auth.uid())::text = (storage.foldername(name))[1]
  );