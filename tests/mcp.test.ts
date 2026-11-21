import assert from 'node:assert/strict'
import worker from '../mcp/src/worker'
import { mockGithub } from './mock-github'

const SECRET = 'x'.repeat(32)
const gh = await mockGithub({ version: 1, tasks: [{ id: 'old1', title: '旧タスク', notes: '', done: false, priority: 1, project: '仕事', tags: [], repeat: null, subs: [], createdAt: '2026-01-01T00:00:00Z', u: 1 }], events: [], habits: [], notes: [], reviews: {}, projects: ['仕事'], deleted: {} })
const env = { SELFDESK_GITHUB_TOKEN: 't', SELFDESK_REPO: 'o/r', SELFDESK_MCP_SECRET: SECRET, SELFDESK_API: gh.url }
let rid = 0
const rpc = async (method: string, params?: unknown, path = `/${SECRET}/mcp`) => {
  const r = await worker.fetch(new Request('https://w.example' + path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method, params }) }), env)
  return { status: r.status, body: r.status === 200 ? await r.json() as any : await r.text() }
}
const call = async (name: string, args: unknown = {}) => { const r = await rpc('tools/call', { name, arguments: args }); assert.equal(r.status, 200); const res = r.body.result; const txt = res.content[0].text; return { err: !!res.isError, v: (() => { try { return JSON.parse(txt) } catch { return txt } })() } }
let n = 0; const t = async (name: string, fn: () => Promise<void>) => { await fn(); n++; console.log('ok', name) }

await t('認証: 秘密が違えば404、GETは405', async () => {
  assert.equal((await rpc('tools/list', {}, '/wrong/mcp')).status, 404)
  const g = await worker.fetch(new Request(`https://w.example/${SECRET}/mcp`), env); assert.equal(g.status, 405)
})
await t('initialize で instructions(ガイド)が返る / tools/list', async () => {
  const i = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } }); assert.match(i.body.result.instructions, /source of truth/)
  const l = await rpc('tools/list'); const names = l.body.result.tools.map((x: any) => x.name)
  for (const need of ['get_overview', 'list_projects', 'get_project', 'create_project', 'add_wbs', 'move_task', 'list_wishes', 'add_wish', 'promote_wish', 'complete_wish', 'collection_schemas', 'search', 'get_guide']) assert.ok(names.includes(need), need)
  console.log('   tools:', names.length)
})
await t('旧データ(project文字列)が移行され、リモート経由でも見える', async () => {
  const ov = (await call('get_overview')).v; assert.equal(ov.active_projects.length, 1); assert.equal(ov.active_projects[0].title, '仕事')
  const l = (await call('list_tasks', { project: '仕事' })).v; assert.equal(l.total, 1); assert.equal(l.tasks[0].project, '仕事')
})
let pid = ''
await t('create_project + WBS一括 + get_project の進捗', async () => {
  const p = (await call('create_project', { title: '法人設立', goal: '2027年3月までに設立', done_when: '登記・口座開設が完了', wbs_outline: '準備 ~3h 12/10\n  定款を作る ~2h\n  - 資本金を決める\n◆ 登記申請 12/20' })).v
  pid = p.id; assert.equal(p.wbs_items_created, 4)
  const g = (await call('get_project', { id: pid })).v
  assert.equal(g.leaves, 3); assert.equal(g.progress_pct, 0); assert.equal(g.milestones.length, 1); assert.deepEqual(g.wbs.map((r: any) => r.code), ['1', '1.1', '1.2', '2'])
  const leaf = g.wbs.find((r: any) => r.title === '定款を作る'); await call('complete_task', { id: leaf.id })
  assert.equal((await call('get_project', { id: '法人設立' })).v.progress_pct, 33)
})
await t('move_task は循環を拒否、親付け替えはOK', async () => {
  const g = (await call('get_project', { id: pid })).v; const parent = g.wbs.find((r: any) => r.title === '準備'), child = g.wbs.find((r: any) => r.title === '定款を作る')
  assert.equal((await call('move_task', { id: parent.id, parent_id: child.id })).err, true)
  assert.equal((await call('move_task', { id: child.id, parent_id: pid })).err, false)
})
await t('昇格/降格(update_task) と 削除時の子の付け替え', async () => {
  const g = (await call('get_project', { id: pid })).v; const m = g.wbs.find((r: any) => r.title === '準備')
  assert.equal((await call('update_task', { id: m.id, is_project: true, goal: '準備を終える' })).v.is_project, true)
  await call('delete_task', { id: m.id }); const g2 = (await call('get_project', { id: pid })).v; assert.ok(g2.wbs.some((r: any) => r.title === '資本金を決める' && r.depth === 0))
})
await t('やりたいこと: 追加→昇格→達成', async () => {
  const w = (await call('add_wish', { title: '下呂温泉に行く', category: '旅行' })).v; assert.equal(w.status, 'someday')
  const pr = (await call('promote_wish', { id: w.id })).v; assert.equal(pr.wish.status, 'planned'); assert.equal(pr.project.is_project, true)
  assert.equal((await call('promote_wish', { id: w.id })).v.already, true)
  const c = (await call('complete_wish', { id: w.id, reflection: '最高だった' })).v; assert.equal(c.status, 'done'); assert.equal((await call('list_wishes', { status: 'done' })).v.length, 1)
})
await t('search が横断で当たる', async () => {
  const r = (await call('search', { query: '下呂' })).v; assert.ok(r.results.some((x: any) => x.kind === 'wish')); assert.ok(r.results.some((x: any) => x.kind === 'project'))
})
await t('保存されたデータ: wishes があり、旧 project 文字列が残っていない', async () => {
  const d = gh.data(); assert.equal(d.wishes.length, 1); assert.ok(d.tasks.every((x: any) => x.project === undefined)); assert.ok(d.tasks.some((x: any) => x.isProject && x.title === '仕事'))
})
await t('collection_*: スキーマが空でも安全にエラーを返す', async () => {
  assert.deepEqual((await call('collection_schemas')).v, []); const r = await call('collection_add', { collection: 'nope', data: {} }); assert.equal(r.err, true)
})
console.log(`\n${n} tests passed (GitHub PUT ${gh.puts()}回)`); gh.close()
