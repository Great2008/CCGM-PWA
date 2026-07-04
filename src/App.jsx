import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar     from './components/Navbar'
import Footer     from './components/Footer'
import useMaintenanceMode from './hooks/useMaintenanceMode'

// Lazy-load non-critical UI components — not needed for first paint
const PushPrompt       = lazy(() => import('./components/PushPrompt'))
const SuspensionNotice = lazy(() => import('./components/SuspensionNotice'))
const DailyVerseBanner = lazy(() => import('./components/DailyVerseBanner'))

// Eagerly load Home and Maintenance — always needed on first paint
import Home       from './pages/Home'
import Maintenance from './pages/Maintenance'

// All other pages lazy-loaded — only downloaded when user navigates to them
const Sermons      = lazy(() => import('./pages/Sermons'))
const Events       = lazy(() => import('./pages/Events'))
const About        = lazy(() => import('./pages/About'))
const Contact      = lazy(() => import('./pages/Contact'))
const Gallery      = lazy(() => import('./pages/Gallery'))
const Blog         = lazy(() => import('./pages/Blog'))
const Bible        = lazy(() => import('./pages/Bible'))
const Hymnal       = lazy(() => import('./pages/Hymnal'))
const Devotional   = lazy(() => import('./pages/Devotional'))
const Timeline     = lazy(() => import('./pages/Timeline'))
const Live         = lazy(() => import('./pages/Live'))
const SabbathSchool  = lazy(() => import('./pages/SabbathSchool'))
const Notifications  = lazy(() => import('./pages/Notifications'))
const FindChurch     = lazy(() => import('./pages/FindChurch'))
const PrayerWall     = lazy(() => import('./pages/PrayerWall'))
const Studio         = lazy(() => import('./pages/Studio'))
const Profile        = lazy(() => import('./pages/Profile'))
const Search         = lazy(() => import('./pages/Search'))
const Certificate    = lazy(() => import('./pages/Certificate'))
const Guidelines     = lazy(() => import('./pages/Guidelines'))
const NotFound       = lazy(() => import('./pages/NotFound'))
const Verify         = lazy(() => import('./pages/Verify'))
const Programme      = lazy(() => import('./pages/Programme'))

function AppInner() {
  const { user } = useAuth()
  const { enabled, message, eta } = useMaintenanceMode()

  // While maintenance mode is on, show ONLY the maintenance page —
  // no Navbar/Footer/routes. /admin is a separate app (see main.jsx)
  // and is never affected, so it always stays reachable to switch
  // this back off.
  if (enabled) {
    return (
      <>
        <Maintenance message={message} eta={eta} />
        <Analytics />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ overflowX: 'hidden' }}>
        <Suspense fallback={<div style={{minHeight:'60vh'}} />}>
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/sermons"    element={<Sermons />} />
          <Route path="/events"     element={<Events />} />
          <Route path="/about"      element={<About />} />
          <Route path="/contact"    element={<Contact />} />
          <Route path="/gallery"    element={<Gallery />} />
          <Route path="/blog"       element={<Blog />} />
          <Route path="/bible"      element={<Bible />} />
          <Route path="/hymnal"     element={<Hymnal />} />
          <Route path="/devotional" element={<Devotional />} />
          <Route path="/timeline"   element={<Timeline />} />
          <Route path="/live"       element={<Live />} />
          <Route path="/sabbath-school" element={<SabbathSchool />} />
          <Route path="/notifications"  element={<Notifications />} />
          <Route path="/find-church"     element={<FindChurch />} />
          <Route path="/prayer-wall"     element={<PrayerWall />} />
          <Route path="/studio"          element={<Studio />} />
          <Route path="/profile"         element={<Profile />} />
          <Route path="/search"          element={<Search />} />
          <Route path="/certificate"      element={<Certificate />} />
          <Route path="/verify"           element={<Verify />} />
          <Route path="/programme"        element={<Programme />} />
          <Route path="/guidelines"       element={<Guidelines />} />
          <Route path="*"                 element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
      <PushPrompt user={user} />
      <SuspensionNotice />
      <DailyVerseBanner />
      <Analytics />
    </>
  )
}

export default function App() {
  // Let the HTML splash show for 2.5s then fade out (600ms transition)
  useEffect(() => {
    const t = setTimeout(() => window.__ccgHideSplash?.(), 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}
