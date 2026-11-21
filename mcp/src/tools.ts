import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Data, Task, Ev, Note, TreeNode, BNode, BEdge, Wish } from '../../src/types'
import { addDays, today, hm, fromHm, dow, uid, addMonths } from '../../src/lib/date'
import { treeToOutline, outlineToTree } from '../../src/lib/outline'
import { ancestors, childrenOf, descendants, hasChildren, isActionable, nextOrder, projectOf, rollup, rootProjects, wbs, canMove } from '../../src/core/tree'
import { outlineToTasks } from '../../src/core/wbs-outline'
import { validateItem, type CollectionDef } from '../../src/core/collections'
import { COLLECTIONS } from '../../src/collections'
import type { IO } from './io'

export const GUIDE = `SelfDesk はユーザーの生活管理の「正(source of truth)」です。予定・タスク・メモ・プロジェクトについて、推測や記憶で答えず、必ずこのサーバーで確認してから答える/変更してください。
■ 進め方
- まず get_overview(今日の概況)。日付は YYYY-MM-DD、時刻は24時間表記 HH:MM(ユーザーのローカル時刻)。
- 時間を確保するときは find_free_slots で空きを確認してから schedule_task。Googleカレンダーの予定はここには入っていない(別のGoogle Calendarツールで確認する)。
- 書き込みは即座に全端末へ同期される。削除系(delete_*)は元に戻せないので、ユーザーの意図が明確なときだけ行う。
■ データの考え方
- プロジェクト・タスク・Todoは「1本の階層ツリー」。プロジェクト = 目標(goal)と完了条件(done_when)を持つ項目(is_project=true)。子を持つ項目はWBSの親、子を持たない項目(葉)が実際に手を動かす単位。葉の中の細かい手順は subtasks(Todo)。
- 境界は主観。迷ったら葉のタスクとして作り、規模が大きいと分かったら update_task is_project=true で昇格させる。WBSは add_wbs で、インデントのアウトラインから一括作成できる。
- 進捗は葉の完了率から自動計算される(get_project / list_projects)。プロジェクト自体を完了にするのは、完了条件を満たしたとユーザーが言ったとき。
- やりたいこと(wishes)は義務ではない願望リスト(例: 下呂温泉に行く)。プロジェクトとは別。「やる」と決まったら promote_wish、叶ったら complete_wish(感想も残す)。
- ツール拡張のデータは コレクション(collection_schemas で一覧)。専用ツールが無い種類のデータは collection_* で読み書きする。
- 横断検索は search。`

const D = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const T = z.string().regex(/^\d{1,2}:\d{2}$/, 'HH:MM')
const now = () => Date.now()
const stamp = <X extends { u?: number }>(x: X): X => { x.u = now(); return x }
const out = (o: unknown) => ({ content: [{ type: 'text' as const, text: typeof o === 'string' ? o : JSON.stringify(o, null, 1) }] })
const err = (m: string) => ({ isError: true, content: [{ type: 'text' as const, text: m }] })
class Nf extends Error {}
const find = <X extends { id: string }>(l: X[], id: string, what: string): X => { const x = l.find(y => y.id === id); if (!x) throw new Nf(`${what}が見つかりません (id=${id})。list_* / search で最新のIDを確認してください`); return x }
function wrap<A>(fn: (a: A) => Promise<unknown>) { return async (a: A) => { try { return out(await fn(a)) } catch (e: any) { return err(e?.message || String(e)) } } }
const remove = (d: Data, id: string) => { d.deleted[id] = now() }

