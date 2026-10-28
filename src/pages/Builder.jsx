import React, { useEffect, useMemo, useState } from 'react'
import { Icon, CTA_ICONS } from '../lib/icons.jsx'
import { useApp } from '../lib/ctx.jsx'
import { defaultPlayer, playerById, savePlayer, uid, update, embedBase } from '../lib/db.js'
import { Btn, Toggle, Field, Input, TextArea, Select, ColorField, Segmented, Slider, Section, Badge, CopyBox, PositionPicker, Modal } from '../components/ui.jsx'
import PlayerEngine from '../components/PlayerEngine.jsx'

const SECTIONS = [
  { id: 'config', title: 'Configurações', subtitle: 'Nome e URL do vídeo', icon: 'settings' },
  { id: 'appearance', title: 'Aparência', subtitle: 'Cores do player e botões', icon: 'palette' },
  { id: 'controls', title: 'Controles', subtitle: 'Ativar/desativar botões e barras', icon: 'sliders' },
  { id: 'fake', title: 'Progresso Simulado', subtitle: 'Barra de progresso falsa para gerar urgência', icon: 'clock' },
  { id: 'play', title: 'Play & Pausa', subtitle: 'Botão play e modal de pausa', icon: 'playOutline' },
  { id: 'cta', title: 'Botão de Ação (CTA)', subtitle: 'Botões e links sobre o player', icon: 'share' },
  { id: 'countdown', title: 'Cronômetro Regressivo', subtitle: 'Contador flutuante para gerar escassez', icon: 'clock' },
  { id: 'live', title: 'Simulação ao Vivo', subtitle: 'Crachá de visitantes online e lives simulados', icon: 'eye' },
  { id: 'ads', title: 'Anúncios em Vídeo', subtitle: 'Anúncios overlay que interrompem a VSL', icon: 'megaphone' },
  { id: 'exit', title: 'Intenção de Saída', subtitle: 'Popup quando o visitante tenta sair da página', icon: 'external' },
  { id: 'lead', title: 'Captura de Leads', subtitle: 'Popup para capturar e-mails dos visitantes', icon: 'users' },
  { id: 'tracking', title: 'Rastreamento', subtitle: 'FB Pixel e Google Tag Manager', icon: 'chart' },
  { id: 'domains', title: 'Domínios Permitidos', subtitle: 'Restringir onde o player roda', icon: 'shield' },
]

const ANIMS = [
  ['none', 'SEM', 'x'], ['pulse', 'PULSO', 'sparkle'], ['bounce', 'BALANÇO', 'refresh'],
  ['heartbeat', 'BATIMENTO', 'heart'], ['shake', 'OSCILAR', 'zap'], ['slim', 'DELGADA', 'minus'],
  ['glow', 'BRILHO', 'sun'], ['flash', 'PISCANTE', 'bolt'], ['3d', '3D', 'layers'], ['elastic', 'ELÁSTICO', 'target'],
]

const POS_OPTS = [['tl','TL'],['tc','TC'],['tr','TR'],['bl','BL'],['bc','BC'],['br','BR']]

