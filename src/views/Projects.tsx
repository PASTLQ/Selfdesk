import { useState } from 'react'
import { useStore, addTask } from '../store'
import { useProjects } from '../lib/projects'
import { fmtShort, durLabel } from '../lib/date'
import { Seg } from '../ui'
import { ProjectDetail } from './ProjectDetail'
import type { ViewProps } from '../registry'

export function Projects({ param, nav }: ViewProps) {
  if (param) return <ProjectDetail id={param} nav={nav} />
  return <ProjectList nav={nav} />
}

function ProjectList({ nav }: { nav: (p: string) => void }) {
  const projects = useProjects(); const all = useStore(s => s.tasks)
  const [f, setF] = useState<'open' | 'done'>('open'); const [title, setTitle] = useState('')
  const shown = projects.filter(x => f === 'open' ? !x.p.done : x.p.done)
  const loose = all.filter(t => !t.isProject && !t.parent && !t.done && !all.some(x => x.parent === t.id)).length
  const create = (e: React.FormEvent) => { e.preventDefault(); const t = title.trim(); if (!t) return; const p = addTask({ title: t, isProject: true, goal: '', doneWhen: '' }); setTitle(''); nav('projects/' + p.id) }
  return <div className="stack" style={{ gap: 'var(--s4)' }}>
    <form className="quick" onSubmit={create}>
      <input aria-label="新しいプロジェクト名" placeholder="新しいプロジェクト名  例: 法人を設立する" value={title} onChange={e => setTitle(e.target.value)} />
      <button className="btn btn-primary" type="submit">作成</button>
    </form>
    <Seg value={f} onChange={setF} items={[['open', '進行中'], ['done', '完了']]} />
    <div className="cards">
      {shown.map(({ p, r, subs }) => <a key={p.id} className="pcard" href={'#/projects/' + p.id}>
        <b>{p.title}</b>
        {p.goal ? <p className="small muted clamp">{p.goal}</p> : <p className="small muted">目標が未設定です</p>}
        <div className="track" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label="進捗"><i style={{ width: r.pct + '%' }} /></div>
        <div className="meta"><span>{r.pct}%({r.done}/{r.leaves})</span>{r.remainMin > 0 && <span>残り {durLabel(r.remainMin)}</span>}{r.end && <span>〜{fmtShort(r.end)}</span>}{subs > 0 && <span>子プロジェクト {subs}</span>}{r.overdue > 0 && <span className="late">超過 {r.overdue}</span>}</div>
      </a>)}
    </div>
    {!shown.length && <p className="muted" style={{ padding: 'var(--s5) 0' }}>{f === 'open' ? 'プロジェクトはまだありません。上の欄から作成できます。' : '完了したプロジェクトはありません。'}</p>}
    {loose > 0 && f === 'open' && <p className="small muted">どのプロジェクトにも属さないタスクが {loose} 件あります(「タスク」で確認できます)。</p>}
  </div>
}
