import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { playerById, logEvent, addLead, incrementPlayer, defaultPlayer } from '../lib/db.js'
import { getPublicPlayer, supabase, supabaseConfigured } from '../lib/supabase.js'
import PlayerEngine from '../components/PlayerEngine.jsx'

export default function PublicPlayer({ path }) {
  const { db, navigate, showToast } = useApp()
  const isEmbed = path.startsWith('/embed/')
  const rawId = path.split('?')[0].split('/')[2]
  const previewParam = path.includes('preview=1')
  const [remotePlayer, setRemotePlayer] = useState(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState('')

  const localPlayer = useMemo(() => {
    if (rawId === 'preview') {
      try { const raw = localStorage.getItem('vt_draft_preview'); if (raw) return JSON.parse(raw) } catch {}
      return db.players[0] || defaultPlayer({ name: 'Pré-visualização' })
    }
    return playerById(db, rawId)
  }, [db, rawId])
  const player = localPlayer || remotePlayer

  useEffect(() => {
    let active = true
    setRemotePlayer(null); setRemoteError('')
    if (!rawId || rawId === 'preview' || localPlayer || !supabaseConfigured) return () => { active = false }
    setRemoteLoading(true)
    getPublicPlayer(rawId).then(remote => {
      if (active) { setRemotePlayer(remote); if (!remote) setRemoteError('Player não encontrado ou não publicado.') }
    }).catch(error => { if (active) setRemoteError(error.message || 'Não foi possível carregar este player.') })
      .finally(() => { if (active) setRemoteLoading(false) })
    return () => { active = false }
  }, [rawId, localPlayer])

  useEffect(() => { document.title = player ? `${player.name} — vêTurb Player` : 'vêTurb Player' }, [player?.name])

  const handleEvent = (type, extra = {}) => {
    if (!player || rawId === 'preview') return
    const gate = { view: 'pageView', play: 'play', progress: 'progress', cta: 'ctaClick', conversion: 'conversion' }[type]
    if (gate && player.tracking?.[gate] === false) return
    logEvent(player.id, type, extra)
    const field = { view: 'views', play: 'plays', cta: 'ctaClicks' }[type]
    if (field) incrementPlayer(player.id, field)
  }
  const handleLead = async data => {
    if (!player || rawId === 'preview') { showToast('Pré-visualização: este lead não foi salvo.'); return false }
    if (supabaseConfigured) {
      const { data: result, error } = await supabase.functions.invoke('capture-lead', { body: { playerId: player.id, ...data } })
      if (error || !result?.ok) { showToast(result?.error || error?.message || 'Não foi possível enviar o formulário.', 'error'); return false }
      if (db.session?.id) addLead({ ...data, id: result.leadId, createdAt: Date.parse(result.createdAt), playerId: player.id }, { trackConversion: false })
      showToast('Obrigado! Seus dados foram enviados com segurança.')
      return true
    }
    showToast('O envio de leads requer configuração do Supabase.', 'error')
    return false
  }

  if (!player && remoteLoading) return <div className="public-page"><div className="public-missing"><Icon name="loader" size={28} /><h2>Carregando player…</h2></div></div>
  if (!player) return (
    <div className="public-page"><div className="public-missing"><Icon name="alert" size={34} /><h2>{remoteError ? 'Player indisponível' : 'Player não encontrado'}</h2><p>{remoteError || 'Verifique o link de incorporação ou publique o player pelo painel.'}</p>{!isEmbed && <button onClick={() => navigate('/players')}>Ir para o painel</button>}</div></div>
  )

  const stage = (
    <div className={`public-stage ${player.orientation === 'vertical' ? 'is-vertical' : ''}`}>
      <PlayerEngine key={rawId} player={player} mode="public" previewParam={previewParam ? true : (rawId === 'preview')}
        onEvent={handleEvent} onLead={handleLead} />
    </div>
  )

  if (isEmbed) return <div className="embed-page">{stage}</div>

  // Link direto para anúncios/cliente: somente o player, sem painel, textos técnicos ou instruções.
  return <main className="public-player-only">{stage}</main>
}
