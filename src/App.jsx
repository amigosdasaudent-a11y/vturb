import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Logo } from './lib/icons.jsx'
import { Ctx, useApp } from './lib/ctx.jsx'
import { useDB, update, getState, playersOf, cleanDemoState, emptyAccountState } from './lib/db.js'
import { getCloudSession, getCloudState, setCloudReady, syncCloudState, supabase, supabaseConfigured } from './lib/supabase.js'
import { Modal, Btn, Toast, Badge } from './components/ui.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Players from './pages/Players.jsx'
import Builder from './pages/Builder.jsx'
import Leads from './pages/Leads.jsx'
import Metrics from './pages/Metrics.jsx'
import Plans from './pages/Plans.jsx'
import Profile from './pages/Profile.jsx'
import PublicPlayer from './pages/PublicPlayer.jsx'

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/dashboard')
  useEffect(() => {
    const fn = () => { setHash(window.location.hash.slice(1) || '/dashboard'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  const navigate = useCallback(path => {
    if (window.location.hash.slice(1) === path) return
    window.location.hash = path
    setHash(path)
    window.scrollTo(0, 0)
  }, [])
  return [hash, navigate]
}

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { path: '/profile', label: 'Meu perfil', icon: 'user' },
  { path: '/players', label: 'Players', icon: 'playOutline' },
  { path: '/leads', label: 'Leads', icon: 'users' },
  { path: '/metrics', label: 'Métricas', icon: 'chart' },
  { path: '/plans', label: 'Planos', icon: 'card' },
]

export default function App() {
  const db = useDB()
  const [path, navigate] = useHashRoute()
  const [toast, setToast] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [wsOpen, setWsOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [checkingCloud, setCheckingCloud] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) return
    let live = true
    ;(async () => {
      try {
        const session = await getCloudSession()
        if (!live) return
        if (!session?.user) {
          setCloudReady(true)
          update({ session: null })
          setCheckingCloud(false)
          return
        }
        const remote = await getCloudState()
        if (!live) return
        const cleanedRemote = remote ? cleanDemoState(remote) : null
        let twoFA = false
        try {
          const { data: factors } = await supabase.auth.mfa.listFactors()
          twoFA = (factors?.totp || []).some(f => f.status === 'verified')
        } catch {}
        const cloudUser = { id: session.user.id, email: session.user.email, since: session.user.created_at || Date.now() }
        if (cleanedRemote) update({ ...cleanedRemote, session: cloudUser, user: { ...cleanedRemote.user, email: session.user.email, twoFA } })
        else update(emptyAccountState(cloudUser, { email: session.user.email, name: session.user.user_metadata?.full_name || '', twoFA }))
        setCloudReady(true)
        if (!remote || JSON.stringify(cleanedRemote) !== JSON.stringify(remote)) await syncCloudState(getState())
      } catch (error) {
        console.error('Falha ao iniciar Supabase:', error)
        setCloudReady(false)
        update({ session: null })
        showToast?.('Não foi possível conectar ao Supabase. Confira a configuração.', 'error')
      } finally { if (live) setCheckingCloud(false) }
    })()
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((message, tone = 'success') => setToast({ message, tone, id: Date.now() }), [])
  const ctx = useMemo(() => ({ db, navigate, showToast, path }), [db, navigate, showToast, path])

  const isPublic = path.startsWith('/p/') || path.startsWith('/embed/')
  if (isPublic) {
    return <Ctx.Provider value={ctx}><PublicPlayer path={path} />{toast && <Toast key={toast.id} {...toast} onDone={() => setToast(null)} />}</Ctx.Provider>
  }
  if (checkingCloud) return <div className="cloud-loading"><Logo size={40} withText /><span>Conectando à sua conta segura…</span></div>
  if (!db.session) {
    return <Ctx.Provider value={ctx}><Auth />{toast && <Toast key={toast.id} {...toast} onDone={() => setToast(null)} />}</Ctx.Provider>
  }

  const ws = db.workspaces.find(w => w.id === db.activeWorkspace) || db.workspaces[0]
  const unread = db.notifications.filter(n => !n.read).length
  const current = NAV.find(n => path.startsWith(n.path)) || { label: 'Dashboard' }
  const isBuilder = path.startsWith('/players/new') || /^\/players\/[^/]+\/edit/.test(path)

  return (
    <Ctx.Provider value={ctx}>
      <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${isBuilder ? 'shell-builder' : ''}`}>
        <aside className="sidebar">
          <div className="side-brand"><Logo size={34} withText={!collapsed} /><span className="side-plan"><i />{!collapsed && (db.user.plan === 'Sem plano' ? 'SEM PLANO' : db.user.plan.toUpperCase())}</span></div>
          <div className="side-label">{!collapsed && 'NAVEGAÇÃO'}</div>
          <nav className="side-nav">
            {NAV.map(n => (
              <button key={n.path} className={`side-link ${path.startsWith(n.path) ? 'active' : ''}`} onClick={() => navigate(n.path)} title={n.label}>
                <Icon name={n.icon} size={19} />{!collapsed && <span>{n.label}</span>}
                {!collapsed && n.path === '/leads' && <span className="side-count">{db.leads.filter(l => playersOf(db, db.activeWorkspace).some(p => p.id === l.playerId)).length}</span>}
              </button>
            ))}
          </nav>
          <div className="side-spacer" />
          <div className="side-workspace">
            <button className="ws-btn" onClick={() => setWsOpen(v => !v)}>
              <span className="ws-avatar">{ws.initials}</span>
              {!collapsed && <span className="ws-copy"><strong>{ws.name}</strong><small>{ws.role}</small></span>}
              {!collapsed && <Icon name="chevronRight" size={15} />}
            </button>
            {wsOpen && <div className="ws-menu">
              <div className="ws-menu-title">TROCAR DE WORKSPACE</div>
              {db.workspaces.map(w => <button key={w.id} className={w.id === db.activeWorkspace ? 'active' : ''} onClick={() => { update({ activeWorkspace: w.id }); setWsOpen(false); showToast(`Workspace alterado para ${w.name}`) }}><span className="ws-avatar sm">{w.initials}</span>{w.name}{w.id === db.activeWorkspace && <Icon name="check" size={14} />}</button>)}
              <button className="ws-add" onClick={() => { const name = prompt('Nome do novo workspace:'); if (name) { update(s => ({ workspaces: [...s.workspaces, { id: `ws_${Date.now()}`, name, role: 'ADMIN', initials: name.slice(0,2).toUpperCase() }] })); showToast('Workspace criado') } }}><Icon name="plus" size={14} /> Novo workspace</button>
            </div>}
          </div>
          <div className="side-bottom">
            <button className="side-link" onClick={() => setCollapsed(v => !v)}><Icon name="menu" size={18} />{!collapsed && <span>Recolher Menu</span>}</button>
            <button className="side-link logout" onClick={async () => { if (supabase) await supabase.auth.signOut(); setCloudReady(false); update({ session: null }); navigate('/dashboard') }}><Icon name="logout" size={18} />{!collapsed && <span>Sair da conta</span>}</button>
          </div>
        </aside>

        <main className="main">
          {!isBuilder && (
            <header className="topbar">
              <div className="crumbs"><Icon name="home" size={15} /><span>Início</span><Icon name="chevronRight" size={13} /><strong>{current.label}</strong></div>
              <div className="top-actions">
                <div className="top-search"><Icon name="search" size={16} /><input placeholder="Buscar players, leads..." onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { navigate('/players'); } }} /></div>
                <button className="icon-btn notif" onClick={() => setNotifOpen(true)}><Icon name="bell" size={19} />{unread > 0 && <i className="notif-dot" />}</button>
                <button className="top-user" onClick={() => navigate('/profile')}><span className="avatar">{(db.user.name || 'U').slice(0, 2).toUpperCase()}</span><span className="top-user-copy"><strong>{db.user.name}</strong><small>{db.user.email}</small></span><Icon name="chevronDown" size={14} /></button>
              </div>
            </header>
          )}
          <div className={`page ${isBuilder ? 'page-builder' : ''}`}>
            {path === '/dashboard' && <Dashboard />}
            {path === '/profile' && <Profile />}
            {path === '/players' && <Players />}
            {(path.startsWith('/players/new') || /^\/players\/[^/]+\/edit/.test(path)) && <Builder key={path} path={path} />}
            {path === '/leads' && <Leads />}
            {path === '/metrics' && <Metrics />}
            {path === '/plans' && <Plans />}
          </div>
        </main>
      </div>

      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="Notificações" subtitle="Atividade recente da sua conta" width={460}
        footer={<Btn variant="ghost" onClick={() => { update(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })); setNotifOpen(false) }}>Marcar todas como lidas</Btn>}>
        <div className="notif-list">{db.notifications.map(n => <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}><span className="notif-icon"><Icon name={n.title.includes('lead') ? 'users' : 'target'} size={16} /></span><div><strong>{n.title}</strong><p>{n.text}</p><small>{new Date(n.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div></div>)}</div>
      </Modal>
      {toast && <Toast key={toast.id} {...toast} onDone={() => setToast(null)} />}
    </Ctx.Provider>
  )
}
