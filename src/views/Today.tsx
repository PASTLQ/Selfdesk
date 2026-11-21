import { useStore } from '../store'
import { useWidgets } from '../registry'

/** 登録されたウィジェットを、設定の並び順・表示/非表示に従って並べるだけの画面 */
export function Today() {
  const widgets = useWidgets(); const order = useStore(s => s.settings.todayOrder); const hidden = useStore(s => s.settings.todayHidden)
  const idx = (id: string) => { const i = order.indexOf(id); return i < 0 ? 1000 + widgets.findIndex(w => w.id === id) : i }
  const shown = widgets.filter(w => !hidden.includes(w.id)).sort((a, b) => idx(a.id) - idx(b.id))
  return <div className="widgets">
    {shown.map(w => { const C = w.component; return <section key={w.id} className={w.span === 'full' ? 'span-full' : ''} aria-label={w.title}>
      {w.heading !== false && <h2 className="sec-h">{w.title}</h2>}<C />
    </section> })}
  </div>
}
