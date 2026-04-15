import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { useNativeSetup } from './hooks/useNativeSetup'
import AppSplash from './components/AppSplash'
import UpdatePrompt from './components/UpdatePrompt'
import Navbar     from './components/Navbar'
import Footer     from './components/Footer'
import Home       from './pages/Home'
import Sermons    from './pages/Sermons'
import Events     from './pages/Events'
import About      from './pages/About'
import Contact    from './pages/Contact'
import Gallery    from './pages/Gallery'
import Blog       from './pages/Blog'
import Bible      from './pages/Bible'
import Hymnal     from './pages/Hymnal'
import Devotional from './pages/Devotional'
import Timeline   from './pages/Timeline'
import Live       from './pages/Live'
import PushPrompt from './components/PushPrompt'
import SabbathSchool from './pages/SabbathSchool'
import Notifications from './pages/Notifications'
import FindChurch from './pages/FindChurch'
import PrayerWall from './pages/PrayerWall'
import Studio     from './pages/Studio'
import Profile    from './pages/Profile'
import Search       from './pages/Search'
import Certificate  from './pages/Certificate'
import Guidelines  from './pages/Guidelines'
import Verify       from './pages/Verify'
import Programme    from './pages/Programme'
import SuspensionNotice from './components/SuspensionNotice'

function AppInner() {
  const { user } = useAuth()
  const [splashDone, setSplashDone] = useState(false)

  // ── Native setup: push notification routing, badge count ──
  useNativeSetup()

  // ── Hide native splash immediately — React splash takes over ──
  useEffect(() => {
    const hideSplash = async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide({ fadeOutDuration: 0 })
      } catch {
        // Not native — silently ignore
      }
    }
    hideSplash()
  }, [])

  return (
    <>
      {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      <Navbar />
      <main style={{ overflowX: 'hidden' }}>
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
        </Routes>
      </main>
      <Footer />
      <PushPrompt user={user} />
      <SuspensionNotice />
      {splashDone && <UpdatePrompt />}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
