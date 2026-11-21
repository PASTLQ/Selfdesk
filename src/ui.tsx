import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

let open = 0
export function Sheet({ title, onClose, children, left }: { title: string; onClose: () => void; children: ReactNode; left?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const root = document.getElementById('root'); open++; root?.setAttribute('inert', '')
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k)
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => { window.removeEventListener('keydown', k); open--; if (open <= 0) root?.removeAttribute('inert'); prev?.focus?.() }
  }, [onClose])
  return createPortal(
    <div className="sheet" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-bar"><span className="slot-l">{left}</span><span className="t">{title}</span><button data-x className="btn btn-quiet btn-sm" onClick={onClose}>閉じる</button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>, document.body)
}

export function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return <div className="seg" role="group">{items.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>
}

export function Check({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <button className="chk-wrap" role="checkbox" aria-checked={on} aria-label={label} onClick={onChange}><span className="chk" aria-checked={on}>{on ? '✓' : ''}</span></button>
}
