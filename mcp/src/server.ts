import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type { Data, Task, Ev, Note, TreeNode, BNode, BEdge } from '../../src/types'
import { addDays, today, hm, fromHm, dow, uid, addMonths } from '../../src/lib/date'
import { treeToOutline, outlineToTree } from '../../src/lib/outline'
import { mutate, read, describeBackend } from './storage'

const server = new McpServer({ name: 'selfdesk', version: '1.0.0' })
const D = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const T = z.string().regex(/^\d{1,2}:\d{2}$/, 'HH:MM')
const now = () => Date.now()
const stamp = <X extends { u?: number }>(x: X): X => { x.u = now(); return x }
const out = (o: unknown) => ({ content: [{ type: 'text' as const, text: typeof o === 'string' ? o : JSON.stringify(o, null, 1) }] })
const err = (m: string) => ({ isError: true, content: [{ type: 'text' as const, text: m }] })
class Nf extends Error {}
const find = <X extends { id: string }>(l: X[], id: string, what: string): X => { const x = l.find(y => y.id === id); if (!x) throw new Nf(`${what}が見つかりません (id=${id})。list_* で最新のIDを確認してください`); return x }
function wrap<A>(fn: (a: A) => Promise<unknown>) { return async (a: A) => { try { return out(await fn(a)) } catch (e: any) { return err(e?.message || String(e)) } } }
const remove = (d: Data, id: string) => { d.deleted[id] = now() }

const fmtTask = (t: Task) => ({
  id: t.id, title: t.title, done: t.done, due: t.due, priority: t.priority, est_min: t.est, project: t.project || undefined, tags: t.tags.length ? t.tags : undefined,
  repeat: t.repeat || undefined, notes: t.notes || undefined, subtasks: t.subs.length ? t.subs.map((s, i) => ({ index: i, title: s.title, done: s.done })) : undefined,
  time_block: t.block ? { date: t.block.date, start: hm(t.block.start), duration_min: t.block.dur } : undefined,
})
const fmtEv = (e: Ev) => ({ id: e.id, title: e.title, date: e.date, start: e.allDay ? undefined : hm(e.start), duration_min: e.allDay ? undefined : e.dur, all_day: e.allDay || undefined, place: e.place })
const mkTask = (p: Partial<Task> & { title: string }): Task => ({ id: uid(), notes: '', done: false, priority: 0, project: '', tags: [], repeat: null, subs: [], createdAt: new Date().toISOString(), u: now(), ...p })
const ensureProject = (d: Data, p?: string) => { if (p && !d.projects.includes(p)) d.projects.push(p) }

/* ---------------- 読み取り ---------------- */
server.registerTool('get_overview', { description: '指定日(省略で今日)の概況を返す: その日のタスク(期限切れ/当日期限/時間確保済み)、予定、タイムブロック、習慣の状況。まず最初に呼ぶとよい。Googleカレンダーの予定はここには含まれない(別途Google Calendarのツールで確認する)。', inputSchema: { date: D.optional() }, annotations: { readOnlyHint: true } },
  wrap(async ({ date }: { date?: string }) => read(d => {
    const day = date || today()
    const open = d.tasks.filter(t => !t.done)
    return {
      date: day, weekday: '日月火水木金土'[dow(day)],
      overdue: open.filter(t => t.due && t.due < day).map(fmtTask),
      due_today: open.filter(t => t.due === day).map(fmtTask),
      time_blocked_today: open.filter(t => t.block?.date === day).sort((a, b) => a.block!.start - b.block!.start).map(fmtTask),
      events_today: d.events.filter(e => e.date === day).sort((a, b) => a.start - b.start).map(fmtEv),
      habits: d.habits.filter(h => !h.archived && h.days.includes(dow(day))).map(h => ({ id: h.id, name: h.name, done: !!h.log[day] })),
      counts: { open_tasks: open.length, unscheduled_open_tasks: open.filter(t => !t.block).length, notes: d.notes.length },
    }
  })))

