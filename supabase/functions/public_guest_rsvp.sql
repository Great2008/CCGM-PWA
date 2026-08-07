

alter table event_registrations
  add column if not exists guest_email text;
create unique index if not exists event_registrations_guest_email_unique
  on event_registrations(event_id, guest_email)
  where is_guest = true and guest_email is not null;

-- 
create policy "Public guest RSVP" on event_registrations
  for insert
  to anon, authenticated
  with check (
    is_guest = true and guest_name is not null and guest_email is not null
  );