/** fmtTask が所属プロジェクトを引くための現在のデータ(mutate/read の直前に設定される。同期処理内でのみ使う) */
let CUR: Data | undefined
const fmtTask = (t: Task) => {
  const pj = CUR ? projectOf(CUR.tasks, t.id) : undefined
  return {
    id: t.id, title: t.title, done: t.done, due: t.due, start: t.start, priority: t.priority, est_min: t.est, project: pj?.title, project_id: pj?.id, parent_id: t.parent,
    is_project: t.isProject || undefined, milestone: t.milestone || undefined, goal: t.goal || undefined, done_when: t.doneWhen || undefined, archived: t.archived || undefined,
    tags: t.tags.length ? t.tags : undefined, repeat: t.repeat || undefined, notes: t.notes || undefined, subtasks: t.subs.length ? t.subs.map((s, i) => ({ index: i, title: s.title, done: s.done })) : undefined,
    time_block: t.block ? { date: t.block.date, start: hm(t.block.start), duration_min: t.block.dur } : undefined,
  }
}
const fmtEv = (e: Ev) => ({ id: e.id, title: e.title, date: e.date, start: e.allDay ? undefined : hm(e.start), duration_min: e.allDay ? undefined : e.dur, all_day: e.allDay || undefined, place: e.place })
const mkTask = (p: Partial<Task> & { title: string }): Task => ({ id: uid(), notes: '', done: false, priority: 0, tags: [], repeat: null, subs: [], createdAt: new Date().toISOString(), u: now(), ...p })
const fmtWish = (w: Wish) => ({ id: w.id, title: w.title, status: w.status, category: w.category, target: w.target, note: w.note || undefined, project_id: w.project, done_at: w.doneAt, reflection: w.reflection })
const fmtRoll = (d: Data, t: Task) => { const r = rollup(d.tasks, t.id, today()); return { progress_pct: r.pct, leaves: r.leaves, leaves_done: r.done, est_min: r.estMin, remaining_min: r.remainMin, start: r.start, end: r.end, overdue: r.overdue } }
/** 名前またはIDでプロジェクト/項目を探す。create=true なら無いとき名前でプロジェクトを作る */
function resolveProject(d: Data, ref: string, create = false): Task {
  const byId = d.tasks.find(t => t.id === ref); if (byId) return byId
  const byName = d.tasks.find(t => t.isProject && t.title === ref) ?? d.tasks.find(t => t.title === ref); if (byName) return byName
  if (!create) throw new Nf(`プロジェクト「${ref}」が見つかりません。list_projects で確認してください`)
  const p = mkTask({ title: ref, isProject: true, goal: '', doneWhen: '', order: nextOrder(d.tasks, undefined) }); d.tasks.unshift(p); return p
}
const collection = (id: string): CollectionDef => { const c = COLLECTIONS.find(x => x.id === id); if (!c) throw new Nf(`コレクション "${id}" がありません。collection_schemas で確認してください`); return c }

