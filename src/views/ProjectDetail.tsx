import { useMemo, useState } from 'react'
import { useStore, patchTask, addTask, addWbs, moveTask, shiftTask, toggleTask } from '../store'
import { ancestors, rollup, wbs, childrenOf, descendants, hasChildren } from '../core/tree'
import { parseQuick } from '../lib/quick'
import { today, fmtShort, durLabel } from '../lib/date'
import { renderMd } from '../lib/md'
import { Seg, Check } from '../ui'
import { openTask } from '../ui-state'
import type { Task } from '../types'

export function ProjectDetail({ id, nav }: { id: string; nav: (p: string) => void }) {
  const tasks = useStore(s => s.tasks); const p = tasks.find(t => t.id === id)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()); const [adding, setAdding] = useState<string | null>(null); const [text, setText] = useState('')
  const [ap, setAp] = useState<'edit' | 'view'>('view'); const [bulk, setBulk] = useState(false); const [bulkText, setBulkText] = useState('')
  const td = today()
  const r = useMemo(() => rollup(tasks, id, td), [tasks, id, td])
  const rows = useMemo(() => wbs(tasks, id, collapsed), [tasks, id, collapsed])
  const miles = useMemo(() => descendants(tasks, id).filter(t => t.milestone).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')), [tasks, id])
  if (!p) return <div className="stack"><p className="muted">プロジェクトが見つかりません。</p><a className="btn" href="#/projects">一覧へ</a></div>
  const trail = ancestors(tasks, id).reverse()
  const add = (parent: string, e: React.FormEvent) => { e.preventDefault(); const q = parseQuick(text); if (q.title) { const { project: _p, ...rest } = q; addTask({ ...rest, parent }) } setText(''); setAdding(null) }
  const indent = (t: Task) => { const sib = childrenOf(tasks, t.parent); const i = sib.findIndex(x => x.id === t.id); if (i > 0) moveTask(t.id, sib[i - 1].id) }
  const outdent = (t: Task) => { const par = tasks.find(x => x.id === t.parent); if (par && par.id !== id) moveTask(t.id, par.parent) }
  const toggle = (k: string) => setCollapsed(c => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n })
  return <div className="stack" style={{ gap: 'var(--s5)' }}>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <nav className="small muted" aria-label="パンくず"><a href="#/projects">プロジェクト</a>{trail.map(a => <span key={a.id}> / <a href={'#/projects/' + a.id}>{a.title}</a></span>)}</nav>
      <div className="row"><button className="btn btn-sm" onClick={() => openTask(id)}>詳細・親・日付</button>
        <button className="btn btn-sm" onClick={() => patchTask(id, p.done ? { done: false, doneAt: undefined } : { done: true, doneAt: new Date().toISOString() })}>{p.done ? '再開する' : '完了にする'}</button></div>
    </div>
    <input className="title-in" aria-label="プロジェクト名" value={p.title} onChange={e => patchTask(id, { title: e.target.value })} />
    <section className="stats" aria-label="進捗">
      <div className="well"><div className="hero">{r.pct}<small>%</small></div><div className="track" style={{ marginTop: 12 }} role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: r.pct + '%' }} /></div></div>
      <dl className="kv"><div><dt>完了</dt><dd>{r.done} / {r.leaves}</dd></div><div><dt>見積(残り/全体)</dt><dd>{durLabel(r.remainMin) } / {durLabel(r.estMin)}</dd></div><div><dt>期間</dt><dd>{r.start ? fmtShort(r.start) : '—'} 〜 {r.end ? fmtShort(r.end) : '—'}</dd></div><div><dt>期限超過</dt><dd className={r.overdue ? 'late' : ''}>{r.overdue}件</dd></div></dl>
    </section>
    <div className="cols two">
      <div className="field"><label htmlFor="pg">目標(何を達成したいか)</label><textarea id="pg" value={p.goal || ''} onChange={e => patchTask(id, { goal: e.target.value })} placeholder="例: 2027年3月までに法人を設立し、最初の請求書を発行する" /></div>
      <div className="field"><label htmlFor="pd">完了条件(どうなったら終わりか)</label><textarea id="pd" value={p.doneWhen || ''} onChange={e => patchTask(id, { doneWhen: e.target.value })} placeholder="例: 登記完了・銀行口座開設・会計ソフトの設定が済んでいる" /></div>
    </div>
    <section className="stack"><div className="row" style={{ justifyContent: 'space-between' }}><h2 className="sec-h" style={{ margin: 0 }}>アプローチ(進め方・方針)</h2><Seg value={ap} onChange={setAp} items={[['view', '表示'], ['edit', '編集']]} /></div>
      {ap === 'edit' ? <div className="field"><textarea aria-label="アプローチ" style={{ minHeight: 140 }} value={p.approach || ''} onChange={e => patchTask(id, { approach: e.target.value })} placeholder="Markdownで書けます。方針・前提・リスク・参考リンクなど" /></div>
        : <div className="md plate" style={{ padding: 'var(--s3) var(--s4)' }}>{p.approach ? renderMd(p.approach, () => {}, () => {}) : <span className="muted">まだ書かれていません。「編集」から記入できます。</span>}</div>}
    </section>
    <section className="stack"><h2 className="sec-h" style={{ margin: 0 }}>マイルストーン</h2>
      {miles.length ? <div className="rows">{miles.map(m => <div className="trow" key={m.id}><Check on={m.done} onChange={() => toggleTask(m.id)} label={m.title + 'を完了'} /><button className="tt" onClick={() => openTask(m.id)}><b>◆ {m.title}</b><span className="meta">{m.due ? <span className={!m.done && m.due < td ? 'late' : ''}>{fmtShort(m.due)}</span> : <span>日付未設定</span>}</span></button></div>)}</div>
        : <p className="small muted">マイルストーンはありません。下のWBSで項目を作り、詳細から「マイルストーン」をオンにするか、一括追加で「◆ 名前 4/30」と書けます。</p>}
    </section>
    <section className="stack"><div className="row" style={{ justifyContent: 'space-between' }}><h2 className="sec-h" style={{ margin: 0 }}>WBS(作業分解)</h2><button className="btn btn-sm" onClick={() => setBulk(b => !b)} aria-expanded={bulk}>一括追加</button></div>
      {bulk && <div className="stack"><div className="field"><textarea aria-label="WBSを一括追加" style={{ minHeight: 150, fontFamily: 'var(--mono)' }} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={'インデントで階層を表します(2スペース)\n市場調査 ~3h 4/10\n  競合を5社調べる ~2h\n◆ 企画承認 4/30'} /></div>
        <div className="row"><button className="btn btn-primary" onClick={() => { const n = addWbs(id, bulkText); if (n) { setBulkText(''); setBulk(false) } }}>追加する</button><span className="small muted">◆=マイルストーン / ■=子プロジェクト / ~2h=見積 / 4/30=期限 / !2=優先度</span></div></div>}
      <div className="wbs" role="tree">
        {rows.map(({ t, depth, code }) => { const kids = hasChildren(tasks, t.id); const rr = kids ? rollup(tasks, t.id, td) : null
          return <div key={t.id}>
            <div className={'wrow' + (t.done ? ' done' : '')} role="treeitem" aria-level={depth + 1} style={{ paddingLeft: depth * 20 }}>
              <span className="code">{code}</span>
              {kids ? <button className="btn btn-quiet btn-sm tog" aria-label={collapsed.has(t.id) ? '展開' : '折りたたむ'} aria-expanded={!collapsed.has(t.id)} onClick={() => toggle(t.id)}>{collapsed.has(t.id) ? '▸' : '▾'}</button> : <span className="tog" />}
              <Check on={t.done} onChange={() => toggleTask(t.id)} label={t.title + 'を完了'} />
              <button className="tt" onClick={() => openTask(t.id)}><b>{t.milestone ? '◆ ' : t.isProject ? '■ ' : ''}{t.title}</b></button>
              <span className="meta wmeta">{rr && <span>{rr.pct}%</span>}{(rr ? rr.estMin : t.est) ? <span>{durLabel(rr ? rr.estMin : t.est!)}</span> : null}{t.due && <span className={!t.done && t.due < td ? 'late' : ''}>{fmtShort(t.due)}</span>}</span>
              <span className="wact">
                <button className="btn btn-quiet btn-sm" aria-label="子を追加" onClick={() => { setAdding(adding === t.id ? null : t.id); setText('') }}>＋</button>
                <button className="btn btn-quiet btn-sm" aria-label="上へ" onClick={() => shiftTask(t.id, -1)}>↑</button>
                <button className="btn btn-quiet btn-sm" aria-label="下へ" onClick={() => shiftTask(t.id, 1)}>↓</button>
                <button className="btn btn-quiet btn-sm" aria-label="階層を上げる" onClick={() => outdent(t)}>←</button>
                <button className="btn btn-quiet btn-sm" aria-label="階層を下げる" onClick={() => indent(t)}>→</button>
              </span>
            </div>
            {adding === t.id && <form className="quick" style={{ paddingLeft: (depth + 1) * 20 + 28, margin: '4px 0' }} onSubmit={e => add(t.id, e)}><input autoFocus aria-label={t.title + 'の子を追加'} placeholder="子の項目名  ~2h 4/30" value={text} onChange={e => setText(e.target.value)} /><button className="btn" type="submit">追加</button></form>}
          </div> })}
        {!rows.length && <p className="small muted" style={{ padding: 'var(--s3) 0' }}>まだ項目がありません。下の欄から追加してください。</p>}
      </div>
      <form className="quick" onSubmit={e => add(id, e)}><input aria-label="項目を追加" placeholder="このプロジェクトに項目を追加  例: 定款を作る ~3h 4/10" value={adding === null ? text : ''} onChange={e => { setAdding(null); setText(e.target.value) }} /><button className="btn btn-primary" type="submit">追加</button></form>
    </section>
  </div>
}
