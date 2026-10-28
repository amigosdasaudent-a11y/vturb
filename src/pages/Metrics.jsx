import React, { useMemo, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { playersOf, eventsOf, aggregate, retentionCurve, retentionRate, fmt, pct, fmtDateTime } from '../lib/db.js'
import { Btn, Select, LineChart, BarChart, StatCard, ProgressRing, Badge, EmptyState } from '../components/ui.jsx'

export default function Metrics() {
  const { db, showToast } = useApp()
  const players = playersOf(db, db.activeWorkspace)
  const [playerFilter, setPlayerFilter] = useState('all')
  const [range, setRange] = useState(14)
  const allEvents = useMemo(() => eventsOf(db, db.activeWorkspace), [db])
  const events = playerFilter === 'all' ? allEvents : allEvents.filter(e => e.playerId === playerFilter)
  const days = aggregate(events, 14).slice(-range)
  const labels = days.map(d => d.label)
  const retention = retentionCurve(events)
  const avg = retentionRate(events)
  const views = days.reduce((a, b) => a + b.views, 0)
  const plays = days.reduce((a, b) => a + b.plays, 0)
  const ctas = days.reduce((a, b) => a + b.cta, 0)
  const conv = days.reduce((a, b) => a + b.conversions, 0)
  const exportCSV = () => {
    const rows = [['Data', 'Visualizações', 'Plays', 'Cliques CTA', 'Conversões'], ...days.map(d => [d.date.toLocaleDateString('pt-BR'), d.views, d.plays, d.cta, d.conversions])]
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `veturb-metricas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    showToast('Relatório CSV baixado.')
  }

  const funnel = [
    { label: 'Visualizações', value: views, color: '#3b82f6' },
    { label: 'Plays', value: plays, color: '#7440B6' },
    { label: 'Cliques no CTA', value: ctas, color: '#f59e0b' },
    { label: 'Conversões', value: conv, color: '#22c55e' },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Métricas</h1><p>Visualizações, retenção, cliques e conversões dos eventos registrados pelos seus players.</p></div>
        <div className="head-actions">
          <Select value={playerFilter} onChange={setPlayerFilter} options={[{ value: 'all', label: 'Todos os players' }, ...players.map(p => ({ value: p.id, label: p.name }))]} />
          <div className="seg-range">{[7, 14].map(r => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}d</button>)}</div>
          <Btn variant="outline" icon="download" onClick={exportCSV}>Exportar CSV</Btn>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="eye" label="Visualizações" value={fmt(views)} tone="blue" spark={days.map(d => d.views)} />
        <StatCard icon="playOutline" label="Plays" value={fmt(plays)} tone="purple" spark={days.map(d => d.plays)} />
        <StatCard icon="chart" label="Retenção média" value={pct(avg)} tone="green" spark={retention} />
        <StatCard icon="users" label="Conversões" value={fmt(conv)} tone="orange" spark={days.map(d => d.conversions)} />
      </div>

      <div className="card chart-card">
        <div className="card-head"><div><h3>Visualizações e plays</h3><p>Comparativo diário · últimos {range} dias</p></div><div className="dual-legend"><span><i style={{ background: '#7440B6' }} /> Views</span><span><i style={{ background: '#22c55e' }} /> Plays</span></div></div>
        <div className="dual-chart"><LineChart series={days.map(d => d.views)} labels={labels} color="#7440B6" height={230} maxValue={Math.max(...days.map(d => d.views), ...days.map(d => d.plays), 1)} /><div className="chart-overlay-green"><LineChart series={days.map(d => d.plays)} labels={labels} color="#22c55e" fill={false} height={230} bare maxValue={Math.max(...days.map(d => d.views), ...days.map(d => d.plays), 1)} /></div></div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><div><h3>Curva de retenção</h3><p>% do público por trecho assistido</p></div><Badge tone="purple">{pct(avg)} média</Badge></div>
          <div className="retention-bars">{retention.map((v, i) => <div className="rbar" key={i}><span style={{ height: `${v}%`, background: `linear-gradient(180deg,#7440B6,#a78bfa)`, opacity: 1 - i * .045 }} title={`${v}%`} /><small>{i * 10}%</small></div>)}</div>
          <div className="retention-axis">Progresso assistido no vídeo</div>
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Funil de conversão</h3><p>Da visualização ao lead</p></div></div>
          <div className="funnel">{funnel.map((f, i) => <div className="funnel-row" key={f.label}><div className="funnel-label"><span>{f.label}</span><strong>{fmt(f.value)}</strong></div><div className="funnel-track"><div style={{ width: `${Math.max(3, (f.value / (funnel[0].value || 1)) * 100)}%`, background: f.color }} /></div>{i > 0 && <small>{pct(funnel[i - 1].value ? (f.value / funnel[i - 1].value) * 100 : 0)} do anterior</small>}</div>)}</div>
          <div className="ring-row"><ProgressRing value={100 - avg} size={82} color="#22c55e" label="abandono" /><p>Taxa de abandono estimada.<br />Otimize o início do vídeo para reter mais.</p></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Performance por player</h3><p>Comparativo consolidado</p></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>PLAYER</th><th>VIEWS</th><th>PLAYS</th><th>TAXA DE PLAY</th><th>CLIQUES CTA</th><th>CONVERSÕES</th><th>STATUS</th></tr></thead>
          <tbody>{players.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small className="block muted-text">{p.orientation === 'vertical' ? 'Vertical 9:16' : 'Horizontal 16:9'}</small></td><td>{fmt(p.views)}</td><td>{fmt(p.plays)}</td><td>{pct(p.views ? (p.plays / p.views) * 100 : 0)}</td><td>{fmt(p.ctaClicks)}</td><td>{fmt(p.conversions)}</td><td><Badge tone={p.status === 'active' ? 'green' : 'neutral'}>{p.status === 'active' ? 'Ativo' : 'Rascunho'}</Badge></td></tr>)}</tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Log de eventos de tracking</h3><p>Facebook Pixel · Google Tag Manager (dataLayer)</p></div><Badge tone="neutral">Eventos registrados</Badge></div>
        <div className="event-log">
          {[...events].sort((a, b) => b.ts - a.ts).slice(0, 12).map((e, i) => <div className="log-line" key={i}><span className={`log-dot ev-${e.type}`} /><time>{fmtDateTime(e.ts)}</time><code>{({ view: 'PageView', play: 'PlayerPlay', progress: 'PlayerProgress', cta: 'PlayerCtaClick', conversion: 'PlayerLead' })[e.type]}</code><span className="log-player">{db.players.find(p => p.id === e.playerId)?.name || '—'}</span>{typeof e.pct === 'number' && <span className="log-pct">{e.pct}%</span>}</div>)}
          {events.length === 0 && <EmptyState icon="chart" title="Nenhum evento ainda" text="Abra um player público para começar a gerar eventos." />}
        </div>
      </div>
    </div>
  )
}
