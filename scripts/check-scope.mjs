#!/usr/bin/env node
/**
 * ツール納品物のスコープ検査(docs/TOOL-SPEC.md §2)。
 * 使い方: npm run check:scope -- <ツールID> [比較元(既定 HEAD)]
 * 作業ツリーの変更(未コミット+未追跡)と 比較元からの差分が、そのツールに許された範囲に収まっているか調べる。
 */
import { execSync } from 'node:child_process'
const [id, base = 'HEAD'] = process.argv.slice(2)
if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id)) { console.error('使い方: npm run check:scope -- <ツールID> [比較元]'); process.exit(2) }

const sh = c => execSync(c, { encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean)
const changed = [...new Set([...sh(`git diff --name-only ${base}`), ...sh('git ls-files --others --exclude-standard')])]

// 新規作成してよい(このツール専用)
const own = [
  new RegExp(`^src/collections/${id}\\.tsx?$`),
  new RegExp(`^src/extensions/${id}\\.tsx?$`),
  new RegExp(`^src/extensions/${id}/`),
  new RegExp(`^docs/tools/${id}\\.md$`),
  new RegExp(`^tests/tools/${id}\\.test\\.ts$`),
]
// 追記だけ許す共有ファイル(差分で確認する)
const appendOnly = ['src/collections/index.ts', 'docs/CHANGELOG-DATA.md', 'docs/tools/README.md']

const bad = []
for (const f of changed) {
  if (own.some(r => r.test(f))) continue
  if (appendOnly.includes(f)) {
    const removed = sh(`git diff -U0 ${base} -- ${f}`).filter(l => l.startsWith('-') && !l.startsWith('---'))
    // index.ts は import 行の追加と配列への1項目の追加が主。既存行の削除・書き換えは不可
    if (removed.length) bad.push(`${f}: 既存の行が削除・変更されています(追記だけ許されます)\n      ${removed.join('\n      ')}`)
    continue
  }
  bad.push(`${f}: このツール(${id})が触ってよい範囲の外です。変更が必要なら「本体への依頼」(TOOL-SPEC §7)にしてください`)
}
if (!changed.length) { console.error(`変更がありません(比較元 ${base})`); process.exit(2) }
if (bad.length) { console.error('✗ スコープ検査に失敗:\n' + bad.map(e => '  - ' + e).join('\n')); process.exit(1) }
console.log(`✓ スコープ検査 OK(${id}: ${changed.length} ファイル)`)
