import React, { useEffect, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { Btn, Badge, Field, Input } from '../components/ui.jsx'
import { supabase, supabaseConfigured } from '../lib/supabase.js'

const FEATURES = [
  'Acesso a todos os recursos do vêTurb',
  'Builder com as 13 seções de configuração',
  'Players públicos, embeds e suporte a Gumlet HLS/MP4',
  'Métricas, eventos e exportação de leads',
]

export default function Plans() {
  const { db, showToast } = useApp()
  const plan = db.user?.plan || 'Sem plano'
  const [adminChecked, setAdminChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [tokenConfigured, setTokenConfigured] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const loadStatus = async () => {
      if (!supabaseConfigured || !db.session?.id) { setAdminChecked(true); return }
      try {
        const { data, error } = await supabase.rpc('veturb_is_platform_admin')
        if (error) throw error
        if (!active) return
        setIsAdmin(data === true)
        if (data === true) {
          const { data: status, error: statusError } = await supabase.rpc('veturb_mp_credentials_status')
          if (statusError) throw statusError
          const row = Array.isArray(status) ? status[0] : status
          if (row) {
            setPublicKey(row.public_key || '')
            setTokenConfigured(row.token_configured === true)
          }
        }
      } catch (error) { if (active) setAdminError(error.message || 'Não foi possível verificar a permissão administrativa.') }
      finally { if (active) setAdminChecked(true) }
    }
    loadStatus()
    return () => { active = false }
  }, [db.session?.id])

  const saveCredentials = async e => {
    e.preventDefault()
    if (!supabase || !isAdmin) { showToast('Somente o administrador da plataforma pode salvar estas chaves.', 'error'); return }
    if (publicKey.trim().length < 10 || accessToken.trim().length < 20) { showToast('Informe uma Public Key e um Access Token válidos.', 'error'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('save-mercadopago-credentials', { body: { publicKey: publicKey.trim(), accessToken: accessToken.trim() } })
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Falha ao salvar as credenciais.')
      setAccessToken('')
      setTokenConfigured(true)
      showToast('Chaves salvas com segurança no Supabase Vault.')
    } catch (error) { showToast(error.message || 'Não foi possível guardar as chaves.', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Planos e assinaturas</h1>
          <p>Um plano com todos os recursos; a assinatura será cobrada mensalmente.</p>
        </div>
      </div>

      <div className="current-plan">
        <Icon name="card" size={20} />
        <div><strong>Plano da conta: {plan}</strong><span>{plan === 'Sem plano' ? 'Nenhum pagamento foi confirmado para esta conta.' : 'O status depende da confirmação do provedor de pagamento.'}</span></div>
        <Badge tone={plan === 'Sem plano' ? 'neutral' : 'green'}>{plan === 'Sem plano' ? 'SEM PLANO' : 'ATIVO'}</Badge>
      </div>

      <section className="card billing-offer">
        <div className="billing-offer-head"><div><Badge tone="purple">PLANO ÚNICO</Badge><h2>vêTurb Completo</h2><p>Todos os recursos em uma assinatura mensal.</p></div><div className="billing-price"><strong>R$ 67,90</strong><span>por mês</span></div></div>
        <div className="billing-feature-list">{FEATURES.map(feature => <div key={feature}><Icon name="check" size={16} /><span>{feature}</span></div>)}</div>
        <div className="billing-checkout-note"><Icon name="info" size={16} /><span>O checkout e a ativação automática ainda não estão habilitados. Primeiro valide as credenciais e depois ativaremos o pagamento e o webhook.</span></div>
        <Btn variant="primary" icon="lock" disabled title="Checkout será liberado após configurar e testar o Mercado Pago">Assinatura em configuração</Btn>
      </section>

      <section className="card billing-pending">
        <div className="card-head"><div><h3>Credenciais do Mercado Pago</h3><p>Configuração global da conta vêTurb; somente administrador.</p></div><Badge tone={tokenConfigured ? 'green' : 'neutral'}>{tokenConfigured ? 'TOKEN CONFIGURADO' : 'PENDENTE'}</Badge></div>
        {!adminChecked ? <div className="mini-info"><Icon name="refresh" size={15} /> Verificando acesso administrativo…</div> : isAdmin ? (
          <form onSubmit={saveCredentials} className="mp-credentials-form">
            <Field label="Public Key" hint="Chave pública da aplicação Mercado Pago."><Input value={publicKey} onChange={setPublicKey} autoComplete="off" placeholder="APP_USR-… ou TEST-…" /></Field>
            <Field label="Access Token" hint="Digite o token para substituir/salvar. Ele nunca será exibido novamente nem persistido no navegador."><Input type="password" value={accessToken} onChange={setAccessToken} autoComplete="new-password" placeholder={tokenConfigured ? 'Já configurado; deixe em branco para não alterar' : 'APP_USR-… ou TEST-…'} /></Field>
            <div className="mp-security-note"><Icon name="shield" size={16} /><span>O Access Token será enviado por conexão segura e guardado criptografado no Supabase Vault. Não o coloque no GitHub nem em mensagens.</span></div>
            <Btn type="submit" variant="primary" icon="lock" disabled={saving || !accessToken.trim()}>{saving ? 'Salvando com segurança…' : 'Salvar credenciais'}</Btn>
          </form>
        ) : (
          <div className="billing-admin-pending"><Icon name="lock" size={21} /><div><strong>Conta administradora ainda não reconhecida neste projeto</strong><p>A configuração só libera para o e-mail administrador confirmado no Supabase Auth. Conta conectada: <b>{db.user?.email || 'sem sessão'}</b>{adminError && <><br />Detalhe: {adminError}</>}</p><small>Cadastre e confirme no Supabase Auth o e-mail autorizado e atualize esta tela. Não envie suas chaves por mensagem.</small></div></div>
        )}
      </section>
    </div>
  )
}
