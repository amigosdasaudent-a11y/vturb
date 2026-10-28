import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../lib/icons.jsx'
import { youtubeId, secToTime } from '../lib/db.js'

const RADIUS = { '10px': 10, none: 0, sm: 6, md: 10, lg: 20, full: 999, perso: 14 }
const SIZES = { peq: { f: 12, p: '7px 12px' }, med: { f: 15, p: '10px 22px' }, grd: { f: 18, p: '13px 30px' }, pers: { f: 14, p: '9px 18px' } }

function fmtViewers(n) { return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}K` : String(n) }

const CHAT_DEMO_MESSAGES = [
  { name: 'Visitante 01', text: 'Olá, pessoal 👋' },
  { name: 'Visitante 02', text: 'Estou acompanhando a apresentação.' },
  { name: 'Visitante 03', text: 'Acabei de entrar.' },
  { name: 'Visitante 04', text: 'Assistindo pelo celular 📱' },
  { name: 'Visitante 05', text: 'O vídeo está rodando bem.' },
  { name: 'Visitante 06', text: 'Obrigado por compartilhar.' },
  { name: 'Visitante 07', text: 'Acompanhando aqui.' },
]

export default function PlayerEngine({
  player: p, mode = 'builder', vertical, onToast, onLead, onEvent,
  previewParam = false, forceState, showFeatures = [], className = '',
}) {
  const isPublic = mode === 'public'
  const builder = !isPublic
  const vert = vertical ?? p.orientation === 'vertical'
  const hasConfiguredSource = p.videoType === 'gumlet' ? Boolean(p.gumletHlsUrl || p.gumletMp4Url) : Boolean(p.videoUrl)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(hasConfiguredSource || isPublic ? 0 : 597)
  const [playing, setPlaying] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [realElapsed, setRealElapsed] = useState(0)
  const [viewers, setViewers] = useState(() => Math.round((Number(p.live.min) + Number(p.live.max)) / 2))
  const [chatOpen, setChatOpen] = useState(true)
  const [chatMessages, setChatMessages] = useState(() => CHAT_DEMO_MESSAGES.slice(0, 3))
  const [showLead, setShowLead] = useState(false)
  const [leadDone, setLeadDone] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [showPause, setShowPause] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [ad, setAd] = useState(null)
  const [skippedAds, setSkippedAds] = useState([])
  const [showQuality, setShowQuality] = useState(false)
  const [quality, setQuality] = useState('Auto')
  const [devBlocked, setDevBlocked] = useState(false)
  const [domainBlocked, setDomainBlocked] = useState(false)
  const [mediaMode, setMediaMode] = useState('sim')
  const [mediaError, setMediaError] = useState('')
  const [mediaRetry, setMediaRetry] = useState(0)
  const [ytFailed, setYtFailed] = useState(false)
  const [dismissed, setDismissed] = useState(null)
  useEffect(() => { setDismissed(null) }, [forceState])
  const ytRef = useRef(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const milestones = useRef(new Set())
  const stallRef = useRef({ t: -1, for: 0 })
  const progressSaved = useRef(0)
  const chatCursor = useRef(3)

  const speed = isPublic ? 1 : 6 // no builder o tempo corre 6x para demonstrar CTA/lead
  const log = useCallback((type, extra) => { if (isPublic) onEvent?.(type, extra); else onToast?.(`Evento: ${type}`) }, [isPublic, onEvent, onToast])

  // ---------- domínio permitido + anti-DevTools ----------
  useEffect(() => {
    if (!isPublic) return
    const allowed = (p.domains.allowed || '').split('\n').map(s => s.trim()).filter(Boolean)
    if (allowed.length && !previewParam) {
      let host = ''
      try { host = new URL(document.referrer).hostname } catch { host = '' }
      const ok = allowed.some(d => host === d || host.endsWith(`.${d}`))
      if (!ok) setDomainBlocked(true)
    }
    if (!p.domains.blockDevTools) return
    const block = e => {
      const k = e.key?.toLowerCase()
      if (k === 'f12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) {
        e.preventDefault(); setDevBlocked(true); setTimeout(() => setDevBlocked(false), 2600)
      }
    }
    const ctx = e => e.preventDefault()
    window.addEventListener('keydown', block)
    document.addEventListener('contextmenu', ctx)
    return () => { window.removeEventListener('keydown', block); document.removeEventListener('contextmenu', ctx) }
  }, [isPublic, p.domains.allowed, p.domains.blockDevTools, previewParam])

  // ---------- mídia real (YouTube IFrame API / HTML5) ----------
  useEffect(() => {
    if (previewParam === 'sim') return
    setMediaError('')
    setYtFailed(false)
    setTime(0); setPlaying(false); setUnlocked(false)
    setDuration((p.videoType === 'gumlet' ? Boolean(p.gumletHlsUrl || p.gumletMp4Url) : Boolean(p.videoUrl)) ? 0 : (isPublic ? 0 : 597))
    const yid = p.videoType === 'youtube' ? youtubeId(p.videoUrl) : null
    if (yid) {
      setMediaMode('loading')
      let cancelled = false
      const boot = () => {
        if (cancelled || !window.YT?.Player) return
        try {
          ytRef.current = new window.YT.Player('vt-yt-' + p.id, {
            videoId: yid, width: '100%', height: '100%',
            playerVars: { playsinline: '1', controls: '0', rel: '0', modestbranding: '1', enablejsapi: '1', fs: '0', iv_load_policy: '3' },
            events: {
              onReady: e => {
              setMediaMode('yt'); { const d = Number(e.target.getDuration()); if (Number.isFinite(d) && d > 0) setDuration(d) } e.target.mute()
              try { const fr = e.target.getIframe(); Object.assign(fr.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' }) } catch {}
            },
              onStateChange: e => { if (e.data === 0) setPlaying(false) },
              onError: () => { setYtFailed(true); setMediaMode('error') },
            },
          })
        } catch { setYtFailed(true) }
      }
      if (window.YT?.Player) boot()
      else {
        const prev = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => { prev?.(); boot() }
        if (!document.querySelector('script[data-yt-api]')) {
          const s = document.createElement('script')
          s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.dataset.ytApi = '1'
          s.onerror = () => { setYtFailed(true); setMediaMode('error') }
          document.head.appendChild(s)
        }
      }
      const t = setTimeout(() => { if (!ytRef.current?.getCurrentTime) { setYtFailed(true); setMediaMode('error') } }, 6000)
      return () => { cancelled = true; clearTimeout(t); try { ytRef.current?.destroy?.() } catch {} }
    }
    const source = p.videoType === 'gumlet' ? (p.gumletHlsUrl || p.gumletMp4Url) : p.videoUrl
    if (source) setMediaMode('html5')
    else setMediaMode(isPublic ? 'none' : 'sim')
  }, [isPublic, p.id, p.videoUrl, p.videoType, p.gumletHlsUrl, p.gumletMp4Url, previewParam, mediaRetry])

  const videoSource = p.videoType === 'gumlet' ? (p.gumletHlsUrl || p.gumletMp4Url || '') : (p.videoUrl || '')
  const isHls = /\.m3u8(?:[?#]|$)/i.test(videoSource)
  useEffect(() => {
    if (mediaMode !== 'html5' || !videoSource || !videoRef.current) return
    const video = videoRef.current
    if (!isHls) { video.src = videoSource; return }
    let cancelled = false
    let hls = null
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = videoSource
        else { setMediaError('Este navegador não oferece suporte a HLS nativo e HLS.js não está disponível.'); setMediaMode('error') }
        return
      }
      hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls; hls.loadSource(videoSource); hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { setMediaError(`HLS ${data.type}: ${data.details}`); setPlaying(false); hls.destroy(); hlsRef.current = null; setMediaMode('error') } })
    }).catch(error => { if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = videoSource; else { setMediaError(error?.message || 'Falha ao iniciar HLS.js'); setPlaying(false); setMediaMode('error') } })
    return () => { cancelled = true; hls?.destroy(); hlsRef.current = null }
  }, [isPublic, mediaMode, videoSource, isHls, mediaRetry])

  // ---------- relógio principal ----------
  useEffect(() => {
    if (domainBlocked || showLead || showExit || showResume || showPause || ad) return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now(), dt = Math.min((now - last) / 1000, 1)
      last = now
      setRealElapsed(v => v + dt)
      if (!playing) return
      if (mediaMode === 'yt' && ytRef.current?.getCurrentTime) {
        const t = ytRef.current.getCurrentTime() || 0
        if (Math.abs(t - stallRef.current.t) < .001) {
          stallRef.current.for += dt
          if (stallRef.current.for > (isHls ? 12 : 5)) { setMediaError('A reprodução parou de avançar. Verifique a conexão e as permissões do vídeo.'); setMediaMode('error'); stallRef.current.for = 0 }
        } else { stallRef.current.t = t; stallRef.current.for = 0 }
        setTime(t)
        const d = Number(ytRef.current.getDuration?.())
        if (Number.isFinite(d) && d > 0) setDuration(d)
      } else if (mediaMode === 'html5' && videoRef.current && !videoRef.current.paused) {
        const t = videoRef.current.currentTime || 0
        if (Math.abs(t - stallRef.current.t) < .001) {
          stallRef.current.for += dt
          if (stallRef.current.for > (isHls ? 12 : 5)) { setMediaError('A reprodução parou de avançar. Verifique a conexão e as permissões do vídeo.'); setMediaMode('error'); stallRef.current.for = 0 }
        } else { stallRef.current.t = t; stallRef.current.for = 0 }
        setTime(t)
      } else if (!isPublic && mediaMode === 'sim') {
        setTime(v => {
          const nv = v + dt * speed
          return nv >= duration ? duration : nv
        })
      } else if (isPublic) {
        setPlaying(false)
      }
    }, 250)
    return () => clearInterval(id)
  }, [playing, duration, speed, mediaMode, isHls, domainBlocked, showLead, showExit, showResume, showPause, ad])

  // ---------- efeitos colaterais do tempo ----------
  useEffect(() => {
    if (!isPublic) return
    if (playing && time > 3) {
      if (time - progressSaved.current > 2) {
        progressSaved.current = time
        try { localStorage.setItem(`vt_progress_${p.id}`, JSON.stringify({ time, duration })) } catch {}
      }
      ;[25, 50, 75, 95].forEach(m => {
        if (time / duration * 100 >= m && !milestones.current.has(m)) {
          milestones.current.add(m); log('progress', { pct: m })
        }
      })
    }
  }, [time, playing, duration, isPublic, p.id, log])

  useEffect(() => {
    if (builder) return
    if (p.lead?.enabled && !leadDone && time >= Number(p.lead.at || 0) && time > 0 && !showLead && !showExit) {
      setShowLead(true); pauseMedia()
    }
  }, [time, p.lead?.enabled, p.lead?.at, leadDone, showLead, showExit, builder])

  useEffect(() => {
    if (builder || !p.ads?.length) return
    const a = p.ads.find(x => x.enabled && !skippedAds.includes(x.id) && time >= Number(x.at || 0) && time < Number(x.at || 0) + Number(x.duration || 30))
    if (a) { setAd(a); pauseMedia() }
  }, [time, p.ads, skippedAds, builder])

  useEffect(() => {
    const id = setInterval(() => {
      const min = Number(p.live.min) || 100, max = Number(p.live.max) || 1000
      setViewers(v => Math.max(min, Math.min(max, v + Math.round((Math.random() - .45) * (max - min) * .04))))
    }, 7000)
    return () => clearInterval(id)
  }, [p.live.min, p.live.max])

  useEffect(() => {
    chatCursor.current = 3
    setChatMessages(CHAT_DEMO_MESSAGES.slice(0, 3))
    setChatOpen(true)
    if (!p.live.chatEnabled) return
    const id = setInterval(() => {
      const message = CHAT_DEMO_MESSAGES[chatCursor.current % CHAT_DEMO_MESSAGES.length]
      chatCursor.current += 1
      setChatMessages(current => [...current, message].slice(-5))
    }, 9000)
    return () => clearInterval(id)
  }, [p.id, p.live.chatEnabled])

  // ---------- modal de retomada ----------
  useEffect(() => {
    if (!isPublic || !p.playPause?.pauseModal) return
    try {
      const raw = localStorage.getItem(`vt_progress_${p.id}`)
      if (raw) {
        const { time: t } = JSON.parse(raw)
        if (t > 8) { setShowResume(true); setTime(t) }
      }
    } catch {}
  }, [isPublic, p.id, p.playPause?.pauseModal])

  // ---------- exit intent ----------
  const exitShown = useRef(false)
  useEffect(() => {
    if (!isPublic || !p.exitIntent?.enabled) return
    const fn = e => {
      if (e.clientY <= 0 && !exitShown.current && !showLead) {
        if (p.exitIntent.once) exitShown.current = true
        setShowExit(true); pauseMedia()
      }
    }
    document.addEventListener('mouseout', fn)
    return () => document.removeEventListener('mouseout', fn)
  }, [isPublic, p.exitIntent?.enabled, p.exitIntent?.once, showLead])

  useEffect(() => {
    if (isPublic && !milestones.current.has('view')) { milestones.current.add('view'); log('view') }
  }, [isPublic, log])

  function pauseMedia() {
    setPlaying(false)
    try { ytRef.current?.pauseVideo?.() } catch {}
    try { videoRef.current?.pause?.() } catch {}
  }
  function playMedia(from) {
    if (from != null) {
      setTime(from)
      try { ytRef.current?.seekTo?.(from, true) } catch {}
      if (videoRef.current) videoRef.current.currentTime = from
    }
    setPlaying(true); setUnlocked(true); setShowPause(false); setShowResume(false)
    try {
      if (mediaMode === 'yt') { ytRef.current?.unMute?.(); ytRef.current?.playVideo?.() }
      else if (mediaMode === 'html5' && videoRef.current) { videoRef.current.muted = false; videoRef.current.play().catch(() => {}) }
    } catch {}
    if (!milestones.current.has('play') || from != null) { milestones.current.add('play'); log('play') }
  }
  function retryMedia() {
    setMediaError(''); setPlaying(false); setUnlocked(false); setTime(0)
    setDuration(hasConfiguredSource ? 0 : (isPublic ? 0 : 597))
    setMediaMode('loading')
    setMediaRetry(value => value + 1)
  }
  const togglePlay = () => {
    if (!unlocked) return playMedia()
    if (playing) {
      pauseMedia()
      if (p.playPause.pauseModal && !showLead) setShowPause(true)
    } else playMedia()
  }

  // ---------- estado derivado ----------
  // No builder, a seção aberta "liga" o recurso correspondente no preview (espelha as telas do produto).
  const feat = k => showFeatures.includes(k) || forceState === k
  const modal = k => builder && forceState === k && dismissed !== k
  const closeModal = k => setDismissed(k)
  const effLead = builder ? modal('lead') : showLead
  const effExit = builder ? modal('exit') : showExit
  const effPause = builder ? modal('play') : showPause
  const effAd = builder
    ? (modal('ads') ? (p.ads?.find(item => item.enabled) || null) : null)
    : ad
  const controlsVisible = unlocked || (builder && (feat('controls') || feat('fake')))

  const elapsed = realElapsed
  const cdLeft = Math.max(0, Number(p.countdown.duration || 600) - Math.floor(elapsed))
  const cdVisible = p.countdown.enabled && (builder ? feat('countdown') : (elapsed >= Number(p.countdown.appearAfter || 0) && (cdLeft > 0 || p.countdown.onExpire === 'blink')))
  const liveVisible = p.live.enabled && (isPublic || feat('live'))
  const ctaWindows = Array.isArray(p.cta.windows) ? p.cta.windows : []
  const ctaInConfiguredWindow = ctaWindows.length
    ? ctaWindows.some(window => {
      const start = Number(window.showAt)
      const end = Number(window.hideAt)
      return Number.isFinite(start) && Number.isFinite(end) && end > start && time >= start && time < end
    })
    : time >= Number(p.cta.time || 0)
  const ctaVisible = p.cta.enabled && (builder
    ? (ctaWindows.length === 0 && feat('cta')) || (unlocked && ctaInConfiguredWindow)
    : (unlocked && ctaInConfiguredWindow)) && !effLead && !effExit && !effAd && !effPause
  const chatVisible = Boolean(p.live.chatEnabled) && (isPublic || feat('live'))
  const fakePct = builder && !playing ? 42 : Math.min(100, (time / (duration || 597)) * 100 * Number(p.fakeProgress.speed || 1))
  const currentYoutubeId = p.videoType === 'youtube' ? youtubeId(p.videoUrl) : null
  const thumb = p.posterUrl || (currentYoutubeId ? `https://img.youtube.com/vi/${currentYoutubeId}/maxresdefault.jpg` : null)

  const badges = []
  if (cdVisible) badges.push({ pos: p.countdown.position, key: 'cd', node:
    <div className="vp-countdown" style={{ background: p.countdown.bg, color: p.countdown.textColor }}>
      <Icon name="clock" size={13} /><span>{p.countdown.text}</span><b>{cdLeft > 0 ? secToTime(cdLeft) : '00:00'}</b>
    </div> })
  if (liveVisible) badges.push({ pos: p.live.position, key: 'live', node:
    <div className="vp-live-row">
      <span className="vp-live" style={{ background: p.live.bg, color: p.live.textColor }}><i style={{ background: p.live.blink }} />{p.live.label || 'LIVE'}</span>
      <span className="vp-viewers"><Icon name="eye" size={13} /> {fmtViewers(viewers)}</span>
    </div> })
  const badgeGroups = badges.reduce((acc, b) => { (acc[b.pos] = acc[b.pos] || []).push(b); return acc }, {})

  const ctaStyle = {
    background: p.cta.color, color: p.cta.textColor,
    borderRadius: RADIUS[p.cta.radius] ?? 12,
    fontSize: (SIZES[p.cta.size] || SIZES.med).f,
    padding: (SIZES[p.cta.size] || SIZES.med).p,
  }

  if (domainBlocked) return (
    <div className={`vp vp-${vert ? 'vertical' : 'horizontal'} ${className}`} style={{ '--vp-accent': p.appearance.accent }}>
      <div className="vp-blocked"><Icon name="lock" size={34} /><h3>Domínio não autorizado</h3><p>Este player só pode ser exibido nos domínios configurados pelo proprietário.</p></div>
    </div>
  )

  return (
    <div className={`vp vp-${vert ? 'vertical' : 'horizontal'} ${unlocked ? 'vp-unlocked' : ''} ${className}`}
      style={{ '--vp-accent': p.appearance.accent, '--vp-controls': p.appearance.controls, '--vp-fake-color': p.appearance.accent }}>
      {/* mídia */}
      {youtubeId(p.videoUrl) && <div className={`vp-yt ${ytFailed ? 'hidden' : ''}`}><div id={'vt-yt-' + p.id} /></div>}
      {mediaMode === 'html5' && videoSource && (
        <video ref={videoRef} className="vp-video" src={isHls ? undefined : videoSource} poster={p.posterUrl || (currentYoutubeId ? `https://img.youtube.com/vi/${currentYoutubeId}/hqdefault.jpg` : undefined)} playsInline muted={!unlocked} preload="metadata" onLoadedMetadata={e => { const d = Number(e.target.duration); if (Number.isFinite(d) && d > 0) setDuration(d); if (unlocked) e.currentTarget.play().catch(() => {}) }} onEnded={() => setPlaying(false)} onError={e => { const err = e.currentTarget.error; setMediaError(err ? `Vídeo HTML5: código ${err.code}${err.message ? ` — ${err.message}` : ''}` : 'Erro de mídia do navegador'); setPlaying(false); setMediaMode('error') }} />
      )}
      <div className={`vp-poster ${unlocked && (mediaMode === 'yt' || mediaMode === 'html5') ? 'vp-poster-hidden' : ''}`}
        style={{ background: `linear-gradient(135deg, ${p.appearance.bg}, ${p.appearance.accent})` }}>
        {thumb && <img src={thumb} alt="" className="vp-thumb" onError={e => { if (currentYoutubeId && !p.posterUrl && e.currentTarget.dataset.fallback !== '1') { e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = `https://img.youtube.com/vi/${currentYoutubeId}/hqdefault.jpg` } else e.currentTarget.style.display = 'none' }} />}
        <div className="vp-poster-veil" />
        <div className="vp-orbs"><i/><i/><i/><i/></div>
      </div>
      {((isPublic && mediaMode === 'none') || mediaMode === 'error' || mediaMode === 'loading') && <div className="vp-media-status">
        <Icon name={mediaMode === 'loading' ? 'refresh' : mediaMode === 'none' ? 'film' : 'alert'} size={30} />
        <strong>{mediaMode === 'loading' ? 'Carregando vídeo…' : mediaMode === 'none' ? 'Vídeo não configurado' : 'Não foi possível reproduzir este vídeo'}</strong>
        <span>{mediaMode === 'none' ? 'O proprietário precisa adicionar uma fonte de vídeo antes de publicar.' : mediaMode === 'error' ? (mediaError || 'Confira a URL e as permissões da mídia no Gumlet ou YouTube.') : 'Aguarde enquanto o player conecta à fonte de vídeo.'}</span>
        {mediaMode === 'error' && <button type="button" onClick={retryMedia} style={{ marginTop: 12, padding: '8px 14px', border: '1px solid rgba(255,255,255,.35)', borderRadius: 8, color: '#fff', background: 'rgba(255,255,255,.12)', cursor: 'pointer' }}>Tentar novamente</button>}
      </div>}

      {/* gate de áudio */}
      {!unlocked && !showResume && !effLead && !effExit && !effPause && !effAd && !['none', 'error', 'loading'].includes(mediaMode) && (
        <button className="vp-gate" onClick={() => playMedia()}>
          <span className="vp-headline">{builder && mediaMode === 'sim' ? 'Prévia do player' : 'SEU VÍDEO JÁ COMEÇOU'}</span>
          <span className="vp-mute-icon"><Icon name="volume" size={vert ? 72 : 88} /></span>
          <span className="vp-cta-audio">{builder && mediaMode === 'sim' ? 'Simular reprodução' : 'Clique para ouvir'}</span>
          <span className="vp-play-badge"><Icon name="play" size={20} /></span>
        </button>
      )}

      {/* selos de escassez / live */}
      {Object.entries(badgeGroups).map(([pos, arr]) => (
        <div key={pos} className={`vp-badges pos-${pos}`}>{arr.map(b => <React.Fragment key={b.key}>{b.node}</React.Fragment>)}</div>
      ))}

      {chatVisible && (chatOpen ? (
        <aside className="vp-chat-panel" aria-label="Chat demonstrativo">
          <div className="vp-chat-head">
            <strong>Chat</strong><span>SIMULAÇÃO</span>
            <button type="button" aria-label="Fechar chat" onClick={() => setChatOpen(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="vp-chat-messages">
            {chatMessages.map((message, index) => <div className="vp-chat-message" key={`${index}-${message.name}`}>
              <b>{message.name}</b><span>{message.text}</span>
            </div>)}
          </div>
          <div className="vp-chat-foot">Mensagens de demonstração</div>
        </aside>
      ) : (
        <button type="button" className="vp-chat-toggle" onClick={() => setChatOpen(true)} aria-label="Abrir chat demonstrativo">
          <Icon name="users" size={14} /> Chat <span>{chatMessages.length}</span>
        </button>
      ))}

      {/* CTA inteligente */}
      {ctaVisible && (
        <div className={`vp-cta-wrap cta-${p.cta.position}`}>
          {p.cta.type === 'image' && p.cta.customImage
            ? <a href={p.cta.url} target="_blank" rel="noreferrer" onClick={() => log('cta')} className="vp-cta-image anim-none"><img src={p.cta.customImage} alt="CTA" /></a>
            : <a href={p.cta.url} target="_blank" rel="noreferrer" style={ctaStyle}
                className={`vp-cta anim-${p.cta.animation}`}
                onClick={e => { if (mode === 'builder') e.preventDefault(); log('cta') }}>
                {p.cta.icon && p.cta.icon !== 'none' && <Icon name={p.cta.icon} size={16} />}
                {p.cta.text || 'Clique Aqui'}
              </a>}
        </div>
      )}

      {/* anúncio overlay */}
      {effAd && (
        <div className="vp-ad">
          <div className="vp-ad-box">
            <span className="vp-ad-tag"><Icon name="megaphone" size={14} /> Anúncio</span>
            <p>Conteúdo patrocinado em reprodução</p>
            <button className="vp-ad-skip" onClick={() => { setSkippedAds(s => [...s, effAd.id]); setAd(null); closeModal('ads'); if (isPublic) playMedia() }}>
              Pular em {Math.max(0, Math.ceil(Number(effAd.skipAfter || 0) - (time - Number(effAd.at || 0))))}s <Icon name="forward" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* controles */}
      {controlsVisible && p.controls.progress && (
        <div className="vp-progress" style={{ height: Number(p.fakeProgress.thickness || 4) }}>
          <span style={{ width: `${p.fakeProgress.enabled ? fakePct : (time / (duration || 597)) * 100}%`, background: p.appearance.accent }} />
        </div>
      )}
      {controlsVisible && (
        <div className="vp-controls">
          <button className="vp-ctrl" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproduzir'}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
          {p.controls.seek5 && <button className="vp-ctrl" onClick={() => playMedia(Math.max(0, time - 5))} title="Voltar 5s"><Icon name="rewind" size={15} /></button>}
          {p.controls.seek5 && <button className="vp-ctrl" onClick={() => playMedia(Math.min(duration, time + 5))} title="Avançar 5s"><Icon name="forward" size={15} /></button>}
          {p.controls.timecode && <span className="vp-time">{secToTime(time)} <i>/</i> {duration > 0 ? secToTime(duration) : '--:--'}</span>}
          <span className="vp-spacer" />
          {p.controls.quality && <div className="vp-quality-wrap">
            <button className="vp-ctrl" onClick={() => setShowQuality(v => !v)} title="Qualidade"><Icon name="gear" size={15} /></button>
            {showQuality && <div className="vp-quality">{['Auto','1080p','720p','480p','360p'].map(q => <button key={q} className={q === quality ? 'active' : ''} onClick={() => { setQuality(q); setShowQuality(false); try { ytRef.current?.setPlaybackQuality?.(q === 'Auto' ? 'default' : q.replace('p','')) } catch {} }}>{q}</button>)}</div>}
          </div>}
          {p.controls.fullscreen && <button className="vp-ctrl" onClick={() => { const el = document.querySelector('.vp'); el?.requestFullscreen?.().catch?.(() => {}) }} title="Tela cheia"><Icon name="maximize" size={15} /></button>}
          <button className="vp-ctrl" onClick={() => { try { if (mediaMode === 'yt') { const pl = ytRef.current; pl.isMuted?.() ? pl.unMute() : pl.mute() } else if (videoRef.current) videoRef.current.muted = !videoRef.current.muted } catch {} }} title="Áudio"><Icon name="volume" size={15} /></button>
        </div>
      )}

      {/* modal de pausa */}
      {effPause && !effLead && !effExit && !effAd && (
        <div className="vp-overlay">
          <div className="vp-modal" style={{ background: p.lead.bg }}>
            <button className="vp-modal-x" onClick={() => builder ? closeModal('play') : playMedia()}><Icon name="x" size={16} /></button>
            <span className="vp-modal-icon" style={{ background: p.appearance.accent }}><Icon name="pause" size={20} /></span>
            <h3>{p.playPause.modalTitle || 'Vídeo pausado'}</h3>
            <p>{p.playPause.modalText || 'Continue assistindo para não perder a oferta.'}</p>
            <button className="vp-modal-btn" style={{ background: p.playPause.color }} onClick={() => playMedia()}><Icon name="play" size={15} /> Continuar assistindo</button>
          </div>
        </div>
      )}

      {/* modal de retomada inteligente */}
      {showResume && (
        <div className="vp-overlay">
          <div className="vp-modal" style={{ background: p.lead.bg }}>
            <span className="vp-modal-icon" style={{ background: p.appearance.accent }}><Icon name="refresh" size={20} /></span>
            <h3>Continuar de onde parou?</h3>
            <p>Você parou em {secToTime(time)}. Escolha como deseja continuar.</p>
            <button className="vp-modal-btn" style={{ background: p.playPause.color }} onClick={() => playMedia(time)}><Icon name="play" size={15} /> Continuar de onde parou</button>
            <button className="vp-modal-link" onClick={() => { setShowResume(false); setTime(0); playMedia(0) }}>Reiniciar do início</button>
          </div>
        </div>
      )}

      {/* captura de leads */}
      {effLead && (
        <LeadGate cfg={p.lead} accent={p.appearance.accent} mode={mode} onSubmit={async data => {
          if (builder) { closeModal('lead'); onToast?.('Formulário válido — pré-visualização, nada foi salvo.'); return true }
          const saved = onLead ? await onLead(data) : false
          if (saved === false) return false
          setLeadDone(true); setShowLead(false)
          playMedia()
          return true
        }} />
      )}

      {/* intenção de saída */}
      {effExit && (
        <div className="vp-overlay vp-exit">
          <div className="vp-exit-card" style={{ background: p.exitIntent.bg }}>
            <button className="vp-modal-x" onClick={() => builder ? closeModal('exit') : setShowExit(false)}><Icon name="x" size={16} /></button>
            <span className="vp-exit-icon"><Icon name="shield" size={26} /></span>
            <h3>{p.exitIntent.title}</h3>
            <p>{p.exitIntent.text}</p>
            <a className="vp-modal-btn" style={{ background: p.exitIntent.buttonBg, color: p.exitIntent.buttonTextColor }} href={p.exitIntent.buttonUrl || '#'} onClick={() => builder ? closeModal('exit') : setShowExit(false)}>{p.exitIntent.buttonText}</a>
          </div>
        </div>
      )}

      {devBlocked && <div className="vp-devtoast"><Icon name="shield" size={15} /> Inspeção bloqueada neste player</div>}

      {/* botão de simulação (apenas builder) */}
      {builder && mediaMode === 'sim' && !unlocked && !effLead && !effExit && !effPause && !effAd && (
        <button className="vp-sim-hint" onClick={() => playMedia()}>▶ Simular reprodução</button>
      )}
    </div>
  )
}

function LeadGate({ cfg, accent, mode, onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', consent: false, website: '' })
  const [err, setErr] = useState('')
  const submit = e => {
    e.preventDefault()
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) { setErr('Preencha nome e um e-mail válido.'); return }
    if (!form.consent) { setErr('É necessário autorizar o uso dos dados para continuar.'); return }
    Promise.resolve().then(() => onSubmit({ ...form, consentAt: new Date().toISOString() })).then(ok => { if (ok === false) setErr('Não foi possível enviar. Confira sua conexão e tente novamente.') }).catch(() => setErr('Não foi possível enviar. Confira sua conexão e tente novamente.'))
  }
  return (
    <div className="vp-overlay vp-lead-overlay">
      <div className="vp-lead-card" style={{ background: cfg.bg }}>
        <h3>{cfg.title}</h3>
        <p>{cfg.subtitle}</p>
        <form onSubmit={submit}>
          <input type="text" name="website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
          <label>NOME <span>*</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" /></label>
          <label>E-MAIL <span>*</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Seu melhor e-mail" /></label>
          <label>WHATSAPP (OPCIONAL)<input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></label>
          <label className="vp-lead-consent"><input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} /><span>Autorizo o uso dos meus dados para receber contato relacionado a este conteúdo.{/^https?:\/\//i.test(cfg.privacyUrl || '') && <> <a href={cfg.privacyUrl} target="_blank" rel="noopener noreferrer">Política de Privacidade</a></>}</span></label>
          {err && <div className="vp-lead-err">{err}</div>}
          <button type="submit" className="vp-modal-btn" style={{ background: cfg.buttonBg || accent }}><Icon name="play" size={15} /> {cfg.buttonText || 'Continuar assistindo'}</button>
        </form>
        {mode === 'builder' && <div className="vp-lead-note">Modo de demonstração — nenhum lead é salvo.</div>}
      </div>
    </div>
  )
}
