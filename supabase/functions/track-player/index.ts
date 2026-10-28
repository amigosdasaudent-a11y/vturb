import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function domainAllowed(origin: string | null, raw: unknown) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : []
  const allowed = list.map(x => String(x).trim().toLowerCase()).filter(Boolean)
  if (!allowed.length) return true
  if (!origin) return false
  let host = ''
  try { host = new URL(origin).hostname.toLowerCase() } catch { return false }
  return allowed.some(item => {
    let domain = item
    try { if (item.includes('://')) domain = new URL(item).hostname } catch { return false }
    domain = domain.replace(/^\*\./, '').split('/')[0].split(':')[0]
    return host === domain || host.endsWith(`.${domain}`)
  })
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.json()
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : ''
    const eventType = body.eventType
    if (!/^ply_[a-zA-Z0-9_-]{3,80}$/.test(playerId) || !['view', 'play', 'progress', 'cta'].includes(eventType)) return reply({ error: 'Invalid event' }, 400)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { data: player, error: playerError } = await supabase.from('veturb_public_players').select('owner_id, config').eq('player_id', playerId).eq('published', true).maybeSingle()
    if (playerError || !player) return reply({ error: 'Player not found' }, 404)
    if (!domainAllowed(req.headers.get('origin'), player.config?.domains?.allowed)) return reply({ error: 'Origin not allowed' }, 403)
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limited = await supabase.rpc('consume_veturb_rate_limit', { p_key: await digest(`${playerId}:${ip}`), p_max: 90, p_window_seconds: 60 })
    if (limited.error || limited.data !== true) return reply({ error: 'Rate limit exceeded' }, 429)
    const pct = eventType === 'progress' ? Math.max(0, Math.min(100, Math.round(Number(body.pct) || 0))) : null
    const { error } = await supabase.from('veturb_events').insert({ owner_id: player.owner_id, player_id: playerId, event_type: eventType, pct, extra: {} })
    if (error) return reply({ error: 'Could not record event' }, 500)
    return reply({ ok: true })
  } catch { return reply({ error: 'Invalid request' }, 400) }
})
