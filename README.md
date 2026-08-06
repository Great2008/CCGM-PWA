# CCG World

A Progressive Web App for **Christian Church of God Mission**, built with React + Vite on the frontend and Supabase (Postgres + Auth + Storage + Row Level Security) on the backend. It's installable on mobile home screens, works offline for key content, and ships as native Android/iOS apps via Capacitor.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Database Setup](#database-setup)
5. [Features — Public App](#features--public-app)
6. [Features — Admin Panel](#features--admin-panel)
7. [Meal Tickets — Deep Dive](#meal-tickets--deep-dive)
8. [Roles & Permissions](#roles--permissions)
9. [Offline Support (PWA)](#offline-support-pwa)
10. [Mobile Apps (Capacitor)](#mobile-apps-capacitor)
11. [Deployment Notes](#deployment-notes)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite, React Router |
| Backend | Supabase (Postgres, Auth, Storage, Row Level Security) |
| State/data | Plain hooks + `@supabase/supabase-js`, some `@tanstack/react-query` |
| Styling | Inline styles + CSS variables (no CSS framework) |
| PWA | Hand-written service worker (`public/sw.js`) — not Workbox/vite-plugin-pwa |
| Native apps | Capacitor 6 (Android + iOS wrappers around the same web build) |
| PDF/exports | `jspdf`, `pdfjs-dist`, `xlsx` |

---

## Getting Started

### 1. Environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These are read in `src/lib/supabase.js`. Never commit this file — it's expected to be in `.gitignore`.

### 2. Install & run

```bash
npm install
npm run dev        # local dev server
npm run build       # production build → dist/
npm run preview     # preview the production build locally
```

### 3. Database

See [Database Setup](#database-setup) below — you need a Supabase project with the base schema already in place (profiles, events, event_registrations, posts, etc. — this repo doesn't include the original base schema, only incremental migrations added on top of it).

---

## Project Structure

```
src/
  pages/            Public-facing pages (one file per route)
  admin/
    pages/           Admin panel pages (one file per admin section)
    components/      Shared admin UI (CrudShell, PageHeader, AdminCard, Modal)
    hooks/           Admin-only hooks (e.g. useIsMobile)
    AdminApp.jsx      Admin shell: sidebar nav, role gating, AdminContext
  contexts/          AuthContext (session, profile, role)
  hooks/             Shared data-fetching hooks (useEventsContent, etc.)
  lib/               supabase client, PDF export helpers, fonts
  components/        Shared public UI (SEO, banners, etc.)
public/
  sw.js              Service worker — offline caching, push notifications
supabase/
  migrations/         Incremental SQL migrations (see below) — run manually
                       in the Supabase SQL editor, in filename order
```

**Routing convention:** every public page in `src/pages/` is lazy-loaded and registered in `src/App.jsx`. Every admin page in `src/admin/pages/` is registered in the `PAGES` map and `NAV` array in `src/admin/AdminApp.jsx`.

---

## Database Setup

This repo assumes a **pre-existing base schema** (profiles, events, event_registrations, posts, sabbath_lessons, hymns, etc.) already set up in your Supabase project — that schema isn't tracked here. The files in `supabase/migrations/` are **incremental** additions layered on top of it, added over the course of building the Meal Tickets feature. Run them in the Supabase SQL editor, **in this order**:

| # | File | What it does |
|---|---|---|
| 1 | `meal_checkins.sql` | Creates the `meal_checkins` table (per-day, per-slot meal check-in records). Also loosens `event_registrations.user_id` to nullable and adds `is_guest`, `guest_name`, `guest_phone`, `registered_by` — enabling walk-in registrations for people without an app account. |
| 2 | `self_registration_policy.sql` | Adds an RLS policy letting a signed-in user manage (insert/select/delete) their **own** `event_registrations` row. Without this, ordinary members can't RSVP — only staff (admin/moderator) can register people, since the walk-in policy added in step 1 is staff-only. |
| 3 | `payment_gating.sql` | Adds `events.requires_payment` and `event_registrations.payment_confirmed` (+ who/when confirmed). Lets an event be flagged as needing payment before a meal ticket becomes usable. |
| 4 | `meal_tickets_opt_in.sql` | Adds `events.meal_tickets_enabled` (default `false`). Meal tickets are **opt-in per event** — most events (a Sunday service, a one-off talk) don't need them; only enable this for residential/catering events like a conference. |

All migrations are written with `if not exists`-style guards where practical, so they're safe to re-run — except `create policy` statements, which Postgres has no `if not exists` form for; if one of those errors on re-run, it just means it's already applied.

### Applying these to a fresh database

If you're setting this up from scratch (not against the original church's existing project), you'll need the base schema first — `profiles`, `events`, `event_registrations`, `posts`, `programmes`, `programme_days`, `programme_sessions`, `programme_agenda_items`, `programme_rsvps`, `sabbath_lessons`, `hymns`, `admin_audit_log`, etc. — before these migrations will apply cleanly, since they all reference those tables via foreign keys.

---

## Features — Public App

- **Home** — landing page, announcements, daily verse
- **Bible** — reader
- **Hymnal** — searchable hymn book
- **Devotional** — daily devotional posts
- **Sermons** — audio/video sermon library
- **Events** — event listing, RSVP, meal ticket access (see below)
- **Programme** — multi-day conference agenda, day-by-day sessions, session RSVP
- **Timeline** — social feed (posts, testimonies, prayer requests, comments)
- **Prayer Wall** — public prayer requests + private prayer form
- **Sabbath School** — lesson study material
- **Live** — livestream embed
- **Gallery / Blog** — media and articles
- **Certificate** — QR-verifiable certificate lookup (`/verify`)
- **Notifications** — push notification inbox
- **Profile** — account settings, password change
- **Find Church / About / Contact / Guidelines** — static/informational pages

## Features — Admin Panel

Reached via the admin login; sidebar visibility depends on role (see [Roles & Permissions](#roles--permissions)).

- **Dashboard** — overview stats
- **Analytics** — usage analytics
- **Members / Member Directory** — member management, role assignment, suspension
- **Registrations** — event RSVP list per event
- **Meal Tickets** — see deep-dive below
- **Events / Programme** — event and conference-agenda CRUD
- **Timeline moderation** — posts, topics, reports (3 tabs)
- **Prayer** — prayer wall moderation + form requests
- **Sermons / Studio / Hymnal / Sabbath / Blog / Gallery / Homepage** — content CRUD
- **Live** — livestream control
- **Notifications / Bulk Message / Email / Letter Writer** — outbound comms
- **Certificates** — certificate issuing + template management
- **Branches** — church branch directory
- **Signature** — admin signature management (for certificates/letters)
- **Audit Log** — admin/moderator action history (admin & super-admin only)
- **Maintenance** — site maintenance-mode toggle (super-admin only)

---

## Meal Tickets — Deep Dive

Built for residential conferences (e.g. a multi-day youth conference) where meals are served twice a day and need to be tracked per participant, per day.

### How it works

1. **Enable it per event** — from *Admin → Events → edit event*, check "🍽️ This event has meal tickets." Most events leave this off. Optionally also check "💰 Meals are paid" if payment needs confirming before a ticket is usable.
2. **Participants get a digital ticket** — once an app user RSVPs to a meal-ticket-enabled event, a "🎫 Meal Ticket" button appears linking to `/meal-ticket?event=<id>`, showing a QR code plus a Day 1/Day 2/... checklist of every meal, computed automatically from the event's `date` → `end_date` range.
3. **Walk-ins** — for people without the app, moderators can register them on the spot from the Meal Tickets scanner ("➕ Register Walk-in"), which also checks for likely duplicate names before creating a new entry.
4. **Payment gating** (optional, per event) — if enabled, a ticket's QR still displays (so staff can scan it to identify the person and confirm payment), but meals can't be marked as collected until a moderator taps "✅ Confirm Payment Received."
5. **Checking meals off** — moderators use *Admin → Meal Tickets*: scan a QR (camera, via the native `BarcodeDetector` API or a `jsQR` fallback loaded from CDN) or search by name/phone. Each conference day shows its own Breakfast/Dinner row, so a moderator can correct a missed scan from an earlier day, not just "today."
6. **Offline-first** — meal check-ins queue locally (`localStorage`) and sync automatically once the connection returns, since conference wifi is often unreliable. The roster itself is cached locally too, so search still works offline.
7. **Audit trail** — walk-in registrations, payment confirmations, and every meal check-in are logged to `admin_audit_log`, viewable by admins/super-admins (moderators can't see the log themselves, so this is their accountability trail for handling payments).

### Who can access it

Meal Tickets is one of the few admin pages moderators can reach (most admin pages are admin/super-admin only) — see `AdminApp.jsx`'s `visibleNav` logic.

---

## Roles & Permissions

Defined on `profiles.role`, four tiers:

| Role | Access |
|---|---|
| `member` | Standard app experience only, no admin panel |
| `moderator` | Admin panel, but limited to: Timeline moderation, Prayer, Meal Tickets |
| `admin` | Full admin panel access |
| `super_admin` | Everything `admin` has, plus role management, Maintenance mode, Audit Log |

Role gating happens in `src/admin/AdminApp.jsx` (`visibleNav`, `superAdminOnlyPages`). Note: `AuthContext`'s `isApproved` flag is a **legacy alias that's always `true`** for any signed-in user — it doesn't reflect a real approval/moderation gate. Any actual member-approval logic needs to be enforced via RLS policy at the database level, not this flag.

---

## Offline Support (PWA)

`public/sw.js` implements two layers of caching:

1. **App shell precache** — core routes (`/`, `/events`, `/programme`, `/meal-ticket`, etc.) and static assets, cached on install.
2. **API cache-with-network-first-fallback** — for GET requests to specific Supabase tables (Sabbath lessons, devotionals, hymns, programme tables, events, event_registrations, meal_checkins): try the network first, fall back to the last-known-good cached response when offline. Only `GET` requests are ever touched — mutations (POST/PATCH/DELETE) always go straight to the network untouched.

**When you change `sw.js`, bump the `CACHE` and `API_CACHE` version constants at the top of the file.** Browsers that already installed the old service worker won't pick up your changes otherwise — they'll keep serving old cached content indefinitely.

Meal check-ins additionally use their own `localStorage`-based offline queue (separate from the service worker) since they need read-your-own-writes consistency while offline, not just cached reads — see `AdminMealTickets.jsx`.

---

## Mobile Apps (Capacitor)

```bash
npm run cap:sync      # build web + sync into native projects
npm run cap:android    # sync + open Android Studio
npm run cap:ios        # sync + open Xcode
```

This requires a `capacitor.config` file and the native `android/`/`ios/` project folders, which aren't part of this particular export — set those up with `npx cap add android` / `npx cap add ios` if starting fresh.

---

## Deployment Notes

- No `.env` file is committed — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider's environment variables.
- Run any new files in `supabase/migrations/` manually against your Supabase project before deploying frontend changes that depend on them — there's no automatic migration runner wired up.
- Bump the service worker cache version (see above) with every deploy that touches `public/sw.js`, offline-cached routes, or offline-cached API tables.
