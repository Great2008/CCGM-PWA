import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BOwHcCnXaOlM2krFyYhnW0_dAjdIt8067WjNuX1Tsa7uew6tblhFMTuqCEH7XU8BCdleHzMIhPLxEEhy02hs6zA'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(user) {
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [supported, setSupported]   = useState(false)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok) setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    )
  }, [supported])

  const subscribe = async () => {
    if (!supported) return { error: 'Push notifications not supported in this browser' }
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setLoading(false)
        return { error: 'Permission denied' }
      }

      const reg = await navigator.serviceWorker.ready

      let sub
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      } catch (pushErr) {
        setLoading(false)
        return { error: `Subscription failed: ${pushErr.message}` }
      }

      const subJson = sub.toJSON()

      // Upsert: delete old row for this endpoint, insert fresh
      await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint)

      const { error } = await supabase.from('push_subscriptions').insert({
        user_id:      user?.id || null,
        endpoint:     subJson.endpoint,
        p256dh:       subJson.keys?.p256dh,
        auth:         subJson.keys?.auth,
        user_agent:   navigator.userAgent.substring(0, 200),
        subscribed_at: new Date().toISOString(),
      })

      if (error) {
        setLoading(false)
        return { error: `Could not save subscription: ${error.message}` }
      }

      setSubscribed(true)
      setLoading(false)
      return { success: true }
    } catch (err) {
      console.error('Subscribe error:', err)
      setLoading(false)
      return { error: err.message }
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Unsubscribe error:', err)
    }
    setLoading(false)
  }

  return { supported, permission, subscribed, loading, subscribe, unsubscribe }
}