export function createServer(io: IO): McpServer {
  const mutate: IO['mutate'] = (fn, msg) => io.mutate(d => { CUR = d; return fn(d) }, msg)
  const read: IO['read'] = fn => io.read(d => { CUR = d; return fn(d) })
  const server = new McpServer({ name: 'selfdesk', version: '2.0.0' }, { instructions: GUIDE })
  server.registerTool('get_guide', { description: 'SelfDesk の使い方とデータの考え方(プロジェクト/タスク/やりたいこと/コレクション)を返す。迷ったら読む。', inputSchema: {}, annotations: { readOnlyHint: true } }, async () => out(GUIDE))

  /* ---------------- 読み取り ---------------- */
  server.registerTool('get_overview', { description: '指定日(省略で今日)の概況を返す: その日のタスク(期限切れ/当日期限/時間確保済み)、予定、習慣、進行中のプロジェクトの進捗、やりたいこと件数。まず最初に呼ぶとよい。Googleカレンダーの予定は含まれない。', inputSchema: { date: D.optional() }, annotations: { readOnlyHint: true } },
    wrap(async ({ date }: { date?: string }) => read(d => {
      const day = date || today()
      const open = d.tasks.filter(t => !t.done && isActionable(d.tasks, t))
      return {
        date: day, weekday: '日月火水木金土'[dow(day)],
        overdue: open.filter(t => t.due && t.due < day).map(fmtTask),
        due_today: open.filter(t => t.due === day).map(fmtTask),
        time_blocked_today: open.filter(t => t.block?.date === day).sort((a, b) => a.block!.start - b.block!.start).map(fmtTask),
        events_today: d.events.filter(e => e.date === day).sort((a, b) => a.start - b.start).map(fmtEv),
        habits: d.habits.filter(h => !h.archived && h.days.includes(dow(day))).map(h => ({ id: h.id, name: h.name, done: !!h.log[day] })),
        active_projects: rootProjects(d.tasks).filter(p => !p.done && !p.archived).map(p => ({ id: p.id, title: p.title, goal: p.goal || undefined, ...fmtRoll(d, p) })),
        upcoming_milestones: d.tasks.filter(t => t.milestone && !t.done && t.due && t.due >= day).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 5).map(fmtTask),
        wishes: { planned: d.wishes.filter(w => w.status === 'planned').length, someday: d.wishes.filter(w => w.status === 'someday').length },
        counts: { open_tasks: open.length, unscheduled_open_tasks: open.filter(t => !t.block).length, notes: d.notes.length },
      }
    })))

  server.registerTool('list_tasks', { description: 'タスクを検索・一覧する。status既定は open。結果は期限が近い順→優先度順。既定は「実際に手を動かす葉のタスク」のみ。プロジェクトやWBSの親も含めるなら level=all。project はプロジェクト名またはID(配下すべてが対象)。', inputSchema: { status: z.enum(['open', 'done', 'all']).optional(), project: z.string().optional(), level: z.enum(['actionable', 'all']).optional(), tag: z.string().optional(), due_from: D.optional(), due_to: D.optional(), scheduled: z.boolean().optional().describe('true=時間確保済みのみ / false=未確保のみ'), query: z.string().optional().describe('タイトル・メモの部分一致'), limit: z.number().int().min(1).max(200).optional() }, annotations: { readOnlyHint: true } },
    wrap(async (a: { status?: string; project?: string; level?: string; tag?: string; due_from?: string; due_to?: string; scheduled?: boolean; query?: string; limit?: number }) => read(d => {
      let l = d.tasks.filter(t => a.status === 'all' ? true : a.status === 'done' ? t.done : !t.done)
      if (a.level !== 'all') l = l.filter(t => isActionable(d.tasks, t))
      if (a.project) { const p = resolveProject(d, a.project); const ids = new Set(descendants(d.tasks, p.id).map(x => x.id)); l = l.filter(t => ids.has(t.id)) }
      if (a.tag) l = l.filter(t => t.tags.includes(a.tag!))
      if (a.due_from) l = l.filter(t => t.due && t.due >= a.due_from!); if (a.due_to) l = l.filter(t => t.due && t.due <= a.due_to!)
      if (a.scheduled !== undefined) l = l.filter(t => !!t.block === a.scheduled)
      if (a.query) { const q = a.query.toLowerCase(); l = l.filter(t => (t.title + t.notes).toLowerCase().includes(q)) }
      l = l.sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999') || y.priority - x.priority)
      return { total: l.length, tasks: l.slice(0, a.limit || 50).map(fmtTask) }
    })))
  server.registerTool('get_task', { description: 'タスク(またはプロジェクト)1件の詳細を返す', inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } }, wrap(async ({ id }: { id: string }) => read(d => fmtTask(find(d.tasks, id, 'タスク')))))

  /* ---------------- プロジェクト(階層ツリー) ---------------- */
  server.registerTool('list_projects', { description: 'プロジェクトの一覧と進捗。parent_id 省略でトップレベル、指定でその直下の子プロジェクト。進捗は配下の葉タスクの完了率。', inputSchema: { status: z.enum(['open', 'done', 'all']).optional(), parent_id: z.string().optional() }, annotations: { readOnlyHint: true } },
    wrap(async (a: { status?: string; parent_id?: string }) => read(d => {
      const base = a.parent_id ? childrenOf(d.tasks, a.parent_id).filter(t => t.isProject) : rootProjects(d.tasks)
      return base.filter(p => !p.archived && (a.status === 'all' ? true : a.status === 'done' ? p.done : !p.done)).map(p => ({ ...fmtTask(p), ...fmtRoll(d, p), child_projects: childrenOf(d.tasks, p.id).filter(c => c.isProject).length }))
    })))
  server.registerTool('get_project', { description: 'プロジェクト1件の全体像: 目標・完了条件・アプローチ、進捗、マイルストーン、WBS(階層と番号つき)。WBSの各行のIDで update_task / complete_task / move_task ができる。', inputSchema: { id: z.string().describe('プロジェクトのIDまたは名前'), include_done: z.boolean().optional().describe('完了済みの項目もWBSに含める(既定 true)') }, annotations: { readOnlyHint: true } },
    wrap(async (a: { id: string; include_done?: boolean }) => read(d => {
      const p = resolveProject(d, a.id); const rows = wbs(d.tasks, p.id).filter(r => a.include_done === false ? !r.t.done : true)
      return {
        ...fmtTask(p), approach: p.approach || undefined, ...fmtRoll(d, p), path: ancestors(d.tasks, p.id).reverse().map(x => x.title),
        milestones: descendants(d.tasks, p.id).filter(t => t.milestone).sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999')).map(fmtTask),
        wbs: rows.map(r => ({ code: r.code, id: r.t.id, depth: r.depth, title: r.t.title, done: r.t.done, due: r.t.due, est_min: r.t.est, milestone: r.t.milestone || undefined, is_project: r.t.isProject || undefined, progress_pct: hasChildren(d.tasks, r.t.id) ? rollup(d.tasks, r.t.id, today()).pct : undefined })),
      }
    })))
  server.registerTool('create_project', { description: 'プロジェクトを作る。goal(目標)と done_when(完了条件)を必ず聞いて/考えて入れる。wbs_outline でWBSも同時に作れる(add_wbs と同じ書式)。parent_id を指定すると子プロジェクトになる。', inputSchema: { title: z.string().min(1), goal: z.string().optional(), done_when: z.string().optional(), approach: z.string().optional().describe('進め方・方針(Markdown)'), parent_id: z.string().optional(), start: D.optional(), due: D.optional(), wbs_outline: z.string().optional() } },
    wrap(async (a: { title: string; goal?: string; done_when?: string; approach?: string; parent_id?: string; start?: string; due?: string; wbs_outline?: string }) => mutate(d => {
      if (a.parent_id) find(d.tasks, a.parent_id, '親')
      const p = mkTask({ title: a.title, isProject: true, goal: a.goal || '', doneWhen: a.done_when || '', approach: a.approach, parent: a.parent_id, start: a.start, due: a.due, order: nextOrder(d.tasks, a.parent_id) })
      d.tasks.unshift(p); const kids = a.wbs_outline ? outlineToTasks(a.wbs_outline, p.id, d.tasks) : []; kids.forEach(k => { k.u = now() }); d.tasks.unshift(...kids)
      return { ...fmtTask(p), wbs_items_created: kids.length }
    }, 'MCP: プロジェクト作成')))
  server.registerTool('add_wbs', { description: 'インデントで書いたWBSを、parent_id(プロジェクトまたはタスク)の下にまとめて追加する。1行=1項目、2スペースで1階層下げる。先頭 "◆"=マイルストーン / "■"=子プロジェクト。行内記法: ~2h(見積) 4/30(期限) !2(優先度) @タグ。例:\n市場調査 ~3h 4/10\n  競合を5社調べる ~2h\n◆ 企画承認 4/30', inputSchema: { parent_id: z.string(), outline: z.string().min(1) } },
    wrap(async (a: { parent_id: string; outline: string }) => mutate(d => {
      const par = resolveProject(d, a.parent_id); const ts = outlineToTasks(a.outline, par.id, d.tasks); ts.forEach(t => { t.u = now() }); d.tasks.unshift(...ts)
      return { created: ts.length, project: par.title, items: ts.map(t => ({ id: t.id, title: t.title, parent_id: t.parent })) }
    }, 'MCP: WBS追加')))
  server.registerTool('move_task', { description: 'タスク/プロジェクトの親を付け替える(parent_id=null でトップへ)。循環する移動は拒否される。', inputSchema: { id: z.string(), parent_id: z.string().nullable() } },
    wrap(async (a: { id: string; parent_id: string | null }) => mutate(d => {
      const t = find(d.tasks, a.id, 'タスク'); const np = a.parent_id ? find(d.tasks, a.parent_id, '親').id : undefined
      if (!canMove(d.tasks, t.id, np)) throw new Error('自分自身や子孫を親にはできません')
      t.parent = np; t.order = nextOrder(d.tasks.filter(x => x.id !== t.id), np); stamp(t); return fmtTask(t)
    }, 'MCP: 移動')))

  /* ---------------- タスク ---------------- */
  const prio = z.number().int().min(0).max(3).describe('0=なし,1=低,2=中,3=高')
  server.registerTool('add_task', { description: 'タスクを追加する。project はプロジェクト名またはID(無ければ名前で新規プロジェクトを作る)、parent_id はWBSの親。時間まで確保するなら、続けて schedule_task を呼ぶ。', inputSchema: { title: z.string().min(1), due: D.optional(), start: D.optional(), priority: prio.optional(), est_min: z.number().int().min(1).optional(), project: z.string().optional(), parent_id: z.string().optional(), milestone: z.boolean().optional(), tags: z.array(z.string()).optional(), repeat: z.enum(['daily', 'weekly', 'monthly']).optional(), notes: z.string().optional(), subtasks: z.array(z.string()).optional() } },
    wrap(async (a: { title: string; due?: string; start?: string; priority?: number; est_min?: number; project?: string; parent_id?: string; milestone?: boolean; tags?: string[]; repeat?: 'daily' | 'weekly' | 'monthly'; notes?: string; subtasks?: string[] }) => mutate(d => {
      const parent = a.parent_id ? find(d.tasks, a.parent_id, '親').id : a.project ? resolveProject(d, a.project, true).id : undefined
      const t = mkTask({ title: a.title, due: a.due, start: a.start, priority: (a.priority ?? 0) as 0, est: a.est_min, parent, order: nextOrder(d.tasks, parent), milestone: a.milestone || undefined, tags: a.tags || [], repeat: a.repeat || null, notes: a.notes || '', subs: (a.subtasks || []).map(s => ({ id: uid(), title: s, done: false })) })
      d.tasks.unshift(t); return fmtTask(t)
    }, 'MCP: タスク追加')))
  server.registerTool('update_task', { description: 'タスク/プロジェクトを更新する。指定した項目だけ変わる。due/start/est_min/parent_id に null で解除。is_project=true でプロジェクトに昇格(goal / done_when も設定する)、false で降格。完了は complete_task を使う。', inputSchema: { id: z.string(), title: z.string().optional(), due: D.nullable().optional(), start: D.nullable().optional(), priority: prio.optional(), est_min: z.number().int().min(1).nullable().optional(), parent_id: z.string().nullable().optional(), milestone: z.boolean().optional(), is_project: z.boolean().optional(), goal: z.string().optional(), done_when: z.string().optional(), approach: z.string().optional(), archived: z.boolean().optional(), tags: z.array(z.string()).optional(), repeat: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(), notes: z.string().optional() } },
    wrap(async (a: { id: string; title?: string; due?: string | null; start?: string | null; priority?: number; est_min?: number | null; parent_id?: string | null; milestone?: boolean; is_project?: boolean; goal?: string; done_when?: string; approach?: string; archived?: boolean; tags?: string[]; repeat?: 'daily' | 'weekly' | 'monthly' | null; notes?: string }) => mutate(d => {
      const t = find(d.tasks, a.id, 'タスク')
      if (a.title !== undefined) t.title = a.title; if (a.due !== undefined) t.due = a.due || undefined; if (a.start !== undefined) t.start = a.start || undefined; if (a.priority !== undefined) t.priority = a.priority as 0
      if (a.est_min !== undefined) t.est = a.est_min || undefined
      if (a.parent_id !== undefined) { const np = a.parent_id ? find(d.tasks, a.parent_id, '親').id : undefined; if (!canMove(d.tasks, t.id, np)) throw new Error('自分自身や子孫を親にはできません'); t.parent = np; t.order = nextOrder(d.tasks.filter(x => x.id !== t.id), np) }
      if (a.milestone !== undefined) t.milestone = a.milestone || undefined; if (a.is_project !== undefined) t.isProject = a.is_project
      if (a.goal !== undefined) t.goal = a.goal; if (a.done_when !== undefined) t.doneWhen = a.done_when; if (a.approach !== undefined) t.approach = a.approach; if (a.archived !== undefined) t.archived = a.archived || undefined
      if (a.tags) t.tags = a.tags; if (a.repeat !== undefined) t.repeat = a.repeat; if (a.notes !== undefined) t.notes = a.notes
      stamp(t); return fmtTask(t)
    }, 'MCP: タスク更新')))
  server.registerTool('delete_task', { description: 'タスク/プロジェクトを削除する(元に戻せない)。子は1つ上の階層に付け替わり、消えない。', inputSchema: { id: z.string() }, annotations: { destructiveHint: true } },
    wrap(async ({ id }: { id: string }) => mutate(d => { const t = find(d.tasks, id, 'タスク'); d.tasks = d.tasks.filter(x => x !== t); d.tasks.forEach(c => { if (c.parent === id) { c.parent = t.parent; stamp(c) } }); remove(d, id); return { deleted: id, title: t.title } }, 'MCP: タスク削除')))

  /* ---------------- やりたいこと ---------------- */
  server.registerTool('list_wishes', { description: 'やりたいこと(願望リスト)の一覧。status: planned=進めている(プロジェクト化済みを含む) / someday=いつか / done=達成。', inputSchema: { status: z.enum(['planned', 'someday', 'done', 'all']).optional(), category: z.string().optional(), query: z.string().optional() }, annotations: { readOnlyHint: true } },
    wrap(async (a: { status?: string; category?: string; query?: string }) => read(d => d.wishes.filter(w => (!a.status || a.status === 'all' ? true : w.status === a.status) && (!a.category || w.category === a.category) && (!a.query || (w.title + w.note).toLowerCase().includes(a.query.toLowerCase()))).map(fmtWish))))
  server.registerTool('add_wish', { description: 'やりたいことを追加する(義務ではない願望。例: 下呂温泉に行く、法人を設立してみる)。実行を決めたら promote_wish でプロジェクトにする。', inputSchema: { title: z.string().min(1), note: z.string().optional().describe('なぜやりたいか・イメージ'), category: z.string().optional(), target: z.string().optional().describe('目安の時期(例 2027-03 / 来年の春)'), status: z.enum(['someday', 'planned']).optional() } },
    wrap(async (a: { title: string; note?: string; category?: string; target?: string; status?: 'someday' | 'planned' }) => mutate(d => { const w: Wish = { id: uid(), title: a.title, note: a.note || '', status: a.status || 'someday', category: a.category, target: a.target, tags: [], createdAt: new Date().toISOString(), u: now() }; d.wishes.unshift(w); return fmtWish(w) }, 'MCP: やりたいこと追加')))
  server.registerTool('update_wish', { description: 'やりたいことを更新する(指定した項目だけ)', inputSchema: { id: z.string(), title: z.string().optional(), note: z.string().optional(), category: z.string().optional(), target: z.string().optional(), status: z.enum(['someday', 'planned', 'done']).optional(), reflection: z.string().optional() } },
    wrap(async (a: { id: string; title?: string; note?: string; category?: string; target?: string; status?: 'someday' | 'planned' | 'done'; reflection?: string }) => mutate(d => { const w = find(d.wishes, a.id, 'やりたいこと'); if (a.title !== undefined) w.title = a.title; if (a.note !== undefined) w.note = a.note; if (a.category !== undefined) w.category = a.category; if (a.target !== undefined) w.target = a.target; if (a.reflection !== undefined) w.reflection = a.reflection; if (a.status) { w.status = a.status; if (a.status === 'done') w.doneAt = w.doneAt || new Date().toISOString(); else w.doneAt = undefined } stamp(w); return fmtWish(w) }, 'MCP: やりたいこと更新')))
  server.registerTool('promote_wish', { description: 'やりたいことをプロジェクトに昇格する(実行すると決まったとき)。プロジェクトが作られ、状態は planned になる。続けて update_task / add_wbs で目標・完了条件・WBSを整えるとよい。', inputSchema: { id: z.string(), goal: z.string().optional(), done_when: z.string().optional(), due: D.optional() } },
    wrap(async (a: { id: string; goal?: string; done_when?: string; due?: string }) => mutate(d => {
      const w = find(d.wishes, a.id, 'やりたいこと'); const ex = w.project ? d.tasks.find(t => t.id === w.project) : undefined; if (ex) return { already: true, project: fmtTask(ex), wish: fmtWish(w) }
      const p = mkTask({ title: w.title, isProject: true, goal: a.goal || w.title, doneWhen: a.done_when || '', notes: w.note, due: a.due, order: nextOrder(d.tasks, undefined), links: [{ kind: 'wish', id: w.id }] })
      d.tasks.unshift(p); w.project = p.id; w.status = 'planned'; stamp(w); return { project: fmtTask(p), wish: fmtWish(w) }
    }, 'MCP: やりたいこと→プロジェクト')))
  server.registerTool('complete_wish', { description: 'やりたいことを達成にする(叶ったとき)。reflection に感想・学びを残せる。リンク済みのプロジェクトは自動では完了にならない。', inputSchema: { id: z.string(), reflection: z.string().optional(), date: D.optional().describe('達成日(既定 今日)') } },
    wrap(async (a: { id: string; reflection?: string; date?: string }) => mutate(d => { const w = find(d.wishes, a.id, 'やりたいこと'); w.status = 'done'; w.doneAt = a.date ? new Date(a.date + 'T12:00:00').toISOString() : new Date().toISOString(); if (a.reflection !== undefined) w.reflection = a.reflection; stamp(w); return fmtWish(w) }, 'MCP: やりたいこと達成')))
  server.registerTool('delete_wish', { description: 'やりたいことを削除する(元に戻せない)', inputSchema: { id: z.string() }, annotations: { destructiveHint: true } },
    wrap(async ({ id }: { id: string }) => mutate(d => { const w = find(d.wishes, id, 'やりたいこと'); d.wishes = d.wishes.filter(x => x !== w); remove(d, id); return { deleted: id, title: w.title } }, 'MCP: やりたいこと削除')))

  /* ---------------- コレクション(ツール拡張のデータ) ---------------- */
  server.registerTool('collection_schemas', { description: 'ツール拡張のコレクション(データの種類)の一覧とスキーマ(項目・型・必須)。collection_* を使う前に確認する。', inputSchema: {}, annotations: { readOnlyHint: true } },
    wrap(async () => read(d => COLLECTIONS.map(c => ({ id: c.id, label: c.label, description: c.description, version: c.version, title_field: c.titleField, count: (d.ext[c.id] || []).length, fields: c.fields.map(f => ({ key: f.key, label: f.label, type: f.type, required: f.required || undefined, options: f.options, help: f.help })) })))))
  server.registerTool('collection_list', { description: 'コレクションのデータを一覧・検索する', inputSchema: { collection: z.string(), query: z.string().optional(), limit: z.number().int().min(1).max(200).optional() }, annotations: { readOnlyHint: true } },
    wrap(async (a: { collection: string; query?: string; limit?: number }) => read(d => { collection(a.collection); let l = d.ext[a.collection] || []; if (a.query) l = l.filter(x => JSON.stringify(x).toLowerCase().includes(a.query!.toLowerCase())); return { total: l.length, items: l.slice(0, a.limit || 50) } })))
  server.registerTool('collection_add', { description: 'コレクションにデータを1件追加する。data は collection_schemas のスキーマに従う(検証される)。参照項目(ref)は {kind, id}。', inputSchema: { collection: z.string(), data: z.record(z.unknown()) } },
    wrap(async (a: { collection: string; data: Record<string, unknown> }) => mutate(d => { const def = collection(a.collection); const v = validateItem(def, a.data); if (!v.ok) throw new Error(v.errors.join(' / ')); const it = { id: uid(), ...v.value, u: now() }; (d.ext[def.id] ||= []).unshift(it); return it }, 'MCP: コレクション追加')))
  server.registerTool('collection_update', { description: 'コレクションのデータを更新する(data に含めた項目だけ変わる。null で項目を消す)', inputSchema: { collection: z.string(), id: z.string(), data: z.record(z.unknown()) } },
    wrap(async (a: { collection: string; id: string; data: Record<string, unknown> }) => mutate(d => { const def = collection(a.collection); const it = find(d.ext[def.id] || [], a.id, 'データ'); const v = validateItem(def, a.data, true); if (!v.ok) throw new Error(v.errors.join(' / ')); Object.assign(it, v.value); stamp(it); return it }, 'MCP: コレクション更新')))
  server.registerTool('collection_delete', { description: 'コレクションのデータを削除する(元に戻せない)', inputSchema: { collection: z.string(), id: z.string() }, annotations: { destructiveHint: true } },
    wrap(async (a: { collection: string; id: string }) => mutate(d => { const def = collection(a.collection); const it = find(d.ext[def.id] || [], a.id, 'データ'); d.ext[def.id] = d.ext[def.id].filter(x => x !== it); remove(d, a.id); return { deleted: a.id } }, 'MCP: コレクション削除')))

  /* ---------------- 横断検索 ---------------- */
  server.registerTool('search', { description: 'タスク・プロジェクト・メモ・やりたいこと・コレクションを横断検索する。「あの件どこに書いたっけ」に使う。', inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }, annotations: { readOnlyHint: true } },
    wrap(async (a: { query: string; limit?: number }) => read(d => {
      const q = a.query.toLowerCase(); const has = (...s: (string | undefined)[]) => s.join(' ').toLowerCase().includes(q); const r: { kind: string; id: string; title: string; detail?: string }[] = []
      d.tasks.filter(t => has(t.title, t.notes, t.goal, t.doneWhen, t.approach)).forEach(t => r.push({ kind: t.isProject ? 'project' : 'task', id: t.id, title: t.title, detail: t.done ? '完了' : t.due }))
      d.wishes.filter(w => has(w.title, w.note, w.reflection)).forEach(w => r.push({ kind: 'wish', id: w.id, title: w.title, detail: w.status }))
      d.notes.filter(n => has(n.title, n.body, n.tree.map(x => x.text).join(' '), n.nodes.map(x => x.text).join(' '))).forEach(n => r.push({ kind: 'note', id: n.id, title: n.title || '(無題)', detail: n.kind }))
      d.events.filter(e => has(e.title, e.place)).forEach(e => r.push({ kind: 'event', id: e.id, title: e.title, detail: e.date }))
      for (const c of COLLECTIONS) (d.ext[c.id] || []).filter(x => JSON.stringify(x).toLowerCase().includes(q)).forEach(x => r.push({ kind: c.id, id: x.id, title: String(x[c.titleField] ?? ''), detail: c.label }))
      return { total: r.length, results: r.slice(0, a.limit || 20) }
    })))

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
  server.registerTool('complete_task', { description: 'タスクを完了(または done=false で未完了に戻す)。繰り返しタスクは完了ではなく次の期限へ進む。', inputSchema: { id: z.string(), done: z.boolean().optional() } },
    wrap(async ({ id, done }: { id: string; done?: boolean }) => mutate(d => {
      const t = find(d.tasks, id, 'タスク'); const want = done ?? true
      if (want && !t.done && t.repeat) {
        const base = t.due || today(); t.due = t.repeat === 'daily' ? addDays(base, 1) : t.repeat === 'weekly' ? addDays(base, 7) : addMonths(base, 1).replace(/-\d\d$/, base.slice(-3))
        if (t.block) t.block = { date: t.due, start: t.block.start, dur: t.block.dur }; t.subs.forEach(s => { s.done = false })
      } else { t.done = want; t.doneAt = want ? new Date().toISOString() : undefined }
      stamp(t); return fmtTask(t)
    }, 'MCP: タスク完了')))
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


  return server
}