server.registerTool('list_tasks', { description: 'タスクを検索・一覧する。status既定は open。結果は期限が近い順→優先度順。', inputSchema: { status: z.enum(['open', 'done', 'all']).optional(), project: z.string().optional(), tag: z.string().optional(), due_from: D.optional(), due_to: D.optional(), scheduled: z.boolean().optional().describe('true=時間確保済みのみ / false=未確保のみ'), query: z.string().optional().describe('タイトル・メモの部分一致'), limit: z.number().int().min(1).max(200).optional() }, annotations: { readOnlyHint: true } },
  wrap(async (a: { status?: string; project?: string; tag?: string; due_from?: string; due_to?: string; scheduled?: boolean; query?: string; limit?: number }) => read(d => {
    let l = d.tasks.filter(t => a.status === 'all' ? true : a.status === 'done' ? t.done : !t.done)
    if (a.project) l = l.filter(t => t.project === a.project); if (a.tag) l = l.filter(t => t.tags.includes(a.tag!))
    if (a.due_from) l = l.filter(t => t.due && t.due >= a.due_from!); if (a.due_to) l = l.filter(t => t.due && t.due <= a.due_to!)
    if (a.scheduled !== undefined) l = l.filter(t => !!t.block === a.scheduled)
    if (a.query) { const q = a.query.toLowerCase(); l = l.filter(t => (t.title + t.notes).toLowerCase().includes(q)) }
    l = l.sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999') || y.priority - x.priority)
    return { total: l.length, tasks: l.slice(0, a.limit || 50).map(fmtTask) }
  })))
server.registerTool('get_task', { description: 'タスク1件の詳細を返す', inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } }, wrap(async ({ id }: { id: string }) => read(d => fmtTask(find(d.tasks, id, 'タスク')))))

server.registerTool('list_events', { description: '期間内の予定(SelfDesk内の予定のみ)を返す。タイムブロックされたタスクは含まれない(list_tasks scheduled=true を使う)。', inputSchema: { from: D, to: D }, annotations: { readOnlyHint: true } },
  wrap(async ({ from, to }: { from: string; to: string }) => read(d => d.events.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).map(fmtEv))))

server.registerTool('find_free_slots', { description: '指定日の空き時間帯を返す。SelfDeskの予定とタイムブロックだけを考慮する(Googleカレンダーの予定は含まない。必要なら別途Google Calendarツールの予定と突き合わせること)。', inputSchema: { date: D, duration_min: z.number().int().min(5).max(600), day_start: T.optional().describe('既定 09:00'), day_end: T.optional().describe('既定 18:00') }, annotations: { readOnlyHint: true } },
  wrap(async (a: { date: string; duration_min: number; day_start?: string; day_end?: string }) => read(d => {
    const s0 = fromHm(a.day_start || '09:00'), e0 = fromHm(a.day_end || '18:00')
    const busy = [...d.events.filter(e => e.date === a.date && !e.allDay).map(e => [e.start, e.start + e.dur]), ...d.tasks.filter(t => t.block?.date === a.date).map(t => [t.block!.start, t.block!.start + t.block!.dur])].sort((x, y) => x[0] - y[0])
    const free: { start: string; end: string; minutes: number }[] = []; let cur = s0
    for (const [b0, b1] of busy) { if (b0 > cur && b0 - cur >= a.duration_min) free.push({ start: hm(cur), end: hm(Math.min(b0, e0)), minutes: Math.min(b0, e0) - cur }); cur = Math.max(cur, b1) }
    if (e0 - cur >= a.duration_min) free.push({ start: hm(cur), end: hm(e0), minutes: e0 - cur })
    return { date: a.date, free_slots: free.filter(f => f.minutes >= a.duration_min) }
  })))

