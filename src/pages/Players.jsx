import React, { useMemo, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { playersOf, playerById, fmt, fmtDate, deletePlayer, duplicatePlayer, update, youtubeId, defaultPlayer, savePlayer, embedBase } from '../lib/db.js'
import { Btn, Input, Select, Modal, Badge, EmptyState, CopyBox, Toggle } from '../components/ui.jsx'

export default function Players() {
  const { db, navigate, showToast } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [embed, setEmbed] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [menu, setMenu] = useState(null)
  const players = useMemo(() => playersOf(db, db.activeWorkspace).filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) && (filter === 'all' || p.orientation === filter)
  ), [db, q, filter])

  const origin = embedBase()
  const iframeCode = p => `<div style="position:relative;width:100%;max-width:${p.orientation === 'vertical' ? '420px' : '960px'};aspect-ratio:${p.orientation === 'vertical' ? '9/16' : '16/9'};">\n  <iframe src="${origin}#/embed/${p.id}" title="${p.name}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" allow="autoplay; fullscreen; encrypted-media" allowfullscreen loading="lazy"></iframe>\n</div>`
  const directLink = p => `${origin}#/p/${p.id}`

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Players Dinâmicos</h1><p>Crie, personalize e incorpore seus players de vídeo.</p></div>
        <Btn variant="primary" icon="plus" onClick={() => navigate('/players/new')}>Novo Player</Btn>
      </div>

      <div className="card toolbar">
        <div className="search-input"><Icon name="search" size={17} /><Input value={q} onChange={setQ} placeholder="Buscar player pelo nome..." /></div>
        <div className="toolbar-right">
          <Select value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos os formatos' }, { value: 'horizontal', label: 'Horizontal 16:9' }, { value: 'vertical', label: 'Vertical 9:16' }]} />
          <span className="toolbar-count">{players.length} {players.length === 1 ? 'player' : 'players'}</span>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="card"><EmptyState icon="film" title="Nenhum player encontrado" text="Crie seu primeiro player para começar a converter com VSLs inteligentes." action={<Btn variant="primary" icon="plus" onClick={() => navigate('/players/new')}>Criar Novo Player</Btn>} /></div>
      ) : (
        <div className="player-grid">
          {players.map(p => (
            <div className="player-card" key={p.id}>
              <div className="player-thumb" style={{ background: `linear-gradient(135deg, ${p.appearance.bg}, ${p.appearance.accent})` }} onClick={() => navigate(`/players/${p.id}/edit`)}>
                {(p.posterUrl || (p.videoType === 'youtube' && youtubeId(p.videoUrl))) && <img src={p.posterUrl || `https://img.youtube.com/vi/${youtubeId(p.videoUrl)}/hqdefault.jpg`} alt="Miniatura do vídeo" onError={e => { if (!p.posterUrl && e.currentTarget.dataset.fallback !== '1') { e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = `https://img.youtube.com/vi/${youtubeId(p.videoUrl)}/mqdefault.jpg` } else e.currentTarget.style.display = 'none' }} />}
                <div className="player-thumb-veil" />
                <span className="thumb-orient"><Icon name={p.orientation === 'vertical' ? 'monitor' : 'film'} size={14} /> {p.orientation === 'vertical' ? '9:16' : '16:9'}</span>
                <span className="thumb-play"><Icon name="play" size={20} /></span>
                <div className="thumb-badges">
                  {p.live.enabled && <span className="tb-live">LIVE</span>}
                  {p.cta.enabled && <span className="tb-cta"><Icon name="target" size={11} /> CTA</span>}
                  {p.lead.enabled && <span className="tb-lead"><Icon name="users" size={11} /> Lead</span>}
                </div>
              </div>
              <div className="player-card-body">
                <div className="player-card-title"><h3>{p.name || 'Sem nome'}</h3><Badge tone={p.status === 'active' ? 'green' : 'neutral'}>{p.status === 'active' ? 'Ativo' : 'Rascunho'}</Badge></div>
                <p className="player-card-url"><Icon name="link" size={13} /> {(p.videoType === 'gumlet' ? (p.gumletHlsUrl || p.gumletMp4Url || p.gumletShareUrl) : p.videoUrl) || 'Nenhum vídeo configurado'}</p>
                <div className="player-stats">
                  <div><Icon name="eye" size={14} /><strong>{fmt(p.views)}</strong><span>views</span></div>
                  <div><Icon name="playOutline" size={14} /><strong>{fmt(p.plays)}</strong><span>plays</span></div>
                  <div><Icon name="target" size={14} /><strong>{fmt(p.ctaClicks)}</strong><span>CTAs</span></div>
                  <div><Icon name="users" size={14} /><strong>{fmt(p.conversions)}</strong><span>leads</span></div>
                </div>
                <div className="player-card-foot">
                  <small><Icon name="calendar" size={12} /> {fmtDate(p.createdAt)}</small>
                  <div className="foot-actions">
                    <Btn size="sm" variant="ghost" icon="code" onClick={() => setEmbed(p)}>Incorporar</Btn>
                    <Btn size="sm" variant="outline" icon="edit" onClick={() => navigate(`/players/${p.id}/edit`)}>Editar</Btn>
                    <div className="menu-wrap">
                      <button className="icon-btn" onClick={() => setMenu(menu === p.id ? null : p.id)}><Icon name="more" size={17} /></button>
                      {menu === p.id && <div className="dropdown">
                        <button onClick={() => { window.open(directLink(p), '_blank'); setMenu(null) }}><Icon name="external" size={15} /> Abrir player público</button>
                        <button onClick={() => { duplicatePlayer(p.id); setMenu(null); showToast('Player duplicado com sucesso') }}><Icon name="copy" size={15} /> Duplicar</button>
                        <button onClick={() => { update(s => ({ players: s.players.map(x => x.id === p.id ? { ...x, status: x.status === 'active' ? 'draft' : 'active' } : x) })); setMenu(null) }}><Icon name="refresh" size={15} /> {p.status === 'active' ? 'Desativar' : 'Ativar'}</button>
                        <button className="danger" onClick={() => { setConfirm(p); setMenu(null) }}><Icon name="trash" size={15} /> Excluir</button>
                      </div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!embed} onClose={() => setEmbed(null)} title="Opções de Incorporação" subtitle="Publique seu player em qualquer site, landing page ou funil." width={620}
        footer={<><Btn variant="ghost" onClick={() => setEmbed(null)}>Fechar</Btn><Btn variant="primary" icon="external" onClick={() => window.open(directLink(embed), '_blank')}>Abrir player</Btn></>}>
        {embed && <div className="embed-modal">
          <div className="embed-info"><Icon name="zap" size={17} /><span><strong>Rota de embed ultra rápida.</strong> Sem scripts desnecessários, sem banner de cookies — carregamento otimizado para conversão.</span></div>
          <CopyBox label="CÓDIGO IFRAME RESPONSIVO" value={iframeCode(embed)} hint="Compatível com WordPress, HTML puro, landing pages e funis de vendas." />
          <CopyBox label="LINK DIRETO" value={directLink(embed)} />
          <div className="embed-tech"><div><Icon name="monitor" size={16} /><strong>Responsivo</strong><span>16:9 / 9:16</span></div><div><Icon name="bolt" size={16} /><strong>Rápido</strong><span>Edge ready</span></div><div><Icon name="shield" size={16} /><strong>Seguro</strong><span>Domínios permitidos</span></div></div>
        </div>}
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Excluir player?" subtitle="Esta ação não pode ser desfeita." width={420}
        footer={<><Btn variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Btn><Btn variant="danger" icon="trash" onClick={() => { deletePlayer(confirm.id); setConfirm(null); showToast('Player excluído') }}>Excluir</Btn></>}>
        <p className="muted-text">O player <strong>{confirm?.name}</strong> será removido. Os leads já capturados permanecem na sua conta.</p>
      </Modal>
    </div>
  )
}
