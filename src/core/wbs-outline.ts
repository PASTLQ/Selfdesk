import type { Task } from '../types'
import { parseQuick } from '../lib/quick'
import { uid } from '../lib/date'
import { nextOrder } from './tree'

/**
 * インデントで書いたWBSを、親子つきのタスクに変換する(アプリの一括追加と MCP の add_wbs が共用)。
 *   1行 = 1項目。2スペース(またはタブ)ごとに1階層下がる。先頭の "- " や "・" は無視。
 *   先頭が "◆" ならマイルストーン、"■" ならサブプロジェクト。
 *   行内の記法はクイック追加と同じ: !2(優先度) ~2h(見積) 4/30 や 明日(期限) @タグ
 * 例:
 *   市場調査 ~3h 4/10
 *     競合を5社調べる ~2h
 *   ◆ 企画承認 4/30
 */
export function outlineToTasks(text: string, parentId: string | undefined, existing: Task[]): Task[] {
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
  const unit = Math.min(...lines.map(l => l.match(/^[ \t]*/)![0].replace(/\t/g, '  ').length).filter(n => n > 0), 2) || 2
  const out: Task[] = []; const stack: { depth: number; id: string }[] = []; const next = new Map<string | undefined, number>()
  const base = (pid: string | undefined) => { if (!next.has(pid)) next.set(pid, nextOrder([...existing, ...out], pid)); const n = next.get(pid)!; next.set(pid, n + 1); return n }
  for (const raw of lines) {
    const indent = raw.match(/^[ \t]*/)![0].replace(/\t/g, '  ').length
    let body = raw.trim().replace(/^[-・*]\s+/, ''); let milestone = false, isProject = false
    if (body.startsWith('◆')) { milestone = true; body = body.slice(1).trim() } else if (body.startsWith('■')) { isProject = true; body = body.slice(1).trim() }
    const q = parseQuick(body); if (!q.title) continue
    const depth = Math.round(indent / unit)
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].id : parentId
    const { project: _p, ...rest } = q
    const t: Task = { id: uid(), notes: '', done: false, priority: 0, tags: [], repeat: null, subs: [], createdAt: new Date().toISOString(), ...rest, parent, order: base(parent), ...(milestone ? { milestone } : {}), ...(isProject ? { isProject, goal: '', doneWhen: '' } : {}) }
    out.push(t); stack.push({ depth, id: t.id })
  }
  return out
}