server.registerTool('list_habits', { description: '習慣の一覧と、連続日数・直近14日の達成数を返す', inputSchema: {}, annotations: { readOnlyHint: true } },
  wrap(async () => read(d => d.habits.filter(h => !h.archived).map(h => {
    const td = today(); let st = 0, day = h.log[td] ? td : addDays(td, -1)
    for (let i = 0; i < 800; i++) { if (!h.days.includes(dow(day))) { day = addDays(day, -1); continue } if (h.log[day]) { st++; day = addDays(day, -1) } else break }
    return { id: h.id, name: h.name, weekdays: h.days, done_today: !!h.log[td], streak: st, done_last_14_days: Array.from({ length: 14 }, (_, i) => addDays(td, -i)).filter(x => h.log[x]).length }
  }))))

server.registerTool('list_notes', { description: 'メモの一覧(ドキュメント/ロジックツリー/ホワイトボード)。本文は get_note で取得する。', inputSchema: { query: z.string().optional(), kind: z.enum(['doc', 'tree', 'board']).optional() }, annotations: { readOnlyHint: true } },
  wrap(async (a: { query?: string; kind?: string }) => read(d => d.notes.filter(n => (!a.kind || n.kind === a.kind) && (!a.query || (n.title + n.body + n.tree.map(t => t.text).join(' ') + n.nodes.map(t => t.text).join(' ')).toLowerCase().includes(a.query.toLowerCase()))).map(n => ({ id: n.id, title: n.title, kind: n.kind, pinned: n.pinned || undefined, updated: n.updatedAt })))))
server.registerTool('get_note', { description: 'メモの中身を返す。ドキュメントはMarkdown本文、ツリーはノードIDつきのインデント表記、ボードは付箋と接続。', inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } },
  wrap(async ({ id }: { id: string }) => read(d => {
    const n = find(d.notes, id, 'メモ')
    if (n.kind === 'doc') return { id, title: n.title, kind: n.kind, body: n.body }
    if (n.kind === 'tree') return { id, title: n.title, kind: n.kind, outline: treeToOutline(n.tree), nodes: n.tree.map(t => ({ id: t.id, text: t.text, parent: t.parent })) }
    return { id, title: n.title, kind: n.kind, nodes: n.nodes.map(x => ({ id: x.id, kind: x.kind, text: x.text })), edges: n.edges.map(e => ({ from: e.from, to: e.to })) }
  })))
server.registerTool('get_review', { description: '振り返りを取得。keyは日次なら YYYY-MM-DD、週次なら W+その週の月曜日(例 W2026-11-16)。', inputSchema: { key: z.string() }, annotations: { readOnlyHint: true } }, wrap(async ({ key }: { key: string }) => read(d => d.reviews[key] ?? null)))

/* ---------------- タスク ---------------- */
const prio = z.number().int().min(0).max(3).describe('0=なし,1=低,2=中,3=高')
server.registerTool('add_task', { description: 'タスクを追加する。時間まで確保するなら、続けて schedule_task を呼ぶ。', inputSchema: { title: z.string().min(1), due: D.optional(), priority: prio.optional(), est_min: z.number().int().min(1).optional(), project: z.string().optional(), tags: z.array(z.string()).optional(), repeat: z.enum(['daily', 'weekly', 'monthly']).optional(), notes: z.string().optional(), subtasks: z.array(z.string()).optional() } },
  wrap(async (a: { title: string; due?: string; priority?: number; est_min?: number; project?: string; tags?: string[]; repeat?: 'daily' | 'weekly' | 'monthly'; notes?: string; subtasks?: string[] }) => mutate(d => {
    const t = mkTask({ title: a.title, due: a.due, priority: (a.priority ?? 0) as 0, est: a.est_min, project: a.project || '', tags: a.tags || [], repeat: a.repeat || null, notes: a.notes || '', subs: (a.subtasks || []).map(s => ({ id: uid(), title: s, done: false })) })
    d.tasks.unshift(t); ensureProject(d, a.project); return fmtTask(t)
  }, 'MCP: タスク追加')))
