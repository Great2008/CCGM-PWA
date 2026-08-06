-- Not every event needs meal tickets (e.g. a one-off service vs. a residential
-- conference). This flag lets admins opt individual events in.
-- Defaults to false — existing events are unaffected; enable it per-event
-- from the event edit form.

alter table events
  add column if not exists meal_tickets_enabled boolean not null default false;
