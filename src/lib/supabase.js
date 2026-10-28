import { createClient } from '@supabase/supabase-js'

const env = import.meta.env || {}
export const supabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
export const supabase = supabaseConfigured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

let cloudEnabled = false
let saveTimer
let lastPublicPlayersSnapshot = ''
export const setCloudReady = value => { cloudEnabled = value }

export async function getCloudSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

async function fetchAllRows(table, columns, ownerId) {
  const result = []
  const pageSize = 1000
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).eq('owner_id', ownerId).order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (error) throw error
    result.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return result
}

export async function getCloudState() {
  if (!supabase) return null
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return null
  const [{ data: saved, error: stateError }, rawEvents, rawLeads] = await Promise.all([
    supabase.from('veturb_state').select('payload').eq('user_id', user.id).maybeSingle(),
    fetchAllRows('veturb_events', 'id,player_id,event_type,pct,extra,created_at', user.id),
    fetchAllRows('veturb_leads', 'id,player_id,name,email,whatsapp,consent,consent_at,created_at', user.id),
  ])
  if (stateError) throw stateError
  const state = saved?.payload || null
  if (!state) return null
  const events = rawEvents.map(e => ({ id: e.id, ts: Date.parse(e.created_at), playerId: e.player_id, type: e.event_type, pct: e.pct, ...e.extra }))
  const leads = rawLeads.map(l => ({ id: l.id, playerId: l.player_id, name: l.name, email: l.email, whatsapp: l.whatsapp || '', consent: l.consent, consentAt: l.consent_at, createdAt: Date.parse(l.created_at) }))
  const players = (state.players || []).map(p => {
    const own = events.filter(e => e.playerId === p.id)
    return { ...p, views: own.filter(e => e.type === 'view').length, plays: own.filter(e => e.type === 'play').length, ctaClicks: own.filter(e => e.type === 'cta').length, conversions: leads.filter(l => l.playerId === p.id).length }
  })
  return { ...state, players, events, leads }
}

export async function getPublicPlayer(playerId) {
  if (!supabase || !playerId) return null
  const { data, error } = await supabase.from('veturb_public_players').select('config').eq('player_id', playerId).eq('published', true).maybeSingle()
  if (error) throw error
  return data?.config || null
}

export async function syncCloudState(state) {
  if (!supabase || !state?.session?.id) return
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return
  const { session, events = [], leads = [], ...rawPayload } = state
  const payload = { ...rawPayload, events: [], leads: [] }
  const { error } = await supabase.from('veturb_state').upsert({
    user_id: user.id,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) { console.error('Falha ao salvar no Supabase:', error.message); return }

  const players = Array.isArray(state.players) ? state.players : []
  const snapshot = JSON.stringify(players)
  if (snapshot !== lastPublicPlayersSnapshot) {
    const rows = players.map(p => ({ player_id: p.id, owner_id: user.id, config: p, published: p.status === 'active', updated_at: new Date().toISOString() }))
    if (rows.length) {
      const { error: playerError } = await supabase.from('veturb_public_players').upsert(rows, { onConflict: 'player_id' })
      if (playerError) { console.error('Falha ao publicar configuração dos players:', playerError.message); return }
    }
    const { data: existing, error: listError } = await supabase.from('veturb_public_players').select('player_id').eq('owner_id', user.id)
    if (listError) { console.error('Falha ao sincronizar players:', listError.message); return }
    const ids = new Set(players.map(p => p.id))
    const stale = (existing || []).map(p => p.player_id).filter(id => !ids.has(id))
    if (stale.length) {
      const { error: deleteError } = await supabase.from('veturb_public_players').delete().eq('owner_id', user.id).in('player_id', stale)
      if (deleteError) { console.error('Falha ao excluir players removidos:', deleteError.message); return }
    }
    lastPublicPlayersSnapshot = snapshot
  }

}

export function scheduleCloudSync(state) {
  if (!cloudEnabled || !state?.session?.id) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => syncCloudState(state), 700)
}
