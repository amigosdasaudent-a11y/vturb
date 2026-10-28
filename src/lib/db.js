import { useSyncExternalStore } from 'react'
import { scheduleCloudSync, supabase, supabaseConfigured } from './supabase.js'

const KEY = 'veturb_db_v1'

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`
export const fmt = n => new Intl.NumberFormat('pt-BR').format(n || 0)
export const pct = n => `${(n || 0).toFixed(1).replace('.', ',')}%`
export const fmtDate = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
export const fmtDateTime = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
export const dayKey = d => new Date(d).toISOString().slice(0, 10)
export const secToTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function embedBase() {
  const configured = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EMBED_BASE_URL) || ''
  if (configured) return String(configured).replace(/\/$/, '')
  if (typeof window === 'undefined') return ''
  // No ambiente local, os links públicos devem apontar para a aplicação hospedada,
  // não para localhost, que só existe no computador de desenvolvimento.
  const localHosts = ['localhost', '127.0.0.1', '0.0.0.0']
  if (localHosts.includes(window.location.hostname)) return 'https://veturb.vercel.app'
  return (window.location.origin + window.location.pathname).replace(/\/$/, '')
}

export function youtubeId(url = '') {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export function defaultPlayer(over = {}) {
  return {
    id: uid('ply'),
    workspaceId: 'ws_personal',
    name: '',
    videoUrl: '',
    videoType: 'youtube',
    posterUrl: '',
    gumletShareUrl: '',
    gumletMp4Url: '',
    gumletHlsUrl: '',
    orientation: 'horizontal',
    status: 'draft',
    createdAt: Date.now(),
    views: 0, plays: 0, ctaClicks: 0, conversions: 0,
    appearance: { accent: '#7440B6', controls: '#7440B6', bg: '#4a2a7a', text: '#ffffff' },
    controls: { quality: true, seek5: true, fullscreen: true, timecode: true, progress: true },
    fakeProgress: { enabled: false, speed: 1, thickness: 4 },
    playPause: { type: 'svg', color: '#7440B6', scale: 1, pauseModal: true, overlay: 'default', modalTitle: 'Continue de onde parou?', modalText: 'Você já assistiu parte deste vídeo. Deseja continuar?' },
    cta: {
      enabled: false, type: 'button', text: 'Saiba mais', icon: 'none', color: '#7440B6', textColor: '#ffffff',
      url: '', time: 0, position: 'top', size: 'md', radius: 'lg',
      animation: 'pulse', customImage: '',
    },
    countdown: { enabled: false, duration: 600, appearAfter: 0, text: 'Oferta expira em', position: 'tr', onExpire: 'hide', theme: 'red', bg: '#dc2626', textColor: '#ffffff', size: 'md' },
    live: { enabled: false, label: 'LIVE', min: 0, max: 0, realVisitors: false, position: 'tr', theme: 'red', bg: '#dc2626', textColor: '#ffffff', blink: '#fef444' },
    ads: [],
    exitIntent: { enabled: false, title: 'Espere! Não vá embora', text: 'Você está prestes a perder uma oportunidade única.', buttonText: 'Quero aproveitar', buttonUrl: '#', once: true, bg: '#111631', buttonBg: '#6c5ce7', buttonTextColor: '#ffffff' },
    lead: { enabled: false, at: 10, buttonText: 'Continuar assistindo', title: 'Receba acesso exclusivo', subtitle: 'Preencha para continuar assistindo', bg: '#2a2a2a', buttonBg: '#7440B6', privacyUrl: '' },
    tracking: { pixel: '', gtm: '', pageView: true, play: true, progress: true, ctaClick: true },
    domains: { allowed: '', blockDevTools: true },
    ...over,
  }
}

function seed() {
  const workspace = { id: 'ws_personal', name: 'Meu espaço de trabalho', role: 'ADMIN', initials: 'ME' }
  return {
    workspaces: [workspace],
    activeWorkspace: workspace.id,
    user: { name: '', email: '', plan: 'Sem plano', twoFA: false, recoveryCodes: [], company: '' },
    session: null,
    players: [],
    leads: [],
    events: [],
    notifications: [],
  }
}

export function emptyAccountState(session, user = {}) {
  const blank = seed()
  return { ...blank, session, user: { ...blank.user, ...user } }
}

const DEMO_PLAYER_IDS = new Set(['ply_vendas', 'ply_odonto', 'ply_shorts'])
const DEMO_LEAD_EMAILS = new Set([
  'mariana.souza@email.com', 'rafael.lima@empresa.com.br',
  'camila.ferreira@gmail.com', 'bruno.almeida@outlook.com',
])

// Limpa as fixtures conhecidas do template antigo, inclusive quando IDs aleatórios foram salvos localmente.
export function cleanDemoState(source) {
  const s = source && typeof source === 'object' ? source : seed()
  const originalWorkspaces = Array.isArray(s.workspaces) ? s.workspaces : []
  const demoWorkspaceIds = new Set(originalWorkspaces.filter(w =>
    ['ws_odonto', 'ws_demo'].includes(String(w.id || '').toLowerCase()) || /^(odonto care|demo vsl)$/i.test(String(w.name || '').trim())
  ).map(w => w.id))
  const demoPlayerName = p => /^(vsl\s+odonto\s+care\b|player\s+p[aá]gina\s+de\s+vendas\b|vsl\s+de\s+vendas\s+demo\b)/i.test(String(p.name || '').trim())
  const allPlayers = Array.isArray(s.players) ? s.players : []
  const removedPlayerIds = new Set(allPlayers.filter(p => DEMO_PLAYER_IDS.has(p.id) || demoWorkspaceIds.has(p.workspaceId) || demoPlayerName(p)).map(p => p.id))
  const players = allPlayers.filter(p => !removedPlayerIds.has(p.id))
  const leads = (Array.isArray(s.leads) ? s.leads : []).filter(l => !removedPlayerIds.has(l.playerId) && !DEMO_LEAD_EMAILS.has(String(l.email || '').toLowerCase()))
  const events = (Array.isArray(s.events) ? s.events : []).filter(e => !removedPlayerIds.has(e.playerId))
  let workspaces = originalWorkspaces.filter(w => !demoWorkspaceIds.has(w.id))
  if (!workspaces.length) workspaces = [seed().workspaces[0]]
  const user = { ...(s.user || seed().user) }
  if (user.name === 'João Vitor' && user.email === 'joao@veturb.com.br' && user.company === 'vêTurb Studio') {
    user.name = ''; user.email = ''; user.company = ''
  }
  if (['Start', 'Pro', 'Agência'].includes(user.plan) && !user.subscriptionId) user.plan = 'Sem plano'
  const session = s.session?.email === 'joao@veturb.com.br' ? null : (s.session || null)
  const notifications = (Array.isArray(s.notifications) ? s.notifications : []).filter(n =>
    !['Novo lead capturado', 'Meta de conversão batida'].includes(n.title))
  const activeWorkspace = workspaces.some(w => w.id === s.activeWorkspace) ? s.activeWorkspace : workspaces[0].id
  return { ...s, workspaces, activeWorkspace, user, session, players, leads, events, notifications }
}

let state
try {
  const raw = localStorage.getItem(KEY)
  state = raw ? cleanDemoState(JSON.parse(raw)) : seed()
  if (raw) localStorage.setItem(KEY, JSON.stringify(state))
} catch { state = seed() }

const listeners = new Set()
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota */ }
  scheduleCloudSync(state)
  listeners.forEach(l => l())
}
export function getState() { return state }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function useDB() { return useSyncExternalStore(subscribe, getState, getState) }

export function update(fnOrPatch) {
  const next = typeof fnOrPatch === 'function' ? fnOrPatch(state) : fnOrPatch
  state = next ? { ...state, ...next } : state
  persist()
  return state
}

// ---- API de domínio ----
export const playersOf = (s, wid) => s.players.filter(p => p.workspaceId === wid)
export const playerById = (s, id) => s.players.find(p => p.id === id)
export const leadsOf = (s, wid) => {
  const ids = new Set(playersOf(s, wid).map(p => p.id))
  return s.leads.filter(l => ids.has(l.playerId))
}
export const eventsOf = (s, wid) => {
  const ids = new Set(playersOf(s, wid).map(p => p.id))
  return s.events.filter(e => ids.has(e.playerId))
}

export function savePlayer(player) {
  update(s => {
    const exists = s.players.some(p => p.id === player.id)
    return { players: exists ? s.players.map(p => p.id === player.id ? player : p) : [player, ...s.players] }
  })
}

export function deletePlayer(id) {
  update(s => ({ players: s.players.filter(p => p.id !== id) }))
}

export function duplicatePlayer(id) {
  update(s => {
    const p = playerById(s, id)
    if (!p) return {}
    const copy = { ...structuredClone(p), id: uid('ply'), name: `${p.name} (cópia)`, createdAt: Date.now(), views: 0, plays: 0, ctaClicks: 0, conversions: 0 }
    return { players: [copy, ...s.players] }
  })
}

export function addLead(lead, { trackConversion = true } = {}) {
  const l = { id: uid('ld'), createdAt: Date.now(), ...lead }
  update(s => ({ leads: [l, ...s.leads] }))
  if (trackConversion) logEvent(lead.playerId, 'conversion')
  incrementPlayer(lead.playerId, 'conversions')
  return l
}

export function logEvent(playerId, type, extra = {}) {
  const e = { ts: Date.now(), playerId, type, ...extra }
  update(s => {
    const events = [...s.events, e]
    return { events: events.length > 6000 ? events.slice(-5000) : events }
  })
  if (supabaseConfigured && type !== 'conversion') {
    supabase.functions.invoke('track-player', { body: { playerId, eventType: type, pct: extra.pct } })
      .then(({ error }) => { if (error) console.warn('Não foi possível registrar evento do player:', error.message) })
      .catch(error => console.warn('Não foi possível registrar evento do player:', error.message))
  }
  // Integrações reais (quando o script do Pixel/GTM estiver presente na página)
  try {
    const p = playerById(getState(), playerId)
    const map = { view: 'PageView', play: 'PlayerPlay', progress: 'PlayerProgress', cta: 'PlayerCtaClick', conversion: 'PlayerLead' }
    if (p?.tracking?.pixel && typeof window.fbq === 'function') window.fbq('trackCustom', map[type] || type, { player_id: playerId, ...extra })
    if (p?.tracking?.gtm) {
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({ event: { view: 'page_view', play: 'player_play', progress: 'player_progress', cta: 'player_cta_click', conversion: 'player_lead' }[type] || type, player_id: playerId, ...extra })
    }
  } catch { /* ambiente sem os scripts */ }
  return e
}

export function incrementPlayer(id, field) {
  update(s => ({ players: s.players.map(p => p.id === id ? { ...p, [field]: (p[field] || 0) + 1 } : p) }))
}

export function resetDemo() { state = seed(); persist() }

export function aggregate(events, days = 14) {
  const out = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let d = days - 1; d >= 0; d--) {
    const start = today.getTime() - d * 864e5
    const end = start + 864e5
    const evs = events.filter(e => e.ts >= start && e.ts < end)
    const count = t => evs.filter(e => e.type === t).reduce((a, e) => a + (e.n || 1), 0)
    out.push({
      date: new Date(start), label: new Date(start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      views: count('view'), plays: count('play'), cta: count('cta'), conversions: count('conversion'), progress: count('progress'),
    })
  }
  return out
}

export function retentionCurve(events) {
  const buckets = Array.from({ length: 10 }, () => 0)
  const prog = events.filter(e => e.type === 'progress' && typeof e.pct === 'number')
  if (!prog.length) return buckets.map(() => 0)
  prog.forEach(e => { const i = Math.min(9, Math.floor(e.pct / 10)); buckets[i]++ })
  return buckets.map(v => Math.round((v / prog.length) * 100))
}

export function retentionRate(events) {
  const prog = events.filter(e => e.type === 'progress' && typeof e.pct === 'number')
  if (!prog.length) return 0
  return prog.reduce((a, b) => a + b.pct, 0) / prog.length
}
