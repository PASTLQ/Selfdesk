import assert from 'node:assert/strict'
import { normalize, mergeData, legacyProjectId, emptyData } from '../src/core/merge'
import { rollup, wbs, canMove, descendants, isActionable, projectOf } from '../src/core/tree'
import { outlineToTasks } from '../src/core/wbs-outline'
import { defineCollection, validateItem } from '../src/core/collections'
import type { Task, Data } from '../src/types'

const T = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, notes: '', done: false, priority: 0, tags: [], repeat: null, subs: [], createdAt: '2026-01-01T00:00:00Z', ...extra })
let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok', name) }

t('旧 project 文字列が決定的なIDの親プロジェクトに移行される', () => {
  const old = { tasks: [T('a', { project: '仕事' }), T('b', { project: '仕事' }), T('c', { project: '' })], projects: ['仕事', '個人'] } as unknown as Data
  const d1 = normalize(old), d2 = normalize(old)
  const id = legacyProjectId('仕事')
  assert.equal(d1.tasks.filter(x => x.isProject).length, 1)   // 使われていない「個人」は作らない
  assert.equal(d1.tasks.find(x => x.id === 'a')!.parent, id); assert.equal(d1.tasks.find(x => x.id === 'c')!.parent, undefined)
  assert.equal(d1.tasks.find(x => x.id === 'a')!.project, undefined)
  assert.deepEqual(d1.tasks.map(x => x.id).sort(), d2.tasks.map(x => x.id).sort())
  assert.equal(normalize(d1).tasks.length, d1.tasks.length)   // 冪等
})
t('2端末が別々に移行しても重複しない', () => {
  const old = { tasks: [T('a', { project: 'X', u: 5 })] } as unknown as Data
  const m = mergeData(normalize(old), normalize(old)); assert.equal(m.tasks.filter(x => x.isProject).length, 1)
})
t('削除済みの移行プロジェクトは復活しない', () => {
  const id = legacyProjectId('X'); const d = normalize({ tasks: [T('a', { project: 'X' })], deleted: { [id]: 10 } } as unknown as Data)
  assert.equal(d.tasks.some(x => x.isProject), false); assert.equal(d.tasks[0].parent, undefined)
})
t('マージ: wishes と ext が項目ごとに新しい方を採用', () => {
  const a = emptyData(), b = emptyData()
  a.wishes = [{ id: 'w', title: 'A', note: '', status: 'someday', tags: [], createdAt: '', u: 1 }]; b.wishes = [{ id: 'w', title: 'B', note: '', status: 'someday', tags: [], createdAt: '', u: 2 }]
  a.ext = { books: [{ id: 'x', title: 'old', u: 1 }] }; b.ext = { books: [{ id: 'x', title: 'new', u: 3 }, { id: 'y', title: 'y', u: 1 }], other: [{ id: 'z', u: 1 }] }
  const m = mergeData(a, b); assert.equal(m.wishes[0].title, 'B'); assert.equal(m.ext.books.length, 2); assert.equal(m.ext.books.find(x => x.id === 'x')!.title, 'new'); assert.equal(m.ext.other.length, 1)
  b.deleted = { y: 5 }; assert.equal(mergeData(a, b).ext.books.length, 1)
})
const tasks = [T('P', { isProject: true }), T('A', { parent: 'P', order: 0 }), T('B', { parent: 'P', order: 1 }), T('A1', { parent: 'A', done: true, est: 60 }), T('A2', { parent: 'A', est: 30, due: '2026-02-01' }), T('B1', { parent: 'B', est: 90, start: '2026-01-10' })]
t('ツリー: 進捗・見積・期間のロールアップ', () => {
  const r = rollup(tasks, 'P', '2026-03-01'); assert.equal(r.leaves, 3); assert.equal(r.done, 1); assert.equal(r.pct, 33); assert.equal(r.estMin, 180); assert.equal(r.remainMin, 120); assert.equal(r.start, '2026-01-10'); assert.equal(r.end, '2026-02-01'); assert.equal(r.overdue, 1)
})
t('ツリー: WBS番号・循環防止・実行可能判定・所属プロジェクト', () => {
  assert.deepEqual(wbs(tasks, 'P').map(r => r.code + r.t.id), ['1A', '1.1A1', '1.2A2', '2B', '2.1B1'])
  assert.equal(canMove(tasks, 'A', 'A1'), false); assert.equal(canMove(tasks, 'A', 'B'), true); assert.equal(descendants(tasks, 'P').length, 5)
  assert.equal(isActionable(tasks, tasks[0]), false); assert.equal(isActionable(tasks, tasks[1]), false); assert.equal(isActionable(tasks, tasks[3]), true); assert.equal(projectOf(tasks, 'A1')!.id, 'P')
})
t('WBS一括: インデント・◆・■・クイック記法', () => {
  const out = outlineToTasks('市場調査 ~3h 4/10\n  競合を調べる ~2h\n  - 顧客に聞く !2\n◆ 企画承認 4/30\n■ 子プロジェクト', 'P', [])
  assert.equal(out.length, 5); const by = (s: string) => out.find(x => x.title === s)!
  assert.equal(by('市場調査').parent, 'P'); assert.equal(by('競合を調べる').parent, by('市場調査').id); assert.equal(by('顧客に聞く').priority, 2)
  assert.equal(by('企画承認').milestone, true); assert.equal(by('企画承認').parent, 'P'); assert.equal(by('子プロジェクト').isProject, true); assert.equal(by('市場調査').est, 180)
  assert.deepEqual(['市場調査', '企画承認', '子プロジェクト'].map(s => by(s).order), [0, 1, 2])
})
t('コレクション: 定義の検証と入力の検証', () => {
  assert.throws(() => defineCollection({ id: 'Task', label: '', description: '', fields: [], titleField: 'x', version: 1 }))
  assert.throws(() => defineCollection({ id: 'task', label: '', description: '', fields: [{ key: 'x', label: 'x', type: 'text' }], titleField: 'x', version: 1 }), /予約/)
  const def = defineCollection({ id: 'books', label: '本', description: '', version: 1, titleField: 'title', fields: [{ key: 'title', label: '書名', type: 'text', required: true }, { key: 'status', label: '状態', type: 'select', options: ['a', 'b'] }, { key: 'rating', label: '評価', type: 'number' }] })
  assert.equal(validateItem(def, { status: 'a' }).ok, false); assert.equal(validateItem(def, { title: 't', status: 'z' }).ok, false)
  const ok = validateItem(def, { title: 't', rating: 3, junk: 1 }); assert.equal(ok.ok, true); assert.deepEqual((ok as any).value, { title: 't', rating: 3 })
  assert.equal(validateItem(def, { rating: 4 }, true).ok, true)
})
console.log(`\n${n} tests passed`)
