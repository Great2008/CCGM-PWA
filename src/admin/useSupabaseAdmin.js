import { useState, useEffect, useCallback } from 'react'
import supabaseAdmin from '../lib/supabase'

export function useTable(table, opts = {}) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    let q = supabaseAdmin.from(table).select(opts.select || '*')
    if (opts.order)  q = q.order(opts.order, { ascending: opts.asc ?? false })
    if (opts.filter) for (const [col,val] of Object.entries(opts.filter)) q = q.eq(col, val)
    const { data, error: err } = await q
    if (err) setError(err.message)
    else setRows(data || [])
    setLoading(false)
  }, [table])

  useEffect(() => { load() }, [load])

  const insert = async row => {
    const { data, error: err } = await supabaseAdmin.from(table).insert(row).select().single()
    if (err) throw new Error(err.message)
    setRows(r => [data, ...r]); return data
  }
  const update = async (id, changes) => {
    const { data, error: err } = await supabaseAdmin.from(table).update(changes).eq('id', id).select().single()
    if (err) throw new Error(err.message)
    setRows(r => r.map(row => row.id===id ? data : row)); return data
  }
  const remove = async id => {
    const { error: err } = await supabaseAdmin.from(table).delete().eq('id', id)
    if (err) throw new Error(err.message)
    setRows(r => r.filter(row => row.id !== id))
  }
  const upsert = async (row, conflict='id') => {
    const { data, error: err } = await supabaseAdmin.from(table).upsert(row, { onConflict: conflict }).select().single()
    if (err) throw new Error(err.message); return data
  }
  return { rows, loading, error, insert, update, remove, upsert, reload: load }
}