server.registerTool('update_task', { description: 'タスクを更新する。指定した項目だけ変わる。due / est_min に null を渡すと解除。完了は complete_task を使う。', inputSchema: { id: z.string(), title: z.string().optional(), due: D.nullable().optional(), priority: prio.optional(), est_min: z.number().int().min(1).nullable().optional(), project: z.string().optional(), tags: z.array(z.string()).optional(), repeat: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(), notes: z.string().optional() } },
  wrap(async (a: { id: string; title?: string; due?: string | null; priority?: number; est_min?: number | null; project?: string; tags?: string[]; repeat?: 'daily' | 'weekly' | 'monthly' | null; notes?: string }) => mutate(d => {
    const t = find(d.tasks, a.id, 'タスク')
    if (a.title !== undefined) t.title = a.title; if (a.due !== undefined) t.due = a.due || undefined; if (a.priority !== undefined) t.priority = a.priority as 0
    if (a.est_min !== undefined) t.est = a.est_min || undefined; if (a.project !== undefined) { t.project = a.project; ensureProject(d, a.project) }
    if (a.tags) t.tags = a.tags; if (a.repeat !== undefined) t.repeat = a.repeat; if (a.notes !== undefined) t.notes = a.notes
    stamp(t); return fmtTask(t)
  }, 'MCP: タスク更新')))
server.registerTool('complete_task', { description: 'タスクを完了(または done=false で未完了に戻す)。繰り返しタスクは完了ではなく次の期限へ進む。', inputSchema: { id: z.string(), done: z.boolean().optional() } },
  wrap(async ({ id, done }: { id: string; done?: boolean }) => mutate(d => {
    const t = find(d.tasks, id, 'タスク'); const want = done ?? true
    if (want && !t.done && t.repeat) {
      const base = t.due || today(); t.due = t.repeat === 'daily' ? addDays(base, 1) : t.repeat === 'weekly' ? addDays(base, 7) : addMonths(base, 1).replace(/-\d\d$/, base.slice(-3))
      if (t.block) t.block = { date: t.due, start: t.block.start, dur: t.block.dur }; t.subs.forEach(s => { s.done = false })
    } else { t.done = want; t.doneAt = want ? new Date().toISOString() : undefined }
    stamp(t); return fmtTask(t)
  }, 'MCP: タスク完了')))
server.registerTool('delete_task', { description: 'タスクを削除する(元に戻せない)', inputSchema: { id: z.string() }, annotations: { destructiveHint: true } },
  wrap(async ({ id }: { id: string }) => mutate(d => { const t = find(d.tasks, id, 'タスク'); d.tasks = d.tasks.filter(x => x !== t); remove(d, id); return { deleted: id, title: t.title } }, 'MCP: タスク削除')))
server.registerTool('add_subtask', { description: 'タスクにサブタスクを追加', inputSchema: { task_id: z.string(), title: z.string().min(1) } },
  wrap(async (a: { task_id: string; title: string }) => mutate(d => { const t = find(d.tasks, a.task_id, 'タスク'); t.subs.push({ id: uid(), title: a.title, done: false }); stamp(t); return fmtTask(t) })))
server.registerTool('set_subtask_done', { description: 'サブタスクの完了状態を変更(indexはget_taskのsubtasks.index)', inputSchema: { task_id: z.string(), index: z.number().int().min(0), done: z.boolean() } },
  wrap(async (a: { task_id: string; index: number; done: boolean }) => mutate(d => { const t = find(d.tasks, a.task_id, 'タスク'); if (!t.subs[a.index]) throw new Nf('サブタスクが見つかりません'); t.subs[a.index].done = a.done; stamp(t); return fmtTask(t) })))
