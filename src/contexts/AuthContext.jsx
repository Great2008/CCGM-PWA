import { createContext, useContext, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (error) console.error('fetchProfile error (possible RLS block):', error.message, error.code)
    // If profile just went from suspended → not suspended, flag for reinstatement notice
    setProfile(prev => {
      if (prev?.suspended === true && data?.suspended === false) {
        sessionStorage.setItem('ccgm_reinstated_notice', '1')
      }
      return data || null
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, profileData = {}) => {
    const { fullName = '', ...rest } = profileData
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, display_name: fullName.split(' ')[0] },
        emailRedirectTo: undefined,   // disable magic link — we use OTP
      }
    })
    // Supabase silently succeeds for existing emails but returns empty identities
    // Detect this and surface a clear error instead of hanging on OTP step
    if (!error && data?.user && data.user.identities?.length === 0) {
      return { message: 'An account with this email already exists. Please sign in instead.' }
    }
    // Store extra profile fields to apply after OTP verify
    if (!error && Object.keys(rest).length) {
      sessionStorage.setItem('ccgm_pending_profile', JSON.stringify({ ...rest, full_name: fullName }))
    }
    return error
  }

  const verifyOtp = async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    if (!error) {
      // Apply any extra profile fields saved during signup
      try {
        const pending = JSON.parse(sessionStorage.getItem('ccgm_pending_profile') || 'null')
        if (pending) {
          const { data: { user: u } } = await supabase.auth.getUser()
          if (u) {
            const { full_name, phone, location, occupation, birthday, church_branch, bio, unlisted_branch, gender, church_title, pending_church_post } = pending
            const updates = {
              display_name: full_name?.split(' ')[0] || '',
              full_name,
              ...(phone && { phone }),
              ...(location && { location }),
              ...(occupation && { occupation }),
              ...(birthday && { birthday }),
              ...(church_branch && { church_branch }),
              ...(bio && { bio }),
              ...(gender && { gender }),
              ...(church_title && { church_title }),
              ...(pending_church_post && { pending_church_post }),
              // Mark as unverified_branch if they used "Not Listed" — clears when admin approves
              ...(unlisted_branch?.name && { unverified_branch: true }),
            }
            await supabase.from('profiles').update(updates).eq('id', u.id)
            // Save unlisted branch request for admin review
            if (unlisted_branch?.name) {
              await supabase.from('branch_suggestions').insert({
                user_id: u.id,
                branch_name: unlisted_branch.name,
                city: unlisted_branch.city || '',
                status: 'pending',
              })
            }
            sessionStorage.removeItem('ccgm_pending_profile')
          }
        }
      } catch (_) {}
    }
    return error
  }

  const resendOtp = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return error
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signOut = () => supabase.auth.signOut()

  const updateProfile = async (updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (!error) setProfile(data)
    return error
  }

  // ── Role helpers ──────────────────────────────────────────────────────────
  // App roles (permissions):   super_admin > admin > moderator > member
  // Church titles (display):   stored in profile.church_title, no permissions attached
  const appRole        = profile?.role || 'member'
  const isSuperAdmin   = appRole === 'super_admin'
  const isAdmin        = appRole === 'admin' || isSuperAdmin
  const isModerator    = appRole === 'moderator' || isAdmin
  const canModerate    = isModerator   // shorthand: can delete posts, manage prayer wall
  const churchTitle    = profile?.church_title || null   // e.g. 'Pastor', 'Elder', 'Deacon'

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, verifyOtp, resendOtp, signIn, signOut, updateProfile,
      // Role flags
      appRole, isSuperAdmin, isAdmin, isModerator, canModerate,
      churchTitle,
      // Legacy alias (keep for any components not yet updated)
      isApproved: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
