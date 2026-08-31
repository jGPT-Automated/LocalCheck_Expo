begin;

create index if not exists court_submission_reviews_submitted_by_idx
  on private.court_submission_reviews (submitted_by);

create policy "No client access"
  on private.court_submission_reviews
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Anyone can view reviewed courts" on public.courts;
drop policy if exists "Submitters can view pending courts" on public.courts;
drop policy if exists "Anonymous users can view reviewed courts" on public.courts;
drop policy if exists "Signed-in users can view reviewed and own pending courts" on public.courts;

create policy "Anonymous users can view reviewed courts"
  on public.courts
  for select
  to anon
  using (
    not is_archived
    and verification_status <> 'needs_review'
  );

create policy "Signed-in users can view reviewed and own pending courts"
  on public.courts
  for select
  to authenticated
  using (
    not is_archived
    and (
      verification_status <> 'needs_review'
      or added_by = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';

commit;
