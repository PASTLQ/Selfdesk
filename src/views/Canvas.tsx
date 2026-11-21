import { useEffect, useRef, type ReactNode, type PointerEvent as RPE } from 'react'

export interface View { x: number; y: number; k: number }
export const toWorld = (el: HTMLElement, v: View, cx: number, cy: number): [number, number] => { const r = el.getBoundingClientRect(); return [(cx - r.left - v.x) / v.k, (cy - r.top - v.y) / v.k] }

export function Canvas({ view, setView, children, svg, onBgDown, className = '', innerRef }: {
  view: View; setView: (v: View) => void; children?: ReactNode; svg?: ReactNode
  onBgDown?: (e: RPE<HTMLDivElement>, world: [number, number]) => boolean | void; className?: string; innerRef?: (el: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null); const vr = useRef(view); vr.current = view
  useEffect(() => {
    const el = ref.current!; innerRef?.(el)
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); const v = vr.current; const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) { const k = Math.min(3, Math.max(.2, v.k * Math.exp(-e.deltaY * .01))); const mx = e.clientX - r.left, my = e.clientY - r.top; setView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k }) }
      else setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
    }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [setView]) // eslint-disable-line
  const down = (e: RPE<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const t = e.target as HTMLElement; if (t !== e.currentTarget && !t.dataset.bg) return
    const w = toWorld(e.currentTarget, view, e.clientX, e.clientY)
    if (onBgDown?.(e, w)) return
    const sx = e.clientX, sy = e.clientY, v0 = view; const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const mv = (ev: PointerEvent) => setView({ ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy })
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up)
  }
  const zoom = (f: number) => { const r = ref.current!.getBoundingClientRect(); const k = Math.min(3, Math.max(.2, view.k * f)); const mx = r.width / 2, my = r.height / 2; setView({ k, x: mx - ((mx - view.x) / view.k) * k, y: my - ((my - view.y) / view.k) * k }) }
  return (
    <div className={'canvas ' + className} ref={ref} onPointerDown={down}>
      <svg className="layer" width="1" height="1" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>{svg}</svg>
      <div className="layer" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>{children}</div>
      <div className="toolbar" style={{ position: 'absolute', right: 10, bottom: 10 }} onPointerDown={e => e.stopPropagation()}>
        <button className="btn btn-sm" onClick={() => zoom(1 / 1.25)} aria-label="縮小">−</button>
        <button className="btn btn-sm" onClick={() => setView({ x: 40, y: 40, k: 1 })} aria-label="表示をリセット">{Math.round(view.k * 100)}%</button>
        <button className="btn btn-sm" onClick={() => zoom(1.25)} aria-label="拡大">＋</button>
      </div>
    </div>
  )
}
