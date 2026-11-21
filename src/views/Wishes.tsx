import { useState } from 'react'
import { useStore, addWish, patchWish, delWish, promoteWish, completeWish } from '../store'
import { Sheet, Seg } from '../ui'
import { go } from '../route'
import type { Wish } from '../types'

const ST: Record<Wish['status'], string> = { planned: '進めている', someday: 'いつか', done: '達成' }
type Tab = 'active' | 'done'

export function Wishes() {
  const wishes = useStore(s => s.wishes); const tasks = useStore(s => s.tasks)
  const [tab, setTab] = useState<Tab>('active'); const [title, setTitle] = useState(''); const [openId, setOpenId] = useState<string | null>(null); const [cat, setCat] = useState('')
  const cats = [...new Set(wishes.map(w => w.category).filter(Boolean))] as string[]
  const inCat = (w: Wish) => !cat || w.category === cat
  const planned = wishes.filter(w => w.status === 'planned' && inCat(w)); const someday = wishes.filter(w => w.status === 'someday' && inCat(w))
  const done = wishes.filter(w => w.status === 'done' && inCat(w)).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))
  const byYear = done.reduce<Record<string, Wish[]>>((m, w) => { const y = (w.doneAt || '').slice(0, 4) || '—'; (m[y] ||= []).push(w); return m }, {})
  const projDone = (w: Wish) => !!w.project && w.status !== 'done' && !!tasks.find(t => t.id === w.project)?.done
  const add = (e: React.FormEvent) => { e.preventDefault(); const t = title.trim(); if (!t) return; addWish({ title: t, category: cat || undefined }); setTitle('') }
  const row = (w: Wish) => <button key={w.id} className="wish" onClick={() => setOpenId(w.id)}>
    <b>{w.title}</b>
    <span className="meta">{w.category && <span>{w.category}</span>}{w.target && <span>{w.target}</span>}{w.project && <span>プロジェクト化済み</span>}{projDone(w) && <span className="pri">プロジェクト完了 → 達成にできます</span>}{w.status === 'done' && w.doneAt && <span>{w.doneAt.slice(0, 10)}</span>}</span>
    {w.status === 'done' && w.reflection && <span className="small muted clamp">{w.reflection}</span>}
  </button>
  return <div className="stack" style={{ gap: 'var(--s4)' }}>
    <form className="quick" onSubmit={add}><input aria-label="やりたいことを追加" placeholder="やりたいことを追加  例: 下呂温泉に行く" value={title} onChange={e => setTitle(e.target.value)} /><button className="btn btn-primary" type="submit">追加</button></form>
    <Seg value={tab} onChange={setTab} items={[['active', `これから(${wishes.filter(w => w.status !== 'done').length})`], ['done', `達成(${wishes.filter(w => w.status === 'done').length})`]]} />
    {cats.length > 0 && <div className="chips scroll-x" role="group" aria-label="カテゴリ"><button className="chip" aria-pressed={!cat} onClick={() => setCat('')}>すべて</button>{cats.map(c => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}</div>}
    {tab === 'active' ? <>
      <section><h2 className="sec-h">進めている</h2><div className="rows">{planned.map(row)}{!planned.length && <p className="small muted" style={{ padding: '8px 0' }}>「プロジェクトにする」と、ここに並びます。</p>}</div></section>
      <section><h2 className="sec-h">いつか</h2><div className="rows">{someday.map(row)}{!someday.length && <p className="small muted" style={{ padding: '8px 0' }}>思いついたら、上の欄から気軽に追加できます。</p>}</div></section>
    </> : <>
      {Object.keys(byYear).sort().reverse().map(y => <section key={y}><h2 className="sec-h">{y}年に達成</h2><div className="rows">{byYear[y].map(row)}</div></section>)}
      {!done.length && <p className="muted" style={{ padding: 'var(--s5) 0' }}>達成したやりたいことが、ここに残ります。</p>}
    </>}
    {openId && <WishSheet id={openId} onClose={() => setOpenId(null)} />}
  </div>
}

function WishSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useStore(s => s.wishes.find(x => x.id === id)); const proj = useStore(s => s.tasks.find(t => t.id === w?.project))
  if (!w) return null
  const p = (x: Partial<Wish>) => patchWish(id, x)
  return <Sheet title="やりたいこと" onClose={onClose}>
    <div className="stack">
      <div className="field"><label htmlFor="wt">やりたいこと</label><input id="wt" type="text" data-autofocus value={w.title} onChange={e => p({ title: e.target.value })} /></div>
      <div className="row"><div className="field grow"><label htmlFor="wc">カテゴリ</label><input id="wc" type="text" placeholder="旅行・仕事・人生 など" value={w.category || ''} onChange={e => p({ category: e.target.value || undefined })} /></div>
        <div className="field grow"><label htmlFor="wg">目安の時期</label><input id="wg" type="text" placeholder="2027-03 / 来年の春 / いつか" value={w.target || ''} onChange={e => p({ target: e.target.value || undefined })} /></div></div>
      <div className="field"><label htmlFor="wn">メモ(なぜやりたいか・イメージ)</label><textarea id="wn" value={w.note} onChange={e => p({ note: e.target.value })} /></div>
      {w.status === 'done' && <div className="field"><label htmlFor="wr">達成の感想・振り返り</label><textarea id="wr" value={w.reflection || ''} onChange={e => p({ reflection: e.target.value })} /></div>}
      {proj && <p className="small">プロジェクト: <a href={'#/projects/' + proj.id} onClick={onClose}>{proj.title}</a>{proj.done && ' (完了済み)'}</p>}
      <div className="row">
        {w.status !== 'done' && !w.project && <button className="btn btn-primary" onClick={() => { const pr = promoteWish(id); onClose(); if (pr) go('projects/' + pr.id) }}>プロジェクトにする</button>}
        {w.status !== 'done' && <button className="btn" onClick={() => completeWish(id)}>達成にする</button>}
        {w.status === 'done' && <button className="btn" onClick={() => p({ status: w.project ? 'planned' : 'someday', doneAt: undefined })}>未達成に戻す</button>}
        {w.status === 'planned' && !w.project && <button className="btn" onClick={() => p({ status: 'someday' })}>いつかに戻す</button>}
        {w.status === 'someday' && <button className="btn" onClick={() => p({ status: 'planned' })}>進めているにする</button>}
      </div>
      <hr className="rule" />
      <button className="btn" onClick={() => { if (confirm('このやりたいことを削除しますか?')) { delWish(id); onClose() } }}>削除</button>
    </div>
  </Sheet>
}
export { ST }
