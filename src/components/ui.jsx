import React, { useEffect, useState } from 'react'
import { Icon } from '../lib/icons.jsx'

export function Btn({ children, variant = 'default', size = 'md', icon, iconRight, className = '', ...rest }) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  )
}

export function Toggle({ checked, onChange, label, hint, small = false, id }) {
  return (
    <div className={`toggle-row ${small ? 'toggle-row-sm' : ''}`}>
      {(label || hint) && <div className="toggle-copy"><div className="toggle-label">{label}</div>{hint && <div className="toggle-hint">{hint}</div>}</div>}
      <button type="button" role="switch" aria-checked={!!checked} id={id}
        className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return <div className={`field ${className}`}>{label && <label className="field-label">{label}</label>}{children}{hint && <div className="field-hint">{hint}</div>}</div>
}

export function Input({ value, onChange, placeholder, type = 'text', ...rest }) {
  return <input className="input" type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} {...rest} />
}

export function TextArea({ value, onChange, placeholder, rows = 4, ...rest }) {
  return <textarea className="input textarea" rows={rows} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} {...rest} />
}

export function Select({ value, onChange, options, ...rest }) {
  return (
    <div className="select-wrap">
      <select className="input select" value={value} onChange={e => onChange(e.target.value)} {...rest}>
        {options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
      </select>
      <Icon name="chevronDown" size={15} className="select-arrow" />
    </div>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="color-field">
        <label className="color-swatch" style={{ background: value }}>
          <input type="color" value={validHex(value)} onChange={e => onChange(e.target.value)} />
        </label>
        <Input value={value} onChange={onChange} placeholder="#7440B6" />
      </div>
    </Field>
  )
}
function validHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '#7440B6' }

export function Segmented({ value, onChange, options, size = 'md' }) {
  return (
    <div className={`segmented seg-${size}`}>
      {options.map((o, i) => {
        const val = typeof o === 'string' ? o : o.value
        const lab = typeof o === 'string' ? o : o.label
        return <button key={val + i} type="button" className={`seg-item ${value === val ? 'active' : ''}`} onClick={() => onChange(val)}>{lab}</button>
      })}
    </div>
  )
}

export function Slider({ value, onChange, min = 0, max = 2, step = 0.1, label, suffix = '' }) {
  return (
    <div className="slider-wrap">
      {label && <div className="slider-head"><span className="field-label">{label}</span><span className="slider-value">{value}{suffix}</span></div>}
      <input type="range" className="range" min={min} max={max} step={step} value={value}
        style={{ '--pct': `${((value - min) / (max - min)) * 100}%` }}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

export function Section({ title, subtitle, icon, open, onToggle, badge, children }) {
  return (
    <div className={`accordion ${open ? 'open' : ''}`}>
      <button type="button" className="accordion-head" onClick={onToggle}>
        <span className="acc-icon"><Icon name={icon} size={17} /></span>
        <span className="acc-copy"><span className="acc-title">{title}</span><span className="acc-sub">{subtitle}</span></span>
        {badge != null && <span className="acc-badge">{badge}</span>}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="acc-chevron" />
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-head">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}>{children}</span> }

export function StatCard({ icon, label, value, delta, tone = 'green', spark }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className={`stat-icon tone-${tone}`}><Icon name={icon} size={19} /></span>
        {delta != null && <span className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}><Icon name="trending" size={13} /> {delta > 0 ? '+' : ''}{delta}%</span>}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {spark && <Sparkline data={spark} tone={tone} />}
    </div>
  )
}

export function Sparkline({ data, tone = 'green', height = 34 }) {
  const w = 120, h = height
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 8)}`).join(' ')
  const colors = { green: '#22c55e', purple: '#7440B6', blue: '#3b82f6', orange: '#f59e0b', red: '#ef4444' }
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sparkline"><polyline points={pts} fill="none" stroke={colors[tone] || colors.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export function LineChart({ series, labels, height = 220, color = '#7440B6', fill = true, suffix = '', maxValue, bare = false }) {
  const w = 720, h = height, padL = 38, padB = 26, padT = 12
  const max = (maxValue || Math.max(...series, 1)) * 1.15
  const x = i => padL + (i / Math.max(series.length - 1, 1)) * (w - padL - 12)
  const y = v => padT + (1 - v / max) * (h - padT - padB)
  const path = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const area = `${path} L ${x(series.length - 1)} ${h - padB} L ${x(0)} ${h - padB} Z`
  const grid = [0, .25, .5, .75, 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="line-chart" preserveAspectRatio="none">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".24"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      {!bare && grid.map((g, i) => <g key={i}><line x1={padL} x2={w - 12} y1={y(max * g)} y2={y(max * g)} stroke="#eef1f6"/><text x={4} y={y(max * g) + 4} className="chart-y">{Math.round(max * g)}{suffix}</text></g>)}
      {fill && <path d={area} fill="url(#chartFill)" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {!bare && series.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.2" fill="white" stroke={color} strokeWidth="2" />)}
      {!bare && (labels || []).map((l, i) => (i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1) && <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="chart-x">{l}</text>)}
    </svg>
  )
}

export function BarChart({ series, labels, color = '#22c55e', height = 200 }) {
  const w = 720, h = height, padB = 26, padL = 38
  const max = Math.max(...series, 1) * 1.15
  const bw = (w - padL - 20) / series.length * .6
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="line-chart" preserveAspectRatio="none">
      {[0, .25, .5, .75, 1].map((g, i) => <g key={i}><line x1={padL} x2={w - 12} y1={h - padB - g * (h - padB - 10)} y2={h - padB - g * (h - padB - 10)} stroke="#eef1f6"/><text x={4} y={h - padB - g * (h - padB - 10) + 4} className="chart-y">{Math.round(max * g)}</text></g>)}
      {series.map((v, i) => {
        const bh = (v / max) * (h - padB - 12)
        const cx = padL + (i + .5) * ((w - padL - 20) / series.length)
        return <g key={i}><rect x={cx - bw / 2} y={h - padB - bh} width={bw} height={bh} rx="4" fill={color} opacity={.85}/>{(i % Math.ceil(series.length / 8) === 0 || i === series.length - 1) && <text x={cx} y={h - 6} textAnchor="middle" className="chart-x">{labels?.[i] || ''}</text>}</g>
      })}
    </svg>
  )
}

export function EmptyState({ icon = 'sparkle', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function CopyBox({ label, value, hint }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(value) } catch { /* clipboard may be blocked in iframe */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="copy-box">
      {label && <div className="copy-label">{label}</div>}
      <div className="copy-row"><code>{value}</code><button className="copy-btn" onClick={copy} title="Copiar"><Icon name={copied ? 'check' : 'copy'} size={15} /></button></div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

export function PositionPicker({ value, onChange, options = [['tl','TL'],['tc','TC'],['tr','TR'],['bl','BL'],['bc','BC'],['br','BR']] }) {
  return (
    <div className="pos-grid">
      {options.map(([v, l]) => <button key={v} type="button" className={`pos-cell ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

export function Toast({ message, tone = 'success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [message, onDone])
  return <div className={`toast toast-${tone}`}><Icon name={tone === 'success' ? 'check' : 'info'} size={17} />{message}</div>
}

export function ProgressRing({ value = 0, size = 84, color = '#22c55e', label }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eef1f6" strokeWidth="8"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(value,100)/100)} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg>
      <div className="ring-label"><strong>{Math.round(value)}%</strong>{label && <span>{label}</span>}</div>
    </div>
  )
}
