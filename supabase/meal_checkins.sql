alter table event_registrations
  alter column user_id drop not null;

alter table event_registrations
  add column if not exists is_guest    boolean not null default false,
  add column if not exists guest_name  text,
  add column if not exists guest_phone text,
  add column if not exists registered_by uuid references profiles(id); -- staff member who registered the walk-in

alter table event_registrations
  add constraint event_registrations_identity_chk
  check (
    (is_guest = false and user_id is not null)
    or
    (is_guest = true and guest_name is not null)
  );
create policy "Staff register walk-ins" on event_registrations
  for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','moderator'))
  );

create table if not exists meal_checkins (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references event_registrations(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  user_id         uuid references profiles(id) on delete cascade, -- null for guest walk-ins
  meal_date       date not null default current_date,
  slot            text not null check (slot in ('breakfast','dinner')),
  checked_in_at   timestamptz not null default now(),
  checked_in_by   uuid references profiles(id),
  -- prevents the same person collecting the same meal twice
  unique (registration_id, meal_date, slot)
);

create index if not exists meal_checkins_event_date_idx on meal_checkins(event_id, meal_date);
create index if not exists meal_checkins_registration_idx on meal_checkins(registration_id);

alter table meal_checkins enable row level security;

-- Admins & moderators can read/write all check-ins
create policy "Staff manage meal checkins" on meal_checkins
  for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','moderator'))
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','moderator'))
  );

-- Participants can view their own check-in history (e.g. to show "collected" on their ticket)
create policy "Users view own meal checkins" on meal_checkins
  for select
  using (auth.uid() = user_id);