server.registerTool('schedule_task', { description: 'タスクに時間を確保する(タイムブロック)。既存の予定やブロックと重ならないよう、先に find_free_slots で空きを確認すること。', inputSchema: { id: z.string(), date: D, start: T, duration_min: z.number().int().min(5).max(720).optional().describe('省略時はタスクの見積、それも無ければ30分') } },
  wrap(async (a: { id: string; date: string; start: string; duration_min?: number }) => mutate(d => {
    const t = find(d.tasks, a.id, 'タスク'); const dur = a.duration_min || t.est || 30; const s = fromHm(a.start)
    const clash = [...d.events.filter(e => e.date === a.date && !e.allDay && e.start < s + dur && s < e.start + e.dur).map(e => `予定「${e.title}」${hm(e.start)}-${hm(e.start + e.dur)}`), ...d.tasks.filter(x => x.id !== t.id && x.block?.date === a.date && x.block.start < s + dur && s < x.block.start + x.block.dur).map(x => `ブロック「${x.title}」${hm(x.block!.start)}-${hm(x.block!.start + x.block!.dur)}`)]
    t.block = { date: a.date, start: s, dur }; stamp(t)
    return { ...fmtTask(t), warning: clash.length ? '次と時間が重なっています: ' + clash.join(' / ') : undefined }
  }, 'MCP: タイムブロック')))
server.registerTool('unschedule_task', { description: 'タスクのタイムブロックを解除する', inputSchema: { id: z.string() } },
  wrap(async ({ id }: { id: string }) => mutate(d => { const t = find(d.tasks, id, 'タスク'); t.block = undefined; stamp(t); return fmtTask(t) })))

/* ---------------- 予定 ---------------- */
server.registerTool('add_event', { description: 'SelfDeskのカレンダーに予定を追加する(Googleカレンダーには作られない。Googleに作る場合はGoogle Calendarのツールを使う)。', inputSchema: { title: z.string().min(1), date: D, start: T.optional(), duration_min: z.number().int().min(5).optional(), all_day: z.boolean().optional(), place: z.string().optional() } },
  wrap(async (a: { title: string; date: string; start?: string; duration_min?: number; all_day?: boolean; place?: string }) => mutate(d => { const e: Ev = { id: uid(), title: a.title, date: a.date, start: a.start ? fromHm(a.start) : 540, dur: a.duration_min || 60, allDay: a.all_day, place: a.place, source: 'local', u: now() }; d.events.push(e); return fmtEv(e) }, 'MCP: 予定追加')))
server.registerTool('update_event', { description: '予定を更新する(指定した項目だけ変わる)', inputSchema: { id: z.string(), title: z.string().optional(), date: D.optional(), start: T.optional(), duration_min: z.number().int().min(5).optional(), place: z.string().optional() } },
  wrap(async (a: { id: string; title?: string; date?: string; start?: string; duration_min?: number; place?: string }) => mutate(d => { const e = find(d.events, a.id, '予定'); if (a.title) e.title = a.title; if (a.date) e.date = a.date; if (a.start) e.start = fromHm(a.start); if (a.duration_min) e.dur = a.duration_min; if (a.place !== undefined) e.place = a.place; stamp(e); return fmtEv(e) }, 'MCP: 予定更新')))
server.registerTool('delete_event', { description: '予定を削除する', inputSchema: { id: z.string() }, annotations: { destructiveHint: true } },
  wrap(async ({ id }: { id: string }) => mutate(d => { const e = find(d.events, id, '予定'); d.events = d.events.filter(x => x !== e); remove(d, id); return { deleted: id, title: e.title } }, 'MCP: 予定削除')))

/* ---------------- 習慣 ---------------- */
server.registerTool('add_habit', { description: '習慣を追加する。weekdays は 0=日〜6=土(省略で毎日)', inputSchema: { name: z.string().min(1), weekdays: z.array(z.number().int().min(0).max(6)).optional() } },
  wrap(async (a: { name: string; weekdays?: number[] }) => mutate(d => { const h = { id: uid(), name: a.name, days: a.weekdays?.length ? a.weekdays : [0, 1, 2, 3, 4, 5, 6], log: {}, createdAt: new Date().toISOString(), u: now() }; d.habits.push(h); return { id: h.id, name: h.name } }, 'MCP: 習慣追加')))
