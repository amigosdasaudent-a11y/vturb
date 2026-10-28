import React, { useMemo, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { playersOf, leadsOf, fmtDateTime, fmt, update } from '../lib/db.js'
import { getCloudState, supabase, supabaseConfigured } from '../lib/supabase.js'
import { Btn, Input, Select, Badge, EmptyState, Modal } from '../components/ui.jsx'

export default function Leads() {
  const { db, showToast } = useApp()
  const players = playersOf(db, db.activeWorkspace)
  const [q, setQ] = useState('')
  const [playerFilter, setPlayerFilter] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const all = useMemo(() => leadsOf(db, db.activeWorkspace), [db])
  const leads = all.filter(l =>
    (playerFilter === 'all' || l.playerId === playerFilter) &&
    (`${l.name} ${l.email} ${l.whatsapp || ''}`.toLowerCase().includes(q.toLowerCase()))
  )

  const refreshLeads = async () => {
    if (!supabaseConfigured) { showToast('Os dados locais já estão atualizados.'); return }
    try {
      const remote = await getCloudState()
      if (remote) update(remote)
      showToast('Leads e eventos sincronizados.')
    } catch (error) { showToast(error.message || 'Não foi possível atualizar a lista.', 'error') }
  }

  const deleteLead = async () => {
    if (supabaseConfigured) {
      const { error } = await supabase.from('veturb_leads').delete().eq('id', confirm.id)
      if (error) { showToast(error.message || 'Não foi possível excluir o lead.', 'error'); return }
    }
    update(s => ({ leads: s.leads.filter(l => l.id !== confirm.id) }))
    setConfirm(null)
    showToast('Lead excluído.')
  }

  const exportCSV = () => {
    const rows = [['Nome', 'E-mail', 'WhatsApp', 'Player', 'Data'], ...leads.map(l => [l.name, l.email, l.whatsapp || '', db.players.find(p => p.id === l.playerId)?.name || '', new Date(l.createdAt).toLocaleString('pt-BR')])]
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `veturb-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    showToast(`${leads.length} leads exportados em CSV`)
  }

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Leads Capturados <Badge tone="green">{leads.length} de {all.length} leads</Badge></h1><p>Gerencie e exporte os leads que preencheram o formulário de captura nos seus players de vídeo.</p></div>
        <div className="head-actions"><Btn variant="outline" icon="refresh" onClick={refreshLeads}>Atualizar</Btn><Btn variant="primary" icon="download" onClick={exportCSV}>Exportar CSV</Btn></div>
      </div>

      <div className="card toolbar leads-toolbar">
        <div className="search-input wide"><Icon name="search" size={17} /><Input value={q} onChange={setQ} placeholder="Buscar por nome, e-mail ou WhatsApp..." /></div>
        <div className="toolbar-right"><span className="filter-label"><Icon name="filter" size={15} /> Player:</span><Select value={playerFilter} onChange={setPlayerFilter} options={[{ value: 'all', label: 'Todos os Players' }, ...players.map(p => ({ value: p.id, label: p.name }))]} /></div>
      </div>

      <div className="card leads-table-card">
        {leads.length === 0 ? <EmptyState icon="users" title="Nenhum lead encontrado" text="Nenhum lead capturado atende aos critérios de busca ou nenhum formulário foi preenchido ainda." /> : (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>NOME</th><th>E-MAIL</th><th>WHATSAPP</th><th>PLAYER</th><th>CAPTURADO EM</th><th></th></tr></thead>
            <tbody>{leads.map(l => <tr key={l.id}>
              <td><div className="lead-name"><span className="lead-avatar">{(l.name || 'L').slice(0, 2).toUpperCase()}</span><strong>{l.name}</strong></div></td>
              <td><span className="lead-mail"><Icon name="mail" size={14} />{l.email}</span></td>
              <td>{l.whatsapp ? <span className="lead-wpp"><Icon name="whatsapp" size={14} />{l.whatsapp}</span> : <span className="muted-text">—</span>}</td>
              <td><Badge tone="purple">{db.players.find(p => p.id === l.playerId)?.name || '—'}</Badge></td>
              <td className="muted-text">{fmtDateTime(l.createdAt)}</td>
              <td><button className="icon-btn danger" onClick={() => setConfirm(l)} title="Excluir"><Icon name="trash" size={16} /></button></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>

      <div className="leads-info-row">
        <div className="mini-card"><Icon name="users" size={18} /><div><strong>{fmt(all.length)}</strong><span>Total de leads</span></div></div>
        <div className="mini-card"><Icon name="calendar" size={18} /><div><strong>{all.filter(l => Date.now() - l.createdAt < 864e5).length}</strong><span>Últimas 24h</span></div></div>
        <div className="mini-card"><Icon name="target" size={18} /><div><strong>{players.length}</strong><span>Players com captura</span></div></div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Excluir lead?" width={400} footer={<><Btn variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Btn><Btn variant="danger" onClick={deleteLead}>Excluir</Btn></>}>
        <p className="muted-text">O lead <strong>{confirm?.name}</strong> ({confirm?.email}) será removido permanentemente.</p>
      </Modal>
    </div>
  )
}
