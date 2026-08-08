

create table if not exists email_delivery_logs (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,  -- 'guest-rsvp' | 'send-rsvp-confirmation' | 'send-newsletter'
  recipient_email text not null,
  recipient_name  text,
  subject         text,
  success         boolean not null,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists email_delivery_logs_created_idx on email_delivery_logs(created_at desc);
create index if not exists email_delivery_logs_success_idx on email_delivery_logs(success);

alter table email_delivery_logs enable row level security;

create policy "Staff view email logs" on email_delivery_logs
  for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','moderator'))
  );

