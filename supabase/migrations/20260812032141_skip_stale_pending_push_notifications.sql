-- Keep historical inbox rows visible without delivering them as stale device
-- alerts when a user registers their first push token.
update public.notifications
set push_status = 'skipped'
where push_status = 'pending'
  and push_attempts = 0
  and push_sent_at is null;
