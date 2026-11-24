import { useMemo, useState } from 'react'
import { Seg, Check } from '../ui'
import { useStore, addTask, toggleTask, withRelatedTags } from '../store'
import { useActionable, useProjectOf } from '../lib/projects'
import { descendants } from '../core/tree'
import { relatedOf, relatedChoices, sameRef } from '../core/links'
import { parseQuick } from '../lib/quick'
import { today, addDays, fmtShort, durLabel, daysBetween } from '../lib/date'
import { RelatedPicker } from './RelatedPicker'
import { DueStrip, EstSlider } from './Pickers'
import type { Ref, Task } from '../types'

export function TaskRow({ t, open }: { t: Task; open: (id: string) => void }) {
  const td = today(); const projOf = useProjectOf(); const pj = projOf(t.id); const late = !t.done && t.due && t.due < td
  const tasks = useStore(s => s.tasks); const wishes = useStore(s => s.wishes); const rel = relatedOf(tasks, wishes, t)
  const subDone = t.subs.filter(s => s.done).length
  return (
    <div className={'trow' + (t.done ? ' done' : '')}>
      <Check on={t.done} onChange={() => toggleTask(t.id)} label={`${t.title}を完了`} />
      <button className="tt" onClick={() => open(t.id)}>
        <b>{t.title}</b>
        <span className="meta">
          {t.priority > 0 && <span className="pri">{'!'.repeat(t.priority)}</span>}
          {t.due && <span className={late ? 'late' : ''}>{late ? `${daysBetween(t.due, td)}日超過` : fmtShort(t.due)}</span>}
          {t.block && <span>▪ {fmtShort(t.block.date)} {String(Math.floor(t.block.start / 60)).padStart(2, '0')}:{String(t.block.start % 60).padStart(2, '0')}</span>}
          {t.est && <span>{durLabel(t.est)}</span>}
          {t.repeat && <span>↻</span>}
          {t.subs.length > 0 && <span>{subDone}/{t.subs.length}</span>}
          {pj && <span>#{pj.title}</span>}{t.milestone && <span>◆</span>}
          {rel.map(r => <span key={r.ref.kind + r.ref.id} className="rel-tag" data-kind={r.kind}>{r.kind === 'wish' ? '♡' : '■'} {r.title}</span>)}
          {t.tags.map(x => <span key={x}>@{x}</span>)}
        </span>
      </button>
    </div>
  )
}

type F = 'open' | 'today' | 'late' | 'nodue' | 'done'
type SortKey = 'due' | 'priority' | 'est' | 'created'
type GroupKey = 'none' | 'project' | 'due' | 'priority'
const PRI = ['なし', '低', '中', '高']

const sorters: Record<SortKey, (a: Task, b: Task) => number> = {
  due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority,
  priority: (a, b) => b.priority - a.priority || (a.due || '9999').localeCompare(b.due || '9999'),
  est: (a, b) => (a.est ?? 1e9) - (b.est ?? 1e9) || (a.due || '9999').localeCompare(b.due || '9999'),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
}

export function Tasks({ open }: { open: (id: string) => void }) {
  const all = useStore(s => s.tasks); const wishes = useStore(s => s.wishes); const tasks = useActionable(); const projectOf = useProjectOf()
  const projects = useMemo(() => all.filter(t => t.isProject && !t.done && !t.archived), [all])
  const [f, setF] = useState<F>('open'); const [proj, setProj] = useState(''); const [q, setQ] = useState(''); const [text, setText] = useState('')
  const [sort, setSort] = useState<SortKey>('due'); const [group, setGroup] = useState<GroupKey>('none'); const [minPri, setMinPri] = useState(0); const [tag, setTag] = useState<Ref | null>(null)
  const [more, setMore] = useState(false); const [dPri, setDPri] = useState(0); const [dDue, setDDue] = useState(''); const [dEst, setDEst] = useState(''); const [dRel, setDRel] = useState<Ref[]>([])
  const td = today()
  const usedTags = useMemo(() => relatedChoices(all, wishes).filter(c => all.some(t => (t.links || []).some(r => sameRef(r, c.ref)))), [all, wishes])
  const list = useMemo(() => {
    let l = tasks.filter(t => f === 'done' ? t.done : !t.done)
    if (f === 'today') l = l.filter(t => t.due === td || t.block?.date === td)
    if (f === 'late') l = l.filter(t => t.due && t.due < td)
    if (f === 'nodue') l = l.filter(t => !t.due)
    if (proj) { const ids = new Set(descendants(all, proj).map(d => d.id)); l = l.filter(t => ids.has(t.id)) }
    if (tag) l = l.filter(t => (t.links || []).some(r => sameRef(r, tag)))
    if (minPri) l = l.filter(t => t.priority >= minPri)
    if (q) l = l.filter(t => (t.title + t.tags.join(' ')).toLowerCase().includes(q.toLowerCase()))
    return [...l].sort(sorters[sort])
  }, [tasks, all, f, proj, tag, minPri, q, sort, td])
  const groups = useMemo(() => {
    if (group === 'none') return [{ key: '', items: list }]
    const key = (t: Task): [number, string] => {
      if (group === 'project') { const p = projectOf(t.id); return [p ? 0 : 1, p ? p.title : 'プロジェクトなし'] }
      if (group === 'priority') return [3 - t.priority, t.priority ? `優先度 ${PRI[t.priority]}` : '優先度なし']
      if (!t.due) return [4, '期限なし']
      if (t.due < td) return [0, '期限切れ']
      if (t.due === td) return [1, '今日']
      return t.due <= addDays(td, 7) ? [2, '7日以内'] : [3, 'それ以降']
    }
    const m = new Map<string, { o: number; items: Task[] }>()
    for (const t of list) { const [o, k] = key(t); const g = m.get(k) || { o, items: [] }; g.items.push(t); m.set(k, g) }
    return [...m.entries()].sort((a, b) => a[1].o - b[1].o || a[0].localeCompare(b[0])).map(([k, g]) => ({ key: k, items: g.items }))
  }, [list, group, projectOf, td])
  const add = (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return
    const p = withRelatedTags(parseQuick(text))
    if (p.title) {
      const links = [...(p.links || [])]; for (const r of dRel) if (!links.some(x => sameRef(x, r))) links.push(r)
      addTask({ ...p, title: p.title, priority: p.priority ?? (dPri as Task['priority']), due: p.due ?? (dDue || undefined), est: p.est ?? (dEst ? Number(dEst) : undefined), links: links.length ? links : undefined })
    }
    setText(''); setDPri(0); setDDue(''); setDEst(''); setDRel([])
  }
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <form className="stack" style={{ gap: 'var(--s2)' }} onSubmit={add}>
        <div className="quick">
          <input aria-label="タスクを追加" placeholder="タスクを追加  例: 資料を作る !2 #仕事 ~45m 明日 @下呂温泉に行く" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn" type="button" aria-expanded={more} onClick={() => setMore(m => !m)}>詳細</button>
          <button className="btn btn-primary" type="submit">追加</button>
        </div>
        {more && <div className="well stack" style={{ padding: 'var(--s3)', gap: 'var(--s3)' }}>
          <div className="row">
            <div className="field grow"><label htmlFor="qp">優先度</label><div className="sel"><select id="qp" value={dPri} onChange={e => setDPri(Number(e.target.value))}>{PRI.map((l, i) => <option key={i} value={i}>{l}</option>)}</select></div></div>
          </div>
          <div className="field"><label htmlFor="qd">期限</label><DueStrip id="qd" value={dDue || undefined} onChange={v => setDDue(v || '')} /></div>
          <div className="field"><label htmlFor="qe">見積(分)</label><EstSlider id="qe" value={dEst ? Number(dEst) : undefined} onChange={v => setDEst(v ? String(v) : '')} /></div>
          <RelatedPicker value={dRel} onChange={setDRel} />
          <p className="small muted">本文の !2 ~45m 明日 4/30 @名前 と併用できます(本文の指定が優先)。@名前 は、同名のプロジェクト・やりたいことがあればタグとして付き、無ければラベルになります。</p>
        </div>}
      </form>
      <Seg value={f} onChange={setF} items={[['open', '未完了'], ['today', '今日'], ['late', '期限切れ'], ['nodue', '期限なし'], ['done', '完了']]} />
      <div className="row" style={{ gap: 'var(--s3)' }}>
        <div className="field grow"><label htmlFor="so">並べ替え</label><div className="sel"><select id="so" value={sort} onChange={e => setSort(e.target.value as SortKey)}><option value="due">期限</option><option value="priority">優先度</option><option value="est">見積が短い順</option><option value="created">新しい順</option></select></div></div>
        <div className="field grow"><label htmlFor="gr">グループ</label><div className="sel"><select id="gr" value={group} onChange={e => setGroup(e.target.value as GroupKey)}><option value="none">なし</option><option value="project">プロジェクト</option><option value="due">期限</option><option value="priority">優先度</option></select></div></div>
        <div className="field grow"><label htmlFor="mp">優先度</label><div className="sel"><select id="mp" value={minPri} onChange={e => setMinPri(Number(e.target.value))}><option value={0}>すべて</option><option value={1}>低以上</option><option value={2}>中以上</option><option value={3}>高のみ</option></select></div></div>
      </div>
      <div className="chips scroll-x" role="group" aria-label="プロジェクト">
        <button className="chip" aria-pressed={!proj} onClick={() => setProj('')}>すべて</button>
        {projects.map(p => <button key={p.id} className="chip" aria-pressed={proj === p.id} onClick={() => setProj(proj === p.id ? '' : p.id)}>{p.title}</button>)}
      </div>
      {usedTags.length > 0 && <div className="chips scroll-x" role="group" aria-label="タグ">
        <span className="small muted" style={{ alignSelf: 'center' }}>タグ</span>
        {usedTags.map(c => <button key={c.ref.kind + c.ref.id} className="chip" aria-pressed={!!tag && sameRef(tag, c.ref)} onClick={() => setTag(tag && sameRef(tag, c.ref) ? null : c.ref)}>{c.kind === 'wish' ? '♡' : '■'} {c.title}</button>)}
      </div>}
      <div className="field"><input type="search" aria-label="検索" placeholder="検索" value={q} onChange={e => setQ(e.target.value)} /></div>
      {groups.map(g => <section key={g.key} className="stack" style={{ gap: 'var(--s1)' }}>
        {g.key && <h2 className="sec-h" style={{ margin: 0 }}>{g.key} <span className="badge">{g.items.length}</span></h2>}
        <div className="rows">{g.items.map(t => <TaskRow key={t.id} t={t} open={open} />)}</div>
      </section>)}
      {!list.length && <p className="muted" style={{ padding: 'var(--s5) 0' }}>該当するタスクはありません。</p>}
    </div>
  )
}
