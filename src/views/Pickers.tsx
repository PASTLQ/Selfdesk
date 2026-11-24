import { useEffect, useRef, useState } from 'react'
import { today, addDays, parse, dow, JA, daysBetween, fmtDate } from '../lib/date'

const BACK = 14, AHEAD = 60

/** 期限の日付ストリップ。今日が左端(過去は左へスクロール)。マスを押すだけで期限が決まり、もう一度押すと解除 */
export function DueStrip({ value, onChange, id }: { value: string | undefined; onChange: (v: string | undefined) => void; id?: string }) {
  const td = today()
  const [ahead, setAhead] = useState(AHEAD)
  const back = Math.max(BACK, value ? Math.max(0, -daysBetween(td, value)) : 0)
  const fwd = Math.max(ahead, value ? daysBetween(td, value) + 7 : 0)
  const box = useRef<HTMLDivElement>(null)
  // 初期表示は今日が左端。過去ぶんは左にスクロールすると見える
  useEffect(() => { const el = box.current; if (!el) return; const t = el.querySelector<HTMLElement>('[data-today]'); if (t) el.scrollLeft = t.offsetLeft - el.offsetLeft }, [])
  const days = Array.from({ length: back + fwd + 1 }, (_, i) => addDays(td, i - back))
  return <div className="strip-wrap">
    <div className="strip" ref={box} role="listbox" aria-label="期限" id={id} tabIndex={-1}>
      {days.map(d => {
        const dt = parse(d), w = dow(d), sel = d === value, isTd = d === td
        const monthMark = dt.getDate() === 1 || d === days[0]
        return <button key={d} type="button" role="option" aria-selected={sel} aria-label={fmtDate(d) + (isTd ? '(今日)' : '')} data-today={isTd ? '' : undefined}
          className={'strip-d' + (sel ? ' on' : '') + (isTd ? ' today' : '') + (w === 0 ? ' sun' : w === 6 ? ' sat' : '') + (d < td ? ' past' : '') + (monthMark ? ' mon' : '')}
          onClick={() => onChange(sel ? undefined : d)}>
          <small>{monthMark ? `${dt.getMonth() + 1}月` : JA[w]}</small><b>{dt.getDate()}</b>{monthMark && <small>{JA[w]}</small>}
        </button>
      })}
      <button type="button" className="strip-more" onClick={() => setAhead(a => a + 60)}>さらに先へ ›</button>
    </div>
    <div className="row strip-foot">
      <span className="small muted">{value ? fmtDate(value) + 'を期限にしています' : '期限なし(日付を押すと設定)'}</span>
      <span className="grow" />
      <input type="date" className="strip-date" aria-label="日付を直接選ぶ" value={value || ''} onChange={e => onChange(e.target.value || undefined)} />
      {value && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange(undefined)}>解除</button>}
    </div>
  </div>
}

const STEPS = Array.from({ length: 17 }, (_, i) => i * 15)   // 0〜240分(15分刻み)
const lab = (m: number) => m === 0 ? 'なし' : m < 60 ? `${m}` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`

/** 見積(分)のスライダー。0・15・30・…の目盛りを押すだけで設定、同じ目盛りをもう一度押すと解除 */
export function EstSlider({ value, onChange, disabled, id }: { value: number | undefined; onChange: (v: number | undefined) => void; disabled?: boolean; id?: string }) {
  const v = value ?? 0
  const steps = v > 240 || (v % 15 !== 0 && v > 0) ? [...STEPS, ...(STEPS.includes(v) ? [] : [v])].sort((a, b) => a - b) : STEPS
  return <div className="strip-wrap">
    <div className="strip est" role="listbox" aria-label="見積(分)" id={id}>
      {steps.map(m => {
        const sel = m === v
        return <button key={m} type="button" role="option" aria-selected={sel} disabled={disabled} aria-label={m === 0 ? '見積なし' : `${m}分`}
          className={'strip-d' + (sel ? ' on' : '') + (m % 60 === 0 ? ' hour' : '')} onClick={() => onChange(sel || m === 0 ? undefined : m)}>
          <b>{lab(m)}</b>{m > 0 && m < 60 && <small>分</small>}
        </button>
      })}
    </div>
    <div className="row strip-foot">
      <span className="small muted">{value ? `${value}分` : '見積なし'}</span>
      <span className="grow" />
      <input type="number" className="strip-num" aria-label="見積(分)を直接入力" min={0} step={5} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value ? Math.max(0, Number(e.target.value)) || undefined : undefined)} />
      <span className="small muted">分</span>
    </div>
  </div>
}
