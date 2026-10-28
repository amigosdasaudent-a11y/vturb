import React, { useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { update, fmtDateTime } from '../lib/db.js'
import { supabase, supabaseConfigured } from '../lib/supabase.js'
import { Btn, Field, Input, Modal, Badge, CopyBox } from '../components/ui.jsx'

export default function Profile() {
  const { db, showToast } = useApp()
  const u = db.user
  const [name, setName] = useState(u.name || '')
  const [email] = useState(u.email || '')
  const [company, setCompany] = useState(u.company || '')
  const [pass, setPass] = useState({ next: '', confirm: '' })
  const [setup, setSetup] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verify, setVerify] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const saveProfile = async () => {
    if (supabaseConfigured) {
      setBusy(true)
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), company: company.trim() } })
      setBusy(false)
      if (error) { showToast(error.message, 'error'); return }
    }
    update(s => ({ user: { ...s.user, name: name.trim(), email: u.email, company: company.trim() } }))
    showToast('Perfil atualizado.')
  }

  const changePassword = async () => {
    if (!supabaseConfigured) { showToast('Configure o Supabase Auth para alterar a senha.', 'error'); return }
    if (pass.next.length < 8 || pass.next !== pass.confirm) { showToast('A nova senha deve ter 8 caracteres ou mais e os campos precisam coincidir.', 'error'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pass.next })
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    setPass({ next: '', confirm: '' })
    showToast('Senha atualizada no Supabase Auth.')
  }

  const start2FA = async () => {
    if (!supabaseConfigured) { showToast('O 2FA exige uma sessão Supabase.', 'error'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'vêTurb Authenticator' })
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    setFactorId(data.id)
    setQrCode(data.totp?.qr_code || '')
    setSecret(data.totp?.secret || '')
    setVerify(''); setSetup(true)
  }

  const confirm2FA = async () => {
    if (!factorId || !/^\d{6}$/.test(verify)) { setErr('Informe o código de seis dígitos mostrado pelo aplicativo autenticador.'); return }
    setBusy(true); setErr('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: verify })
      if (verifyError) throw verifyError
      update(s => ({ user: { ...s.user, twoFA: true } }))
      setSetup(false); setFactorId(''); setQrCode(''); setSecret('')
      showToast('Autenticação em dois fatores ativada no Supabase.')
    } catch (error) { setErr(error.message || 'Não foi possível validar o código.') }
    finally { setBusy(false) }
  }

  const disable2FA = async () => {
    if (!supabaseConfigured) return
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      for (const factor of (data.totp || []).filter(f => f.status === 'verified')) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (removeError) throw removeError
      }
      update(s => ({ user: { ...s.user, twoFA: false } }))
      showToast('Autenticação em dois fatores desativada.')
    } catch (error) { showToast(error.message || 'Não foi possível desativar o 2FA.', 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="content">
      <div className="page-head"><div><h1>Meu perfil</h1><p>Gerencie seus dados e as configurações reais de segurança da conta.</p></div></div>

      <div className="profile-grid">
        <div className="card profile-card">
          <div className="profile-hero"><span className="profile-avatar">{(u.name || u.email || 'U').slice(0, 2).toUpperCase()}</span><div><h2>{u.name || 'Minha conta'}</h2><p>{u.email}</p><Badge tone={u.plan === 'Sem plano' ? 'neutral' : 'green'}>{u.plan === 'Sem plano' ? 'SEM PLANO' : u.plan.toUpperCase()}</Badge></div></div>
          <div className="profile-meta"><div><Icon name="calendar" size={15} /><span>Membro desde {fmtDateTime(db.session?.since || Date.now()).split(',')[0]}</span></div><div><Icon name="layers" size={15} /><span>{db.workspaces.length} workspace(s)</span></div><div><Icon name="playOutline" size={15} /><span>{db.players.length} player(s)</span></div></div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>Dados pessoais</h3><p>Informações vinculadas à sua conta</p></div><Icon name="user" size={18} className="muted" /></div>
          <Field label="Nome completo"><Input value={name} onChange={setName} /></Field>
          <div className="field-row"><Field label="E-mail da conta" hint="Gerenciado pelo Supabase Auth."><Input value={email} type="email" disabled /></Field><Field label="Empresa"><Input value={company} onChange={setCompany} /></Field></div>
          <Btn variant="primary" icon="save" disabled={busy} onClick={saveProfile}>Salvar alterações</Btn>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>Alterar senha</h3><p>A senha será atualizada pelo Supabase Auth</p></div><Icon name="lock" size={18} className="muted" /></div>
          <Field label="Nova senha"><Input type="password" value={pass.next} onChange={v => setPass({ ...pass, next: v })} placeholder="Mínimo 8 caracteres" /></Field>
          <Field label="Confirmar nova senha"><Input type="password" value={pass.confirm} onChange={v => setPass({ ...pass, confirm: v })} placeholder="Repita a nova senha" /></Field>
          <Btn variant="outline" icon="key" disabled={busy} onClick={changePassword}>Atualizar senha</Btn>
        </div>

        <div className="card security-card">
          <div className="card-head"><div><h3>Autenticação em dois fatores (2FA)</h3><p>Código TOTP validado pelo Supabase Auth</p></div><Badge tone={u.twoFA ? 'green' : 'neutral'}>{u.twoFA ? 'ATIVO' : 'DESATIVADO'}</Badge></div>
          <div className="security-row"><span className="security-icon"><Icon name="shield" size={22} /></span><div><strong>{u.twoFA ? 'Sua conta está protegida' : 'Ative o 2FA'}</strong><p>Use Google Authenticator, Authy ou outro aplicativo compatível com TOTP. O código é verificado pelo Supabase.</p></div></div>
          {u.twoFA ? <Btn variant="outline" disabled={busy} onClick={disable2FA}>Desativar 2FA</Btn> : <Btn variant="primary" icon="shield" disabled={busy} onClick={start2FA}>Configurar 2FA</Btn>}
        </div>
      </div>

      <div className="card danger-zone"><div><h3>Encerrar sessão</h3><p>Saia da conta neste dispositivo.</p></div><Btn variant="outline" icon="logout" onClick={async () => { if (supabase) await supabase.auth.signOut(); update({ session: null }) }}>Sair da conta</Btn></div>

      <Modal open={setup} onClose={() => setSetup(false)} title="Configurar autenticação em dois fatores" subtitle="Escaneie o QR no aplicativo autenticador e informe o código de teste." width={540}
        footer={<><Btn variant="ghost" disabled={busy} onClick={() => setSetup(false)}>Cancelar</Btn><Btn variant="primary" icon="check" disabled={busy} onClick={confirm2FA}>Verificar e ativar</Btn></>}>
        <div className="twofa-setup">
          {qrCode ? <img className="twofa-qr-image" src={qrCode} alt="QR para configurar o autenticador" /> : <div className="mini-info">QR não disponível; digite a chave manualmente.</div>}
          <div className="twofa-copy"><h4>Chave de configuração</h4><CopyBox label="CHAVE TOTP" value={secret} />
            <Field label="Código de 6 dígitos do aplicativo"><Input value={verify} onChange={v => { setVerify(v.replace(/\D/g, '').slice(0, 6)); setErr('') }} placeholder="000000" inputMode="numeric" /></Field>
            {err && <div className="form-error"><Icon name="alert" size={14} />{err}</div>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
