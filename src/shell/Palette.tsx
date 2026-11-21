import { useEffect, useMemo, useRef, useState } from 'react'
import { allCommands, allSources, useViews, type Command } from '../registry'
import { go } from '../route'
import { setPalette, usePalette, togglePalette } from '../ui-state'

const norm = (s: string) => s.toLowerCase()

/** ⌘K / Ctrl+K。登録されたコマンド・画面・検索ソースをまとめて絞り込む */
export function Palette() {
  const open = usePalette(); const views = useViews()
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); togglePalette() } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  return open ? <Inner views={views} /> : null
}

function Inner({ views }: { views: ReturnType<typeof useViews> }) {
  const [q, setQ] = useState(''); const [i, setI] = useState(0); const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { const prev = document.activeElement as HTMLElement | null; ref.current?.focus(); return () => prev?.focus?.() }, [])
  const items = useMemo(() => {
    const nav: Command[] = views.map(v => ({ id: 'go.' + v.id, title: v.title + 'を開く', section: '移動', keywords: v.id, run: () => go(v.id) }))
    const base = [...nav, ...allCommands()]
    const lc = norm(q.trim())
    const hit = lc ? base.filter(c => norm(c.title + ' ' + (c.keywords ?? '')).includes(lc)) : base
    const dyn = allSources().flatMap(s => s(q))
    return [...dyn, ...hit].slice(0, 40)
  }, [q, views])
  useEffect(() => setI(0), [q])
  const run = (c?: Command) => { if (!c) return; setPalette(false); c.run() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setPalette(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(items.length - 1, x + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); run(items[i]) }
  }
  let last = ''
  return <div className="pal-back" onMouseDown={e => { if (e.target === e.currentTarget) setPalette(false) }}>
    <div className="pal" role="dialog" aria-modal="true" aria-label="コマンドパレット" onKeyDown={onKey}>
      <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="検索、移動、タスク追加…  例: 資料を作る !2 明日" aria-label="コマンドを検索" />
      <ul role="listbox">
        {items.map((c, n) => { const h = c.section && c.section !== last ? (last = c.section) : null
          return <li key={c.id + n} role="presentation">{h && <h3>{h}</h3>}
            <button role="option" aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => run(c)}>{c.title}{c.hint && <em>{c.hint}</em>}</button></li> })}
        {!items.length && <li className="none">見つかりません</li>}
      </ul>
    </div>
  </div>
}
