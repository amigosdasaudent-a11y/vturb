import React, { useMemo, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { aggregate, eventsOf, playersOf, retentionRate, fmt, pct, fmtDate } from '../lib/db.js'
import { Btn, StatCard, LineChart, BarChart, Badge, ProgressRing } from '../components/ui.jsx'

export default function Dashboard() {
  const { db, navigate, showToast } = useApp()
  const players = playersOf(db, db.activeWorkspace)
  const events = useMemo(() => eventsOf(db, db.activeWorkspace), [db])
  const [range, setRange] = useState(14)
  const days = aggregate(events, 30).slice(-range)
  const views = days.reduce((a, b) => a + b.views, 0)
  const plays = days.reduce((a, b) => a + b.plays, 0)
  const ctas = days.reduce((a, b) => a + b.cta, 0)
  const conv = days.reduce((a, b) => a + b.conversions, 0)
  const retention = retentionRate(events)
  const leads = db.leads.filter(l => players.some(p => p.id === l.playerId))

  const viewSeries = days.map(d => d.views)
  const convSeries = days.map(d => d.conversions)
  const labels = days.map(d => d.label)
  const prev = (arr) => { const a = arr.slice(0, Math.floor(arr.length / 2)).reduce((x, y) => x + y, 0), b = arr.slice(Math.floor(arr.length / 2)).reduce((x, y) => x + y, 0); return a ? Math.round(((b - a) / a) * 100) : 0 }

  const recent = [...events].sort((a, b) => b.ts - a.ts).slice(0, 8)
  const evtLabel = { view: 'Visualização', play: 'Play no player', progress: 'Progresso do vídeo', cta: 'Clique no CTA', conversion: 'Conversão / lead' }
  const evtIcon = { view: 'eye', play: 'play', progress: 'chart', cta: 'target', conversion: 'users' }

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Indicadores calculados a partir dos eventos registrados pelos seus players.</p></div>
        <div className="head-actions">
          <div className="seg-range">{[7, 14, 30].map(r => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}d</button>)}</div>
          <Btn variant="primary" icon="plus" onClick={() => navigate('/players/new')}>Novo Player</Btn>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="eye" label="Visualizações" value={fmt(views)} delta={prev(viewSeries)} tone="blue" spark={viewSeries} />
        <StatCard icon="playOutline" label="Plays" value={fmt(plays)} delta={prev(days.map(d => d.plays))} tone="green" spark={days.slice(-range).map(d => d.plays)} />
        <StatCard icon="target" label="Cliques nos CTAs" value={fmt(ctas)} delta={prev(days.map(d => d.cta))} tone="purple" spark={days.slice(-range).map(d => d.cta)} />
        <StatCard icon="users" label="Conversões / Leads" value={fmt(conv)} delta={prev(convSeries)} tone="orange" spark={convSeries} />
      </div>

      <div className="dash-grid">
        <div className="card chart-card wide">
          <div className="card-head"><div><h3>Visualizações & plays</h3><p>Últimos {range} dias</p></div><Badge tone="neutral">Período selecionado</Badge></div>
          <div className="dual-legend"><span><i style={{ background: '#7440B6' }} /> Visualizações</span><span><i style={{ background: '#22c55e' }} /> Plays</span></div>
          <div className="dual-chart">
            <LineChart series={viewSeries} labels={labels} color="#7440B6" height={230} maxValue={Math.max(...viewSeries, ...days.slice(-range).map(d => d.plays), 1)} />
            <div className="chart-overlay-green"><LineChart series={days.slice(-range).map(d => d.plays)} labels={labels} color="#22c55e" fill={false} height={230} bare maxValue={Math.max(...viewSeries, ...days.slice(-range).map(d => d.plays), 1)} /></div>
          </div>
        </div>
        <div className="card retention-card">
          <div className="card-head"><div><h3>Retenção média</h3><p>Do seu público</p></div></div>
          <div className="retention-ring"><ProgressRing value={retention} size={124} color="#7440B6" label="conclusão" /></div>
          <div className="retention-mini">
            <div><span>Taxa de play</span><strong>{pct(views ? (plays / views) * 100 : 0)}</strong></div>
            <div><span>CTR do CTA</span><strong>{pct(plays ? (ctas / plays) * 100 : 0)}</strong></div>
            <div><span>Conversão</span><strong>{pct(ctas ? (conv / ctas) * 100 : 0)}</strong></div>
          </div>
        </div>
      </div>

      <div className="dash-grid bottom">
        <div className="card">
          <div className="card-head"><div><h3>Conversões por dia</h3><p>Leads gerados pelos players</p></div><Icon name="trending" size={18} className="muted" /></div>
          <BarChart series={convSeries} labels={labels} color="#22c55e" height={190} />
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Atividade recente</h3><p>Eventos de tracking</p></div><button className="link-btn" onClick={() => navigate('/metrics')}>Ver tudo</button></div>
          <div className="activity-list">
            {recent.map((e, i) => {
              const p = db.players.find(x => x.id === e.playerId)
              return <div className="activity-item" key={i}>
                <span className={`activity-icon ev-${e.type}`}><Icon name={evtIcon[e.type] || 'info'} size={15} /></span>
                <div><strong>{evtLabel[e.type] || e.type}</strong><small>{p?.name || 'Player removido'}{typeof e.pct === 'number' ? ` · ${e.pct}% assistido` : ''}</small></div>
                <time>{new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            })}
          </div>
        </div>
      </div>

      <div className="card quick-card">
        <div className="card-head"><div><h3>Comece agora</h3><p>6 passos para publicar sua primeira VSL</p></div><Btn variant="ghost" size="sm" iconRight="arrowRight" onClick={() => navigate('/players/new')}>Criar player</Btn></div>
        <div className="steps">
          {[['settings','Crie seu player'],['palette','Configure aparência e controles'],['target','Adicione CTAs inteligentes'],['chart','Configure Pixel e GTM'],['code','Gere o código de incorporação'],['external','Publique em qualquer página']].map(([i, t], n) => <div className="step" key={t}><span className="step-num">{n + 1}</span><Icon name={i} size={17} /><span>{t}</span></div>)}
        </div>
      </div>
    </div>
  )
}