server.registerTool('log_habit', { description: '習慣の達成を記録する(done=false で取り消し)。dateの既定は今日。', inputSchema: { id: z.string(), date: D.optional(), done: z.boolean().optional() } },
  wrap(async (a: { id: string; date?: string; done?: boolean }) => mutate(d => { const h = find(d.habits, a.id, '習慣'); const day = a.date || today(); if (a.done === false) delete h.log[day]; else h.log[day] = true; stamp(h); return { id: h.id, name: h.name, date: day, done: !!h.log[day] } }, 'MCP: 習慣記録')))
server.registerTool('archive_habit', { description: '習慣をアーカイブ(一覧から隠す。記録は残る)', inputSchema: { id: z.string() } },
  wrap(async ({ id }: { id: string }) => mutate(d => { const h = find(d.habits, id, '習慣'); h.archived = true; stamp(h); return { archived: id } })))

/* ---------------- メモ ---------------- */
const mkNote = (kind: Note['kind'], title: string, extra: Partial<Note> = {}): Note => { const t = new Date().toISOString(); return { id: uid(), title, kind, body: '', tree: [], nodes: [], edges: [], strokes: [], tags: [], createdAt: t, updatedAt: t, u: now(), ...extra } }
server.registerTool('add_note', { description: 'Markdownのドキュメントメモを作る。チェックリスト(- [ ] ...)や [[他のメモのタイトル]] が使える。', inputSchema: { title: z.string(), body: z.string(), pinned: z.boolean().optional() } },
  wrap(async (a: { title: string; body: string; pinned?: boolean }) => mutate(d => { const n = mkNote('doc', a.title, { body: a.body, pinned: a.pinned }); d.notes.unshift(n); return { id: n.id, title: n.title } }, 'MCP: メモ追加')))
server.registerTool('update_note', { description: 'ドキュメントメモを更新。body で置換、append で末尾に追記。', inputSchema: { id: z.string(), title: z.string().optional(), body: z.string().optional(), append: z.string().optional(), pinned: z.boolean().optional() } },
  wrap(async (a: { id: string; title?: string; body?: string; append?: string; pinned?: boolean }) => mutate(d => { const n = find(d.notes, a.id, 'メモ'); if (a.title !== undefined) n.title = a.title; if (a.pinned !== undefined) n.pinned = a.pinned; if (a.body !== undefined) { if (n.kind !== 'doc') throw new Error('body はドキュメントメモにのみ使えます'); n.body = a.body } if (a.append) { if (n.kind !== 'doc') throw new Error('append はドキュメントメモにのみ使えます'); n.body = (n.body ? n.body.replace(/\n*$/, '\n') : '') + a.append } n.updatedAt = new Date().toISOString(); stamp(n); return { id: n.id, title: n.title } }, 'MCP: メモ更新')))
server.registerTool('add_tree_note', { description: 'ロジックツリーを新規作成する。outline は2スペースのインデントで階層を表し、1行目がルート(中心テーマ)。例: "課題\\n  原因A\\n    詳細\\n  原因B"', inputSchema: { title: z.string(), outline: z.string().min(1) } },
  wrap(async (a: { title: string; outline: string }) => mutate(d => { const n = mkNote('tree', a.title, { tree: outlineToTree(a.outline) }); d.notes.unshift(n); return { id: n.id, title: n.title, nodes: n.tree.length } }, 'MCP: ツリー追加')))
