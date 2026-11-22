import { useStore } from '../store'
import { relatedChoices, relatedOf, toggleRef, sameRef } from '../core/links'
import type { Ref } from '../types'

/** タグ(プロジェクト・やりたいこと自体を付ける)の選択。付いているものは ✕ で外し、候補から選んで足す */
export function RelatedPicker({ value, onChange, selfId, label = 'タグ(プロジェクト・やりたいこと)' }: { value: Ref[] | undefined; onChange: (links: Ref[]) => void; selfId?: string; label?: string }) {
  const tasks = useStore(s => s.tasks); const wishes = useStore(s => s.wishes)
  const have = relatedOf(tasks, wishes, { links: value })
  const choices = relatedChoices(tasks, wishes).filter(c => c.ref.id !== selfId && !have.some(h => sameRef(h.ref, c.ref)))
  const projects = choices.filter(c => c.kind === 'project'); const ws = choices.filter(c => c.kind === 'wish')
  const id = 'rp' + (selfId || 'new')
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {have.length > 0 && <div className="chips" role="list" aria-label="付いているタグ">{have.map(h =>
      <span key={h.ref.kind + h.ref.id} role="listitem" className="chip rel-chip" data-kind={h.kind}>
        <span aria-hidden="true">{h.kind === 'wish' ? '♡' : '■'}</span> {h.title}
        <button type="button" className="rel-x" aria-label={`${h.title}を外す`} onClick={() => onChange(toggleRef(value, h.ref))}>×</button>
      </span>)}</div>}
    <div className="sel"><select id={id} value="" disabled={!choices.length} onChange={e => {
      const [kind, rid] = e.target.value.split(':'); if (kind && rid) onChange(toggleRef(value, { kind, id: rid }))
    }}>
      <option value="">{choices.length ? '＋ タグを付ける…' : '付けられるプロジェクト・やりたいことがありません'}</option>
      {projects.length > 0 && <optgroup label="プロジェクト">{projects.map(c => <option key={c.ref.id} value={'project:' + c.ref.id}>■ {c.title}{c.done ? '(完了)' : ''}</option>)}</optgroup>}
      {ws.length > 0 && <optgroup label="やりたいこと">{ws.map(c => <option key={c.ref.id} value={'wish:' + c.ref.id}>♡ {c.title}{c.done ? '(達成)' : ''}</option>)}</optgroup>}
    </select></div>
  </div>
}
