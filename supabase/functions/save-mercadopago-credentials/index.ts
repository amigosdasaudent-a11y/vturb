import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const authorization = req.headers.get('Authorization')
  if (!authorization) return reply({ error: 'Sessão administrativa necessária.' }, 401)
  try {
    const body = await req.json()
    const publicKey = typeof body.publicKey === 'string' ? body.publicKey.trim() : ''
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
    if (publicKey.length < 10 || publicKey.length > 255 || accessToken.length < 20 || accessToken.length > 500) return reply({ error: 'Confira a Public Key e o Access Token.' }, 400)
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) return reply({ error: 'Sessão inválida.' }, 401)
    const { error } = await client.rpc('veturb_store_mp_credentials', { p_public_key: publicKey, p_access_token: accessToken })
    if (error) {
      if (error.code === '42501') return reply({ error: 'Esta conta não tem permissão de administrador da plataforma.' }, 403)
      return reply({ error: 'Não foi possível guardar as credenciais com segurança.' }, 400)
    }
    return reply({ ok: true })
  } catch { return reply({ error: 'Pedido inválido.' }, 400) }
})