server.registerTool('add_tree_children', { description: '既存ロジックツリーにノードを追加する。parent_node_id 省略でルートの子。outline を使うと孫以降も一度に追加できる(相対インデント)。', inputSchema: { note_id: z.string(), parent_node_id: z.string().optional(), outline: z.string().min(1) } },
  wrap(async (a: { note_id: string; parent_node_id?: string; outline: string }) => mutate(d => {
    const n = find(d.notes, a.note_id, 'メモ'); if (n.kind !== 'tree') throw new Error('ロジックツリーではありません')
    const parent = a.parent_node_id ? find(n.tree, a.parent_node_id, 'ノード') : n.tree.find(x => x.parent === null)!
    const sub = outlineToTree('__root__\n' + a.outline.split('\n').map(l => '  ' + l).join('\n')); const map = new Map<string, string>(); const rootId = sub[0].id; map.set(rootId, parent.id)
    let added = 0; const base = n.tree.filter(x => x.parent === parent.id).length
    for (const s of sub.slice(1)) { const id = uid(); map.set(s.id, id); n.tree.push({ id, text: s.text, parent: map.get(s.parent!)!, order: s.parent === rootId ? base + s.order : s.order } as TreeNode); added++ }
    parent.collapsed = false; n.updatedAt = new Date().toISOString(); stamp(n); return { added, outline: treeToOutline(n.tree) }
  }, 'MCP: ツリー拡張')))
server.registerTool('add_board_note', { description: 'ホワイトボードを新規作成する。items は付箋(sticky)などの配列で、自動で格子状に配置される。links は items の添字ペア [from,to] で矢印を引く。', inputSchema: { title: z.string(), items: z.array(z.object({ text: z.string(), kind: z.enum(['sticky', 'text', 'rect', 'ellipse']).optional(), color: z.number().int().min(0).max(4).optional() })).min(1), links: z.array(z.tuple([z.number().int(), z.number().int()])).optional(), columns: z.number().int().min(1).max(8).optional() } },
  wrap(async (a: { title: string; items: { text: string; kind?: BNode['kind']; color?: number }[]; links?: [number, number][]; columns?: number }) => mutate(d => {
    const cols = a.columns || Math.ceil(Math.sqrt(a.items.length)); const nodes: BNode[] = a.items.map((it, i) => ({ id: uid(), kind: it.kind || 'sticky', x: 40 + (i % cols) * 230, y: 40 + Math.floor(i / cols) * 170, w: 180, h: 120, text: it.text, color: it.color ?? ((it.kind || 'sticky') === 'sticky' ? 1 : 0) }))
    const edges: BEdge[] = (a.links || []).filter(([x, y]) => nodes[x] && nodes[y]).map(([x, y]) => ({ id: uid(), from: nodes[x].id, to: nodes[y].id }))
    const n = mkNote('board', a.title, { nodes, edges }); d.notes.unshift(n); return { id: n.id, title: n.title, nodes: nodes.length }
  }, 'MCP: ボード追加')))
server.registerTool('delete_note', { description: 'メモを削除する(元に戻せない)', inputSchema: { id: z.string() }, annotations: { destructiveHint: true } },
  wrap(async ({ id }: { id: string }) => mutate(d => { const n = find(d.notes, id, 'メモ'); d.notes = d.notes.filter(x => x !== n); remove(d, id); return { deleted: id, title: n.title } }, 'MCP: メモ削除')))

/* ---------------- 振り返り ---------------- */
server.registerTool('save_review', { description: '日次/週次の振り返りを保存する。keyは日次なら YYYY-MM-DD、週次なら W+その週の月曜日(例 W2026-11-16)。指定した項目だけ上書き。', inputSchema: { key: z.string().regex(/^(W)?\d{4}-\d{2}-\d{2}$/), wins: z.string().optional(), lessons: z.string().optional(), next: z.string().optional(), mood: z.number().int().min(1).max(5).optional() } },
  wrap(async (a: { key: string; wins?: string; lessons?: string; next?: string; mood?: number }) => mutate(d => { const r = d.reviews[a.key] || { wins: '', lessons: '', next: '', mood: 3 }; if (a.wins !== undefined) r.wins = a.wins; if (a.lessons !== undefined) r.lessons = a.lessons; if (a.next !== undefined) r.next = a.next; if (a.mood !== undefined) r.mood = a.mood; d.reviews[a.key] = stamp(r); return { key: a.key, ...r } }, 'MCP: 振り返り')))

await server.connect(new StdioServerTransport())
console.error(`[selfdesk-mcp] ready (${describeBackend()})`)
