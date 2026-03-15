# ✝ Christian Church Of God Mission — PWA

> **God First** | Built with React + Vite + Supabase · Deployable on Vercel · Native mobile via Capacitor

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables (see section below)

# 3. Start development server
npm run dev
```

The app runs at **http://localhost:5173**

---

## 🔑 Environment Variables

All secrets are stored as environment variables — **never committed to the repo**.

Set these in your `.env` file locally and in the **Vercel dashboard** for production.

| Variable | Where used | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client only | Service role key — never expose to browser |

> Supabase Edge Functions (`supabase/functions/`) use secrets managed via the Supabase dashboard or `supabase secrets set`.

---

## 📁 Project Structure

```
CCGM-PWA/
├── src/
│   ├── pages/               # All public-facing pages
│   ├── admin/               # Admin panel (pages, components, hooks)
│   │   └── pages/           # One component per admin section
│   ├── components/          # Shared UI components (Navbar, Footer, etc.)
│   ├── contexts/            # React contexts (Auth, Theme)
│   ├── hooks/               # Custom hooks (push notifications, content)
│   ├── lib/                 # Supabase clients (public + admin)
│   └── data/
│       └── bibleData.js     # Static offline Bible dataset
├── supabase/
│   └── functions/           # Supabase Edge Functions (push, email, etc.)
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker (push + offline caching)
│   └── icons/               # PWA + app store icons
├── api/
│   └── index.py             # Vercel Python serverless function
├── vercel.json              # Vercel deploy config + rewrites
└── vite.config.js
```

---

## 📋 Pages

| Page | Path | Description |
|---|---|---|
| Home | `/` | Hero, service times, featured sermon, upcoming events |
| Sermons | `/sermons` | Searchable sermon archive with video & audio |
| Events | `/events` | Upcoming events with category filters & registration |
| About | `/about` | Mission, vision, stats, leadership team |
| Contact | `/contact` | Contact form + prayer request |
| Gallery | `/gallery` | Masonry photo gallery with lightbox |
| Blog | `/blog` | Articles, devotionals, newsletter signup |
| Bible | `/bible` | Full offline Bible reader (static dataset) |
| Hymnal | `/hymnal` | Searchable hymn book |
| Devotional | `/devotional` | Daily devotionals |
| Live | `/live` | Live stream embed |
| Sabbath School | `/sabbath-school` | Weekly Sabbath School lessons |
| Timeline | `/timeline` | Members-only social feed |
| Prayer Wall | `/prayer-wall` | Community prayer requests |
| Studio | `/studio` | CCG Studio media hub |
| Find Church | `/find-church` | Branch/location finder |
| Profile | `/profile` | Member profile & settings |
| Notifications | `/notifications` | Push notification history |
| Search | `/search` | Global site search |
| Certificate | `/certificate` | Member certificate generation |
| Verify | `/verify` | Certificate verification |

---

## 🛠 Admin Panel (`/admin`)

Protected by Supabase auth + role check. Accessible to `super_admin`, `admin`, and `moderator`.

| Section | Description |
|---|---|
| Dashboard | Key stats overview |
| CCG Studio | Manage studio media |
| Sermons | Upload & manage sermons |
| Events | Create & manage events + registrations |
| Blog & Devotionals | Write & publish articles |
| Gallery | Upload & organise photos |
| Hymnal | Add/edit hymns |
| Homepage | Edit homepage content blocks |
| Prayer Requests | Moderate prayer wall |
| Timeline | Moderate member feed |
| Members | Manage accounts, roles & suspension |
| Live Stream | Configure live stream source |
| Sabbath School | Manage lesson content |
| Analytics | View site analytics |
| Bulk Email | Send newsletters & announcements |
| Push Notifications | Send push to all members |
| Bulk Message | Multi-channel messaging |
| Church Branches | Manage branch directory + approve member suggestions |
| Member Directory | Browse & export member list |
| Admin Signature | Set admin email signature |
| Audit Log | Full log of all admin actions |

---

## 👤 Auth & Roles

- **Signup:** Email + OTP verification (not magic link)
- **Role hierarchy:** `super_admin` › `admin` › `moderator` › `member`
- **Church titles** (Pastor, Elder, Deacon, etc.) are display-only — separate from app permissions
- **Suspension:** Admins can suspend/reinstate members; a Supabase Edge Function sends the notification email

---

## 📲 Mobile (Capacitor)

The app wraps as a native Android/iOS app via Capacitor 6.

```bash
# Build + sync to native projects
npm run cap:sync

# Open in Android Studio
npm run cap:android

# Open in Xcode
npm run cap:ios
```

---

## 🌐 Deploying to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com) — Vite is auto-detected
3. Add all environment variables in the Vercel dashboard
4. Deploy

---

## 🎨 Customization

- **Brand colors:** CSS variables in `src/index.css`
- **Service times:** `src/pages/Home.jsx`
- **Staff / leadership:** `src/pages/About.jsx`
- **Church address:** `src/components/Footer.jsx` and `src/pages/Contact.jsx`
- **Branch list:** Admin panel → Church Branches

---

*Made with ❤️ for Christian Church Of God Mission — God First*
