import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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

function AppInner() {
  const { user } = useAuth()
  return (
    <>
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
        </Routes>
      </main>
      <Footer />
      <PushPrompt user={user} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  )
}