export default function Builder({ path }) {
  const { db, navigate, showToast } = useApp()
  const editId = path.match(/^\/players\/([^/]+)\/edit/)?.[1]
  const existing = editId ? playerById(db, editId) : null
  const [p, setP] = useState(() => existing ? structuredClone(existing) : defaultPlayer({ workspaceId: db.activeWorkspace }))
  const [open, setOpen] = useState(null)
  const [visited, setVisited] = useState(() => existing ? SECTIONS.map(s => s.id) : ['config'])
  const [saved, setSaved] = useState(!!existing)
  const [vertical, setVertical] = useState(p.orientation === 'vertical')
  const [dirty, setDirty] = useState(false)
  const [previewModal, setPreviewModal] = useState(false)

  useEffect(() => { if (existing) { setP(structuredClone(existing)); setSaved(true) } }, [editId]) // eslint-disable-line

  const setTop = (k, v) => { setP(prev => ({ ...prev, [k]: v })); setDirty(true) }
  const setKey = (g, k, v) => { setP(prev => ({ ...prev, [g]: { ...prev[g], [k]: v } })); setDirty(true) }
  const toggleSection = id => {
    setOpen(o => o === id ? null : id)
    setVisited(v => v.includes(id) ? v : [...v, id])
  }
  const setAd = (id, k, v) => { setP(prev => ({ ...prev, ads: prev.ads.map(a => a.id === id ? { ...a, [k]: v } : a) })); setDirty(true) }
  const addAd = () => { setP(prev => ({ ...prev, ads: [...prev.ads, { id: uid('ad'), enabled: true, url: '', at: 5, skipAfter: 5, duration: 30 }] })); setDirty(true) }
  const delAd = id => { setP(prev => ({ ...prev, ads: prev.ads.filter(a => a.id !== id) })); setDirty(true) }

  const doSave = () => {
    if (!p.name.trim()) { showToast('Dê um nome ao player antes de salvar.', 'error'); setOpen('config'); return }
    setTop('orientation', vertical ? 'vertical' : 'horizontal')
    const final = { ...p, orientation: vertical ? 'vertical' : 'horizontal' }
    savePlayer(final)
    setSaved(true); setDirty(false)
    showToast('Player salvo! Códigos de incorporação liberados.')
    if (!existing) navigate(`/players/${final.id}/edit`)
  }

  const openPreview = () => {
    try { localStorage.setItem('vt_draft_preview', JSON.stringify({ ...p, orientation: vertical ? 'vertical' : 'horizontal' })) } catch {}
    window.open(`${window.location.pathname}#/p/preview?preview=1`, '_blank')
  }

  const origin = embedBase()
  const iframeCode = `<div style="position:relative;width:100%;max-width:${vertical ? '420px' : '960px'};aspect-ratio:${vertical ? '9/16' : '16/9'};">\n  <iframe src="${origin}#/embed/${p.id}" title="${p.name}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" allow="autoplay; fullscreen; encrypted-media" allowfullscreen loading="lazy"></iframe>\n</div>`

  const uploadFile = (file, cb) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    cb(url)
    showToast('Arquivo anexado (URL local temporária desta sessão).')
  }

  const common = { p, setTop, setKey, setAd, addAd, delAd, vertical, setVertical, uploadFile }

  return (
    <div className="builder">
      <header className="builder-topbar">
        <div className="bt-left">
          <button className="icon-btn" onClick={() => navigate('/players')} title="Voltar"><Icon name="arrowLeft" size={19} /></button>
          <div><h2>{existing ? 'Editar Player' : 'Criar Novo Player'}</h2><span>{p.name || 'Sem nome'}</span></div>
        </div>
        <div className="bt-right">
          {dirty && <span className="unsaved"><i /> Não salvo</span>}
          <Btn variant="ghost" onClick={() => navigate('/players')}>Cancelar</Btn>
          <Btn variant="outline" icon="eye" onClick={() => setPreviewModal(true)}>Preview</Btn>
          <Btn variant="primary" icon="save" onClick={doSave}>Salvar</Btn>
        </div>
      </header>

      <div className="builder-body">
        {/* ---------- COLUNA ESQUERDA: CONFIGURAÇÕES ---------- */}
        <aside className="builder-left">
          <div className="builder-left-inner">
            <div className="builder-sections-label"><strong>Seções do player</strong><span>{SECTIONS.length} configurações</span></div>
            {SECTIONS.map(s => (
              <Section key={s.id} title={s.title} subtitle={s.subtitle} icon={s.icon} open={open === s.id} onToggle={() => toggleSection(s.id)}
                badge={s.id === 'ads' && p.ads.length ? p.ads.length : null}>
                <SectionBody id={s.id} {...common} />
              </Section>
            ))}
          </div>
        </aside>

        {/* ---------- COLUNA CENTRAL: PREVIEW ---------- */}
        <div className="builder-center">
          <div className="preview-head"><Icon name="eye" size={15} /> Pré-visualização em tempo real <Badge tone="green">Ao vivo</Badge></div>
          <div className={`preview-stage ${vertical ? 'is-vertical' : ''} ${p.live.chatEnabled ? 'has-chat' : ''}`}>
            <PlayerEngine key={p.id + (vertical ? 'v' : 'h')} player={p} mode="builder" vertical={vertical}
              forceState={open} showFeatures={visited} onToast={msg => showToast(msg)} />
          </div>
          <p className="preview-caption">O player acima demonstra as cores e funcionalidades com base nas opções inseridas.</p>
          <div className="orient-switch">
            <button className={!vertical ? 'active' : ''} onClick={() => { setVertical(false); setDirty(true) }}>Vídeo Horizontal</button>
            <button className={vertical ? 'active' : ''} onClick={() => { setVertical(true); setDirty(true) }}>Vídeo Vertical (Shorts)</button>
          </div>
          <div className="preview-extra">
            <button onClick={openPreview}><Icon name="external" size={15} /> Testar player completo</button>
            <span>·</span>
            <button onClick={() => { showToast('Simulação reiniciada'); }}><Icon name="refresh" size={15} /> Reiniciar preview</button>
          </div>
        </div>

        {/* ---------- COLUNA DIREITA: INCORPORAÇÃO ---------- */}
        <aside className="builder-right">
          {!saved ? (
            <div className="embed-empty">
              <span className="embed-empty-icon"><Icon name="sparkle" size={30} /></span>
              <h3>Opções de Incorporação</h3>
              <p>Salve este novo player primeiro para ter acesso aos códigos de incorporação (iframe e link direto).</p>
              <Btn variant="primary" icon="save" onClick={doSave}>Salvar player</Btn>
            </div>
          ) : (
            <div className="embed-panel">
              <div className="embed-panel-head"><Icon name="code" size={18} /><div><h3>Opções de Incorporação</h3><span>Pronto para publicar</span></div></div>
              <div className="embed-status"><Icon name="check" size={14} /> Player salvo · ID {p.id.slice(-8)}</div>
              <CopyBox label="CÓDIGO IFRAME RESPONSIVO" value={iframeCode} hint="WordPress, HTML puro, landing pages e funis." />
              <CopyBox label="LINK DIRETO" value={`${origin}#/p/${p.id}`} />
              <div className="embed-actions">
                <Btn variant="outline" size="sm" icon="external" className="full" onClick={() => window.open(`${origin}#/p/${p.id}`, '_blank')}>Abrir player público</Btn>
                <Btn variant="ghost" size="sm" icon="refresh" className="full" onClick={doSave}>Salvar alterações</Btn>
              </div>
              <div className="embed-note"><Icon name="bolt" size={16} /><span><strong>Rota de embed ultra rápida</strong><br />Sem scripts desnecessários, sem banner de cookies. Máxima velocidade para o visitante.</span></div>
              <div className="embed-note"><Icon name="shield" size={16} /><span><strong>{(p.domains.allowed || '').split('\n').filter(Boolean).length || 'Todos'} domínios autorizados</strong><br />{p.domains.blockDevTools ? 'DevTools bloqueado no player público.' : 'Inspeção permitida.'}</span></div>
            </div>
          )}
        </aside>
      </div>

      <Modal open={previewModal} onClose={() => setPreviewModal(false)} title="Preview do player" subtitle="Pré-visualização interativa — clique em “Clique para ouvir” para simular." width={860}>
        <div className="modal-preview"><PlayerEngine player={p} mode="builder" vertical={vertical} forceState={null} showFeatures={SECTIONS.map(s => s.id)} onToast={msg => showToast(msg)} /></div>
        <div className="modal-preview-foot"><Btn variant="primary" icon="external" onClick={openPreview}>Abrir em nova aba</Btn><Btn variant="ghost" onClick={() => setPreviewModal(false)}>Fechar</Btn></div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function SectionBody({ id, p, setTop, setKey, vertical, setVertical, setAd, addAd, delAd, uploadFile }) {
  const setCtaWindows = windows => setTop('cta', { ...p.cta, windows })
  const ctaWindows = Array.isArray(p.cta.windows) ? p.cta.windows : []
  const addCtaWindow = () => {
    const examples = [{ showAt: 60, hideAt: 80 }, { showAt: 200, hideAt: 250 }, { showAt: 400, hideAt: 500 }]
    const next = examples[ctaWindows.length]
    const lastWindow = ctaWindows[ctaWindows.length - 1]
    const start = next?.showAt ?? (Number(lastWindow?.hideAt || 0) + 120)
    const end = next?.hideAt ?? (start + 50)
    setCtaWindows([...ctaWindows, { id: uid('cta_window'), showAt: start, hideAt: end }])
  }
  switch (id) {
    case 'config': return <>
      <Field label="Nome de Identificação"><Input value={p.name} onChange={v => setTop('name', v)} placeholder="Ex: Player Página de Vendas" /></Field>
      <Field label="Origem do vídeo">
        <Segmented size="sm" value={p.videoType === 'gumlet' ? 'gumlet' : p.videoType === 'upload' || p.videoType === 'direct' ? 'direct' : 'youtube'} onChange={v => setTop('videoType', v)} options={[{ value: 'youtube', label: 'YouTube' }, { value: 'gumlet', label: 'Gumlet' }, { value: 'direct', label: 'MP4 / Upload' }]} />
      </Field>
      {p.videoType === 'gumlet' ? <>
        <div className="gumlet-help"><strong>Como usar</strong><span>No Gumlet, abra <b>Share video → URLs</b>. Cole aqui o link MP4 ou HLS e a miniatura. O link de compartilhamento é opcional.</span></div>
        <Field label="Link público de compartilhamento (opcional)"><Input value={p.gumletShareUrl || ''} onChange={v => setTop('gumletShareUrl', v)} placeholder="https://gumlet.tv/watch/..." /></Field>
        <Field label="URL de reprodução MP4" hint="Recomendado: compatível com a maioria dos navegadores."><Input value={p.gumletMp4Url || ''} onChange={v => setTop('gumletMp4Url', v)} placeholder="https://video.gumlet.io/.../video.mp4" /></Field>
        <Field label="URL de reprodução HLS (opcional)" hint="Link .m3u8; reprodução adaptativa. Se preenchido, tem prioridade sobre o MP4."><Input value={p.gumletHlsUrl || ''} onChange={v => setTop('gumletHlsUrl', v)} placeholder="https://video.gumlet.io/.../master.m3u8" /></Field>
        <Field label="URL da miniatura"><Input value={p.posterUrl || ''} onChange={v => setTop('posterUrl', v)} placeholder="https://video.gumlet.io/.../thumbnail.jpg" /></Field>
      </> : p.videoType === 'youtube' ? <>
        <Field label="Link do vídeo no YouTube" hint="Use um vídeo público ou não listado. A miniatura é identificada automaticamente.">
          <Input value={p.videoUrl} onChange={v => setTop('videoUrl', v)} placeholder="https://www.youtube.com/watch?v=..." />
        </Field>
        <Field label="URL da miniatura (opcional)" hint="Use se a imagem automática do YouTube não carregar."><Input value={p.posterUrl || ''} onChange={v => setTop('posterUrl', v)} placeholder="https://.../miniatura.jpg" /></Field>
      </> : <>
        <Field label="URL do vídeo MP4" hint="Cole um link direto ou selecione um arquivo (URL local somente nesta sessão).">
          <div className="input-with-btn"><Input value={p.videoUrl} onChange={v => setTop('videoUrl', v)} placeholder="https://seusite.com/video.mp4" />
            <label className="upload-btn"><Icon name="upload" size={15} /> Upload<input type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) { uploadFile(f, url => { setTop('videoUrl', url); setTop('videoType', 'upload') }) } }} /></label>
          </div>
        </Field>
        <Field label="URL da miniatura (opcional)"><Input value={p.posterUrl || ''} onChange={v => setTop('posterUrl', v)} placeholder="https://.../miniatura.jpg" /></Field>
      </>}
      {p.videoType === 'gumlet' && !p.gumletHlsUrl && !p.gumletMp4Url && <div className="mini-info"><Icon name="info" size={14} /> Cole o MP4 ou HLS gerado no Gumlet para carregar o vídeo. O link “Share URL” sozinho abre a página Gumlet, não o arquivo de vídeo.</div>}
      <Field label="Formato do vídeo"><Segmented size="sm" value={vertical ? 'vertical' : 'horizontal'} onChange={v => setVertical(v === 'vertical')} options={[{ value: 'horizontal', label: 'Horizontal 16:9' }, { value: 'vertical', label: 'Vertical 9:16' }]} /></Field>
      <Field label="Status"><Select value={p.status} onChange={v => setTop('status', v)} options={[{ value: 'active', label: 'Ativo (publicado)' }, { value: 'draft', label: 'Rascunho' }]} /></Field>
      <div className="mini-info"><Icon name="info" size={14} /> O player funciona mesmo sem vídeo: use o modo simulação para testar todos os recursos.</div>
    </>

    case 'appearance': return <>
      <ColorField label="Cor da Linha de Destaque" value={p.appearance.accent} onChange={v => setKey('appearance', 'accent', v)} />
      <ColorField label="Cor dos Botões Controladores" value={p.appearance.controls} onChange={v => setKey('appearance', 'controls', v)} />
      <ColorField label="Cor de Fundo do Player" value={p.appearance.bg} onChange={v => setKey('appearance', 'bg', v)} />
      <ColorField label="Cor do Texto" value={p.appearance.text} onChange={v => setKey('appearance', 'text', v)} />
      <div className="mini-info"><Icon name="palette" size={14} /> As cores são aplicadas instantaneamente no preview ao lado.</div>
    </>

    case 'controls': return <>
      <Toggle label="Menu de Qualidade" hint="Resoluções do YouTube" checked={p.controls.quality} onChange={v => setKey('controls', 'quality', v)} />
      <Toggle label="Voltar/Avançar (5s)" hint="Botões rápidos de 5 segundos" checked={p.controls.seek5} onChange={v => setKey('controls', 'seek5', v)} />
      <Toggle label="Tela Cheia" hint="Expandir o vídeo" checked={p.controls.fullscreen} onChange={v => setKey('controls', 'fullscreen', v)} />
      <Toggle label="Exibir Tempo (Timecode)" hint="Minutos e segundos" checked={p.controls.timecode} onChange={v => setKey('controls', 'timecode', v)} />
      <Toggle label="Barra de Progresso" hint="Timeline horizontal" checked={p.controls.progress} onChange={v => setKey('controls', 'progress', v)} />
    </>

    case 'fake': return <>
      <Toggle label="Ativar Fake Progress" checked={p.fakeProgress.enabled} onChange={v => setKey('fakeProgress', 'enabled', v)} />
      <div className="field-row">
        <Field label="Velocidade"><Input type="number" min="0.2" step="0.1" value={p.fakeProgress.speed} onChange={v => setKey('fakeProgress', 'speed', Number(v))} /></Field>
        <Field label="Grossura da barra (px)"><Input type="number" min="1" max="20" value={p.fakeProgress.thickness} onChange={v => setKey('fakeProgress', 'thickness', Number(v))} /></Field>
      </div>
      <div className="mini-info"><Icon name="alert" size={14} /> Use com moderação: o progresso simulado acelera a percepção de urgência.</div>
    </>

    case 'play': return <>
      <Field label="Tipo de Botão Play"><Segmented size="sm" value={p.playPause.type} onChange={v => setKey('playPause', 'type', v)} options={[{ value: 'svg', label: 'Padrão (SVG)' }, { value: 'image', label: 'Imagem' }]} /></Field>
      {p.playPause.type === 'image' && <Field label="Imagem do Play"><label className="upload-btn wide"><Icon name="upload" size={15} /> Escolher imagem<input type="file" accept="image/*" onChange={e => uploadFile(e.target.files?.[0], url => setKey('playPause', 'image', url))} /></label></Field>}
      <ColorField label="Cor do Botão Play" value={p.playPause.color} onChange={v => setKey('playPause', 'color', v)} />
      <Slider label="Escala do Play" min={0.5} max={2} step={0.1} value={p.playPause.scale} suffix="x" onChange={v => setKey('playPause', 'scale', v)} />
      <Toggle label="Modal de Pausa" hint="Exibir opção de retomar ao pausar" checked={p.playPause.pauseModal} onChange={v => setKey('playPause', 'pauseModal', v)} />
      <Field label="Tipo de Overlay na Pausa"><Segmented size="sm" value={p.playPause.overlay} onChange={v => setKey('playPause', 'overlay', v)} options={[{ value: 'default', label: 'Modal Padrão' }, { value: 'image', label: 'Imagem Customizada' }]} /></Field>
      <Field label="Título do Modal"><Input value={p.playPause.modalTitle} onChange={v => setKey('playPause', 'modalTitle', v)} /></Field>
      <Field label="Texto do Modal"><TextArea rows={2} value={p.playPause.modalText} onChange={v => setKey('playPause', 'modalText', v)} /></Field>
    </>

    case 'cta': return <>
      <Toggle label="Exibir Botão de CTA" hint="Exibir botões e links sobre o vídeo" checked={p.cta.enabled} onChange={v => setKey('cta', 'enabled', v)} />
      <Field label="Tipo do CTA"><Segmented size="sm" value={p.cta.type} onChange={v => setKey('cta', 'type', v)} options={[{ value: 'button', label: 'BOTÃO PRO' }, { value: 'image', label: 'IMAGEM CUSTOMIZADA' }]} /></Field>
      {p.cta.type === 'image' && <Field label="Imagem do CTA"><label className="upload-btn wide"><Icon name="upload" size={15} /> Escolher imagem<input type="file" accept="image/*" onChange={e => uploadFile(e.target.files?.[0], url => setKey('cta', 'customImage', url))} /></label></Field>}
      <Field label="Texto do Botão"><Input value={p.cta.text} onChange={v => setKey('cta', 'text', v)} placeholder="Clique Aqui" /></Field>
      <Field label="Ícone"><div className="icon-picker">{CTA_ICONS.map((ic, i) => <button key={i} title={ic} className={p.cta.icon === ic ? 'active' : ''} onClick={() => setKey('cta', 'icon', ic)}>{ic === 'none' ? <Icon name="x" size={15} /> : <Icon name={ic} size={16} />}</button>)}</div></Field>
      <div className="field-row"><ColorField label="Cor do Botão" value={p.cta.color} onChange={v => setKey('cta', 'color', v)} /><ColorField label="Cor do Texto" value={p.cta.textColor} onChange={v => setKey('cta', 'textColor', v)} /></div>
      <Field label="URL de Destino"><Input value={p.cta.url} onChange={v => setKey('cta', 'url', v)} placeholder="https://meusite.com/comprar" /></Field>
      {ctaWindows.length === 0 ? (
        <Field label="Tempo de Aparição (segundos)" hint="0 = imediato. Adicione períodos abaixo para programar aparições e sumiços."><Input type="number" min="0" value={p.cta.time} onChange={v => setKey('cta', 'time', Number(v))} /></Field>
      ) : (
        <div className="cta-windows-editor">
          <div className="sub-label">PERÍODOS DO CTA (SEGUNDOS DO VÍDEO)</div>
          {ctaWindows.map((window, index) => (
            <div className="cta-window-row" key={window.id || index}>
              <Field label={`Aparece ${index + 1} em`}><Input type="number" min="0" value={window.showAt ?? 0} onChange={v => setCtaWindows(ctaWindows.map((item, i) => i === index ? { ...item, showAt: Number(v) } : item))} /></Field>
              <Field label="Some em"><Input type="number" min="0" value={window.hideAt ?? 0} onChange={v => setCtaWindows(ctaWindows.map((item, i) => i === index ? { ...item, hideAt: Number(v) } : item))} /></Field>
              <button type="button" className="cta-window-remove" title="Remover período" onClick={() => setCtaWindows(ctaWindows.filter((_, i) => i !== index))}>×</button>
            </div>
          ))}
          <div className="mini-info"><Icon name="clock" size={14} /> Cada período vale até o segundo “Some em”; se criar períodos, o campo antigo de aparição única deixa de ser usado.</div>
        </div>
      )}
      <Btn type="button" variant="outline" size="sm" icon="plus" className="full" onClick={addCtaWindow}>Adicionar período de aparição</Btn>
      <Field label="Posição do Botão"><Segmented size="sm" value={p.cta.position} onChange={v => setKey('cta', 'position', v)} options={[{ value: 'top', label: 'TOPO' }, { value: 'middle', label: 'MEIO' }, { value: 'bottom', label: 'RODAPÉ' }]} /></Field>
      <Field label="Tamanho do Botão"><Segmented size="sm" value={p.cta.size} onChange={v => setKey('cta', 'size', v)} options={[{ value: 'peq', label: 'PEQ.' }, { value: 'med', label: 'MÉD.' }, { value: 'grd', label: 'GRD.' }, { value: 'pers', label: 'PERS.' }]} /></Field>
      <Field label="Arredondamento do Botão"><Segmented size="sm" value={p.cta.radius} onChange={v => setKey('cta', 'radius', v)} options={[{ value: 'md', label: '10PX' }, { value: 'sm', label: 'SM' }, { value: 'lg', label: 'LG' }, { value: 'perso', label: 'PERSO' }]} /></Field>
      <Field label="Estilo de Animação"><div className="anim-picker">{ANIMS.map(([v, l, ic]) => <button key={v} className={p.cta.animation === v ? 'active' : ''} onClick={() => setKey('cta', 'animation', v)}><Icon name={ic} size={14} />{l}</button>)}</div></Field>
    </>

    case 'countdown': return <>
      <Toggle label="Ativar Cronômetro Regressivo" hint="Exibir um contador regressivo sobre o player" checked={p.countdown.enabled} onChange={v => setKey('countdown', 'enabled', v)} />
      <Field label="Pré-visualização"><div className="timer-preview"><span className="timer-live"><Icon name="clock" size={11} /> {p.countdown.text} <b>10:00</b></span><span className="timer-play"><Icon name="play" size={14} /></span><small>10px Borda</small></div></Field>
      <div className="field-row"><Field label="Duração (seg)"><Input type="number" min="1" value={p.countdown.duration} onChange={v => setKey('countdown', 'duration', Number(v))} /></Field><Field label="Aparece após (seg)"><Input type="number" min="0" value={p.countdown.appearAfter} onChange={v => setKey('countdown', 'appearAfter', Number(v))} /></Field></div>
      <Field label="Texto de urgência" hint="Texto antes do contador"><Input value={p.countdown.text} onChange={v => setKey('countdown', 'text', v)} /></Field>
      <Field label="Posição no Player"><PositionPicker value={p.countdown.position} onChange={v => setKey('countdown', 'position', v)} options={POS_OPTS} /></Field>
      <Field label="Ao expirar o timer"><Segmented size="sm" value={p.countdown.onExpire} onChange={v => setKey('countdown', 'onExpire', v)} options={[{ value: 'hide', label: 'Esconder' }, { value: 'blink', label: 'Piscar 00:00' }]} /></Field>
      <Field label="Presets do Tema"><div className="preset-row">{['Primary','Secondary','Destructive','Red'].map(t => <button key={t} className={p.countdown.theme === t.toLowerCase() ? 'active' : ''} onClick={() => { const map = { primary: '#7440B6', secondary: '#111631', destructive: '#7f1d1d', red: '#dc2626' }; setKey('countdown', 'theme', t.toLowerCase()); setKey('countdown', 'bg', map[t.toLowerCase()]) }}>{t}</button>)}</div></Field>
      <div className="field-row"><ColorField label="Cor de fundo" value={p.countdown.bg} onChange={v => setKey('countdown', 'bg', v)} /><ColorField label="Cor do texto" value={p.countdown.textColor} onChange={v => setKey('countdown', 'textColor', v)} /></div>
      <Field label="Tamanho"><Segmented size="sm" value={p.countdown.size} onChange={v => setKey('countdown', 'size', v)} options={[{ value: 'sm', label: 'PEQ.' }, { value: 'md', label: 'MÉD.' }, { value: 'lg', label: 'GRD.' }]} /></Field>
    </>

    case 'live': return <>
      <Toggle label="Ativar Simulação ao Vivo" hint="Exibe crachá de espectadores online e live simulados" checked={p.live.enabled} onChange={v => setKey('live', 'enabled', v)} />
      <Field label="Texto do indicador"><Input value={p.live.label} onChange={v => setKey('live', 'label', v)} placeholder="LIVE" /></Field>
      <div className="field-row"><Field label="Min. Espectadores"><Input type="number" min="1" value={p.live.min} onChange={v => setKey('live', 'min', Number(v))} /></Field><Field label="Max. Espectadores"><Input type="number" min="1" value={p.live.max} onChange={v => setKey('live', 'max', Number(v))} /></Field></div>
      <Toggle label="Usar Visitantes Reais" hint="Baseado no tráfego ativo de carregamento do player nos últimos 5 minutos" checked={p.live.realVisitors} onChange={v => setKey('live', 'realVisitors', v)} small />
      <Toggle label="Exibir chat demonstrativo" hint="Abre um painel lateral com mensagens de exemplo, identificado claramente como simulação." checked={Boolean(p.live.chatEnabled)} onChange={v => setKey('live', 'chatEnabled', v)} />
      <Field label="Posição no Player"><PositionPicker value={p.live.position} onChange={v => setKey('live', 'position', v)} options={POS_OPTS} /></Field>
      <Field label="Presets do Tema"><div className="preset-row">{['Primary','Secondary','Destructive','Red'].map(t => <button key={t} className={p.live.theme === t.toLowerCase() ? 'active' : ''} onClick={() => { const map = { primary: '#7440B6', secondary: '#111631', destructive: '#7f1d1d', red: '#dc2626' }; setKey('live', 'theme', t.toLowerCase()); setKey('live', 'bg', map[t.toLowerCase()]) }}>{t}</button>)}</div></Field>
      <div className="field-row"><ColorField label="Fundo" value={p.live.bg} onChange={v => setKey('live', 'bg', v)} /><ColorField label="Texto" value={p.live.textColor} onChange={v => setKey('live', 'textColor', v)} /></div>
      <ColorField label="Indicador Piscante (Bolinha)" value={p.live.blink} onChange={v => setKey('live', 'blink', v)} />
    </>

    case 'ads': return <>
      <div className="section-desc">Adicione anúncios que aparecem durante o vídeo. Aceita URLs do YouTube ou links diretos de vídeo (MP4). Defina em qual segundo o anúncio aparece e quantos segundos até poder pular.</div>
      <Btn variant="outline" icon="plus" className="full" onClick={addAd}>+ Adicionar Anúncio</Btn>
      {p.ads.map((a, i) => <div className="ad-card" key={a.id}>
        <div className="ad-card-head"><strong>Anúncio {i + 1}</strong><div><Toggle checked={a.enabled} onChange={v => setAd(a.id, 'enabled', v)} small /><button className="icon-btn danger" onClick={() => delAd(a.id)}><Icon name="trash" size={15} /></button></div></div>
        <Field label="URL do Vídeo do Anúncio (YouTube, MP4 ou Upload)"><div className="input-with-btn"><Input value={a.url} onChange={v => setAd(a.id, 'url', v)} placeholder="Insira a URL do vídeo ou arquivo" /><label className="upload-btn"><Icon name="upload" size={15} /><input type="file" accept="video/*" onChange={e => uploadFile(e.target.files?.[0], url => setAd(a.id, 'url', url))} /></label></div></Field>
        <div className="field-row three"><Field label="Segundo do vídeo"><Input type="number" min="0" value={a.at} onChange={v => setAd(a.id, 'at', Number(v))} /></Field><Field label="Pular após (seg)"><Input type="number" min="0" value={a.skipAfter} onChange={v => setAd(a.id, 'skipAfter', Number(v))} /></Field><Field label="Duração (seg)"><Input type="number" min="1" value={a.duration} onChange={v => setAd(a.id, 'duration', Number(v))} /></Field></div>
      </div>)}
    </>

    case 'exit': return <>
      <Toggle label="Ativar Exit Intent" hint="Popup quando o mouse sai da página" checked={p.exitIntent.enabled} onChange={v => setKey('exitIntent', 'enabled', v)} />
      <Field label="Título"><Input value={p.exitIntent.title} onChange={v => setKey('exitIntent', 'title', v)} /></Field>
      <Field label="Texto"><TextArea rows={2} value={p.exitIntent.text} onChange={v => setKey('exitIntent', 'text', v)} /></Field>
      <div className="field-row"><Field label="Texto do Botão"><Input value={p.exitIntent.buttonText} onChange={v => setKey('exitIntent', 'buttonText', v)} /></Field><Field label="URL do Botão"><Input value={p.exitIntent.buttonUrl} onChange={v => setKey('exitIntent', 'buttonUrl', v)} /></Field></div>
      <Toggle label="Mostrar apenas uma vez" hint="Usa localStorage para não repetir" checked={p.exitIntent.once} onChange={v => setKey('exitIntent', 'once', v)} small />
      <div className="sub-label">CORES</div>
      <div className="field-row"><ColorField label="Fundo do popup" value={p.exitIntent.bg} onChange={v => setKey('exitIntent', 'bg', v)} /><ColorField label="Fundo do botão" value={p.exitIntent.buttonBg} onChange={v => setKey('exitIntent', 'buttonBg', v)} /></div>
      <ColorField label="Texto do botão" value={p.exitIntent.buttonTextColor} onChange={v => setKey('exitIntent', 'buttonTextColor', v)} />
    </>

    case 'lead': return <>
      <Toggle label="Ativar Captura de Leads" hint="Gatilho no vídeo com formulário de lead" checked={p.lead.enabled} onChange={v => setKey('lead', 'enabled', v)} />
      <div className="field-row"><Field label="Gatilho no segundo"><Input type="number" min="0" value={p.lead.at} onChange={v => setKey('lead', 'at', Number(v))} /></Field><Field label="Texto do Botão"><Input value={p.lead.buttonText} onChange={v => setKey('lead', 'buttonText', v)} /></Field></div>
      <Field label="Título Principal"><Input value={p.lead.title} onChange={v => setKey('lead', 'title', v)} /></Field>
      <Field label="Subtítulo / Descrição"><Input value={p.lead.subtitle} onChange={v => setKey('lead', 'subtitle', v)} /></Field>
      <Field label="URL da Política de Privacidade" hint="Opcional; exibida junto ao consentimento do formulário"><Input value={p.lead.privacyUrl || ''} onChange={v => setKey('lead', 'privacyUrl', v)} placeholder="https://seusite.com.br/privacidade" /></Field>
      <div className="field-row"><ColorField label="Cor do Modal" value={p.lead.bg} onChange={v => setKey('lead', 'bg', v)} /><ColorField label="Cor do Botão" value={p.lead.buttonBg} onChange={v => setKey('lead', 'buttonBg', v)} /></div>
      <div className="mini-info"><Icon name="users" size={14} /> Leads capturados aparecem automaticamente no menu <strong>Leads</strong>.</div>
    </>

    case 'tracking': return <>
      <Field label="Facebook Pixel ID" hint="Deixe em branco para desabilitar o rastreamento do Facebook Pixel"><Input value={p.tracking.pixel} onChange={v => setKey('tracking', 'pixel', v)} placeholder="Ex: 123456789012345" /></Field>
      <Field label="Google Tag Manager ID (GTM)" hint="Deixe em branco para desabilitar o rastreamento do Google Tag Manager"><Input value={p.tracking.gtm} onChange={v => setKey('tracking', 'gtm', v)} placeholder="Ex: GTM-XXXXXXX" /></Field>
      <div className="sub-label">EVENTOS AUTOMÁTICOS</div>
      <Toggle label="PageView" hint="fbq · page_view" checked={p.tracking.pageView} onChange={v => setKey('tracking', 'pageView', v)} small />
      <Toggle label="PlayerPlay" hint="player_play" checked={p.tracking.play} onChange={v => setKey('tracking', 'play', v)} small />
      <Toggle label="PlayerProgress" hint="player_progress (25/50/75/95%)" checked={p.tracking.progress} onChange={v => setKey('tracking', 'progress', v)} small />
      <Toggle label="PlayerCtaClick" hint="player_cta_click" checked={p.tracking.ctaClick} onChange={v => setKey('tracking', 'ctaClick', v)} small />
      <div className="mini-info"><Icon name="code" size={14} /> Eventos também são enviados para <code>window.dataLayer</code>. Veja o log em <strong>Métricas</strong>.</div>
    </>

    case 'domains': return <>
      <div className="info-box"><strong>Como funciona</strong><p>Adicione os domínios onde este player pode ser exibido (um por linha). Se a lista estiver vazia, o player funcionará em qualquer domínio. Subdomínios são incluídos automaticamente (ex: "exemplo.com" permite "www.exemplo.com").</p></div>
      <Field label="Domínios autorizados" hint="Um domínio por linha. Ex: meusite.com.br"><TextArea rows={4} value={p.domains.allowed} onChange={v => setKey('domains', 'allowed', v)} placeholder={'meusite.com.br\noutrosite.com\nloja.exemplo.com'} /></Field>
      <div className="protect-row"><div><strong>Bloquear Inspect Element (DevTools)</strong><span>Impede abrir a console de desenvolvedor no player</span></div><Toggle checked={p.domains.blockDevTools} onChange={v => setKey('domains', 'blockDevTools', v)} /></div>
    </>

    default: return null
  }
}
