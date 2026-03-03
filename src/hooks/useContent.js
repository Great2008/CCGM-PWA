/**
 * useContent.js
 * Reads site content from Supabase site_settings table.
 * Falls back to localStorage cache when offline.
 */
import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

export const DEFAULTS = {
  homepage: {
    hero: {
      title: 'Welcome to CCG World',
      subtitle: 'A community rooted in faith, love, and the Word of God. Join us as we worship, grow, and serve together.',
      ctaText: 'Join Us This Saturday',
      ctaLink: '/events',
    },
    announcement: { show: false, text: '' },
    serviceTimes: [
      { day: 'Sunday',    name: 'Meetings of Different Bodies', time: '', icon: '🤝' },
      { day: 'Monday',    name: "Children's Prayer",            time: '', icon: '🙏' },
      { day: 'Tuesday',   name: 'Bible Study',                  time: '', icon: '📖' },
      { day: 'Wednesday', name: 'Midweek Service',              time: '', icon: '⛪' },
      { day: 'Thursday',  name: 'Deliverance Service',          time: '', icon: '🔥' },
      { day: 'Friday',    name: 'Sabbath Preparation',          time: '', icon: '✨' },
      { day: 'Saturday',  name: 'Divine Service',               time: '', icon: '🌟' },
    ],
    stats: [
      { label: 'Years of Ministry', value: '25+' },
      { label: 'Active Members',    value: '500+' },
      { label: 'Weekly Services',   value: '7' },
      { label: 'Countries Reached', value: '12+' },
    ],
    contact: { address: '', phone: '', email: 'info@ccgworld.org', mapUrl: '' },
  },
}

const CACHE = 'ccgworld_setting_'

async function fetchSetting(key, fallback) {
  const cacheKey = CACHE + key
  try {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', key).single()
    if (error || !data) throw new Error(error?.message || 'not found')
    try { localStorage.setItem(cacheKey, JSON.stringify(data.value)) } catch {}
    return data.value
  } catch {
    try { const c = localStorage.getItem(cacheKey); if (c) return JSON.parse(c) } catch {}
    return fallback
  }
}

export function useHomepageContent() {
  const [data, setData]     = useState(DEFAULTS.homepage)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSetting('homepage', DEFAULTS.homepage).then(d => {
      setData(prev => ({
        ...prev, ...d,
        serviceTimes: d.serviceTimes || prev.serviceTimes,
        stats:        d.stats        || prev.stats,
      }))
      setLoading(false)
    })
  }, [])

  return { data, loading }
}

export function useSermonsContent() {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('sermons').select('*').eq('published', true).order('date', { ascending: false })
      .then(({ data: d }) => { setData(d||[]); setLoading(false) })
  }, [])
  return { data, loading }
}

export function useEventsContent() {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('events').select('*').eq('published', true).order('date', { ascending: true })
      .then(({ data: d }) => { setData(d||[]); setLoading(false) })
  }, [])
  return { data, loading }
}

export function useBlogContent() {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('posts').select('*').eq('published', true).order('date', { ascending: false })
      .then(({ data: d }) => { setData(d||[]); setLoading(false) })
  }, [])
  return { data, loading }
}

export function useGalleryContent() {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('gallery').select('*').order('created_at', { ascending: false })
      .then(({ data: d }) => { setData(d||[]); setLoading(false) })
  }, [])
  return { data, loading }
}
