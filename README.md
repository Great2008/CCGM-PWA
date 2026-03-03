# ✝ Christian Church Of God Mission — Website

> **God First** | Built with React + Vite + Python (Vercel Serverless)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+

### Installation

```bash
# 1. Install frontend dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env

# 3. Start development server
npm run dev
```

The app runs at **http://localhost:5173**

---

## 📁 Project Structure

```
ccogm/
├── src/
│   ├── pages/           # All page components
│   │   ├── Home.jsx
│   │   ├── Sermons.jsx
│   │   ├── Events.jsx
│   │   ├── About.jsx
│   │   ├── Contact.jsx
│   │   ├── Gallery.jsx
│   │   └── Blog.jsx
│   ├── components/      # Shared components
│   │   ├── Navbar.jsx
│   │   └── Footer.jsx
│   ├── data/
│   │   └── mockData.js  # Seed data (replace with API calls)
│   └── App.jsx
├── api/
│   ├── index.py         # Python serverless API (Vercel)
│   └── requirements.txt
├── vercel.json          # Vercel deployment config
└── vite.config.js
```

---

## 🌐 Deploying to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Vercel auto-detects Vite — just click **Deploy**
4. Add your environment variables in the Vercel dashboard

---

## 🔌 Connecting a Real Backend

The `api/index.py` file is a Vercel Python serverless function.

**To connect a real database (recommended: Supabase):**
1. Create a free project at [supabase.com](https://supabase.com)
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your `.env`
3. Install `supabase` in `api/requirements.txt`
4. Replace the seed data in `api/index.py` with Supabase queries

**To enable contact form emails (recommended: SendGrid):**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Add `SENDGRID_API_KEY` to your `.env`
3. Uncomment the `send_email()` call in `api/index.py`

---

## 🎨 Customization

- **Colors**: Edit CSS variables in `src/index.css`
- **Content**: Update `src/data/mockData.js` with real data
- **Service times**: Edit `src/pages/Home.jsx` service times section
- **Staff photos**: Update `src/pages/About.jsx` staff array
- **Church address**: Update `src/components/Footer.jsx` and `src/pages/Contact.jsx`

---

## 📋 Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Hero, service times, featured sermon, upcoming events, CTA |
| Sermons | `/sermons` | Searchable/filterable sermon archive with video & audio |
| Events | `/events` | Upcoming events with category filters |
| About | `/about` | Mission, vision, stats, leadership team |
| Contact | `/contact` | Contact form with prayer request & office info |
| Gallery | `/gallery` | Masonry photo gallery with lightbox & category filter |
| Devotionals | `/blog` | Blog posts, featured article, newsletter signup |

---

*Made with ❤️ for Christian Church Of God Mission — God First*
